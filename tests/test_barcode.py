from __future__ import annotations

import asyncio

import httpx

from app import barcode
from app.config import Settings
from app.schemas import BarcodeFood

# --- Fake upstreams --------------------------------------------------------

# An FDC Branded /foods/search hit (nutrients per 100 g) whose GTIN matches a 12-digit UPC-A
# scan once leading-zero padding is ignored. servingSize 30 g -> per-serving factor 0.3.
_FDC_MATCH = {
    "foods": [
        {
            "fdcId": 99,
            "description": "PROTEIN BAR, CHOCOLATE",
            "dataType": "Branded",
            "brandOwner": "ACME FOODS",
            "gtinUpc": "0049000028911",  # EAN-13 form of the UPC-A scanned below
            "servingSize": 30,
            "servingSizeUnit": "g",
            "householdServingFullText": "1 bar",
            "foodNutrients": [
                {"nutrientNumber": "208", "nutrientName": "Energy", "unitName": "KCAL", "value": 400},
                {"nutrientNumber": "203", "value": 20},
                {"nutrientNumber": "205", "value": 60},
                {"nutrientNumber": "204", "value": 15},
                {"nutrientNumber": "291", "value": 20},
                {"nutrientNumber": "269", "value": 50},
                {"nutrientNumber": "307", "value": 500},  # sodium, already mg
            ],
        }
    ]
}

# An OFF v2 product payload (per-serving nutriments present; sodium in grams).
_OFF_HIT = {
    "status": 1,
    "product": {
        "code": "3017620422003",
        "product_name": "Hazelnut Spread",
        "brands": "Ferrero, Nutella",
        "serving_size": "15 g",
        "serving_quantity": 15,
        "categories_tags": ["en:spreads", "en:hazelnut-spreads"],
        "nutriments": {
            "energy-kcal_serving": 80,
            "proteins_serving": 1,
            "carbohydrates_serving": 8.5,
            "fat_serving": 4.5,
            "sugars_serving": 8.3,
            "fiber_serving": 0,
            "sodium_serving": 0.0107,  # grams -> 10.7 mg
        },
    },
}

_OFF_MISS = {"status": 0}
_USDA_NO_MATCH = {"foods": [{"description": "OTHER", "gtinUpc": "111", "dataType": "Branded"}]}


class _FakeResp:
    def __init__(self, payload: dict, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


def _settings() -> Settings:
    return Settings(usda_api_key="test-key")


def _dispatcher(usda_payload: dict, off_payload: dict):
    """A fake httpx GET that routes by host: FDC search vs the OFF product endpoint."""

    async def fake_get(self, url, params=None, headers=None):
        if "api.nal.usda.gov" in url:
            return _FakeResp(usda_payload)
        if "openfoodfacts.org" in url:
            return _FakeResp(off_payload)
        raise AssertionError(f"unexpected url {url}")

    return fake_get


# --- USDA-first path -------------------------------------------------------


def test_lookup_prefers_usda_branded_by_gtin(monkeypatch):
    # OFF would also "match" but must not be consulted once USDA answers.
    monkeypatch.setattr(httpx.AsyncClient, "get", _dispatcher(_FDC_MATCH, _OFF_HIT))

    food = asyncio.run(barcode.lookup_barcode("049000028911", _settings()))

    assert isinstance(food, BarcodeFood)
    assert food.source == "usda"
    assert food.name == "Protein Bar, Chocolate"  # ALL-CAPS FDC name title-cased
    assert food.brand == "Acme Foods"
    assert food.weight_g == 30
    assert food.serving_size == "1 bar (30 g)"
    # per-100g scaled by 30/100
    assert food.calories == 120
    assert food.protein_g == 6
    assert food.carbs_g == 18
    assert food.fat_g == 4.5
    assert food.fiber_g == 6
    assert food.sugar_g == 15
    assert food.sodium_mg == 150
    assert food.is_beverage is False


def test_lookup_falls_back_to_off_when_usda_misses(monkeypatch):
    monkeypatch.setattr(httpx.AsyncClient, "get", _dispatcher(_USDA_NO_MATCH, _OFF_HIT))

    food = asyncio.run(barcode.lookup_barcode("3017620422003", _settings()))

    assert food is not None
    assert food.source == "openfoodfacts"
    assert food.name == "Hazelnut Spread"
    assert food.brand == "Ferrero"  # first of a comma-separated brands list
    assert food.calories == 80
    assert food.weight_g == 15
    assert food.sodium_mg == 10.7  # grams -> mg
    assert food.serving_size == "15 g"


def test_lookup_falls_back_to_off_on_usda_outage(monkeypatch):
    async def fake_get(self, url, params=None, headers=None):
        if "api.nal.usda.gov" in url:
            raise httpx.ConnectError("boom")
        return _FakeResp(_OFF_HIT)

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    food = asyncio.run(barcode.lookup_barcode("3017620422003", _settings()))
    assert food is not None and food.source == "openfoodfacts"


def test_lookup_skips_usda_without_key(monkeypatch):
    seen: list[str] = []

    async def fake_get(self, url, params=None, headers=None):
        seen.append(url)
        return _FakeResp(_OFF_HIT)

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    food = asyncio.run(barcode.lookup_barcode("3017620422003", Settings(usda_api_key="")))
    assert food is not None and food.source == "openfoodfacts"
    assert all("api.nal.usda.gov" not in u for u in seen)  # FDC never called


def test_lookup_returns_none_when_absent_everywhere(monkeypatch):
    monkeypatch.setattr(httpx.AsyncClient, "get", _dispatcher(_USDA_NO_MATCH, _OFF_MISS))
    assert asyncio.run(barcode.lookup_barcode("3017620422003", _settings())) is None


def test_lookup_rejects_implausible_code(monkeypatch):
    # Short codes never reach an upstream — guard returns None before any request.
    async def boom(self, url, params=None, headers=None):
        raise AssertionError("should not hit the network")

    monkeypatch.setattr(httpx.AsyncClient, "get", boom)
    assert asyncio.run(barcode.lookup_barcode("123", _settings())) is None


def test_off_404_is_not_found(monkeypatch):
    async def fake_get(self, url, params=None, headers=None):
        if "api.nal.usda.gov" in url:
            return _FakeResp(_USDA_NO_MATCH)
        return _FakeResp({}, status_code=404)

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    assert asyncio.run(barcode.lookup_barcode("3017620422003", _settings())) is None


# --- Route (GET /api/foods/barcode/{code}) ---------------------------------

_SAMPLE = BarcodeFood(
    barcode="049000028911",
    name="Protein Bar",
    brand="Acme",
    source="usda",
    calories=120,
    protein_g=6,
    carbs_g=18,
    fat_g=4.5,
    weight_g=30,
    fiber_g=6,
    sugar_g=15,
    sodium_mg=150,
    is_beverage=False,
    serving_size="1 bar (30 g)",
)


def test_route_returns_food(client, monkeypatch):
    async def fake(code, settings):
        assert code == "049000028911"
        return _SAMPLE

    monkeypatch.setattr(barcode, "lookup_barcode", fake)

    r = client.get("/api/foods/barcode/049000028911")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Protein Bar"
    assert body["source"] == "usda"
    assert body["calories"] == 120


def test_route_strips_non_digits_before_lookup(client, monkeypatch):
    seen: dict[str, str] = {}

    async def fake(code, settings):
        seen["code"] = code
        return _SAMPLE

    monkeypatch.setattr(barcode, "lookup_barcode", fake)

    r = client.get("/api/foods/barcode/0490-0002 8911")
    assert r.status_code == 200, r.text
    assert seen["code"] == "049000028911"


def test_route_404_when_not_found(client, monkeypatch):
    async def fake(code, settings):
        return None

    monkeypatch.setattr(barcode, "lookup_barcode", fake)
    assert client.get("/api/foods/barcode/049000028911").status_code == 404


def test_route_400_on_short_code(client):
    assert client.get("/api/foods/barcode/123").status_code == 400


def test_route_502_on_upstream_error(client, monkeypatch):
    async def boom(code, settings):
        raise barcode.BarcodeError("both upstreams down")

    monkeypatch.setattr(barcode, "lookup_barcode", boom)
    assert client.get("/api/foods/barcode/049000028911").status_code == 502


def test_route_requires_auth(anon_client):
    assert anon_client.get("/api/foods/barcode/049000028911").status_code == 401
