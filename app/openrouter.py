"""OpenRouter client wrapper.

OpenRouter is OpenAI-compatible, so we use the official ``openai`` SDK pointed at
their base URL. The model is asked for strict structured JSON via response_format.
"""

from __future__ import annotations

import base64

from openai import APIError, AsyncOpenAI
from pydantic import ValidationError

from app.config import Settings
from app.schemas import FOOD_ANALYSIS_JSON_SCHEMA, AnalysisResult

_SYSTEM_PROMPT = (
    "You are a nutrition estimator. Given a food photo, identify each distinct food, "
    "estimate its serving size and macros, and return ONLY data matching the schema. "
    "Calories are kcal; protein, carbs and fat are in grams. The totals must be the sum "
    "of the per-item values. If you are unsure, still give your best estimate but lower "
    "the confidence value (0 = guess, 1 = very confident)."
)


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
    if not content:
        raise EstimationError("Model returned an empty response.")

    try:
        return AnalysisResult.model_validate_json(content)
    except ValidationError as exc:
        raise EstimationError(f"Model returned malformed nutrition data: {exc}") from exc
