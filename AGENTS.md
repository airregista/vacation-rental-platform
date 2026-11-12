# Agent Guidelines & Repository Workflow

## Environment & Python Execution
- Conda Environment: `ai_bootcamp`
- Interpreter Path: `C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe`
- Always run commands using the full interpreter:
  - Run tests: `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest -v`
  - Lint: `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m ruff check app/`
  - Migrations: `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m alembic current`

## Database Architecture
- PostgreSQL Cluster: Local port 5432 (`ashianak_db`)
- Async Driver: `asyncpg` via SQLAlchemy 2.0
- Migrations: Managed through Alembic under `migrations/`
- Connection Pooling: Configured with `AsyncAdaptedQueuePool`

## Multi-Host & Authorization Rules
- Accommodations feature `host_id` foreign key referencing `users.id`.
- Modifying or deleting accommodations is authorized for `role == "admin"` or `host_id == current_user.id`.

## Frontend UI Conventions
- **Design tokens live in `frontend/src/app/globals.css`.** Colors, typography,
  radii, shadows, and other design tokens are CSS variables defined in
  `:root` / `.dark` and exposed through `@theme inline`. Add or change the token
  there first; never hardcode a hex/rgb/hsl value, font stack, or bespoke
  radius/shadow in a component.
- Consume tokens through semantic Tailwind utilities generated from the theme
  (`bg-background`, `text-muted-foreground`, `border-border`, `rounded-lg`,
  `rounded-xl`, etc.) or `var(--token)`. Avoid arbitrary values such as
  `bg-[#F05A28]` or `text-slate-500` when a semantic token already exists.
- **Use shadcn/ui primitives from `frontend/src/components/ui`.** Compose the
  existing primitives (`Button`, `Card`, `Dialog`, `Input`, ...) instead of raw
  HTML or a new hand-rolled primitive. Add missing primitives with the shadcn
  CLI so they keep the shared `cn()` and `class-variance-authority` conventions.
- **Extend, don't clone.** Scale a shadcn component with its `variant`, `size`,
  and `className` props. If a new visual style is needed, add a variant to that
  component's `cva` definition rather than copying the component.
- **No duplicate components.** Before creating a component, search
  `frontend/src/components` for an existing implementation and reuse or extend
  it. Promote genuinely shared code to the right location:
  - generic primitives → `frontend/src/components/ui`
  - components shared by multiple features → `frontend/src/components/<domain>`
  - genuinely single-use components → stay in that feature folder only
  If two copies already exist, consolidate them in the same change and delete
  the duplicate.
- **UI definition of done:** `npm run lint` and `npm run build` pass in
  `frontend/`; the diff contains no raw color/radius/shadow literals that belong
  in `globals.css`; and no new component duplicates an existing one.
