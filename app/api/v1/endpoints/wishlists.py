from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUserDep, SessionDep
from app.models.accommodation import Accommodation
from app.models.geo import City
from app.models.wishlist import Wishlist
from app.schemas.wishlist import WishlistItemResponse, WishlistToggleResponse
from app.services.accommodation_service import build_accommodation_list_items

router = APIRouter(prefix="/wishlists", tags=["wishlists"])


@router.post("/{accommodation_id}/toggle", response_model=WishlistToggleResponse)
async def toggle_wishlist(
    accommodation_id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> WishlistToggleResponse:
    # Verify accommodation exists
    acc = (
        (await db.execute(select(Accommodation).where(Accommodation.id == accommodation_id)))
        .scalars()
        .first()
    )
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    stmt = select(Wishlist).where(
        Wishlist.user_id == current_user.id,
        Wishlist.accommodation_id == accommodation_id,
    )
    existing = (await db.execute(stmt)).scalars().first()

    if existing:
        await db.delete(existing)
        await db.commit()
        return WishlistToggleResponse(
            accommodation_id=accommodation_id,
            is_favorite=False,
            message="Accommodation removed from your wishlist",
        )
    else:
        try:
            wishlist_item = Wishlist(
                user_id=current_user.id,
                accommodation_id=accommodation_id,
            )
            db.add(wishlist_item)
            await db.commit()
            return WishlistToggleResponse(
                accommodation_id=accommodation_id,
                is_favorite=True,
                message="Accommodation saved to your wishlist",
            )
        except IntegrityError:
            await db.rollback()
            return WishlistToggleResponse(
                accommodation_id=accommodation_id,
                is_favorite=True,
                message="Accommodation saved to your wishlist",
            )


@router.get("/", response_model=list[WishlistItemResponse])
async def list_my_wishlist(
    current_user: CurrentUserDep,
    db: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[WishlistItemResponse]:
    stmt = (
        select(Wishlist)
        .options(
            selectinload(Wishlist.accommodation)
            .selectinload(Accommodation.city)
            .selectinload(City.province),
            selectinload(Wishlist.accommodation).selectinload(Accommodation.category),
            selectinload(Wishlist.accommodation).selectinload(Accommodation.images),
        )
        .where(Wishlist.user_id == current_user.id)
        .order_by(Wishlist.created_at.desc(), Wishlist.accommodation_id.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    summaries = await build_accommodation_list_items(
        db, [item.accommodation for item in items]
    )
    return [
        WishlistItemResponse(
            user_id=item.user_id,
            accommodation_id=item.accommodation_id,
            created_at=item.created_at,
            accommodation=summary,
        )
        for item, summary in zip(items, summaries, strict=True)
    ]
