import asyncio
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.accommodation import Accommodation, AccommodationImage, PricingException
from app.models.amenity import AccommodationAmenity, Amenity
from app.models.category import Category
from app.models.geo import City, Province
from app.models.user import User


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # 1. Admin & Guest users
        admin = (await db.execute(select(User).where(User.phone == "09120000000"))).scalars().first()
        if not admin:
            admin = User(
                phone="09120000000",
                email="admin@jabama.local",
                password_hash=get_password_hash("admin123"),
                first_name="مدیر",
                last_name="سامانه",
                role="admin",
            )
            db.add(admin)
            await db.flush()

        guest_check = (await db.execute(select(User).where(User.phone == "09121111111"))).scalars().first()
        if not guest_check:
            guest = User(
                phone="09121111111",
                email="guest@jabama.local",
                password_hash=get_password_hash("guest123"),
                first_name="علی",
                last_name="محمدی",
                role="guest",
            )
            db.add(guest)

        await db.flush()

        # 2. Provinces & Cities
        provinces_data = [
            ("مازندران", ["رامسر", "چالوس", "متل قو", "نوشهر"]),
            ("گیلان", ["رشت", "لاهیجان", "انزلی", "ماسوله"]),
            ("تهران", ["تهران", "دماوند", "فشم", "کردان"]),
            ("اصفهان", ["اصفهان", "کاشان"]),
            ("فارس", ["شیراز"]),
            ("هرمزگان", ["کیش", "قشم"]),
        ]

        city_map: dict[str, City] = {}
        for prov_name, cities_list in provinces_data:
            prov = (await db.execute(select(Province).where(Province.name == prov_name))).scalars().first()
            if not prov:
                prov = Province(name=prov_name)
                db.add(prov)
                await db.flush()

            for c_name in cities_list:
                city = (
                    await db.execute(
                        select(City).where(City.province_id == prov.id, City.name == c_name)
                    )
                ).scalars().first()
                if not city:
                    city = City(province_id=prov.id, name=c_name)
                    db.add(city)
                    await db.flush()
                city_map[c_name] = city

        # 3. Categories
        categories_data = [
            ("کلبه چوبی جنگلی", "wooden-cottage", "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb"),
            ("ویلا استخردار لوکس", "pool-villa", "https://images.unsplash.com/photo-1580587771525-78b9dba3b914"),
            ("اقامتگاه بوم‌گردی سنتی", "ecolodge", "https://images.unsplash.com/photo-1518780664697-55e3ad937233"),
            ("آپارتمان و سوئیت مبله", "furnished-apartment", "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267"),
            ("عمارت کوهستانی", "mountain-mansion", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750"),
        ]

        category_map: dict[str, Category] = {}
        for title, slug, icon in categories_data:
            cat = (await db.execute(select(Category).where(Category.slug == slug))).scalars().first()
            if not cat:
                cat = Category(title=title, slug=slug, icon_url=icon)
                db.add(cat)
                await db.flush()
            category_map[slug] = cat

        # 4. Amenities
        amenities_data = [
            ("استخر آبگرم سرپوشیده", "pool"),
            ("جکوزی اختصاصی", "hot-tub"),
            ("وای‌فای پرسرعت رایگان", "wifi"),
            ("باربیکیو و منقل هیزمی", "bbq"),
            ("چشم‌انداز ابدی جنگل و کوه", "mountain"),
            ("سیستم صوتی و سینمای خانگی", "speaker"),
            ("پارکینگ اختصاصی سرپوشیده", "parking"),
            ("میز بیلیارد و فوتبال‌دستی", "gamepad"),
        ]

        amenity_map: dict[str, Amenity] = {}
        for a_name, a_icon in amenities_data:
            am = (await db.execute(select(Amenity).where(Amenity.name == a_name))).scalars().first()
            if not am:
                am = Amenity(name=a_name, icon=a_icon)
                db.add(am)
                await db.flush()
            amenity_map[a_name] = am

        # 5. Accommodations
        ramsar_city = city_map.get("رامسر")
        rasht_city = city_map.get("رشت")
        cottage_cat = category_map.get("wooden-cottage")
        villa_cat = category_map.get("pool-villa")

        if ramsar_city and cottage_cat:
            existing_acc = (
                await db.execute(
                    select(Accommodation).where(Accommodation.title == "کلبه چوبی دوبلکس افراتک رامسر")
                )
            ).scalars().first()

            if not existing_acc:
                acc1 = Accommodation(
                    host_id=admin.id,
                    category_id=cottage_cat.id,
                    city_id=ramsar_city.id,
                    title="کلبه چوبی دوبلکس افراتک رامسر",
                    description="کلبه چوبی دوبلکس میان درختان سرسبز جنگلی دالخانی با تراس بزرگ رو به ابرها، باربیکیو و امکانات کامل اقامتی.",
                    address="مازندران، رامسر، کیلومتر ۱۵ جاده جنت رودبار",
                    latitude=Decimal("36.885400"),
                    longitude=Decimal("50.673200"),
                    base_price=Decimal("2500000"),
                    cleaning_fee=Decimal("200000"),
                    capacity=4,
                    max_capacity=6,
                    extra_guest_fee=Decimal("300000"),
                    rooms_count=2,
                    beds_count=3,
                    rules="ورود حیوان خانگی مجاز نیست. استعمال دخانیات در داخل کلبه ممنوع است.",
                    is_active=True,
                )
                db.add(acc1)
                await db.flush()

                # Images
                img1 = AccommodationImage(
                    accommodation_id=acc1.id,
                    image_url="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
                    is_cover=True,
                    sort_order=1,
                )
                img2 = AccommodationImage(
                    accommodation_id=acc1.id,
                    image_url="https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800",
                    is_cover=False,
                    sort_order=2,
                )
                db.add_all([img1, img2])

                # Amenities
                for a_name in ["چشم‌انداز ابدی جنگل و کوه", "باربیکیو و منقل هیزمی", "وای‌فای پرسرعت رایگان", "پارکینگ اختصاصی سرپوشیده"]:
                    if a_name in amenity_map:
                        db.add(AccommodationAmenity(accommodation_id=acc1.id, amenity_id=amenity_map[a_name].id))

                # Pricing exception for weekend (example)
                weekend_date = date.today() + timedelta(days=5)
                ex1 = PricingException(
                    accommodation_id=acc1.id,
                    date=weekend_date,
                    price=Decimal("3200000"),
                    is_blocked=False,
                )
                db.add(ex1)

        if rasht_city and villa_cat:
            existing_villa = (
                await db.execute(
                    select(Accommodation).where(Accommodation.title == "ویلا باغ استخردار لوکس ارکیده")
                )
            ).scalars().first()

            if not existing_villa:
                acc2 = Accommodation(
                    host_id=admin.id,
                    category_id=villa_cat.id,
                    city_id=rasht_city.id,
                    title="ویلا باغ استخردار لوکس ارکیده",
                    description="ویلا باغ مدرن با استخر آبگرم سرپوشیده تصفیه ۲۴ ساعته، میز بیلیارد، سیستم صوتی حرفه‌ای و حیاط مشجر اختصاصی.",
                    address="گیلان، رشت، جاده پیربازار، کوچه بهار",
                    latitude=Decimal("37.315000"),
                    longitude=Decimal("49.560000"),
                    base_price=Decimal("4500000"),
                    cleaning_fee=Decimal("350000"),
                    capacity=6,
                    max_capacity=10,
                    extra_guest_fee=Decimal("400000"),
                    rooms_count=3,
                    beds_count=5,
                    rules="برگزاری جشن و مراسم با هماهنگی قبلی امکان‌پذیر است.",
                    is_active=True,
                )
                db.add(acc2)
                await db.flush()

                # Images
                img_v1 = AccommodationImage(
                    accommodation_id=acc2.id,
                    image_url="https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800",
                    is_cover=True,
                    sort_order=1,
                )
                img_v2 = AccommodationImage(
                    accommodation_id=acc2.id,
                    image_url="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
                    is_cover=False,
                    sort_order=2,
                )
                db.add_all([img_v1, img_v2])

                # Amenities
                for a_name in ["استخر آبگرم سرپوشیده", "جکوزی اختصاصی", "میز بیلیارد و فوتبال‌دستی", "سیستم صوتی و سینمای خانگی", "پارکینگ اختصاصی سرپوشیده"]:
                    if a_name in amenity_map:
                        db.add(AccommodationAmenity(accommodation_id=acc2.id, amenity_id=amenity_map[a_name].id))

        await db.commit()
        print("Database seeded with sample data successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
