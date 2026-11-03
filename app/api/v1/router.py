from fastapi import APIRouter

from app.api.v1.endpoints import (
    accommodations,
    amenities,
    auth,
    categories,
    coupons,
    geo,
    payments,
    reservations,
    reviews,
    users,
    wishlists,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(geo.router)
api_router.include_router(categories.router)
api_router.include_router(amenities.router)
api_router.include_router(accommodations.router)
api_router.include_router(coupons.router)
api_router.include_router(reservations.router)
api_router.include_router(payments.router)
api_router.include_router(reviews.router)
api_router.include_router(wishlists.router)
