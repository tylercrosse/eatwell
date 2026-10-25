#!/usr/bin/env python3
"""Run the food-photo accuracy eval (see evals/README.md).

  uv run python scripts/eval_food_photos.py fetch
  uv run python scripts/eval_food_photos.py run [--model M] [--tier T] [--label L]
  uv run python scripts/eval_food_photos.py compare RUN_A.json RUN_B.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import get_settings  # noqa: E402
from evals import photo_eval  # noqa: E402


def _select(args: argparse.Namespace) -> list[photo_eval.Case]:
    cases = photo_eval.load_cases()
    if args.tier:
        cases = [c for c in cases if c.tier == args.tier]
    if args.category:
        cases = [c for c in cases if c.category == args.category]
    if args.ids:
        wanted = set(args.ids.split(","))
        cases = [c for c in cases if c.id in wanted]
    return cases[: args.limit] if args.limit else cases


def _print_scores(scores: dict) -> None:
    print(json.dumps(scores["overall"], indent=1))
    for tier, summary in scores["by_tier"].items():
        print(f"{tier}: MAPE {summary.get('calorie_mape')}%  bias {summary.get('calorie_bias_pct')}%  "
              f"within 20% {summary.get('within_20pct')}  n={summary['n']}")
    for row in scores["portion_pairs"]:
        print(f"  {row['group']:18s} true x{row['true_ratio']:<5} predicted x{row['predicted_ratio']:<5} "
              f"scaling {row['scaling']}")
    print(f"portion scaling median: {scores['portion_scaling_median']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "run"):
        p = sub.add_parser(name)
        p.add_argument("--tier", help="nutrition5k | restaurant | local")
        p.add_argument("--category", help="e.g. pizza, salad, plate, burger")
        p.add_argument("--ids", help="comma-separated case ids")
        p.add_argument("--limit", type=int, help="only the first N selected cases")
    run = sub.choices["run"]
    run.add_argument("--model", help="OpenRouter model id; defaults to OPENROUTER_MODEL")
    run.add_argument("--label", help="short tag in the run filename, e.g. 'prompt-v2'")
    run.add_argument("--concurrency", type=int, default=4)
    run.add_argument(
        "--reasoning-effort", choices=("none", "minimal", "low", "medium", "high"),
        help="override OPENROUTER_REASONING_EFFORT; 'none' sends no effort (provider default)",
    )
    cmp = sub.add_parser("compare")
    cmp.add_argument("base", type=Path)
    cmp.add_argument("head", type=Path)
    args = parser.parse_args()

    if args.command == "compare":
        base, head = (json.loads(p.read_text()) for p in (args.base, args.head))
        print("\n".join(photo_eval.compare(base, head)))
        return 0

    cases = _select(args)
    failed = photo_eval.fetch_images(cases)
    if args.command == "fetch":
        print(f"{len(cases) - len(failed)}/{len(cases)} images cached in {photo_eval.CACHE_DIR}")
        return 1 if failed else 0

    settings = get_settings()
    if args.model:
        settings = settings.model_copy(update={"openrouter_model": args.model})
    if args.reasoning_effort:
        effort = "" if args.reasoning_effort == "none" else args.reasoning_effort
        settings = settings.model_copy(update={"openrouter_reasoning_effort": effort})
    cases = [c for c in cases if c.id not in failed]
    print(f"Running {len(cases)} cases against {settings.openrouter_model} "
          f"(reasoning effort: {settings.openrouter_reasoning_effort or 'default'})")
    results = asyncio.run(photo_eval.run_cases(cases, settings, args.concurrency))
    path = photo_eval.write_run(results, settings, args.label)
    _print_scores(json.loads(path.read_text())["scores"])
    print(f"Wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
