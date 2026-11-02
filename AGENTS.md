# Agent Guidelines & Repository Workflow

## Environment & Python Execution
- Conda Environment: `ai_bootcamp`
- Interpreter Path: `C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe`
- Always run commands using the full interpreter:
  - Run tests: `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest -v`
  - Lint: `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m ruff check app/`
  - Migrations: `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m alembic current`

## Database Architecture
- PostgreSQL Cluster: Local port 5432 (`jabama_db`)
- Async Driver: `asyncpg` via SQLAlchemy 2.0
- Migrations: Managed through Alembic under `migrations/`
- Connection Pooling: Configured with `AsyncAdaptedQueuePool`

## Multi-Host & Authorization Rules
- Accommodations feature `host_id` foreign key referencing `users.id`.
- Modifying or deleting accommodations is authorized for `role == "admin"` or `host_id == current_user.id`.
