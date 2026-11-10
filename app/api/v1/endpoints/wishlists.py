from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUserDep, SessionDep
from app.models.accommodation import Accommodation
from app.models.geo import City
from app.models.review import Review
from app.models.wishlist import Wishlist
from app.schemas.accommodation import AccommodationListItem
from app.schemas.category import CategoryResponse
from app.schemas.geo import CityResponse, ProvinceResponse
from app.schemas.wishlist import WishlistItemResponse, WishlistToggleResponse

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

    acc_ids = [item.accommodation_id for item in items]
    ratings_map: dict[int, tuple[float | None, int]] = {}
    if acc_ids:
        agg_stmt = (
            select(
                Review.accommodation_id,
                func.avg(Review.rating).label("avg_rating"),
                func.count(Review.id).label("count_rating"),
            )
            .where(Review.accommodation_id.in_(acc_ids))
            .group_by(Review.accommodation_id)
        )
        agg_res = await db.execute(agg_stmt)
        for row in agg_res.all():
            ratings_map[row.accommodation_id] = (
                float(row.avg_rating) if row.avg_rating is not None else None,
                int(row.count_rating),
            )

    resp_items: list[WishlistItemResponse] = []
    for item in items:
        acc = item.accommodation
        cover = next((img.image_url for img in acc.images if img.is_cover), None)
        if not cover and acc.images:
            cover = acc.images[0].image_url

        city_resp = None
        if acc.city:
            prov_resp = (
                ProvinceResponse.model_validate(acc.city.province) if acc.city.province else None
            )
            city_resp = CityResponse(
                id=acc.city.id,
                province_id=acc.city.province_id,
                name=acc.city.name,
                province=prov_resp,
            )

        cat_resp = CategoryResponse.model_validate(acc.category) if acc.category else None

        avg_rat, count_rat = ratings_map.get(acc.id, (None, 0))

        acc_summary = AccommodationListItem(
            id=acc.id,
            title=acc.title,
            city=city_resp,
            category=cat_resp,
            base_price=acc.base_price,
            capacity=acc.capacity,
            max_capacity=acc.max_capacity,
            rooms_count=acc.rooms_count,
            beds_count=acc.beds_count,
            cover_image=cover,
            average_rating=round(avg_rat, 1) if avg_rat is not None else None,
            reviews_count=count_rat,
            is_active=acc.is_active,
        )

        resp_items.append(
            WishlistItemResponse(
                user_id=item.user_id,
                accommodation_id=item.accommodation_id,
                created_at=item.created_at,
                accommodation=acc_summary,
            )
        )
    return resp_items
