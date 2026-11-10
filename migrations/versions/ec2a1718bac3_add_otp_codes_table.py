"""add otp_codes table

Revision ID: ec2a1718bac3
Revises: 7f516467a3e0
Create Date: 2026-11-10 19:02:49

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec2a1718bac3'
down_revision: Union[str, Sequence[str], None] = '7f516467a3e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'otp_codes',
        sa.Column('phone', sa.String(length=15), nullable=False),
        sa.Column('code', sa.String(length=6), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('phone'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('otp_codes')
