# Plan 037: Implement OTP Authentication Modal, Session Management, and Role Controls

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 677a622..HEAD -- frontend/src/app/layout.tsx frontend/src/lib/api-client.ts app/api/v1/endpoints/auth.py app/schemas/user.py`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Status**: DONE
- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/036-nextjs-shadcn-scaffold-and-warm-persian-theme.md
- **Category**: direction
- **Planned at**: commit `677a622`, 2026-11-09
- **Implemented at**: commit `4474662`, branch `advisor/037-auth-otp-modal-and-session-state`

## Why this matters

Authentication is the prerequisite for all user-centric features: saving wishlists, booking accommodations, submitting reviews, communicating with hosts, and accessing host management features. In Stitch screens `otp_1` and `otp_2`, user authentication is modeled as a two-step OTP modal (Step 1: mobile phone, Step 2: 4-digit code).

Per the platform evaluation mandate, the test code `1234` must be prominently displayed inside a canonical `Alert` banner on the OTP verification screen so evaluators and testers can log in immediately. Additionally, session state must persist across reloads and expose global trigger methods (`openOtpModal`) so both the desktop navigation header and mobile fixed bottom navigation bar can open the modal cleanly without prop drilling.

## Current state

The relevant files and their current role:
- `frontend/src/app/layout.tsx` — App Router root layout; currently renders `{children}` without `AuthProvider` or navigation chrome.
- `frontend/src/lib/api-client.ts` — strongly typed API client with automatic `localStorage` Bearer token injection and Persian error extraction via `ApiError`.
- `app/api/v1/endpoints/auth.py` — backend endpoints:
  - `POST /api/v1/auth/otp/send` accepting `{"phone": "0912..."}` returning `OTPResponse(message, dev_code, expires_in_seconds=300)`.
  - `POST /api/v1/auth/otp/verify` accepting `{"phone": "0912...", "code": "1234"}` returning `Token(access_token, token_type="bearer", user=UserResponse)`.
  - `GET /api/v1/auth/me` returning current `UserResponse` with `Authorization: Bearer <token>`.
  - `POST /api/v1/auth/become-host` promoting user role from `guest` to `host`.
- `template/otp_1/code.html` & `template/otp_2/code.html` — Stitch reference screens with Persian labels, 120-second resend timer, 4-digit auto-advancing input, and Iran flag prefix.

Exemplar frontend patterns to follow:
- Canonical Shadcn primitives in `frontend/src/components/ui/` (`dialog.tsx`, `sheet.tsx`, `button.tsx`, `avatar.tsx`).
- Styling tokens from `globals.css` (`bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-muted`, `border-border`).

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false` | exit 0, no output |
| Lint      | `npm --prefix frontend run lint` | exit 0 |
| Build     | `npm --prefix frontend run build` | exit 0, compiled successfully |

## Strict Shadcn/UI Component Governance

This module strictly composes canonical Shadcn UI primitives. Hand-rolled custom HTML for buttons, badges, modals, alerts, or dropdowns is strictly prohibited:
- **Alert**: Canonical `Alert`, `AlertTitle`, `AlertDescription` (for test code banner and errors).
- **Dialog & Sheet**: Canonical `Dialog` for desktop and canonical `Sheet` with `side="bottom"` for mobile.
- **Dropdown Menu**: Canonical `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator` for user avatar menu.
- **Avatar**: Canonical `Avatar`, `AvatarImage`, `AvatarFallback` for user profile icon.
- **Buttons**: Canonical `Button` (`default`, `outline`, `ghost`).
- **Inputs**: Canonical `Input` with `dir="ltr"` and `text-center tracking-widest` for phone and 4 discrete OTP digit boxes with auto-advance.

## Scope

**In scope** (the only files you should create or modify):
- `frontend/src/types/auth.ts` (create)
- `frontend/src/components/ui/alert.tsx` (create)
- `frontend/src/components/ui/dropdown-menu.tsx` (create)
- `frontend/src/components/ui/input.tsx` (fix pre-existing empty-interface lint error)
- `frontend/src/lib/api-client.ts` (add 401 automatic localStorage token eviction)
- `frontend/src/app/page.tsx` (remove unused imports Link, CardContent, CardFooter, Separator)
- `frontend/src/context/auth-context.tsx` (create)
- `frontend/src/components/auth/otp-modal.tsx` (create)
- `frontend/src/components/layout/header.tsx` (create)
- `frontend/src/components/layout/bottom-nav.tsx` (create)
- `frontend/src/components/layout/footer.tsx` (create)
- `frontend/src/app/layout.tsx` (mount AuthProvider, Header, BottomNav, Footer, OtpModal)
- `frontend/src/app/global-error.tsx` (create canonical error boundary with Button primitive)
- `frontend/src/app/not-found.tsx` (create canonical not-found view with Button primitive and home link)
- `app/api/v1/endpoints/auth.py`, `app/schemas/user.py`, `app/api/dependencies.py`, `app/api/v1/endpoints/accommodations.py`, `tests/test_auth.py` (backend OTP endpoints, schemas, role authorization, and tests)

**Out of scope**:
- Adding external packages to `frontend/package.json` (all required Radix primitives `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-avatar`, `@radix-ui/react-separator`, `lucide-react`, `clsx`, `tailwind-merge` are already installed).

## Git workflow

- Branch: `advisor/037-auth-otp-modal-and-session-state`
- Commit style: `feat(auth): implement OTP login modal with test code banner and session context`

---

## Steps

### Step 1: Install Missing UI Primitives, Fix `input.tsx` & Clean Imports

1. In `frontend/src/components/ui/input.tsx`, replace the empty interface with a type alias to fix the pre-existing ESLint error:
   ```typescript
   export type InputProps = React.InputHTMLAttributes<HTMLInputElement>
   ```
2. In `frontend/src/app/page.tsx`, remove unused imports (`Link`, `CardContent`, `CardFooter`, `Separator`) so `npm run lint` passes cleanly, and replace the outer `<main>` tag with `<div>` to eliminate duplicate landmark warnings with `layout.tsx`'s `<main>` container.
3. In `frontend/src/lib/api-client.ts`, add 401 token eviction: when `response.status === 401 && typeof window !== "undefined"`, call `localStorage.removeItem("access_token")` and dispatch `window.dispatchEvent(new Event("auth:unauthorized"))` to synchronize client state. Also add safe try/catch JSON parsing fallback for non-JSON responses.
4. Create `frontend/src/components/ui/alert.tsx` with canonical CVA styling supporting `default`, `destructive`, and `warning` variants with Persian RTL padding (`pr-7` for icons).
5. Create `frontend/src/components/ui/dropdown-menu.tsx` wrapping `@radix-ui/react-dropdown-menu` with rounded corners, subtle shadows, and Persian alignment.

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
npm --prefix frontend run lint
```
→ Both exit 0 with 0 errors

---

### Step 2: Create Auth Types Contract (`frontend/src/types/auth.ts`)

Define all auth contracts in `frontend/src/types/auth.ts`:
```typescript
export interface UserResponse {
  id: number
  phone: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: "guest" | "host" | "admin"
  avatar_url: string | null
  shaba_number: string | null
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: UserResponse
}

export interface OTPResponse {
  message: string
  dev_code?: string | null
  expires_in_seconds: number
}

export interface AuthContextType {
  user: UserResponse | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isHost: boolean
  isAdmin: boolean
  isOtpModalOpen: boolean
  openOtpModal: () => void
  closeOtpModal: () => void
  sendOtp: (phone: string) => Promise<OTPResponse>
  verifyOtp: (phone: string, code: string) => Promise<void>
  becomeHost: () => Promise<void>
  logout: () => void
}
```

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 3: Implement Auth Context with Session Rehydration (`frontend/src/context/auth-context.tsx`)

Create `frontend/src/context/auth-context.tsx` with `"use client"`:
1. Initialize state: `user: null`, `token: null`, `isLoading: true`, `isOtpModalOpen: false`.
2. Rehydration in `useEffect`:
   - Read `localStorage.getItem("access_token")`.
   - If present, set `token` and call `apiClient.get<UserResponse>("/auth/me")`.
   - If successful, set `user`. If 401/403 ApiError, call `localStorage.removeItem("access_token")` and reset to null (preserving credentials on network dropouts or 5xx server downtime).
   - Always set `isLoading: false`.
3. `sendOtp(phone: string)`:
   - Call `apiClient.post<OTPResponse>("/auth/otp/send", { phone })`.
4. `verifyOtp(phone: string, code: string)`:
   - Call `apiClient.post<TokenResponse>("/auth/otp/verify", { phone, code })`.
   - Save `access_token` to `localStorage`.
   - Set `token` and `user` state.
   - Close OTP modal (`setIsOtpModalOpen(false)`).
5. `becomeHost()`:
   - Call `apiClient.post<UserResponse>("/auth/become-host")`.
   - Update `user` in state with new role `"host"`.
6. `logout()`:
   - Remove `access_token` from `localStorage`.
   - Set `user: null`, `token: null`.
7. Client 401 synchronization in `useEffect`:
   - Listen to `"auth:unauthorized"` window event dispatched by `apiClient` and trigger `logout()` immediately to keep React state consistent.
8. Computed helpers: `isAuthenticated: !!user`, `isHost: user?.role === "host" || user?.role === "admin"`, `isAdmin: user?.role === "admin"`.
9. Provide custom hook `useAuth()` throwing an error if used outside `AuthProvider`.

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 4: Build Responsive OTP Modal (`frontend/src/components/auth/otp-modal.tsx`)

Implement `OtpModal` matching `template/otp_1` & `otp_2`:
1. **Modal Visibility**: Controlled by `useAuth().isOtpModalOpen` and `useAuth().closeOtpModal`.
2. **Adaptive Presentation**:
   - Detect mobile viewport using a media query hook (`window.matchMedia("(max-width: 639px)")`) guarded by `mounted` state to prevent SSR hydration mismatch.
   - On desktop (`>= 640px`): Renders inside canonical `Dialog`, `DialogContent`.
   - On mobile (`< 640px`): Renders inside canonical `Sheet`, `SheetContent` with `side="bottom"` and a visual drag handle.
3. **Step 1 — Phone Entry (`step === 1`)**:
   - Header: "ورود یا ثبت‌نام در آشیانک", subtitle: "لطفاً شماره موبایل خود را وارد نمایید".
   - Input: Iranian mobile phone input with `dir="ltr"`, `type="tel"`, placeholder `۰۹۱۲۳۴۵۶۷۸۹`, converting Persian digits to English, auto-stripping whitespace/hyphens, and automatically normalizing `+98`, `0098`, `98`, or `9...` (10 digits) to `09...`.
   - Normalization & State Sync: Upon successful `sendOtp`, `setPhone(normalizedPhone)` ensures the canonical 11-digit phone is preserved in state for Step 2 UI display and `handleResend`.
   - Re-entrancy Protection: `handlePhoneSubmit` guards with `if (isSubmitting) return;` to prevent duplicate submissions on rapid Enter keypresses.
   - Validation: Must start with `09` and have 11 digits (`^09\d{9}$`).
   - Action: Canonical `Button` ("دریافت کد تایید") with loading spinner while submitting.
4. **Step 2 — OTP Verification (`step === 2`)**:
   - Header: "کد تایید پیامک‌شده را وارد کنید".
   - Edit phone link: Shows entered phone number with a canonical `Button` (`variant="link"`) to return to Step 1 that clears any active errors (`onClick={() => { setStep(1); setError(null); }}`).
   - **Prominent Test Code Banner with Quick-Fill Action** (Mandatory User Rule & DX):
     Render canonical `Alert` with `variant="warning"` containing the Persian test code `۱۲۳۴` and an actionable quick-fill canonical `Button` ("درج خودکار ۱۲۳۴") that populates `["1", "2", "3", "4"]` and triggers verification with a single click.
   - 4-Digit Input: 4 individual `<Input>` boxes (`w-12 h-14 text-center text-xl font-bold rounded-xl border border-input focus:border-primary`) with:
     - `autoComplete={idx === 0 ? "one-time-code" : "off"}` for native iOS and Android keyboard SMS autofill.
     - `maxLength={idx === 0 ? 4 : 2}` allowing mobile browsers to deliver full 4-digit autofill codes to `handleDigitChange` on box 0, while boxes 1-3 accept a 2nd digit so in-place overwrite functions cleanly even when selection is collapsed to a caret.
     - Overwrite/replacement support: When typing into an already filled box (`digitsOnly.length === 2 && otpDigits[index]`), the new digit cleanly replaces the old digit instead of dropping it or corrupting adjacent boxes.
     - Auto-advance on numeric input, non-numeric character rejection via `handleDigitKeyDown` filtering and `handleDigitChange` direct DOM synchronization, `onPaste` supported on all 4 boxes, backward navigation on Backspace with `e.preventDefault()`, horizontal navigation via `ArrowLeft` and `ArrowRight`, Enter key submission via `handleDigitKeyDown`, defensive string coercion in `toEnglishDigits`, and `onFocus={(e) => e.target.select()}` for instant selection.
   - In-Flight Re-entrancy Guard: `handleVerifySubmit` checks `if (isSubmitting) return;` to prevent parallel verification requests from popping the backend OTP cache and triggering false 400 errors.
   - 120-Second Resend Timer: Starts at `120s`. Renders formatted time in Persian digits (`۰۲:۰۰`). Driven by timeout effect reacting to `timer` state to ensure repeated resend cycles never freeze. Reset to 120s on `handleModalClose`. When it reaches `0`, enables "ارسال مجدد کد تایید" button calling `sendOtp`.
   - Action: Canonical `Button` ("تایید و ورود").
5. **Error Handling**: Displays `error` message string returned by `ApiError.detail` cleanly beneath inputs.

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 5: Implement Navigation Header (`frontend/src/components/layout/header.tsx`)

Build sticky navigation header (`sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80`):
1. **Right (RTL)**:
   - Brand logo "آشیانک" with terracotta accent icon (`Home` or custom SVG house mark) linking to `/`.
2. **Center**:
   - Condensed search pill button ("هر کجا • هر زمان • مهمانان") with search icon using canonical `Button` (`variant="outline"`), triggering navigation to `/` or future search drawer.
3. **Left (RTL)**:
   - "میزبان شوید" (Become a Host) CTA button:
     - If authenticated and not host: Calls `becomeHost()` with `try/catch` and non-blocking canonical `Alert` banner on failure, then redirects to `/host`.
     - If unauthenticated: Calls `openOtpModal()`.
     - If already host: Shows "پنل میزبانی" linking to `/host`.
   - User Menu:
     - If unauthenticated: Canonical `Button` ("ورود / ثبت‌نام") calling `openOtpModal()`.
     - If authenticated: Canonical `DropdownMenu` triggered by canonical `Button` (`variant="outline"`, `size="sm"`, `rounded-full`) wrapping `Avatar` (displaying user initials in Persian or image). Menu items:
       - User profile summary: `user.first_name user.last_name` and `user.phone`.
       - "سفرهای من" (`/trips`) with suitcase icon.
       - "علاقه‌مندی‌ها" (`/wishlists`) with heart icon.
       - Separator.
       - "خروج از حساب" calling `logout()` with red/destructive styling.

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 6: Implement Fixed Mobile Bottom Navigation (`frontend/src/components/layout/bottom-nav.tsx`)

Build fixed bottom bar for mobile screens (`fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden safe-pb`):
1. 4 Navigation tabs:
   - **کاوش** (`/`): Compass/Search icon.
   - **علاقه‌مندی‌ها** (`/wishlists`): Heart icon.
   - **سفرهای من** (`/trips`): Luggage icon.
   - **پروفایل / ورود**:
     - If authenticated: Shows avatar or user icon using canonical `Button` (`variant="ghost"`). Tapping opens a quick mobile action drawer (Profile info, Host panel with non-blocking canonical `Alert` for promotion errors, Logout).
     - If unauthenticated: User icon using canonical `Button` (`variant="ghost"`). Tapping calls `openOtpModal()`.
2. Highlight active tab matching `usePathname()`.
3. Tap target minimum 48px height per button for touch usability.

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 7: Implement Platform Footer (`frontend/src/components/layout/footer.tsx`)

Build responsive Persian hospitality footer (`border-t border-border bg-card text-card-foreground py-10 pb-28 md:pb-10`):
1. Multi-column grid on desktop (About Ashianak, Guest Guides, Host Resources, Trust & Security).
2. Collapsible accordion on mobile (using canonical `Button` with `variant="ghost"` and simple `useState` per section) to keep mobile viewport compact.
3. Emergency support hotline (`۰۲۱-۹۱۰۰۰۰۰۰`) and Iranian e-commerce trust cues.
4. Copyright: `© ۲۰۲۶ آشیانک. کلیه حقوق محفوظ است.`

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 8: Mount Navigation & Auth Provider in Root Layout (`frontend/src/app/layout.tsx`)

Update `frontend/src/app/layout.tsx`:
1. Import `AuthProvider` from `@/context/auth-context`.
2. Import `Header` from `@/components/layout/header`.
3. Import `BottomNav` from `@/components/layout/bottom-nav`.
4. Import `Footer` from `@/components/layout/footer`.
5. Import `OtpModal` from `@/components/auth/otp-modal`.
6. Structure:
   ```tsx
   <html lang="fa" dir="rtl" suppressHydrationWarning>
     <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 pb-20 md:pb-0 safe-pb flex flex-col">
       <AuthProvider>
         <Header />
         <main className="flex-1">{children}</main>
         <Footer />
         <BottomNav />
         <OtpModal />
       </AuthProvider>
     </body>
   </html>
   ```

**Verify**:
```powershell
npm --prefix frontend run build
npm --prefix frontend run lint
```
→ Both exit 0

---

### Step 7: Create Canonical Error Boundaries and 404 Pages (`global-error.tsx`, `not-found.tsx`)

1. In `frontend/src/app/global-error.tsx`, create the root App Router error boundary complying with component governance:
   - Uses canonical `<Button type="button" onClick={() => reset()}>` with `<RotateCcw>` icon rather than raw `<button>` elements.
   - Preserves full RTL styling (`lang="fa" dir="rtl"`), semantic background/foreground tokens, and safe failure recovery.
2. In `frontend/src/app/not-found.tsx`, create the canonical 404 view:
   - Displays clear Persian title and explanation.
   - Provides an actionable canonical `<Button asChild>` with `<Home className="size-4" />` linking back to `/`.

**Verify**:
```powershell
npm --prefix frontend run build
npm --prefix frontend run lint
```
→ Both exit 0

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

### 2. Mandatory Test Banner Verification
Execute:
```powershell
Select-String -Path "frontend/src/components/auth/otp-modal.tsx" -Pattern "۱۲۳۴"
```
Expected: Match found containing the Persian test code `۱۲۳۴`.

### 3. Layout Mounting Verification
Execute:
```powershell
Select-String -Path "frontend/src/app/layout.tsx" -Pattern "AuthProvider", "Header", "BottomNav", "OtpModal"
```
Expected: All 4 symbols present and imported.

### 4. End-to-End OTP Verification Flow (Backend + Frontend Client)
Run the backend test suite to ensure auth contracts remain verified:
```powershell
& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest tests/test_auth.py -k "otp" -v
```
Expected: All tests pass.

---

## Done criteria

Machine-checkable. ALL must hold:

- [x] `node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false` exits 0
- [x] `npm --prefix frontend run lint` exits 0
- [x] `npm --prefix frontend run build` exits 0
- [x] `Select-String -Path "frontend/src/components/auth/otp-modal.tsx" -Pattern "۱۲۳۴"` returns match
- [x] `Select-String -Path "frontend/src/app/layout.tsx" -Pattern "AuthProvider"` returns match
- [x] No files outside the in-scope list are modified (`git status --porcelain`)
- [x] `plans/README.md` status row updated to DONE

---

## STOP conditions

Stop and report back (do not improvise) if:

- Backend endpoint contracts for `/api/v1/auth/otp/*` or `/api/v1/auth/me` return schemas different from `UserResponse` or `Token`.
- The implementation appears to require installing new third-party dependencies outside the existing `package.json`.
- A build or typecheck error persists after following the specified steps.

---

## Maintenance notes

- When switching to production SMS services (e.g. Kavenegar), replace the mock static alert in `otp-modal.tsx` with dynamic production messaging.
- For international visitors in future iterations, the `+98` prefix can be driven by a country-code selector.
- In production with multiple Uvicorn workers (`--workers > 1`), migrate `_OTP_CACHE` in `app/api/v1/endpoints/auth.py` from in-memory dict to Redis or a PostgreSQL table to avoid multi-worker cache misses.

## Second-pass review fixes (2026-11-10)

- **Status: APPROVED 2026-11-10.** Executor commit `df04162` on `advisor/037-review-fixes` (1 file). Reviewer re-ran tsc/lint/build (all exit 0) and the full suite: **106 passed**; read the full diff. R1 done (focus moved into `finally` wrapped in the same 100ms `setTimeout` as `handlePhoneSubmit`). Behavior verified by code reasoning only — no browser in the sandbox; in-browser check still owed.
- **Planned at:** `438fdc8` (main, post-043 merge). **Source:** the 035–040 code review (2026-11-10): a coordinator subagent reviewed the net effect of plans 035–040 on main; the advisor verified every finding below against the live code before writing this section.
- **Scope:** `frontend/src/components/auth/otp-modal.tsx`. Nothing else. SKIP `plans/README.md` — the reviewer maintains it.

### Resolved without action — "Become host" navigates to a route that doesn't exist
- **File (was):** `frontend/src/components/layout/header.tsx:45,51,188`; `frontend/src/components/layout/bottom-nav.tsx:43,50`. After `becomeHost()` succeeded the code did `router.push("/host")`, but there was no `frontend/src/app/host/` route on main — the user landed on a 404.
- **Resolution:** plan 043 (merged 2026-11-10, merge commit `8df32fb`) created `/host/dashboard` and retargeted all five calls to `/host/dashboard` (verified by the advisor on main at `438fdc8`). No R-item is needed for this finding.

### R1 (Low) — Focus after OTP resend is a no-op because the inputs are still disabled
- **File:** `frontend/src/components/auth/otp-modal.tsx:336` (`handleResend`). `handleResend` calls `otpRefs.current[0]?.focus()` while `isSubmitting` is still `true`; the OTP inputs have `disabled={isSubmitting}`, and focusing a disabled input does nothing. `setIsSubmitting(false)` only runs in the `finally` after the focus call.
- **Scenario:** user taps "ارسال مجدد کد تایید", the new code arrives, they start typing — nothing appears because no digit box is focused; they must tap a box first.
- **Fix:** move the focus into the `finally` (or a short `setTimeout` like `handlePhoneSubmit` does) so it runs after the inputs are re-enabled.
- **Done when:** after a resend completes, the first OTP digit box is focused and typing fills it without an extra tap.

### Gates
- Frontend: `npx tsc --noEmit`, `npx eslint`, `npm run build` (from `frontend/`) — all exit 0.
- Full suite: `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u all_proxy -u no_proxy -u NO_PROXY ~/workspace/.test-venv/bin/python -m pytest -q` (from the repo root) — 106 passed. The sandbox Postgres runs on 127.0.0.1:5432 from `~/workspace/.pgdata-test`; if the server is down, restart it with `su postgres -c '/home/hatch/workspace/.pgsql18/bin/pg_ctl -D /home/hatch/workspace/.pgdata-test -l /home/hatch/workspace/.pgdata-test/logfile.log start'` — the `postgres` user may need recreating after a VM replacement (`useradd -u 999 postgres`).
- `git status --porcelain` shows only in-scope files.

### Git workflow
- Work in the isolated worktree on branch `advisor/037-review-fixes`, from main `438fdc8`. Commit as `fix(auth): second-pass review fix R1 (OTP resend focus)`.

## Third-pass review fixes (2026-11-11)

- **Planned at:** `f1cc407` (main, post-035–040 merge). **Source:** advisor review of plans 035–043 (2026-11-10): coordinator + 9 workers; advisor verified all High/Medium against live code and spot-checked the tricky Lows. This plan: 1 Medium, 4 Low (+ H1 kept by user decision, see below).
- **Scope:** `app/api/v1/endpoints/auth.py`, `frontend/src/components/auth/otp-modal.tsx`, `frontend/src/context/auth-context.tsx`, `frontend/src/components/layout/footer.tsx`, `tests/test_auth.py` (extend). Nothing else. SKIP `plans/README.md` — the reviewer maintains it.
- **Gates:** `ruff check app/ tests/test_auth.py` (exit 0); `npx tsc --noEmit` (exit 0), `npx eslint src/` (exit 0), `npm run build` (exit 0) from `frontend/`; full suite `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u all_proxy -u no_proxy -u NO_PROXY ~/workspace/.test-venv/bin/python -m pytest -q` → 110 passed (109 + 1 new T1 test). Run pytest only when no other suite is running (shared test DB).
- **Branch:** `advisor/037-third-pass-fixes`. Commit style: `fix(auth): third-pass review fixes T1-T5`.
- **Outcome (2026-11-11): APPROVED.** Executor commit `06c7e3a` — 60s per-phone OTP cooldown (restarts from last send), double-submit ref, token committed only after `/auth/me` success, `model_fields_set` update_me, footer dead links → real route (`/host/new`) or plain text; 1 new cooldown test. H1 (1234) kept per user decision. Reviewer re-ran tsc + eslint: exit 0. Suite 109/110 under default env, single failure the known TZ flake (fix on 044 branch `2ea24a3`).

### H1 — Static OTP `1234` — KEPT by user decision, no code change
- **Decision (user, 2026-11-11):** "we're still in testing — keep the 1234 code for now, and mention it in the frontend too." The advisor verified the test code IS already displayed in the frontend OTP modal (`frontend/src/components/auth/otp-modal.tsx:498-517`): an alert titled "کد تایید آزمایشی سیستم" with "جهت بررسی و ارزیابی سامانه، کد آزمایشی ۱۲۳۴ را وارد نمایید." plus the "درج خودکار ۱۲۳۴" quick-fill button. Nothing to add.
- **Recorded requirement (NOT this round):** gate the static code and `dev_code` behind a non-production flag before any production deploy. Do not implement that here.

### T1 (Medium) — `POST /auth/otp/send` has no rate limiting
- **File:** `app/api/v1/endpoints/auth.py:140-164`. Unauthenticated; every call runs a `DELETE` of expired rows plus an upsert + commit, with no per-phone or per-IP throttle. Low impact while no real SMS is sent; it becomes SMS-cost abuse the moment a real provider is wired.
- **Fix:** per-phone 60s cooldown using the existing `OTPCode` row's `created_at` (if a row exists and `now - created_at < 60s` → 429 with a retry message). No migration. Note: an hourly cap would need a send-log table — out of scope, flag it in the report.
- **Done when:** two sends within 60s → the second is 429; after 60s → 200; new test proves it.

### T2 (Low) — Double-submit can fire two parallel OTP verifications via a stale `isSubmitting` closure
- **File:** `frontend/src/components/auth/otp-modal.tsx` (`handleVerifySubmit`). The `useCallback` is gated on `isSubmitting` from its render closure. A rapid double-click on the quick-fill button or 4th-digit auto-submit + immediate Enter can both pass the guard before React re-renders.
- **Scenario consequence (benign):** the first request deletes the OTP row, the second gets 400 and sets an error on the already-closed modal; no duplicate user is created.
- **Fix:** use a `useRef` in-flight flag instead of (or in addition to) the state guard.
- **Done when:** a rapid double-click fires exactly one verification request.

### T3 (Low) — Rehydration leaves an inconsistent state on non-401/403 `/auth/me` failure
- **File:** `frontend/src/context/auth-context.tsx:31`. `token` is set from storage *before* the `/auth/me` call; on a network error or 5xx the catch only evicts on 401/403, so `token` stays non-null while `user` is null (`isAuthenticated=false`).
- **Fix:** only `setToken(storedToken)` after `/auth/me` succeeds, or clear it in the non-401/403 branch too.
- **Done when:** on an `/auth/me` network/5xx failure, `token` is null and `isAuthenticated` is false.

### T4 (Low) — `PUT /auth/me` can never clear a field back to null
- **File:** `app/api/v1/endpoints/auth.py:106,118-125`. Sending `email: null` / `first_name: null` is silently treated as "no change". Arguably intended partial-update semantics; the fix is small, so do it.
- **Fix:** use Pydantic `model_fields_set` to distinguish "omitted" from "explicitly null", so an explicit null clears the field.
- **Done when:** sending `email: null` clears the email; omitting `email` leaves it unchanged.

### T5 (Low) — Footer links are all dead anchors; desktop accordion header is a no-op button
- **File:** `frontend/src/components/layout/footer.tsx`. All 16 links are `href="#about"`, `"#careers"`, etc. with no matching element ids, so clicks do nothing. The section header is a `Button` on desktop too (`md:cursor-default`) but the list is forced visible via `hidden md:block`, so clicking it toggles state with no visible effect.
- **Fix:** point links at real routes where they exist, else render them as plain text until then; on desktop render the section header as a non-button element.
- **Done when:** no dead `#anchor` links remain and no no-op buttons exist in the footer.
