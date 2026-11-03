import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUserDep, SessionDep
from app.models.accommodation import Accommodation
from app.models.payment import Payment
from app.models.reservation import Reservation
from app.schemas.payment import (
    PaymentInitiateRequest,
    PaymentInitiateResponse,
    PaymentResponse,
    PaymentVerifyRequest,
)
from app.services.reservation_service import check_booking_overlap

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post(
    "/checkout", response_model=PaymentInitiateResponse, status_code=status.HTTP_201_CREATED
)
async def checkout_payment(
    req: PaymentInitiateRequest,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> PaymentInitiateResponse:
    stmt = (
        select(Reservation)
        .options(selectinload(Reservation.accommodation), selectinload(Reservation.payments))
        .where(Reservation.id == req.reservation_id)
    )
    res = await db.execute(stmt)
    reservation = res.scalars().first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found",
        )

    if current_user.role != "admin" and reservation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    if reservation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot initiate payment for reservation with status '{reservation.status}'. Only 'pending' allowed.",
        )

    res_created = reservation.created_at
    if res_created.tzinfo is None:
        res_created = res_created.replace(tzinfo=timezone.utc)
    if res_created < datetime.now(timezone.utc) - timedelta(minutes=30):
        reservation.status = "cancelled"
        reservation.cancellation_reason = "Payment session expired (TTL timeout)"
        reservation.cancelled_at = datetime.now(timezone.utc)
        for p in reservation.payments:
            if p.status == "pending":
                p.status = "failed"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reservation has expired due to payment timeout. Please create a new booking.",
        )

    tracking_code = f"SHP-{uuid.uuid4().hex[:12].upper()}"
    payment = Payment(
        reservation_id=reservation.id,
        amount=reservation.total_price,
        tracking_code=tracking_code,
        status="pending",
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    return PaymentInitiateResponse(
        payment_id=payment.id,
        reservation_id=reservation.id,
        amount=payment.amount,
        tracking_code=tracking_code,
        gateway_url=f"https://shaparak.mock/pay?token={tracking_code}",
    )


@router.post("/verify", response_model=PaymentResponse)
async def verify_payment(
    req: PaymentVerifyRequest,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> PaymentResponse:
    stmt = (
        select(Payment)
        .options(selectinload(Payment.reservation))
        .where(Payment.id == req.payment_id)
        .with_for_update(of=Payment)
    )
    res = await db.execute(stmt)
    payment = res.scalars().first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found"
        )

    reservation = payment.reservation
    if current_user.role != "admin" and reservation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    if payment.status == "success":
        return PaymentResponse.model_validate(payment)

    if payment.tracking_code and req.tracking_code != payment.tracking_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tracking code for this payment",
        )

    if payment.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment is already in '{payment.status}' state",
        )

    if reservation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Reservation is no longer pending (current status: {reservation.status})",
        )

    res_created = reservation.created_at
    if res_created.tzinfo is None:
        res_created = res_created.replace(tzinfo=timezone.utc)
    if res_created < datetime.now(timezone.utc) - timedelta(minutes=30):
        reservation.status = "cancelled"
        reservation.cancellation_reason = "Payment session expired (TTL timeout)"
        reservation.cancelled_at = datetime.now(timezone.utc)
        payment.status = "failed"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reservation has expired due to payment timeout. Please create a new booking.",
        )

    if req.simulate_success:
        # Lock parent accommodation to serialize concurrent confirmations for this property
        acc_stmt = (
            select(Accommodation)
            .where(Accommodation.id == reservation.accommodation_id)
            .with_for_update(of=Accommodation)
        )
        await db.execute(acc_stmt)

        # Re-verify no conflicting confirmed reservation exists
        is_conflict = await check_booking_overlap(
            db=db,
            accommodation_id=reservation.accommodation_id,
            check_in=reservation.check_in,
            check_out=reservation.check_out,
            exclude_reservation_id=reservation.id,
        )
        if is_conflict:
            payment.status = "failed"
            await db.commit()  # Persist failed payment state before raising
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Dates are no longer available. Another booking was confirmed while payment was processing.",
            )

        payment.status = "success"
        payment.paid_at = datetime.now(timezone.utc)
        reservation.status = "confirmed"
    else:
        payment.status = "failed"

    await db.commit()
    await db.refresh(payment)
    return PaymentResponse.model_validate(payment)


@router.get("/my", response_model=list[PaymentResponse])
async def list_my_payments(
    current_user: CurrentUserDep,
    db: SessionDep,
) -> list[PaymentResponse]:
    stmt = (
        select(Payment)
        .join(Payment.reservation)
        .where(Reservation.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
    )
    result = await db.execute(stmt)
    payments = result.scalars().all()
    return [PaymentResponse.model_validate(p) for p in payments]


@router.get("/{id}", response_model=PaymentResponse)
async def get_payment(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> PaymentResponse:
    stmt = select(Payment).options(selectinload(Payment.reservation)).where(Payment.id == id)
    res = await db.execute(stmt)
    payment = res.scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    if current_user.role != "admin" and payment.reservation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    return PaymentResponse.model_validate(payment)
