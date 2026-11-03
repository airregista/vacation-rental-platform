from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncAttrs, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import AsyncAdaptedQueuePool, NullPool

from app.core.config import settings

pool_kwargs: dict[str, Any] = {"echo": False, "future": True}
if settings.DB_POOL_TYPE == "null":
    pool_kwargs["poolclass"] = NullPool
else:
    pool_kwargs["poolclass"] = AsyncAdaptedQueuePool
    pool_kwargs["pool_size"] = settings.DB_POOL_SIZE
    pool_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
    pool_kwargs["pool_timeout"] = settings.DB_POOL_TIMEOUT
    pool_kwargs["pool_pre_ping"] = True

engine = create_async_engine(settings.async_database_url, **pool_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


class Base(AsyncAttrs, DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
