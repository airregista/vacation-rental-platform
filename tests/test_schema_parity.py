import pytest
from sqlalchemy import text
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.schema import CreateTable

from app.core.database import AsyncSessionLocal
from app.models.reservation import Reservation


def test_orm_metadata_declares_no_overlap_constraint() -> None:
    constraints = [
        constraint
        for constraint in Reservation.__table__.constraints
        if isinstance(constraint, ExcludeConstraint)
    ]
    assert [constraint.name for constraint in constraints] == ["ex_reservations_no_overlap"]

    constraint = constraints[0]
    assert constraint.using == "gist"
    assert "status = 'confirmed'" in str(constraint.where)

    ddl = str(CreateTable(Reservation.__table__).compile(dialect=postgresql.dialect()))
    assert "EXCLUDE USING gist" in ddl
    assert "daterange(check_in, check_out, '[)'" in ddl
    assert "WITH &&" in ddl


@pytest.mark.asyncio
async def test_live_constraint_matches_orm_declaration() -> None:
    async with AsyncSessionLocal() as session:
        definition = (
            await session.execute(
                text(
                    "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                    "WHERE conname = 'ex_reservations_no_overlap'"
                )
            )
        ).scalar_one()

    assert "EXCLUDE USING gist" in definition
    assert "accommodation_id WITH =" in definition
    assert "daterange(check_in, check_out, '[)'" in definition
    assert "WITH &&" in definition
    assert "status" in definition
    assert "confirmed" in definition
