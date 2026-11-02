from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated
import uuid
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentAdminDep, CurrentUserDep, SessionDep
from app.models.accommodation import Accommodation
from app.models.payment import Payment
from app.models.reservation import Reservation
from app.schemas.reservation import (
    CancellationResponse,
    PriceCalculationRequest,
    PriceCalculationResponse,
    ReservationCreate,
    ReservationResponse,
)
from app.services.pricing_service import calculate_reservation_price
from app.services.reservation_service import check_booking_overlap

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.post("/calculate-price", response_model=PriceCalculationResponse)
async def calculate_price(
    req: PriceCalculationRequest,
    db: SessionDep,
) -> PriceCalculationResponse:
    stmt = select(Accommodation).where(Accommodation.id == req.accommodation_id)
    res = await db.execute(stmt)
    acc = res.scalars().first()
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Accommodation not found",
        )
    return await calculate_reservation_price(
        db=db,
        accommodation=acc,
        check_in=req.check_in,
        check_out=req.check_out,
        guests_count=req.guests_count,
    )


@router.post("/", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    res_in: ReservationCreate,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> ReservationResponse:
    stmt = select(Accommodation).where(Accommodation.id == res_in.accommodation_id)
    res = await db.execute(stmt)
    acc = res.scalars().first()
    if not acc or not acc.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Accommodation not found or is currently inactive",
        )

    # Overlap check
    is_overlapping = await check_booking_overlap(
        db=db,
        accommodation_id=res_in.accommodation_id,
        check_in=res_in.check_in,
        check_out=res_in.check_out,
    )
    if is_overlapping:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="These dates overlap with an already confirmed booking. Please select different dates.",
        )

    # Dynamic pricing calculation
    calc = await calculate_reservation_price(
        db=db,
        accommodation=acc,
        check_in=res_in.check_in,
        check_out=res_in.check_out,
        guests_count=res_in.guests_count,
    )

    reservation = Reservation(
        user_id=current_user.id,
        accommodation_id=acc.id,
        check_in=res_in.check_in,
        check_out=res_in.check_out,
        guests_count=res_in.guests_count,
        total_nights=calc.total_nights,
        total_price=calc.total_price,
        status="pending",
    )
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)

    resp = ReservationResponse.model_validate(reservation)
    resp.accommodation_title = acc.title
    return resp


@router.get("/my", response_model=list[ReservationResponse])
async def list_my_reservations(
    current_user: CurrentUserDep,
    db: SessionDep,
) -> list[ReservationResponse]:
    stmt = (
        select(Reservation)
        .options(selectinload(Reservation.accommodation))
        .where(Reservation.user_id == current_user.id)
        .order_by(Reservation.created_at.desc())
    )
    result = await db.execute(stmt)
    reservations = result.scalars().all()

    items: list[ReservationResponse] = []
    for r in reservations:
        item = ReservationResponse.model_validate(r)
        item.accommodation_title = r.accommodation.title if r.accommodation else None
        items.append(item)
    return items


@router.get("/{id}", response_model=ReservationResponse)
async def get_reservation(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> ReservationResponse:
    stmt = (
        select(Reservation)
        .options(selectinload(Reservation.accommodation))
        .where(Reservation.id == id)
    )
    res = await db.execute(stmt)
    reservation = res.scalars().first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    # Authorization check: guest can view their own, admin can view any
    if current_user.role != "admin" and reservation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    item = ReservationResponse.model_validate(reservation)
    item.accommodation_title = reservation.accommodation.title if reservation.accommodation else None
    return item


@router.post("/{id}/cancel", response_model=CancellationResponse)
async def cancel_reservation(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> CancellationResponse:
    stmt = (
        select(Reservation)
        .options(selectinload(Reservation.accommodation))
        .where(Reservation.id == id)
    )
    res = await db.execute(stmt)
    reservation = res.scalars().first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    if current_user.role != "admin" and reservation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    if reservation.status in ("cancelled", "completed"):
        raise HTTPException(
            status_code=400,
            detail=f"Reservation cannot be cancelled from status: {reservation.status}",
        )

    days_until_check_in = (reservation.check_in - date.today()).days
    if days_until_check_in < 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel reservation after check-in date has passed",
        )

    refund_amount = Decimal(0)
    penalty_amount = Decimal(0)
    message = "Reservation cancelled successfully"

    if reservation.status == "confirmed":
        if days_until_check_in >= 3:
            # Full 100% refund for cancellations at least 3 days prior
            refund_amount = reservation.total_price
            penalty_amount = Decimal(0)
            message = "Reservation cancelled with 100% full refund (more than 3 days before check-in)"
        else:
            # 70% refund (30% host compensation penalty)
            refund_amount = (reservation.total_price * Decimal("0.70")).quantize(Decimal("1"))
            penalty_amount = reservation.total_price - refund_amount
            message = "Reservation cancelled with 70% refund (30% penalty applied due to late cancellation)"

        if refund_amount > 0:
            refund_record = Payment(
                reservation_id=reservation.id,
                amount=refund_amount,
                tracking_code=f"REF-{uuid.uuid4().hex[:10].upper()}",
                status="success",
                paid_at=datetime.now(timezone.utc),
            )
            db.add(refund_record)

    reservation.status = "cancelled"
    await db.commit()
    await db.refresh(reservation)

    return CancellationResponse(
        reservation_id=reservation.id,
        status="cancelled",
        refund_amount=refund_amount,
        penalty_amount=penalty_amount,
        message=message,
    )


@router.get("/", response_model=list[ReservationResponse])
async def list_all_reservations(
    admin: CurrentAdminDep,
    db: SessionDep,
    status_filter: Annotated[str | None, Query(description="Filter by reservation status")] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[ReservationResponse]:
    stmt = (
        select(Reservation)
        .options(selectinload(Reservation.accommodation))
        .order_by(Reservation.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(Reservation.status == status_filter)

    result = await db.execute(stmt)
    reservations = result.scalars().all()

    items: list[ReservationResponse] = []
    for r in reservations:
        item = ReservationResponse.model_validate(r)
        item.accommodation_title = r.accommodation.title if r.accommodation else None
        items.append(item)
    return items
