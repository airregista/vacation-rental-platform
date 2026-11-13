import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.orm import joinedload, selectinload

from app.api.dependencies import CurrentAdminDep, CurrentUserDep, SessionDep
from app.core.config import settings
from app.models.accommodation import Accommodation
from app.models.geo import City
from app.models.payment import HostPayout, Payment
from app.models.reservation import Reservation, ReservationMessage
from app.schemas.reservation import (
    CancellationPreviewResponse,
    CancellationRequest,
    CancellationResponse,
    PriceCalculationRequest,
    PriceCalculationResponse,
    ReservationCreate,
    ReservationMessageCreate,
    ReservationMessageResponse,
    ReservationResponse,
)
from app.services.cancellation_service import (
    calculate_cancellation_refund,
    get_first_night_price,
)
from app.services.coupon_service import evaluate_coupon, lock_coupon_by_code
from app.services.pricing_service import calculate_reservation_price
from app.services.reservation_service import (
    check_booking_overlap,
    expire_stale_pending_reservations,
    validate_reservation_horizon,
)

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.post("/cleanup-expired")
async def cleanup_expired_reservations(
    admin: CurrentAdminDep,
    db: SessionDep,
    ttl_minutes: Annotated[
        int, Query(ge=0, description="Minutes after which pending reservations expire")
    ] = 30,
) -> dict[str, int]:
    count = await expire_stale_pending_reservations(db, ttl_minutes=ttl_minutes)
    return {"expired_count": count}


@router.post("/calculate-price", response_model=PriceCalculationResponse)
async def calculate_price(
    req: PriceCalculationRequest,
    db: SessionDep,
) -> PriceCalculationResponse:
    stmt = select(Accommodation).where(Accommodation.id == req.accommodation_id)
    res = await db.execute(stmt)
    acc = res.scalars().first()
    if not acc or not acc.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Accommodation not found or is currently inactive",
        )
    return await calculate_reservation_price(
        db=db,
        accommodation=acc,
        check_in=req.check_in,
        check_out=req.check_out,
        guests_count=req.guests_count,
        coupon_code=req.coupon_code,
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

    validate_reservation_horizon(res_in.check_in, res_in.check_out)

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
        coupon_code=res_in.coupon_code,
    )

    init_status = "pending"
    if calc.total_price == Decimal(0):
        # ponytail: row lock serializes concurrent zero-payable bookings
        acc_lock_stmt = (
            select(Accommodation)
            .where(Accommodation.id == acc.id)
            .with_for_update(of=Accommodation)
        )
        await db.execute(acc_lock_stmt)
        if await check_booking_overlap(
            db=db,
            accommodation_id=acc.id,
            check_in=res_in.check_in,
            check_out=res_in.check_out,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="These dates overlap with an already confirmed booking. Please select different dates.",
            )
        init_status = "confirmed"

    reservation = Reservation(
        user_id=current_user.id,
        accommodation_id=acc.id,
        check_in=res_in.check_in,
        check_out=res_in.check_out,
        guests_count=res_in.guests_count,
        total_nights=calc.total_nights,
        total_price=calc.total_price,
        coupon_code=calc.coupon_code,
        status=init_status,
    )
    db.add(reservation)

    if calc.coupon_code:
        coupon_obj = await lock_coupon_by_code(db, calc.coupon_code)
        if coupon_obj:
            # Re-validate under the lock: the coupon may have expired, been
            # deactivated, or hit its usage limit since the price calculation.
            evaluation = evaluate_coupon(coupon_obj, calc.nights_total + calc.extra_guest_total)
            if not evaluation.is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail=evaluation.message
                )
            coupon_obj.used_count += 1

    await db.commit()
    await db.refresh(reservation)

    resp = ReservationResponse.model_validate(reservation)
    resp.accommodation_title = acc.title
    return resp


def _serialize_reservation(r: Reservation) -> ReservationResponse:
    item = ReservationResponse.model_validate(r)
    acc = r.accommodation
    item.accommodation_title = acc.title if acc else None
    if acc:
        # Cover image first, falling back to the first image — same rule as
        # the accommodation list / wishlist serializers.
        cover = next((img.image_url for img in acc.images if img.is_cover), None)
        if not cover and acc.images:
            cover = acc.images[0].image_url
        item.accommodation_image = cover
        item.city = acc.city.name if acc.city else None
        item.province = acc.city.province.name if acc.city and acc.city.province else None
    return item


# Eager loads backing _serialize_reservation: async sessions cannot lazy-load
# accommodation images / city / province after the query returns.
_RESERVATION_ACCOMMODATION_LOAD = (
    selectinload(Reservation.accommodation).selectinload(Accommodation.images),
    selectinload(Reservation.accommodation)
    .selectinload(Accommodation.city)
    .selectinload(City.province),
)


@router.get("/my", response_model=list[ReservationResponse])
async def list_my_reservations(
    current_user: CurrentUserDep,
    db: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[ReservationResponse]:
    stmt = (
        select(Reservation)
        .options(*_RESERVATION_ACCOMMODATION_LOAD)
        .where(Reservation.user_id == current_user.id)
        .order_by(Reservation.created_at.desc(), Reservation.id.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    reservations = result.scalars().all()

    return [_serialize_reservation(r) for r in reservations]


@router.get("/host", response_model=list[ReservationResponse])
async def list_host_reservations(
    current_user: CurrentUserDep,
    db: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[ReservationResponse]:
    stmt = (
        select(Reservation)
        .join(Reservation.accommodation)
        .options(*_RESERVATION_ACCOMMODATION_LOAD)
        .where(Accommodation.host_id == current_user.id)
        .order_by(Reservation.created_at.desc(), Reservation.id.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    reservations = result.scalars().all()

    return [_serialize_reservation(r) for r in reservations]


@router.get("/{id}", response_model=ReservationResponse)
async def get_reservation(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> ReservationResponse:
    stmt = select(Reservation).options(*_RESERVATION_ACCOMMODATION_LOAD).where(Reservation.id == id)
    res = await db.execute(stmt)
    reservation = res.scalars().first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    is_admin = current_user.role == "admin"
    is_guest = reservation.user_id == current_user.id
    is_host = bool(
        reservation.accommodation and reservation.accommodation.host_id == current_user.id
    )

    if not (is_admin or is_guest or is_host):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not have permission to view this reservation",
        )

    return _serialize_reservation(reservation)


@router.get("/{id}/messages", response_model=list[ReservationMessageResponse])
async def list_reservation_messages(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[ReservationMessageResponse]:
    res_stmt = (
        select(Reservation)
        .options(selectinload(Reservation.accommodation))
        .where(Reservation.id == id)
    )
    reservation = (await db.execute(res_stmt)).scalars().first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    is_guest = reservation.user_id == current_user.id
    is_host = bool(
        reservation.accommodation and reservation.accommodation.host_id == current_user.id
    )
    is_admin = current_user.role == "admin"
    if not (is_guest or is_host or is_admin):
        raise HTTPException(status_code=403, detail="Access forbidden")

    if not is_admin:
        unread_stmt = (
            update(ReservationMessage)
            .where(
                ReservationMessage.reservation_id == id,
                ReservationMessage.sender_id != current_user.id,
                ReservationMessage.read_at.is_(None),
            )
            .values(read_at=datetime.now(timezone.utc))
        )
        await db.execute(unread_stmt)
        await db.commit()

    msg_stmt = (
        select(ReservationMessage)
        .options(joinedload(ReservationMessage.sender))
        .where(ReservationMessage.reservation_id == id)
        .order_by(ReservationMessage.created_at.asc(), ReservationMessage.id.asc())
        .offset(skip)
        .limit(limit)
    )
    messages = (await db.execute(msg_stmt)).scalars().all()
    result = []
    for m in messages:
        resp = ReservationMessageResponse.model_validate(m)
        resp.sender_name = (
            f"{m.sender.first_name or ''} {m.sender.last_name or ''}".strip() or m.sender.phone
        )
        result.append(resp)
    return result


@router.post(
    "/{id}/messages",
    response_model=ReservationMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_reservation_message(
    id: int,
    msg_in: ReservationMessageCreate,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> ReservationMessageResponse:
    res_stmt = (
        select(Reservation)
        .options(selectinload(Reservation.accommodation))
        .where(Reservation.id == id)
    )
    reservation = (await db.execute(res_stmt)).scalars().first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    is_guest = reservation.user_id == current_user.id
    is_host = bool(
        reservation.accommodation and reservation.accommodation.host_id == current_user.id
    )
    is_admin = current_user.role == "admin"
    if not (is_guest or is_host or is_admin):
        raise HTTPException(status_code=403, detail="Access forbidden")

    if reservation.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send messages on cancelled bookings",
        )
    if reservation.status not in ("confirmed", "completed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Messages can only be exchanged for confirmed or completed bookings",
        )

    new_msg = ReservationMessage(
        reservation_id=id,
        sender_id=current_user.id,
        message=msg_in.message,
    )
    db.add(new_msg)
    await db.commit()
    await db.refresh(new_msg)

    resp = ReservationMessageResponse.model_validate(new_msg)
    resp.sender_name = (
        f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
        or current_user.phone
    )
    return resp


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

    payout_stmt = select(HostPayout).where(HostPayout.reservation_id == reservation.id)
    payout = (await db.execute(payout_stmt)).scalars().first()
    if payout and payout.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel reservation: Host payout has already been settled and disbursed",
        )

    refundable, penalty, hours_to_checkin = calculate_cancellation_refund(
        reservation,
        reservation.accommodation,
        first_night_price=await get_first_night_price(db, reservation, reservation.accommodation),
    )
    if hours_to_checkin <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel reservation: check-in time has already arrived or passed",
        )

    return CancellationPreviewResponse(
        reservation_id=reservation.id,
        cancellation_policy=getattr(reservation.accommodation, "cancellation_policy", "flexible"),
        cancellation_free_hours=reservation.accommodation.cancellation_free_hours,
        cancellation_penalty_percent=reservation.accommodation.cancellation_penalty_percent,
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
        .options(
            selectinload(Reservation.accommodation),
            selectinload(Reservation.payments),
        )
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

    payout_stmt = (
        select(HostPayout).where(HostPayout.reservation_id == reservation.id).with_for_update()
    )
    payout = (await db.execute(payout_stmt)).scalars().first()
    if payout and payout.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel reservation: Host payout has already been settled and disbursed",
        )

    refundable, penalty, hours_to_checkin = calculate_cancellation_refund(
        reservation,
        reservation.accommodation,
        first_night_price=await get_first_night_price(db, reservation, reservation.accommodation),
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

    # Lock order: Reservation -> HostPayout -> Payment -> Coupon.
    await db.execute(
        select(Payment)
        .where(Payment.reservation_id == reservation.id)
        .with_for_update(of=Payment)
        .execution_options(populate_existing=True)
    )

    for p in reservation.payments:
        if p.status == "pending":
            p.status = "failed"

    if payout and payout.status == "pending":
        if penalty > 0:
            comm = Decimal(round(penalty * settings.PLATFORM_COMMISSION_RATE))
            payout.total_booking_amount = penalty
            payout.commission_amount = comm
            payout.payout_amount = max(Decimal(0), penalty - comm)
        else:
            payout.status = "cancelled"
            payout.total_booking_amount = Decimal(0)
            payout.commission_amount = Decimal(0)
            payout.payout_amount = Decimal(0)

    if refundable > 0:
        refund_record = Payment(
            reservation_id=reservation.id,
            amount=refundable,
            tracking_code=f"REF-{uuid.uuid4().hex[:10].upper()}",
            status="success",
            paid_at=datetime.now(timezone.utc),
        )
        db.add(refund_record)

    if reservation.coupon_code:
        c_obj = await lock_coupon_by_code(db, reservation.coupon_code)
        if c_obj and c_obj.used_count > 0:
            c_obj.used_count -= 1

    await db.commit()
    await db.refresh(reservation)

    return CancellationResponse(
        reservation_id=reservation.id,
        status="cancelled",
        cancellation_policy=getattr(reservation.accommodation, "cancellation_policy", "flexible"),
        hours_to_checkin=hours_to_checkin,
        total_price=reservation.total_price,
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
    stmt = select(Reservation).options(*_RESERVATION_ACCOMMODATION_LOAD)
    if status_filter:
        stmt = stmt.where(Reservation.status == status_filter)
    stmt = (
        stmt.order_by(Reservation.created_at.desc(), Reservation.id.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(stmt)
    reservations = result.scalars().all()

    return [_serialize_reservation(r) for r in reservations]
