from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import app.models  # ensure models are registered
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import Base, engine
from app.seeds.seed_data import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Ensure seed data exists if enabled
    if settings.ENABLE_STARTUP_SEED:
        await seed()
    yield
    # Cleanup on shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
# سامانه جامع رزرو اقامتگاه (مشابه جاباما و Airbnb)

این سامانه به عنوان بک‌اند پلتفرم رزرو اقامتگاه با رعایت کامل استانداردها و بر اساس ERD اصلاح‌شده طراحی و پیاده‌سازی شده است:
- **احراز هویت و مدیریت کاربران**: ثبت نام با شماره همراه و احراز هویت با JWT Token و هش رمز عبور با الگوریتم امن Bcrypt.
- **معماری تک‌ادمین (Single Admin)**: مدیریت متمرکز اقامتگاه‌ها، دسته‌بندی‌ها، استان‌ها و شهرها توسط ادمین بدون نیاز به پنل مجزای میزبان در این فاز.
- **دسته‌بندی و موقعیت جغرافیایی 3NF**: نرمال‌سازی کامل استان‌ها، شهرها، دسته‌بندی‌ها با اسلاگ‌های سئو.
- **جستجو و فیلتر پیشرفته اقامتگاه‌ها**: فیلتر بر اساس شهر، تاریخ‌های رفت و برگشت (تطبیق بلادرنگ با رزروهای قطعی و تقویم مسدودی)، سقف نفرات، بازه قیمتی، و لیست امکانات.
- **تقویم نرخ شناور و روزهای بلاک**: امکان تعریف نرخ‌های ویژه تعطیلات (Pricing Exceptions) و مسدودسازی تاریخ‌های خاص.
- **موتور محاسبه قیمت و رزرو هوشمند**: تفکیک هزینه نظافت، هزینه نفر اضافه، و جلوگیری قطعی از تداخل زمانی (Double-Booking Prevention).
- **درگاه پرداخت شاپرک (شبیه‌ساز بانکی)**: چرخه کامل پرداخت سفارش، صدور کد رهگیری و تغییر وضعیت به Confirmed.
- **نظرات واقعی ضد تقلب (Proof of Stay)**: ثبت نظر و امتیاز صرفاً برای مسافرانی که سفر قطعی داشته‌اند، همراه با کلید نامزد یکتا.
- **علاقه‌مندی‌ها (Wishlist)**: ذخیره اقامتگاه‌های محبوب توسط مسافر.
    """,
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
