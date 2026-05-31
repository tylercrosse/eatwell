from __future__ import annotations

import asyncio

import httpx
import pytest

from app import usda
from app.config import Settings

# A trimmed FoodData Central /foods/search payload. The first food carries a plain
# kcal Energy nutrient ("208"); the second omits it to exercise the Atwater fallback
# and also carries a branded serving size.
_FDC_PAYLOAD = {
    "foods": [
        {
            "fdcId": 1,
            "description": "Latte, with whole milk",
            "dataType": "Survey (FNDDS)",
            "foodNutrients": [
                {"nutrientNumber": "208", "nutrientName": "Energy", "unitName": "KCAL", "value": 56},
                {"nutrientNumber": "203", "nutrientName": "Protein", "unitName": "G", "value": 3.0},
                {"nutrientNumber": "205", "nutrientName": "Carbohydrate", "unitName": "G", "value": 5.2},
                {"nutrientNumber": "204", "nutrientName": "Total lipid (fat)", "unitName": "G", "value": 2.0},
            ],
        },
        {
            "fdcId": 2,
            "description": "ICED LATTE",
            "dataType": "Branded",
            "servingSize": 240,
            "servingSizeUnit": "ml",
            "foodNutrients": [
                {
                    "nutrientNumber": "957",
                    "nutrientName": "Energy (Atwater General Factors)",
                    "unitName": "KCAL",
                    "value": 40,
                },
                {"nutrientNumber": "203", "nutrientName": "Protein", "unitName": "G", "value": 1.5},
                {"nutrientNumber": "205", "nutrientName": "Carbohydrate", "unitName": "G", "value": 6.0},
                {"nutrientNumber": "204", "nutrientName": "Total lipid (fat)", "unitName": "G", "value": 1.0},
            ],
        },
    ]
}


class _FakeResp:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


def test_search_foods_parses_per_100g(monkeypatch):
    async def fake_get(self, url, params=None):
        assert params["query"] == "latte"
        assert params["api_key"] == "test-key"
        return _FakeResp(_FDC_PAYLOAD)

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    matches = asyncio.run(usda.search_foods("latte", Settings(usda_api_key="test-key")))

    assert len(matches) == 2
    first = matches[0]
    assert first.description == "Latte, with whole milk"
    assert first.calories_per_100g == 56
    assert first.protein_per_100g == 3.0
    assert first.carbs_per_100g == 5.2
    assert first.fat_per_100g == 2.0
    assert first.branded_serving is None

    branded = matches[1]
    assert branded.calories_per_100g == 40  # via the Atwater fallback
    assert branded.branded_serving == "240 ml"


def test_search_foods_requires_key():
    with pytest.raises(usda.UsdaError):
        asyncio.run(usda.search_foods("latte", Settings(usda_api_key="")))


def test_search_foods_maps_http_error(monkeypatch):
    async def fake_get(self, url, params=None):
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    with pytest.raises(usda.UsdaError):
        asyncio.run(usda.search_foods("latte", Settings(usda_api_key="test-key")))
