"""add_coupon_code_to_reservations

Revision ID: 5f6cdae56758
Revises: 7e95aafee451
Create Date: 2026-11-03 17:53:40.881836

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5f6cdae56758'
down_revision: Union[str, Sequence[str], None] = '7e95aafee451'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('reservations', sa.Column('coupon_code', sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column('reservations', 'coupon_code')
