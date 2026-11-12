from pathlib import Path

import pytest
from httpx import AsyncClient

from app.api.v1.endpoints import uploads as uploads_endpoint
from app.core.config import settings

PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
    b"\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.mark.asyncio
async def test_upload_image_requires_auth(client: AsyncClient):
    response = await client.post(
        f"{settings.API_V1_STR}/uploads/image",
        files={"file": ("cover.png", PNG_BYTES, "image/png")},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_upload_image_stores_png_and_returns_public_url(
    client: AsyncClient, guest_token: str
):
    response = await client.post(
        f"{settings.API_V1_STR}/uploads/image",
        files={"file": ("cover.png", PNG_BYTES, "image/png")},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert response.status_code == 201
    url = response.json()["url"]
    assert url.startswith("/uploads/") and url.endswith(".png")

    stored = Path(settings.UPLOAD_DIR) / Path(url).name
    assert stored.exists()
    assert stored.read_bytes() == PNG_BYTES

    public = await client.get(url)
    assert public.status_code == 200
    stored.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_upload_rejects_non_image_content(client: AsyncClient, guest_token: str):
    response = await client.post(
        f"{settings.API_V1_STR}/uploads/image",
        files={"file": ("notes.txt", b"just text", "text/plain")},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert response.status_code == 400
    assert "JPEG, PNG, and WebP" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_rejects_oversized_file(
    client: AsyncClient, guest_token: str, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(uploads_endpoint, "MAX_UPLOAD_BYTES", 8)
    response = await client.post(
        f"{settings.API_V1_STR}/uploads/image",
        files={"file": ("cover.png", PNG_BYTES, "image/png")},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert response.status_code == 413
