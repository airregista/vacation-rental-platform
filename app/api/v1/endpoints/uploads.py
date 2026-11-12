from pathlib import Path
from uuid import uuid4

import anyio
from fastapi import APIRouter, HTTPException, UploadFile, status

from app.api.dependencies import CurrentUserDep
from app.core.config import settings

router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_UPLOAD_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

# Content sniffing is the actual guard: the client-supplied Content-Type and
# filename are never trusted for the stored extension.
_IMAGE_SIGNATURES: tuple[tuple[bytes, str, str], ...] = (
    (b"\xff\xd8\xff", ".jpg", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", ".png", "image/png"),
    (b"RIFF", ".webp", "image/webp"),
)


def _detect_image_extension(data: bytes) -> str | None:
    for signature, extension, mime in _IMAGE_SIGNATURES:
        if data.startswith(signature):
            if mime == "image/webp" and data[8:12] != b"WEBP":
                continue
            return extension
    return None


@router.post("/image", status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile,
    current_user: CurrentUserDep,
) -> dict[str, str]:
    """Store a host-uploaded accommodation image and return its public URL."""
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty",
        )
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Images must be {settings.MAX_UPLOAD_SIZE_MB} MB or smaller",
        )

    extension = _detect_image_extension(data)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, and WebP images are supported",
        )

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    await anyio.to_thread.run_sync((upload_dir / filename).write_bytes, data)

    return {"url": f"/uploads/{filename}"}
