"""reconcile schema drift

Revision ID: a0acd74630b3
Revises: ec2a1718bac3
Create Date: 2026-11-12 03:04:53.533371

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a0acd74630b3'
down_revision: Union[str, Sequence[str], None] = 'ec2a1718bac3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Bring a migration-built database in line with the SQLAlchemy models.

    This is a one-way reconciliation. The baseline is historical and must not
    be edited; every future database is built by running the full chain.
    """
    op.execute("ALTER TABLE provinces ALTER COLUMN name TYPE varchar(50)")
    op.execute("ALTER TABLE cities ALTER COLUMN name TYPE varchar(50)")
    op.execute("ALTER TABLE categories ALTER COLUMN title TYPE varchar(50)")
    op.execute("ALTER TABLE categories ALTER COLUMN slug TYPE varchar(50)")
    op.execute("ALTER TABLE amenities ALTER COLUMN name TYPE varchar(50)")

    op.execute("ALTER TABLE cities DROP CONSTRAINT IF EXISTS uq_province_city_name")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uq_city_province_name'
                  AND conrelid = 'cities'::regclass
            ) THEN
                ALTER TABLE cities
                    ADD CONSTRAINT uq_city_province_name UNIQUE (province_id, name);
            END IF;
        END $$;
        """
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_accommodation_amenities_amenity_id "
        "ON accommodation_amenities (amenity_id)"
    )

    op.execute("ALTER TABLE accommodation_images DROP COLUMN IF EXISTS created_at")
    op.execute("DROP INDEX IF EXISTS ix_accommodation_images_is_cover")
    op.execute("ALTER TABLE accommodation_images ALTER COLUMN sort_order TYPE integer")
    op.execute("ALTER TABLE accommodation_images ALTER COLUMN is_cover DROP DEFAULT")
    op.execute("ALTER TABLE accommodation_images ALTER COLUMN sort_order DROP DEFAULT")

    op.execute("ALTER TABLE pricing_exceptions DROP COLUMN IF EXISTS created_at")
    op.execute("DROP INDEX IF EXISTS ix_pricing_exceptions_date")
    op.execute("ALTER TABLE pricing_exceptions ALTER COLUMN is_blocked DROP DEFAULT")

    op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT")
    op.execute("DROP INDEX IF EXISTS ix_wishlists_user_id")


def downgrade() -> None:
    # The pre-reconciliation schema is not a supported target. Recreate the
    # database from the chain instead of downgrading through this revision.
    pass
