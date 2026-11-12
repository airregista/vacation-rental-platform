"""generate pricing exception is_blocked

Revision ID: e6f1a2b3c4d5
Revises: c3a9d1e5f7b2
Create Date: 2026-11-12 06:45:00.000000

``is_blocked`` is derived from ``manual_blocked OR ical_blocked``. Let PostgreSQL
compute and store it so the two flags can never drift apart.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e6f1a2b3c4d5"
down_revision: Union[str, Sequence[str], None] = "c3a9d1e5f7b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_pricing_exceptions_blocked", table_name="pricing_exceptions")
    op.drop_constraint(
        "chk_pricing_exception_block_flags", "pricing_exceptions", type_="check"
    )
    op.drop_column("pricing_exceptions", "is_blocked")
    op.add_column(
        "pricing_exceptions",
        sa.Column(
            "is_blocked",
            sa.Boolean(),
            sa.Computed("manual_blocked OR ical_blocked", persisted=True),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_pricing_exceptions_blocked",
        "pricing_exceptions",
        ["accommodation_id", "date"],
        postgresql_where=sa.text("is_blocked = true"),
    )


def downgrade() -> None:
    op.drop_index("ix_pricing_exceptions_blocked", table_name="pricing_exceptions")
    op.drop_column("pricing_exceptions", "is_blocked")
    op.add_column(
        "pricing_exceptions",
        sa.Column("is_blocked", sa.Boolean(), nullable=True),
    )
    op.execute(
        "UPDATE pricing_exceptions SET is_blocked = (manual_blocked OR ical_blocked)"
    )
    op.alter_column("pricing_exceptions", "is_blocked", nullable=False)
    op.create_check_constraint(
        "chk_pricing_exception_block_flags",
        "pricing_exceptions",
        "is_blocked = (manual_blocked OR ical_blocked)",
    )
    op.create_index(
        "ix_pricing_exceptions_blocked",
        "pricing_exceptions",
        ["accommodation_id", "date"],
        postgresql_where=sa.text("is_blocked = true"),
    )
