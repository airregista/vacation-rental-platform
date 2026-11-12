"""unique pending payment per reservation

Revision ID: c3a9d1e5f7b2
Revises: f9780f538306
Create Date: 2026-11-12 06:30:00.000000

Only one ``pending`` payment may exist per reservation. Historical failed or
successful payments are unconstrained, so retries stay possible.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3a9d1e5f7b2"
down_revision: Union[str, Sequence[str], None] = "f9780f538306"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    duplicates = op.get_bind().execute(
        sa.text(
            """
            SELECT reservation_id, count(*) AS payment_count
            FROM payments
            WHERE status = 'pending'
            GROUP BY reservation_id
            HAVING count(*) > 1
            """
        )
    ).all()
    if duplicates:
        details = ", ".join(f"reservation {row[0]}: {row[1]} pending" for row in duplicates)
        raise RuntimeError(
            "Cannot create the unique pending-payment index; resolve duplicates first: "
            + details
        )

    op.create_index(
        "uq_payments_pending_reservation",
        "payments",
        ["reservation_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index("uq_payments_pending_reservation", table_name="payments")
