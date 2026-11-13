"""add payment type

Revision ID: de7cd3f6d3a8
Revises: 44306d88ac30
Create Date: 2026-11-13 20:58:01.334897

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'de7cd3f6d3a8'
down_revision: Union[str, Sequence[str], None] = '44306d88ac30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payments",
        sa.Column(
            "payment_type",
            sa.String(length=10),
            server_default="charge",
            nullable=False,
        ),
    )
    # Backfill the only refund convention that existed before this column.
    op.execute(
        "UPDATE payments SET payment_type = 'refund' "
        "WHERE tracking_code LIKE 'REF-%'"
    )
    op.create_check_constraint(
        "chk_payment_type", "payments", "payment_type IN ('charge', 'refund')"
    )


def downgrade() -> None:
    op.drop_constraint("chk_payment_type", "payments", type_="check")
    op.drop_column("payments", "payment_type")
