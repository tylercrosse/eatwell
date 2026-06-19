#!/usr/bin/env python3
"""Seed local QA accounts with synthetic sample data."""

from __future__ import annotations

import argparse
import sys
from datetime import date as date_cls
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlmodel import Session  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import engine, init_db  # noqa: E402
from app.qa_seed import SeedSummary, preview_qa_seed, seed_qa_data  # noqa: E402


def _parse_date(value: str) -> date_cls:
    try:
        return date_cls.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Expected YYYY-MM-DD.") from exc


def _print_summaries(summaries: list[SeedSummary]) -> None:
    for summary in summaries:
        print(
            f"- {summary.account_id} ({summary.email}): "
            f"{summary.start_date.isoformat()}..{summary.end_date.isoformat()}, "
            f"{summary.food_entries} food, {summary.metrics} metrics, "
            f"{summary.exercise_entries} exercise, {summary.targets} targets"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Write to the configured SQLite DB. Without this flag, only print a dry-run summary.",
    )
    parser.add_argument(
        "--end-date",
        type=_parse_date,
        default=date_cls.today(),
        help="Last local calendar day to seed, as YYYY-MM-DD. Defaults to today.",
    )
    args = parser.parse_args()

    settings = get_settings()
    print(f"DB: {settings.db_path}")
    print(f"End date: {args.end_date.isoformat()}")

    if not args.yes:
        print("Dry run. Re-run with --yes to replace seeded QA data.")
        _print_summaries(preview_qa_seed(args.end_date))
        return 0

    init_db()
    with Session(engine) as session:
        summaries = seed_qa_data(session, args.end_date)

    print("Seeded QA data:")
    _print_summaries(summaries)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
