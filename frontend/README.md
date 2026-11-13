# Ashianak Frontend

Next.js 16 App Router front end for the Ashianak accommodation booking platform: an RTL Persian booking UI on React 19, Tailwind CSS v4, and shadcn/ui, backed by the FastAPI API (see the root [README](../README.md)).

## Prerequisites

- Node.js >= 20.9.0 (Next 16's floor per its `engines` field) and npm
- The FastAPI backend running on `localhost:8000` — see the root README's [Getting Started](../README.md#getting-started) section (Postgres, `.env`, migrations, seed, uvicorn)

## Setup

```bash
npm install
```

Both environment variables have localhost fallbacks; only set them if your API base differs:

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_API_URL` — browser-side API base (compile-time inlined into the client bundle)
- `BACKEND_ORIGIN` — server-side target for the `/uploads/*` image rewrite in `next.config.ts`

## Develop

```bash
npm run dev
```

Open http://localhost:3000.

## Verify

| Command | What it does |
|---------|--------------|
| `npm run typecheck` | TypeScript (`tsc --noEmit`) — fastest gate; run before committing |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm run build` | Full production build; run before pushing |

## Conventions

- UI rules live in the root [`AGENTS.md`](../AGENTS.md) and [`frontend/AGENTS.md`](AGENTS.md): design tokens from `src/app/globals.css` only (no raw color literals), and shadcn/ui primitives from `src/components/ui` — extend existing components with `variant`/`size`/`className` instead of cloning them.
- Feature components live in `src/components/<domain>` (e.g. `explore`, `trips`, `host`, `wishlist`); shared shadcn primitives stay in `src/components/ui`.
- Routes live in `src/app` (App Router); API calls go through `src/lib/api-client.ts`.
