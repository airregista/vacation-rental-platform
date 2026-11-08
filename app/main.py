from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models as _models  # noqa: F401 - ensure models are registered
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import engine
from app.seeds.seed_data import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure seed data exists if enabled
    if settings.ENABLE_STARTUP_SEED:
        await seed()
    yield
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
async def health_check():
    return {"status": "ok", "database": "connected"}
