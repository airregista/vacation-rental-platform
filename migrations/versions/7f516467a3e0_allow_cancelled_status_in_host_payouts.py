"""allow_cancelled_status_in_host_payouts

Revision ID: 7f516467a3e0
Revises: b0055d33fb96
Create Date: 2026-11-04 19:46:28.311730

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f516467a3e0'
down_revision: Union[str, Sequence[str], None] = 'b0055d33fb96'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint('chk_payout_status', 'host_payouts', type_='check')
    op.create_check_constraint(
        'chk_payout_status',
        'host_payouts',
        "status IN ('pending', 'completed', 'cancelled')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('chk_payout_status', 'host_payouts', type_='check')
    op.create_check_constraint(
        'chk_payout_status',
        'host_payouts',
        "status IN ('pending', 'completed')",
    )
