"""POST /api/analyze — stateless photo -> structured macros.

Does NOT touch the DB. The frontend reviews/edits the result, then commits it via
POST /api/entries. The photo is normalized and saved so the resulting entry can
reference it; the returned photo_ref is optional for the client to attach.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from app import openrouter, storage
from app.config import Settings
from app.deps import get_current_user, get_session, get_settings
from app.models import BodyMetric, User
from app.schemas import ActivityAnalyzeRequest, ActivityResult, AnalysisResult, MenuAnalysisResult

router = APIRouter(tags=["analyze"])


class AnalyzeResponse(BaseModel):
    photo_ref: str
    analysis: AnalysisResult


class TextAnalyzeRequest(BaseModel):
    description: str


@router.post("/analyze/activity", response_model=ActivityResult)
async def analyze_activity(
    payload: ActivityAnalyzeRequest,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
) -> ActivityResult:
    desc = payload.description.strip()
    if not desc:
        raise HTTPException(status_code=400, detail="Description is empty.")
    # Tune the burn estimate to the user's most-recent known weight, if any.
    row = session.exec(
        select(BodyMetric)
        .where(BodyMetric.user_id == user.id, BodyMetric.weight_kg.is_not(None))
        .order_by(BodyMetric.date.desc())
        .limit(1)
    ).first()
    try:
        return await openrouter.analyze_activity_text(desc, row.weight_kg if row else None, settings)
    except openrouter.EstimationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/analyze/text", response_model=AnalysisResult)
async def analyze_text(
    payload: TextAnalyzeRequest,
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
) -> AnalysisResult:
    desc = payload.description.strip()
    if not desc:
        raise HTTPException(status_code=400, detail="Description is empty.")
    try:
        return await openrouter.analyze_food_text(desc, settings)
    except openrouter.EstimationError as exc:
        # Upstream model failure or unparseable output -> 502 (we depend on a third party).
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    file: UploadFile = File(...),
    description: str | None = Form(default=None),
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
) -> AnalyzeResponse:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty upload.")
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Image too large.")

    try:
        jpeg = storage.normalize_image(raw, settings.max_image_dimension)
    except storage.ImageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    context = description.strip() if description else None

    try:
        analysis = await openrouter.analyze_food_image(jpeg, settings, context or None)
    except openrouter.EstimationError as exc:
        # Upstream model failure or unparseable output -> 502 (we depend on a third party).
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    photo_ref = storage.save_photo(jpeg, settings.photos_dir)
    return AnalyzeResponse(photo_ref=photo_ref, analysis=analysis)


@router.post("/analyze/menu", response_model=MenuAnalysisResult)
async def analyze_menu(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
) -> MenuAnalysisResult:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty upload.")
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Image too large.")

    try:
        jpeg = storage.normalize_image(raw, settings.max_image_dimension)
    except storage.ImageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        return await openrouter.analyze_menu_image(jpeg, settings)
    except openrouter.EstimationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
