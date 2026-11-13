# 108 — Backend Thumbnail Pipeline for Uploads: Design Spike

> **Deliverable**: design document only (this file). No production code is
> changed by plan 108; the build is a future plan.
> **Planned at**: commit `b94e2bd`, 2026-11-14. Investigated at HEAD `d278cdd`
> (branch `advisor/108-thumbnail-pipeline-design`).
> **Depends on**: plan 090 (`advisor/090-uploads-image-optimization`, commit
> `8f2bcf7` — landed on its own lane, NOT an ancestor of this branch) and
> plan 103 (`4eabc8e` — IS an ancestor of this branch via `d278cdd`). See §9
> for the explicit layering recommendation.

## 0. Recommendation in one paragraph

Build a **synchronous, at-upload variant pipeline**: when an image is stored
under `UPLOAD_DIR`, generate three WebP variants (`thumb` 400w, `card` 800w,
`gallery` 1200w) next to the original, named `<uuid-hex>.<variant>.webp`. This
naming is a **single flat ASCII segment of `[A-Za-z0-9._-]+`**, so it flows
through plan 103's hardened Next.js rewrite unchanged. The original is always
retained and stays the canonical URL in the database — **no schema change, no
API change**; the frontend derives variant URLs by convention (§8) with an
`onError` fallback to the original. Generation requires adding **Pillow** — the
repo has no image library today (verified three ways, §1.4); Pillow is
presented as the primary recommendation with alternatives listed for the
maintainer (§5). With plan 090 already landed, keep the next/image optimizer
**on top of** backend thumbnails (§9) — the two layers are complementary, and
the maintainer may reasonably also decide *not* to build this at all; the
honest incremental value is listed in §9.2.

## 1. Current state (verified evidence, this session)

### 1.1 Upload path — module location correction

The plan guessed `app/routers/uploads.py`; the actual module is
**`app/api/v1/endpoints/uploads.py`** (plan-052/053 lineage relocated it).
Verified facts:

- `POST /api/v1/uploads/image`, authenticated (`CurrentUserDep`);
  `tests/test_uploads.py:20-26` proves unauthenticated = 401, and
  `test_uploads.py:33` uses a **guest** token successfully — any logged-in
  user can upload.
- Body cap: `MAX_UPLOAD_SIZE_MB` default 5, configurable 1–20
  (`app/core/config.py:46`).
- Content sniffing decides the stored extension; the client filename is never
  trusted (`app/api/v1/endpoints/uploads.py:14-29`). Accepted set:
  JPEG (`.jpg`), PNG (`.png`), WebP (`.webp`, with the `RIFF…WEBP` double
  check at lines 19, 26).
- Storage name: `filename = f"{uuid4().hex}{extension}"`
  (`app/api/v1/endpoints/uploads.py:59`) — 32 lowercase hex chars + one of
  three extensions. **This charset is what plan 103's rewrite encodes.**
- Write is thread-offloaded: `await anyio.to_thread.run_sync(
  (upload_dir / filename).write_bytes, data)` (line 60). One flat write per
  upload, no subdirectories.

### 1.2 Serving path

- The backend serves uploads as static files:
  `app.mount("/uploads", StaticFiles(directory=_upload_dir), name="uploads")`
  (`app/main.py:92-96`), dir from `UPLOAD_DIR` (default `"uploads"`,
  `app/core/config.py:45`). `DEPLOYMENT.md` §2 warns the dir must be
  persistent and outside the release directory.
- Frontend proxies the same path: `next.config.ts:57-68` rewrite
  `/uploads/:file([A-Za-z0-9._-]+)` → `${BACKEND_ORIGIN}/uploads/:file`
  (plan 103's hardening; commit message documents the traversal-probe matrix).
- Production edge: nginx TLS reverse proxy (`DEPLOYMENT.md` §9). No image
  CDN, no on-the-fly transform layer, and **no Cache-Control configuration
  for `/uploads`** anywhere in the repo. `client_max_body_size 2m` in the
  sample config is smaller than the backend's 5 MB default cap (pre-existing
  mismatch, noted as an aside in §11).
- Starlette's `StaticFiles` (verified against the installed version) sends
  **ETag** (304 revalidation works) but **no `Cache-Control`** — browsers
  re-request every image on repeat visits.
- Render sites: the audit behind plan 090 stands; this branch still has
  `next/image` present in `photo-gallery.tsx`, `accommodation-card.tsx`,
  `stay-slider.tsx`, `checkout/reservation-summary.tsx`, `climate-rail.tsx`,
  `season-guide.tsx`, `host-story.tsx` (grep evidence), with `unoptimized`
  props still present in this lane (090 removes them on its lane).

### 1.3 Database and URLs

- `accommodation_image.image_url` is `String(255)` non-null
  (`app/models/accommodation.py:172`); the API round-trips whatever was
  stored. Uploads return **relative** URLs (`/uploads/<file>`,
  `uploads.py:62`).
- **Seed data uses only external absolute URLs**
  (`app/seeds/seed_data.py:234,240,308,314` — Unsplash), so no seed row would
  be touched by a backend pipeline; retrofit concerns uploaded files only.

### 1.4 Image-library check — the plan's premise is FALSE

The plan hypothesized "the backend already processes images somewhere for
validation". It does **not**: upload validation is pure magic-byte sniffing.
Pillow/any image lib is absent, verified three ways in this session:

1. `Select-String -Path pyproject.toml -Pattern "pillow|Pillow|imagesize|PIL"`
   → no match (runtime deps at `pyproject.toml:11-21` and dev deps at 35-44).
2. Grep `PIL|pillow|Pillow|imaging` over `app/**/*.py` → no match.
3. Runtime check in the `ai_bootcamp` env:
   `importlib.util.find_spec("PIL")` → `None`.

Consequence: variant generation **requires a new dependency** (§5). This
borders the plan's first STOP condition; resolved as "present options, don't
halt" because adding Pillow is not license/size-controversial (§5) — the
*choice* stays with the maintainer.

### 1.5 Suite baseline

`pytest --collect-only -q` in the `ai_bootcamp` env → **246 tests collected**,
matching the plan's expected ~246. Baseline recorded for the future build plan
(no changes made in this spike).

## 2. Goals and non-goals

**Goals**
- Grid/collage/slider render sites stop downloading multi-MB originals.
- Zero per-request transform cost on the Next server for cold-cache images.
- Immutable variant URLs with long-lived browser/CDN caching.
- Originals always recoverable (variants are re-derivable from them).

**Non-goals**
- Object storage / S3 migration (uploads stay on local disk per §1.1).
- User-facing avatar uploads (only accommodation images exist today).
- Video, HEIC, or any new input format (sniffed set stays JPEG/PNG/WebP).
- EXIF handling of *originals* beyond documenting the current exposure (§10.2).

## 3. Variant strategy

### 3.1 Variant table

| Variant   | Max width | Encode                     | Serves                          |
|-----------|-----------|----------------------------|---------------------------------|
| `thumb`   | 400 px    | WebP, quality 75           | grid cards, 5-photo collage tiles (~300-400 CSS px) |
| `card`    | 800 px    | WebP, quality 75           | explore card 2x-DPR, slider preload |
| `gallery` | 1200 px   | WebP, quality 80           | detail-page slider / lightbox   |
| (none)    | —         | original bytes, untouched  | canonical DB URL, download link, fallback |

Aspect ratio preserved (single-dimension resize); upscaling never applied
(source narrower than the target → variant equals source dimensions).
Landscape/portrait handled by the same rule. Widths chosen from the audit's
render-site CSS sizes; they are a `PIPELINE_VARIANTS` constant in the future
build, not per-request parameters.

### 3.2 Format choice: WebP over AVIF

- **WebP**: encodable by stock Pillow, decoded by every browser that matters,
  typically 25-35% smaller than JPEG at q75. Chosen.
- **AVIF**: needs `pillow-avif-plugin` (second native dependency, slower
  encode, occasional wheel gaps on Windows) for ~10-20% more savings.
  Deferred; the naming scheme below is format-agnostic so this can be added
  later as `<hex>.<variant>.avif` without touching anything else.
- **JPEG quality tiers**: rejected as primary — no additional savings over
  WebP at these sizes and no format win; kept only as a fallback if the
  maintainer refuses the WebP encoder dependency (same Pillow install either
  way, so there is no realistic fallback case).

### 3.3 Naming convention — and the plan-103 interaction

**`<uuid-hex>.<variant>.webp`** — e.g. original `3f9c….jpg` produces
`3f9c….thumb.webp`, `3f9c….card.webp`, `3f9c….gallery.webp`.

This is a deliberate interaction with plan 103
(`advisor/103-uploads-rewrite-constraints`, commit `4eabc8e`, **ancestor of
this branch** — verified with `git merge-base --is-ancestor`):

- The rewrite source is `/uploads/:file([A-Za-z0-9._-]+)` — exactly one
  segment, charset `A-Za-z0-9._-`. The variant name is a 32-char lowercase
  hex uuid, one dot, one ASCII variant word, one dot, `webp` — **fully inside
  the charset, single segment, forwarded by the existing proxy untouched**.
  No `next.config.ts` change is needed.
- No slashes → the "nested path" 404 behavior documented in 4eabc8e is
  preserved by construction.

Rejected alternatives (and why):

1. **Subdirectory** `uploads/thumbs/<hex>.webp` — violates the single-segment
   rewrite (`/uploads/thumbs/x.webp` returns Next's 404, never forwarded;
   verified in 4eabc8e's probe table). Would require re-widening the rewrite
   to `:path*`, i.e. un-doing plan 103's hardening. Rejected.
2. **Query parameter** `/uploads/<hex>.jpg?w=400` — `StaticFiles` ignores
   query strings; implementing it means a dynamic route replacing the static
   mount, which forfeits sendfile-style serving and splits cache keys.
   Rejected.
3. **Extension swap** `3f9c….webp` (drop the original's extension) — collides
   conceptually with uploads that are *already* WebP (`3f9c….webp` original
   vs a variant of `3f9c….png` named the same). The `<variant>` infix is what
   makes names collision-free and glob-discoverable (`<hex>.*.webp`). Rejected.

### 3.4 What lives on disk after one upload

```
UPLOAD_DIR/
  3f9c….jpg            ← original, canonical, never modified
  3f9c….thumb.webp     ← 400w
  3f9c….card.webp      ← 800w
  3f9c….gallery.webp   ← 1200w
```

Storage math: originals ≤ 5 MB (cap, config `ge=1 le=20`); the three WebP
variants typically total 15-40% of the original's size, so disk grows by
roughly 1.2-1.5× per image, not 4×. Retention of originals is an open
question (§11.4).

## 4. Generation point — synchronous at upload (recommendation)

**Recommendation: generate variants synchronously inside the upload endpoint,
thread-offloaded like the existing write.**

```python
# sketch for the future build plan — not part of this spike
await anyio.to_thread.run_sync(_store_with_variants, upload_dir, filename, data)
```

Trade-off analysis:

| Option | Availability guarantee | Latency hit | New infrastructure | Failure surface |
|---|---|---|---|---|
| **Sync at upload (rec.)** | Variants exist before the URL is persisted — no partial state ever | +100-600 ms on the POST (decode + 3 encodes of a ≤5 MB image on a worker thread) | none | endpoint returns 5xx on encoder failure; original still written → retryable, idempotent |
| Lazy on first request (async worker) | 404 window until ready; needs invalidation-aware fallback | zero on POST | worker process or task queue (none exists in repo) | double-generation race needs a lock; "missing variant" handling on every render site |
| FastAPI BackgroundTasks | non-durable — task dies if the process restarts before running (uvicorn single-worker guidance in DEPLOYMENT.md §5) | zero on POST | none but unreliable | silent missing variants; hardest to reason about |
| Celery/RQ/arq queue | durable with broker | zero on POST | Redis + worker deployment — far beyond current ops posture (DEPLOYMENT.md runs one uvicorn process) | ops burden |

Why synchronous wins here:

1. **No queue infrastructure exists or is wanted** — DEPLOYMENT.md §5's
   scaling guidance is deliberately minimal (single worker, in-process
   limiter). Introducing a broker for three image encodes is disproportionate.
2. **Uploads are low-frequency, authenticated host/guest actions** — the
   100-600 ms cost lands on the person uploading, once, in exchange for every
   future view being cheap. That is the correct party to pay it.
3. **The endpoint already thread-offloads disk IO** (line 60); extending the
   same `to_thread` pattern adds no new concurrency model.
4. **Idempotent recovery**: the original is written first; if variant encoding
   throws, the endpoint can still return the original URL (degraded mode,
   flag to logs) or 503 (strict mode) — decide in the build plan; either way
   re-uploading or running the backfill script (§7) repairs state.
5. If upload latency is ever *measured* as a problem, the lazy-worker path can
   be layered later without changing the on-disk layout or URLs.

Bounded-risk note for the build plan: guard against decompression bombs with
Pillow's `Image.MAX_IMAGE_PIXELS` (default warns at ~89 Mpx, errors at ~178
Mpx; the 5 MB upload cap already bounds most abuse) and keep decode/encode
inside `to_thread` so the event loop never blocks.

## 5. Dependency: Pillow (new) — options for the maintainer

Verified absent (§1.4). The plan's STOP condition asks for options rather
than a unilateral pick:

| Option | Verdict | Notes |
|---|---|---|
| **Pillow (recommended)** | MIT-style (HPND + Pillow Charity License), pure wheels for cp312 on Windows/Linux, ~4 MB installed, the de-facto standard | One dependency buys decode + WebP encode + EXIF stripping + resize; matches `requires-python >= 3.12` |
| `pillow-avif-plugin` alongside | optional later add-on | AVIF encode; separate native build, not needed for v1 |
| `pyvips` / libvips | rejected for v1 | fastest, but a system-library deployment dependency contradicting the repo's `pip install .` deployment story (DEPLOYMENT.md §4) |
| Pure-Python image libs | rejected | no credible WebP encoder |
| Hand-rolled minimal decoders | rejected | reimplementing JPEG/PNG decode is a security anti-pattern |

License/size are unobjectionable; the only real decision is "add a runtime
dependency to the API process vs keep uploads transform-free on the backend".
If the maintainer declines, the honest alternative is **stay on plan 090
only** (frontend optimizer) — documented in §9.2.

## 6. Serving and caching

- Variant URLs are **immutable forever** (content is derived from an
  immutable original whose name is a uuid). Current serving gives an ETag but
  no `Cache-Control` (verified §1.2), so repeat visits re-request every image.
- Proposal for the build plan: serve variant paths with
  `Cache-Control: public, max-age=31536000, immutable`. Two implementation
  options, both additive:
  1. **Backend**: replace the single `StaticFiles` mount with two mounts —
     originals unchanged, variants from a thin `StaticFiles` subclass that
     injects the header (or a small route handler). No frontend change.
  2. **Edge (nginx)**: `location ~ ^/uploads/.+\.webp$ { proxy_pass …;
     add_header Cache-Control "public, max-age=31536000, immutable"; }` in
     the DEPLOYMENT.md §9 block. Works without code changes but duplicates
     policy outside the repo's control.
  Recommendation: option 1 (policy in code), with option 2 documented as the
  CDN-free production accelerator. Originals deserve the same immutable
  header (uuid names too) — a free win independent of thumbnails.
- No image CDN or transform layer exists in DEPLOYMENT.md (checked in full
  this session) — the plan's second STOP condition does not trigger; the
  design integrates with plain nginx + browser caching only.

## 7. Retrofit for existing uploads (backfill script)

Follows repo conventions: a standalone script in `scripts/` (the dir holds
`.mjs` and `.sql` today; the closest Python CLI precedent is
`app/seeds/seed_data.py`'s argparse interface), stdlib + Pillow only, no DB
access needed (variants are derivable from the filesystem alone):

```
python scripts/backfill_thumbnails.py [--dry-run] [--dir UPLOAD_DIR] [--variants thumb,card,gallery]
```

Behavior contract for the build plan:

- Scan `UPLOAD_DIR` for `*.jpg|*.png|*.webp` originals (regex
  `^[0-9a-f]{32}\.(jpg|png|webp)$` — anything else is skipped with a warning,
  since only the upload endpoint writes there).
- **Idempotent**: skip a variant if it exists and its mtime ≥ the original's;
  `--force` re-encodes.
- Never renames/deletes/modifies an original → safe to run while the API is
  serving; variants appear atomically (write to `*.tmp` then rename within
  the same directory).
- `--dry-run` prints the would-be work and exit code 0; real run prints a
  per-file summary and exits non-zero if any file failed (mirrors the exit-
  code discipline of `scripts/seed_from_jabama.mjs`).
- Windows dev + Linux prod both supported via `UPLOAD_DIR` env / `--dir`
  (DEPLOYMENT.md §2 documents the persistent path requirement).
- Seed images need no backfill — they are external Unsplash URLs (§1.3).

## 8. Frontend contract

**Recommendation: convention-based URLs derived in the frontend; no API or
schema change.** The backend keeps returning/storing the original's relative
URL as the single source of truth.

Derivation helper (build-plan sketch):

```ts
// lib/upload-variants.ts — future plan; matches the backend generator exactly
const UPLOAD_RE = /^\/uploads\/([0-9a-f]{32})\.(jpg|png|webp)$/;
export function variantUrl(imageUrl: string, variant: "thumb" | "card" | "gallery"): string | null {
  const m = UPLOAD_RE.exec(imageUrl);
  return m ? `/uploads/${m[1]}.${variant}.webp` : null; // null → caller keeps original
}
```

Properties:

- **Charset-proof against plan 103**: the produced URL is again a single
  `[A-Za-z0-9._-]+` segment; the existing rewrite forwards it.
- **Absolute-URL guard**: derivation returns `null` for anything not matching
  the upload shape — seed Unsplash URLs and free-form `image_url` values keep
  their current behavior (the same guard plan 090 applies for next/image).
- **Graceful degradation**: render sites pass the variant URL to `next/image`
  with `onError` → fall back to the original URL (Next 16 supports `onError`;
  noted in 090's commit message). Covers backfill gaps and strict-mode
  encoder failures.
- `String(255)` column untouched; no migration.

**Alternative (documented, not recommended first)**: the backend payload
grows an explicit `variants: { thumb?: string; card?: string; gallery?: string }`
on accommodation-image schemas. More discoverable and type-safe, but touches
`app/schemas/accommodation.py`, three response builders
(`accommodations.py:1087`, `reservations.py:209`, `accommodation_service.py:43`),
and every frontend consumer for information the URL convention already
encodes. Sensible upgrade path if variants ever differ per image (e.g. some
legacy file lacks variants).

**Per-render-site usage** (build plan detail): grid/collage → `thumb` with
`srcSet` thumb 1x, card 2x; explore card → `card`; detail slider → `gallery`
+ `sizes`. The optimizer layering (§9) may make some of this moot — the build
plan should re-audit render sizes at implementation time.

## 9. Interaction with plan 090 — explicit layering recommendation

Plan 090 (`8f2bcf7`) **landed on its own lane** (`advisor/090-uploads-image-
optimization`, verified not an ancestor of this branch) and did the opposite
of nothing: it *enabled* next/image optimization for relative `/uploads` srcs
(dropped `unoptimized`, converted plain `<img>` sites). This branch's base
`d278cdd` predates it, which is why `unoptimized` is still visible here (§1.2).

### 9.1 Recommendation: keep the optimizer ON TOP of backend thumbnails

```
browser → next/image optimizer (DPR/viewport sizing, WebP/AVIF, LRU cache)
        → GET /uploads/<hex>.<variant>.webp  (FastAPI static, immutable cache)
        → disk
```

- The backend variant becomes the optimizer's **source fetch** — small,
  predictable, cacheable — instead of a multi-MB original.
- The optimizer remains responsible for *presentation-side* correctness:
  exact DPR-appropriate widths, `quality`, AVIF where supported, in-memory
  LRU. Backend variants are *origin-side*.
- Double compression is a single extra re-encode (WebP source → WebP output
  at q75); quality loss is negligible at these settings.

### 9.2 Honest incremental value — the maintainer may decline to build

With 090 already live, backend thumbnails buy:

1. **Cold-cache origin cost**: the Next optimizer fetches the source once per
   (image, width, quality) key — until warmed, it pulls the full original.
   Variants bound even the cold case.
2. **Non-Next consumers**: OG/social preview crawlers, e-mail, and any future
   mobile client hit the backend directly and get none of next/image's help.
   Today they download originals.
3. **Predictable caching**: immutable variant URLs with year-long
   `Cache-Control` (§6) are trivially CDN-friendly; the optimizer's cache is
   process-local LRU.
4. **Reduced Next-server CPU** under cold traffic (no transform needed when
   the source is already near target size).

If the maintainer values none of 1-4, the correct decision is **do not build
108** — 090 alone is the cheaper win and requires zero backend change. The
design is safe to postpone: nothing in 090 or 103 conflicts with adding it
later.

### 9.3 Never bypass the optimizer for grid sites

Pointing `<Image>` at variant URLs with `unoptimized` restored would forfeit
DPR sizing. Bypassing is only interesting for the lightbox/OG case where the
variant already matches the display size — a per-site decision for the build
plan, not a global flip.

## 10. Security and privacy

### 10.1 Decode safety (build-plan requirements)

- Decode untrusted bytes only inside `to_thread` (pattern already present).
- Respect Pillow's decompression-bomb guard (`Image.MAX_IMAGE_PIXELS`); the
  5 MB cap is the first line, the pixel guard the second.
- Variants are **re-encodes**: metadata is not copied by default →
  `Image.open` + resize + `.save(..., "WEBP")` drops EXIF/XMP. This is the
  privacy behavior we want (§10.2) and should be asserted by a test so a
  future `exif=` argument doesn't silently leak GPS data.
- Upload auth unchanged; variants are written only by the endpoint and the
  backfill script, never from client-controlled paths (name is always derived
  from the server-generated uuid).

### 10.2 EXIF on ORIGINALS — current exposure worth knowing

Originals are served verbatim at `/uploads/<hex>.jpg` today, so any EXIF in
an uploaded photo (camera, **GPS coordinates**) is public at the original URL.
Variant URLs would be clean, but the original remains reachable — including
via the canonical URL stored in the DB and used as the `onError` fallback
(§8). Stripping EXIF from originals at upload would fix this but **breaks
`tests/test_uploads.py:44`** (`stored.read_bytes() == PNG_BYTES` asserts
byte-exact storage), so it is a deliberate maintainer decision — see §11.5.

### 10.3 What plan 103 changes for this design

Nothing must change. Variant names are inside the rewrite charset (§3.3);
the rewrite's method-agnosticism (POST forwarding, noted in 4eabc8e) is
irrelevant to GET-only image serving. If the maintainer ever adopts the
subdirectory alternative (§3.3 rejected), plan 103's rewrite must be
re-widened in the same change — flagged here so the interaction is visible.

## 11. Open questions for the maintainer

1. **Dependency approval (blocks the build plan)**: add Pillow (§5)? If no →
   plan 108 is retired and 090 stands alone.
2. **Strict vs degraded failure mode** (§4.4): encoder failure at upload →
   503 (caller retries) or 201 with original-only + log (backfill repairs)?
   Recommendation: degraded (201 + log), because upload success already
   persisted user-visible state and the backfill script is idempotent.
3. **Variant set and widths** (§3.1): are 400/800/1200 + WebP-q75/80 the right
   first cut given actual render sizes? Needs a quick pass over the shipped
   CSS on 090's lane.
4. **Original retention** (§3.4): keep originals forever (recommended —
   re-derivability) or add a pruning policy once storage growth is measured?
   Pruning breaks re-encoding future variants and the `gallery` fallback.
5. **EXIF stripping on originals** (§10.2): privacy-positive but changes
   stored bytes and one test's byte-equality assertion. Independent of this
   plan; cheap to do whenever decided.
6. **Cache-Control rollout** (§6): backend mount (recommended) or nginx
   `add_header`? Also: apply the immutable header to originals now, even
   before thumbnails exist?
7. **Aside — pre-existing mismatch**: the nginx sample caps bodies at
   `client_max_body_size 2m` while the backend default allows 5 MB
   (`MAX_UPLOAD_SIZE_MB`); DEPLOYMENT.md §2 already tells operators to raise
   the proxy limit, but the sample config contradicts it. Worth a one-line
   fix in whichever doc plan lands next.
8. **Upload quotas**: any authenticated user can upload unlimited 5 MB files
   (§1.1); variants multiply disk per upload ~1.2-1.5×. Out of scope here,
   but the pipeline makes the existing absence of quotas slightly more
   expensive.

## 12. What the future build plan must carry

- `pyproject.toml`: `pillow>=11` (or maintainer-approved alternative) + a
  `pip-audit` clean pass.
- `app/api/v1/endpoints/uploads.py`: `_store_with_variants` (thread-offloaded,
  §4 sketch), degraded/strict mode per §11.2 decision, pixel guard.
- Cache-Control serving per §6 option 1 (+ tests for the header).
- `scripts/backfill_thumbnails.py` per §7 contract.
- `lib/upload-variants.ts` + render-site changes per §8, layered on 090's
  lane (§9) — expect merge work if 090 lands first (it changes the same
  components).
- Tests extending `tests/test_uploads.py` patterns: reuse `PNG_BYTES`,
  `guest_token`, `monkeypatch` of `MAX_UPLOAD_BYTES`; add — variants exist
  and differ from original; non-image upload produces no variants; EXIF not
  present in variants; header assertion; backfill idempotency test.
- DEPLOYMENT.md §2: document any new env knobs (variant list is a constant
  first; make it configurable only if a maintainer asks).

## 13. Evidence appendix (commands actually run this session)

| Question | Command / method | Result |
|---|---|---|
| Upload module | read `app/api/v1/endpoints/uploads.py` | 62 lines; sniffed ext; uuid4().hex; to_thread write |
| Static mount | read `app/main.py:92-96` | `StaticFiles(directory=UPLOAD_DIR)` at `/uploads` |
| Rewrite charset | read `frontend/next.config.ts:57-68`; `git show 4eabc8e` | `[A-Za-z0-9._-]+` single segment; probe matrix in commit msg |
| 103 ancestry | `git merge-base --is-ancestor 4eabc8e HEAD` | exit 0 → ancestor |
| 090 state | `git log advisor/090-uploads-image-optimization -1`; `git merge-base --is-ancestor 8f2bcf7 HEAD` | `8f2bcf7` exists; exit 1 → NOT ancestor |
| Pillow | `Select-String pyproject.toml`; grep `app/**`; `find_spec("PIL")` | absent in all three |
| Cache headers | `inspect.getsource(StaticFiles)` (installed starlette) | ETag yes, Cache-Control no |
| Render sites | grep `unoptimized\|next/image` in `frontend/src` | 8+ sites in this lane (090 changes them on its lane) |
| Seed URLs | grep `image_url` in `app/seeds/seed_data.py` | external Unsplash absolute URLs only |
| Suite baseline | `pytest --collect-only -q` (ai_bootcamp env) | 246 collected (plan expected ~246) |
| Sibling spike commit style | `git show d78e031 --name-status` | empty commit for gitignored design doc |
| scripts conventions | list `scripts/`; read `seed_from_jabama.mjs` header | .mjs/.sql; exit-code discipline documented |
