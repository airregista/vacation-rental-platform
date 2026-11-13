"""one cover image per accommodation

Revision ID: 9a2a9af6d7ed
Revises: de7cd3f6d3a8
Create Date: 2026-11-13 21:12:35.532445

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a2a9af6d7ed'
down_revision: Union[str, Sequence[str], None] = 'de7cd3f6d3a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Keep the lowest (sort_order, id) cover per listing; clear the rest.
    op.execute(
        """
        UPDATE accommodation_images AS img
        SET is_cover = false
        WHERE img.is_cover
          AND img.id <> (
              SELECT keep.id
              FROM accommodation_images AS keep
              WHERE keep.accommodation_id = img.accommodation_id
                AND keep.is_cover
              ORDER BY keep.sort_order, keep.id
              LIMIT 1
          )
        """
    )
    # Give every listing that has images but no cover exactly one: the first
    # image in (sort_order, id) order.
    op.execute(
        """
        UPDATE accommodation_images AS img
        SET is_cover = true
        WHERE img.id = (
            SELECT keep.id
            FROM accommodation_images AS keep
            WHERE keep.accommodation_id = img.accommodation_id
            ORDER BY keep.sort_order, keep.id
            LIMIT 1
        )
          AND NOT EXISTS (
              SELECT 1
              FROM accommodation_images AS cover
              WHERE cover.accommodation_id = img.accommodation_id
                AND cover.is_cover
          )
        """
    )
    op.create_index(
        "uq_accommodation_images_one_cover",
        "accommodation_images",
        ["accommodation_id"],
        unique=True,
        postgresql_where=sa.text("is_cover = true"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_accommodation_images_one_cover",
        table_name="accommodation_images",
        postgresql_where=sa.text("is_cover = true"),
    )
