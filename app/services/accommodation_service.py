from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accommodation import Accommodation
from app.models.review import Review
from app.schemas.accommodation import AccommodationListItem
from app.schemas.category import CategoryResponse
from app.schemas.geo import CityResponse, ProvinceResponse


async def build_accommodation_list_items(
    db: AsyncSession,
    accommodations: Sequence[Accommodation],
) -> list[AccommodationListItem]:
    """Serialize accommodations with their rating aggregate and cover image.

    Single source of truth for list-shaped accommodation payloads; used by the
    public/host listing endpoints and by wishlists.
    """
    acc_ids = [a.id for a in accommodations]
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

    items: list[AccommodationListItem] = []
    for acc in accommodations:
        cover = next((img.image_url for img in acc.images if img.is_cover), None)
        if not cover and acc.images:
            cover = acc.images[0].image_url

        avg_rat, count_rat = ratings_map.get(acc.id, (None, 0))
        city_resp = None
        if acc.city:
            prov_resp = (
                ProvinceResponse.model_validate(acc.city.province)
                if acc.city.province
                else None
            )
            city_resp = CityResponse(
                id=acc.city.id,
                province_id=acc.city.province_id,
                name=acc.city.name,
                province=prov_resp,
            )

        cat_resp = CategoryResponse.model_validate(acc.category) if acc.category else None

        items.append(
            AccommodationListItem(
                id=acc.id,
                title=acc.title,
                city=city_resp,
                category=cat_resp,
                base_price=acc.base_price,
                capacity=acc.capacity,
                max_capacity=acc.max_capacity,
                rooms_count=acc.rooms_count,
                beds_count=acc.beds_count,
                min_nights=acc.min_nights,
                cover_image=cover,
                cancellation_policy=acc.cancellation_policy,
                average_rating=round(avg_rat, 1) if avg_rat is not None else None,
                reviews_count=count_rat,
                is_active=acc.is_active,
            )
        )
    return items
