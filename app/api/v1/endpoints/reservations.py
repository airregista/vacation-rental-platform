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
    CancellationPreviewResponse,
    CancellationRequest,
    CancellationResponse,
    PriceCalculationRequest,
    PriceCalculationResponse,
    ReservationCreate,
    ReservationResponse,
)
from app.services.cancellation_service import calculate_cancellation_refund
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


@router.get("/host", response_model=list[ReservationResponse])
async def list_host_reservations(
    current_user: CurrentUserDep,
    db: SessionDep,
) -> list[ReservationResponse]:
    stmt = (
        select(Reservation)
        .join(Reservation.accommodation)
        .options(selectinload(Reservation.accommodation))
        .where(Accommodation.host_id == current_user.id)
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

    is_admin = current_user.role == "admin"
    is_guest = reservation.user_id == current_user.id
    is_host = bool(reservation.accommodation and reservation.accommodation.host_id == current_user.id)

    if not (is_admin or is_guest or is_host):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not have permission to view this reservation",
        )

    item = ReservationResponse.model_validate(reservation)
    item.accommodation_title = reservation.accommodation.title if reservation.accommodation else None
    return item


@router.get("/{id}/cancel-preview", response_model=CancellationPreviewResponse)
async def preview_cancellation(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> CancellationPreviewResponse:
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

    refundable, penalty, hours_to_checkin = calculate_cancellation_refund(
        reservation, reservation.accommodation
    )
    if hours_to_checkin <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel reservation: check-in time has already arrived or passed",
        )

    return CancellationPreviewResponse(
        reservation_id=reservation.id,
        cancellation_policy=getattr(reservation.accommodation, "cancellation_policy", "flexible"),
        hours_to_checkin=hours_to_checkin,
        total_price=reservation.total_price,
        refundable_amount=refundable,
        penalty_amount=penalty,
    )


@router.post("/{id}/cancel", response_model=CancellationResponse)
async def cancel_reservation(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
    req: CancellationRequest | None = None,
) -> CancellationResponse:
    stmt = (
        select(Reservation)
        .options(selectinload(Reservation.accommodation))
        .where(Reservation.id == id)
        .with_for_update(of=Reservation)
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

    refundable, penalty, hours_to_checkin = calculate_cancellation_refund(
        reservation, reservation.accommodation
    )
    if hours_to_checkin <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel reservation: check-in time has already arrived or passed",
        )

    reservation.status = "cancelled"
    reservation.cancelled_at = datetime.now(timezone.utc)
    reservation.cancellation_reason = req.reason if req else None
    reservation.refund_amount = refundable
    reservation.penalty_amount = penalty

    if refundable > 0:
        refund_record = Payment(
            reservation_id=reservation.id,
            amount=refundable,
            tracking_code=f"REF-{uuid.uuid4().hex[:10].upper()}",
            status="success",
            paid_at=datetime.now(timezone.utc),
        )
        db.add(refund_record)

    await db.commit()
    await db.refresh(reservation)

    return CancellationResponse(
        reservation_id=reservation.id,
        status="cancelled",
        refund_amount=refundable,
        penalty_amount=penalty,
        message="Reservation cancelled successfully",
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
