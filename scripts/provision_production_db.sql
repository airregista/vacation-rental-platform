-- Provision a production database for Ashianak.
--
-- Run once as a PostgreSQL superuser, from a trusted host:
--   psql -h HOST -U postgres -d postgres \
--        -v owner_password='...' -v app_password='...' \
--        -f scripts/provision_production_db.sql
--
-- Then:
--   migrations: DATABASE_URL=postgresql+asyncpg://ashianak_owner:OWNER_PW@HOST:5432/ashianak?ssl=require
--   runtime:    DATABASE_URL=postgresql+asyncpg://ashianak_app:APP_PW@HOST:5432/ashianak?ssl=require
--
-- The owner role runs `alembic upgrade head`; the app role can only read and
-- write rows. Neither role is a superuser.

\set ON_ERROR_STOP on

CREATE ROLE ashianak_owner LOGIN PASSWORD :'owner_password';
CREATE ROLE ashianak_app LOGIN PASSWORD :'app_password';

CREATE DATABASE ashianak OWNER ashianak_owner;

REVOKE ALL ON DATABASE ashianak FROM PUBLIC;
GRANT CONNECT ON DATABASE ashianak TO ashianak_owner, ashianak_app;

\connect ashianak

ALTER SCHEMA public OWNER TO ashianak_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ashianak_app;
GRANT USAGE, CREATE ON SCHEMA public TO ashianak_owner;

-- Future migrations (run as ashianak_owner) create tables the app can use.
ALTER DEFAULT PRIVILEGES FOR ROLE ashianak_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ashianak_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ashianak_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO ashianak_app;

-- Also grant on any objects that already exist (no-op on a fresh database).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ashianak_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ashianak_app;
