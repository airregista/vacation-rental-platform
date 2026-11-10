# Plan 038: Implement Explore Page with Destination Search Pill, Category Bar, Filter Modal, and Listing Grid

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9e03cb5..HEAD -- app/api/v1/endpoints/accommodations.py app/schemas/accommodation.py frontend/src/lib/api-client.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/036-nextjs-shadcn-scaffold-and-warm-persian-theme.md, plans/037-auth-otp-modal-and-session-state.md
- **Category**: direction
- **Planned at**: commit `9e03cb5`, 2026-11-09

## Why this matters

The Explore page (`/`) is the central discovery experience of Ashianak. In Stitch screens `_21` and `_29`, guests search accommodations through a segmented search pill (Destination, Dates, Guests), toggle category chips (Wooden Cottage, Pool Villa, Ecotourism), fine-tune via a filter modal (Price Range, Rooms, Beds, Amenities), and browse accommodation cards with high-resolution 4:3 cover photos, Persian Toman pricing, ratings, and instant wishlist toggling. This plan connects the home page directly to backend endpoints `GET /api/v1/accommodations/`, `/categories/`, `/amenities/`, `/geo/cities`, and `/wishlists/`.

## Current state

The verified files, schemas, and endpoints:
- `app/api/v1/endpoints/accommodations.py`:
  - `GET /api/v1/accommodations/` accepts query parameters: `city_id`, `province_id`, `category_id`, `guests_count` (int), `min_rooms` (int), `min_beds` (int), `min_price` (Decimal), `max_price` (Decimal), `check_in` (date YYYY-MM-DD), `check_out` (date YYYY-MM-DD), `amenity_ids` (repeated int: `?amenity_ids=1&amenity_ids=2`), `sort_by` ("newest", "price_asc", "price_desc"), `skip` (int = 0), `limit` (int = 20).
  - Returns `list[AccommodationListItem]`.
  - Date availability invariant: `check_in` and `check_out` must be supplied together (`check_out > check_in`), or omitted. Supplying only one returns HTTP 400.
- `app/schemas/accommodation.py:135-153`:
  ```python
  class AccommodationListItem(BaseModel):
      model_config = ConfigDict(from_attributes=True)

      id: int
      title: str
      city: CityResponse | None = None
      category: CategoryResponse | None = None
      base_price: Decimal
      capacity: int
      max_capacity: int
      rooms_count: int
      beds_count: int
      min_nights: int = 1
      cover_image: str | None = None
      cancellation_policy: str = "flexible"
      average_rating: float | None = None
      reviews_count: int = 0
      is_active: bool
  ```
- `app/schemas/category.py:10-16`:
  ```python
  class CategoryResponse(BaseModel):
      id: int
      title: str
      slug: str
      icon_url: str | None = None
  ```
- `app/schemas/geo.py:20-26`:
  ```python
  class CityResponse(BaseModel):
      id: int
      province_id: int
      name: str
      province: ProvinceResponse | None = None
  ```
- `app/schemas/amenity.py:9-14`:
  ```python
  class AmenityResponse(BaseModel):
      id: int
      name: str
      icon: str | None = None
  ```
- `app/api/v1/endpoints/wishlists.py`:
  - `POST /api/v1/wishlists/{accommodation_id}/toggle` returns `{ accommodation_id: int, is_favorite: bool, message: str }`.
  - `GET /api/v1/wishlists/` returns `list[WishlistItemResponse]`.
- `frontend/src/lib/api-client.ts`:
  - Base URL is configured as `http://localhost:8000/api/v1`.
  - All endpoint calls pass relative routes without `/api/v1` prefix (e.g. `apiClient.get("/accommodations/" + qs)`).
  - Injects JWT `Authorization: Bearer <token>` automatically when logged in.
- `frontend/src/context/auth-context.tsx`:
  - Provides `useAuth()` exposing `{ user, token, openOtpModal, isOtpModalOpen }`.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false` | exit 0, no errors |
| Lint      | `npm --prefix frontend run lint` | exit 0, no errors |
| Verify Primitives | `Test-Path frontend/src/components/ui/slider.tsx, frontend/src/components/ui/checkbox.tsx` | True, True |

## Strict Shadcn/UI Component Governance

This view strictly leverages canonical Shadcn UI primitives. Hand-rolled custom cards, buttons, badges, or skeletons are prohibited:
- **Listing Display**: Canonical `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- **Badges**: Canonical `Badge` (`variant="secondary"` for ratings `★ 4.9`, `variant="outline"` for category chips).
- **Search & Overlays**: Canonical `Dialog` (for desktop filters), canonical `Sheet` with `side="bottom"` (for mobile search drawer and filter sheet). All dialogs/sheets include explicit `DialogTitle` / `SheetTitle` and `DialogDescription` / `SheetDescription` (using `sr-only` if visually omitted) to satisfy Radix a11y.
- **Form Controls**: Canonical `Slider` (wrapping `@radix-ui/react-slider`), canonical `Checkbox` (wrapping `@radix-ui/react-checkbox`), canonical `Input`.
- **Buttons**: Canonical `Button` (`default`, `ghost`, `outline`). Stepper and icon buttons have explicit `aria-label`.
- **Loading & Fallbacks**: Canonical `Skeleton` component (never raw `animate-pulse` divs).
- **Dividers**: Canonical `Separator`.
- **Colors & RTL**: Strictly consumes CSS variables from `globals.css` (`bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-muted`, `border-border`). Persian numbers formatted via `Intl.NumberFormat('fa-IR')`.

## Scope

**In scope** (the only files you should create or modify):
- `frontend/src/components/ui/slider.tsx` (create)
- `frontend/src/components/ui/checkbox.tsx` (create)
- `frontend/src/types/accommodation.ts` (create)
- `frontend/src/lib/search-utils.ts` (create query serializer)
- `frontend/src/components/explore/category-bar.tsx` (create)
- `frontend/src/components/explore/search-pill.tsx` (create)
- `frontend/src/components/explore/filter-dialog.tsx` (create)
- `frontend/src/components/explore/accommodation-card.tsx` (create)
- `frontend/src/components/explore/accommodation-grid.tsx` (create)
- `frontend/src/app/page.tsx` (update with full explore search and grid experience)

**Out of scope**:
- Detail page (Plan 039).
- Modifying backend search algorithms, router endpoints, or database queries.
- Installing third-party carousel libraries (`embla-carousel-react`).

## Git workflow

- Branch: `advisor/038-explore-search-filters-and-listing-grid`
- Commit style: `feat(explore): implement search pill, category filter, and accommodation grid`

---

## Steps

### Step 1: Create UI Primitives (`slider.tsx`, `checkbox.tsx`), Types Contract, & Query Serializer

1. Create `frontend/src/components/ui/slider.tsx` wrapping `@radix-ui/react-slider` with terracotta primary track:
   ```tsx
   "use client"
   import * as React from "react"
   import * as SliderPrimitive from "@radix-ui/react-slider"
   import { cn } from "@/lib/utils"

   const Slider = React.forwardRef<
     React.ElementRef<typeof SliderPrimitive.Root>,
     React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
   >(({ className, ...props }, ref) => {
     const value = props.value || props.defaultValue
     const thumbs = Array.isArray(value) ? value : [value]

     return (
       <SliderPrimitive.Root
         ref={ref}
         dir="rtl"
         className={cn("relative flex w-full touch-none select-none items-center", className)}
         {...props}
       >
         <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
           <SliderPrimitive.Range className="absolute h-full bg-primary" />
         </SliderPrimitive.Track>
         {thumbs.map((_, i) => (
           <SliderPrimitive.Thumb
             key={i}
             className="block size-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
           />
         ))}
       </SliderPrimitive.Root>
     )
   })
   Slider.displayName = SliderPrimitive.Root.displayName
   export { Slider }
   ```

2. Create `frontend/src/components/ui/checkbox.tsx` wrapping `@radix-ui/react-checkbox`:
   ```tsx
   "use client"
   import * as React from "react"
   import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
   import { Check } from "lucide-react"
   import { cn } from "@/lib/utils"

   const Checkbox = React.forwardRef<
     React.ElementRef<typeof CheckboxPrimitive.Root>,
     React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
   >(({ className, ...props }, ref) => (
     <CheckboxPrimitive.Root
       ref={ref}
       className={cn(
         "peer size-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
         className
       )}
       {...props}
     >
       <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
         <Check className="size-3.5" />
       </CheckboxPrimitive.Indicator>
     </CheckboxPrimitive.Root>
   ))
   Checkbox.displayName = CheckboxPrimitive.Root.displayName
   export { Checkbox }
   ```

3. Create `frontend/src/types/accommodation.ts` precisely matching backend Pydantic models:
   ```typescript
   export interface Province {
     id: number
     name: string
   }

   export interface City {
     id: number
     province_id: number
     name: string
     province?: Province | null
   }

   export interface Category {
     id: number
     title: string
     slug: string
     icon_url?: string | null
   }

   export interface Amenity {
     id: number
     name: string
     icon?: string | null
   }

   export interface AccommodationListItem {
     id: number
     title: string
     city: City | null
     category: Category | null
     base_price: number
     capacity: number
     max_capacity: number
     rooms_count: number
     beds_count: number
     min_nights: number
     cover_image: string | null
     cancellation_policy: string
     average_rating: number | null
     reviews_count: number
     is_active: boolean
   }

   export interface AccommodationSearchParams {
     city_id?: number
     province_id?: number
     category_id?: number
     guests_count?: number
     min_rooms?: number
     min_beds?: number
     min_price?: number
     max_price?: number
     check_in?: string
     check_out?: string
     amenity_ids?: number[]
     sort_by?: "newest" | "price_asc" | "price_desc"
     skip?: number
     limit?: number
   }
   ```

4. Create `frontend/src/lib/search-utils.ts` to serialize and parse query parameters correctly for FastAPI and Next.js deep-linking:
   ```typescript
   import type { AccommodationSearchParams } from "@/types/accommodation"

   export function buildAccommodationQuery(params: AccommodationSearchParams): string {
     const query = new URLSearchParams()

     if (params.city_id !== undefined) query.set("city_id", String(params.city_id))
     if (params.province_id !== undefined) query.set("province_id", String(params.province_id))
     if (params.category_id !== undefined) query.set("category_id", String(params.category_id))
     if (params.guests_count !== undefined && params.guests_count > 0) query.set("guests_count", String(params.guests_count))
     if (params.min_rooms !== undefined && params.min_rooms > 0) query.set("min_rooms", String(params.min_rooms))
     if (params.min_beds !== undefined && params.min_beds > 0) query.set("min_beds", String(params.min_beds))
     if (params.min_price !== undefined && params.min_price > 0) query.set("min_price", String(params.min_price))
     if (params.max_price !== undefined) query.set("max_price", String(params.max_price))

     // Date invariant: Both check_in and check_out must be supplied together
     if (params.check_in && params.check_out) {
       query.set("check_in", params.check_in)
       query.set("check_out", params.check_out)
     }

     if (params.sort_by) query.set("sort_by", params.sort_by)
     if (params.skip !== undefined) query.set("skip", String(params.skip))
     if (params.limit !== undefined) query.set("limit", String(params.limit))

     // FastAPI expects repeated keys for list params: ?amenity_ids=1&amenity_ids=2
     if (params.amenity_ids && params.amenity_ids.length > 0) {
       params.amenity_ids.forEach((id) => query.append("amenity_ids", String(id)))
     }

     const qs = query.toString()
     return qs ? `?${qs}` : ""
   }

   export interface SearchParamsGetter {
     get(name: string): string | null
     getAll(name: string): string[]
   }

   export function parseAccommodationQuery(searchParams: SearchParamsGetter): AccommodationSearchParams {
     const params: AccommodationSearchParams = {}

     const cityId = searchParams.get("city_id")
     if (cityId && !isNaN(Number(cityId))) params.city_id = Number(cityId)

     const provinceId = searchParams.get("province_id")
     if (provinceId && !isNaN(Number(provinceId))) params.province_id = Number(provinceId)

     const categoryId = searchParams.get("category_id")
     if (categoryId && !isNaN(Number(categoryId))) params.category_id = Number(categoryId)

     const guestsCount = searchParams.get("guests_count")
     if (guestsCount && Number(guestsCount) > 0) params.guests_count = Number(guestsCount)

     const minRooms = searchParams.get("min_rooms")
     if (minRooms && Number(minRooms) > 0) params.min_rooms = Number(minRooms)

     const minBeds = searchParams.get("min_beds")
     if (minBeds && Number(minBeds) > 0) params.min_beds = Number(minBeds)

     const minPrice = searchParams.get("min_price")
     if (minPrice && Number(minPrice) > 0) params.min_price = Number(minPrice)

     const maxPrice = searchParams.get("max_price")
     if (maxPrice && !isNaN(Number(maxPrice))) params.max_price = Number(maxPrice)

     const checkIn = searchParams.get("check_in")
     const checkOut = searchParams.get("check_out")
     if (checkIn && checkOut && checkOut > checkIn) {
       params.check_in = checkIn
       params.check_out = checkOut
     }

     const sortBy = searchParams.get("sort_by")
     if (sortBy === "newest" || sortBy === "price_asc" || sortBy === "price_desc") {
       params.sort_by = sortBy
     }

     const amenityIds = searchParams.getAll("amenity_ids")
     if (amenityIds.length > 0) {
       const parsed = amenityIds.map(Number).filter((n) => !isNaN(n) && n > 0)
       if (parsed.length > 0) params.amenity_ids = parsed
     }

     return params
   }
   ```

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 2: Build Category Bar Component (`frontend/src/components/explore/category-bar.tsx`)

1. Fetch categories from `apiClient.get<Category[]>("/categories/")`.
2. Render horizontal scrollable list with touch momentum (`overflow-x-auto scrollbar-none snap-x flex items-center gap-3 py-3`):
   - Active category button highlighted with `bg-primary text-primary-foreground`.
   - Inactive chips styled with `variant="outline"`.
   - Include an "همه اقامتگاه‌ها" (All Accommodations) chip at index 0 (value `undefined`).
   - Persian icons mapped by category slug with fallback:
     - `slug.includes("cottage")` or `slug.includes("choobi")` -> `TreePine`
     - `slug.includes("villa")` or `slug.includes("pool")` or `slug.includes("estakhr")` -> `Waves`
     - `slug.includes("eco")` or `slug.includes("boom")` -> `Tent`
     - `slug.includes("apartment")` -> `Building`
     - fallback -> `Home` (from `lucide-react`)
   - Display `category.title` (NOT `name`).
   - Clicking triggers `onSelectCategory(isSelected ? undefined : cat.id)`, allowing clicking an active category to toggle it off to `undefined` ("همه اقامتگاه‌ها") without requiring scrolling back to the first chip.

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 3: Build Search Pill Component (`frontend/src/components/explore/search-pill.tsx`)

1. Load tourist cities from `apiClient.get<City[]>("/geo/cities?limit=50")`. Format city options conditionally (`city.province?.name ? `${city.name} (${city.province.name})` : city.name`) to avoid rendering empty parentheses for cities without province assignments. Explicitly style `<option>` tags with `className="text-foreground bg-background"` to prevent contrast/theme inversion on system dropdown menus in dark mode.
2. Calendar & Date Validation:
   - Calculate `todayStr` using local system date parts (`getFullYear()`, `getMonth() + 1`, `getDate()`) rather than UTC `.toISOString()` to prevent midnight and international timezone skew.
   - Enforce check-out minimum boundary `minCheckOutStr`: when `checkIn` is selected, `min` strictly starts on the day after check-in (`d + 1`), preventing invalid same-day check-outs directly inside the browser date picker.
3. **Desktop View (`>= md`)**: Segmented horizontal pill with Level 3 shadow (`rounded-full border border-border shadow-md bg-card p-2 flex items-center justify-between`):
   - Segment 1: مقصد (Destination selector with city dropdown/select).
   - Segment 2: تاریخ (Check-in and Check-out date pickers `<input type="date">`). Enforces both dates selected together.
   - Segment 3: مهمانان (Guest stepper `-` / `+`, minimum 1 guest, maximum 20 guests with `disabled={guests <= 1}` / `disabled={guests >= 20}` and `aria-label="افزایش مسافران"` / `aria-label="کاهش مسافران"`).
   - Filter Trigger: Button opening the advanced filter dialog.
   - Search button: Terracotta rounded button with `Search` icon ("جستجو").
4. **Mobile View (`< md`)**:
   - Compact floating pill: Summarizes active committed search from `currentParams` ("کجا می‌روید؟ • هر زمان • نفرات").
   - Tapping opens a **3-Step Mobile Search Drawer** using canonical `Sheet` with `side="bottom"`:
     - Includes `<SheetTitle className="sr-only">جستجوی اقامتگاه</SheetTitle>` and `<SheetDescription className="sr-only">انتخاب مقصد، تاریخ و تعداد مسافران</SheetDescription>`.
     - Syncs draft states from `currentParams` upon opening so uncommitted dismissed changes do not leak to the home view.
     - Step 1: مقصد (انتخاب شهر).
     - Step 2: تاریخ ورود و خروج.
     - Step 3: تعداد نفرات (1-20 with boundary guards).
     - Sticky bottom button: "جستجو در آشیانک".

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 4: Build Filter Modal (`frontend/src/components/explore/filter-dialog.tsx`)

1. Render via canonical `Dialog` (desktop) and `Sheet` (mobile):
   - Accessible `<DialogTitle>` / `<SheetTitle>`: "فیلترهای پیشرفته".
   - Accessible `<DialogDescription>` / `<SheetDescription>`: "تنظیم بازه قیمتی، تعداد اتاق‌ها و امکانات مورد نظر".
2. Fetch available amenities on mount via `apiClient.get<Amenity[]>("/amenities/")`.
3. Controls:
   - Price range: Canonical `Slider` (min 0, max 20,000,000 Tomans, step 100,000) with live Persian formatted Toman indicators (`{Intl.NumberFormat('fa-IR').format(val)} تومان`).
   - Rooms & Beds: Stepper controls for `min_rooms` and `min_beds`.
   - Amenities: Grid of canonical `Checkbox` components with amenity names.
   - Sort Option: Select/Radio for `sort_by` ("newest", "price_asc", "price_desc").
4. Bottom Action Bar:
   - "پاک کردن همه" (resets form).
   - "اعمال فیلترها" (emits `onApplyFilters(filters: AccommodationSearchParams)` and closes modal).

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 5: Build Accommodation Card & Responsive Grid

1. Create `frontend/src/components/explore/accommodation-card.tsx`:
   - Component Props:
     ```typescript
     export interface AccommodationCardProps {
       item: AccommodationListItem
       isWishlisted?: boolean
       isWishlistLoading?: boolean
       onToggleWishlist?: (id: number) => void
     }
     ```
   - 4:3 Aspect Ratio Cover Photo Container (`relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted`):
     - Wrapped in `<Link href={`/accommodations/${item.id}`} tabIndex={-1} aria-hidden="true">` to preserve click navigation while preventing redundant dual tab stops for keyboard and screen-reader accessibility.
     - If `item.cover_image` is present: renders Next.js `<Image fill unoptimized />` with `object-cover transition-transform duration-300 group-hover:scale-105`.
     - If `item.cover_image` is null: renders graceful fallback placeholder with `Home` icon and "بدون تصویر".
   - Floating Wishlist Heart Button:
     - Placed at top-left/top-right of image.
     - `Button variant="ghost" size="icon" disabled={isWishlistLoading} className="absolute top-2.5 left-2.5 size-8 rounded-full bg-background/80 backdrop-blur-sm shadow-xs hover:bg-background transition-colors text-foreground z-10 disabled:opacity-50"` with `aria-label="نشان کردن اقامتگاه"`.
     - Heart icon filled with terracotta `text-primary fill-primary` when `isWishlisted` is true.
     - On click: Calls `onToggleWishlist?.(item.id)`. (Parent manages optimistic state update, auth checks via `openOtpModal()`, in-flight request debouncing, and API synchronization).
   - Card Content:
     - Title: Wrapped in `<Link>` with `block truncate` and `<h3>` `font-bold text-base truncate text-foreground`.
     - Location: `{item.city?.name}، {item.city?.province?.name || ""}` in `text-sm text-muted-foreground flex items-center gap-1`.
     - Rating Badge: `★ {item.average_rating ? new Intl.NumberFormat('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(item.average_rating) : "جدید"}` using `Badge variant="secondary"`.
     - Price: `{new Intl.NumberFormat('fa-IR').format(Number(item.base_price) || 0)} تومان / شب` in `text-sm font-semibold text-primary`.
2. Create `frontend/src/components/explore/accommodation-grid.tsx`:
   - Component Props:
     ```typescript
     export interface AccommodationGridProps {
       items: AccommodationListItem[]
       isLoading: boolean
       wishlistIds: Set<number>
       pendingWishlistIds?: Set<number>
       onToggleWishlist: (id: number) => void
       onClearFilters?: () => void
     }
     ```
   - Responsive Grid:
     - Mobile (`< 640px`): `grid-cols-1 gap-5 px-4`
     - Tablet (`640px - 1023px`): `grid-cols-2 gap-5 px-6`
     - Desktop (`1024px - 1439px`): `grid-cols-3 gap-6 px-8`
     - Wide Desktop (`>= 1440px`): `grid-cols-4 gap-6 max-w-[1360px] mx-auto px-8`
   - Maps each item to `<AccommodationCard key={item.id} item={item} isWishlisted={wishlistIds.has(item.id)} isWishlistLoading={pendingWishlistIds?.has(item.id)} onToggleWishlist={onToggleWishlist} />`.
   - Loading State: Renders 8 canonical `Skeleton` cards (4:3 skeleton rectangle + text line skeletons).
   - Empty State: When items list is empty, renders friendly Persian notice ("اقامتگاهی با فیلترهای انتخابی شما یافت نشد") with a "پاک کردن فیلترها" button.

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
```
→ exit 0

---

### Step 6: Assemble Explore Experience in `frontend/src/app/page.tsx`

1. Convert `frontend/src/app/page.tsx` into a client component (`"use client"`) composing `HomeContent` wrapped in `<React.Suspense>` for safe Next.js static generation with `useSearchParams()`:
   - Sticky top bar with `SearchPill`.
   - `CategoryBar` for quick property type filtering.
   - `FilterDialog` for advanced price, room, and amenity adjustments.
   - `AccommodationGrid` displaying fetched accommodations inside a semantic `<section aria-label="محتوای اقامتگاه‌ها">` avoiding duplicate `<main>` landmarks within the layout root.
2. State Management & Deep-Linking:
   - `searchParams`: Stores current `AccommodationSearchParams`, initialized from URL search params on mount via `parseAccommodationQuery(searchParamsHook)`.
   - Synchronizes query updates back to browser URL via `window.history.replaceState(null, "", newUrl)` without full page reload or scroll disruption, supporting bookmarking and shareable filtered links.
   - `accommodations`: `AccommodationListItem[]`.
   - `wishlistIds`: `Set<number>` tracking wishlisted accommodation IDs. Fetched on initial mount if authenticated via `GET /wishlists/?limit=100` to prevent default 20-item pagination truncation.
   - `activeWishlistIds`: Derived via `React.useMemo(() => (token ? wishlistIds : new Set<number>()), [token, wishlistIds])` ensuring logged-out sessions immediately clear cached favorites without stale state leakage and without triggering React 19 `react-hooks/set-state-in-effect` cascading renders.
   - `pendingWishlistIds`: `Set<number>` tracking in-flight toggle requests to prevent rapid multi-click concurrency and state inversion.
   - Wishlist Toggle Handler:
     ```typescript
     const handleToggleWishlist = async (id: number) => {
       if (!token) {
         openOtpModal()
         return
       }
       if (pendingWishlistIds.has(id)) return
       setPendingWishlistIds((prev) => new Set(prev).add(id))

       // Optimistic toggle
       setWishlistIds((prev) => {
         const next = new Set(prev)
         if (next.has(id)) next.delete(id)
         else next.add(id)
         return next
       })
       try {
         const res = await apiClient.post<{ accommodation_id: number; is_favorite: boolean }>(`/wishlists/${id}/toggle`)
         // Reconcile with authoritative server state
         if (res && typeof res.is_favorite === "boolean") {
           setWishlistIds((prev) => {
             const next = new Set(prev)
             if (res.is_favorite) next.add(id)
             else next.delete(id)
             return next
           })
         }
       } catch {
         // Rollback on network failure
         setWishlistIds((prev) => {
           const next = new Set(prev)
           if (next.has(id)) next.delete(id)
           else next.add(id)
           return next
         })
       } finally {
         setPendingWishlistIds((prev) => {
           const next = new Set(prev)
           next.delete(id)
           return next
         })
       }
     }
     ```
   - `isLoading`: Boolean state showing skeletons during fetch.
   - `fetchError`: String state with retry button if network fails. Reset to `null` on every successful fetch in `.then(...)`.
3. Fetch accommodations from `GET /accommodations/` via `apiClient.get<AccommodationListItem[]>("/accommodations/" + buildAccommodationQuery(searchParams))` whenever filters change, clearing `fetchError` on success.

**Verify**:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
npm --prefix frontend run lint
```
→ Both exit 0 with 0 errors.

---

## Test plan

### 1. Automated Typecheck and Lint Gate
Execute:
```powershell
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
npm --prefix frontend run lint
```
Expected: All exit 0 with 0 errors.

### 2. Component and Primitives Verification
Execute:
```powershell
Test-Path frontend/src/components/ui/slider.tsx, frontend/src/components/ui/checkbox.tsx, frontend/src/lib/search-utils.ts
```
Expected: Returns `True, True, True`.

### 3. Query Serialization Unit Check
Verify query formatting handles list amenities, dates, and numbers:
Execute:
```powershell
node -e "const { buildAccommodationQuery } = require('./frontend/src/lib/search-utils.ts'); console.log(buildAccommodationQuery({ guests_count: 3, amenity_ids: [1, 2] }))"
```
Or verify inside TypeScript compiler context that `buildAccommodationQuery` compiles without type errors.

### 4. Page Assembly Verification
Execute:
```powershell
Select-String -Path "frontend/src/app/page.tsx" -Pattern "SearchPill", "CategoryBar", "AccommodationGrid", "FilterDialog"
```
Expected: All 4 components are imported and rendered in `page.tsx`.

---

## Done criteria

Machine-checkable. ALL must hold:

- [x] `node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false` exits 0
- [x] `npm --prefix frontend run lint` exits 0
- [x] `Test-Path frontend/src/components/ui/slider.tsx` returns True
- [x] `Test-Path frontend/src/components/ui/checkbox.tsx` returns True
- [x] `Test-Path frontend/src/lib/search-utils.ts` returns True
- [x] `Select-String -Path "frontend/src/app/page.tsx" -Pattern "AccommodationGrid"` returns match
- [x] No files outside in-scope list are modified (`git status --porcelain`)
- [x] `plans/README.md` status row updated to DONE (when executed)

---

## STOP conditions

Stop and report back (do not improvise) if:

- Backend Pydantic models in `app/schemas/accommodation.py` diverge from the TypeScript types defined in Step 1.
- Typecheck or linter reports errors that cannot be resolved within the in-scope files.
- The task requires modifying backend files (which are explicitly out of scope).

---

## Maintenance notes

- Infinite scroll pagination can be introduced in a future optimization using an `IntersectionObserver` hook targeting the `skip` / `limit` query parameters.
- Search filters are synchronized with URL query params (`useSearchParams` & `window.history.replaceState`) supporting shareable deep-links and persistent filtered views.

## Second-pass review fixes (2026-11-10)

- **Status: APPROVED 2026-11-10.** Executor commit `7551216` on `advisor/038-review-fixes` (6 files). Reviewer re-ran tsc/lint/build (all exit 0) and the full suite: **106 passed**; read the full diff. R1–R7 all done. Note: R2's done-when was corrected by the reviewer — `skip` resets to 0 on filter change by pre-existing design (page 1); the parse + URL-sync round-trip is the criterion.
- **Planned at:** `438fdc8` (main, post-043 merge). **Source:** the 035–040 code review (2026-11-10): a coordinator subagent reviewed the net effect of plans 035–040 on main; the advisor verified every finding below against the live code before writing this section. 1 Medium, 6 Low.
- **Scope:** `frontend/src/app/page.tsx`, `frontend/src/lib/search-utils.ts`, `frontend/src/components/explore/search-pill.tsx`, `frontend/src/components/explore/filter-dialog.tsx`, `frontend/src/components/explore/accommodation-grid.tsx`, `frontend/src/components/ui/slider.tsx`. Nothing else. SKIP `plans/README.md` — the reviewer maintains it.

### R1 (Medium) — Stale fetch response can overwrite newer results (no request sequencing/abort)
- **File:** `frontend/src/app/page.tsx:80-106`. The accommodations fetch effect guards only with `isMounted`, which prevents setState after unmount but does nothing about out-of-order responses: two overlapping requests are both allowed to call `setAccommodations` and `setIsLoading(false)`.
- **Scenario:** user taps category chips in quick succession (or changes filters rapidly); the first request resolves after the second, so the grid shows the *earlier* filter's listings and the skeletons disappear while the correct request is still in flight — wrong results until the next interaction.
- **Fix:** track a request sequence number (or `AbortController`) in the effect and ignore/abort superseded responses.
- **Done when:** with two overlapping fetches, only the latest response updates the grid (verify by code inspection + a test if the effect is testable, otherwise by reasoning documented in the report).

### R2 (Low) — `parseAccommodationQuery` accepts invalid values and drops `skip`/`limit`
- **File:** `frontend/src/lib/search-utils.ts:39-84`. IDs use only `!isNaN(Number(...))`, so `?city_id=0`, `?city_id=-1`, `?guests_count=1.5` are accepted; `max_price` accepts negatives; dates get only a lexicographic `checkOut > checkIn` check, so `?check_in=aaa&check_out=zzz` passes. The backend rejects these with 422, which `page.tsx` turns into the generic "خطا در بارگذاری" error screen; `skip`/`limit` are never parsed, so a shared link's pagination is silently lost on the next filter change.
- **Fix:** validate with `Number.isInteger` + range checks and a `^\d{4}-\d{2}-\d{2}$` + real-date check, and parse `skip`/`limit`.
- **Done when:** `?city_id=0`, `?guests_count=1.5`, `?max_price=-5`, `?check_in=aaa&check_out=zzz` are all ignored (no 422, no error screen); `skip`/`limit` parse and round-trip through the URL. NOTE (reviewer correction, 2026-11-10): `skip` is deliberately reset to 0 by the pre-existing `handleSelectCategory`/`handleSearch`/`handleApplyFilters` handlers when filters change (Step 6 design: changing filters returns to page 1) — so `skip` does NOT survive a filter change by design; only `limit` does. The parse + URL-sync round-trip is the criterion, not skip survival.

### R3 (Low) — Stale wishlist IDs survive a failed refetch after a user switch
- **File:** `frontend/src/app/page.tsx:57-76`. On logout the effect returns early without clearing `wishlistIds` (hiding relies on the derived `activeWishlistIds` memo), and the `catch` only logs — it never clears the set.
- **Scenario:** user A is logged in (wishlist loaded), logs out, user B logs in and the `/wishlists/?limit=100` fetch fails (network error); B's session then displays A's favourited hearts as their own.
- **Fix:** `setWishlistIds(new Set())` in the catch branch and when `!token`.
- **Done when:** after logout, or after a failed wishlist refetch, no favourited hearts from the previous user remain.

### R4 (Low) — Destination list hard-capped at 50 cities with no search
- **File:** `frontend/src/components/explore/search-pill.tsx:48`. The pill fetches `/geo/cities?limit=50` (backend allows up to 100, ordered by name, no search param). The seed DB has only 17 cities so this is latent today, but any DB with >50 cities makes the rest unselectable.
- **Fix:** request `limit=100` (backend max).
- **Done when:** the pill fetches `/geo/cities?limit=100`.

### R5 (Low) — Resizing across 768px while the filter dialog is open discards draft filters
- **File:** `frontend/src/components/explore/filter-dialog.tsx:295-301,335`. `FilterForm` state lives inside two separate conditional branches (desktop `Dialog` vs mobile `Sheet`) selected by `isDesktop`, which updates on window resize.
- **Scenario:** user has adjusted price/rooms/amenities in the open dialog, then rotates a phone or resizes the browser across 768px; the branch switches, `FilterForm` remounts, and all unapplied draft changes are lost.
- **Fix:** hoist the filter form state into `FilterDialog` (or render one container and switch only the wrapper) so a breakpoint change doesn't remount the form.
- **Done when:** changing the viewport across 768px with the dialog open preserves the unapplied draft values.

### R6 (Low) — 4-column layout starts at 1536px, not the planned 1440px
- **File:** `frontend/src/components/explore/accommodation-grid.tsx:29,80`. The grid uses `2xl:grid-cols-4`; Tailwind v4 defaults (no custom breakpoints in `globals.css`) make `2xl` = 1536px, while plan Step 5 specifies 4 columns for wide desktop ≥1440px.
- **Fix:** define `--breakpoint-2xl: 90rem` in `@theme` in `globals.css` (one line; keeps the `2xl:` utilities meaning 1440px everywhere). Note: `globals.css` is touched by this one-line theme addition only — do not rework the file.
- **Done when:** at a 1440–1535px viewport the grid shows 4 columns.

### R7 (Low, latent) — `props.value || props.defaultValue` mishandles falsy values
- **File:** `frontend/src/components/ui/slider.tsx:11`. A single-value slider at `0` falls through to `defaultValue` (becoming uncontrolled instead of controlled at 0), and `value={[]}` renders zero thumbs. No current caller hits this (the only use is the range slider in `filter-dialog.tsx`, where the value is always a 2-element array), but any future single-value slider at 0 breaks.
- **Fix:** use `props.value ?? props.defaultValue` and fall back to `[0]` when the result is undefined/empty.
- **Done when:** a slider with `value={0}` stays controlled at 0 and a slider with `value={[]}` renders one thumb at 0.

### Gates
- Frontend: `npx tsc --noEmit`, `npx eslint`, `npm run build` (from `frontend/`) — all exit 0.
- Full suite: `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u all_proxy -u no_proxy -u NO_PROXY ~/workspace/.test-venv/bin/python -m pytest -q` (from the repo root) — 106 passed. The sandbox Postgres runs on 127.0.0.1:5432 from `~/workspace/.pgdata-test`; if the server is down, restart it with `su postgres -c '/home/hatch/workspace/.pgsql18/bin/pg_ctl -D /home/hatch/workspace/.pgdata-test -l /home/hatch/workspace/.pgdata-test/logfile.log start'` — the `postgres` user may need recreating after a VM replacement (`useradd -u 999 postgres`).
- `git status --porcelain` shows only in-scope files.

### Git workflow
- Work in the isolated worktree on branch `advisor/038-review-fixes`, from main `438fdc8`. Commit as `fix(explore): second-pass review fixes R1-R7`.
