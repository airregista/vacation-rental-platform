# Plan 039: Implement Accommodation Detail View, Photo Gallery, Availability Calendar, and Sticky Pricing Widget

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 18fcde5..HEAD -- frontend/src/lib/api-client.ts app/api/v1/endpoints/accommodations.py app/schemas/accommodation.py app/api/v1/endpoints/reservations.py app/schemas/reservation.py app/api/v1/endpoints/reviews.py app/schemas/review.py frontend/src/types/accommodation.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/036-nextjs-shadcn-scaffold-and-warm-persian-theme.md, plans/037-auth-otp-modal-and-session-state.md, plans/038-explore-search-filters-and-listing-grid.md
- **Category**: direction
- **Planned at**: commit `18fcde5`, 2026-11-09

## Why this matters

The accommodation detail page (`/accommodations/[id]`) is the primary conversion surface where guests inspect photos, property specs, verified host credentials, house rules, and authentic proof-of-stay reviews. Crucially, the page features an interactive availability calendar and a sticky booking widget that connects to backend endpoint `POST /reservations/calculate-price` to provide real-time, transparent breakdown of nightly rates, cleaning fees, extra guest charges, and promotional coupon discounts before creating a reservation (`POST /reservations/`).

## Current state

The relevant backend endpoints and schemas as implemented today:

- `app/api/v1/endpoints/accommodations.py`:
  - `GET /api/v1/accommodations/{id}` returning `AccommodationDetail`:
    - `city`: `CityResponse | null` (nested with `name` and `province: { id, name }`)
    - `category`: `CategoryResponse | null` (nested with `id, title, slug`)
    - `host`: `UserResponse | null` (`id, first_name, last_name, avatar_url, phone, role, created_at`)
    - `min_nights`: `int = 1`
    - `check_in_time`: `time` (e.g. `"14:00:00"`)
    - `check_out_time`: `time` (e.g. `"12:00:00"`)
    - `cancellation_policy`: `"flexible" | "moderate" | "strict"`
    - `images`: `list[AccommodationImageResponse]` (`id, image_url, is_cover, sort_order`)
    - `amenities`: `list[AmenityResponse]` (`id, name, icon`)
  - `GET /api/v1/accommodations/{id}/calendar?days=60` returning `list[CalendarDayInfo]`:
    - `date`: `date` (`YYYY-MM-DD`)
    - `price`: `Decimal`
    - `is_available`: `bool`
    - `is_exception`: `bool`
    - `min_nights`: `int | null`
- `app/api/v1/endpoints/reservations.py`:
  - `POST /api/v1/reservations/calculate-price` accepting `PriceCalculationRequest`:
    - Request payload: `{ "accommodation_id": int, "check_in": date, "check_out": date, "guests_count": int, "coupon_code": str | null }`
    - Response schema `PriceCalculationResponse`:
      - `total_nights`: `int`
      - `nights_total`: `Decimal`
      - `extra_guests_count`: `int`
      - `extra_guest_fee_per_night`: `Decimal`
      - `extra_guest_total`: `Decimal`
      - `cleaning_fee`: `Decimal`
      - `discount_amount`: `Decimal`
      - `coupon_code`: `str | null`
      - `total_price`: `Decimal`
      - `cancellation_policy`: `str`
      - `breakdown`: `list[PriceBreakdownItem]` with `{ date: date, price: Decimal, is_exception: bool }`
  - `POST /api/v1/reservations/` accepting `ReservationCreate` and creating pending reservation with 30-min TTL.
- `app/api/v1/endpoints/reviews.py`:
  - `GET /api/v1/accommodations/{accommodation_id}/reviews` returning `list[ReviewResponse]`:
    - `id`: `int`
    - `rating`: `int` (1 to 5)
    - `cleanliness_rating`: `int | null` (1 to 5)
    - `accuracy_rating`: `int | null` (1 to 5)
    - `comment`: `str`
    - `created_at`: `datetime`
    - `user`: `ReviewAuthor | null` (`id, first_name, last_name, avatar_url`)
- `frontend/src/lib/api-client.ts`:
  - `BASE_URL` is already configured with `/api/v1` (`http://localhost:8000/api/v1`).
  - **Never prepend `/api/v1` in `apiClient` calls**. Use relative endpoints such as:
    - `apiClient.get('/accommodations/' + id)`
    - `apiClient.get('/accommodations/' + id + '/calendar?days=60')`
    - `apiClient.post('/reservations/calculate-price', payload)`
    - `apiClient.get('/accommodations/' + id + '/reviews')`
    - `apiClient.post('/reservations/', payload)`
- Exemplar styling & number formatting:
  - `frontend/src/components/explore/accommodation-card.tsx` uses `new Intl.NumberFormat("fa-IR").format(...)` for Persian numerals and prices, and `unoptimized` on `next/image` for dynamic listing images.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false` | exit 0, no output |
| Lint      | `npm --prefix frontend run lint` | exit 0 |
| Build     | `npm --prefix frontend run build` | exit 0, compiled successfully |
| Backend pricing contract test | `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest tests/test_reservations.py tests/test_accommodations.py -k "booking or minimum_stay or accommodation_calendar" -v` | exit 0, all pass |

## Strict Shadcn/UI Component Governance

All sections on the detail page strictly compose canonical Shadcn UI primitives:
- **Booking Widget & Cards**: Canonical `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- **Overlays**: Canonical `Dialog` (for full-screen gallery lightbox) and canonical `Sheet` with `side="bottom"` (for mobile slide-up booking drawer).
- **Buttons**: Canonical `Button` (`default`, `outline`, `ghost`).
- **Badges**: Canonical `Badge` (`variant="secondary"`, `variant="outline"`, `variant="default"`).
- **Avatars**: Canonical `Avatar`, `AvatarImage`, `AvatarFallback`.
- **Alerts & Separators**: Canonical `Alert`, `AlertTitle`, `AlertDescription`, canonical `Separator`.
- **Form Controls**: Canonical `Input` (for coupon code input).
- **Progress Bars**: Render rating score indicators using standard styled Tailwind divs (e.g. `relative h-2 w-full overflow-hidden rounded-full bg-secondary` with inner `h-full bg-primary`) since `@/components/ui/progress` is not part of this repository.
- **Colors**: Strictly consumes CSS variables from `globals.css` (`bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-muted`, `border-border`, `bg-card`).

## Scope

**In scope** (the only files you should create or modify):
- `frontend/src/types/detail.ts` (create — detail, calendar, calculation, and review interfaces)
- `frontend/src/components/accommodation/photo-gallery.tsx` (create — 5-photo collage and lightbox modal)
- `frontend/src/components/accommodation/availability-calendar.tsx` (create — month grid with nightly rates and blocked days)
- `frontend/src/components/accommodation/host-card.tsx` (create — host avatar, verified badge, bio, response rate)
- `frontend/src/components/accommodation/amenities-list.tsx` (create — amenity icons and badges)
- `frontend/src/components/accommodation/reviews-section.tsx` (create — rating breakdown and guest comments)
- `frontend/src/components/accommodation/booking-widget.tsx` (create — sticky price calculator and reservation engine)
- `frontend/src/app/accommodations/[id]/page.tsx` (create — main detail page dynamic route)

**Out of scope**:
- Checkout and payment gateway simulation (deferred to Plan 040).
- Modifying backend endpoints or database schemas in `app/` (all backend contracts are read-only).
- Installing third-party libraries outside `frontend/package.json`.

## Git workflow

- Branch: `advisor/039-accommodation-detail-and-booking-engine`
- Commit style: `feat(accommodation): implement detail view, photo gallery, calendar, and price engine widget`

---

## Steps

### Step 1: Create Detail & Booking Type Definitions (`frontend/src/types/detail.ts`)

Define all detail, calendar, pricing calculation, and review interfaces exactly matching backend schemas:

```typescript
import type { City, Category, Amenity } from "@/types/accommodation"
import type { UserResponse } from "@/types/auth"

export interface AccommodationImage {
  id: number
  image_url: string
  is_cover: boolean
  sort_order: number
}

export interface AccommodationDetailData {
  id: number
  host_id: number
  category_id: number
  city_id: number
  title: string
  description: string | null
  address: string
  latitude: number | null
  longitude: number | null
  base_price: number
  cleaning_fee: number
  capacity: number
  max_capacity: number
  extra_guest_fee: number
  rooms_count: number
  beds_count: number
  min_nights: number
  check_in_time: string
  check_out_time: string
  rules: string | null
  cancellation_policy: "flexible" | "moderate" | "strict"
  is_active: boolean
  created_at: string
  host: UserResponse | null
  category: Category | null
  city: City | null
  images: AccommodationImage[]
  amenities: Amenity[]
  average_rating: number | null
  reviews_count: number
}

export interface CalendarDayInfo {
  date: string
  price: number
  is_available: boolean
  is_exception: boolean
  min_nights?: number | null
}

export interface PriceBreakdownItem {
  date: string
  price: number
  is_exception: boolean
}

export interface PriceCalculationRequest {
  accommodation_id: number
  check_in: string
  check_out: string
  guests_count: number
  coupon_code?: string | null
}

export interface PriceCalculationResponse {
  total_nights: number
  nights_total: number
  extra_guests_count: number
  extra_guest_fee_per_night: number
  extra_guest_total: number
  cleaning_fee: number
  discount_amount: number
  coupon_code: string | null
  total_price: number
  cancellation_policy: string
  breakdown: PriceBreakdownItem[]
}

export interface ReviewAuthor {
  id: number
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

export interface ReviewItem {
  id: number
  reservation_id: number
  user_id: number
  accommodation_id: number
  rating: number
  cleanliness_rating: number | null
  accuracy_rating: number | null
  comment: string
  created_at: string
  user: ReviewAuthor | null
}

export interface ReservationCreateRequest {
  accommodation_id: number
  check_in: string
  check_out: string
  guests_count: number
  coupon_code?: string | null
}

export interface ReservationResponse {
  id: number
  user_id: number
  accommodation_id: number
  check_in: string
  check_out: string
  guests_count: number
  total_nights: number
  total_price: number
  coupon_code: string | null
  status: "pending" | "confirmed" | "cancelled" | "completed"
  created_at: string
  updated_at: string
  accommodation_title?: string | null
}
```

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 2: Implement Photo Gallery Mosaic & Modal (`frontend/src/components/accommodation/photo-gallery.tsx`)

1. **Component Contract**:
   ```typescript
   export interface PhotoGalleryProps {
     images: AccommodationImage[]
     title: string
     isFavorite?: boolean
     onToggleFavorite?: () => void
   }
   ```
   Support controlled or uncontrolled favorite state: if `isFavorite` and `onToggleFavorite` are passed from page level, mobile hero heart icon reflects and updates the unified page wishlisted state.

2. **Adaptive Image Count Presentation (Desktop >= lg)**:
   - Ensure image containers specify `position: relative` for Next.js `<Image fill ... />`.
   - Use Next.js `<Image unoptimized ... fill className="object-cover" />` with `alt={title}`.
   - **0 images**: Render clean fallback placeholder container with `Home` or `Image` icon and "بدون تصویر".
   - **1 image**: Render single full-width hero cover container (`relative aspect-[21/9] w-full overflow-hidden rounded-2xl bg-muted`).
   - **2 to 4 images**: Render adaptive layout without accessing undefined array slots:
     - 2 images: 2-column grid (`grid-cols-2`).
     - 3 images: Featured cover spans 2 columns (`col-span-2`), secondary container spans 1 column with 2 rows (`grid-rows-2`).
     - 4 images: Featured cover spans 2 columns (`col-span-2`), secondary container spans 1 column with 3 rows (`grid-rows-3`), ensuring no empty columns in `grid-cols-3`.
   - **5+ images**: RTL 5-image collage grid:
     - Main 2x2 featured cover on right (spans 2 columns and 2 rows).
     - 4 secondary thumbnail images in 2x2 grid on left.
     - Bottom-left floating button: "مشاهده تمام تصاویر" with `Grid` Lucide icon opening full-screen lightbox modal (`Dialog`).

3. **Mobile Presentation (< lg)**:
   - Aspect ratio `aspect-[4/3]` carousel with swipe gestures or slide buttons.
   - Differentiate swipe gestures from tap/clicks via a swipe ref (`isSwiping`) so swipe motions cycle carousel images without inadvertently triggering the full-screen lightbox modal.
   - Top floating back link to `/` and wishlist button.
   - Bottom badge counter formatted with Persian digits (e.g. `۱ از ۵`).

4. **Full-screen Lightbox Modal (`Dialog`)**:
   - Canonical `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, and `<DialogDescription className="sr-only">مشاهده تصاویر اقامتگاه در اندازه بزرگ</DialogDescription>` to ensure full Radix UI accessibility compliance without console warnings.
   - Main image viewer with prev/next chevron buttons (`aria-label="تصویر بعدی"` / `"تصویر قبلی"`) and keyboard ArrowRight / ArrowLeft navigation.
   - Bottom thumbnail strip allowing direct click selection of active photo.

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 3: Implement Availability Calendar (`frontend/src/components/accommodation/availability-calendar.tsx`)

1. **Component Contract**:
   ```typescript
   export interface AvailabilityCalendarProps {
     accommodationId: number
     minNights: number
     basePrice: number
     checkIn: string | null
     checkOut: string | null
     onDateRangeChange: (checkIn: string | null, checkOut: string | null) => void
   }
   ```

2. **Data Fetching**:
   - Fetch availability from `apiClient.get<CalendarDayInfo[]>(`/accommodations/${accommodationId}/calendar?days=60`)`.
   - Store calendar days indexed by date string (`Map<string, CalendarDayInfo>` or record) for O(1) date availability lookups.

3. **Display & Persian Localization**:
   - Render 2 side-by-side months on desktop with month pagination navigation (Prev/Next buttons over `months.slice(desktopMonthIndex, desktopMonthIndex + 2)`) to allow browsing through all 60 days without truncating the third month. 1 month with month switcher navigation on mobile.
   - Persian month headers (e.g. `آبان ۱۴۰۵`, `آذر ۱۴۰۵`) using native `new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "UTC", month: "long", year: "numeric" })`. All `Intl.DateTimeFormat` calls formatting ISO calendar strings (`YYYY-MM-DD`) must explicitly specify `{ timeZone: "UTC" }` to prevent negative timezone drift (e.g. clients in Americas) from shifting dates and leading blank days backwards by 1 full day.
   - Day names in Persian: `ش`, `ی`, `د`, `س`, `چ`, `پ`, `ج`.
   - Days rendered with Persian numerals (`new Intl.NumberFormat("fa-IR").format(day)`).
   - Nightly price displayed in small font beneath available dates formatted with `new Intl.NumberFormat("fa-IR").format(Math.round(price / 1000))` (in thousands of Tomans without non-standard English-derived 'ک' suffix, adhering to the explanatory caption).
   - Booked or blocked days (`is_available === false`) rendered with muted text, strikethrough, and disabled pointer events (`pointer-events-none opacity-40`).
   - Retain unique DOM id: Ensure `id="availability-calendar"` is placed solely on the wrapping `<section>` or the component root div, preventing duplicate DOM IDs.
   - Minimum stay notice rendered in canonical `Alert` if `minNights > 1`: "حداقل مدت اقامت در این اقامتگاه ۲ شب است".

4. **Date Range Selection State Machine & Invariants**:
   - Invariant: A valid check-out date must satisfy $(checkOut - checkIn) \ge requiredMinNights$ and NO day in the range $[checkIn, checkOut)$ may have `is_available === false`. Note that `checkOut` itself is departure day and is allowed to be the first day of an upcoming booking or blocked range.
   - Active check-in cell styling: Standalone check-in date (`checkIn && !checkOut`) receives full `rounded-lg` corners; when `checkOut` is selected, `isStart` switches to `rounded-r-lg rounded-l-none` to connect into the selected range.
   - Active check-out cell styling guard: When `cell.isoDate === checkOut`, ensure `isBlocked` is false (`(!cell.dayInfo.is_available && !canBeCheckout) && !isEnd`), so that the active departure end-cap is rendered with `isEnd` styling (`bg-primary text-primary-foreground`) rather than strikethrough/disabled.
   - Minimum stay validation: Calculate `requiredMinNights` by scanning all stayed nights in $[checkIn, clickedDate)$ for the maximum `dayInfo.min_nights` (matching backend `app/services/pricing_service.py`), rather than checking only the departure date.
   - User interaction rules:
     - **Initial click** (or when both dates already selected): Requires an available date; sets `checkIn = clickedDate` and resets `checkOut = null`.
     - **Second click (checkout selection)**:
       - If `clickedDate <= checkIn`: If `clickedDate` is available, resets `checkIn = clickedDate` and clears `checkOut = null`.
       - If any night strictly in $[checkIn, clickedDate)$ is unavailable: Blocks selection and resets `checkIn = clickedDate` (if `clickedDate` is available).
       - If $(clickedDate - checkIn) < requiredMinNights$: Disallows check-out and alerts user ("حداقل مدت اقامت در این بازه {requiredMinNights} شب است").
       - Otherwise: Sets `checkOut = clickedDate` and dispatches `onDateRangeChange(checkIn, clickedDate)` to parent / booking widget (allowed even if `clickedDate`'s following night is booked).

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 4: Implement Host Card & Bio (`frontend/src/components/accommodation/host-card.tsx`)

1. **Component Contract**:
   ```typescript
   export interface HostCardProps {
     host: UserResponse | null
     checkInTime: string
     checkOutTime: string
     cancellationPolicy: string
     rules: string | null
   }
   ```

2. **Host Header & Verified Credentials**:
   - Canonical `Avatar`, `AvatarImage`, `AvatarFallback` using `host?.avatar_url` and host initials.
   - Host full name: `{host?.first_name || ""} {host?.last_name || ""}`.trim() or fallback "میزبان مهمان‌شو".
   - Persian joined date: "عضویت از " formatted via `Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long" })`.
   - Badges (presentation badges):
     - Verified Host badge (`Badge variant="secondary"`): "میزبان تایید شده" with `ShieldCheck` icon.
     - Response time badge: "پاسخ‌گویی کمتر از ۱ ساعت" with `Clock` icon (static presentation copy; backend does not track chat latency metrics).

3. **Property Rules & Check-in Times**:
   - Display `checkInTime` ("ساعت ورود: ۱۴:۰۰") and `checkOutTime` ("ساعت خروج: ۱۲:۰۰").
   - Cancellation policy badge: "سیاست لغو " + (`انعطاف‌پذیر` / `متوسط` / `سخت‌گیرانه`).
   - House rules string (`rules`) formatted cleanly with bullet points or paragraphs.

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 5: Implement Amenities List & Reviews Section

1. `frontend/src/components/accommodation/amenities-list.tsx`:
   - **Component Contract**:
     ```typescript
     export interface AmenitiesListProps {
       amenities: Amenity[]
     }
     ```
   - Categorized grid of amenities with Lucide icons (Wi-Fi: `Wifi`, Parking: `Car`, Pool: `Waves`, Kitchen: `Utensils`, TV: `Tv`, Air conditioning: `Wind`, Heating: `Flame`, fallback: `Check`).
   - "نمایش همه امکانات" dialog or toggle if listing has more than 8 amenities; provide accessible `<DialogDescription className="sr-only">...</DialogDescription>` inside `DialogContent` to prevent Radix UI console warnings.

2. `frontend/src/components/accommodation/reviews-section.tsx`:
   - **Component Contract**:
     ```typescript
     export interface ReviewsSectionProps {
       accommodationId: number
       averageRating: number | null
       reviewsCount: number
     }
     ```
   - Fetch reviews from `apiClient.get<ReviewItem[]>(`/accommodations/${accommodationId}/reviews`)`.
   - **Ratings Header & Client-Side Aggregations**:
     - Display overall average rating (`averageRating`) with `Star` icon and total review count (`reviewsCount`).
     - **Cleanliness & Accuracy Averages**: Derived client-side from fetched `ReviewItem[]` (since `GET /reviews` returns individual items and backend does not return sub-rating aggregates):
       - Average `cleanliness_rating` across reviews where `r.cleanliness_rating !== null`.
       - Average `accuracy_rating` across reviews where `r.accuracy_rating !== null`.
       - If no reviews have sub-ratings, omit the sub-rating indicator bars cleanly.
       - Display rating score bars using standard styled Tailwind divs (`relative h-2 w-full overflow-hidden rounded-full bg-secondary` track with `h-full bg-primary` fill).
   - **Review Cards**:
     - Author avatar (`Avatar`) with initial fallback prioritizing `review.user?.first_name?.[0] || review.user?.last_name?.[0] || "ک"`, full name (`user?.first_name user?.last_name` or "کاربر مهمان‌شو"), Persian date formatted via `Intl.DateTimeFormat("fa-IR")`.
     - Star rating icons (1 to 5).
     - Review text comment.
     - Clean empty state when `reviews.length === 0`: "هنوز نظری برای این اقامتگاه ثبت نشده است".

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 6: Implement Sticky Booking Engine Widget (`frontend/src/components/accommodation/booking-widget.tsx`)

1. **Component Contract**:
   ```typescript
   export interface BookingWidgetProps {
     accommodation: AccommodationDetailData
     checkIn: string | null
     checkOut: string | null
     onDateRangeChange: (checkIn: string | null, checkOut: string | null) => void
   }
   ```

2. **Desktop Widget (>= lg)**:
   - Fixed sticky position: `lg:sticky lg:top-28`.
   - Canonical `Card`, `CardHeader`, `CardContent`, `CardFooter` with Level 4 elevation.
   - **Base Rate Header**: Nightly base price formatted in Persian numerals + "تومان / هر شب".
   - **Date Selector**: Check-in and check-out dates input trigger displaying Persian formatted dates using `new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "UTC", month: "numeric", day: "numeric" })`; trigger containers must provide accessible keyboard attributes (`role="button"`, `tabIndex={0}`, and `onKeyDown` handlers).
   - **Guests Stepper**: Increments/decrements guests count with accessible `aria-label` attributes ("افزایش تعداد نفرات" / "کاهش تعداد نفرات"):
     - Min: `1` (decrement button disabled at 1).
     - Max: `accommodation.max_capacity` (increment button disabled at max capacity).
     - Displays notice if `guests_count > accommodation.capacity`:
       "نفر اضافه: {guests_count - accommodation.capacity} نفر × {format(accommodation.extra_guest_fee)} تومان هر شب"
   - **Coupon Code Input & Error Isolation**:
     - Canonical `Input` with "اعمال" (Apply) button.
     - **Keystroke safety**: Do not fire price calculation network requests during coupon keystrokes; only submit coupon when user clicks "اعمال" or presses Enter.
     - **Error isolation**: If coupon validation fails with 400 (`Invalid or inactive coupon code`), isolate the error message directly under the coupon input ("کد تخفیف معتبر نیست یا منقضی شده است") and keep the base pricing calculated without `coupon_code`.
     - When valid coupon is applied: Show discount amount in green and provide a "حذف" (remove) button to revert coupon.
   - **Live Pricing Calculation (`POST /reservations/calculate-price`)**:
     - When `checkIn`, `checkOut`, and `guestsCount` are valid and satisfy $(checkOut - checkIn) \ge accommodation.min_nights$, calls:
       `apiClient.post<PriceCalculationResponse>("/reservations/calculate-price", { accommodation_id: accommodation.id, check_in: checkIn, check_out: checkOut, guests_count: guestsCount, coupon_code: appliedCoupon || undefined })`.
     - `isCalculating: boolean` state shows subtle loading spinner/skeleton on price breakdown.
     - **Error Handling & Network Fallback**: Isolate coupon 400 validation errors without blocking calculation; propagate backend `ApiError.message`; provide a fallback generic error notice ("خطا در برقراری ارتباط با سرور برای محاسبه قیمت.") for network drops/timeouts and clear `priceData` so the UI never displays stale calculation or disabled button ambiguity.
     - Renders itemized breakdown:
       - `nights_total`: تعداد شب‌ها ({total_nights} شب) × نرخ پایه
       - `extra_guest_total`: هزینه نفرات اضافه ({extra_guests_count} نفر)
       - `cleaning_fee`: هزینه نظافت
       - `discount_amount`: تخفیف کوپن (سبز رنگ در صورت اعمال)
       - `total_price`: **مجموع قابل پرداخت** (بزرگ و برجسته)
   - **Primary Action Button ("رزرو اقامتگاه") Guards**:
     - Disabled when: `!checkIn || !checkOut || isCalculating || isSubmitting || !effectivePriceData || (checkOut - checkIn) < accommodation.min_nights`. Prevent clicking reservation creation if price calculation returned an error.
     - Dynamic button label:
       - If `!checkIn || !checkOut`: "تاریخ سفر را انتخاب کنید"
       - If `isCalculating`: "در حال محاسبه قیمت..."
       - Otherwise: "رزرو اقامتگاه"
     - If `!isAuthenticated`: Calls `useAuth().openOtpModal()`.
     - If `isAuthenticated`: Calls `apiClient.post<ReservationResponse>("/reservations/", { accommodation_id: accommodation.id, check_in: checkIn, check_out: checkOut, guests_count: guestsCount, coupon_code: appliedCoupon || undefined })`.
     - On successful reservation creation: Redirects to `/checkout/{res.id}` (or informs user of created reservation ID pending Plan 040 checkout).

3. **Mobile Bottom Bar (< lg)**:
   - Fixed bottom action bar: `fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t border-border p-4 z-40`.
   - Left: Total price / price per night.
   - Right: Button "انتخاب تاریخ و رزرو" opening canonical `Sheet` with `side="bottom"` hosting the full booking card. `<SheetHeader>` must include `<SheetDescription className="sr-only">` for screen-reader accessibility and to eliminate Radix UI console warnings. Inside the sheet, when dates are not yet selected, provide an actionable button/link that dismisses the sheet and smoothly scrolls to `#availability-calendar` on the page so the user can easily select dates.

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 7: Assemble Accommodation Detail Page (`frontend/src/app/accommodations/[id]/page.tsx`)

1. **Dynamic Route Signature (Next.js 16 / React 19) & ID Guard**:
   - Handle async `params` Promise with defensive `NaN` / non-positive ID guard:
     ```typescript
     interface AccommodationPageProps {
       params: Promise<{ id: string }>
     }

     export default function AccommodationDetailPage({ params }: AccommodationPageProps) {
       const resolvedParams = React.use(params)
       const accommodationId = Number(resolvedParams.id)

       if (!accommodationId || isNaN(accommodationId) || accommodationId <= 0) {
         // Render clean 404 / not found state with return button to "/" without calling API
       }
       ...
     }
     ```
2. **Page Architecture & Responsive Layout**:
   - Fetch accommodation detail from `apiClient.get<AccommodationDetailData>(`/accommodations/${accommodationId}`)`.
   - Loading state: Render canonical `Skeleton` placeholders for breadcrumb, photo gallery, details, calendar, and sticky card.
   - If not found or error, render clean error / 404 alert with link back to explore (`/`).
   - Breadcrumb navigation: `صفحه اصلی / {city?.province?.name || ""} / {city?.name || ""} / {title}`.
   - Title, rating summary badge, address, and share/favorite buttons.
   - Photo Gallery Mosaic (passing `isFavorite={isWishlisted}` and `onToggleFavorite={() => setIsWishlisted(!isWishlisted)}` for unified wishlisted state across mobile and desktop headers).
   - Main container with bottom padding `pb-24 lg:pb-12` so the mobile fixed bottom action bar does not obscure content.
   - Two-Column Responsive Grid (`grid grid-cols-1 lg:grid-cols-12 gap-8 items-start`):
     - **Right Main Column (`lg:col-span-7 space-y-8`)**:
       - Host Card
       - Description & Specs (rooms, beds, capacity)
       - Amenities List
       - Availability Calendar (bound with shared `checkIn` and `checkOut` state)
       - Reviews Section
     - **Left Sticky Sidebar (`lg:col-span-5 hidden lg:block`)**:
       - Sticky Booking Widget (bound with shared `checkIn` and `checkOut` state)
   - Mobile Sticky Bottom Action Bar.

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
npm --prefix frontend run lint
npm --prefix frontend run build
```
→ All exit 0

---

## Test plan

### 1. Automated Typecheck and Lint Gate
Execute:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
npm --prefix frontend run lint
npm --prefix frontend run build
```
Expected: All exit 0 with 0 errors.

### 2. Component and Page Verification
Execute:
```powershell
Test-Path frontend/src/app/accommodations/[id]/page.tsx, frontend/src/components/accommodation/booking-widget.tsx, frontend/src/components/accommodation/photo-gallery.tsx, frontend/src/components/accommodation/availability-calendar.tsx, frontend/src/components/accommodation/host-card.tsx, frontend/src/components/accommodation/amenities-list.tsx, frontend/src/components/accommodation/reviews-section.tsx, frontend/src/types/detail.ts
```
Expected: All return True.

### 3. Backend Pricing Contract Test
Execute:
```powershell
& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest tests/test_reservations.py tests/test_accommodations.py -k "booking or minimum_stay or accommodation_calendar" -v
```
Expected: All pass.

---

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false` exits 0
- [ ] `npm --prefix frontend run lint` exits 0
- [ ] `npm --prefix frontend run build` exits 0
- [ ] `Test-Path frontend/src/app/accommodations/[id]/page.tsx` returns True
- [ ] `Test-Path frontend/src/components/accommodation/booking-widget.tsx` returns True
- [ ] `Test-Path frontend/src/components/accommodation/host-card.tsx` returns True
- [ ] `Test-Path frontend/src/types/detail.ts` returns True
- [ ] No files outside in-scope list are modified (`git status --porcelain`)
- [ ] `plans/README.md` status row updated to DONE upon completion

---

## STOP conditions

Stop and report back (do not improvise) if:

- Backend endpoint `POST /reservations/calculate-price` response schema differs from `PriceCalculationResponse`.
- The accommodation detail route crashes during static prerender (ensure dynamic route params are unwrapped via `React.use(params)` and client components are guarded against unmounted browser APIs).
- Third-party packages outside `package.json` are requested.
- In-scope files require touching backend logic or out-of-scope payment endpoints.

---

## Maintenance notes

- Photo gallery uses Next.js `<Image unoptimized .../>` because external user images are served from local backend / public uploads.
- Reservation hold state has a 30-minute server TTL; when Plan 040 (checkout) is implemented, a countdown timer can be synchronized with `created_at` timestamp.
- Dynamic route `params` in Next.js 16 is an asynchronous Promise; all child page components must resolve it before accessing `id`.

## Second-pass review fixes (2026-11-10)

- **Status: APPROVED 2026-11-10.** Executor commit `0cb1d40` on `advisor/039-review-fixes` (6 files). Reviewer re-ran tsc/lint/build (all exit 0) and the full suite: **106 passed**; read the full diff. R1–R6 all done. Two gate-forced deviations accepted: R6 uses React's render-adjustment reset (eslint rejects the effect version); R4 removed the now-unused `onDateRangeChange` prop from BookingWidget.
- **Planned at:** `438fdc8` (main, post-043 merge). **Source:** the 035–040 code review (2026-11-10): a coordinator subagent reviewed the net effect of plans 035–040 on main; the advisor verified every finding below against the live code before writing this section. 2 Medium, 4 Low.
- **Scope:** `frontend/src/components/accommodation/host-card.tsx`, `frontend/src/components/accommodation/reviews-section.tsx`, `frontend/src/components/accommodation/booking-widget.tsx`, `frontend/src/components/accommodation/availability-calendar.tsx`, `frontend/src/app/accommodations/[id]/page.tsx`, `frontend/src/components/accommodation/photo-gallery.tsx`. Nothing else. SKIP `plans/README.md` — the reviewer maintains it.

### R1 (Medium) — Strict cancellation policy text is wrong about refunds
- **File:** `frontend/src/components/accommodation/host-card.tsx:30`. `POLICY_LABELS.strict.desc` says "لغو تا ۷ روز قبل از تحویل با بازگشت ۵۰٪ مبلغ" (cancel up to 7 days before check-in, 50% refund). The backend (`app/services/cancellation_service.py:66-75`) is tiered: ≥14 days = full refund, 7–14 days = 50%, **<7 days = 0%**. The card omits the full-refund ≥14-day window and implies 50% applies all the way up to 7 days before.
- **Scenario:** a guest on a "strict" listing reads the card, cancels 3 days before check-in expecting half their money back, and gets nothing.
- **Fix:** describe the tiers — full refund ≥14 days, 50% at 7–14 days, no refund under 7 days.
- **Done when:** the strict card text states all three tiers and matches `cancellation_service.py` exactly.

### R2 (Medium) — Reviews fetch silently caps at 20; averages and "show more" are computed over a truncated sample
- **File:** `frontend/src/components/accommodation/reviews-section.tsx:32`. The fetch calls `/accommodations/${accommodationId}/reviews` with no `limit`, and the backend defaults `limit=20` (max 100, `app/api/v1/endpoints/reviews.py:20-25`). The header shows the true total (`reviewsCount` from the detail endpoint), but the list, the "show more" button (which can never reveal beyond 20), and the client-side cleanliness/accuracy averages are all computed over at most the 20 most recent reviews.
- **Scenario:** a listing with 87 reviews shows "۴.۵ · ۸۷ نظر" while only the 20 newest are ever displayed, and the cleanliness/accuracy bars reflect only those 20 — a recent cluster of bad (or good) reviews skews the displayed sub-ratings versus the true average.
- **Fix:** fetch with `?limit=100` so the list and sub-rating averages cover the same population the header claims (up to 100 reviews; full pagination beyond 100 is out of scope for this fix round).
- **Done when:** the fetch URL includes `limit=100`; a listing with >20 reviews shows more than 20 and its sub-rating averages are computed over the fetched set.

### R3 (Low) — Any 400 while a coupon is applied is reported as "invalid or expired coupon", and a failed fallback leaves no price error
- **File:** `frontend/src/components/accommodation/booking-widget.tsx:119-138`. The catch branch treats every `ApiError` 400 as a coupon failure: it shows "کد تخفیف معتبر نیست یا منقضی شده است", clears the coupon, and retries without it. But `calculate-price` also returns 400 for a coupon's minimum-subtotal or usage-limit failure — the coupon is valid, just inapplicable — and the fallback's own failure only does `setPriceData(null)` without setting `submitError`, so the book button ends up disabled with the label "رزرو اقامتگاه" and no price-error explanation. (Clearing the coupon also re-triggers the effect, so the no-coupon price is fetched twice.)
- **Fix:** only treat the 400 as a coupon error when the backend detail matches the invalid-coupon message; otherwise surface `err.message` via `setSubmitError`, and set `submitError` in the fallback catch.
- **Done when:** a 400 for minimum-subtotal/usage-limit shows the backend's message (not "invalid coupon") and keeps the coupon; a failed fallback shows a price error instead of a dead button.

### R4 (Low) — Clicking a date field silently wipes the selection instead of letting the user change it
- **File:** `frontend/src/components/accommodation/booking-widget.tsx:274-295`. The check-in box's click/keyboard handler calls `onDateRangeChange(null, null)` (clears both dates) and the check-out box calls `onDateRangeChange(checkIn, null)`; neither scrolls to the calendar nor labels itself as a clear action. On desktop there is no scroll-to-calendar affordance at all.
- **Scenario:** a guest with dates selected and a price calculated clicks the check-in field to adjust the date; both dates and the calculated price vanish with no guidance on how to re-pick.
- **Fix:** make the date boxes scroll to `#availability-calendar` (clearing only the field being edited, if anything), instead of wiping the range.
- **Done when:** clicking a date box scrolls to the calendar and preserves the existing selection (or clears only that one field); the price is not wiped by a click.

### R5 (Low) — Fetch failures are swallowed and rendered as false empty states
- **File:** `frontend/src/components/accommodation/availability-calendar.tsx:70` and `frontend/src/components/accommodation/reviews-section.tsx:38`. Both catches set the list to `[]` with no error state. The calendar then shows "اطلاعات تقویم برای این اقامتگاه یافت نشد" (indistinguishable from genuinely no data), and worse, the reviews section shows "هنوز نظری برای این اقامتگاه ثبت نشده است" — a factual claim that no reviews exist.
- **Fix:** track a fetch-error state in both components and render an error notice with a retry button instead of the empty state.
- **Done when:** a failed calendar/reviews fetch shows an error + retry (not "no data" / "no reviews"); a successful fetch after retry renders the data.

### R6 (Low) — Booking/gallery state is not reset when the `[id]` param changes client-side
- **File:** `frontend/src/app/accommodations/[id]/page.tsx:40-41` (+ calendar/widget/gallery/reviews state). `checkIn`/`checkOut`, the calendar's month indexes, the widget's guests/coupon/price, `visibleCount`, and the gallery's `activePhotoIndex` all live in components that persist across a client-side param change (no effect keyed on `accommodationId` resets them). There is no in-page link between listings, so this needs a manual URL edit, but the consequence is sharp: dates selected on listing A carry over to listing B (and can render as selected end-caps on days blocked on B), and the gallery indexes `sortedImages[activePhotoIndex]` unguarded (`photo-gallery.tsx:175,354`), so moving from a listing with 8 photos (viewing photo 7) to one with 2 photos throws a render-time TypeError.
- **Fix:** add `key={accommodationId}` on the detail page's content (or reset the date/gallery/widget state in an effect on `accommodationId` change), and clamp `activePhotoIndex` to `totalImages - 1`.
- **Done when:** navigating from listing A (photo 7 of 8, dates selected) to listing B (2 photos) renders B with no crash, no carried-over dates, and the gallery clamped to a valid index.

### Gates
- Frontend: `npx tsc --noEmit`, `npx eslint`, `npm run build` (from `frontend/`) — all exit 0.
- Full suite: `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u all_proxy -u no_proxy -u NO_PROXY ~/workspace/.test-venv/bin/python -m pytest -q` (from the repo root) — 106 passed. The sandbox Postgres runs on 127.0.0.1:5432 from `~/workspace/.pgdata-test`; if the server is down, restart it with `su postgres -c '/home/hatch/workspace/.pgsql18/bin/pg_ctl -D /home/hatch/workspace/.pgdata-test -l /home/hatch/workspace/.pgdata-test/logfile.log start'` — the `postgres` user may need recreating after a VM replacement (`useradd -u 999 postgres`).
- `git status --porcelain` shows only in-scope files.

### Git workflow
- Work in the isolated worktree on branch `advisor/039-review-fixes`, from main `438fdc8`. Commit as `fix(detail): second-pass review fixes R1-R6`.
