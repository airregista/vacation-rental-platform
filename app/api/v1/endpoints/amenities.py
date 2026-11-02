from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.dependencies import CurrentAdminDep, SessionDep
from app.models.amenity import Amenity
from app.schemas.amenity import AmenityCreate, AmenityResponse

router = APIRouter(prefix="/amenities", tags=["amenities"])


@router.get("/", response_model=list[AmenityResponse])
async def list_amenities(db: SessionDep) -> list[AmenityResponse]:
    stmt = select(Amenity).order_by(Amenity.id)
    result = await db.execute(stmt)
    amenities = result.scalars().all()
    return [AmenityResponse.model_validate(a) for a in amenities]


@router.post("/", response_model=AmenityResponse, status_code=status.HTTP_201_CREATED)
async def create_amenity(
    amenity_in: AmenityCreate,
    admin: CurrentAdminDep,
    db: SessionDep,
) -> AmenityResponse:
    stmt = select(Amenity).where(Amenity.name == amenity_in.name)
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amenity with this name already exists",
        )

    amenity = Amenity(name=amenity_in.name, icon=amenity_in.icon)
    db.add(amenity)
    await db.commit()
    await db.refresh(amenity)
    return AmenityResponse.model_validate(amenity)
