"""pricing exception block ownership flags

Revision ID: f9780f538306
Revises: 10cfd09553b0
Create Date: 2026-11-12 05:12:00.000000

Replace the single ``source`` tag with two independent block flags. A row can
be blocked by the host, by an iCal feed, or by both; the sync can then clear
only the iCal half without unblocking a manual block.

Backfill policy: before this revision there is no way to tell a host-created
block from an old iCal block once the ``source`` default has labeled both
``manual``. The migration deliberately preserves every existing block as
``manual_blocked`` so no date becomes bookable by accident. Hosts can delete a
stale legacy block through the normal pricing-exception endpoint; every sync
from this revision onward tracks iCal ownership explicitly.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f9780f538306"
down_revision: Union[str, Sequence[str], None] = "10cfd09553b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Split the iCal/manual ownership into independent boolean flags."""
    op.add_column(
        "pricing_exceptions",
        sa.Column(
            "manual_blocked",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
    )
    op.add_column(
        "pricing_exceptions",
        sa.Column(
            "ical_blocked",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
    )
    # source='ical' rows were written by the sync; source='manual' rows cover
    # host blocks and legacy rows whose source default was applied. Preserve
    # the blocking state in both cases.
    op.execute(
        "UPDATE pricing_exceptions SET ical_blocked = is_blocked "
        "WHERE source = 'ical'"
    )
    op.execute(
        "UPDATE pricing_exceptions SET manual_blocked = is_blocked "
        "WHERE source = 'manual'"
    )
    op.execute(
        "ALTER TABLE pricing_exceptions "
        "ADD CONSTRAINT chk_pricing_exception_block_flags "
        "CHECK (is_blocked = (manual_blocked OR ical_blocked))"
    )
    op.execute(
        "ALTER TABLE pricing_exceptions DROP CONSTRAINT chk_pricing_exception_source"
    )
    op.drop_column("pricing_exceptions", "source")


def downgrade() -> None:
    """Collapse the flags back into the single source tag."""
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
        "UPDATE pricing_exceptions SET source = 'ical' WHERE ical_blocked"
    )
    op.execute(
        "ALTER TABLE pricing_exceptions "
        "DROP CONSTRAINT chk_pricing_exception_block_flags"
    )
    op.execute(
        "ALTER TABLE pricing_exceptions "
        "ADD CONSTRAINT chk_pricing_exception_source "
        "CHECK (source IN ('manual', 'ical'))"
    )
    op.drop_column("pricing_exceptions", "ical_blocked")
    op.drop_column("pricing_exceptions", "manual_blocked")
