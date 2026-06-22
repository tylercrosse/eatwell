"""OpenRouter client wrapper.

OpenRouter is OpenAI-compatible, so we use the official ``openai`` SDK pointed at
their base URL. The model is asked for strict structured JSON via response_format.
"""

from __future__ import annotations

import base64
import json
from dataclasses import asdict

from openai import APIError, AsyncOpenAI
from pydantic import ValidationError

from app import usda
from app.config import Settings
from app.schemas import (
    ACTIVITY_ANALYSIS_JSON_SCHEMA,
    FOOD_ANALYSIS_JSON_SCHEMA,
    MENU_ANALYSIS_JSON_SCHEMA,
    MENU_SCAN_OPTION_LIMIT,
    ActivityResult,
    AnalysisResult,
    MenuAnalysisResult,
)

_ITEM_GRANULARITY = (
    "Make one item per distinct DISH or DRINK the person would log separately. Keep a composite "
    "dish whole — a salad, sandwich, bowl or stir-fry is ONE item with combined nutrition; do NOT "
    "split it into its ingredients. Separate only independently-served things: each plate/side, and "
    "every drink. E.g. a plate of fruit + a bowl of yogurt + a coffee + a juice → 4 items; a caprese "
    "or burrata salad → 1 item."
)

_PER_ITEM_FIELDS = (
    "For EACH item give its own calories (kcal), protein/carbs/fat (grams), edible weight_g (grams), "
    "fiber_g/sugar_g (grams), sodium_mg (milligrams), is_beverage (true only for a drink you sip "
    "— coffee, tea, juice, soda, alcohol, milk, smoothie, protein shake; false for solid foods and for "
    "soups/broths eaten as a meal), and a category describing how the item LOOKS on the table (its "
    "visual form, for an icon): prefer a specific dish-type when it clearly fits (pizza, pasta, salad, "
    "soup_stew, taco_burrito, pastry), else the vessel form (handheld, bowl, plate, hot_drink, "
    "cold_drink, alcohol), else the food group (fruit, vegetables, protein, grains_bread, dairy, "
    "snacks, sweets, extras). The total_* fields must be the sum of the per-item values, and the "
    "overall is_beverage is true only if every item is a drink."
)

_SYSTEM_PROMPT = (
    "You are a nutrition estimator. Given a food photo, identify the foods and return ONLY data "
    "matching the schema. " + _ITEM_GRANULARITY + " " + _PER_ITEM_FIELDS + " If you are unsure, still "
    "give your best estimate but lower the confidence value (0 = guess, 1 = very confident)."
)

_TEXT_SYSTEM_PROMPT = (
    "You are a nutrition estimator. The user describes one or more foods in plain text "
    "(e.g. 'small gelato' or '12 oz iced latte'). Use the search_foods tool to look up "
    "grounded nutrition data for each distinct food, and scale it to the portion described. "
    "The tool returns macros PER 100g (or per 100ml). " + _ITEM_GRANULARITY + " " + _PER_ITEM_FIELDS +
    " Prefer the tool data over your own guesses; if a search returns nothing useful or the tool is "
    "unavailable, fall back to your best estimate and lower the confidence (0 = guess, 1 = very confident)."
)

# OpenAI-style function tool the text estimator may call to ground each food.
SEARCH_FOODS_TOOL = {
    "type": "function",
    "function": {
        "name": "search_foods",
        "description": (
            "Search the USDA FoodData Central database for a food and return candidate "
            "matches with macros per 100g. Call once per distinct food."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "A single food to look up, e.g. 'gelato' or 'latte with milk'",
                }
            },
            "required": ["query"],
        },
    },
}

_ACTIVITY_SYSTEM_PROMPT = (
    "You estimate energy burned for a described physical activity (e.g. '30 min easy "
    "weight lifting' or '20 min light jog'). Estimate the duration in minutes, the total "
    "calories burned, and a short activity name, using standard MET values for an adult of "
    "about {weight} kg. Return ONLY data matching the schema. If unsure, still give your best "
    "estimate but lower the confidence (0 = guess, 1 = very confident)."
)

_MENU_SYSTEM_PROMPT = (
    "You analyze restaurant menu photos to help someone compare what to order. Return ONLY "
    "data matching the schema. Extract up to 24 clearly visible ORDERABLE menu items. Return "
    "items in the same reading order they appear in the image when possible. Skip "
    "section headers, modifiers, sauce choices, toppings, and add-ons unless they are standalone "
    "items someone could order. Track the nearest preceding visible section heading or column "
    "heading for every item, such as Salads, Burgers, Drinks, Sides, or Entrees, and put that exact "
    "heading in section. Do not leave section empty when a heading clearly applies to the item. If a "
    "restaurant name, price, or description is visible, copy it; otherwise use an empty string. For "
    "each option, estimate nutrition for one typical restaurant serving, including calories, "
    "protein/carbs/fat, edible weight_g, fiber_g, sugar_g, sodium_mg, is_beverage, and a "
    "serving_size_estimate. Mark drinks as is_beverage=true; soups and broths eaten as meals are not "
    "beverages. Use source_text to quote the visible menu text you used for that option. If the image "
    "is blurry or an item is uncertain, lower confidence."
)

_MAX_TOOL_ROUNDS = 4


class EstimationError(RuntimeError):
    """Upstream model call failed or returned unparseable output."""


def _client(settings: Settings) -> AsyncOpenAI:
    return AsyncOpenAI(
        base_url=settings.openrouter_base_url,
        api_key=settings.openrouter_api_key,
        default_headers={
            "HTTP-Referer": settings.app_referer,
            "X-Title": settings.app_title,
        },
    )


def _parse_analysis(content: str | None) -> AnalysisResult:
    """Validate the model's JSON content into an ``AnalysisResult``."""
    if not content:
        raise EstimationError("Model returned an empty response.")
    try:
        return AnalysisResult.model_validate_json(content)
    except ValidationError as exc:
        raise EstimationError(f"Model returned malformed nutrition data: {exc}") from exc


def _parse_menu_analysis(content: str | None) -> MenuAnalysisResult:
    """Validate the model's JSON content into a ``MenuAnalysisResult``."""
    if not content:
        raise EstimationError("Model returned an empty response.")
    try:
        payload = json.loads(content)
        if isinstance(payload, dict) and isinstance(payload.get("options"), list):
            payload["options"] = payload["options"][:MENU_SCAN_OPTION_LIMIT]
        return MenuAnalysisResult.model_validate(payload)
    except ValidationError as exc:
        raise EstimationError(f"Model returned malformed menu data: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise EstimationError(f"Model returned malformed menu JSON: {exc}") from exc


async def analyze_food_image(
    jpeg_bytes: bytes, settings: Settings, context: str | None = None
) -> AnalysisResult:
    """Send a (normalized JPEG) food photo to the model and return structured macros."""
    if not settings.openrouter_api_key:
        raise EstimationError("OPENROUTER_API_KEY is not configured.")

    data_url = "data:image/jpeg;base64," + base64.b64encode(jpeg_bytes).decode("ascii")
    note = context.strip() if context else ""
    prompt = "Analyze this meal and estimate its nutrition."
    if note:
        prompt += f"\n\nUser context: {note}"

    try:
        resp = await _client(settings).chat.completions.create(
            model=settings.openrouter_model,
            timeout=settings.openrouter_timeout,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "food_analysis",
                    "strict": True,
                    "schema": FOOD_ANALYSIS_JSON_SCHEMA,
                },
            },
        )
    except APIError as exc:
        raise EstimationError(f"OpenRouter request failed: {exc}") from exc

    content = resp.choices[0].message.content if resp.choices else None
    return _parse_analysis(content)


async def analyze_menu_image(jpeg_bytes: bytes, settings: Settings) -> MenuAnalysisResult:
    """Send a menu photo to the model and return comparable menu options."""
    if not settings.openrouter_api_key:
        raise EstimationError("OPENROUTER_API_KEY is not configured.")

    data_url = "data:image/jpeg;base64," + base64.b64encode(jpeg_bytes).decode("ascii")

    try:
        resp = await _client(settings).chat.completions.create(
            model=settings.openrouter_model,
            timeout=settings.openrouter_timeout,
            messages=[
                {"role": "system", "content": _MENU_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Scan this menu and extract orderable options to compare.",
                        },
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "menu_analysis",
                    "strict": True,
                    "schema": MENU_ANALYSIS_JSON_SCHEMA,
                },
            },
        )
    except APIError as exc:
        raise EstimationError(f"OpenRouter request failed: {exc}") from exc

    content = resp.choices[0].message.content if resp.choices else None
    return _parse_menu_analysis(content)


async def analyze_food_text(description: str, settings: Settings) -> AnalysisResult:
    """Estimate macros from a text description, grounding each food via USDA FDC.

    Runs a tool-calling loop so the model can look up real nutrition data, then makes a
    final strict-JSON call. With no USDA key, it skips the loop (ungrounded fallback).
    """
    if not settings.openrouter_api_key:
        raise EstimationError("OPENROUTER_API_KEY is not configured.")

    client = _client(settings)
    messages: list[dict] = [
        {"role": "system", "content": _TEXT_SYSTEM_PROMPT},
        {"role": "user", "content": f"Estimate the nutrition for: {description}"},
    ]

    try:
        if settings.usda_api_key:
            await _run_tool_loop(client, messages, settings)
            messages.append(
                {
                    "role": "user",
                    "content": "Now return the final nutrition estimate as JSON matching the schema.",
                }
            )
        resp = await client.chat.completions.create(
            model=settings.openrouter_model,
            timeout=settings.openrouter_timeout,
            messages=messages,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "food_analysis",
                    "strict": True,
                    "schema": FOOD_ANALYSIS_JSON_SCHEMA,
                },
            },
        )
    except APIError as exc:
        raise EstimationError(f"OpenRouter request failed: {exc}") from exc

    content = resp.choices[0].message.content if resp.choices else None
    return _parse_analysis(content)


def _parse_activity(content: str | None) -> ActivityResult:
    if not content:
        raise EstimationError("Model returned an empty response.")
    try:
        return ActivityResult.model_validate_json(content)
    except ValidationError as exc:
        raise EstimationError(f"Model returned malformed activity data: {exc}") from exc


async def analyze_activity_text(
    description: str, weight_kg: float | None, settings: Settings
) -> ActivityResult:
    """Estimate calories burned for a free-text activity, tuned to the user's weight."""
    if not settings.openrouter_api_key:
        raise EstimationError("OPENROUTER_API_KEY is not configured.")

    weight = round(weight_kg) if weight_kg else 75
    try:
        resp = await _client(settings).chat.completions.create(
            model=settings.openrouter_model,
            timeout=settings.openrouter_timeout,
            messages=[
                {"role": "system", "content": _ACTIVITY_SYSTEM_PROMPT.format(weight=weight)},
                {"role": "user", "content": f"Estimate the calories burned for: {description}"},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "activity_analysis",
                    "strict": True,
                    "schema": ACTIVITY_ANALYSIS_JSON_SCHEMA,
                },
            },
        )
    except APIError as exc:
        raise EstimationError(f"OpenRouter request failed: {exc}") from exc

    content = resp.choices[0].message.content if resp.choices else None
    return _parse_activity(content)


async def _run_tool_loop(client: AsyncOpenAI, messages: list[dict], settings: Settings) -> None:
    """Let the model call search_foods, feeding USDA results back, until it stops (or caps out)."""
    for _ in range(_MAX_TOOL_ROUNDS):
        resp = await client.chat.completions.create(
            model=settings.openrouter_model,
            timeout=settings.openrouter_timeout,
            messages=messages,
            tools=[SEARCH_FOODS_TOOL],
            tool_choice="auto",
        )
        message = resp.choices[0].message if resp.choices else None
        tool_calls = (message.tool_calls if message else None) or []
        if not tool_calls:
            return
        # Echo the assistant turn (with its tool calls) back into the history.
        messages.append(
            {
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in tool_calls
                ],
            }
        )
        for tc in tool_calls:
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": await _run_search_tool(tc.function.arguments, settings),
                }
            )


async def _run_search_tool(arguments: str, settings: Settings) -> str:
    """Execute one search_foods tool call; return JSON the model can read back."""
    try:
        query = json.loads(arguments).get("query", "")
    except (json.JSONDecodeError, AttributeError):
        query = ""
    if not query:
        return json.dumps({"error": "missing query", "matches": []})
    try:
        matches = await usda.search_foods(query, settings)
    except usda.UsdaError as exc:
        return json.dumps({"error": str(exc), "matches": []})
    return json.dumps({"matches": [asdict(m) for m in matches]})
