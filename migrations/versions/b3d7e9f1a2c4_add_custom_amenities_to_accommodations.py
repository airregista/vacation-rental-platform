"""add custom_amenities to accommodations

Revision ID: b3d7e9f1a2c4
Revises: f4b8c2d9a1e7
Create Date: 2026-11-13 10:00:00.000000

Per-listing free-text amenities, stored as a JSON array of strings.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b3d7e9f1a2c4"
down_revision: Union[str, Sequence[str], None] = "f4b8c2d9a1e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "accommodations",
        sa.Column(
            "custom_amenities",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("accommodations", "custom_amenities")
