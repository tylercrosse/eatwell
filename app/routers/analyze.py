"""POST /api/analyze — stateless photo -> structured macros.

Does NOT touch the DB. The frontend reviews/edits the result, then commits it via
POST /api/entries. The photo is normalized and saved so the resulting entry can
reference it; the returned photo_ref is optional for the client to attach.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app import openrouter, storage
from app.config import Settings
from app.deps import get_settings
from app.schemas import AnalysisResult

router = APIRouter(tags=["analyze"])


class AnalyzeResponse(BaseModel):
    photo_ref: str
    analysis: AnalysisResult


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
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

    try:
        analysis = await openrouter.analyze_food_image(jpeg, settings)
    except openrouter.EstimationError as exc:
        # Upstream model failure or unparseable output -> 502 (we depend on a third party).
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    photo_ref = storage.save_photo(jpeg, settings.photos_dir)
    return AnalyzeResponse(photo_ref=photo_ref, analysis=analysis)
