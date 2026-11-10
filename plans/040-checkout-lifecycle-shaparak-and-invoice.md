# Plan 040: Implement Reservation Checkout, 30-Minute Countdown Timer, Shaparak Payment Simulation, and Print-Ready Invoice Modal

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 33890e5..HEAD -- frontend/src/lib/api-client.ts app/api/v1/endpoints/payments.py app/api/v1/endpoints/reservations.py app/schemas/payment.py app/schemas/reservation.py`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/039-accommodation-detail-and-booking-engine.md
- **Category**: direction
- **Planned at**: commit `33890e5`, 2026-11-10

## Why this matters

When a guest reserves an accommodation on the detail page (`POST /api/v1/reservations/`), the reservation is created in `pending` status with a strict 30-minute Time-To-Live (TTL) hold window. If the guest does not complete payment before the TTL expires, the backend automatically cancels the reservation (`status = "cancelled"` with reason `"Payment session expired (TTL timeout)"`), releasing the dates back to the public booking calendar.

The checkout view (`/checkout/[id]`) is the high-converting financial checkpoint modeled after Stitch reference designs `template/_3/code.html` (desktop), `template/_15/code.html` (mobile), and `template/pdf/code.html` (official invoice). It provides:
1. An active 30-minute countdown timer with warning alerts as expiration approaches.
2. A transparent itemized price ledger, reservation specifications, guest verification, and cancellation policy review.
3. An authentic simulated Shaparak banking portal modal (`Dialog` on desktop, `Sheet` on mobile) communicating with `POST /api/v1/payments/checkout` and `POST /api/v1/payments/verify`.
4. An official electronic tax invoice modal with A4 print styling (`@media print`), digital tax authority stamps, and tracking code traceability.

## Current state

### 1. Backend Reservation Schema & Endpoints

`app/api/v1/endpoints/reservations.py:218-247`:
```python
@router.get("/{id}", response_model=ReservationResponse)
async def get_reservation(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> ReservationResponse:
    stmt = (
        select(Reservation)
        .options(selectinload(Reservation.accommodation))
        .where(Reservation.id == id)
    )
    res = await db.execute(stmt)
    reservation = res.scalars().first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    is_admin = current_user.role == "admin"
    is_guest = reservation.user_id == current_user.id
    is_host = bool(
        reservation.accommodation and reservation.accommodation.host_id == current_user.id
    )

    if not (is_admin or is_guest or is_host):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not have permission to view this reservation",
        )

    return _serialize_reservation(reservation)
```

`app/schemas/reservation.py:54-74`:
```python
class ReservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    accommodation_id: int
    check_in: date
    check_out: date
    guests_count: int
    total_nights: int
    total_price: Decimal
    coupon_code: str | None = None
    status: str  # 'pending', 'confirmed', 'cancelled', 'completed'
    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None
    refund_amount: Decimal | None = None
    penalty_amount: Decimal | None = None
    created_at: datetime
    updated_at: datetime
    accommodation_title: str | None = None
```
> [!IMPORTANT]
> - `Reservation` has NO database column `expires_at`. The expiration deadline is strictly `created_at + 30 minutes` (`settings.RESERVATION_PENDING_TTL_MINUTES = 30`).
> - The DB check constraint enforces `status IN ('pending', 'confirmed', 'cancelled', 'completed')`. An expired reservation has `status == "cancelled"` and `cancellation_reason == "Payment session expired (TTL timeout)"`.

### 2. Backend Payment Endpoints & Schemas

`app/api/v1/endpoints/payments.py:28-87` (`checkout_payment`):
```python
@router.post(
    "/checkout", response_model=PaymentInitiateResponse, status_code=status.HTTP_201_CREATED
)
async def checkout_payment(
    req: PaymentInitiateRequest,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> PaymentInitiateResponse:
    # Validates reservation.status == 'pending', not expired, generates tracking code SHP-XXXX
    # Returns PaymentInitiateResponse(payment_id, reservation_id, amount, tracking_code, gateway_url)
```

`app/api/v1/endpoints/payments.py:90-200` (`verify_payment`):
```python
@router.post("/verify", response_model=PaymentResponse)
async def verify_payment(
    req: PaymentVerifyRequest,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> PaymentResponse:
    # Accepts: payment_id (int), tracking_code (str), simulate_success (bool = True)
    # Re-verifies no overlapping bookings, sets payment.status = 'success', paid_at = now()
    # Sets reservation.status = 'confirmed', records HostPayout with commission
    # Returns PaymentResponse(id, reservation_id, amount, tracking_code, status, paid_at, created_at)
```

`app/schemas/payment.py:7-35`:
```python
class PaymentInitiateRequest(BaseModel):
    reservation_id: int

class PaymentInitiateResponse(BaseModel):
    payment_id: int
    reservation_id: int
    amount: Decimal
    tracking_code: str
    gateway_url: str

class PaymentVerifyRequest(BaseModel):
    payment_id: int
    tracking_code: str
    simulate_success: bool = True

class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reservation_id: int
    amount: Decimal
    tracking_code: str | None = None
    status: str
    paid_at: datetime | None = None
    created_at: datetime
```

### 3. Frontend API Client & Auth Context

`frontend/src/lib/api-client.ts`:
- `BASE_URL` is pre-configured with `/api/v1` (`http://localhost:8000/api/v1`).
- Relative endpoints must be used:
  - `apiClient.get<ReservationResponse>(`/reservations/${id}`)`
  - `apiClient.get<AccommodationDetail>(`/accommodations/${accId}`)`
  - `apiClient.post<PaymentInitiateResponse>("/payments/checkout", { reservation_id: id })`
  - `apiClient.post<PaymentResponse>("/payments/verify", { payment_id, tracking_code, simulate_success: true })`
- `apiClient` automatically injects `Authorization: Bearer <token>` from `localStorage.getItem("access_token")`.

`frontend/src/context/auth-context.tsx`:
- Provides `useAuth()` hook returning `{ user, isAuthenticated, isLoading, openOtpModal, logout }`.
- `user` has fields `{ id, phone, first_name, last_name, email, role, avatar_url, shaba_number }`.

### 4. Reference Stitch Templates

- `template/_3/code.html` — Desktop checkout view: 3-step stepper (مشخصات مهمانان, شیوه پرداخت, صدور ووچر), countdown banner, guest contact card, Shaparak gateway selectors (Beh Pardakht Mellat, Saman SEP, SnappPay BNPL), cancellation policy agreement, and sticky sidebar order summary.
- `template/_15/code.html` — Mobile checkout view: compact header, mobile sticky bottom pay bar, gateway selection sheet.
- `template/pdf/code.html` — Official printable electronic tax invoice: Ashianak logo, fiscal invoice serial number, issuance timestamp in Persian calendar, contracting parties table, itemized financial ledger, digital tax authority stamp, print-friendly `@media print` rules for A4 output.

---

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false` | exit 0, no output |
| Lint      | `npm --prefix frontend run lint` | exit 0 |
| Build     | `npm --prefix frontend run build` | exit 0, compiled successfully |
| Backend payment integration tests | `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest tests/test_reservations.py -k "full_booking_and_payment_flow or payments_history" -v` | exit 0, all pass |

---

## Strict Shadcn/UI Component Governance

All checkout views strictly compose canonical Shadcn UI primitives located in `frontend/src/components/ui/`:
- **Cards & Layout**: Canonical `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- **Modals & Drawers**: Canonical `Dialog` (desktop payment gateway simulation & invoice dialog), canonical `Sheet` with `side="bottom"` (mobile payment sheet).
- **TTL Alerts & Notices**: Canonical `Alert`, `AlertTitle`, `AlertDescription`.
- **Buttons & Interactive**: Canonical `Button` (`default`, `outline`, `ghost`, `secondary`).
- **Badges**: Canonical `Badge` (`variant="default"`, `variant="secondary"`, `variant="outline"`, `variant="destructive"`).
- **Inputs & Selection Forms**: Canonical `Input` (with `inputMode="numeric"` for card number, CVV2, expiry, OTP), canonical `Checkbox`, canonical `RadioGroup` and `RadioGroupItem` (`@/components/ui/radio-group`).
- **Dividers & Structure**: Canonical `Separator`.
- **Avatars**: Canonical `Avatar`, `AvatarImage`, `AvatarFallback`.
- **Design Tokens**: Strictly consumes CSS variables from `globals.css` (`bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-muted`, `border-border`, `text-muted-foreground`).
- **Typography & Formatting**: Standard Persian digits and currencies formatted using `new Intl.NumberFormat("fa-IR").format(...)` and Persian solar dates using `new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "UTC", ... })`.

---

## Scope

**In scope** (the only files you should create or modify):
- `frontend/src/types/checkout.ts` (create)
- `frontend/src/components/checkout/countdown-timer.tsx` (create)
- `frontend/src/components/checkout/reservation-summary.tsx` (create)
- `frontend/src/components/checkout/payment-gateway-modal.tsx` (create)
- `frontend/src/components/checkout/invoice-modal.tsx` (create)
- `frontend/src/app/checkout/[id]/page.tsx` (create)
- `frontend/src/components/ui/radio-group.tsx` (installed & configured)

**Out of scope** (do NOT touch):
- Backend payment endpoints (`app/api/v1/endpoints/payments.py`) and services (`app/services/reservation_service.py`).
- Real banking PSP gateways (Mellat, Saman live integration).
- Modifying `frontend/src/lib/api-client.ts` or `frontend/src/context/auth-context.tsx`.

---

## Git workflow

- Branch: `advisor/040-checkout-lifecycle-shaparak-and-invoice`
- Commit style: `feat(checkout): implement reservation checkout, Shaparak gateway modal, TTL timer, and printable invoice`

---

## Steps

### Step 1: Create Checkout & Payment Type Definitions (`frontend/src/types/checkout.ts`)

Create `frontend/src/types/checkout.ts` matching backend models and UI contracts:

```typescript
export interface ReservationDetail {
  id: number
  user_id: number
  accommodation_id: number
  check_in: string // YYYY-MM-DD
  check_out: string // YYYY-MM-DD
  guests_count: number
  total_nights: number
  total_price: number | string
  coupon_code: string | null
  status: "pending" | "confirmed" | "cancelled" | "completed"
  cancelled_at: string | null
  cancellation_reason: string | null
  refund_amount: number | string | null
  penalty_amount: number | string | null
  created_at: string
  updated_at: string
  accommodation_title: string | null
}

export interface CheckoutAccommodationInfo {
  id: number
  title: string
  city?: {
    id: number
    name: string
    province?: { id: number; name: string } | null
  } | null
  address?: string | null
  base_price?: number
  cleaning_fee?: number
  cancellation_policy?: "flexible" | "moderate" | "strict" | string
  images?: Array<{
    id: number
    image_url: string
    is_cover?: boolean
  }>
  host?: {
    id: number
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    phone?: string
  } | null
}

export interface PaymentInitiateRequest {
  reservation_id: number
}

export interface PaymentInitiateResponse {
  payment_id: number
  reservation_id: number
  amount: number
  tracking_code: string
  gateway_url: string
}

export interface PaymentVerifyRequest {
  payment_id: number
  tracking_code: string
  simulate_success?: boolean
}

export interface PaymentResponse {
  id: number
  reservation_id: number
  amount: number
  tracking_code: string | null
  status: "pending" | "success" | "failed" | string
  paid_at: string | null
  created_at: string
}

export interface InvoiceGuestInfo {
  full_name?: string
  phone?: string
  national_code?: string
  email?: string
}

export interface InvoiceData {
  invoice_number: string
  issuance_date: string
  reservation: ReservationDetail
  accommodation?: CheckoutAccommodationInfo | null
  payment: PaymentResponse
  guest?: InvoiceGuestInfo | null
}

export interface CheckoutPriceBreakdown {
  totalPayable: number
  cleaningFee: number
  basePrice: number
  baseTotal: number
  discountAmount: number
}

export function computeCheckoutBreakdown(
  reservation: { total_price?: number | string | null; total_nights: number; coupon_code?: string | null },
  accommodation?: { cleaning_fee?: number | null; base_price?: number | null } | null,
  overrideAmount?: number | string | null
): CheckoutPriceBreakdown

export function formatFaPrice(v: number | string | null | undefined): string

export function getPersianYear(dateStr?: string | null): string
```

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 2: Implement Countdown Timer Component (`frontend/src/components/checkout/countdown-timer.tsx`)

Build a robust Persian countdown timer component:
1. **TTL Calculation**:
   - Parses created timestamp with defensive ISO UTC fallback: `const createdMs = new Date(createdAt.endsWith("Z") || createdAt.includes("+") ? createdAt : `${createdAt}Z`).getTime()`.
   - Computes `expiresAtMs = createdMs + ttlMinutes * 60 * 1000` (default `ttlMinutes = 30`).
   - Computes `remainingSeconds = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))`.
   - Runs a `1000ms` `setInterval` updating seconds when `isPending` is true and `remainingSeconds > 0`. Inside the tick, checks `if (!isPending) { clearInterval(timer); return; }` to protect against executing expiration callbacks after an external confirmation.
   - When `remainingSeconds === 0`, invokes `onExpired?.()` callback once and ceases timer.
   - If `!isPending` (reservation already cancelled, confirmed, or completed), returns `null` immediately and does not render or trigger timer callbacks.
2. **Persian Number Formatting & Direction**:
   - Formats `minutes` and `seconds` as two-digit Persian numerals (e.g. `۲۹:۴۵` or `۰۴:۱۲`) using `new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2 })`.
   - Explicitly sets `dir="ltr"` on timer digits and badges to prevent bidirectional flipping in RTL layouts.
3. **Visual Hierarchy & States**:
   - **Inactive State (`!isPending`)**: Returns `null` (suppresses countdown UI on confirmed or completed bookings).
   - **Normal State (> 5 minutes)**: Renders a clean banner with timer icon, secondary badge, and message: "این رزرو موقت به مدت ۲۸:۴۵ دقیقه برای شما نگهداری شده است."
   - **Urgent State (<= 5 minutes)**: Renders canonical `Alert` with pulsing indicator, warning the guest that the booking hold is about to expire.
   - **Expired State (0 seconds while pending)**: Renders canonical `Alert` with `variant="destructive"` stating that the payment window has expired and dates have been released.

```typescript
export interface CountdownTimerProps {
  createdAt: string
  ttlMinutes?: number
  onExpired?: () => void
  isPending: boolean
  className?: string
}
```

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 3: Implement Reservation Order Summary Component (`frontend/src/components/checkout/reservation-summary.tsx`)

Build the financial breakdown and order summary card based on `template/_3/code.html` and `template/_15/code.html`:
1. **Property & Stay Presentation**:
   - Thumbnail image (from `accommodation.images[0].image_url` or fallback placeholder).
   - Property title and location (`city.name` • `province.name`).
   - Check-in and check-out dates formatted with `new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", day: "numeric", timeZone: "UTC" })` on `isoStr` (defensively checking `dateStr.includes("T") ? (dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : `${dateStr}Z`) : `${dateStr}T00:00:00Z``), with standard check-in (ساعت ۱۴:۰۰) and check-out (ساعت ۱۲:۰۰) times.
   - Total nights (`X شب اقامت`) and guests count (`X نفر`).
2. **Itemized Financial Ledger & Unified Safe Derivation**:
   - Delegates financial calculations to shared `computeCheckoutBreakdown(reservation, accommodation)`:
     - `totalPayable`: parsed safely with `Number.isFinite` guards.
     - `cleaningFee`: from `accommodation.cleaning_fee`.
     - `baseTotal`: dynamically clamped against nightly rates and surcharges (`!reservation.coupon_code ? Math.max(0, totalPayable - cleaningFee) : Math.max(basePrice > 0 ? basePrice * reservation.total_nights : 0, Math.max(0, totalPayable - cleaningFee))`).
     - `discountAmount`: strictly balanced (`reservation.coupon_code ? Math.max(0, baseTotal + cleaningFee - totalPayable) : 0`).
   - Displays nights stay amount: `formatFaPrice(baseTotal) + " تومان"`
   - Displays cleaning fee: `formatFaPrice(cleaningFee) + " تومان"` (only if `cleaningFee > 0`)
   - Displays promotional coupon discount badge (if `discountAmount > 0` and `coupon_code` is present, highlighting discount in green: `"- " + formatFaPrice(discountAmount) + " تومان"`)
   - Total payable amount in bold primary Persian typography (`formatFaPrice(totalPayable) + " تومان"`), strictly guarding against `NaN` or unformatted raw strings.
3. **Trust & Guarantee Badges**:
   - Instant refund guarantee (`تضمین بازگشت آنی وجه در صورت مغایرت`).
   - 24/7 guest support (`پشتیبانی ۲۴ ساعته`).
   - SSL 256-bit encrypted Shaparak payment badge.

```typescript
export interface ReservationSummaryProps {
  reservation: ReservationDetail
  accommodation?: CheckoutAccommodationInfo | null
  className?: string
}
```

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 4: Implement Simulated Shaparak Payment Gateway Modal (`frontend/src/components/checkout/payment-gateway-modal.tsx`)

Implement the payment gateway modal with adaptive responsive design:
- Desktop: canonical `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`.
- Mobile (< md): canonical `Sheet` with `side="bottom"`, or responsive dialog sizing.

1. **Payment Initiation & Duplicate Guard**:
   - When opened (`isOpen === true`), checks `if (!isOpen || reservation.status !== "pending") return;` ensuring that payment initiation is strictly forbidden on non-pending (e.g. cancelled or confirmed) bookings.
   - Calls `POST /api/v1/payments/checkout` with `{ reservation_id: reservation.id }`.
   - Uses an initiation ref guard (`hasInitiatedRef`) checking `hasInitiatedRef.current === reservation.id` to prevent duplicate POST requests under React 19 `StrictMode` double-mounting. The effect depends on `[isOpen, reservation.id, reservation.status, initiatePayment]`.
   - When `isOpen` becomes false (modal closed) or when initiation encounters an error, resets `hasInitiatedRef.current = null` to allow clean retry attempts.
   - Cleans up OTP `setTimeout` timers on modal unmount.
   - Stores returned `payment_id`, `tracking_code`, and `amount`.
2. **Shaparak Gateway Form Simulation**:
   - Accepts optional `initialGateway?: string` (defaults to `"mellat"`), synchronizing selection from parent checkout page.
   - Gateway selector composed with canonical `RadioGroup` and `RadioGroupItem` (`@/components/ui/radio-group`):
     - **به‌پرداخت ملت (شاپرک)** (`value="mellat"`) — Selected by default (پیشنهادی • پایدارترین درگاه).
     - **پرداخت الکترونیک سامان کیش (سپ)** (`value="sep"`).
     - **پرداخت اقساطی اسنپ‌پی (BNPL)** (`value="snapppay"`) — 4 equal installments badge.
   - Form fields:
     - 16-digit Card Number input: formatted in 4-digit blocks (`XXXX - XXXX - XXXX - XXXX`) with `inputMode="numeric"`.
     - CVV2 input: 3 or 4 digits.
     - Expiry Month & Year inputs (`ماه / سال`).
     - Dynamic Password (رمز پویا) input with simulated "دریافت رمز پویا" button (clicking populates a valid mock code e.g. `849201` and starts a 120s cooldown timer simulation with timeout cleanup ref).
3. **Payment Verification & Confirmation**:
   - CTA button: "پرداخت و تایید نهایی (مبلغ: X تومان)".
   - Clicking triggers `POST /api/v1/payments/verify` with `{ payment_id, tracking_code, simulate_success: true }`.
   - Validates `response.status === "success"` before advancing to confirmation view; sets descriptive error if non-success status returned.
   - On success:
     - Displays success confirmation view:
       - Green checkmark icon.
       - Payment tracking code (`کد پیگیری شاپرک: SHP-XXXXXXXXXXXX`).
       - Success message: "پرداخت شما با موفقیت در شبکه شاپرک انجام شد و رزرو نهایی گردید."
       - Action buttons: "مشاهده فاکتور رسمی" (opens invoice modal) and "مشاهده سفرهای من" (`/trips`).
       - Fires `onSuccess(paymentResponse)` callback to update reservation status in parent view.
   - On failure:
     - Shows error alert with server error details (`err.message`).
      - On payment initiate error, provides a "تلاش مجدد" (Retry) button resetting `hasInitiatedRef.current = null` and retrying checkout initiation.
     - If HTTP 409 Conflict occurs (overlapping booking confirmed concurrently) or session expired (HTTP 400), notifies the parent view via `onStatusChange?.("cancelled", reason)` and retains the verify error description on the form for guest awareness without clearing `paymentData`.
     - Cancel button allows closing modal.

```typescript
export interface PaymentGatewayModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: ReservationDetail
  onSuccess: (payment: PaymentResponse) => void
  onOpenInvoice?: (payment: PaymentResponse) => void
  initialGateway?: string
  onStatusChange?: (status: "cancelled", reason: string) => void
}
```

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 5: Implement Official Printable Electronic Invoice Modal (`frontend/src/components/checkout/invoice-modal.tsx`)

Build the official printable tax invoice modal matching `template/pdf/code.html`:
1. **Invoice Structure**:
   - Header with Ashianak brand identity (`سامانه رزرو اقامتگاه آشیانک`), fiscal invoice number (`INV-${getPersianYear(issuanceDate)}-XXXXX`), and Persian issuance date formatted with `new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "long", timeZone: "UTC" })`.
   - Booking & Payment Traceability: Reservation ID (`MHM-XXXXX`), Shaparak tracking code (`payment.tracking_code`), payment timestamp.
   - Two-Column Contracting Parties Table:
     - **فروشنده (ارائه‌دهنده خدمت و کارمزد)**: شرکت توسعه فناوری گردشگری آشیانک (سهامی خاص), National Registration No., Postal Code, Address.
     - **خریدار (مهمان)**: Full guest name (`data.guest?.full_name || "-"`), contact phone number (`data.guest?.phone || "-"`), national code (`data.guest?.national_code || "-"`), email (`data.guest?.email || "-"`).
   - Itemized Accounting Table:
     - Row 1: Stay description (`اقامت X شب در <عنوان اقامتگاه>`), dates, nights count, base total (`baseTotal = !reservation.coupon_code ? Math.max(0, totalPayable - cleaningFee) : basePrice > 0 ? basePrice * reservation.total_nights : Math.max(0, totalPayable - cleaningFee)`).
     - Row 2: Cleaning and hospitality services fee (`data.accommodation?.cleaning_fee ?? 0`).
     - Row 3: Promotional discount coupon (if `data.reservation.coupon_code` is present and `discountAmount = Math.max(0, baseTotal + cleaningFee - totalPayable) > 0`).
     - Row 4: Platform commission & VAT tax notice.
     - Total: Net paid amount in Toman (`new Intl.NumberFormat("fa-IR").format(Number(data.payment.amount || data.reservation.total_price))`) and Persian words description.
   - Digital Seal Badge: "تاییدشده در سامانه مودیان مالیاتی / معتبر با امضای دیجیتال".
   - Safe Date Formatting: uses `isoStr` defensive check (`dateStr.includes("T") ? (dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : `${dateStr}Z`) : `${dateStr}T00:00:00Z``) across all formatting functions (`formatPersianDate` and `formatPersianLongDate`) to prevent Safari/WebKit `Invalid Date` parsing errors, and hides dialog close button (`.printable-dialog-content > button { display: none !important; }`) in `@media print`.
2. **Print Handling (`@media print`)**:
   - Top action bar includes: "چاپ فاکتور رسمی" (`window.print()`) and "بستن" (`onClose`).
   - Encapsulated `@media print` CSS ensures clean A4 portrait printing by suppressing dialog backdrops, resetting color variables for dark-mode compatibility, and body overflow locks:
     ```css
     @media print {
       @page { size: A4 portrait; margin: 10mm 12mm; }
       html, body { overflow: visible !important; height: auto !important; background: white !important; color: black !important; }
       [data-radix-portal] > div:first-child { display: none !important; }
       .print-hide { display: none !important; }
       .printable-invoice-card {
         --background: #ffffff !important;
         --foreground: #111c2d !important;
         --card: #ffffff !important;
         --card-foreground: #111c2d !important;
         --muted: #f5f5f4 !important;
         --muted-foreground: #64748b !important;
         --border: #e2e8f0 !important;
         background-color: #ffffff !important;
         color: #111c2d !important;
         border: 1.5px solid #d8e3fb !important;
         padding: 16px !important;
         width: 100% !important;
         max-height: none !important;
         overflow: visible !important;
         box-shadow: none !important;
       }
     }
     ```

```typescript
export interface PaymentGatewayModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: ReservationDetail
  onSuccess: (payment: PaymentResponse) => void
  onOpenInvoice?: (payment: PaymentResponse) => void
  initialGateway?: string
  onStatusChange?: (status: "cancelled", reason: string) => void
}

export interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  data: InvoiceData
}
```

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 6: Assemble Complete Checkout Page (`frontend/src/app/checkout/[id]/page.tsx`)

Assemble the complete responsive checkout page:
1. **Next.js 16 Dynamic Route & Authentication Guard**:
   - Uses canonical async page props pattern:
     ```typescript
     interface CheckoutPageProps {
       params: Promise<{ id: string }>
     }
     export default function CheckoutPage({ params }: CheckoutPageProps) {
       const resolvedParams = React.use(params)
       const reservationId = Number(resolvedParams.id)
     ```
   - Validates `reservationId`: if `!reservationId || isNaN(reservationId)`, displays error state.
   - Uses `useAuth()` hook. If unauthenticated, displays informative login card with `openOtpModal()` button.
2. **Data Fetching & Guest Pre-filling**:
   - Fetches reservation: `apiClient.get<ReservationDetail>(`/reservations/${reservationId}`)`.
   - Effect guard checks `if (isAuthLoading || !isAuthenticated || !reservationId || isNaN(reservationId)) return` and depends on `[reservationId, isAuthLoading, isAuthenticated, reloadTrigger]`, seamlessly fetching reservation data upon OTP login completion without stale 401 errors.
   - Fetches accommodation detail: `apiClient.get<CheckoutAccommodationInfo>(`/accommodations/${reservation.accommodation_id}`)` to populate cover photo, address, and host details, and queries `GET /payments/my` for confirmed/completed reservations to load authentic payment record and Shaparak tracking code.
   - Guest contact details pre-filled from `user` (`[user?.first_name, user?.last_name].filter(Boolean).join(" ")`, `user?.phone`, `user?.email`), with national code state.
3. **State Management**:
   - Handles `loading`, `error`, `pending`, `confirmed`, and `cancelled/expired` states.
   - **Pending State**:
     - 3-Step Checkout Stepper at top.
     - Countdown Timer banner (rendered strictly when `isPending` is true: `{isPending && <CountdownTimer ... />}`).
     - Guest contact details card with editable fields.
     - Payment Gateway selector card (composed with canonical `RadioGroup` and `RadioGroupItem`). Passes selected gateway to modal via `initialGateway={gateway}` and synchronization via `onStatusChange={handleReservationStatusChange}`.
     - Cancellation policy explanation and terms agreement checkbox (`قوانین و مقررات را خوانده‌ام و موافقم`).
     - "انتقال به درگاه امن بانکی و پرداخت" button (disabled if terms unchecked, inputs invalid, or timer expired).
     - Right sidebar on desktop: Reservation Order Summary card.
     - Mobile: Sticky bottom bar with total price and "پرداخت امن" CTA opening payment modal.
   - **Confirmed State**:
     - Success banner with booking confirmation code.
     - Buttons to open Invoice Modal (strictly produced only when reservation is confirmed/completed, passing assembled `guest` info with `"-"` fallback and preserving actual historical timestamp from `latestPayment?.paid_at || reservation.updated_at || reservation.created_at`) or navigate to `/trips`.
    - **Invoice Data Decoupling**: `invoiceData` memo returns `null` for pending or cancelled reservations, completely eliminating synthetic "success" invoices on unpaid bookings.
    - **Payment Gateway Modal Guard**: `<PaymentGatewayModal>` is strictly mounted when `{reservation && isPending && ...}`, completely preventing gateway requests on confirmed or cancelled reservations.
   - **Expired / Cancelled State**:
     - Friendly alert informing guest that the booking hold has expired, with Persian translation helper (`formatCancellationReason`) mapping backend TTL and conflict reasons to clear Persian explanations.
     - Button to browse other listings (`/`) or return to property (`/accommodations/${reservation.accommodation_id}`).

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

### 2. Component File Integrity Verification
Execute:
```powershell
Test-Path frontend/src/types/checkout.ts, frontend/src/components/checkout/countdown-timer.tsx, frontend/src/components/checkout/reservation-summary.tsx, frontend/src/components/checkout/payment-gateway-modal.tsx, frontend/src/components/checkout/invoice-modal.tsx, frontend/src/app/checkout/[id]/page.tsx
```
Expected: Returns True for all 6 files.

### 3. Backend Payment Lifecycle Integration Test
Execute:
```powershell
& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest tests/test_reservations.py -k "full_booking_and_payment_flow or payments_history" -v
```
Expected: All backend payment contract tests pass.

---

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false` exits 0
- [ ] `npm --prefix frontend run lint` exits 0
- [ ] `npm --prefix frontend run build` exits 0
- [ ] `Test-Path frontend/src/types/checkout.ts` returns True
- [ ] `Test-Path frontend/src/components/checkout/countdown-timer.tsx` returns True
- [ ] `Test-Path frontend/src/components/checkout/reservation-summary.tsx` returns True
- [ ] `Test-Path frontend/src/components/checkout/payment-gateway-modal.tsx` returns True
- [ ] `Test-Path frontend/src/components/checkout/invoice-modal.tsx` returns True
- [ ] `Test-Path frontend/src/app/checkout/[id]/page.tsx` returns True
- [ ] `Test-Path frontend/src/components/ui/radio-group.tsx` returns True
- [ ] `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest tests/test_reservations.py -k "full_booking_and_payment_flow or payments_history" -v` exits 0
- [ ] No files outside in-scope list are modified (`git status --porcelain`)
- [ ] `plans/README.md` status row updated to DONE

---

## STOP conditions

Stop and report back (do not improvise) if:

- Backend endpoint `POST /api/v1/payments/checkout` or `POST /api/v1/payments/verify` contracts differ from `PaymentInitiateResponse` or `PaymentResponse`.
- Dynamic route `checkout/[id]` fails Next.js static generation or build step.
- An in-scope component requires additional Shadcn primitives not currently present in `frontend/src/components/ui/`.

---

## Maintenance notes

- Real Shaparak IPG redirects in production will replace the mock modal with an HTTP form POST redirecting directly to the authorized PSP switch (Beh Pardakht Mellat or Saman SEP), with callback redirection to `/payments/verify`.

## Second-pass review fixes (2026-11-10)

- **Status: APPROVED 2026-11-10.** Executor commit `ad537f2` on `advisor/040-review-fixes` (4 files). Reviewer re-ran tsc/lint/build (all exit 0) and the full suite: **106 passed**; read the full diff. R1–R6 all done; no `SHP-CONFIRMED` remains in `frontend/src`. Residual: real print test still owed on Justin's machine; the payment lookup caps at 1,000 payments (10 pages × 100) by design.
- **Planned at:** `438fdc8` (main, post-043 merge). **Source:** the 035–040 code review (2026-11-10): a coordinator subagent reviewed the net effect of plans 035–040 on main; the advisor verified every finding below against the live code before writing this section. 1 Medium, 5 Low.
- **Scope:** `frontend/src/app/checkout/[id]/page.tsx`, `frontend/src/components/checkout/payment-gateway-modal.tsx`, `frontend/src/components/checkout/invoice-modal.tsx`, `frontend/src/types/checkout.ts`. Nothing else. SKIP `plans/README.md` — the reviewer maintains it.

### R1 (Medium) — Official invoice fabricates a payment when the real one isn't found
- **File:** `frontend/src/app/checkout/[id]/page.tsx:240` (invoiceData memo, lines ~230–248). The memo falls back to a synthetic payment `{ id: reservation.id, tracking_code: "SHP-CONFIRMED", amount: total_price, status: "success" }` whenever `latestPayment` is null. That happens not only when the payment lookup fails (the `catch` around `GET /payments/my` silently swallows errors) but also for any frequent guest whose real payment falls outside `limit=50` — `/payments/my` is ordered newest-first, so a user with 50+ newer payments gets a fake tracking code.
- **Scenario:** such a user opens a confirmed checkout and prints an "official" fiscal invoice showing tracking code `SHP-CONFIRMED` and a payment ID that is actually the reservation ID.
- **Fix:** never fabricate a payment — hide/disable the invoice button and show an error when no real successful payment is found. (Also fix the root cause of the miss: the `GET /payments/my` lookup should find the reservation's payment even past 50 newer payments — e.g. filter by reservation on the client from a larger fetch, or fetch the reservation's payment directly if an endpoint allows it; the minimal correct fix is the no-fabrication guard plus a lookup that cannot miss the payment for this reservation.)
- **Done when:** with no real successful payment found, no invoice renders and the user sees an error instead of `SHP-CONFIRMED`; with a real payment (including one past 50 newer payments) the invoice shows the real tracking code.

### R2 (Low) — The payment success view is unreachable dead code
- **File:** `frontend/src/components/checkout/payment-gateway-modal.tsx:224` + `frontend/src/app/checkout/[id]/page.tsx:774`. On verify success the modal calls `setIsSuccess(true)` and then `onSuccess(response)`, which flips the parent reservation to `confirmed` in the same React batch — and the parent only mounts the modal when `isPending`. The modal unmounts before the success view (tracking code, receipt card, "مشاهده فاکتور رسمی" button) ever paints.
- **Scenario:** no user-facing loss — the parent's confirmed banner offers the same invoice/trips actions — but the whole success branch and its `onOpenInvoice`-from-modal path never run.
- **Judgment call (flagged):** delete the dead success branch (and the now-unused `onOpenInvoice`-from-modal path). Keeping the modal mounted until dismissal would be a bigger UX change for zero user-facing gain.
- **Done when:** no `isSuccess` success-view branch remains in the modal; the parent's confirmed banner still offers invoice/trips actions; `tsc`/`lint`/`build` pass with no unused-code warnings.

### R3 (Low) — Reopening the gateway creates a duplicate pending Payment row
- **File:** `frontend/src/components/checkout/payment-gateway-modal.tsx:128–140`. The duplicate guard only works within one open: `hasInitiatedRef` is set after a successful POST but reset to `null` on every close, and the effect re-initiates whenever the ref is null — it never checks the already-held `paymentData`. The backend `POST /payments/checkout` creates a new `Payment` + new tracking code unconditionally, with no existing-pending-payment check.
- **Scenario:** user opens the gateway (initiation succeeds), closes with انصراف, reopens → a second POST creates a second pending payment with a different tracking code; the first row is orphaned (stays `pending` forever, visible in payment history). No double charge — verify uses only the latest code.
- **Fix:** skip initiation when `paymentData` already exists for this reservation, or only reset the ref on initiation error.
- **Done when:** opening, closing, and reopening the gateway for the same pending reservation issues exactly one `POST /payments/checkout` (one pending row, one tracking code).

### R4 (Low) — Print styles don't reset the dialog's scroll container, so long invoices may truncate in print
- **File:** `frontend/src/components/checkout/invoice-modal.tsx:61` + print CSS (~lines 70–115). The `@media print` block resets `.printable-invoice-card` (`max-height: none; overflow: visible`) but `DialogContent` itself keeps `max-h-[95vh] overflow-y-auto`, which is not overridden in print. The invoice (header, parties, table, ledger, seals) can exceed 95vh.
- **Scenario:** printing a long invoice yields only the first ~95vh of content.
- **Fix:** add `.printable-dialog-content { max-height: none !important; overflow: visible !important; }` inside `@media print` and apply that class to the dialog content.
- **Done when:** the print CSS contains the override and the dialog content carries the class. Residual: a real print test is manual — the maintainer should print a long invoice once on their machine.

### R5 (Low) — `getPersianYear`: naive-datetime parsing plus a stale hardcoded fallback year
- **File:** `frontend/src/types/checkout.ts:150–157`. Unlike every other date helper in 040, this parses with bare `new Date(dateStr)` (no `Z`-append guard), so a naive timestamp near the Nowruz boundary is read as local Tehran time but formatted in UTC and can yield the wrong Persian year for the invoice number; the invalid-date fallback is hardcoded `"1403"` (current year is 1405). Latent in practice — the backend returns offset timestamps — but inconsistent with the file's own defensive pattern.
- **Fix:** apply the same `Z`-append normalisation used in `countdown-timer.tsx`/`invoice-modal.tsx`, and derive the fallback year from `new Date()` instead of `"1403"`.
- **Done when:** a naive timestamp near the Nowruz boundary yields the correct Persian year, and an invalid date falls back to the current Persian year (not 1403).

### R6 (Low) — `PaymentGatewayModalProps` is defined twice
- **File:** `frontend/src/types/checkout.ts:91` vs `frontend/src/components/checkout/payment-gateway-modal.tsx:36`. The identical interface exists in `types/checkout.ts` and is redeclared locally in the modal, which uses its local copy — unlike `InvoiceModalProps`, which the invoice modal correctly imports from `types/checkout.ts`. Pure drift risk today (the two copies currently match).
- **Fix:** delete the local declaration and import the type from `@/types/checkout`.
- **Done when:** only one `PaymentGatewayModalProps` exists (in `types/checkout.ts`); the modal imports it; `tsc` passes.

### Gates
- Frontend: `npx tsc --noEmit`, `npx eslint`, `npm run build` (from `frontend/`) — all exit 0.
- Full suite: `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u all_proxy -u no_proxy -u NO_PROXY ~/workspace/.test-venv/bin/python -m pytest -q` (from the repo root) — 106 passed. The sandbox Postgres runs on 127.0.0.1:5432 from `~/workspace/.pgdata-test`; if the server is down, restart it with `su postgres -c '/home/hatch/workspace/.pgsql18/bin/pg_ctl -D /home/hatch/workspace/.pgdata-test -l /home/hatch/workspace/.pgdata-test/logfile.log start'` — the `postgres` user may need recreating after a VM replacement (`useradd -u 999 postgres`).
- `git status --porcelain` shows only in-scope files.

### Git workflow
- Work in the isolated worktree on branch `advisor/040-review-fixes`, from main `438fdc8`. Commit as `fix(checkout): second-pass review fixes R1-R6`.
