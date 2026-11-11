# Deployment Checklist

This is the short, practical checklist for running the API on a real server.
Local setup is documented in [README.md](README.md); this file only covers the
things that change when the app leaves your machine.

> **Golden rule:** secrets and environment-specific values belong in the hosting
> platform's secret manager / environment panel, never in the repository.

## 1. What you need

- Python 3.12+
- PostgreSQL 14+ (a real database, not the local demo one)
- A reverse proxy with TLS (nginx, Caddy, or the platform's load balancer)
- A release from `main`, or a tagged commit

## 2. Environment variables

Set these in the deployment environment (or the platform's secret store). Do
not copy the local `.env` to the server.

| Variable | Production value | Notes |
|---|---|---|
| `ENVIRONMENT` | `production` (or `staging`) | Required. Demo values (`development`, `dev`, `local`, `test`, `testing`) enable demo behavior. |
| `SECRET_KEY` | A new random value, at least 32 characters | Required. Generate it once, store it only in the secret manager. Rotating it invalidates every existing JWT and calendar feed link. |
| `DATABASE_URL` | `postgresql+asyncpg://ashianak_app:PASSWORD@HOST:5432/ashianak?ssl=require` | Required. Use the least-privilege app role and TLS for remote hosts (see §3). URL-encode special characters in the password. |
| `DB_POOL_SIZE` | `5` (default) | Per-process pool size. Keep `workers × (DB_POOL_SIZE + DB_MAX_OVERFLOW)` below `max_connections` minus headroom. |
| `DB_MAX_OVERFLOW` | `5` (default) | Extra connections allowed above `DB_POOL_SIZE` per process. |
| `DB_POOL_TIMEOUT` | `30` (default) | Seconds to wait for a pooled connection before failing. |
| `DB_POOL_RECYCLE` | `1800` (default) | Seconds before a pooled connection is recycled. Lower it below any firewall/pooler idle timeout. |
| `ALLOWED_ORIGINS` | JSON list of exact frontend origins | Example: `["https://app.example.com","https://www.example.com"]`. No wildcard; CORS allows credentials. |
| `ENABLE_STARTUP_SEED` | `False` | Keep demo seeding off. The seed itself also refuses to create demo accounts outside the demo environments. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | e.g. `1440` | Shorten it if the product can tolerate more frequent logins. |
| `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` | `10` (default) | Failed password attempts allowed per window. |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | `300` (default) | Rolling window for the login limiter. |

Generate the key without committing it:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Store the output in the host's secret manager. Do not put it in `.env.example`,
README, CI logs, or a chat message. If it ever leaks, generate a new one and
restart the API; all users will be logged out.

`SEED_ADMIN_PASSWORD` and `SEED_GUEST_PASSWORD` are **not** production
variables. The demo seed is refused outside the demo environments, and the test
suite expects the documented development passwords.

## 3. Database

Production uses two non-superuser roles:

| Role | Used by | Rights |
|---|---|---|
| `ashianak_owner` | `alembic upgrade head` only | Owns the database and schema; can create/alter tables. No `SUPERUSER`, `CREATEDB`, or `CREATEROLE`. |
| `ashianak_app` | the API process | `CONNECT`, `USAGE` on `public`, and `SELECT/INSERT/UPDATE/DELETE` on tables plus `USAGE/SELECT` on sequences. Cannot run DDL. |

1. On the database host, enable TLS and SCRAM authentication:

   ```conf
   # postgresql.conf
   ssl = on
   ssl_cert_file = '/etc/postgresql/tls/server.crt'
   ssl_key_file  = '/etc/postgresql/tls/server.key'
   password_encryption = scram-sha-256
   ```

   ```conf
   # pg_hba.conf — reject anything that is not TLS + SCRAM
   local     all  all                      peer
   hostssl   all  all  0.0.0.0/0           scram-sha-256
   hostssl   all  all  ::/0                scram-sha-256
   hostnossl all  all  0.0.0.0/0           reject
   hostnossl all  all  ::/0                reject
   ```

2. Run the provisioning script once as a superuser:

   ```bash
   psql -h DB_HOST -U postgres -d postgres \
        -v owner_password='...' -v app_password='...' \
        -f scripts/provision_production_db.sql
   ```

3. Run the migrations as the owner role:

   ```bash
   DATABASE_URL='postgresql+asyncpg://ashianak_owner:...@DB_HOST:5432/ashianak?ssl=require' \
     alembic upgrade head
   ```

4. Run the API as the app role:

   ```dotenv
   DATABASE_URL=postgresql+asyncpg://ashianak_app:...@DB_HOST:5432/ashianak?ssl=require
   ```

   The app refuses to start outside the demo environments when the URL uses
   `postgres`/`root`, omits the password, or omits TLS for a remote host.

5. Take a backup before every migration and verify restore procedures.
   Do **not** run `python -m app.seeds.seed_data` in production.

### Connection pool sizing

Each API process opens at most `DB_POOL_SIZE + DB_MAX_OVERFLOW` connections
(idle connections are kept up to `DB_POOL_SIZE`). Keep:

```text
workers × (DB_POOL_SIZE + DB_MAX_OVERFLOW)
  ≤ max_connections − superuser_reserved_connections − migration headroom
```

With PostgreSQL's default `max_connections = 100`, reserve ~10 connections for
migrations and operators, and the defaults `5 + 5`, a safe starting point is
8 API processes. Raise the server limit before raising the pool. `DB_POOL_RECYCLE`
(default 1800 seconds) drops connections older than 30 minutes; lower it if a
firewall or pooler closes idle connections sooner.

## 4. Install and start

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install .
```

For a test/staging host that needs the test tools:

```bash
pip install -e ".[dev]"
```

Start one process behind the reverse proxy:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Do not use `--reload` in production. Terminate TLS at the proxy and forward
requests to this local port.

## 5. Workers and the login rate limiter

The login limiter (`app/core/rate_limit.py`) stores failed attempts in the
process's memory. That means:

- **One worker:** the limit is global for that process and works as documented.
- **Several workers or replicas:** each process has its own counter, so the
  effective limit is multiplied, and a restart clears all counters.

Before scaling horizontally, move the limiter state to a shared store such as
Redis or PostgreSQL. Until then, run a single worker if the login throttle must
be accurate. This is a scaling decision, not a local-development blocker.

## 6. CORS and the frontend

- Set `ALLOWED_ORIGINS` to the exact scheme + host + port of each frontend.
  `http://localhost:3000` is local-only and must not remain in production.
- The API enables credentialed CORS, so a wildcard origin is not acceptable.
- Serve the API over HTTPS. This is required today for safe Bearer tokens and
  will be required for the HttpOnly-cookie migration described in
  `plans/049-session-storage-decision.md` (if that work is approved later).

## 7. Post-deploy smoke test

Run these against the deployed host:

```bash
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/
```

Expected: `{"status":"ok","database":"connected"}` and the root health payload.
The `/health` response is a liveness response; also exercise the database by
logging in and calling an authenticated endpoint.

Then check:

1. `POST /api/v1/auth/register` creates a user.
2. `POST /api/v1/auth/login` returns a token.
3. `GET /api/v1/auth/me` with `Authorization: Bearer <token>` returns that user.
4. An unauthenticated protected request returns `401`.
5. A few failed logins eventually return `429` with a `Retry-After` header.
6. `/docs` loads (or is intentionally disabled by the proxy).
7. Logs show no startup validation errors and no stack traces.

Run the test suite only against a dedicated test database, never production:

```bash
pytest -q
```

## 8. Final checklist

- [ ] `ENVIRONMENT` is set to a non-demo value.
- [ ] `SECRET_KEY` is new, at least 32 characters, and stored outside git.
- [ ] The database password is strong and is not the empty local default.
- [ ] `ALLOWED_ORIGINS` contains only the real frontend origins.
- [ ] TLS is enabled and HTTP redirects to HTTPS.
- [ ] `alembic upgrade head` completed successfully.
- [ ] Demo seeding was not run in production.
- [ ] One worker is running, or the rate limiter has a shared store.
- [ ] Database backups and log/monitoring alerts are configured.
- [ ] `.env` is not tracked by git and is not readable by other users.
- [ ] The post-deploy smoke test passed.

## 9. Rollback

- Keep the previous release available so the app can be restarted on it.
- Schema rollbacks are not automatic: use Alembic downgrades only when the
  migration is reversible, otherwise restore the pre-deploy backup.
- Rotating `SECRET_KEY` is a valid emergency action: it logs everyone out and
  invalidates old tokens, but it does not repair a compromised database.
