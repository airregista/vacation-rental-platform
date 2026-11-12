-- Preflight for migration 94d16e6e59ff ("add integrity constraints and index
-- hygiene").
--
-- Run this against the target database BEFORE `alembic upgrade head`:
--
--   psql -d <database> -v ON_ERROR_STOP=1 \
--     -f scripts/preflight_integrity_constraints.sql
--
-- Every row in the summary is a data violation that makes the migration fail.
-- Repair the rows (or have the data owner decide) and re-run until the script
-- prints "Integrity preflight passed." The script is read-only: it creates only
-- a session-local temporary view.
--
-- Do not delete or weaken a constraint to make production pass. The dev-only
-- cleanup in plan 053, Step 1 is not part of the migration and must not be
-- copied to production unchanged.

CREATE TEMP VIEW integrity_preflight AS
SELECT 'confirmed reservation overlaps' AS check_name, count(*) AS violations
FROM (
    SELECT 1
    FROM reservations r1
    JOIN reservations r2
      ON r1.accommodation_id = r2.accommodation_id
     AND r1.id < r2.id
     AND r1.status = 'confirmed'
     AND r2.status = 'confirmed'
     AND r1.check_in < r2.check_out
     AND r1.check_out > r2.check_in
) overlap_pairs
UNION ALL
SELECT 'reservation total_nights mismatch', count(*)
FROM reservations
WHERE total_nights <> (check_out - check_in)
UNION ALL
SELECT 'reservation refund_amount negative', count(*)
FROM reservations
WHERE refund_amount < 0
UNION ALL
SELECT 'reservation penalty_amount negative', count(*)
FROM reservations
WHERE penalty_amount < 0
UNION ALL
SELECT 'reservation refund + penalty > total_price', count(*)
FROM reservations
WHERE coalesce(refund_amount, 0) + coalesce(penalty_amount, 0) > total_price
UNION ALL
SELECT 'host payout arithmetic mismatch', count(*)
FROM host_payouts
WHERE total_booking_amount <> commission_amount + payout_amount
UNION ALL
SELECT 'user role not in allow-list', count(*)
FROM users
WHERE role IS NOT NULL AND role NOT IN ('guest', 'host', 'admin')
UNION ALL
SELECT 'user phone format invalid', count(*)
FROM users
WHERE phone !~ '^09[0-9]{9}$'
UNION ALL
SELECT 'user shaba format invalid', count(*)
FROM users
WHERE shaba_number IS NOT NULL AND shaba_number !~ '^IR[0-9]{24}$'
UNION ALL
SELECT 'user email not lowercase', count(*)
FROM users
WHERE email IS NOT NULL AND email <> lower(email)
UNION ALL
SELECT 'otp code format invalid', count(*)
FROM otp_codes
WHERE code !~ '^[0-9]{4,6}$'
UNION ALL
SELECT 'otp expires_at not after created_at', count(*)
FROM otp_codes
WHERE expires_at <= created_at
UNION ALL
SELECT 'coupon validity range invalid', count(*)
FROM coupons
WHERE valid_until <= valid_from
UNION ALL
SELECT 'coupon used_count negative', count(*)
FROM coupons
WHERE used_count < 0
UNION ALL
SELECT 'coupon usage_limit not positive', count(*)
FROM coupons
WHERE usage_limit IS NOT NULL AND usage_limit <= 0
UNION ALL
SELECT 'coupon percentage above 100', count(*)
FROM coupons
WHERE discount_type = 'percentage' AND discount_value > 100
UNION ALL
SELECT 'coupon max_discount_amount negative', count(*)
FROM coupons
WHERE max_discount_amount IS NOT NULL AND max_discount_amount < 0
UNION ALL
SELECT 'accommodation latitude out of range', count(*)
FROM accommodations
WHERE latitude IS NOT NULL AND (latitude < -90 OR latitude > 90)
UNION ALL
SELECT 'accommodation longitude out of range', count(*)
FROM accommodations
WHERE longitude IS NOT NULL AND (longitude < -180 OR longitude > 180)
UNION ALL
SELECT 'accommodation rooms_count negative', count(*)
FROM accommodations
WHERE rooms_count < 0
UNION ALL
SELECT 'accommodation beds_count negative', count(*)
FROM accommodations
WHERE beds_count < 0
UNION ALL
SELECT 'btree_gist extension unavailable or not installable', CASE
    WHEN NOT EXISTS (
        SELECT 1 FROM pg_available_extensions WHERE name = 'btree_gist'
    ) THEN 1
    WHEN NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist')
         AND NOT has_database_privilege(
             current_user, current_database(), 'CREATE'
         ) THEN 1
    ELSE 0
END;

SELECT check_name, violations
FROM integrity_preflight
WHERE violations > 0
ORDER BY check_name;

DO $$
DECLARE
    failing text;
BEGIN
    SELECT string_agg(check_name || '=' || violations, ', ' ORDER BY check_name)
      INTO failing
      FROM integrity_preflight
     WHERE violations > 0;

    IF failing IS NOT NULL THEN
        RAISE EXCEPTION 'Integrity preflight failed: %', failing;
    END IF;

    RAISE NOTICE 'Integrity preflight passed: no rows violate the 053 constraints.';
END
$$;
