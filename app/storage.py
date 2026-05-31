"""Photo handling: validate, normalize (HEIC->JPEG, resize, strip EXIF), and persist.

iPhones often upload HEIC and large/rotated images. We normalize to a modest JPEG both
for storage and before sending to the model (smaller data URL = fewer tokens / faster).
"""

from __future__ import annotations

import io
import uuid
from pathlib import Path

from PIL import Image, ImageOps

# Register HEIC/HEIF support so Pillow can open iPhone photos.
try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:  # pragma: no cover - optional at runtime
    pass


class ImageError(ValueError):
    """Raised when an upload is not a usable image."""


def normalize_image(raw: bytes, max_dimension: int) -> bytes:
    """Decode any supported format, fix orientation, downscale, return JPEG bytes."""
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)  # honor EXIF rotation, then drop it
    except Exception as exc:  # PIL raises a variety of errors for bad input
        raise ImageError("Uploaded file is not a readable image.") from exc

    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    img.thumbnail((max_dimension, max_dimension))  # preserves aspect ratio, only shrinks

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85)
    return out.getvalue()


def save_photo(jpeg_bytes: bytes, photos_dir: Path) -> str:
    """Write normalized JPEG bytes to a UUID-named file; return the photo_ref (filename)."""
    photos_dir.mkdir(parents=True, exist_ok=True)
    ref = f"{uuid.uuid4().hex}.jpg"
    (photos_dir / ref).write_bytes(jpeg_bytes)
    return ref
