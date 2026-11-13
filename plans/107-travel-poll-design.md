# Design 107: Real Backend for the Travel Poll ("همسفران کجا بریم؟")

> **Status**: DESIGN READY — awaiting maintainer decisions on the open
> questions in §7. This document is the deliverable of plan 107; building the
> feature is a future executor plan that consumes this design.
> **Planned at**: commit `b94e2bd`, written 2026-11-14 on branch
> `advisor/107-travel-poll-design` (off `advisor/089-lazy-hero-scenes`,
> HEAD `cb081ca`).

## 1. Problem and goal

The travel-date poll is a complete multi-user feature — voting on trip dates,
a companion roster with proxy votes, and a winning option — implemented
entirely as a device-local simulation. Votes and companions live in
`localStorage`, every visitor sees their own private poll, and "collaboration"
does not exist. The UI already models multi-user semantics; only the data
layer cannot deliver them.

Goal: a small backend (3 tables, 8 endpoints) so a poll can be shared between
companions who each open the site, while **keeping device-local polls working
offline** (see §6.3).

## 2. Current state (evidence, this session)

Frontend seams (all read in this worktree at HEAD `cb081ca`):

- `frontend/src/lib/travel-poll-storage.ts` (plan 099) — **the seam this
  design replaces**. Exports `STORAGE_KEY` / `COMPANIONS_STORAGE_KEY` /
  `LEGACY_STORAGE_KEY` (legacy `jabama_*` migration), `MAX_COMPANIONS = 8`,
  `PollCompanion { id, name, optionId: string | null }`,
  `loadPollState(seedOptions)`, `serializeOptions`, `sanitizeCompanions`,
  `writeStorage`, `isFutureCheckIn`. Its doc comment is explicit:
  *"Roster + proxy votes live only on this device (no backend poll exists)."*
- `frontend/src/components/wishlist/travel-poll-modal.tsx` — the only
  consumer of the storage module besides the roster; finalizes the winning
  option via `router.push(/search?check_in=...&check_out=...)` (plan 086).
- `frontend/src/components/wishlist/companion-roster.tsx` (plan 106) — the
  roster's props are the second API seam:
  `CompanionRosterProps { companions: PollCompanion[]; options: Array<{ id:
  string; title: string }>; onAdd: (name) => string | null; onRemove:
  (companionId) => void; onAssign: (companionId, optionId | null) => void }`.
  All mutation semantics (limit 8, name dedupe case-insensitive, proxy-vote
  assignment) live in the parent's callbacks, not the component — so the
  component survives the backend swap untouched if the callbacks become
  optimistic API calls.
- `frontend/src/types/wishlist.ts` — `DatePollOption { id, title, date_range,
  check_in, check_out, nights_count, votes, voted, holiday_tag?, is_holiday?,
  is_budget?, voters? }`. The `date_range`/`nights_count`/holiday fields are
  **display-only derivations**; the backend must store only
  `check_in`/`check_out`/`title`.
- `frontend/src/lib/api-client.ts` — `apiClient.get/post/put/patch/delete`
  with `Authorization: Bearer <localStorage access_token>` and an
  `auth:unauthorized` event on 401. This is the transport the new endpoints
  plug into; no new client code needed.

Backend patterns studied (read-only):

- `app/models/reservation.py` — `Reservation` uses `BigInteger` +
  `Identity(always=True)` PKs, `Date` columns for `check_in`/`check_out`,
  named `CheckConstraint`s (`chk_*`), named indexes (`ix_*`), and
  `DateTime(timezone=True)` with `server_default=func.now()`. FKs to `users`
  use `ondelete="RESTRICT"`; child rows use `CASCADE`.
- `ReservationMessage` (same file) is the per-reservation communication
  precedent: `reservation_id` CASCADE FK, `sender_id` RESTRICT FK, `read_at`
  nullable timestamp for unread state (plan 072).
- `app/api/v1/endpoints/reservations.py` — router conventions: a single
  `router = APIRouter(prefix=..., tags=[...])`, `CurrentUserDep` /
  `CurrentAdminDep` / `SessionDep` from `app.api.dependencies`,
  `response_model=` on every route, `HTTPException(403/404/409)` for
  authorization/not-found/conflict, `skip`/`limit` as
  `Annotated[int, Query(ge=..., le=...)]`, `selectinload` eager loading with
  a module-level load-tuple, and small `_serialize_*` helpers that attach
  computed display fields (`sender_name` = `f"{first} {last}".strip() or
  phone`).
- `app/schemas/reservation.py` — `BaseModel` + `ConfigDict(from_attributes=
  True)` responses, `Field(...)` constraints, `field_validator` /
  `model_validator` for cross-field rules (`check_out > check_in`),
  `app.core.time.today_tehran()` for "not in the past" checks.
- `app/api/v1/router.py:20-31` — new routers are registered in
  `api_router.include_router(...)` order; the poll router slots in after
  `wishlists.router`.
- Alembic: `migrations/versions/b0055d33fb96_create_reservation_messages_table.py`
  shows the table-creation style (auto-generated `op.create_table` with
  `sa.Identity(always=True)`, `ondelete` FKs, `op.create_index(op.f(...))`,
  mirrored `downgrade`). Current single head: **`9a2a9af6d7ed`**
  (verified via `alembic heads` in this worktree).
- Suite baseline: `pytest --collect-only` reports **246 tests** (matches the
  README figure of ~246).

**Gap finding (per the plan's STOP-condition guidance, not a STOP)**: the
messaging "participant" model is *not* a reusable abstraction. Who may read
or write `ReservationMessage`s is derived implicitly from two hardcoded
relationships (`reservation.user_id` = guest, `accommodation.host_id` = host,
admin bypass). A poll has no natural guest/host pairing, so this design
introduces a **new explicit participant table** (`TravelPollParticipant`,
§3) rather than force-fitting the reservation pattern. What *is* reused from
messaging: the authorization-check style (fetch row → compare identity → 403),
the `read_at`-style unread mechanism as an option for §7.4, and the display-name
convention for voters.

## 3. Proposed backend schema

Three tables plus one identity anchor. All columns follow the conventions
observed in `app/models/reservation.py`.

### 3.1 `travel_polls`

| column | type | notes |
|---|---|---|
| `id` | `BigInteger`, `Identity(always=True)` | PK |
| `owner_id` | `BigInteger` FK → `users.id`, `ondelete="RESTRICT"` | creator; RESTRICT matches `reservations.user_id` |
| `title` | `String(120)`, nullable | optional display title; default UI copy lives in the frontend |
| `share_token` | `String(32)`, unique, nullable | only used if the maintainer picks the link-sharing option (§7.1); `secrets.token_urlsafe(24)`-shaped |
| `status` | `String(20)`, `server_default="open"`, `CheckConstraint` `IN ('open', 'closed')` | `closed` freezes voting; finalize/search routing stays frontend-only |
| `expires_at` | `DateTime(timezone=True)`, nullable | optional expiry (§7.3); `NULL` = no expiry |
| `created_at` / `updated_at` | `DateTime(timezone=True)`, `server_default=func.now()` | `updated_at` also `onupdate=func.now()` |

Constraints: `chk_travel_poll_status` (as above); index
`ix_travel_polls_owner_created` on (`owner_id`, `created_at`) — same shape as
`ix_reservations_user_created`.

**Wishlist linkage: standalone by default.** The current poll has no
connection to any wishlist content (its options are dates, not wishlist
items), and wishlist folders are themselves still device-local
(`WishlistFolder` in `types/wishlist.ts` has no backend entity). Adding a
`wishlist_folder_id` FK now would couple the poll to a nonexistent backend
entity. Recommended: no linkage column in v1; if the maintainer later wants
"poll per folder", it is one nullable FK migration.

### 3.2 `travel_poll_options`

| column | type | notes |
|---|---|---|
| `id` | `BigInteger` Identity PK | |
| `poll_id` | `BigInteger` FK → `travel_polls.id`, `ondelete="CASCADE"`, indexed | |
| `title` | `String(120)`, nullable | the current UI shows titles like "آخر هفته"; optional so a bare date range works |
| `check_in` | `Date`, nullable=False | |
| `check_out` | `Date`, nullable=False | |
| `is_finalized` | `Boolean`, `server_default="false"`, nullable=False | marks the winning option at finalize time; the frontend already routes to `/search?check_in=...` (plan 086) |

Constraints: `chk_travel_poll_option_dates` — `check_out > check_in` (same
rule as `chk_reservation_dates` and as the frontend's
`isValidStoredPollOption`). Index `ix_travel_poll_options_poll` on `poll_id`.

Note: `votes` is **not** stored here. Vote totals are `COUNT(travel_poll_votes)`
at read time — the same derived-data approach the frontend already uses in
`serializeOptions` (totals are recomputed from voters, never trusted from
storage).

### 3.3 `travel_poll_votes`

One row per (poll, voter). Re-voting is *move*, not *add* (§4.5).

| column | type | notes |
|---|---|---|
| `id` | `BigInteger` Identity PK | |
| `poll_id` | `BigInteger` FK → `travel_polls.id`, `ondelete="CASCADE"`, indexed | denormalized from the option so "my vote" and vote counts don't require an option join; also lets an option be deleted without losing who voted |
| `option_id` | `BigInteger` FK → `travel_poll_options.id`, `ondelete="CASCADE"`, indexed | |
| `voter_id` | `BigInteger` FK → `users.id`, `ondelete="CASCADE"`, indexed | CASCADE here (not RESTRICT): a vote has no meaning without its voter, unlike a reservation |
| `created_at` | `DateTime(timezone=True)`, server default | |

Constraints: **`UniqueConstraint("poll_id", "voter_id", name="uq_travel_poll_vote_per_poll")`**
— enforces one vote per user per poll at the database level, which is what
makes the vote endpoint idempotent-by-construction. Companion proxy votes are
**not** rows in this table (§3.4); a `CheckConstraint("voter_id IS NOT NULL")`
is unnecessary since the column is non-nullable.

### 3.4 `travel_poll_companions`

Device-local companions get a backend home **only when a poll is shared**.
Semantics preserved from `travel-poll-storage.ts` / `CompanionRosterProps`:
display name is free text (max 30 chars, trimmed/collapsed — replicate
`normalizeCompanionName` in a Pydantic validator), optional proxy vote on one
option, max 8 per poll-owner, case-insensitive name dedupe per owner.

| column | type | notes |
|---|---|---|
| `id` | `BigInteger` Identity PK | |
| `poll_id` | `BigInteger` FK → `travel_polls.id`, `ondelete="CASCADE"`, indexed | |
| `owner_id` | `BigInteger` FK → `users.id`, `ondelete="CASCADE"` | the participant who "brought" the companion; dedupe + limit are scoped to (poll, owner) |
| `name` | `String(30)`, nullable=False | display-only, exactly like the current `PollCompanion.name` |
| `option_id` | `BigInteger` FK → `travel_poll_options.id`, `ondelete="SET NULL"`, nullable | proxy vote; `NULL` = "بدون رأی" (matches `optionId: string \| null`) |

Constraints: `UniqueConstraint("poll_id", "owner_id", "lower(name)")` cannot
be expressed portably in SQLAlchemy's declarative form — use a
`CheckConstraint`-free unique **index** on
`(poll_id, owner_id, name)` with a lowercase expression, or enforce dedupe in
the service layer like `sanitizeCompanions` does today. Recommended for the
build plan: enforce in the service layer (the frontend already validates; the
DB index with an expression is a nice-to-have). Limit of 8: service-layer
check against `MAX_COMPANIONS` parity constant.

**Vote counting with companions**: an option's total = real votes on it
(`travel_poll_votes.option_id`) + proxy votes
(`travel_poll_companions.option_id`). The GET response returns both the
total and the split `voters` list (`["شما", ...companion names, ...other
participants' display names]`) so the existing `DatePollOption.voters`
rendering keeps working.

### 3.5 `travel_poll_participants`

| column | type | notes |
|---|---|---|
| `id` | `BigInteger` Identity PK | |
| `poll_id` | `BigInteger` FK → `travel_polls.id`, `ondelete="CASCADE"`, indexed | |
| `user_id` | `BigInteger` FK → `users.id`, `ondelete="CASCADE"` | requires an account (open question §7.2) |
| `role` | `String(20)`, `server_default="participant"`, `CheckConstraint IN ('owner', 'participant')` | owner row mirrors `travel_polls.owner_id` for uniform authorization queries |
| `last_seen_at` | `DateTime(timezone=True)`, nullable | cheap unread mechanism for §7.4: "new votes since I last looked" = votes with `created_at > last_seen_at` |
| `created_at` | `DateTime(timezone=True)`, server default | |

Constraints: `UniqueConstraint("poll_id", "user_id", name="uq_travel_poll_participant")`.

**Authorization model** (the §2 pattern applied to the new table): a user may
`GET` a poll / vote / add companions iff a `travel_poll_participants` row
exists for `(poll_id, user_id)` **or** `current_user.role == "admin"`.
Only the poll owner (or admin) may add options, close the poll, or finalize.
The owner's participant row is created in the same transaction as the poll
(like `create_reservation` writing `Reservation` + related rows in one
commit, `reservations.py:168-193`).

## 4. Proposed endpoints

New module `app/api/v1/endpoints/travel_polls.py` with
`router = APIRouter(prefix="/travel-polls", tags=["travel-polls"])`,
registered in `app/api/v1/router.py` after `wishlists.router`.
Schemas in `app/schemas/travel_poll.py`. All routes require
`CurrentUserDep` (the same OTP-based identity as every other endpoint;
`SessionDep` for the DB).

### 4.1 `POST /travel-polls` → `TravelPollResponse` (201)

Body: `TravelPollCreate { title?: str (≤120), options?: list[TravelPollOptionCreate] (≤ 20) }`.
Creates the poll, the owner's participant row, and (atomically) any seed
options — the frontend's `seedOptions` flow uploads its local options here
(§6.3). Runs `today_tehran()`-style validation: every `check_in` is not in
the past and `check_out > check_in` (mirrors `BaseReservationRequest`'s
`model_validator`, `app/schemas/reservation.py:18-25`).

### 4.2 `GET /travel-polls/{id}` → `TravelPollResponse` (participant-scoped)

404 if absent, 403 if the caller is not a participant/admin (the
`get_reservation` pattern, `reservations.py:293-321`). Eager-load options,
votes, companions, and participant users with `selectinload` (async sessions
cannot lazy-load). Response:

```
TravelPollResponse {
  id, title, status, expires_at, created_at,
  my_role: "owner" | "participant",
  options: [TravelPollOptionResponse],
  companions: [TravelPollCompanionResponse],   # only those owned by the caller? — see note
  participants: [TravelPollParticipantResponse],  # id, display_name, role
}
TravelPollOptionResponse {
  id, title, check_in, check_out, votes: int,
  voters: [str],           # display names incl. "شما" for the caller — keeps DatePollOption rendering
  my_vote: bool,           # caller has voted here
  is_finalized: bool,
}
```

Note: companions are returned **per caller** (each participant sees their own
roster) because proxy votes are personal — this matches today's per-device
roster and avoids exposing other people's guest lists. Vote totals include
every participant's companions, computed server-side.

### 4.3 `POST /travel-polls/{id}/options` → `TravelPollOptionResponse` (201)

Owner/admin only (403 otherwise); rejected with 400 if `status == "closed"`
or `check_in` is past. Body `TravelPollOptionCreate { title?, check_in,
check_out }` with the same date validators as §4.1. Cap of 20 open options
per poll (service-layer check) so the UI's option list can't grow unbounded.

### 4.4 `DELETE /travel-polls/{id}/options/{option_id}` → 204

Owner/admin only. CASCADE deletes the option's votes and nulls companion
proxy votes — mirroring what `sanitizeCompanions` does locally when an option
disappears. Finalized options cannot be deleted (409).

### 4.5 `POST /travel-polls/{id}/options/{option_id}/vote` → `TravelPollVoteResponse`

Idempotent per voter via the §3.3 unique constraint: the handler, inside one
transaction, deletes the caller's existing vote row for the poll (if any and
if it points elsewhere) and inserts the new one — a **move**, exactly like
the frontend's single-vote semantics (`firstVotedIndex` logic in
`loadPollState`). 403 if not a participant; 400 if the poll is closed/expired;
404 if the option belongs to a different poll. Re-voting for the *same*
option returns 200 with the current state and changes nothing.

### 4.6 Companion CRUD (the plan-106 seam, server-side)

- `POST /travel-polls/{id}/companions` → 201, body `{ name: str (≤30, trimmed
  via the `normalizeCompanionName` rule), option_id?: int }`. 400 on the
  8-companion limit or a duplicate (case-insensitive) name — the error string
  is what `CompanionRosterProps.onAdd`'s `string | null` return expects.
- `PATCH /travel-polls/{id}/companions/{companion_id}` → body
  `{ option_id: int | null }` — the `onAssign` seam. Setting a proxy vote on
  a closed poll → 400. (Renaming is out of scope; delete + re-add, as in the
  current UI.)
- `DELETE /travel-polls/{id}/companions/{companion_id}` → 204 — the
  `onRemove` seam.
- All three: only the companion's `owner_id` (or admin) may act; 403
  otherwise.

### 4.7 Sharing

- `POST /travel-polls/{id}/participants` — owner/admin adds participants by
  `user_id` (or phone, resolved to a user — §7.2). 201.
- `GET /travel-polls` — `list[TravelPollSummary]` for the caller
  (participant-scoped `WHERE EXISTS` on the participant table, the
  `list_my_reservations` shape, `reservations.py:248-267`), newest first,
  `skip`/`limit` with `ge/le`.

**If the maintainer picks link-sharing (§7.1)**, add one unauthenticated
route `POST /travel-polls/join/{share_token}` → 201, which resolves the
token to a poll and inserts the caller's participant row (409 if already a
participant). `share_token` is already in the schema; no other routes change.

## 5. Migration strategy

One Alembic migration, following the linear head discipline recorded in
`plans/README.md` (052 → 053 → 054 pattern; the chain must stay single-head):

1. Before creating the revision, confirm `alembic heads` reports exactly one
   head. **At the time of writing that head is `9a2a9af6d7ed`** — the build
   plan must re-verify against the then-current head and set
   `down_revision` to it, exactly as `b0055d33fb96` set `da30744ca8aa`.
2. `op.create_table` in dependency order: `travel_polls` →
   `travel_poll_options` → `travel_poll_votes` → `travel_poll_participants`
   → `travel_poll_companions` (FK targets first). Use
   `sa.BigInteger()` + `sa.Identity(always=True)` PKs, explicit
   `ForeignKeyConstraint([...], ondelete=...)`, `server_default=sa.text('now()')`
   for timestamps — copying the auto-generated style of
   `b0055d33fb96_create_reservation_messages_table.py`.
3. Named indexes via `op.create_index(op.f("ix_..."), ...)`; named
   constraints (`chk_travel_poll_status`, `chk_travel_poll_option_dates`,
   `uq_travel_poll_vote_per_poll`, `uq_travel_poll_participant`).
4. `downgrade()` mirrors exactly: drop indexes then tables in reverse order.
5. **No data migration**: existing polls live in browsers, not in the
   database (§6.3 covers the client-side story). The migration is therefore
   safe to run on a live database with zero rows at risk.
6. Verify (build plan's gates): `alembic upgrade head` from an empty
   database, then `alembic check` clean (the 052-established standard), and
   the ORM models match the migration (single `Base` registration in
   `app/models/travel_poll.py`).

## 6. Frontend impact sketch

### 6.1 The plan-099 seam becomes a data-source switch

`travel-poll-modal.tsx` currently imports from `@/lib/travel-poll-storage`
and calls `loadPollState`/`writeStorage`. The build plan adds a sibling
module `frontend/src/lib/travel-poll-api.ts` that exposes the **same
operations** over `apiClient`:

| storage export | API replacement |
|---|---|
| `loadPollState(seedOptions)` | `GET /travel-polls` (+ `GET /travel-polls/{id}`) or `POST /travel-polls` with the seed options (lazy create on first authenticated open) |
| `serializeOptions` | unnecessary — the server returns computed `votes`/`voters` |
| `writeStorage` | delete |
| roster `onAdd`/`onAssign`/`onRemove` callbacks | §4.6 endpoints, wrapped so `CompanionRosterProps` stays **byte-identical** (plan 106's component does not change) |
| `sanitizeCompanions` / `isValidStoredPollOption` | kept — still used to validate the *local* payload before upload (§6.3) |
| `MAX_COMPANIONS`, `normalizeCompanionName` | kept as the single source of the rules; the backend mirrors them |

Types: `DatePollOption` gains nothing (its extra fields were always derived);
a new `TravelPollResponse` type mirrors §4.2. The modal maps the response
back into `DatePollOption` (deriving `date_range`, `nights_count`, holiday
tags client-side as it already does).

### 6.2 Offline / anonymous behavior

`loadPollState` stays for the **unauthenticated visitor**: no session → the
modal renders exactly today's local simulation (seed options, local roster),
so the public site loses nothing. The storage module keeps its legacy
`jabama_*` migration untouched.

### 6.3 Device-local polls: graceful upgrade, recommended

**Recommendation: keep local-only polls working offline; add "share this
poll" that uploads it.** Concretely: when an authenticated user opens the
modal and a healthy local poll exists (`isValidStoredPollOption`-validated,
future-dated), the UI offers "اشتراک‌گذاری نظرسنجی" — one `POST /travel-polls`
call with the local options (and optionally the roster as companions),
which returns the shared poll id; the modal then switches to server state.
Voters' local names become companion rows; the user's own vote is re-cast via
§4.5. There is no bulk migration and no data loss if the user declines — the
local poll keeps working as-is. localStorage keys are **not** removed in v1
(the local state remains the offline fallback), but a "shared" flag in
storage can suppress re-offering the upload.

### 6.4 Finalize routing (plan 086) is unchanged

The winning option's `check_in`/`check_out` still drive
`router.push("/search?check_in=...")`; the only change is that the chosen
option now also gets `is_finalized = true` server-side via an owner action
(`POST /travel-polls/{id}/finalize` — optionally added in the build plan; not
required for v1 parity).

## 7. Open questions for the maintainer (list, not decisions)

1. **Sharing mechanism — link-token vs wishlist-shared.** §3.1/§4.7 support
   both cheaply: `share_token` + one join route (share anyone with the link),
   or participants added explicitly by phone/user-id (share only known
   accounts). Link sharing maximizes the "همسفران" use-case (companions may
   be casual contacts) but makes polls enumerable by token-guessing unless
   the token is long-random (24+ bytes). Decision affects whether the join
   route ships in v1.
2. **Vote identity — must participants have accounts?** §3.5 assumes yes
   (`user_id` FK). The alternative (anonymous voters keyed by a device token)
   would abandon the app-wide OTP identity, require abuse controls, and
   cannot reuse the `users` FK patterns. Recommended: accounts required;
   the companion roster already covers "my +1s who don't have accounts".
3. **Poll expiry.** `expires_at` is in the schema, but the policy is a
   product decision: no expiry, fixed (e.g. 30 days), or owner-set? The
   frontend already hides past-`check_in` options (`isFutureCheckIn`), so a
   natural default is: poll auto-closes when all options' `check_in` dates
   have passed (enforced read-time, no cron).
4. **Notification surface — reuse chat's unread pattern?** Plan 072 shipped
   `unread_messages_count` via `read_at` + a `POST .../messages/read` route.
   The cheapest poll equivalent is the proposed `last_seen_at` on the
   participant row + a `new_votes_count` field on the summary list response
   (no new table, one UPDATE route). A richer option (per-event rows) is
   overkill for v1. Decision: ship the counter, or defer notifications
   entirely.
5. **Companion proxy votes on shared polls — visible to everyone?** Today
   proxy votes are visible only on the owning device. This design counts
   them in totals and shows their names in `voters` (matching the current
   demo rendering). If the maintainer prefers privacy, `voters` should list
   only real voters and companions collapse into the count.

## 8. Test-plan sketch (carried by the future build plan)

Parity with the 246-test suite's patterns (`tests/test_reservations.py`
style: API-level tests against the disposable `ashianak_test` DB):

- CRUD + authorization matrix: owner / participant / non-participant / admin
  × each endpoint (403/404/409 paths).
- Vote idempotency: two votes by one user → one row (unique constraint);
  moving the vote decrements the old option.
- Companion rules: limit 8, case-insensitive dedupe, `option_id` SET NULL on
  option delete, 30-char name normalization.
- Date validators: past `check_in`, `check_out <= check_in` → 422.
- Closed/expired poll rejects votes and option creation.
- Migration: `alembic upgrade head` from empty DB + `alembic check` clean.
- Frontend: `npm run lint` + `npm run build` per the repo's UI definition of
  done; component tests for the modal's shared/local mode switch.

## 9. Out of scope (unchanged from plan 107)

No production code, no migrations, no schema changes in this design spike.
Everything in §§3–8 is a specification for a future executor plan.
