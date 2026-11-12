"""add custom cancellation policy fields

Revision ID: f4b8c2d9a1e7
Revises: e6f1a2b3c4d5
Create Date: 2026-11-12 09:30:00.000000

Hosts can now define their own cancellation window and penalty percentage.
The two columns are meaningful only for ``cancellation_policy = 'custom'``
but stay non-null with sane defaults so existing rows remain valid.

The operations are idempotent because some local databases were created with
``create_all`` and never received the baseline check constraint.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "f4b8c2d9a1e7"
down_revision: Union[str, Sequence[str], None] = "e6f1a2b3c4d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE accommodations "
        "DROP CONSTRAINT IF EXISTS chk_accommodation_cancellation_policy"
    )
    op.execute(
        "ALTER TABLE accommodations "
        "ADD COLUMN IF NOT EXISTS cancellation_free_hours integer "
        "NOT NULL DEFAULT 24"
    )
    op.execute(
        "ALTER TABLE accommodations "
        "ADD COLUMN IF NOT EXISTS cancellation_penalty_percent numeric(5, 2) "
        "NOT NULL DEFAULT 50"
    )
    op.execute(
        "ALTER TABLE accommodations "
        "DROP CONSTRAINT IF EXISTS chk_accommodation_cancellation_free_hours"
    )
    op.execute(
        "ALTER TABLE accommodations "
        "ADD CONSTRAINT chk_accommodation_cancellation_free_hours "
        "CHECK (cancellation_free_hours >= 0)"
    )
    op.execute(
        "ALTER TABLE accommodations "
        "DROP CONSTRAINT IF EXISTS chk_accommodation_cancellation_penalty_percent"
    )
    op.execute(
        "ALTER TABLE accommodations "
        "ADD CONSTRAINT chk_accommodation_cancellation_penalty_percent "
        "CHECK (cancellation_penalty_percent >= 0 "
        "AND cancellation_penalty_percent <= 100)"
    )
    op.execute(
        "ALTER TABLE accommodations "
        "ADD CONSTRAINT chk_accommodation_cancellation_policy "
        "CHECK (cancellation_policy IN "
        "('flexible', 'moderate', 'strict', 'custom'))"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE accommodations "
        "DROP CONSTRAINT IF EXISTS chk_accommodation_cancellation_penalty_percent"
    )
    op.execute(
        "ALTER TABLE accommodations "
        "DROP CONSTRAINT IF EXISTS chk_accommodation_cancellation_free_hours"
    )
    op.execute(
        "ALTER TABLE accommodations "
        "DROP CONSTRAINT IF EXISTS chk_accommodation_cancellation_policy"
    )
    op.execute(
        "ALTER TABLE accommodations "
        "DROP COLUMN IF EXISTS cancellation_penalty_percent"
    )
    op.execute(
        "ALTER TABLE accommodations DROP COLUMN IF EXISTS cancellation_free_hours"
    )
    op.execute(
        "ALTER TABLE accommodations "
        "ADD CONSTRAINT chk_accommodation_cancellation_policy "
        "CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict'))"
    )
