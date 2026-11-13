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
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` (8 hours) | Bearer tokens are stored in `localStorage`; keep this short. Raise it only with an explicit product decision. |
| `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` | `10` (default) | Failed password or OTP attempts allowed per identifier per window. |
| `LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP` | `50` (default) | Failed attempts allowed per source IP per window, shared by login, OTP send, and OTP verify. Stops identifier rotation. |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | `300` (default) | Rolling window for the login limiter. |
| `REGISTER_RATE_LIMIT_MAX_ATTEMPTS_PER_IP` | `20` (default) | Registration attempts per source IP per window. |
| `CALENDAR_FEED_TTL_MINUTES` | `10080` (7 days) | Signed iCal feed link lifetime. Rotating the token invalidates old links. |
| `CALENDAR_MAX_BLOCK_DAYS` | `90` (default) | Maximum range for a bulk calendar block. |
| `RESERVATION_MAX_CHECKIN_MONTHS` | `18` (default) | Forward booking and iCal horizon (`18 × 30 = 540` days). |
| `RESERVATION_TTL_MINUTES` | `30` (default) | Pending-reservation payment window before automatic expiry. |
| `RESERVATION_SWEEP_INTERVAL_SECONDS` | `60` (default) | How often the in-process sweep expires stale pending rows. |
| `ENABLE_RESERVATION_SWEEP` | `True` (default) | Disable on extra API workers if only one dedicated process runs the sweep. |
| `PLATFORM_COMMISSION_RATE` | `0.10` (default) | Decimal fraction deducted from each confirmed booking. |
| `UPLOAD_DIR` | `uploads` (default) | Local directory for uploaded images. Must be writable by the API user and backed by persistent storage; do not point it inside the release directory if deploys replace it. |
| `MAX_UPLOAD_SIZE_MB` | `5` (default) | Per-image upload cap (`1`–`20`). Reverse proxies must allow at least this body size. |

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

3. Take a backup and verify restore procedures before every migration.

4. Run the integrity preflight from the release checkout. It is read-only and
   exits non-zero when existing rows would violate the constraints added by
   revision `94d16e6e59ff`:

   ```bash
   psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 \
     -f scripts/preflight_integrity_constraints.sql
   ```

   If it reports violations, repair the data with the data owner and re-run.
   Do not weaken or skip a constraint to make the migration pass. The dev-only
   cleanup in plan 053, Step 1 (hardcoded reservation IDs) must not be applied
   to production.

5. Run the migrations as the owner role:

   ```bash
   DATABASE_URL='postgresql+asyncpg://ashianak_owner:...@DB_HOST:5432/ashianak?ssl=require' \
     alembic upgrade head
   ```

6. Run the API as the app role:

   ```dotenv
   DATABASE_URL=postgresql+asyncpg://ashianak_app:...@DB_HOST:5432/ashianak?ssl=require
   ```

   The app refuses to start outside the demo environments when the URL uses
   `postgres`/`root`, omits the password, or omits TLS for a remote host.

7. Do **not** run `python -m app.seeds.seed_data` in production. It intentionally
   refuses to create the public demo accounts there, and production data should
   be created through migrations and real admin/user flows.

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

Behind a reverse proxy, start uvicorn with proxy headers enabled so the
limiter sees the real client IP instead of `127.0.0.1`:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 \
  --proxy-headers --forwarded-allow-ips=127.0.0.1
```

`--forwarded-allow-ips` must name only the proxy addresses. Trusting every
source lets a client spoof `X-Forwarded-For` and rotate the limiter key.

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
`/health` performs a real `SELECT 1`; it returns `503` with
`{"status":"unhealthy","database":"disconnected"}` when the database is
unreachable. A `200` therefore proves both the process and its database
connection are healthy.

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

## 9. Reverse proxy and edge limits

The in-process limiter is a per-identifier backstop. Add a coarse per-IP limit
at the edge so credential stuffing and OTP probing are slowed before they
reach Python. Example nginx configuration:

```nginx
# http { } context
limit_req_zone $binary_remote_addr zone=auth:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=api:10m  rate=30r/s;

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    client_max_body_size 2m;
    proxy_read_timeout   30s;

    # Throttle credential-entry endpoints only. /auth/me, /auth/become-host,
    # and /auth/register must not share this 60r/m bucket.
    location ~ ^/api/v1/auth/(login|otp/send|otp/verify)$ {
        limit_req zone=auth burst=10 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/v1/accommodations/ {
        # Calendar sync performs outbound fetches; keep its budget separate.
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`60r/m` with `burst=10` allows a normal login/OTP sequence but not a scripted
burst; tune it from real traffic. The regex matches only the three
credential-entry paths, so `/api/v1/auth/me` and `/api/v1/auth/become-host`
fall through to the unthrottled `location /`. The edge limit is not a
replacement for the per-identifier limiter, and it is not shared across nginx
instances either.

## 10. Rollback

- Keep the previous release available so the app can be restarted on it.
- Schema rollbacks are not automatic: use Alembic downgrades only when the
  migration is reversible, otherwise restore the pre-deploy backup.
- Rotating `SECRET_KEY` is a valid emergency action: it logs everyone out and
  invalidates old tokens, but it does not repair a compromised database.
