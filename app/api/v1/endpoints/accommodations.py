from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import and_, delete, distinct, func, or_, select
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentAdminDep, CurrentUserDep, SessionDep
from app.models.accommodation import Accommodation, AccommodationImage, PricingException
from app.models.amenity import AccommodationAmenity, Amenity
from app.models.category import Category
from app.models.geo import City
from app.models.reservation import Reservation
from app.models.review import Review
from app.schemas.accommodation import (
    AccommodationCreate,
    AccommodationDetail,
    AccommodationImageCreate,
    AccommodationImageResponse,
    AccommodationListItem,
    AccommodationUpdate,
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
    guests_count: Annotated[int | None, Query(ge=1, description="Minimum maximum capacity required")] = None,
    min_price: Annotated[Decimal | None, Query(ge=0, description="Minimum base price")] = None,
    max_price: Annotated[Decimal | None, Query(ge=0, description="Maximum base price")] = None,
    check_in: Annotated[date | None, Query(description="Check-in date for availability check")] = None,
    check_out: Annotated[date | None, Query(description="Check-out date for availability check")] = None,
    amenity_ids: Annotated[list[int] | None, Query(description="Required amenity IDs")] = None,
    sort_by: Annotated[str, Query(description="Sorting: newest, price_asc, price_desc")] = "newest",
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[AccommodationListItem]:
    stmt = (
        select(Accommodation)
        .options(
            selectinload(Accommodation.city).selectinload(City.province),
            selectinload(Accommodation.category),
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
    if check_in and check_out:
        if check_out <= check_in:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Check-out date must be strictly after check-in date",
            )

        # Subquery: accommodations with overlapping confirmed reservations
        overlapping_res_subq = (
            select(Reservation.accommodation_id)
            .where(
                Reservation.status == "confirmed",
                Reservation.check_in < check_out,
                Reservation.check_out > check_in,
            )
            .scalar_subquery()
        )

        # Subquery: accommodations with blocked pricing exceptions
        blocked_dates_subq = (
            select(PricingException.accommodation_id)
            .where(
                PricingException.is_blocked.is_(True),
                PricingException.date >= check_in,
                PricingException.date < check_out,
            )
            .scalar_subquery()
        )

        stmt = stmt.where(
            Accommodation.id.not_in(overlapping_res_subq),
            Accommodation.id.not_in(blocked_dates_subq),
        )

    # Filter by amenities if specified
    if amenity_ids:
        for aid in amenity_ids:
            subq = (
                select(AccommodationAmenity.accommodation_id)
                .where(AccommodationAmenity.amenity_id == aid)
                .scalar_subquery()
            )
            stmt = stmt.where(Accommodation.id.in_(subq))

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
            prov_resp = ProvinceResponse.model_validate(acc.city.province) if acc.city.province else None
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
    agg_stmt = (
        select(
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.id).label("count_rating"),
        )
        .where(Review.accommodation_id == id)
    )
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
    ex_stmt = (
        select(PricingException)
        .where(
            PricingException.accommodation_id == id,
            PricingException.date >= start_date,
            PricingException.date < end_date,
        )
    )
    ex_res = await db.execute(ex_stmt)
    exceptions = {e.date: e for e in ex_res.scalars().all()}

    # Fetch confirmed reservations
    res_stmt = (
        select(Reservation)
        .where(
            Reservation.accommodation_id == id,
            Reservation.status == "confirmed",
            Reservation.check_in < end_date,
            Reservation.check_out > start_date,
        )
    )
    res_result = await db.execute(res_stmt)
    confirmed_reservations = res_result.scalars().all()

    calendar_days: list[CalendarDayInfo] = []
    curr = start_date
    while curr < end_date:
        exception = exceptions.get(curr)
        day_price = exception.price if (exception and exception.price is not None) else acc.base_price
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


@router.post("/", response_model=AccommodationDetail, status_code=status.HTTP_201_CREATED)
async def create_accommodation(
    acc_in: AccommodationCreate,
    admin: CurrentAdminDep,
    db: SessionDep,
) -> AccommodationDetail:
    # Verify city and category
    city = (await db.execute(select(City).where(City.id == acc_in.city_id))).scalars().first()
    if not city:
        raise HTTPException(status_code=400, detail="City ID not found")
    category = (await db.execute(select(Category).where(Category.id == acc_in.category_id))).scalars().first()
    if not category:
        raise HTTPException(status_code=400, detail="Category ID not found")

    host_id = acc_in.host_id if acc_in.host_id is not None else admin.id
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

    update_data = acc_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(acc, field, value)

    await db.commit()
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


@router.post("/{id}/images", response_model=AccommodationImageResponse, status_code=status.HTTP_201_CREATED)
async def add_accommodation_image(
    id: int,
    img_in: AccommodationImageCreate,
    admin: CurrentAdminDep,
    db: SessionDep,
) -> AccommodationImageResponse:
    acc = (await db.execute(select(Accommodation).where(Accommodation.id == id))).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if img_in.is_cover:
        # Reset other covers
        reset_stmt = (
            select(AccommodationImage)
            .where(AccommodationImage.accommodation_id == id, AccommodationImage.is_cover.is_(True))
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
    admin: CurrentAdminDep,
    db: SessionDep,
) -> None:
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
    admin: CurrentAdminDep,
    db: SessionDep,
) -> PricingExceptionResponse:
    acc = (await db.execute(select(Accommodation).where(Accommodation.id == id))).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

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
