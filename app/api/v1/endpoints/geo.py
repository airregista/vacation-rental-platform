from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentAdminDep, SessionDep
from app.models.geo import City, Province
from app.schemas.geo import CityCreate, CityResponse, ProvinceCreate, ProvinceResponse

router = APIRouter(prefix="/geo", tags=["geography"])


@router.get("/provinces", response_model=list[ProvinceResponse])
async def list_provinces(db: SessionDep) -> list[ProvinceResponse]:
    stmt = select(Province).order_by(Province.name)
    result = await db.execute(stmt)
    provinces = result.scalars().all()
    return [ProvinceResponse.model_validate(p) for p in provinces]


@router.post("/provinces", response_model=ProvinceResponse, status_code=status.HTTP_201_CREATED)
async def create_province(
    province_in: ProvinceCreate,
    admin: CurrentAdminDep,
    db: SessionDep,
) -> ProvinceResponse:
    stmt = select(Province).where(Province.name == province_in.name)
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A province with this name already exists",
        )
    province = Province(name=province_in.name)
    db.add(province)
    await db.commit()
    await db.refresh(province)
    return ProvinceResponse.model_validate(province)


@router.get("/cities", response_model=list[CityResponse])
async def list_cities(
    db: SessionDep,
    province_id: int | None = Query(default=None, description="Filter cities by province ID"),
) -> list[CityResponse]:
    stmt = select(City).options(selectinload(City.province)).order_by(City.name)
    if province_id is not None:
        stmt = stmt.where(City.province_id == province_id)
    result = await db.execute(stmt)
    cities = result.scalars().all()
    return [CityResponse.model_validate(c) for c in cities]


@router.post("/cities", response_model=CityResponse, status_code=status.HTTP_201_CREATED)
async def create_city(
    city_in: CityCreate,
    admin: CurrentAdminDep,
    db: SessionDep,
) -> CityResponse:
    # Verify province exists
    prov_stmt = select(Province).where(Province.id == city_in.province_id)
    prov_res = await db.execute(prov_stmt)
    province = prov_res.scalars().first()
    if not province:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Province with specified ID not found",
        )

    # Check unique city within province
    stmt = select(City).where(
        City.province_id == city_in.province_id,
        City.name == city_in.name,
    )
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="City with this name already exists in this province",
        )

    city = City(province_id=city_in.province_id, name=city_in.name)
    db.add(city)
    await db.commit()
    await db.refresh(city)
    city.province = province
    return CityResponse.model_validate(city)
