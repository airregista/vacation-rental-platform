from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentAdminDep, SessionDep
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryResponse])
async def list_categories(db: SessionDep) -> list[CategoryResponse]:
    stmt = select(Category).order_by(Category.id)
    result = await db.execute(stmt)
    categories = result.scalars().all()
    return [CategoryResponse.model_validate(c) for c in categories]


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    cat_in: CategoryCreate,
    admin: CurrentAdminDep,
    db: SessionDep,
) -> CategoryResponse:
    category = Category(
        title=cat_in.title,
        slug=cat_in.slug,
        icon_url=cat_in.icon_url,
    )
    db.add(category)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category title or slug already exists",
        )
    await db.refresh(category)
    return CategoryResponse.model_validate(category)
