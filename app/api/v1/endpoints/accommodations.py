from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import delete, distinct, exists, func, not_, select
from sqlalchemy.orm import joinedload, selectinload

from app.api.dependencies import CurrentAdminDep, CurrentUserDep, SessionDep
from app.models.accommodation import Accommodation, AccommodationImage, PricingException
from app.models.amenity import AccommodationAmenity, Amenity
from app.models.category import Category
from app.models.geo import City
from app.models.reservation import Reservation
from app.models.review import Review
from app.models.user import User
from app.schemas.accommodation import (
    AccommodationCreate,
    AccommodationDetail,
    AccommodationImageCreate,
    AccommodationImageResponse,
    AccommodationListItem,
    AccommodationUpdate,
    PricingExceptionBatchCreate,
    PricingExceptionBatchResponse,
    PricingExceptionCreate,
    PricingExceptionResponse,
)
from app.schemas.category import CategoryResponse
from app.schemas.geo import CityResponse, ProvinceResponse
from app.schemas.reservation import CalendarDayInfo

router = APIRouter(prefix="/accommodations", tags=["accommodations"])


@router.get("/", response_model=list[AccommodationListItem])
async def list_accommodations(
    db: SessionDep,
    city_id: Annotated[int | None, Query(description="Filter by city ID")] = None,
    province_id: Annotated[int | None, Query(description="Filter by province ID")] = None,
    category_id: Annotated[int | None, Query(description="Filter by category ID")] = None,
    guests_count: Annotated[
        int | None, Query(ge=1, description="Minimum maximum capacity required")
    ] = None,
    min_price: Annotated[Decimal | None, Query(ge=0, description="Minimum base price")] = None,
    max_price: Annotated[Decimal | None, Query(ge=0, description="Maximum base price")] = None,
    check_in: Annotated[
        date | None, Query(description="Check-in date for availability check")
    ] = None,
    check_out: Annotated[
        date | None, Query(description="Check-out date for availability check")
    ] = None,
    amenity_ids: Annotated[list[int] | None, Query(description="Required amenity IDs")] = None,
    lat: Annotated[
        float | None, Query(ge=-90, le=90, description="Latitude for spatial radius search")
    ] = None,
    lng: Annotated[
        float | None, Query(ge=-180, le=180, description="Longitude for spatial radius search")
    ] = None,
    radius_km: Annotated[
        float | None, Query(gt=0, le=1000, description="Search radius in kilometers")
    ] = None,
    sort_by: Annotated[str, Query(description="Sorting: newest, price_asc, price_desc")] = "newest",
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[AccommodationListItem]:
    stmt = (
        select(Accommodation)
        .options(
            joinedload(Accommodation.city).joinedload(City.province),
            joinedload(Accommodation.category),
            joinedload(Accommodation.host),
            selectinload(Accommodation.images),
        )
        .where(Accommodation.is_active.is_(True))
    )

    if city_id is not None:
        stmt = stmt.where(Accommodation.city_id == city_id)
    if province_id is not None:
        stmt = stmt.join(Accommodation.city).where(City.province_id == province_id)
    if category_id is not None:
        stmt = stmt.where(Accommodation.category_id == category_id)
    if guests_count is not None:
        stmt = stmt.where(Accommodation.max_capacity >= guests_count)
    if min_price is not None:
        stmt = stmt.where(Accommodation.base_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Accommodation.base_price <= max_price)

    # Date range availability filter: exclude accommodations with overlapping confirmed bookings or blocked dates
    if (check_in is not None and check_out is None) or (check_in is None and check_out is not None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both check_in and check_out parameters must be provided together for availability filtering",
        )

    if check_in and check_out:
        if check_out <= check_in:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Check-out date must be strictly after check-in date",
            )

        stmt = stmt.where(
            not_(
                exists(
                    select(Reservation.id).where(
                        Reservation.accommodation_id == Accommodation.id,
                        Reservation.status == "confirmed",
                        Reservation.check_in < check_out,
                        Reservation.check_out > check_in,
                    )
                )
            ),
            not_(
                exists(
                    select(PricingException.id).where(
                        PricingException.accommodation_id == Accommodation.id,
                        PricingException.is_blocked.is_(True),
                        PricingException.date >= check_in,
                        PricingException.date < check_out,
                    )
                )
            ),
        )

    # Filter by amenities if specified
    if amenity_ids:
        stmt = (
            stmt.join(Accommodation.amenities)
            .where(Amenity.id.in_(amenity_ids))
            .group_by(Accommodation.id)
            .having(func.count(distinct(Amenity.id)) == len(amenity_ids))
        )

    # Spatial radius search (Haversine formula)
    spatial_params = [lat is not None, lng is not None, radius_km is not None]
    if any(spatial_params) and not all(spatial_params):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parameters lat, lng, and radius_km must all be provided together for spatial search",
        )

    if lat is not None and lng is not None and radius_km is not None:
        cos_angle = func.cos(func.radians(lat)) * func.cos(
            func.radians(Accommodation.latitude)
        ) * func.cos(func.radians(Accommodation.longitude) - func.radians(lng)) + func.sin(
            func.radians(lat)
        ) * func.sin(func.radians(Accommodation.latitude))
        clamped_cos = func.greatest(-1.0, func.least(1.0, cos_angle))
        haversine_expr = 6371 * func.acos(clamped_cos)
        stmt = stmt.where(
            Accommodation.latitude.is_not(None),
            Accommodation.longitude.is_not(None),
            haversine_expr <= radius_km,
        )

    # Sorting
    if sort_by == "price_asc":
        stmt = stmt.order_by(Accommodation.base_price.asc())
    elif sort_by == "price_desc":
        stmt = stmt.order_by(Accommodation.base_price.desc())
    else:
        stmt = stmt.order_by(Accommodation.created_at.desc())

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    accommodations = result.scalars().all()

    # Pre-fetch reviews aggregate rating
    acc_ids = [a.id for a in accommodations]
    ratings_map: dict[int, tuple[float, int]] = {}
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
            ratings_map[row.accommodation_id] = (float(row.avg_rating), int(row.count_rating))

    items: list[AccommodationListItem] = []
    for acc in accommodations:
        cover = next((img.image_url for img in acc.images if img.is_cover), None)
        if not cover and acc.images:
            cover = acc.images[0].image_url

        avg_rat, count_rat = ratings_map.get(acc.id, (None, 0))

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
                cover_image=cover,
                cancellation_policy=acc.cancellation_policy,
                average_rating=round(avg_rat, 1) if avg_rat is not None else None,
                reviews_count=count_rat,
                is_active=acc.is_active,
            )
        )
    return items


@router.get("/my", response_model=list[AccommodationListItem])
async def list_my_accommodations(
    current_user: CurrentUserDep,
    db: SessionDep,
) -> list[AccommodationListItem]:
    stmt = (
        select(Accommodation)
        .options(
            joinedload(Accommodation.city).joinedload(City.province),
            joinedload(Accommodation.category),
            joinedload(Accommodation.host),
            selectinload(Accommodation.images),
        )
        .where(Accommodation.host_id == current_user.id)
        .order_by(Accommodation.created_at.desc())
    )
    result = await db.execute(stmt)
    accommodations = result.scalars().all()

    acc_ids = [a.id for a in accommodations]
    ratings_map: dict[int, tuple[float, int]] = {}
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
            ratings_map[row.accommodation_id] = (float(row.avg_rating), int(row.count_rating))

    items: list[AccommodationListItem] = []
    for acc in accommodations:
        cover = next((img.image_url for img in acc.images if img.is_cover), None)
        if not cover and acc.images:
            cover = acc.images[0].image_url

        avg_rat, count_rat = ratings_map.get(acc.id, (None, 0))

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
                cover_image=cover,
                cancellation_policy=acc.cancellation_policy,
                average_rating=round(avg_rat, 1) if avg_rat is not None else None,
                reviews_count=count_rat,
                is_active=acc.is_active,
            )
        )
    return items


@router.get("/{id}", response_model=AccommodationDetail)
async def get_accommodation(id: int, db: SessionDep) -> AccommodationDetail:
    stmt = (
        select(Accommodation)
        .options(
            selectinload(Accommodation.host),
            selectinload(Accommodation.city).selectinload(City.province),
            selectinload(Accommodation.category),
            selectinload(Accommodation.images),
            selectinload(Accommodation.amenities),
        )
        .where(Accommodation.id == id)
    )
    result = await db.execute(stmt)
    acc = result.scalars().first()
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Accommodation not found",
        )

    # Reviews aggregate
    agg_stmt = select(
        func.avg(Review.rating).label("avg_rating"),
        func.count(Review.id).label("count_rating"),
    ).where(Review.accommodation_id == id)
    agg_res = await db.execute(agg_stmt)
    avg_r, count_r = agg_res.one()

    detail = AccommodationDetail.model_validate(acc)
    detail.average_rating = round(float(avg_r), 1) if avg_r is not None else None
    detail.reviews_count = int(count_r)
    return detail


@router.get("/{id}/calendar", response_model=list[CalendarDayInfo])
async def get_accommodation_calendar(
    id: int,
    db: SessionDep,
    start_date: Annotated[date | None, Query(description="Start date (defaults to today)")] = None,
    days: Annotated[int, Query(ge=1, le=90, description="Number of days to check")] = 30,
) -> list[CalendarDayInfo]:
    if start_date is None:
        start_date = date.today()
    end_date = start_date + timedelta(days=days)

    stmt = select(Accommodation).where(Accommodation.id == id)
    res = await db.execute(stmt)
    acc = res.scalars().first()
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Accommodation not found",
        )

    # Fetch pricing exceptions
    ex_stmt = select(PricingException).where(
        PricingException.accommodation_id == id,
        PricingException.date >= start_date,
        PricingException.date < end_date,
    )
    ex_res = await db.execute(ex_stmt)
    exceptions = {e.date: e for e in ex_res.scalars().all()}

    # Fetch confirmed reservations
    res_stmt = select(Reservation).where(
        Reservation.accommodation_id == id,
        Reservation.status == "confirmed",
        Reservation.check_in < end_date,
        Reservation.check_out > start_date,
    )
    res_result = await db.execute(res_stmt)
    confirmed_reservations = res_result.scalars().all()

    calendar_days: list[CalendarDayInfo] = []
    curr = start_date
    while curr < end_date:
        exception = exceptions.get(curr)
        day_price = (
            exception.price if (exception and exception.price is not None) else acc.base_price
        )
        is_exception = exception is not None and exception.price is not None

        # Check if booked
        is_booked = any(r.check_in <= curr < r.check_out for r in confirmed_reservations)
        is_blocked = (exception.is_blocked if exception else False) or (not acc.is_active)

        is_available = not is_booked and not is_blocked

        calendar_days.append(
            CalendarDayInfo(
                date=curr,
                price=day_price,
                is_available=is_available,
                is_exception=is_exception,
            )
        )
        curr += timedelta(days=1)

    return calendar_days


@router.get("/{id}/calendar.ics", response_class=Response)
async def export_accommodation_calendar_ics(
    id: int,
    db: SessionDep,
) -> Response:
    acc_stmt = select(Accommodation).where(Accommodation.id == id)
    acc = (await db.execute(acc_stmt)).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    res_stmt = select(Reservation).where(
        Reservation.accommodation_id == id,
        Reservation.status == "confirmed",
    )
    reservations = (await db.execute(res_stmt)).scalars().all()

    block_stmt = select(PricingException).where(
        PricingException.accommodation_id == id,
        PricingException.is_blocked.is_(True),
    )
    blocked = (await db.execute(block_stmt)).scalars().all()

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Jabama Accommodation//Calendar Sync//EN",
        "CALSCALE:GREGORIAN",
    ]

    for r in reservations:
        dtstart = r.check_in.strftime("%Y%m%d")
        dtend = r.check_out.strftime("%Y%m%d")
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:res-{r.id}@jabama.local",
                f"DTSTART;VALUE=DATE:{dtstart}",
                f"DTEND;VALUE=DATE:{dtend}",
                f"SUMMARY:Booked - Reservation #{r.id}",
                "END:VEVENT",
            ]
        )

    for b in blocked:
        dt = b.date.strftime("%Y%m%d")
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:block-{b.id}@jabama.local",
                f"DTSTART;VALUE=DATE:{dt}",
                "SUMMARY:Blocked - Not Available",
                "END:VEVENT",
            ]
        )

    lines.append("END:VCALENDAR")
    ics_content = "\r\n".join(lines)
    return Response(content=ics_content, media_type="text/calendar")


@router.post("/", response_model=AccommodationDetail, status_code=status.HTTP_201_CREATED)
async def create_accommodation(
    acc_in: AccommodationCreate,
    admin: CurrentAdminDep,
    db: SessionDep,
) -> AccommodationDetail:
    # Verify city and category
    city_exists = (
        await db.execute(select(City.id).where(City.id == acc_in.city_id))
    ).scalar_one_or_none()
    if not city_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"City ID {acc_in.city_id} does not exist",
        )

    cat_exists = (
        await db.execute(select(Category.id).where(Category.id == acc_in.category_id))
    ).scalar_one_or_none()
    if not cat_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category ID {acc_in.category_id} does not exist",
        )

    if acc_in.amenity_ids:
        existing_amenities = (
            (await db.execute(select(Amenity.id).where(Amenity.id.in_(acc_in.amenity_ids))))
            .scalars()
            .all()
        )
        missing = set(acc_in.amenity_ids) - set(existing_amenities)
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Amenity IDs not found: {sorted(list(missing))}",
            )

    if acc_in.host_id is not None:
        host_user = (
            (await db.execute(select(User).where(User.id == acc_in.host_id))).scalars().first()
        )
        if not host_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Host user with ID {acc_in.host_id} not found",
            )
        host_id = acc_in.host_id
    else:
        host_id = admin.id

    accommodation = Accommodation(
        host_id=host_id,
        category_id=acc_in.category_id,
        city_id=acc_in.city_id,
        title=acc_in.title,
        description=acc_in.description,
        address=acc_in.address,
        latitude=acc_in.latitude,
        longitude=acc_in.longitude,
        base_price=acc_in.base_price,
        cleaning_fee=acc_in.cleaning_fee,
        capacity=acc_in.capacity,
        max_capacity=acc_in.max_capacity,
        extra_guest_fee=acc_in.extra_guest_fee,
        rooms_count=acc_in.rooms_count,
        beds_count=acc_in.beds_count,
        check_in_time=acc_in.check_in_time,
        check_out_time=acc_in.check_out_time,
        rules=acc_in.rules,
        cancellation_policy=acc_in.cancellation_policy,
        is_active=acc_in.is_active,
    )
    db.add(accommodation)
    await db.flush()

    # Add images
    for idx, img in enumerate(acc_in.images):
        image = AccommodationImage(
            accommodation_id=accommodation.id,
            image_url=img.image_url,
            is_cover=img.is_cover or (idx == 0),
            sort_order=img.sort_order or idx,
        )
        db.add(image)

    # Add amenities
    if acc_in.amenity_ids:
        for aid in acc_in.amenity_ids:
            link = AccommodationAmenity(accommodation_id=accommodation.id, amenity_id=aid)
            db.add(link)

    await db.commit()

    # Re-fetch with relationships
    return await get_accommodation(accommodation.id, db)


@router.put("/{id}", response_model=AccommodationDetail)
async def update_accommodation(
    id: int,
    acc_in: AccommodationUpdate,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> AccommodationDetail:
    stmt = select(Accommodation).where(Accommodation.id == id)
    res = await db.execute(stmt)
    acc = res.scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this accommodation",
        )

    if acc_in.city_id is not None:
        city_exists = (
            await db.execute(select(City.id).where(City.id == acc_in.city_id))
        ).scalar_one_or_none()
        if not city_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"City ID {acc_in.city_id} does not exist",
            )

    if acc_in.category_id is not None:
        cat_exists = (
            await db.execute(select(Category.id).where(Category.id == acc_in.category_id))
        ).scalar_one_or_none()
        if not cat_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category ID {acc_in.category_id} does not exist",
            )

    new_capacity = acc_in.capacity if acc_in.capacity is not None else acc.capacity
    new_max_capacity = acc_in.max_capacity if acc_in.max_capacity is not None else acc.max_capacity

    if new_max_capacity < new_capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"max_capacity ({new_max_capacity}) must be greater than or equal to base capacity ({new_capacity})",
        )

    if acc_in.amenity_ids is not None:
        if acc_in.amenity_ids:
            existing_amenities = (
                await db.execute(select(Amenity.id).where(Amenity.id.in_(acc_in.amenity_ids)))
            ).scalars().all()
            missing = set(acc_in.amenity_ids) - set(existing_amenities)
            if missing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Amenity IDs not found: {sorted(list(missing))}",
                )
        await db.execute(delete(AccommodationAmenity).where(AccommodationAmenity.accommodation_id == id))
        for aid in acc_in.amenity_ids:
            db.add(AccommodationAmenity(accommodation_id=id, amenity_id=aid))

    update_data = acc_in.model_dump(exclude_unset=True)
    update_data.pop("amenity_ids", None)
    for field, value in update_data.items():
        setattr(acc, field, value)

    await db.commit()
    db.expire_all()  # Crucial: invalidates session identity map so get_accommodation reloads fresh amenities
    return await get_accommodation(id, db)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_accommodation(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> None:
    stmt = select(Accommodation).where(Accommodation.id == id)
    res = await db.execute(stmt)
    acc = res.scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this accommodation",
        )

    # Soft delete / deactivate
    acc.is_active = False
    await db.commit()


@router.post(
    "/{id}/images", response_model=AccommodationImageResponse, status_code=status.HTTP_201_CREATED
)
async def add_accommodation_image(
    id: int,
    img_in: AccommodationImageCreate,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> AccommodationImageResponse:
    acc = (await db.execute(select(Accommodation).where(Accommodation.id == id))).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this accommodation",
        )

    if img_in.is_cover:
        # Reset other covers
        reset_stmt = select(AccommodationImage).where(
            AccommodationImage.accommodation_id == id, AccommodationImage.is_cover.is_(True)
        )
        existing_covers = (await db.execute(reset_stmt)).scalars().all()
        for c in existing_covers:
            c.is_cover = False

    image = AccommodationImage(
        accommodation_id=id,
        image_url=img_in.image_url,
        is_cover=img_in.is_cover,
        sort_order=img_in.sort_order,
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)
    return AccommodationImageResponse.model_validate(image)


@router.delete("/{id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_accommodation_image(
    id: int,
    image_id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> None:
    acc = (await db.execute(select(Accommodation).where(Accommodation.id == id))).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this accommodation",
        )

    del_stmt = delete(AccommodationImage).where(
        AccommodationImage.id == image_id,
        AccommodationImage.accommodation_id == id,
    )
    await db.execute(del_stmt)
    await db.commit()


@router.post("/{id}/pricing-exceptions", response_model=PricingExceptionResponse)
async def upsert_pricing_exception(
    id: int,
    ex_in: PricingExceptionCreate,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> PricingExceptionResponse:
    acc = (await db.execute(select(Accommodation).where(Accommodation.id == id))).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this accommodation",
        )

    # Check if exception exists for this date
    stmt = select(PricingException).where(
        PricingException.accommodation_id == id,
        PricingException.date == ex_in.date,
    )
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        existing.price = ex_in.price
        existing.is_blocked = ex_in.is_blocked
        exception_obj = existing
    else:
        exception_obj = PricingException(
            accommodation_id=id,
            date=ex_in.date,
            price=ex_in.price,
            is_blocked=ex_in.is_blocked,
        )
        db.add(exception_obj)

    await db.commit()
    await db.refresh(exception_obj)
    return PricingExceptionResponse.model_validate(exception_obj)


@router.post("/{id}/pricing-exceptions/batch", response_model=PricingExceptionBatchResponse)
async def batch_pricing_exceptions(
    id: int,
    batch_in: PricingExceptionBatchCreate,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> PricingExceptionBatchResponse:
    acc = (await db.execute(select(Accommodation).where(Accommodation.id == id))).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this accommodation",
        )

    # Pre-fetch existing exceptions in range
    stmt = select(PricingException).where(
        PricingException.accommodation_id == id,
        PricingException.date >= batch_in.start_date,
        PricingException.date <= batch_in.end_date,
    )
    existing_map = {e.date: e for e in (await db.execute(stmt)).scalars().all()}

    curr = batch_in.start_date
    count = 0
    while curr <= batch_in.end_date:
        if curr in existing_map:
            obj = existing_map[curr]
            obj.price = batch_in.price
            obj.is_blocked = batch_in.is_blocked
        else:
            obj = PricingException(
                accommodation_id=id,
                date=curr,
                price=batch_in.price,
                is_blocked=batch_in.is_blocked,
            )
            db.add(obj)
        count += 1
        curr += timedelta(days=1)

    await db.commit()
    return PricingExceptionBatchResponse(
        updated_count=count,
        start_date=batch_in.start_date,
        end_date=batch_in.end_date,
    )


@router.delete("/{id}/pricing-exceptions/{exception_date}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pricing_exception(
    id: int,
    exception_date: date,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> None:
    acc = (await db.execute(select(Accommodation).where(Accommodation.id == id))).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this accommodation",
        )

    stmt = select(PricingException).where(
        PricingException.accommodation_id == id,
        PricingException.date == exception_date,
    )
    existing = (await db.execute(stmt)).scalars().first()
    if not existing:
        raise HTTPException(status_code=404, detail="Pricing exception for this date not found")

    await db.delete(existing)
    await db.commit()

