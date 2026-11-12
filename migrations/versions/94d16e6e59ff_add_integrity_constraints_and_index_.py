"""add integrity constraints and index hygiene

Revision ID: 94d16e6e59ff
Revises: a0acd74630b3
Create Date: 2026-11-12 03:23:57.676189

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "94d16e6e59ff"
down_revision: Union[str, Sequence[str], None] = "a0acd74630b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enforce booking, money, and identity invariants in PostgreSQL."""
    # This revision is the backstop for confirmed stays. Overlapping pending
    # checkouts are intentional; payment confirmation is serialized by the
    # accommodation row lock, and the exclusion constraint only sees confirmed
    # rows. btree_gist is required for the bigint equality operator in GiST.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute(
        """
        ALTER TABLE reservations
        ADD CONSTRAINT ex_reservations_no_overlap
        EXCLUDE USING gist (
            accommodation_id WITH =,
            daterange(check_in, check_out, '[)') WITH &&
        ) WHERE (status = 'confirmed')
        """
    )

    # Identity and contact data
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT chk_users_role "
        "CHECK (role IN ('guest', 'host', 'admin'))"
    )
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT chk_users_phone_format "
        "CHECK (phone ~ '^09[0-9]{9}$')"
    )
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT chk_users_shaba_format "
        "CHECK (shaba_number IS NULL OR shaba_number ~ '^IR[0-9]{24}$')"
    )
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT chk_users_email_lowercase "
        "CHECK (email IS NULL OR email = lower(email))"
    )

    # OTP rows
    op.execute(
        "ALTER TABLE otp_codes ADD CONSTRAINT chk_otp_code_format "
        "CHECK (code ~ '^[0-9]{4,6}$')"
    )
    op.execute(
        "ALTER TABLE otp_codes ADD CONSTRAINT chk_otp_expiry_after_creation "
        "CHECK (expires_at > created_at)"
    )

    # Coupons. The DB constraint is strict; CouponCreate rejects equal
    # timestamps so an API request never reaches this constraint with a 500.
    op.execute(
        "ALTER TABLE coupons ADD CONSTRAINT chk_coupon_validity_range "
        "CHECK (valid_until > valid_from)"
    )
    op.execute(
        "ALTER TABLE coupons ADD CONSTRAINT chk_coupon_used_count "
        "CHECK (used_count >= 0)"
    )
    op.execute(
        "ALTER TABLE coupons ADD CONSTRAINT chk_coupon_usage_limit "
        "CHECK (usage_limit IS NULL OR usage_limit > 0)"
    )
    op.execute(
        "ALTER TABLE coupons ADD CONSTRAINT chk_coupon_percentage_range "
        "CHECK (discount_type <> 'percentage' OR discount_value <= 100)"
    )
    op.execute(
        "ALTER TABLE coupons ADD CONSTRAINT chk_coupon_max_discount "
        "CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0)"
    )

    # Reservation money and date arithmetic
    op.execute(
        "ALTER TABLE reservations ADD CONSTRAINT chk_reservation_refund_non_negative "
        "CHECK (refund_amount IS NULL OR refund_amount >= 0)"
    )
    op.execute(
        "ALTER TABLE reservations ADD CONSTRAINT chk_reservation_penalty_non_negative "
        "CHECK (penalty_amount IS NULL OR penalty_amount >= 0)"
    )
    op.execute(
        "ALTER TABLE reservations ADD CONSTRAINT chk_reservation_refund_penalty_total "
        "CHECK (coalesce(refund_amount, 0) + coalesce(penalty_amount, 0) <= total_price)"
    )
    op.execute(
        "ALTER TABLE reservations ADD CONSTRAINT chk_reservation_total_nights_matches_dates "
        "CHECK (total_nights = (check_out - check_in)) NOT VALID"
    )
    op.execute(
        "ALTER TABLE reservations VALIDATE CONSTRAINT "
        "chk_reservation_total_nights_matches_dates"
    )

    # Payout arithmetic
    op.execute(
        "ALTER TABLE host_payouts ADD CONSTRAINT chk_payout_arithmetic "
        "CHECK (total_booking_amount = commission_amount + payout_amount)"
    )

    # Coordinates and room counts
    op.execute(
        "ALTER TABLE accommodations ADD CONSTRAINT chk_accommodation_latitude "
        "CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90))"
    )
    op.execute(
        "ALTER TABLE accommodations ADD CONSTRAINT chk_accommodation_longitude "
        "CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))"
    )
    op.execute(
        "ALTER TABLE accommodations ADD CONSTRAINT chk_accommodation_rooms_count "
        "CHECK (rooms_count >= 0)"
    )
    op.execute(
        "ALTER TABLE accommodations ADD CONSTRAINT chk_accommodation_beds_count "
        "CHECK (beds_count >= 0)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE accommodations DROP CONSTRAINT chk_accommodation_beds_count")
    op.execute("ALTER TABLE accommodations DROP CONSTRAINT chk_accommodation_rooms_count")
    op.execute("ALTER TABLE accommodations DROP CONSTRAINT chk_accommodation_longitude")
    op.execute("ALTER TABLE accommodations DROP CONSTRAINT chk_accommodation_latitude")
    op.execute("ALTER TABLE host_payouts DROP CONSTRAINT chk_payout_arithmetic")
    op.execute(
        "ALTER TABLE reservations DROP CONSTRAINT chk_reservation_total_nights_matches_dates"
    )
    op.execute("ALTER TABLE reservations DROP CONSTRAINT chk_reservation_refund_penalty_total")
    op.execute("ALTER TABLE reservations DROP CONSTRAINT chk_reservation_penalty_non_negative")
    op.execute("ALTER TABLE reservations DROP CONSTRAINT chk_reservation_refund_non_negative")
    op.execute("ALTER TABLE coupons DROP CONSTRAINT chk_coupon_max_discount")
    op.execute("ALTER TABLE coupons DROP CONSTRAINT chk_coupon_percentage_range")
    op.execute("ALTER TABLE coupons DROP CONSTRAINT chk_coupon_usage_limit")
    op.execute("ALTER TABLE coupons DROP CONSTRAINT chk_coupon_used_count")
    op.execute("ALTER TABLE coupons DROP CONSTRAINT chk_coupon_validity_range")
    op.execute("ALTER TABLE otp_codes DROP CONSTRAINT chk_otp_expiry_after_creation")
    op.execute("ALTER TABLE otp_codes DROP CONSTRAINT chk_otp_code_format")
    op.execute("ALTER TABLE users DROP CONSTRAINT chk_users_email_lowercase")
    op.execute("ALTER TABLE users DROP CONSTRAINT chk_users_shaba_format")
    op.execute("ALTER TABLE users DROP CONSTRAINT chk_users_phone_format")
    op.execute("ALTER TABLE users DROP CONSTRAINT chk_users_role")
    op.execute("ALTER TABLE reservations DROP CONSTRAINT ex_reservations_no_overlap")
