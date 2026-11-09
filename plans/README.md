# Implementation Plans

Generated and reviewed by the `improve` skill on 2026-11-03 against commit `47005ef`. Execute in the order below unless dependencies say otherwise. Each executor: read the plan fully before starting, honor its STOP conditions, and update your row when done.

---

## Execution Order & Status

| Plan | Title | Priority | Effort | Depends on | Status | Worktree Branch | Commit |
|------|-------|----------|--------|------------|--------|-----------------|--------|
| **001** | `001-cancellation-and-refund-mechanism.md` | P1 | M | — | **DONE** | `master` | `d120a11` |
| **002** | `002-multi-host-future-proof-ownership.md` | P1 | S | — | **DONE** | `master` | `b3e8c9a` |
| **003** | `003-transparent-pricing-breakdown.md` | P2 | S | 001 | **DONE** | `master` | `33a6f1a` |
| **004** | `004-double-booking-prevention-and-transaction-locking.md` | P1 | M | — | **DONE** | `feature/concurrency-locking` | `9fd9395` |
| **005** | `005-proof-of-stay-integrity-and-security-hardening.md` | P1 | S | 004 | **DONE** | `security/review-and-auth-hardening` | `649fdd3` |
| **006** | `006-iran-timezone-synchronization-and-date-validations.md` | P1 | S | — | **DONE** | `feature/timezone-and-boundary-validations` | `cd3a71b` |
| **007** | `007-database-query-optimization-and-connection-pooling.md` | P2 | S | — | **DONE** | `perf/queries-and-pooling` | `849eb22` |
| **008** | `008-alembic-migrations-and-dx-tooling.md` | P2 | S | — | **DONE** | `tooling/alembic-and-dx` | `bf33065` |
| **009** | `009-test-suite-isolation-and-comprehensive-coverage.md` | P2 | S | — | **DONE** | `test/metadata-and-isolation` | `0d40cdb` |
| **010** | `010-host-portal-and-spatial-radius-search.md` | P3 | M | 004, 007 | **DONE** | `feature/roadmap-spike` | `b051a84` |
| **011** | `011-host-reservation-access-and-capacity-validation-hardening.md` | P1 | S | — | **DONE** | `advisor/011-host-reservation-access-and-capacity-validation` | `af93c6f` |
| **012** | `012-host-calendar-pricing-exception-deletion-and-amenities-update.md` | P2 | S | 011 | **DONE** | `advisor/012-exception-deletion-and-amenities-update` | `9d4a9a3` |
| **013** | `013-alembic-baseline-schema-and-ci-test-bootstrapping.md` | P1 | M | — | **DONE** | `advisor/013-alembic-baseline-and-test-bootstrapping` | `1e05ba2` |
| **014** | `014-dx-tooling-typecheck-mypy-and-ruff-lint-cleanup.md` | P2 | S | — | **DONE** | `advisor/014-dx-mypy-and-ruff-cleanup` | `90885e3` |
| **015** | `015-extended-search-sorting-and-payment-test-coverage.md` | P2 | S | 011 | **DONE** | `advisor/015-search-sorting-and-payments-test-coverage` | `e32300e` |
| **016** | `016-direction-pending-reservation-ttl-and-batch-blocking.md` | P2 | M | 011, 012 | **DONE** | `advisor/016-reservation-ttl-and-batch-blocking` | `40ec5e0` |
| **017** | `017-direction-promotional-discount-coupons-engine.md` | P3 | M | 011 | **DONE** | `advisor/017-promotional-discount-coupons` | `b1a7619` |
| **018** | `018-zero-payable-concurrency-and-payment-lifecycle-integrity.md` | P1 | S | — | **DONE** | `master` | `c9864df` |
| **019** | `019-search-amenity-deduplication-pagination-and-image-guard.md` | P2 | S | — | **DONE** | `master` | `d7bcb2b` |
| **020** | `020-iranian-phone-canonical-normalization-and-auth-integrity.md` | P2 | S | — | **DONE** | `master` | `96dfc45` |
| **021** | `021-security-access-controls-and-race-condition-guards.md` | P1 | S | — | **DONE** | `advisor/021-security-access-controls-and-race-condition-guards` | `62a726d` |
| **022** | `022-database-indexes-pagination-and-bounding-box-optimization.md` | P2 | M | — | **DONE** | `advisor/022-database-indexes-pagination-and-bounding-box-optimization` | `7d42fe8` |
| **023** | `023-architecture-service-consolidation-and-migration-hygiene.md` | P2 | S | — | **DONE** | `advisor/023-architecture-service-consolidation-and-migration-hygiene` | `5b48606` |
| **024** | `024-test-coverage-expansion-and-mypy-hardening.md` | P2 | S | — | **DONE** | `advisor/024-test-coverage-expansion-and-mypy-hardening` | `fb9c98e` |
| **025** | `025-direction-room-bed-search-filters-and-minimum-stay.md` | P2 | S | — | **DONE** | `advisor/025-direction-room-bed-search-filters-and-minimum-stay` | `90000bb` |
| **026** | `026-direction-two-way-calendar-sync-and-ical-import.md` | P3 | M | — | **DONE** | `advisor/026-direction-two-way-calendar-sync-and-ical-import` | `4eb82fb` |
| **027** | `027-direction-host-payout-ledger-and-commission-tracking.md` | P3 | M | — | **DONE** | `advisor/027-direction-host-payout-ledger-and-commission-tracking` | `529040b` |
| **028** | `028-direction-host-guest-reservation-messaging.md` | P3 | M | — | **DONE** | `advisor/028-direction-host-guest-reservation-messaging` | `9d1f0ea` |
| **029** | `029-brand-rename-and-project-identity.md` | P1 | S | — | **DONE** | `advisor/029-brand-rename-and-project-identity` | `8467a2d` |
| **030** | `030-ical-feed-token-ttl-and-expiry.md` | P2 | M | 029 | **DONE** | `advisor/030-ical-feed-token-ttl-and-expiry` | `ad0b164` |
| **031** | `031-booking-validation-bulk-blocking-range-cap.md` | P2 | S | — | **DONE** | `advisor/031-booking-validation-bulk-blocking-range-cap` | `f8a70b2` |
| **032** | `032-dead-code-and-dependency-pruning.md` | P1 | S | — | **DONE** | `advisor/032-dead-code-and-dependency-pruning` | `2315619` |
| **033** | `033-database-operations-simplification.md` | P2 | S | — | **DONE** | `advisor/033-database-operations-simplification` | `19ed2f6` |
| **034** | `034-service-and-endpoint-deduplication.md` | P2 | S | — | **DONE** | `advisor/034-service-and-endpoint-deduplication` | `677a622` |
| **035** | `035-backend-otp-and-host-role-extension.md` | P1 | S | — | **DONE** | `main` | `ba4afa7` |
| **036** | `036-nextjs-shadcn-scaffold-and-warm-persian-theme.md` | P1 | M | 035 | **DONE** | `main` | `ba4afa7` |
| **037** | `037-auth-otp-modal-and-session-state.md` | P1 | M | 036 | **DONE** | `main` | `ba4afa7` |
| **038** | `038-explore-search-filters-and-listing-grid.md` | P1 | M | 036, 037 | **DONE** | `main` | `53629b4` |
| **039** | `039-accommodation-detail-and-booking-engine.md` | P1 | L | 036, 037, 038 | **DONE** | `advisor/039-accommodation-detail-and-booking-engine` | `0d7b2f5` |
| **040** | `040-checkout-lifecycle-shaparak-and-invoice.md` | P1 | M | 039 | **TODO** | `advisor/040-checkout-lifecycle-shaparak-and-invoice` | `677a622` |
| **041** | `041-my-trips-cancellation-preview-and-host-chat.md` | P1 | L | 036, 037 | **TODO** | `advisor/041-my-trips-cancellation-preview-and-host-chat` | `677a622` |
| **042** | `042-wishlists-and-travel-planning.md` | P2 | M | 036, 037 | **TODO** | `advisor/042-wishlists-and-travel-planning` | `677a622` |
| **043** | `043-host-dashboard-multi-step-wizard-and-calendar.md` | P1 | L | 035, 036, 037 | **TODO** | `advisor/043-host-dashboard-multi-step-wizard-and-calendar` | `677a622` |
| **044** | `044-real-jabama-data-seeding-pipeline.md` | P2 | M | 035 | **TODO** | `advisor/044-real-jabama-data-seeding-pipeline` | `677a622` |

*Status values*: `TODO` | `IN PROGRESS` | `DONE` | `BLOCKED` (with one-line reason) | `REJECTED` (with one-line rationale)

---

## Dependency Notes

- **012** depends on **011** because accommodation update logic is modified in both plans.
- **015** depends on **011** because payments and host reservation authorization are expanded in 011.
- **016** depends on **011** and **012** because batch blocking extends the pricing exception endpoints added in 012, and TTL expiry modifies reservation lifecycles.
- **017** depends on **011** because pricing calculation input schemas are updated.
- **018**, **019**, and **020** are self-contained and merged into `master`.
- **021**, **022**, **023**, and **024** are self-contained quality, security, and performance plans.
- **025**, **026**, **027**, and **028** are feature and direction spike plans.
- **029** is self-contained with no dependencies.
- **030** depends on **029** because calendar export headers (`PRODID` and `UID` domains) are aligned to Ashianak in 029 before token TTL hardening in 030.
- **031** is self-contained with no dependencies.
- **032**, **033**, and **034** are self-contained cleanup and optimization plans (recommended execution order: 032 -> 033 -> 034).

---

## Active Implementation Plans Overview (021–028)

1. **Plan 021 — Security Access Controls, Review Timing Guard & Race-Condition Hardening (`advisor/021-security-access-controls-and-race-condition-guards`)**:
   - Restricts unlisted/inactive accommodation details and calendar endpoints to authorized hosts/admins (HTTP 404 for unauthenticated callers).
   - Authenticates outbound iCal calendar export via secret feed tokens and masks internal reservation IDs.
   - Strictly enforces stay check-out time in `Asia/Tehran` timezone before allowing review submission.
   - Handles concurrent wishlist toggle collisions cleanly (`IntegrityError` rollback).
   - Writes normalized UTC datetimes back to instance fields in coupon schema validation.

2. **Plan 022 — Database Indexes, Unbounded Endpoints Pagination & Bounding-Box Spatial Optimization (`advisor/022-database-indexes-pagination-and-bounding-box-optimization`)**:
   - Enforces pagination (`skip` and `limit`) on unbounded listing endpoints (`/reservations/my`, `/reservations/host`, `/payments/my`, `/accommodations/my`, `/geo/cities`).
   - Introduces rectangular bounding box pre-filtering for spatial Haversine search and indexes `(latitude, longitude)`.
   - Creates composite indexes for reviews, reservations, and partial index for blocked dates on `pricing_exceptions`.

3. **Plan 023 — Architecture Service Consolidation, Migration Hygiene & Docs Alignment (`advisor/023-architecture-service-consolidation-and-migration-hygiene`)**:
   - Removes runtime DDL `create_all` from application lifespan in `main.py`, relying on Alembic entrypoints.
   - Enables `compare_type=True` and `compare_server_default=True` in Alembic's `env.py`.
   - Consolidates duplicated reservation TTL cancellation logic between `payments.py` and `reservation_service.py`.
   - Reconciles `README.md` and `app/main.py` descriptions with implemented multi-host capabilities.

4. **Plan 024 — Automated Test Coverage Expansion & Test Suite Type Hardening (`advisor/024-test-coverage-expansion-and-mypy-hardening`)**:
   - Adds test suites for user profile updates (`PUT /auth/me`), email collision rejections, and admin user lookups (`GET /users/{id}`).
   - Adds boundary tests for spatial search coordinates (out-of-range boundaries and NULL coordinates).
   - Resolves Mypy test suite type narrowing errors in `test_reviews.py` and `test_cancellation.py`.

5. **Plan 025 — Direction: Room & Bed Count Search Filters and Minimum Stay Constraints (`advisor/025-direction-room-bed-search-filters-and-minimum-stay`)**:
   - Adds `min_rooms` and `min_beds` query parameters to public accommodation search.
   - Adds `min_nights` duration requirements to `Accommodation` and `PricingException`, enforcing them during booking.

6. **Plan 026 — Direction: Two-Way External Calendar Sync & iCal Feed Import (`advisor/026-direction-two-way-calendar-sync-and-ical-import`)**:
   - Adds `external_calendar_url` to accommodations and implements `POST /accommodations/{id}/calendar/sync` to parse remote `VEVENT` blocks into blocked calendar dates.

7. **Plan 027 — Direction: Host Payout Ledger, Banking Info & Platform Commission Tracking (`advisor/027-direction-host-payout-ledger-and-commission-tracking`)**:
   - Adds Iranian Shaba banking number validation to `User`.
   - Introduces `HostPayout` ledger, automatic 10% platform commission deductions on completed bookings, and host settlement reporting endpoints.

8. **Plan 028 — Direction: Host-Guest In-Stay Messaging & Coordination System (`advisor/028-direction-host-guest-reservation-messaging`)**:
   - Introduces `ReservationMessage` model and endpoints `GET` / `POST /reservations/{id}/messages` restricted to stay participants and admins.

---

## Historical Summary of Plans 018–020

1. **Plan 018 — Zero-Payable Concurrency Lock, Orphan Payment Cleanup & Conflict Abort Handling (`c9864df`)**:
   - Serialized zero-payable / 100% coupon bookings under accommodation row locks, eliminating double-bookings.
   - Transitioned orphan pending payments to `failed` upon reservation cancellation.
   - Aborted doomed reservations and restored coupon quota immediately on payment verification conflicts.

2. **Plan 019 — Accommodation Search Deduplication, Deterministic Pagination & Image Deletion Guard (`d7bcb2b`)**:
   - Deduplicated `amenity_ids` query parameters before filtering.
   - Added deterministic `Accommodation.id.desc()` secondary tie-breaker to all listing queries.
   - Verified image existence in `remove_accommodation_image`, returning HTTP 404 instead of silent 204.

3. **Plan 020 — Iranian Mobile Phone Canonical Normalization and Auth Integrity (`96dfc45`)**:
   - Standardized Iranian phone inputs to canonical `09XXXXXXXXX` format using Pydantic v2 `mode="before"` validators and Persian/Arabic numeral conversion.
   - Enforced case-insensitive email uniqueness during registration, login, and profile updates.

---

## Historical Summary of Plans 011–017

1. **Plan 011 — Host Reservation Detail Access, Capacity Validation & User Pagination Order (`advisor/011-host-reservation-access-and-capacity-validation`)**:
   - Resolves host access to `GET /reservations/{id}` for bookings on their properties (fixing 403 Forbidden).
   - Validates partial capacity updates in `PUT /accommodations/{id}`, preventing PostgreSQL 500 check constraint failures.
   - Enforces deterministic `order_by(User.id.asc())` for user pagination.

2. **Plan 012 — Pricing Exception Deletion, Amenities Update & Wishlist Pagination (`advisor/012-exception-deletion-and-amenities-update`)**:
   - Implements `DELETE /accommodations/{id}/pricing-exceptions/{exception_date}` enabling hosts to clear calendar overrides.
   - Adds `amenity_ids` update support to `AccommodationUpdate` and `PUT /accommodations/{id}` with session cache expiration (`db.expire_all()`).
   - Enforces bounded `skip` and `limit` pagination on `GET /wishlists/`.

3. **Plan 013 — Complete Alembic Baseline Migration & Self-Bootstrapping CI Test Suite (`advisor/013-alembic-baseline-and-test-bootstrapping`)**:
   - Replaces empty `pass` in `f7963f5ca621_baseline_schema.py` with full DDL declarations for all 13 tables, indexes, and constraints.
   - Adds automatic seed bootstrapping in `tests/conftest.py`, ensuring clean clones pass all tests out of the box.

4. **Plan 014 — DX Tooling, Mypy Typecheck Resolution & Ruff Lint Compliance (`advisor/014-dx-mypy-and-ruff-cleanup`)**:
   - Adds missing `__init__.py` markers across all package directories.
   - Resolves FastAPI variable shadowing conflict in `app/main.py`, enabling clean `mypy` execution.
   - Fixes all 115 Ruff formatting and lint errors and enforces production `SECRET_KEY` validation.

5. **Plan 015 — Extended Search, Sorting, and Payment Automated Test Coverage (`advisor/015-search-sorting-and-payments-test-coverage`)**:
   - Adds automated tests for multi-amenity filtering (`amenity_ids` intersection).
   - Adds automated tests for price sorting (`price_asc` and `price_desc`).
   - Adds test suites covering `GET /payments/my` and `GET /payments/{id}` authorization.

6. **Plan 016 — Direction: Pending Reservation Expiry (TTL) & Batch Date Blocking (`advisor/016-reservation-ttl-and-batch-blocking`)**:
   - Implements 30-minute auto-expiry for unpaid pending reservations and maintenance sweep endpoint.
   - Implements `POST /accommodations/{id}/pricing-exceptions/batch` allowing hosts to block or adjust rates across date ranges.

7. **Plan 017 — Direction: Promotional Discount Coupons Engine (`advisor/017-promotional-discount-coupons`)**:
   - Creates `Coupon` ORM model, validation schemas, and admin management endpoints.
   - Integrates percentage and fixed discounts with caps and minimum order requirements into the pricing engine.

---

## Historical Summary of Plans 001–010

1. **Plan 001 — Tiered Cancellation and Refund Mechanism**: Localized check-in times, tiered policy calculations (`flexible`, `moderate`, `strict`).
2. **Plan 002 — Multi-Host Ownership**: Added `host_id` foreign key, scoped update/delete permissions to hosts and admins.
3. **Plan 003 — Transparent Pricing Breakdown**: Itemized fee breakdown in pricing calculations and preview endpoints.
4. **Plan 004 — Concurrency Row-Level Locking**: Implemented `with_for_update` locking on payments and accommodations to eliminate double-booking race conditions.
5. **Plan 005 — Proof-of-Stay & Security Hardening**: Post-stay review validation (`check_out <= date.today()`), payment tracking validation, CORS origin restriction.
6. **Plan 006 — Iran Timezone Synchronization**: Localized check-in times to `Asia/Tehran`, enforced future-date reservation validation.
7. **Plan 007 — Query Optimization & Connection Pooling**: Switched to `AsyncAdaptedQueuePool`, optimized ORM relationships with `joinedload`, added composite B-Tree indexes.
8. **Plan 008 — Alembic Migrations & Tooling**: Initialized async Alembic migrations stamped at `f7963f5ca621`.
9. **Plan 009 — Test Suite Isolation**: Transaction savepoints with automatic rollback in `tests/conftest.py`, expanded RBAC edge-case tests.
10. **Plan 010 — Host Portal, Spatial Radius Search & iCal Export**: Implemented host `/my` listings, `/host` reservations, Haversine spatial radius filtering, and RFC 5545 iCal feed export.

---

## Findings Considered and Rejected

- **Direct Banking Reversal Webhooks in Phase 1**: Simulating refund records in `Payment` with tracking code covers all functional requirements without third-party PSP sandbox dependencies.
- **PostGIS Extension Installation for Spatial Queries**: Standard PostgreSQL mathematical functions (`acos`, `cos`, `sin`, `radians`) with trigonometric clamping provide sub-millisecond Haversine execution with zero additional OS dependencies.
- **Dynamic Policy Expression Language (DSL) for Cancellations**: Hardcoded tiered cancellation math with `ZoneInfo("Asia/Tehran")` covers 100% of current business requirements with zero maintenance overhead compared to a dynamic rule evaluator.

## Active Implementation Plans Overview (029–034)

1. **Plan 029 — Brand Renaming — "جابه‌ما" → "آشیانک" (`advisor/029-brand-rename-and-project-identity`)**:
   - Renames project identity from `jabama-backend` → `ashianak-backend` across `pyproject.toml`, `README.md`, `.env.example`, `.env`, and `app/main.py` API documentation.
   - Updates `PROJECT_NAME` in `app/core/config.py` to drive OpenAPI title.
   - Updates `export_accommodation_calendar_ics` headers (`PRODID` and `UID` domains) in `app/api/v1/endpoints/accommodations.py` to prevent brand leakage in external calendars.

2. **Plan 030 — Security Hardening: Time-Bounded iCal Feed Token TTL & Expiry (`advisor/030-ical-feed-token-ttl-and-expiry`)**:
   - Adds `CALENDAR_FEED_TTL_MINUTES` setting (7 days default).
   - Updates `generate_calendar_feed_token` to return `{ts}:{signature}` format.
   - Adds UTC expiration validation helper `validate_calendar_feed_token`.
   - Secures calendar export route with uniform 404 responses for missing/expired tokens to prevent listing enumeration.
   - Introduces host/admin rotation endpoint `POST /api/v1/accommodations/{id}/calendar/token`.
   - Adds 7 dedicated tests in `tests/test_ical_security.py`.

3. **Plan 031 — Booking Validation: Bulk Blocking Range Cap & Pricing-Exception Date Limits (`advisor/031-booking-validation-bulk-blocking-range-cap`)**:
   - Adds configurable settings: `CALENDAR_MAX_BLOCK_DAYS = 90`, `CALENDAR_MAX_BLOCKED_DATES = 1000`, `RESERVATION_MAX_CHECKIN_MONTHS = 18`.
   - Caps batch blocking date range to 90 days in schema validator.
   - Enforces an 18-month booking horizon (540 days in `Asia/Tehran`) in reservation creation and price preview.
   - Adds pre-mutation invariant ceiling check in `batch_pricing_exceptions` before running database write loops.
   - Adds 7 dedicated boundary tests in `tests/test_batch_blocking_limits.py`.

4. **Plan 032 — Dead Code & Dependency Pruning — Pyproject, Schemas Barrel & Dead Config Elimination (`advisor/032-dead-code-and-dependency-pruning`)**:
   - Removes unused dependencies `python-multipart` and `email-validator` from `pyproject.toml`.
   - Replaces `EmailStr` with standard string and strict regex validation in `app/schemas/user.py`, and adds negative invalid-email tests in `tests/test_auth.py`.
   - Clears dead 85-line schema barrel re-exports from `app/schemas/__init__.py`.
   - Prunes dead `DB_POOL_TYPE` and `NullPool` branching in `app/core/config.py` and `app/core/database.py`.

5. **Plan 033 — Database Operations Simplification — Atomic Upsert & Redundant Query Pruning (`advisor/033-database-operations-simplification`)**:
   - Replaces Python while-loop date mutation in `batch_pricing_exceptions` with single-roundtrip `pg_insert(...).on_conflict_do_update(...)`.
   - Eliminates speculative pre-insert `SELECT` existence checks across `amenities.py`, `categories.py`, `geo.py`, and `coupons.py`, relying directly on database unique constraints with `IntegrityError` rollback.
   - Retains strict foreign-key verification for provinces in `create_city` and preserves full Mypy type-safety on list response models.

6. **Plan 034 — Service & Endpoint Deduplication — Accommodation Listing, Reservation Expiry & Date Validation Consolidation (`advisor/034-service-and-endpoint-deduplication`)**:
   - Consolidates duplicated accommodation item mapping and review rating aggregation into `_build_accommodation_list_items` helper in `accommodations.py`.
   - Consolidates duplicate reservation TTL cancellation logic into `_cancel_reservation_record` in `reservation_service.py` and removes redundant `selectinload(Reservation.payments)`.
   - Unifies `accommodation_title` enrichment across all 4 reservation endpoints via `_serialize_reservation`.
   - Extracts `BaseReservationRequest` encapsulating all 5 shared fields and date range validation for `PriceCalculationRequest` and `ReservationCreate`, while retaining defense-in-depth date validation in `pricing_service.py`.

7. **Future Direction (Roadmap) — Frontend: Ashianak UI with Warm Persian Hospitality Design System (`advisor/035-frontend-warm-persian-hospitality`)**:
   - Spikes and implements the Radix-based frontend (`warm_persian_hospitality`) as the default theme — RTL-first Persian layout, terracotta/amber/teal palette, accommodation listing cards, search pill, sticky booking widget, and detail page; includes theming toggle for `warm_persian_hospitality_dark`.


---

## Active Frontend & Full-Stack Implementation Plans (035–044)

> [!IMPORTANT]
> ### Strict UI Component & Theming Rules (Mandatory for all Frontend Plans)
> 1. **Zero Hand-Rolled Custom Primitives**: Never invent arbitrary custom buttons, hand-rolled modal overlays, custom `<span>` badges, custom `<div>` separators, or pulse divs.
> 2. **100% Canonical Shadcn UI Primitives**: Every UI element must strictly compose official Shadcn UI primitives (`Button`, `Card`, `Badge`, `Dialog`, `Sheet`, `Drawer`, `Alert`, `Input`, `InputOTP`, `Textarea`, `Checkbox`, `Slider`, `ToggleGroup`, `Tabs`, `Avatar`, `Separator`, `Skeleton`).
> 3. **Zero Hardcoded Colors**: Inline hex colors (e.g. `#F05A28`, `#111C2D`) and arbitrary custom Tailwind color classes are strictly prohibited. All colors must consume semantic CSS variables in `globals.css` (`bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-muted`, `border-border`, etc.).
> 4. **Mobile-First Responsive Design**: Full native support for Mobile (<640px), Tablet (640-1023px), and Desktop (>=1024px) with dedicated mobile fixed bottom bars, mobile bottom drawers/sheets, and minimum 44px tap targets.


8. **Plan 035 — Extend Backend with OTP Authentication and Host-Role Listing Creation (`advisor/035-backend-otp-and-host-role-extension`)**:
   - Introduces `POST /api/v1/auth/otp/send` and `POST /api/v1/auth/otp/verify` with test code `1234` for rapid evaluation.
   - Automatically registers guest accounts upon first OTP verification and issues JWT Bearer tokens.
   - Implements `POST /api/v1/auth/become-host` and expands `create_accommodation` access to the `host` role.

9. **Plan 036 — Scaffold Next.js 14 App with TypeScript, Tailwind CSS, Shadcn UI, and Warm Persian Theme (`advisor/036-nextjs-shadcn-scaffold-and-warm-persian-theme`)**:
   - Bootstraps Next.js App Router inside `frontend/` with TypeScript, Tailwind CSS, and Shadcn UI.
   - Maps tokens verbatim from `template/warm_persian_hospitality/DESIGN.md` into `globals.css` (Terracotta Coral `#F05A28`, Warm Amber `#D97706`, Persian Teal `#0D9488`, Warm Stone White `#FAFAF9`).
   - Configures native RTL direction (`dir="rtl"`), Google Font `Vazirmatn`, responsive viewport meta, and mobile safe-area paddings.
   - Establishes core responsive breakpoint architecture: Mobile (<640px / 4-col), Tablet (640-1023px / 8-col), Desktop (1024-1439px / 12-col), Wide Desktop (>=1440px / 1360px centered).
   - Implements core Shadcn primitives including mobile slide-up drawer/sheet (`sheet.tsx`) and touch targets >= 44px.
   - Creates strongly-typed `apiClient` pointing to local backend `http://localhost:8000/api/v1`.

10. **Plan 037 — Implement OTP Authentication Modal, Session Management, and Role Controls (`advisor/037-auth-otp-modal-and-session-state`)**:
    - Creates React `AuthContext` with persistent JWT token storage.
    - Implements adaptive two-step OTP presentation: slide-up **Bottom Sheet** on mobile (<640px) and centered dialog on desktop, with prominent banner indicating test code `1234`.
    - Implements dedicated **Fixed Mobile Bottom Navigation Bar** (`bottom-nav.tsx`) for 1-tap mobile navigation (خانه، علاقه‌مندی‌ها، سفرهای من، پروفایل/ورود).
    - Implements responsive navigation header with "میزبان شوید" CTA and user menu, plus responsive footer.

11. **Plan 038 — Implement Explore Page with Destination Search Pill, Category Bar, Filter Modal, and Listing Grid (`main`)**:
    - Implements segmented search pill on desktop and compact search shortcut on mobile opening a **Full-Screen 3-Step Search Drawer** (Destination, Dates, Guests).
    - Implements touch-momentum horizontal category selector bar (`overflow-x-auto scrollbar-none snap-x`).
    - Implements comprehensive filter: floating dialog on desktop and slide-up bottom sheet with sticky footer on mobile.
    - Renders responsive listing grid (1-col mobile, 2-col tablet, 3-col desktop, 4-col wide) with touch-swipeable 4:3 image carousels, ratings, and optimistic wishlist toggle.

12. **Plan 039 — Implement Accommodation Detail View, Photo Gallery, Availability Calendar, and Sticky Pricing Widget (`advisor/039-accommodation-detail-and-booking-engine`)**:
    - Implements adaptive photo presentation: 5-photo mosaic on desktop and edge-to-edge swipeable carousel on mobile.
    - Implements adaptive booking experience: sticky sidebar card on desktop and **Mobile Fixed Bottom Action Bar** with slide-up booking drawer on mobile.
    - Implements responsive Persian availability calendar: 2-month view on desktop, single-month touch calendar on mobile.
    - Displays verified proof-of-stay guest reviews with cleanliness, accuracy, and overall star ratings.

13. **Plan 040 — Implement Reservation Checkout, 30-Minute Countdown Timer, Shaparak Payment Simulation, and Print-Ready Invoice Modal (`advisor/040-checkout-lifecycle-shaparak-and-invoice`)**:
    - Implements responsive checkout layout with sticky top 30-minute reservation TTL countdown timer and **Mobile Sticky Bottom Pay Bar**.
    - Simulates Shaparak banking payment portal with responsive full-screen mobile sheet and numeric keypad support.
    - Implements official electronic fiscal invoice modal matching `template/pdf` with print-ready CSS (`window.print()`).

14. **Plan 041 — Implement My Trips Dashboard, Smart Cancellation Refund Modal, Review Submission, and Direct Host Chat (`advisor/041-my-trips-cancellation-preview-and-host-chat`)**:
    - Organizes reservations into All, Upcoming, Completed, and Cancelled tabs with direct mobile bottom-nav routing.
    - Renders vertically stacked trip cards on mobile with full-width touch action buttons.
    - Queries `/cancellation-preview` to calculate penalty fees and refundable amounts before cancellation inside an adaptive modal/sheet.
    - Implements 5-star review submission with touch rating stars (>=44px).
    - Implements slide-over chat drawer on desktop and full-screen mobile chat view with keyboard-aware composer.

15. **Plan 042 — Implement Wishlist Page, Folder Management, and Companion Travel Date Poll (`advisor/042-wishlists-and-travel-planning`)**:
    - Renders bookmarked properties in responsive grid (1-col mobile to 4-col desktop) with quick un-favorite actions.
    - Implements interactive companion date coordination poll modal/sheet matching `template/_33`.

16. **Plan 043 — Implement Host Portal, Multi-Step Accommodation Wizard (Steps 1–5), Fast Calendar Pricing, and Payout Ledger (`advisor/043-host-dashboard-multi-step-wizard-and-calendar`)**:
    - Implements mobile-first 5-step listing creation wizard with pinned top progress indicator and **Sticky Mobile Wizard Bottom Bar** ("مرحله قبل" / "مرحله بعد").
    - Implements quick calendar bottom sheet to bulk block dates and set custom rates matching `template/_6`.
    - Displays host financial earnings and payout ledger as touch cards on mobile and structured table on desktop matching `template/_20`.

17. **Plan 044 — Ingest Real Accommodations, Images, and Pricing from Jabama via MCP/Adapter (`advisor/044-real-jabama-data-seeding-pipeline`)**:
    - Employs verified `jagir-mcp` TypeScript adapter to fetch real vacation rentals across Ramsar, Chalus, Tehran, Rasht, Kish, and Isfahan.
    - Seeds authentic property specifications, high-resolution CDN images, and market prices in Toman into the local database.
