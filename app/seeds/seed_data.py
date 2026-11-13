import argparse
import asyncio
import json
from datetime import time, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import delete, select

from app.core.config import DEMO_ENVIRONMENTS as DEMO_SEED_ENVIRONMENTS
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.core.time import today_tehran
from app.models.accommodation import Accommodation, AccommodationImage, PricingException
from app.models.amenity import AccommodationAmenity, Amenity
from app.models.category import Category
from app.models.geo import City, Province
from app.models.user import User
from app.schemas.accommodation import AccommodationCreate, AccommodationImageCreate

SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "scripts"
JABAMA_LISTINGS_PATH = SCRIPTS_DIR / "jabama-listings.json"
JABAMA_MANIFEST_PATH = SCRIPTS_DIR / "jabama-seed-manifest.json"
SEED_ADMIN_PHONE = "09120000000"


def ensure_demo_seeding_allowed(environment: str) -> None:
    """Demo accounts have publicly documented passwords; never create them in production."""
    if environment.strip().lower() not in DEMO_SEED_ENVIRONMENTS:
        raise RuntimeError(
            "Refusing to seed demo accounts outside the demo environments "
            f"(ENVIRONMENT={environment!r}). Set ENVIRONMENT=development for local seeding."
        )


def resolve_demo_password(configured: str, dev_fallback: str) -> str:
    """Prefer an operator-provided password; otherwise use the dev/test demo password."""
    return configured or dev_fallback


async def seed():
    ensure_demo_seeding_allowed(settings.ENVIRONMENT)

    async with AsyncSessionLocal() as db:
        # 1. Admin & Guest users
        admin = (
            (await db.execute(select(User).where(User.phone == "09120000000"))).scalars().first()
        )
        if not admin:
            admin = User(
                phone="09120000000",
                email="admin@ashianak.local",
                # Demo account: public development credential, guarded by ensure_demo_seeding_allowed.
                password_hash=get_password_hash(
                    resolve_demo_password(settings.SEED_ADMIN_PASSWORD, "admin123")
                ),
                first_name="مدیر",
                last_name="سامانه",
                role="admin",
            )
            db.add(admin)
            await db.flush()
        elif admin.email == "admin@jabama.local":
            # Rebrand demo rows created before the Ashianak rename.
            admin.email = "admin@ashianak.local"

        guest_check = (
            (await db.execute(select(User).where(User.phone == "09121111111"))).scalars().first()
        )
        if not guest_check:
            guest = User(
                phone="09121111111",
                email="guest@ashianak.local",
                # Demo account: public development credential, guarded by ensure_demo_seeding_allowed.
                password_hash=get_password_hash(
                    resolve_demo_password(settings.SEED_GUEST_PASSWORD, "guest123")
                ),
                first_name="علی",
                last_name="محمدی",
                role="guest",
            )
            db.add(guest)
        elif guest_check.email == "guest@jabama.local":
            # Rebrand demo rows created before the Ashianak rename.
            guest_check.email = "guest@ashianak.local"

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
            prov = (
                (await db.execute(select(Province).where(Province.name == prov_name)))
                .scalars()
                .first()
            )
            if not prov:
                prov = Province(name=prov_name)
                db.add(prov)
                await db.flush()

            for c_name in cities_list:
                city = (
                    (
                        await db.execute(
                            select(City).where(City.province_id == prov.id, City.name == c_name)
                        )
                    )
                    .scalars()
                    .first()
                )
                if not city:
                    city = City(province_id=prov.id, name=c_name)
                    db.add(city)
                    await db.flush()
                city_map[c_name] = city

        # 3. Categories
        categories_data = [
            (
                "کلبه چوبی جنگلی",
                "wooden-cottage",
                "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb",
            ),
            (
                "ویلا استخردار لوکس",
                "pool-villa",
                "https://images.unsplash.com/photo-1580587771525-78b9dba3b914",
            ),
            (
                "اقامتگاه بوم‌گردی سنتی",
                "ecolodge",
                "https://images.unsplash.com/photo-1518780664697-55e3ad937233",
            ),
            (
                "آپارتمان و سوئیت مبله",
                "furnished-apartment",
                "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267",
            ),
            (
                "عمارت کوهستانی",
                "mountain-mansion",
                "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
            ),
        ]

        category_map: dict[str, Category] = {}
        for title, slug, icon in categories_data:
            cat = (
                (await db.execute(select(Category).where(Category.slug == slug))).scalars().first()
            )
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
                (
                    await db.execute(
                        select(Accommodation).where(
                            Accommodation.title == "کلبه چوبی دوبلکس افراتک رامسر"
                        )
                    )
                )
                .scalars()
                .first()
            )

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
                for a_name in [
                    "چشم‌انداز ابدی جنگل و کوه",
                    "باربیکیو و منقل هیزمی",
                    "وای‌فای پرسرعت رایگان",
                    "پارکینگ اختصاصی سرپوشیده",
                ]:
                    if a_name in amenity_map:
                        db.add(
                            AccommodationAmenity(
                                accommodation_id=acc1.id, amenity_id=amenity_map[a_name].id
                            )
                        )

                # Pricing exception for weekend (example)
                weekend_date = today_tehran() + timedelta(days=5)
                ex1 = PricingException(
                    accommodation_id=acc1.id,
                    date=weekend_date,
                    price=Decimal("3200000"),
                )
                db.add(ex1)

        if rasht_city and villa_cat:
            existing_villa = (
                (
                    await db.execute(
                        select(Accommodation).where(
                            Accommodation.title == "ویلا باغ استخردار لوکس ارکیده"
                        )
                    )
                )
                .scalars()
                .first()
            )

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
                for a_name in [
                    "استخر آبگرم سرپوشیده",
                    "جکوزی اختصاصی",
                    "میز بیلیارد و فوتبال‌دستی",
                    "سیستم صوتی و سینمای خانگی",
                    "پارکینگ اختصاصی سرپوشیده",
                ]:
                    if a_name in amenity_map:
                        db.add(
                            AccommodationAmenity(
                                accommodation_id=acc2.id, amenity_id=amenity_map[a_name].id
                            )
                        )

        await db.commit()
        print("Database seeded with sample data successfully!")


def _quantize_coord(value):
    """Quantize a lat/lng float to Numeric(10, 7) precision."""
    if value is None:
        return None
    return Decimal(str(value)).quantize(Decimal("0.0000001"))


async def seed_jabama_listings() -> dict:
    """Load real Jabama listings from scripts/jabama-listings.json.

    Opt-in only: invoked by ``python -m app.seeds.seed_data --jabama``.
    It never runs inside the default ``seed()`` (the test suite's
    ``conftest.py`` calls ``seed()`` on setup, and the Jabama import must
    stay opt-in so the shared test DB is not polluted by default).

    Host is the seed admin (phone 09120000000, role admin) on every insert,
    satisfying the plan-035 R1 rule (assignee must be host or admin).
    Idempotent: a stay is skipped when its Jabama ID is already in
    scripts/jabama-seed-manifest.json as ingested, or when an accommodation
    with the same (title, city_id) already exists. A re-run inserts 0 rows.
    """
    if not JABAMA_LISTINGS_PATH.exists():
        raise FileNotFoundError(
            f"{JABAMA_LISTINGS_PATH} not found — run "
            "`node scripts/seed_from_jabama.mjs --dry-run` first"
        )
    payloads = json.loads(JABAMA_LISTINGS_PATH.read_text(encoding="utf-8"))
    manifest = {}
    if JABAMA_MANIFEST_PATH.exists():
        manifest = json.loads(JABAMA_MANIFEST_PATH.read_text(encoding="utf-8"))
    ingested_ids = {
        s.get("jabama_id")
        for s in manifest.get("stays", [])
        if s.get("accommodation_id") is not None
    }

    # Ensure the reference data (admin, cities, categories, amenities)
    # exists first; seed() is idempotent.
    await seed()

    inserted = 0
    skipped_manifest = 0
    skipped_duplicate = 0
    ingested_now: dict[int, int] = {}

    async with AsyncSessionLocal() as db:
        admin = (
            (await db.execute(select(User).where(User.phone == SEED_ADMIN_PHONE)))
            .scalars()
            .first()
        )
        if not admin:
            raise RuntimeError(f"Seed admin {SEED_ADMIN_PHONE} not found after seed()")

        cities = {
            c.name: c
            for c in (await db.execute(select(City))).scalars().all()
        }
        categories = {
            cat.slug: cat
            for cat in (await db.execute(select(Category))).scalars().all()
        }
        amenities = {
            am.icon: am
            for am in (await db.execute(select(Amenity))).scalars().all()
            if am.icon
        }

        for p in payloads:
            jabama_id = p["jabama_id"]
            if jabama_id in ingested_ids:
                skipped_manifest += 1
                continue
            city = cities.get(p["city"])
            if not city:
                print(f"SKIP stay {jabama_id}: city {p['city']!r} not in DB")
                continue
            category = categories.get(p["category_slug"])
            if not category:
                print(f"SKIP stay {jabama_id}: category {p['category_slug']!r} not in DB")
                continue

            existing = (
                (
                    await db.execute(
                        select(Accommodation).where(
                            Accommodation.title == p["title"],
                            Accommodation.city_id == city.id,
                        )
                    )
                )
                .scalars()
                .first()
            )
            if existing:
                skipped_duplicate += 1
                continue

            amenity_ids = []
            for slug in p.get("amenity_slugs", []):
                am = amenities.get(slug)
                if am is None:
                    # Never insert an unknown amenity_id (FK guard).
                    print(f"SKIP amenity {slug!r} for stay {jabama_id}: not in DB")
                    continue
                amenity_ids.append(am.id)

            validated = AccommodationCreate(
                category_id=category.id,
                city_id=city.id,
                host_id=admin.id,
                title=p["title"],
                description=p.get("description"),
                address=p["address"],
                latitude=_quantize_coord(p.get("latitude")),
                longitude=_quantize_coord(p.get("longitude")),
                base_price=Decimal(p["base_price"]),
                cleaning_fee=Decimal(p.get("cleaning_fee", 0)),
                capacity=p["capacity"],
                max_capacity=p["max_capacity"],
                extra_guest_fee=Decimal(p.get("extra_guest_fee", 0)),
                rooms_count=p["rooms_count"],
                beds_count=p["beds_count"],
                min_nights=p["min_nights"],
                check_in_time=time.fromisoformat(p["check_in_time"]),
                check_out_time=time.fromisoformat(p["check_out_time"]),
                rules=p.get("rules"),
                cancellation_policy=p["cancellation_policy"],
                is_active=True,
                amenity_ids=amenity_ids,
                images=[
                    AccommodationImageCreate(
                        image_url=img["image_url"],
                        is_cover=img["is_cover"],
                        sort_order=img["sort_order"],
                    )
                    for img in p["images"]
                ],
            )

            acc = Accommodation(
                host_id=validated.host_id,
                category_id=validated.category_id,
                city_id=validated.city_id,
                title=validated.title,
                description=validated.description,
                address=validated.address,
                latitude=validated.latitude,
                longitude=validated.longitude,
                base_price=validated.base_price,
                cleaning_fee=validated.cleaning_fee,
                capacity=validated.capacity,
                max_capacity=validated.max_capacity,
                extra_guest_fee=validated.extra_guest_fee,
                rooms_count=validated.rooms_count,
                beds_count=validated.beds_count,
                min_nights=validated.min_nights,
                check_in_time=validated.check_in_time,
                check_out_time=validated.check_out_time,
                rules=validated.rules,
                cancellation_policy=validated.cancellation_policy,
                is_active=validated.is_active,
            )
            db.add(acc)
            await db.flush()
            for img in validated.images:
                db.add(
                    AccommodationImage(
                        accommodation_id=acc.id,
                        image_url=img.image_url,
                        is_cover=img.is_cover,
                        sort_order=img.sort_order,
                    )
                )
            for amenity_id in validated.amenity_ids:
                db.add(
                    AccommodationAmenity(
                        accommodation_id=acc.id, amenity_id=amenity_id
                    )
                )
            ingested_now[jabama_id] = acc.id
            inserted += 1

        await db.commit()

    # Record the ingested rows in the manifest (idempotency + cleanup).
    from datetime import datetime, timezone

    stays = manifest.get("stays", [])
    by_id = {s.get("jabama_id"): s for s in stays}
    for jabama_id, acc_id in ingested_now.items():
        entry = by_id.get(jabama_id)
        if entry is None:
            entry = {"jabama_id": jabama_id, "accommodation_id": acc_id}
            stays.append(entry)
            by_id[jabama_id] = entry
        entry["accommodation_id"] = acc_id
        entry["ingested_at"] = datetime.now(timezone.utc).isoformat()
    manifest["stays"] = stays
    JABAMA_MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    result = {
        "inserted": inserted,
        "skipped_manifest": skipped_manifest,
        "skipped_duplicate": skipped_duplicate,
        "total_payloads": len(payloads),
    }
    print(f"Jabama seed: {result}")
    return result


async def cleanup_jabama_listings() -> int:
    """Delete exactly the rows imported by seed_jabama_listings().

    Uses the accommodation IDs recorded in scripts/jabama-seed-manifest.json
    and verifies each title matches before deleting, so nothing else is
    touched. Resets the manifest entries so a later --jabama re-inserts.
    """
    if not JABAMA_MANIFEST_PATH.exists():
        print("No Jabama manifest found — nothing to clean up")
        return 0
    manifest = json.loads(JABAMA_MANIFEST_PATH.read_text(encoding="utf-8"))
    entries = [
        s for s in manifest.get("stays", []) if s.get("accommodation_id") is not None
    ]
    if not entries:
        print("Manifest has no ingested rows — nothing to clean up")
        return 0

    deleted = 0
    async with AsyncSessionLocal() as db:
        for entry in entries:
            acc_id = entry["accommodation_id"]
            acc = (
                (await db.execute(select(Accommodation).where(Accommodation.id == acc_id)))
                .scalars()
                .first()
            )
            if acc is None:
                print(f"Cleanup: accommodation {acc_id} already gone")
                continue
            if entry.get("title") and acc.title != entry["title"]:
                print(
                    f"Cleanup: SKIP id {acc_id} — title mismatch "
                    f"({acc.title!r} != {entry['title']!r})"
                )
                continue
            await db.execute(delete(Accommodation).where(Accommodation.id == acc_id))
            deleted += 1
        await db.commit()

    for entry in entries:
        entry["accommodation_id"] = None
        entry.pop("ingested_at", None)
    JABAMA_MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Jabama cleanup: deleted {deleted} imported listings")
    return deleted


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the database")
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--jabama",
        action="store_true",
        help="also ingest real Jabama listings from scripts/jabama-listings.json",
    )
    group.add_argument(
        "--cleanup-jabama",
        action="store_true",
        help="delete exactly the rows imported by --jabama (manifest-based)",
    )
    args = parser.parse_args()
    if args.jabama:
        asyncio.run(seed_jabama_listings())
    elif args.cleanup_jabama:
        asyncio.run(cleanup_jabama_listings())
    else:
        asyncio.run(seed())
