"""calendar token version and ical source

Revision ID: 10cfd09553b0
Revises: 94d16e6e59ff
Create Date: 2026-11-12 04:04:46.468381

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "10cfd09553b0"
down_revision: Union[str, Sequence[str], None] = "94d16e6e59ff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the token version and the pricing-exception source allow-list."""
    op.add_column(
        "accommodations",
        sa.Column(
            "calendar_feed_token_version",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "pricing_exceptions",
        sa.Column(
            "source",
            sa.String(length=10),
            server_default="manual",
            nullable=False,
        ),
    )
    op.execute(
        "ALTER TABLE pricing_exceptions ADD CONSTRAINT chk_pricing_exception_source "
        "CHECK (source IN ('manual', 'ical'))"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE pricing_exceptions DROP CONSTRAINT chk_pricing_exception_source"
    )
    op.drop_column("pricing_exceptions", "source")
    op.drop_column("accommodations", "calendar_feed_token_version")
