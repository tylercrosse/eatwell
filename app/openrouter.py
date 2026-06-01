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
from app.schemas import FOOD_ANALYSIS_JSON_SCHEMA, AnalysisResult

_SYSTEM_PROMPT = (
    "You are a nutrition estimator. Given a food photo, identify each distinct food, "
    "estimate its serving size and macros, and return ONLY data matching the schema. "
    "Calories are kcal; protein, carbs and fat are in grams. The macro totals must be the "
    "sum of the per-item values. Also estimate the total edible weight in grams "
    "(total_weight_g) and the totals for fiber and sugar (grams) and sodium (milligrams). "
    "If you are unsure, still give your best estimate but lower the confidence value "
    "(0 = guess, 1 = very confident)."
)

_TEXT_SYSTEM_PROMPT = (
    "You are a nutrition estimator. The user describes one or more foods in plain text "
    "(e.g. 'small gelato' or '12 oz iced latte'). Use the search_foods tool to look up "
    "grounded nutrition data for each distinct food. The tool returns macros PER 100g (or "
    "per 100ml). Scale each food to the portion the user described, list each as an item, and "
    "make the macro totals the sum of the per-item values. Also estimate the total edible "
    "weight in grams (total_weight_g) and the totals for fiber and sugar (grams) and sodium "
    "(milligrams). Calories are kcal; protein, carbs and fat are in grams. Prefer the tool data "
    "over your own guesses; if a search returns nothing useful or the tool is unavailable, fall "
    "back to your best estimate and lower the confidence (0 = guess, 1 = very confident)."
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


async def analyze_food_image(jpeg_bytes: bytes, settings: Settings) -> AnalysisResult:
    """Send a (normalized JPEG) food photo to the model and return structured macros."""
    if not settings.openrouter_api_key:
        raise EstimationError("OPENROUTER_API_KEY is not configured.")

    data_url = "data:image/jpeg;base64," + base64.b64encode(jpeg_bytes).decode("ascii")

    try:
        resp = await _client(settings).chat.completions.create(
            model=settings.openrouter_model,
            timeout=settings.openrouter_timeout,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Analyze this meal and estimate its nutrition."},
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
