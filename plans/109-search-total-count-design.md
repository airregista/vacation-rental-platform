# Plan 109 — Design Spike: Search Total-Count Signal

> **Status**: DESIGN READY — awaiting maintainer decision on mechanism (a)/(b)/(c).
> This document is a design deliverable only; no production code was modified.
> Planned 2026-11-14 at branch `advisor/109-search-count-design` (off `8f2bcf7`).

## 1. Problem

`GET /api/v1/accommodations/` returns a bare `AccommodationListItem[]` with no
total count (`app/api/v1/endpoints/accommodations.py:136-168`,
`response_model=list[AccommodationListItem]`). Consequences:

- No UI can show «۲۰ از ۱۳۷ اقامتگاه». Plan 088 (branch
  `advisor/088-search-pagination`, commit `89a7dd8`) fixed the *wording* to the
  honest «N اقامتگاه در این صفحه», but the catalog ceiling remains unknown.
- Plan 088's prev/next pagination disables its «بعدی» button with the
  heuristic `accommodations.length === PAGE_SIZE` — a page that ends exactly at
  the boundary renders a dead «بعدی» button, and numbered pages are impossible.
- The problem is repo-wide: every other list endpoint (`/accommodations/my`,
  `/reservations/host`, `/payments/my`, `/wishlists/`, `/payments/host/payouts`)
  also returns bare arrays, forcing client-side page walks via
  `fetchAllPages` (`frontend/src/lib/pagination.ts`, plan 075) whose
  termination sentinel is `batch.length < 100` — one extra request per list,
  and no total for "X items" headers on host dashboard/admin.

## 2. Evidence (read at HEAD `8f2bcf7` unless noted)

### 2.1 Backend: search endpoint query construction

`app/api/v1/endpoints/accommodations.py`, `list_accommodations` (lines 136-308):

| Aspect | Detail |
|---|---|
| Filters | `is_active` base + optional: `city_id`, `province_id` (JOIN to `City`), `category_id`, `guests_count`, `min_rooms`, `min_beds`, `min_price`, `max_price` (lines 169-194); paired `check_in`/`check_out` availability via three correlated `NOT EXISTS` (bookings, min-nights exceptions, blocked dates, lines 203-243); required-amenities `JOIN … GROUP BY … HAVING count(distinct) = N` (lines 246-253); bounding-box + Haversine spatial filter (lines 263-294) |
| Ordering | Deterministic: `(sort key, id DESC)` tie-breaker on all three sort modes (lines 296-302) — plan 019 lineage (commit `35b5f7f`), guarded by `test_pagination_deterministic_ordering_with_duplicate_prices` (`tests/test_accommodations.py:615`) |
| Paging | `stmt.offset(skip).limit(limit)`, `limit` capped at 100 (line 167, applied line 304) |
| Serialization | `build_accommodation_list_items` (plan 034 helper) re-queries images/reviews per batch |

**The count query must replicate lines 169-294 exactly** (all filters) and must
NOT apply lines 296-304 (order/offset/limit). Ordering does not affect count,
but leaving it in a subquery is noise; offset/limit would corrupt it fatally.

### 2.2 Frontend: consumers of `GET /accommodations` (grep, `frontend/src`)

Production call sites that consume the **bare-array list shape** of the public
search endpoint:

| Call site | Shape expected | Pages? |
|---|---|---|
| `frontend/src/app/search/page.tsx` — `apiClient.get<AccommodationListItem[]>(\`/accommodations/${queryString}\`)` (line 106 at `8f2bcf7`; same fetch, paged params + `PAGE_SIZE = 20` on the 088 branch) | `AccommodationListItem[]` | yes (088) |
| `frontend/src/components/home/stay-slider.tsx:230` — `apiClient.get<AccommodationListItem[]>("/accommodations/?limit=5")` | `AccommodationListItem[]` | no (single page of 5) |

Related but distinct endpoints (not the search path; break only if the envelope
were applied there too): `fetchAllPages<HostListingRecord>("/accommodations/my")`
(`app/host/dashboard/page.tsx:70`, `app/host/listings/page.tsx:70`) and many
`/accommodations/{id}` detail consumers. **Not affected by any option below**
because (a) is additive and (b)/(c) would target the collection search route only.

`frontend/src/lib/api-client.ts` — `request<T>` (lines 32-89) never surfaces the
`Response` object: it parses `response.text()` and returns the JSON body only.
Every wrapper (`get/post/put/patch/delete`, lines 91-122) inherits this. A grep
for `headers.get|response.headers` in `frontend/src` finds **zero** call sites —
no client code reads any response header today.

### 2.3 Established patterns (STOP-condition checks)

- **No repo precedent for pagination headers**: grep of `app/` for
  `X-Total|headers=|Response\(` finds only unrelated header usage —
  `Retry-After` in the rate limiter (`app/core/rate_limit.py:51`) and
  `WWW-Authenticate` challenges (`app/api/dependencies.py:25-52`). Neither is a
  pagination-metadata pattern; mechanism choice is unconstrained by precedent.
- **Search ordering is deterministic** (tie-breaker verified above) — count +
  `skip` paging semantics are sound; STOP condition not triggered.
- **Plan 022 precedent**: pagination was enforced server-side (commit
  `0c16c36`); contract-level changes follow the schema conventions in
  `app/schemas/` — relevant to option (b).
- **CORS gap (blocking for option a)**: `app/main.py:81-87` —
  `CORSMiddleware` sets `allow_headers=["*"]` but **no `expose_headers`**.
  Browser JS can only read CORS-safelisted response headers (`Cache-Control`,
  `Content-Type`, …); `X-Total-Count` would be **invisible to the frontend**
  even after the backend sends it. Any header-based design must add
  `expose_headers=["X-Total-Count"]`.

## 3. Mechanism options

### (a) `X-Total-Count` response header — **RECOMMENDED**

```python
@router.get("/", response_model=list[AccommodationListItem])
async def list_accommodations(
    response: Response,          # add fastapi.Response param
    db: SessionDep,
    ...unchanged filter params...
) -> list[AccommodationListItem]:
    stmt = _build_filtered_search_stmt(...)   # filters only, no offset/limit
    total = (await db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    )).scalar_one()
    response.headers["X-Total-Count"] = str(total)
    ...unchanged paging + serialization...
```

- **Blast radius**: fully additive. Zero existing consumers break (they ignore
  headers). No schema change, no versioning. Two backend touch points:
  the endpoint + `expose_headers` in `app/main.py`.
- **Costs**: one extra `COUNT(*)` query per page fetch (cheap: filtered set,
  no joins to serialize — see §4 for the GROUP_BY/JOIN subtlety); frontend
  client change required regardless of mechanism (§5); headers are invisible
  to OpenAPI response schemas (documented in §6 open questions).
- **Why not the window function**: `count(*) OVER ()` (`func.count().over()`)
  folds count + page into one round trip: `select(Accommodation,
  func.count().over().label("total"))`, then unzip rows of
  `(Accommodation, total)` tuples. Count parity is guaranteed by construction.
  Kept as a documented alternative — chosen against because it computes the
  count even for callers who don't need it (stay-slider), changes the row
  shape of the primary query (every `.scalars()` call site in the endpoint),
  and is harder to unit-test in isolation than a plain count query. If the
  COUNT round trip ever shows up in profiling, switch to it inside the same
  contract.

### (b) Envelope response `{ items: [...]; total: number; skip: number; limit: number }`

Clean, self-documenting contract (schema would follow `app/schemas/`
conventions, e.g. `AccommodationSearchResponse(BaseModel)` per plan 022's
precedent). **Honest blast radius — breaks every existing array consumer of
this route:**

- Production frontend: **2 call sites** — `search/page.tsx` (fetch + response
  typing + `.then((data) => setAccommodations(data || []))`) and
  `stay-slider.tsx:230`. Both must be rewritten in the same change or the
  homepage slider ships broken.
- Tests: **49 call sites** in `tests/test_accommodations.py` hit
  `GET /accommodations/` or `GET /accommodations/?…` and assert on
  `res.json()` as a list (grep count at `8f2bcf7`; e.g.
  `test_list_accommodations` at line 52 asserts `isinstance(data, list)`).
  All need `.json()["items"]` rewrites.
- External contract: any API consumer outside the repo breaks silently (envelope
  is truthy even when `items` is empty, so naive `data.map(...)` callers fail
  late, not fast). This is why (b) needs a **versioned route** (`/v2/…`) or a
  query-param opt-in (`?envelope=1`) — the latter doubles the test matrix.
- Verdict: correct long-term contract, wrong first move for a P3. Keep as the
  follow-up if the team wants a versioned v2; do not mix into this change.

### (c) Parallel `GET /accommodations/count`

- Doubles the public filter surface: the route would re-declare all ~12 filter
  params (including paired-date and spatial validation) with no way to share
  code except extracting a filter-builder — which is the *same refactor
  option (a) already needs* (§4), minus (a)'s zero-new-endpoint property.
- Extra round trip; drift risk is real and permanent (any new filter added to
  search must be mirrored or counts silently diverge from pages).
- Verdict: reject. It is (a)'s refactor with (b)'s contract cost and neither's
  upside.

**Recommendation: (a)**, with the filter-builder refactor of §4 as the
enabling change and (b) recorded as the eventual v2 direction.

## 4. Backend implementation sketch (option a)

1. **Extract the filter builder.** Move lines 169-294 of
   `list_accommodations` into a private helper, e.g.
   `_build_search_stmt(city_id, province_id, …, radius_km) -> Select` that
   returns the filtered, **unpaged, unordered** `select(Accommodation)`
   statement (loader options `joinedload`/`selectinload` may stay or move to
   the caller — they don't affect SQL for a count). Both the existing route
   and the count derive from this one statement, so filter parity is
   structural, not conventional. The paired-date 400s and spatial 400s stay
   in the route (or the helper raises them — either is testable).
2. **Count query.**
   `total_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())`.
   - Amenities path: the subquery keeps `GROUP BY Accommodation.id`, so rows
     of the subquery are already de-duplicated accommodations — counting
     subquery rows equals counting accommodations. Correct.
   - Province path: inner JOIN to `City` on the 1:1 `city_id` FK — no row
     multiplication. The Haversine/bounding-box and availability filters are
     pure `WHERE` — no multiplication. No other path joins, so no
     `COUNT(DISTINCT)` is needed anywhere.
3. **Header.** Add `response: Response` to the signature and set
   `response.headers["X-Total-Count"] = str(total)` before returning. FastAPI
   merges these headers into the actual response even with a typed
   `response_model`.
4. **CORS.** `app/main.py:81-87`: add `expose_headers=["X-Total-Count"]` to
   the middleware call. Without it the header reaches curl but not the
   browser — the frontend integration would be dead on arrival in dev/prod
   (cross-origin) while unit tests (ASGI, no CORS) would still pass. This is
   the highest-sneak-risk line of the whole design; it deserves its own test
   (§7).
5. **Skip optimization (optional, later).** `stay-slider` never pages; a
   `?include_total=false`-style opt-out is possible but is explicitly *not*
   part of the first cut — a COUNT over the filtered set is single-digit ms at
   this table size, and premature opt-outs re-create the (c) drift problem in
   reverse.

## 5. Frontend implementation sketch (option a)

1. **`lib/api-client.ts` — opt-in metadata surface.** `request<T>` currently
   discards the `Response` (§2.2). Add, without touching the existing
   `request<T>` return contract:

   ```ts
   export interface ApiResultWithMeta<T> { data: T; headers: Headers }

   async function requestWithMeta<T>(endpoint: string, options: RequestInit = {}):
     Promise<ApiResultWithMeta<T>> { /* same auth/error logic as request<T>,
       but return { data: parsed, headers: response.headers } */ }
   ```

   Implementation note: factor the shared fetch/error/parse body of `request<T>`
   into one internal function with a `withMeta` flag rather than copy-pasting
   the 401 handling and error-detail coercion (lines 41-73) — the duplicate
   would rot. Existing `apiClient.get/post/...` call sites are untouched;
   `getWithMeta` is exposed alongside them.
2. **Search page (first consumer — plan 088's page).** Replace the page fetch
   with `getWithMeta<AccommodationListItem[]>`; read
   `Number(headers.get("X-Total-Count"))` (guard: `Number.isFinite`), store in
   a `total` state alongside `accommodations`.
   - Badge: «X از Y اقامتگاه» via the 088-branch helpers
     (`formatFaNumber` / `toPersianDigits` from `lib/format-fa.ts`), e.g.
     «۲۰ از ۱۳۷ اقامتگاه» — falling back to 088's honest «N اقامتگاه در این
     صفحه» when the header is absent (hardening against a stale backend).
   - Pagination: replace `hasMorePages = accommodations.length === PAGE_SIZE`
     with `skip + PAGE_SIZE < total`, which fixes the boundary dead-button and
     enables numbered pages («صفحهٔ X از Y») as a trivial follow-up.
3. **`lib/pagination.ts` (075) — the eventual replacement.** Once counted
   endpoints exist, `fetchAllPages` can pre-size its loop from the header
   instead of the `batch.length < 100` sentinel and, better, hosts/admin can
   stop walking entirely where a total suffices. That migration is explicitly
   **out of scope here** — per-endpoint, later, only where a full walk is
   actually wasteful (host dashboard walks `/accommodations/my` and
   `/reservations/host` on every load today).
4. **Rollout to other lists: later, per-endpoint.** `/accommodations/my`,
   `/reservations/host`, `/payments/my`, `/wishlists/` each gain the header
   independently; each only after a consumer needs it. No repo-wide sweep in
   the build plan.

## 6. Open questions for the maintainer

1. **Mechanism decision**: (a) recommended — (b) only as a versioned v2 later;
   (c) rejected (§3).
2. **Caching**: `X-Total-Count` varies with every filter combination. There is
   no HTTP caching layer today (no `Cache-Control` on API responses; the CORS
   layer is the only relevant middleware), so nothing to invalidate yet — but
   if a CDN ever fronts the API, the header must be part of the cache key /
   `Vary` story. Flag for the (currently nonexistent) caching plan.
3. **OpenAPI visibility**: response headers are not expressible in FastAPI's
   `response_model`; document the header in the endpoint docstring (renders in
   `/docs`) and pin it with tests (§7) rather than trusting the contract read
   from the schema alone.
4. **Backward-compat window**: (a) needs none (additive). If (b) ever happens,
   keep the bare-array route alive through a deprecation window — the 49
   in-repo test call sites are the lower bound of that migration cost.
5. **Count freshness**: count and page are two statements in one request — a
   concurrent create/delete can make the total off-by-N vs. the page. Accept
   (search counts are advisory); do not add a transaction/lock for this.

## 7. Test plan (carried by the future build plan)

Following `tests/test_accommodations.py` patterns (client fixture,
`settings.API_V1_STR`):

- **Parity**: with `limit` ≥ fixture count, `int(response.headers["X-Total-Count"])`
  equals `len(response.json())` for the unfiltered route and for each filter
  family (city, price band, amenities, paired dates, spatial).
- **Filter sensitivity**: adding a filter strictly decreases (or preserves)
  the count vs. unfiltered.
- **Paging invariance**: total is identical for `skip=0` and `skip=20` on the
  same filter set (guards the offset-leaks-into-count class of bug).
- **CORS exposure**: a test asserting `expose_headers` includes
  `X-Total-Count` in the CORS middleware config (or an OPTIONS preflight +
  response-header assertion), so §4.4 can never silently regress.
- **Amenity path dedup**: fixture with a listing holding duplicate amenity
  links (the plan-019 dedup scenario, `?amenity_ids=1&amenity_ids=1`) counts
  that listing once.

## 8. Maintenance notes

- Plan 088 (`advisor/088-search-pagination`, commit `89a7dd8`) is the design's
  **first consumer**: its `PAGE_SIZE = 20`, skip-derived page state, honest
  «N اقامتگاه در این صفحه» badge, and `length === PAGE_SIZE` has-more heuristic
  are exactly the surfaces §5.2 upgrades. Note: at planning time 088 is merged
  to its own branch but **not an ancestor of this branch's base** (`git
  merge-base --is-ancestor 89a7dd8 HEAD` fails); the build plan must rebase on
  or land after 088.
- `lib/pagination.ts` (plan 075, `fetchAllPages`) is the eventual replacement
  target on counted endpoints (§5.3).
- Reviewer scrutiny point: the envelope option's blast radius (§3b) is derived
  from grep — 2 production call sites on the search route + 49 test call sites
  in `tests/test_accommodations.py`. Re-run the greps if the base moves.
- STOP-condition outcomes (all evaluated at `8f2bcf7`): ordering deterministic
  ✓; no pre-existing header precedent to adopt ✓; no production file required
  modification ✓ (this doc is the only artifact, and `plans/` is gitignored —
  untracked by design).
