#!/usr/bin/env python3
"""Manage the beta guest list from a shell.

This is the **break-glass** path — how you recover when you can't get in through the app (say
a bad ``ALLOWED_EMAILS`` on a fresh database locked everyone out). Day to day, invite people
from the app itself.

On the deployed machine::

    fly ssh console -C "python /app/scripts/manage_invites.py list"
    fly ssh console -C "python /app/scripts/manage_invites.py add friend@example.com --note 'gym'"
    fly ssh console -C "python /app/scripts/manage_invites.py revoke friend@example.com"

Revoking also disables any signed-in session for that address, so it takes effect on the
person's next request rather than whenever their 30-day cookie expires.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlmodel import Session, select  # noqa: E402

from app.accounts import grant, normalize_email, revoke  # noqa: E402
from app.db import engine, init_db  # noqa: E402
from app.models import Invite  # noqa: E402


def _fmt(invite: Invite) -> str:
    if invite.revoked_at is not None:
        state = "revoked"
    elif invite.accepted_at is not None:
        state = "active"
    else:
        state = "pending"
    parts = [f"{invite.email:<36} {state:<8} by={invite.invited_by or '-'}"]
    if invite.note:
        parts.append(f"note={invite.note!r}")
    return "  ".join(parts)


def cmd_list(_: argparse.Namespace) -> int:
    with Session(engine) as session:
        invites = session.exec(select(Invite).order_by(Invite.email)).all()
    if not invites:
        print("No invites. The app is closed to everyone — add one to get back in.")
        return 0
    for invite in invites:
        print(_fmt(invite))
    return 0


def cmd_add(args: argparse.Namespace) -> int:
    with Session(engine) as session:
        invite = grant(session, args.email, invited_by=args.by, note=args.note)
    print(f"Invited {invite.email}.")
    print("They can now sign in with Google or by email — no redeploy needed.")
    return 0


def cmd_revoke(args: argparse.Namespace) -> int:
    with Session(engine) as session:
        invite = revoke(session, args.email)
    if invite is None:
        print(f"{normalize_email(args.email)} was never invited; nothing to do.")
        return 1
    print(f"Revoked {invite.email}. Any signed-in session is dropped on its next request.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="Show every invite and its state").set_defaults(func=cmd_list)

    add = sub.add_parser("add", help="Invite an email (also un-revokes a revoked one)")
    add.add_argument("email")
    add.add_argument("--note", help="Free text, e.g. 'Chad from the gym'")
    add.add_argument("--by", default="cli", help="Who invited them (default: cli)")
    add.set_defaults(func=cmd_add)

    rm = sub.add_parser("revoke", help="Withdraw access and end any live session")
    rm.add_argument("email")
    rm.set_defaults(func=cmd_revoke)

    args = parser.parse_args(argv)
    init_db()  # safe and idempotent; also makes this work against a fresh volume
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
