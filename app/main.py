import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

import app.models as _models  # noqa: F401 - ensure models are registered
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.seeds.seed_data import seed
from app.services.reservation_service import expire_stale_pending_reservations

logger = logging.getLogger(__name__)


async def _reservation_sweep_loop() -> None:
    while True:
        await asyncio.sleep(settings.RESERVATION_SWEEP_INTERVAL_SECONDS)
        try:
            async with AsyncSessionLocal() as session:
                expired = await expire_stale_pending_reservations(
                    session,
                    ttl_minutes=settings.RESERVATION_TTL_MINUTES,
                )
            if expired:
                logger.info("Expired %s stale pending reservations", expired)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Reservation expiry sweep failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure seed data exists if enabled
    if settings.ENABLE_STARTUP_SEED:
        await seed()
    sweep_task: asyncio.Task[None] | None = None
    if settings.ENABLE_RESERVATION_SWEEP:
        sweep_task = asyncio.create_task(_reservation_sweep_loop())
    try:
        yield
    finally:
        if sweep_task is not None:
            sweep_task.cancel()
            with suppress(asyncio.CancelledError):
                await sweep_task
        # Cleanup on shutdown
        await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
# Ashianak — Vacation Rental & Accommodation Booking Platform

Production-grade RESTful API backend for an accommodation and vacation rental booking platform (similar to Airbnb & Jajiga), built with FastAPI, PostgreSQL, and SQLAlchemy 2.0 based on a fully normalized 3NF schema:

- **Authentication & User Management**: Mobile phone registration, secure JWT Bearer token authentication, and Bcrypt password hashing.
- **Multi-Host Architecture & Host Scoping**: Isolated accommodation management per host (`GET /accommodations/my`), host-scoped reservation tracking (`GET /reservations/host`), and strict ownership-based access control (Host Scoping: accessible strictly by admins or the property owner).
- **3NF Geographic Hierarchy & Categories**: Fully normalized relational schema for provinces, cities, property categories with SEO slugs, and amenities.
- **Advanced Search & Map Bounding-Box Filtering**: Real-time availability filtering matching confirmed bookings and blocked calendars, geographic bounding box coordinates, guest capacity, price range, and amenities.
- **Dynamic Pricing Calendar & Date Blocking**: Holiday/weekend seasonal pricing overrides (Pricing Exceptions), single and bulk calendar date blocking by hosts or admins, and standard iCal (.ics) calendar sync.
- **Transparent Price Calculation Engine**: Itemized breakdown of nightly base rates, cleaning fees, extra guest charges, and automated coupon discounts before checkout.
- **Row-Locked Booking & Double-Booking Prevention**: Database-level row locking (`SELECT ... FOR UPDATE`) preventing race conditions and double bookings during concurrent guest reservations.
- **Payment Gateway & Checkout Lifecycle**: 30-minute reservation TTL expiration, simulated Shaparak banking gateway, tracking code issuance, and automated status transitions to Confirmed.
- **Proof-of-Stay Verified Reviews**: Fraud-proof review and rating submissions restricted strictly to guests with completed stays via unique booking candidate keys.
- **Guest Wishlists & In-Stay Messaging**: Bookmarking favorite accommodations and direct in-stay communication between guests and hosts.
    """,
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 routes
app.include_router(api_router, prefix=settings.API_V1_STR)

# Locally uploaded accommodation images. The directory is created eagerly so
# the app can boot on a clean checkout.
_upload_dir = Path(settings.UPLOAD_DIR)
_upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_upload_dir), name="uploads")


@app.get("/", tags=["health"])
async def root():
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "api_v1_prefix": settings.API_V1_STR,
    }


@app.get("/health", tags=["health"])
async def health_check() -> JSONResponse:
    """Readiness probe: return 503 when the database cannot answer."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Database health probe failed")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "disconnected"},
        )
    return JSONResponse(
        status_code=200,
        content={"status": "ok", "database": "connected"},
    )
