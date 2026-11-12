# Vacation Rental & Accommodation Booking Platform (API Backend)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1.svg?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00.svg?style=flat&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![Alembic](https://img.shields.io/badge/Alembic-1.14+-black.svg?style=flat)](https://alembic.sqlalchemy.org/)
[![Tests](https://img.shields.io/badge/Tests-138-brightgreen.svg?style=flat)](https://pytest.org)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg?style=flat)](https://github.com/astral-sh/ruff)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](LICENSE)

A production-grade, highly reliable RESTful API backend for a vacation rental and accommodation booking platform (similar to **Airbnb** and **Jajiga**), architected with **FastAPI**, **PostgreSQL 14+**, **SQLAlchemy 2.0 (Asyncpg)**, and **Alembic**.

Designed for enterprise workloads with a fully normalized 3NF relational schema, multi-host access scoping, row-level concurrency locking against double-booking, transparent price breakdowns, dynamic pricing calendar, two-way iCal sync, host payout ledgers, and verified proof-of-stay guest reviews.

---

## Key Architectural Highlights

### 1. Multi-Host Scoping & Role-Based Access Control (RBAC)
- **Role Hierarchy**: System users are partitioned into `admin`, `host`, and `guest` roles.
- **Host Ownership Isolation**: Hosts exclusively manage and inspect their own listings (`GET /accommodations/my`) and incoming reservations (`GET /reservations/host`).
- **Strict Ownership Guards**: Modifying or deleting an accommodation is authorized strictly for system administrators or the property's owner (`host_id == current_user.id`).

### 2. Concurrency Safety & Double-Booking Prevention
- **Database Row Locks (`SELECT ... FOR UPDATE`)**: High-concurrency booking and calendar synchronization employ pessimistic row-level locking to eliminate race conditions and guarantee zero double-bookings.
- **Overlapping Range Verification**: Active reservation dates and host-blocked calendar entries are evaluated atomically before creating bookings or confirming checkout sessions.

### 3. Transparent Price Engine & Cancellation Policies
- **Itemized Price Calculation**: Computes nightly base rates with holiday/weekend exceptions, cleaning fees, additional guest surcharges, and promotional coupon discounts before checkout.
- **Flexible / Moderate / Strict Policies**: Smart reservation cancellation previews calculate penalty deductions and host payouts depending on the accommodation's cancellation rules and notice window.

### 4. Dynamic Pricing Calendar & Two-Way iCal Sync
- **Seasonal & Holiday Overrides**: Hosts can set custom nightly rates and minimum stay requirements on specific calendar dates.
- **Bulk Date Blocking**: Allows hosts to block single or bulk date ranges for maintenance or offline bookings.
- **Standard iCal Export & Import**: Generates compliant RFC 5545 `.ics` feeds (`GET /accommodations/{id}/calendar.ics`) and imports external calendar feeds to synchronize availability across OTAs with SSRF protection and DNS resolution safeguards.

### 5. Financial Operations & Host Payout Ledger
- **Checkout Lifecycle & 30-Minute TTL**: Pending bookings expire automatically if payment is not initiated within 30 minutes, freeing reserved dates back into the search pool.
- **Simulated Shaparak Banking Gateway**: Idempotent payment verification with unique transaction tracking codes.
- **Host Payout Accounting**: Tracks gross earnings, automatically deducts the platform's 10% commission fee, and records transparent payout ledger entries ready for settlement.

### 6. Fraud-Proof Reviews (Proof of Stay)
- Review and rating submissions are strictly gated behind verified, completed reservations (`status == "completed"`).
- Uses a unique candidate key `UNIQUE (reservation_id)` to enforce that each completed trip can receive at most one review.

---

## Database Architecture (Normalized 3NF)

The PostgreSQL schema consists of normalized relational tables with comprehensive foreign key B-Tree indexing, `TIMESTAMPTZ` audit timestamps, and integrity constraints:

```text
├── users (mobile-first canonical normalization, bcrypt password hash, roles)
├── provinces & cities (3NF geographic hierarchy)
├── categories & amenities (SEO slugs, relational mapping via accommodation_amenities)
├── accommodations (pricing, cleaning fees, capacities, coordinates, min stay, rules)
├── accommodation_images (multi-image gallery, primary cover flag, display order)
├── pricing_exceptions (seasonal rates, bulk blocking, UNIQUE(accommodation_id, date))
├── reservations (state machine: pending -> confirmed -> completed / cancelled)
├── payments (Shaparak gateway simulation, tracking code, idempotency, TTL)
├── coupons & coupon_redemptions (percentage / fixed discounts, max cap, validation)
├── host_payouts (platform commission accounting, pending/settled/cancelled ledger)
├── reservation_messages (direct in-stay guest-host communication)
├── external_calendars (iCal feeds, last synced timestamp, sync status)
├── reviews (proof-of-stay verified reviews, rating scale 1-5)
└── wishlists (composite primary key bookmarking)
```

---

## Technology Stack

- **Framework**: FastAPI (Async ASGI)
- **Database Engine**: PostgreSQL 14+ (developed and tested on 18)
- **ORM & Driver**: SQLAlchemy 2.0 with `asyncpg` async driver
- **Connection Pooling**: `AsyncAdaptedQueuePool`
- **Schema Migrations**: Alembic
- **Authentication**: JWT Bearer Tokens (PyJWT) with bcrypt password hashing
- **Data Validation & Settings**: Pydantic v2 & Pydantic Settings
- **Testing**: `pytest`, `pytest-asyncio`, `httpx` (138 comprehensive automated tests)
- **Code Quality**: `ruff` (linter & formatter), `mypy` (static type analysis)

---

## Getting Started

### Prerequisites
- Python 3.12+ (or Conda environment `ai_bootcamp`)
- PostgreSQL 14+ running locally or in Docker on port `5432`

### 1. Clone the Repository
```bash
git clone https://github.com/airregista/vacation-rental-platform.git
cd vacation-rental-platform
```

### 2. Environment Setup
Create and configure your local `.env` file from `.env.example`:
```bash
cp .env.example .env
```

Ensure your PostgreSQL database connection string is properly configured:
```ini
PROJECT_NAME="Ashianak — Accommodation Booking API"
API_V1_STR="/api/v1"
# REQUIRED. Use development/dev/local/test/testing for local work; any other value requires a real SECRET_KEY.
ENVIRONMENT="development"
# REQUIRED outside development/dev/local/test/testing. Generate one with:
#   python -c "import secrets; print(secrets.token_urlsafe(48))"
# In the demo environments an empty value generates an ephemeral per-process key.
SECRET_KEY=""
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=480
CALENDAR_FEED_TTL_MINUTES=10080
CALENDAR_MAX_BLOCK_DAYS=90
CALENDAR_MAX_BLOCKED_DATES=1000
RESERVATION_MAX_CHECKIN_MONTHS=18

POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
POSTGRES_DB=jabama_db
DATABASE_URL=postgresql+asyncpg://postgres@localhost:5432/jabama_db

# Demo accounts (with publicly documented passwords) are seeded only in a demo ENVIRONMENT.
ENABLE_STARTUP_SEED=False
```

The sample assumes a passwordless local `postgres` user. If your local PostgreSQL user has a password, set `POSTGRES_PASSWORD` and mirror the same password in the userinfo of `DATABASE_URL`.

`ENVIRONMENT` is required. Outside the demo environments (`development`, `dev`, `local`, `test`, `testing`) the API refuses to start when `SECRET_KEY` is missing, a placeholder, or shorter than 32 characters; rotating the key invalidates all existing JWTs and calendar feed links.

### 3. Install Dependencies
```bash
pip install -e ".[dev]"
```

### 4. Run Migrations & Seed Database
```bash
# Apply Alembic schema migrations
alembic upgrade head

# Seed initial test data (categories, amenities, provinces, test accommodations, admin)
python -m app.seeds.seed_data
```

### 5. Launch the Server
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 6. Deploy to a Server
For production secrets, database migrations, CORS, TLS, worker/rate-limit
considerations, and a post-deploy smoke test, see
[DEPLOYMENT.md](DEPLOYMENT.md).

---

## Interactive Documentation

Once the server is running, explore and test all 58 operations across 46 paths using interactive API documentation:

- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **OpenAPI Schema**: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

---

## Default Seed Credentials

The database seed creates two demo accounts **only** when `ENVIRONMENT` is one of the
demo environments (`development`, `dev`, `local`, `test`, `testing`). `seed()` refuses
to run anywhere else, so a deployment cannot accidentally create accounts whose
passwords are published here.

| Role | Mobile / Login | Development default password | Capabilities |
| :--- | :--- | :--- | :--- |
| **System Admin** | `09120000000` | `admin123` | Full access across all hosts, listings, coupons, and payouts |
| **Host / Guest User** | `09121111111` | `guest123` | Manage owned listings, view host reservations, make bookings |

For a shared development/demo instance, override the passwords with
`SEED_ADMIN_PASSWORD` and `SEED_GUEST_PASSWORD`. An override applies only when the
account is first created; it does not rotate an existing user's password (use the API,
or recreate the account deliberately).

Do not set these variables in the environment used by the test suite:
`tests/conftest.py` logs in with the documented development passwords, so an override
on a clean test database breaks the fixtures.

---

## API Overview (58 Operations)

The API is organized into 12 core resource routers. Counts are grouped by feature and generated from `/openapi.json`; use Swagger UI as the authoritative list.

| Module | Endpoints | Key Operations |
| :--- | :--- | :--- |
| **Auth** | 7 | Mobile registration, JWT Bearer login, profile retrieval & update |
| **Users** | 2 | Directory listing, user detail inspection (RBAC admin only) |
| **Geography** | 4 | 3NF provinces and tourist cities retrieval and creation |
| **Categories & Amenities** | 4 | SEO categories (Villas, Cottages, Eco-Lodges) and amenities registry |
| **Accommodations** | 10 | Bounding-box map search, CRUD, host-scoped listings (`/my`) |
| **Calendar & Pricing** | 5 | Date exceptions, bulk blocks, iCal RFC 5545 `.ics` export & sync |
| **Reservations** | 9 | Pre-calculation engine, row-locked booking, host/guest views, cancellation |
| **Messages** | 2 | In-stay direct messaging between host and traveler |
| **Payments & Payouts** | 6 | Gateway checkout, verification, guest invoices, host payout ledger & settlement |
| **Coupons** | 3 | Coupon validation, percentage/fixed discounts with caps |
| **Reviews** | 2 | Proof-of-stay verified review submission and ratings retrieval |
| **Wishlist & Health** | 4 | Accommodation bookmarks toggle and live database health monitoring |

---

## Automated Test Suite

Tests run against a disposable database whose name must end in `_test`.
The default is `jabama_test`; override it with `TEST_DATABASE_URL`. The suite
creates the database if needed, drops and recreates only that database's
`public` schema, runs `alembic upgrade head`, and then seeds. It never writes
to the development database.

The test suite contains 138 comprehensive asynchronous integration tests covering edge cases, concurrency race conditions, multi-host access scoping, payment gateway verification, and SSRF protections:

```bash
# Run the complete test suite
pytest -v

# Run with coverage report
pytest --cov=app --cov-report=term-missing
```

### Static Analysis & Code Formatting
```bash
# Run Ruff linting
ruff check app/

# Run static type checking
mypy app/
```

---

## Project Structure

```text
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/        # 12 Modular FastAPI endpoint routers
│   │       └── router.py         # Central API v1 router registry
│   ├── core/
│   │   ├── config.py             # Pydantic v2 application settings
│   │   ├── database.py           # Async SQLAlchemy engine & session maker
│   │   └── security.py           # JWT tokens, password hashing, RBAC dependencies
│   ├── models/                   # 14 SQLAlchemy 2.0 ORM database models
│   ├── schemas/                  # Pydantic request & response validation schemas
│   ├── seeds/                    # Deterministic database seeding scripts
│   └── main.py                   # FastAPI application initialization & middleware
├── migrations/                   # Alembic environment and migration versions
├── tests/                        # 138 Pytest integration and concurrency test cases
├── .env.example                  # Environment configuration template
├── alembic.ini                   # Alembic configuration
└── pyproject.toml                # Project metadata, Ruff, and Mypy configuration
```

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
