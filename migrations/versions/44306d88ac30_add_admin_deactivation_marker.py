"""add admin deactivation marker

Revision ID: 44306d88ac30
Revises: b3d7e9f1a2c4
Create Date: 2026-11-13 20:12:03.144306

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '44306d88ac30'
down_revision: Union[str, Sequence[str], None] = 'b3d7e9f1a2c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "accommodations",
        sa.Column("admin_deactivated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("accommodations", "admin_deactivated_at")
