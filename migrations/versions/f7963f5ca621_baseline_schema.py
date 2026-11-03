"""baseline_schema

Revision ID: f7963f5ca621
Revises: 
Create Date: 2026-11-03 01:11:23.100021

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'f7963f5ca621'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('phone', sa.String(15), unique=True, index=True, nullable=False),
        sa.Column('email', sa.String(100), unique=True, index=True, nullable=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('first_name', sa.String(50), nullable=True),
        sa.Column('last_name', sa.String(50), nullable=True),
        sa.Column('role', sa.String(20), server_default='guest', nullable=False),
        sa.Column('avatar_url', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 2. provinces
    op.create_table(
        'provinces',
        sa.Column('id', sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column('name', sa.String(100), unique=True, nullable=False),
    )

    # 3. cities
    op.create_table(
        'cities',
        sa.Column('id', sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column('province_id', sa.Integer(), sa.ForeignKey('provinces.id', ondelete='RESTRICT'), index=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.UniqueConstraint('province_id', 'name', name='uq_province_city_name'),
    )

    # 4. categories
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column('title', sa.String(100), unique=True, nullable=False),
        sa.Column('slug', sa.String(100), unique=True, index=True, nullable=False),
        sa.Column('icon_url', sa.String(255), nullable=True),
    )

    # 5. amenities
    op.create_table(
        'amenities',
        sa.Column('id', sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column('name', sa.String(100), unique=True, nullable=False),
        sa.Column('icon', sa.String(50), nullable=True),
    )

    # 6. accommodations
    op.create_table(
        'accommodations',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('host_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='RESTRICT'), index=True, nullable=False),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id', ondelete='RESTRICT'), index=True, nullable=False),
        sa.Column('city_id', sa.Integer(), sa.ForeignKey('cities.id', ondelete='RESTRICT'), index=True, nullable=False),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('address', sa.String(255), nullable=False),
        sa.Column('latitude', sa.Numeric(10, 7), nullable=True),
        sa.Column('longitude', sa.Numeric(10, 7), nullable=True),
        sa.Column('base_price', sa.Numeric(12, 0), nullable=False),
        sa.Column('cleaning_fee', sa.Numeric(10, 0), server_default='0', nullable=False),
        sa.Column('capacity', sa.SmallInteger(), server_default='2', nullable=False),
        sa.Column('max_capacity', sa.SmallInteger(), server_default='4', nullable=False),
        sa.Column('extra_guest_fee', sa.Numeric(10, 0), server_default='0', nullable=False),
        sa.Column('rooms_count', sa.SmallInteger(), server_default='1', nullable=False),
        sa.Column('beds_count', sa.SmallInteger(), server_default='1', nullable=False),
        sa.Column('check_in_time', sa.Time(), server_default='14:00', nullable=False),
        sa.Column('check_out_time', sa.Time(), server_default='12:00', nullable=False),
        sa.Column('rules', sa.Text(), nullable=True),
        sa.Column('cancellation_policy', sa.String(20), server_default='flexible', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', index=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint('base_price >= 0', name='chk_accommodation_base_price'),
        sa.CheckConstraint('cleaning_fee >= 0', name='chk_accommodation_cleaning_fee'),
        sa.CheckConstraint('extra_guest_fee >= 0', name='chk_accommodation_extra_guest_fee'),
        sa.CheckConstraint('capacity > 0', name='chk_accommodation_capacity'),
        sa.CheckConstraint('max_capacity >= capacity', name='chk_accommodation_max_capacity'),
        sa.CheckConstraint("cancellation_policy IN ('flexible', 'moderate', 'strict')", name='chk_accommodation_cancellation_policy'),
    )
    op.create_index('ix_accommodations_active_created', 'accommodations', ['is_active', 'created_at'])
    op.create_index('ix_accommodations_active_city_price', 'accommodations', ['is_active', 'city_id', 'base_price'])

    # 7. accommodation_amenities
    op.create_table(
        'accommodation_amenities',
        sa.Column('accommodation_id', sa.BigInteger(), sa.ForeignKey('accommodations.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('amenity_id', sa.Integer(), sa.ForeignKey('amenities.id', ondelete='CASCADE'), primary_key=True),
    )

    # 8. accommodation_images
    op.create_table(
        'accommodation_images',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('accommodation_id', sa.BigInteger(), sa.ForeignKey('accommodations.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('image_url', sa.String(255), nullable=False),
        sa.Column('is_cover', sa.Boolean(), server_default='false', index=True, nullable=False),
        sa.Column('sort_order', sa.SmallInteger(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 9. pricing_exceptions
    op.create_table(
        'pricing_exceptions',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('accommodation_id', sa.BigInteger(), sa.ForeignKey('accommodations.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('date', sa.Date(), index=True, nullable=False),
        sa.Column('price', sa.Numeric(12, 0), nullable=True),
        sa.Column('is_blocked', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('accommodation_id', 'date', name='uq_pricing_exception_accommodation_date'),
        sa.CheckConstraint('price IS NULL OR price >= 0', name='chk_pricing_exception_price'),
    )

    # 10. reservations
    op.create_table(
        'reservations',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='RESTRICT'), index=True, nullable=False),
        sa.Column('accommodation_id', sa.BigInteger(), sa.ForeignKey('accommodations.id', ondelete='RESTRICT'), index=True, nullable=False),
        sa.Column('check_in', sa.Date(), nullable=False),
        sa.Column('check_out', sa.Date(), nullable=False),
        sa.Column('guests_count', sa.SmallInteger(), nullable=False),
        sa.Column('total_nights', sa.Integer(), nullable=False),
        sa.Column('total_price', sa.Numeric(12, 0), nullable=False),
        sa.Column('status', sa.String(20), server_default='pending', index=True, nullable=False),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('refund_amount', sa.Numeric(12, 0), nullable=True),
        sa.Column('penalty_amount', sa.Numeric(12, 0), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint('check_out > check_in', name='chk_reservation_dates'),
        sa.CheckConstraint('guests_count > 0', name='chk_reservation_guests_count'),
        sa.CheckConstraint('total_nights > 0', name='chk_reservation_total_nights'),
        sa.CheckConstraint('total_price >= 0', name='chk_reservation_total_price'),
        sa.CheckConstraint("status IN ('pending', 'confirmed', 'cancelled', 'completed')", name='chk_reservation_status'),
    )
    op.create_index('ix_reservations_overlap', 'reservations', ['accommodation_id', 'status', 'check_in', 'check_out'])

    # 11. payments
    op.create_table(
        'payments',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('reservation_id', sa.BigInteger(), sa.ForeignKey('reservations.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('amount', sa.Numeric(12, 0), nullable=False),
        sa.Column('tracking_code', sa.String(100), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending', index=True, nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint('amount > 0', name='chk_payment_amount'),
        sa.CheckConstraint("status IN ('pending', 'success', 'failed')", name='chk_payment_status'),
    )

    # 12. reviews
    op.create_table(
        'reviews',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('reservation_id', sa.BigInteger(), sa.ForeignKey('reservations.id', ondelete='RESTRICT'), unique=True, index=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='RESTRICT'), index=True, nullable=False),
        sa.Column('accommodation_id', sa.BigInteger(), sa.ForeignKey('accommodations.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('rating', sa.SmallInteger(), nullable=False),
        sa.Column('cleanliness_rating', sa.SmallInteger(), nullable=True),
        sa.Column('accuracy_rating', sa.SmallInteger(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='chk_review_rating'),
        sa.CheckConstraint('cleanliness_rating IS NULL OR (cleanliness_rating >= 1 AND cleanliness_rating <= 5)', name='chk_review_cleanliness_rating'),
        sa.CheckConstraint('accuracy_rating IS NULL OR (accuracy_rating >= 1 AND accuracy_rating <= 5)', name='chk_review_accuracy_rating'),
    )

    # 13. wishlists
    op.create_table(
        'wishlists',
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True, index=True),
        sa.Column('accommodation_id', sa.BigInteger(), sa.ForeignKey('accommodations.id', ondelete='CASCADE'), primary_key=True, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('wishlists')
    op.drop_table('reviews')
    op.drop_table('payments')
    op.drop_table('reservations')
    op.drop_table('pricing_exceptions')
    op.drop_table('accommodation_images')
    op.drop_table('accommodation_amenities')
    op.drop_table('accommodations')
    op.drop_table('amenities')
    op.drop_table('categories')
    op.drop_table('cities')
    op.drop_table('provinces')
    op.drop_table('users')
