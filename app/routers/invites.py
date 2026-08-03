"""Owner-only invite management: shareable links and the guest list behind them.

Every route here depends on ``get_owner``, so a signed-in non-owner gets 403 rather than a
partial view. See ``app/invite_links.py`` for why links exist at all.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app import accounts, invite_links
from app.config import Settings
from app.deps import get_owner, get_session, get_settings
from app.models import Invite, User

router = APIRouter(prefix="/invites", tags=["invites"])


class MintLinkRequest(BaseModel):
    note: str | None = None
    max_uses: int = 1


class InviteLinkRead(BaseModel):
    id: int
    note: str | None
    max_uses: int
    uses: int
    expires_at: datetime


class MintedLink(InviteLinkRead):
    """The mint response. ``url`` appears here and nowhere else, ever."""

    url: str


class InviteRead(BaseModel):
    email: str
    invited_by: str | None
    note: str | None
    accepted_at: datetime | None
    revoked_at: datetime | None


@router.post("/links", response_model=MintedLink, status_code=status.HTTP_201_CREATED)
def create_link(
    payload: MintLinkRequest,
    owner: User = Depends(get_owner),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> MintedLink:
    """Mint a shareable invite link.

    The URL is in this response and is not retrievable afterwards — only its hash is stored.
    Clients must hand it over now (share sheet, copy) or mint another.
    """
    link, raw = invite_links.mint(
        session,
        settings,
        created_by_user_id=owner.id,
        note=payload.note,
        max_uses=payload.max_uses,
    )
    return MintedLink(
        id=link.id,
        note=link.note,
        max_uses=link.max_uses,
        uses=link.uses,
        expires_at=link.expires_at,
        url=invite_links.build_share_url(settings, raw),
    )


@router.get("/links", response_model=list[InviteLinkRead])
def list_links(
    _: User = Depends(get_owner),
    session: Session = Depends(get_session),
) -> list[InviteLinkRead]:
    """Links that could still be used. No URLs — those are unrecoverable by design."""
    return [
        InviteLinkRead(
            id=link.id,
            note=link.note,
            max_uses=link.max_uses,
            uses=link.uses,
            expires_at=link.expires_at,
        )
        for link in invite_links.outstanding(session)
    ]


@router.delete("/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_link(
    link_id: int,
    _: User = Depends(get_owner),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> None:
    """Stop a link being used again. Anyone who already joined through it keeps their access."""
    if invite_links.revoke(session, settings, link_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite link not found.")


@router.get("", response_model=list[InviteRead])
def list_invites(
    _: User = Depends(get_owner),
    session: Session = Depends(get_session),
) -> list[InviteRead]:
    """The guest list itself: who may sign in, and who has."""
    invites = session.exec(select(Invite).order_by(Invite.email)).all()
    return [
        InviteRead(
            email=i.email,
            invited_by=i.invited_by,
            note=i.note,
            accepted_at=i.accepted_at,
            revoked_at=i.revoked_at,
        )
        for i in invites
    ]


@router.delete("/{email}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invite(
    email: str,
    owner: User = Depends(get_owner),
    session: Session = Depends(get_session),
) -> None:
    """Withdraw someone's access; their next request 401s.

    Revoking yourself is refused — it would lock the only account that can undo it out of the
    app, leaving `scripts/manage_invites.py` over SSH as the only way back.
    """
    if accounts.normalize_email(email) == accounts.normalize_email(owner.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="You can't revoke your own access."
        )
    if accounts.revoke(session, email) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No such invite.")
