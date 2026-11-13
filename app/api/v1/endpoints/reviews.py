from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUserDep, SessionDep
from app.core.time import TEHRAN_TZ, now_tehran
from app.models.accommodation import Accommodation
from app.models.reservation import Reservation
from app.models.review import Review
from app.schemas.review import (
    ReviewAuthor,
    ReviewCreate,
    ReviewEligibilityResponse,
    ReviewResponse,
)

router = APIRouter(tags=["reviews"])


@router.get("/accommodations/{accommodation_id}/reviews", response_model=list[ReviewResponse])
async def list_accommodation_reviews(
    accommodation_id: int,
    db: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[ReviewResponse]:
    stmt = (
        select(Review)
        .options(selectinload(Review.user))
        .where(Review.accommodation_id == accommodation_id)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    reviews = result.scalars().all()

    items: list[ReviewResponse] = []
    for r in reviews:
        author = None
        if r.user:
            author = ReviewAuthor(
                id=r.user.id,
                first_name=r.user.first_name,
                last_name=r.user.last_name,
                avatar_url=r.user.avatar_url,
            )
        items.append(
            ReviewResponse(
                id=r.id,
                reservation_id=r.reservation_id,
                user_id=r.user_id,
                accommodation_id=r.accommodation_id,
                rating=r.rating,
                cleanliness_rating=r.cleanliness_rating,
                accuracy_rating=r.accuracy_rating,
                comment=r.comment,
                created_at=r.created_at,
                user=author,
            )
        )
    return items


@router.get(
    "/accommodations/{accommodation_id}/reviews/eligibility",
    response_model=ReviewEligibilityResponse,
)
async def review_eligibility(
    accommodation_id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> ReviewEligibilityResponse:
    """Tell the guest whether they can review this stay right now.

    The UI uses this to surface a direct "write a review" CTA instead of
    hiding the capability inside the trips page.
    """
    acc = (
        (await db.execute(select(Accommodation).where(Accommodation.id == accommodation_id)))
        .scalars()
        .first()
    )
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Accommodation not found",
        )

    reservations = (
        (
            await db.execute(
                select(Reservation)
                .where(
                    Reservation.user_id == current_user.id,
                    Reservation.accommodation_id == accommodation_id,
                    Reservation.status.in_(("confirmed", "completed")),
                )
                .order_by(Reservation.check_out.desc(), Reservation.id.desc())
            )
        )
        .scalars()
        .all()
    )

    if not reservations:
        return ReviewEligibilityResponse(can_review=False, reason="no_stay")

    now_local = now_tehran()
    checkout_times = {
        r.id: datetime.combine(r.check_out, acc.check_out_time).replace(tzinfo=TEHRAN_TZ)
        for r in reservations
    }
    finished = [r for r in reservations if now_local >= checkout_times[r.id]]

    if not finished:
        return ReviewEligibilityResponse(
            can_review=False,
            reservation_id=reservations[0].id,
            reason="stay_not_finished",
        )

    reviewed_ids = set(
        (
            await db.execute(
                select(Review.reservation_id).where(
                    Review.reservation_id.in_([r.id for r in finished])
                )
            )
        )
        .scalars()
        .all()
    )

    for reservation in finished:
        if reservation.id not in reviewed_ids:
            return ReviewEligibilityResponse(
                can_review=True,
                reservation_id=reservation.id,
                reason=None,
            )

    return ReviewEligibilityResponse(
        can_review=False,
        reservation_id=finished[0].id,
        has_review=True,
        reason="already_reviewed",
    )


@router.post(
    "/accommodations/{accommodation_id}/reviews",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_review(
    accommodation_id: int,
    review_in: ReviewCreate,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> ReviewResponse:
    # 1. Verify accommodation exists
    acc = (
        (await db.execute(select(Accommodation).where(Accommodation.id == accommodation_id)))
        .scalars()
        .first()
    )
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Accommodation not found",
        )

    # 2. Proof of stay: Verify reservation
    res_stmt = select(Reservation).where(Reservation.id == review_in.reservation_id)
    reservation = (await db.execute(res_stmt)).scalars().first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation record not found",
        )

    if reservation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only submit a review for your own confirmed reservations",
        )

    if reservation.accommodation_id != accommodation_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reservation does not belong to this accommodation",
        )

    if reservation.status not in ("confirmed", "completed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reviews can only be submitted for confirmed or completed bookings",
        )

    checkout_dt = datetime.combine(
        reservation.check_out, acc.check_out_time
    ).replace(tzinfo=TEHRAN_TZ)
    now_local = now_tehran()
    if now_local < checkout_dt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reviews can only be submitted after check-out time on or after your departure date",
        )

    # 3. Check if already reviewed (Candidate Key constraint)
    existing_stmt = select(Review).where(Review.reservation_id == review_in.reservation_id)
    existing_review = (await db.execute(existing_stmt)).scalars().first()
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A review has already been submitted for this reservation",
        )

    review = Review(
        reservation_id=review_in.reservation_id,
        user_id=current_user.id,
        accommodation_id=accommodation_id,
        rating=review_in.rating,
        cleanliness_rating=review_in.cleanliness_rating,
        accuracy_rating=review_in.accuracy_rating,
        comment=review_in.comment,
    )
    db.add(review)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A review has already been submitted for this reservation",
        )
    await db.refresh(review)

    author = ReviewAuthor(
        id=current_user.id,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        avatar_url=current_user.avatar_url,
    )
    return ReviewResponse(
        id=review.id,
        reservation_id=review.reservation_id,
        user_id=review.user_id,
        accommodation_id=review.accommodation_id,
        rating=review.rating,
        cleanliness_rating=review.cleanliness_rating,
        accuracy_rating=review.accuracy_rating,
        comment=review.comment,
        created_at=review.created_at,
        user=author,
    )
