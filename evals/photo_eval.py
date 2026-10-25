"""Food-photo eval: run the production image estimator over a labeled case set and score it.

Cases live in ``evals/food_photos/cases.jsonl`` (one JSON object per line). Images are not
committed; each case carries a source URL + sha256, and ``fetch_images`` downloads them into a
gitignored cache. The run calls ``openrouter.analyze_food_image`` (the same function
``/api/analyze`` uses) on the same normalized JPEG the app would send, so prompt and model
changes are measured exactly as users would see them.
"""

from __future__ import annotations

import asyncio
import contextvars
import hashlib
import json
import statistics
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path

from app import openrouter, storage
from app.config import Settings

EVAL_DIR = Path(__file__).resolve().parent / "food_photos"
CASES_PATH = EVAL_DIR / "cases.jsonl"
CACHE_DIR = EVAL_DIR / ".cache"
RUNS_DIR = EVAL_DIR / "runs"

MACROS = ("protein_g", "carbs_g", "fat_g")
# Wikimedia asks bots for a descriptive User-Agent and rate-limits bursts (HTTP 429).
_USER_AGENT = "eatwell-eval/0.1 (https://github.com/tylercrosse/eatwell)"


@dataclass
class Case:
    id: str
    tier: str  # "nutrition5k" (weighed) | "restaurant" (published values) | "local"
    category: str
    portion_group: str | None  # cases sharing a group are the same food at different portions
    image: dict
    truth: dict
    truth_source: str
    ingredients: list[dict] = field(default_factory=list)

    @property
    def cache_path(self) -> Path:
        return CACHE_DIR / f"{self.image['sha256']}.img"


@dataclass
class CaseResult:
    id: str
    tier: str
    category: str
    portion_group: str | None
    truth: dict
    predicted: dict | None = None
    item_names: list[str] = field(default_factory=list)
    confidence: float | None = None
    latency_s: float | None = None
    usage: dict | None = None  # tokens + OpenRouter-billed cost (USD) for the call
    error: str | None = None


def load_cases(path: Path = CASES_PATH) -> list[Case]:
    with path.open() as fh:
        return [Case(**json.loads(line)) for line in fh if line.strip()]


def fetch_images(cases: list[Case], pause_s: float = 2.0) -> list[str]:
    """Download any uncached images and verify their hashes. Returns ids that failed."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    failed = []
    for case in cases:
        if case.cache_path.exists():
            continue
        try:
            raw = _download(case.image["url"])
        except (urllib.error.URLError, TimeoutError) as exc:
            print(f"  ! {case.id}: {exc}")
            failed.append(case.id)
            continue
        if hashlib.sha256(raw).hexdigest() != case.image["sha256"]:
            print(f"  ! {case.id}: sha256 mismatch (source image changed)")
            failed.append(case.id)
            continue
        case.cache_path.write_bytes(raw)
        print(f"  fetched {case.id}")
        time.sleep(pause_s)
    return failed


def _download(url: str, attempts: int = 5) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == attempts - 1:
                raise
            time.sleep(15 * (attempt + 1))
    raise AssertionError("unreachable")


# Each eval task gets its own holder; the patched client drops the response's usage into it.
_usage_holder: contextvars.ContextVar[dict] = contextvars.ContextVar("eval_usage")


def _usage_capturing_client(make_client):
    """Wrap ``openrouter._client`` so the eval sees token usage without changing app code."""

    def factory(settings: Settings):
        client = make_client(settings)
        create = client.chat.completions.create

        async def create_and_record(*args, **kwargs):
            resp = await create(*args, **kwargs)
            usage = getattr(resp, "usage", None)
            if usage is not None:
                details = usage.completion_tokens_details
                _usage_holder.get({}).update(
                    prompt_tokens=usage.prompt_tokens,
                    completion_tokens=usage.completion_tokens,
                    reasoning_tokens=getattr(details, "reasoning_tokens", None) if details else None,
                    cost_usd=getattr(usage, "cost", None),  # OpenRouter extension field
                )
            return resp

        client.chat.completions.create = create_and_record
        return client

    return factory


async def run_cases(cases: list[Case], settings: Settings, concurrency: int = 4) -> list[CaseResult]:
    sem = asyncio.Semaphore(concurrency)
    original_client = openrouter._client
    openrouter._client = _usage_capturing_client(original_client)

    async def one(case: Case) -> CaseResult:
        result = CaseResult(case.id, case.tier, case.category, case.portion_group, case.truth)
        jpeg = storage.normalize_image(case.cache_path.read_bytes(), settings.max_image_dimension)
        usage: dict = {}
        _usage_holder.set(usage)
        async with sem:
            start = time.perf_counter()
            try:
                analysis = await openrouter.analyze_food_image(jpeg, settings)
            except openrouter.EstimationError as exc:
                result.error = str(exc)[:300]
                return result
            finally:
                result.latency_s = round(time.perf_counter() - start, 2)
                result.usage = usage or None
        result.predicted = {
            "calories": analysis.total_calories,
            "protein_g": analysis.total_protein_g,
            "carbs_g": analysis.total_carbs_g,
            "fat_g": analysis.total_fat_g,
            "weight_g": analysis.total_weight_g,
        }
        result.item_names = [item.name for item in analysis.items]
        result.confidence = analysis.confidence
        print(f"  {case.id}: {analysis.total_calories:.0f} kcal (truth {case.truth['calories']:.0f})")
        return result

    try:
        return await asyncio.gather(*(one(c) for c in cases))
    finally:
        openrouter._client = original_client


def _pct_error(predicted: float, truth: float) -> float:
    """Signed percent error; positive means the model overestimated."""
    return (predicted - truth) / truth * 100


def _summarize(results: list[CaseResult]) -> dict:
    ok = [r for r in results if r.predicted is not None]
    summary: dict = {"n": len(results), "failures": len(results) - len(ok)}
    if not ok:
        return summary
    pct = [_pct_error(r.predicted["calories"], r.truth["calories"]) for r in ok]
    ape = [abs(p) for p in pct]
    summary.update(
        calorie_mape=round(statistics.mean(ape), 1),
        calorie_median_ape=round(statistics.median(ape), 1),
        calorie_bias_pct=round(statistics.mean(pct), 1),
        within_20pct=round(sum(a <= 20 for a in ape) / len(ok), 3),
        calorie_mae=round(statistics.mean(abs(r.predicted["calories"] - r.truth["calories"]) for r in ok), 1),
    )
    for macro in MACROS:
        summary[f"{macro}_mae"] = round(
            statistics.mean(abs(r.predicted[macro] - r.truth[macro]) for r in ok), 1
        )
    weighed = [r for r in ok if r.truth.get("weight_g") and r.predicted.get("weight_g")]
    if weighed:
        summary["weight_mape"] = round(
            statistics.mean(abs(_pct_error(r.predicted["weight_g"], r.truth["weight_g"])) for r in weighed), 1
        )
    latencies = sorted(r.latency_s for r in ok if r.latency_s is not None)
    if latencies:
        summary["latency_p50_s"] = round(statistics.median(latencies), 2)
        summary["latency_p95_s"] = latencies[min(len(latencies) - 1, int(len(latencies) * 0.95))]
    confs = [r.confidence for r in ok if r.confidence is not None]
    if confs:
        summary["mean_confidence"] = round(statistics.mean(confs), 2)
    # Cost counts failed calls too: a malformed response is still billed.
    billed = [r.usage for r in results if r.usage]
    if billed:
        costs = [u["cost_usd"] for u in billed if u.get("cost_usd") is not None]
        if costs:
            summary["cost_total_usd"] = round(sum(costs), 4)
            summary["cost_per_photo_usd"] = round(statistics.mean(costs), 6)
        summary["mean_prompt_tokens"] = round(statistics.mean(u["prompt_tokens"] for u in billed))
        summary["mean_completion_tokens"] = round(statistics.mean(u["completion_tokens"] for u in billed))
    return summary


def portion_scaling(results: list[CaseResult]) -> list[dict]:
    """For each portion pair, does the estimate grow by as much as the food did?

    ``scaling`` is predicted ratio / true ratio: 1.0 is perfect, below 1 means the model
    under-reacts to portion size (the classic "every plate is ~500 kcal" failure).
    """
    groups: dict[str, list[CaseResult]] = {}
    for r in results:
        if r.portion_group and r.predicted is not None:
            groups.setdefault(r.portion_group, []).append(r)
    rows = []
    for group, members in sorted(groups.items()):
        if len(members) != 2:
            continue
        small, large = sorted(members, key=lambda r: r.truth["calories"])
        true_ratio = large.truth["calories"] / small.truth["calories"]
        pred_ratio = large.predicted["calories"] / max(small.predicted["calories"], 1.0)
        rows.append(
            {
                "group": group,
                "true_ratio": round(true_ratio, 2),
                "predicted_ratio": round(pred_ratio, 2),
                "scaling": round(pred_ratio / true_ratio, 2),
                "direction_correct": large.predicted["calories"] > small.predicted["calories"],
            }
        )
    return rows


def score(results: list[CaseResult]) -> dict:
    by = lambda key: {  # noqa: E731
        value: _summarize([r for r in results if getattr(r, key) == value])
        for value in sorted({getattr(r, key) for r in results})
    }
    pairs = portion_scaling(results)
    return {
        "overall": _summarize(results),
        "by_tier": by("tier"),
        "by_category": by("category"),
        "portion_pairs": pairs,
        "portion_scaling_median": round(statistics.median(p["scaling"] for p in pairs), 2)
        if pairs
        else None,
    }


def write_run(results: list[CaseResult], settings: Settings, label: str | None = None) -> Path:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    model_slug = settings.openrouter_model.replace("/", "_")
    path = RUNS_DIR / f"{stamp}_{model_slug}{'_' + label if label else ''}.json"
    payload = {
        "model": settings.openrouter_model,
        "label": label,
        "reasoning_effort": settings.openrouter_reasoning_effort or None,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "max_image_dimension": settings.max_image_dimension,
        "scores": score(results),
        "results": [asdict(r) for r in results],
    }
    path.write_text(json.dumps(payload, indent=1) + "\n")
    return path


def compare(base: dict, head: dict) -> list[str]:
    """Human-readable deltas between two run files' overall + per-tier scores."""
    lines = [f"{base['model']} ({base.get('label') or '-'}) -> {head['model']} ({head.get('label') or '-'})"]
    keys = ("calorie_mape", "calorie_median_ape", "calorie_bias_pct", "within_20pct", "protein_g_mae",
            "carbs_g_mae", "fat_g_mae", "latency_p50_s", "failures", "cost_per_photo_usd",
            "mean_completion_tokens")
    sections = [("overall", base["scores"]["overall"], head["scores"]["overall"])]
    for tier in head["scores"]["by_tier"]:
        sections.append((tier, base["scores"]["by_tier"].get(tier, {}), head["scores"]["by_tier"][tier]))
    for name, b, h in sections:
        lines.append(f"[{name}]")
        for key in keys:
            if key in b or key in h:
                lines.append(f"  {key:20s} {b.get(key, '-')!s:>8} -> {h.get(key, '-')!s:>8}")
    lines.append(
        f"  portion_scaling_med  {base['scores'].get('portion_scaling_median')!s:>8} -> "
        f"{head['scores'].get('portion_scaling_median')!s:>8}"
    )
    return lines
