#!/usr/bin/env node
/**
 * Seed script: fetch real accommodation listings from Jabama and write
 * validated payloads for `app/seeds/seed_data.py --jabama`.
 *
 * Endpoints learned from the jagir-mcp adapter (thejimbow/jagir-mcp,
 * HEAD a597af793e8b75bf7b7ee44c9c91744da75012dd, `src/platforms/jabama.ts`):
 *   - GET  /api/taraaz/v1/area/cities/search?q=<name>&page=1
 *          -> { success, result: { items: [{ nameFa, nameEn, provinceNameFa }] } }
 *          City id for search is `city-<nameEn>`.
 *   - POST /api/taraaz/v3/search/merchandising/legacy-plp/<city-id>
 *          ?platform=desktop&allowEmptyCity=true&hasUnitRoom=true&guarantees=false
 *          body { 'page-size', 'page-number', sort, 'sort-direction' }
 *          -> { success, result: { total, items: [...] } }  (max page-size 36)
 *   - GET  /api/v1/accommodations/<code>?reversePeriods=true
 *          -> { success, result: { item, meta } }
 *
 * The adapter is only read to learn the endpoints. This script uses plain
 * `fetch` against gw.jabama.com and never imports the adapter at runtime.
 * It never touches the database; it only writes JSON files.
 *
 * Usage: node scripts/seed_from_jabama.mjs --dry-run
 * Output: scripts/jabama-listings.json (validated AccommodationCreate-ready
 *         payloads) + scripts/jabama-seed-manifest.json (Jabama stay IDs).
 *
 * Exit 0 only when the volume criteria hold: >= 100 listings total,
 * >= 10 per city, every category present in >= 2 cities. Otherwise exit 1.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://gw.jabama.com';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const REQUEST_DELAY_MS = 500;
const TIMEOUT_MS = 30_000;
const PAGE_SIZE = 36;
const MAX_PAGES_PER_CITY = 4;
const TARGET_PER_CITY = 20;
const MAX_IMAGES_PER_LISTING = 10;

const CITIES = ['رامسر', 'چالوس', 'رشت', 'تهران', 'کیش', 'اصفهان'];
const CATEGORY_SLUGS = [
  'wooden-cottage',
  'pool-villa',
  'ecolodge',
  'furnished-apartment',
  'mountain-mansion',
];

// ---------------------------------------------------------------------------
// Small helpers (mirrors jagir-mcp core/util.js)
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const pos = (v) => {
  const n = num(v);
  return n !== null && n > 0 ? n : null;
};
const str = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const rialToToman = (v) => {
  const n = num(v);
  return n === null ? null : Math.round(n / 10);
};

class HttpError extends Error {
  constructor(message, status, url) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

let consecutiveFailures = 0;

async function httpJson(url, { method = 'GET', query = {}, body } = {}) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v != null) u.searchParams.set(k, String(v));
  }
  const headers = { 'User-Agent': USER_AGENT, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(u.toString(), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        // STOP on 429 per the plan; other HTTP errors are fatal too.
        throw new HttpError(`HTTP ${res.status} from ${u.host}`, res.status, u.toString());
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new HttpError(`Invalid JSON from ${u.host}`, res.status, u.toString());
      }
      consecutiveFailures = 0;
      return data;
    } catch (e) {
      if (e instanceof HttpError) throw e; // HTTP status errors: no retry.
      // Network error / timeout: one retry (the sandbox egress proxy is flaky).
      if (attempt === 1) {
        console.warn(`  [retry] network error (${e.message}), retrying once...`);
        await sleep(2000);
        continue;
      }
      consecutiveFailures += 1;
      if (consecutiveFailures > 5) {
        throw new Error(
          `Gateway unreachable: ${consecutiveFailures} consecutive network failures (${e.message}). STOP.`,
        );
      }
      throw new HttpError(`Network error contacting ${u.host}: ${e.message}`, null, u.toString());
    } finally {
      clearTimeout(timer);
    }
  }
}

function unwrap(env, what) {
  if (!env || env.success === false || env.result == null) {
    throw new Error(
      `Jabama returned an unsuccessful response for ${what}: ${str(env?.error?.message) ?? 'unknown error'}`,
    );
  }
  return env.result;
}

// ---------------------------------------------------------------------------
// Logging of fallbacks / skips (plan R3: never silently store a default)
// ---------------------------------------------------------------------------
const fallbacks = [];
const skipped = [];
function logFallback(stayId, field, reason) {
  fallbacks.push({ stayId, field, reason });
  console.warn(`  [fallback] stay ${stayId}: ${field} — ${reason}`);
}
function logSkip(stayId, reason) {
  skipped.push({ stayId, reason });
  console.warn(`  [skip] stay ${stayId}: ${reason}`);
}

// ---------------------------------------------------------------------------
// Jabama API wrappers
// ---------------------------------------------------------------------------
async function resolveCityId(cityFa) {
  const result = unwrap(
    await httpJson(`${API}/api/taraaz/v1/area/cities/search`, {
      query: { q: cityFa, page: 1 },
    }),
    `city search "${cityFa}"`,
  );
  const match = (result.items ?? []).find((c) => str(c?.nameFa) === cityFa);
  if (match && str(match.nameEn)) return `city-${match.nameEn}`;
  // Fallback: full-text search for a city/province PLP slug.
  const fts = await httpJson(`${API}/api/taraaz/v2/search/fts`, { query: { query: cityFa } });
  const items = fts?.result?.items ?? fts?.items ?? [];
  const plp = items.find(
    (i) => i?.type === 'plp' && typeof i?.url === 'string' && /^city-/.test(i.url),
  );
  if (plp) return plp.url;
  throw new Error(`City "${cityFa}" not found on Jabama`);
}

async function searchCity(cityId, pageNumber) {
  const result = unwrap(
    await httpJson(`${API}/api/taraaz/v3/search/merchandising/legacy-plp/${cityId}`, {
      method: 'POST',
      query: {
        platform: 'desktop',
        allowEmptyCity: 'true',
        hasUnitRoom: 'true',
        guarantees: 'false',
      },
      body: {
        'page-size': PAGE_SIZE,
        'page-number': pageNumber,
        sort: 'booking_probability',
        'sort-direction': 'true',
      },
    }),
    `search ${cityId} page ${pageNumber}`,
  );
  return { total: num(result.total) ?? 0, items: result.items ?? [] };
}

async function getStay(code) {
  const result = unwrap(
    await httpJson(`${API}/api/v1/accommodations/${encodeURIComponent(String(code))}`, {
      query: { reversePeriods: 'true' },
    }),
    `get_stay ${code}`,
  );
  if (!result.item) throw new Error(`Listing ${code} not found`);
  return result.item;
}

// ---------------------------------------------------------------------------
// Mapping (plan Steps 1.3–1.5)
// ---------------------------------------------------------------------------
const AMENITY_KEYWORDS = [
  [/استخر/, 'pool'],
  [/جکوزی/, 'hot-tub'],
  [/وای‌فای|اینترنت/, 'wifi'],
  [/باربیکیو/, 'bbq'],
  [/چشم‌انداز|کوه|جنگل|منظره/, 'mountain'],
  [/سیستم صوتی|صوتی/, 'speaker'],
  [/پارکینگ/, 'parking'],
  [/بیلیارد|فوتبال‌دستی/, 'gamepad'],
];

function mapAmenities(titles, stayId) {
  const slugs = [];
  const unmatched = [];
  for (const title of titles) {
    const hit = AMENITY_KEYWORDS.find(([re]) => re.test(title));
    if (hit && !slugs.includes(hit[1])) slugs.push(hit[1]);
    else if (!hit) unmatched.push(title);
  }
  for (const t of unmatched) logFallback(stayId, 'amenity', `unmatched tag "${t}" — skipped`);
  return slugs;
}

function categorize(text) {
  // "بوم گردی" is written with a space, a ZWNJ, or nothing, and Jabama's
  // stay type for ecolodges is "ecotourism" (not "ecolodge").
  if (/بوم.?گردی|ecotourism|ecolodge/i.test(text)) return 'ecolodge';
  if (/کلبه|cottage/i.test(text)) return 'wooden-cottage';
  // "traditional" (اقامتگاه سنتی / خانه تاریخی) has no closer bucket among
  // the 5 seeded categories: these are large old houses, i.e. mansions
  // (عمارت) — mapped to mountain-mansion, the closest fit.
  if (/عمارت|mansion|کوهستانی|traditional/i.test(text)) return 'mountain-mansion';
  if (/ویلا|villa/i.test(text)) return 'pool-villa';
  if (/آپارتمان|سوئیت|apartment|suite/i.test(text)) return 'furnished-apartment';
  return null;
}

function mapCategory(type, typeFa, title, stayId) {
  const slug = categorize(`${type ?? ''} ${typeFa ?? ''} ${title ?? ''}`);
  if (slug) return slug;
  logFallback(stayId, 'category', `unmapped type "${type ?? ''}" / title "${title ?? ''}" — fallback furnished-apartment`);
  return 'furnished-apartment';
}

function mapCancellation(item, stayId) {
  const policy = item.cancellationPolicyDetails ?? item.cancellationPolicy ?? {};
  const title = str(policy.title);
  if (title) {
    if (/انعطاف/.test(title)) return 'flexible';
    if (/متعادل/.test(title)) return 'moderate';
    if (/سخت/.test(title)) return 'strict';
  }
  const days = num(policy.beforeCheckIn?.days);
  if (days !== null) {
    if (days >= 7) return 'flexible';
    if (days >= 3) return 'moderate';
    return 'strict';
  }
  logFallback(stayId, 'cancellation_policy', 'no structured policy — fallback flexible');
  return 'flexible';
}

function parseCheckTime(value, fallback, stayId, field) {
  const m = /^(\d{1,2}):(\d{2})/.exec(str(value) ?? '');
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }
  logFallback(stayId, field, `unparsable "${value}" — fallback ${fallback}`);
  return fallback;
}

function mapStay(item, searchItem) {
  const code = num(item?.code);
  const title = str(item?.title);
  if (code === null || !title) return null; // logged by caller
  const stayId = code;

  const place = item.placeOfResidence ?? {};
  const cityObj = place.city ?? place.area?.city;
  const cityFa = str(cityObj?.name?.fa);
  if (!cityFa || !CITIES.includes(cityFa)) {
    logSkip(stayId, `city "${cityFa ?? 'unknown'}" is not one of the 6 target cities`);
    return null;
  }
  // Province lives inside the city object: place.area.city.province.name.fa
  // (place.city, when present, has the same shape).
  const provinceFa =
    str(cityObj?.province?.name?.fa) ??
    str(place.area?.province?.name?.fa) ??
    str(place.province?.name?.fa) ??
    '';

  // Price: detail base price (Rial) -> Toman; fall back to the search price.
  let basePrice = rialToToman(pos(item.price?.base));
  if (basePrice === null) {
    basePrice = rialToToman(pos(searchItem?.price?.perNight));
    if (basePrice !== null) logFallback(stayId, 'base_price', 'detail price.base missing — used search perNight');
  }
  if (basePrice === null || basePrice < 0) {
    logSkip(stayId, 'no usable price');
    return null;
  }
  const extraGuestFee = rialToToman(pos(item.price?.extraPeople?.base)) ?? 0;
  if (item.price?.extraPeople?.base == null) {
    logFallback(stayId, 'extra_guest_fee', 'no extraPeople price — fallback 0');
  }

  // Capacity.
  const guests = item.capacity?.guests ?? {};
  let capacity = num(guests.base);
  if (capacity === null || capacity < 1) {
    logFallback(stayId, 'capacity', `guests.base=${guests.base ?? 'missing'} — fallback 2`);
    capacity = 2;
  }
  let maxCapacity = num(guests.base) !== null ? num(guests.base) + (num(guests.extra) ?? 0) : null;
  if (maxCapacity === null || maxCapacity < 1) {
    logFallback(stayId, 'max_capacity', 'guests.base/extra missing — fallback 4');
    maxCapacity = 4;
  }
  if (maxCapacity < capacity) maxCapacity = capacity;

  // Rooms / beds.
  const metrics = item.accommodationMetrics ?? {};
  const roomsCount = num(metrics.bedroomsCount) ?? 1;
  if (metrics.bedroomsCount == null) logFallback(stayId, 'rooms_count', 'bedroomsCount missing — fallback 1');
  const beds = item.capacity?.beds ?? {};
  const bedsCount =
    (pos(beds.double) ?? 0) + (pos(beds.single) ?? 0) + (pos(beds.twin) ?? 0) + (pos(beds.mattress) ?? 0);
  const bedsFinal = bedsCount > 0 ? bedsCount : 1;
  if (bedsCount === 0) logFallback(stayId, 'beds_count', 'no beds listed — fallback 1');

  // Location.
  const loc = place.location ?? {};
  const latitude = num(loc.lat);
  const longitude = num(loc.lng);
  if (latitude === null || longitude === null) {
    logFallback(stayId, 'latitude/longitude', 'no coordinates — stored as null');
  }

  // Nights / times.
  let minNights = num(item.minNight);
  if (minNights === null || minNights < 1) {
    logFallback(stayId, 'min_nights', `minNight=${item.minNight ?? 'missing'} — fallback 1`);
    minNights = 1;
  }
  const checkInTime = parseCheckTime(item.checkIn, '14:00', stayId, 'check_in_time');
  const checkOutTime = parseCheckTime(item.checkOut, '12:00', stayId, 'check_out_time');

  // Description / rules / address.
  let description = str(item.description);
  if (!description) {
    const extra = (item.extraDescription ?? [])
      .map((d) => str(d?.text))
      .filter(Boolean)
      .join('\n');
    description = extra || null;
    logFallback(stayId, 'description', 'description empty — used extraDescription text');
  }
  const rules = (item.rules ?? [])
    .map((r) => (r?.texts ?? []).map((t) => t?.text ?? '').join('').trim())
    .filter(Boolean)
    .join(' ');
  if (!rules) logFallback(stayId, 'rules', 'no rules — stored as null');

  const address = provinceFa ? `${provinceFa}، ${cityFa}، ${title}` : `${cityFa}، ${title}`;

  // Title / address length guards (AccommodationCreate: title <= 150, address <= 255).
  let finalTitle = title;
  if (finalTitle.length > 150) {
    logFallback(stayId, 'title', `title ${finalTitle.length} chars — truncated to 150`);
    finalTitle = `${finalTitle.slice(0, 147)}…`;
  }
  let finalAddress = address;
  if (finalAddress.length > 255) {
    logFallback(stayId, 'address', `address ${finalAddress.length} chars — truncated to 255`);
    finalAddress = finalAddress.slice(0, 255);
  }

  // Images: all photos, first = cover, cap 10, sort_order from 0.
  const images = (item.placeImages ?? [])
    .map((i) => str(i?.url))
    .filter((u) => u && /^https?:\/\//.test(u) && u.length <= 255)
    .slice(0, MAX_IMAGES_PER_LISTING)
    .map((url, i) => ({ image_url: url, is_cover: i === 0, sort_order: i }));
  if (images.length === 0) {
    logSkip(stayId, 'no usable photos');
    return null;
  }

  // Amenities + category.
  const amenityTitles = (item.amenitiesV2 ?? [])
    .filter((a) => a?.state !== false)
    .map((a) => str(a?.title?.fa) ?? str(a?.title?.en))
    .filter(Boolean);
  const amenitySlugs = mapAmenities(amenityTitles, stayId);
  const typeFa = str(item.typeDetails?.title_fa);
  const categorySlug = mapCategory(str(item.type), typeFa, title, stayId);

  return {
    jabama_id: code,
    jabama_url: `https://www.jabama.com/stay/${str(item.type) ?? 'villa'}-${code}`,
    title: finalTitle,
    description,
    city: cityFa,
    province: provinceFa,
    address: finalAddress,
    latitude,
    longitude,
    base_price: basePrice,
    cleaning_fee: 0,
    extra_guest_fee: extraGuestFee,
    capacity,
    max_capacity: maxCapacity,
    rooms_count: roomsCount,
    beds_count: bedsFinal,
    min_nights: minNights,
    check_in_time: checkInTime,
    check_out_time: checkOutTime,
    rules: rules || null,
    cancellation_policy: mapCancellation(item, stayId),
    category_slug: categorySlug,
    amenity_slugs: amenitySlugs,
    images,
    is_active: true,
  };
}

// ---------------------------------------------------------------------------
// Validation (mirrors app/schemas/accommodation.py AccommodationCreate)
// ---------------------------------------------------------------------------
function validatePayload(p) {
  const errors = [];
  if (!p.title || p.title.length < 3 || p.title.length > 150) errors.push('title length');
  if (!p.address || p.address.length < 5 || p.address.length > 255) errors.push('address length');
  if (!(p.base_price >= 0)) errors.push('base_price < 0');
  if (!(p.cleaning_fee >= 0)) errors.push('cleaning_fee < 0');
  if (!(p.extra_guest_fee >= 0)) errors.push('extra_guest_fee < 0');
  if (!(p.capacity >= 1)) errors.push('capacity < 1');
  if (!(p.max_capacity >= 1) || p.max_capacity < p.capacity) errors.push('max_capacity < capacity');
  if (!(p.rooms_count >= 0)) errors.push('rooms_count < 0');
  if (!(p.beds_count >= 0)) errors.push('beds_count < 0');
  if (!(p.min_nights >= 1)) errors.push('min_nights < 1');
  if (!/^(flexible|moderate|strict)$/.test(p.cancellation_policy)) errors.push('cancellation_policy');
  if (!CATEGORY_SLUGS.includes(p.category_slug)) errors.push('category_slug');
  if (!CITIES.includes(p.city)) errors.push('city');
  if (!Array.isArray(p.images) || p.images.length === 0) errors.push('no images');
  if (p.images.some((i) => !i.image_url || i.image_url.length > 255)) errors.push('image_url');
  if (p.latitude !== null && (p.latitude < -90 || p.latitude > 90)) errors.push('latitude');
  if (p.longitude !== null && (p.longitude < -180 || p.longitude > 180)) errors.push('longitude');
  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  if (!dryRun && args.length > 0) {
    console.error(`Unknown args: ${args.join(' ')} (expected --dry-run)`);
    process.exit(2);
  }
  console.log(`Fetching real listings from Jabama (gw.jabama.com) — dry-run: ${dryRun}`);
  console.log(`Cities: ${CITIES.join('، ')} | target ${TARGET_PER_CITY}/city, max ${MAX_PAGES_PER_CITY} search pages/city`);

  const seenCodes = new Set();
  const payloads = [];
  const perCity = Object.fromEntries(CITIES.map((c) => [c, 0]));
  // Incremental per-category city coverage (drives the rare-category scan).
  const categoryCities = Object.fromEntries(CATEGORY_SLUGS.map((s) => [s, new Set()]));

  for (const cityFa of CITIES) {
    console.log(`\n== ${cityFa} ==`);
    const cityId = await resolveCityId(cityFa);
    console.log(`  city id: ${cityId}`);
    await sleep(REQUEST_DELAY_MS);
    let accepted = 0;
    // A category still needs this city when it is present in < 2 cities
    // and this city has not contributed it yet.
    const cityCanStillHelp = () =>
      CATEGORY_SLUGS.some(
        (slug) => categoryCities[slug].size < 2 && !categoryCities[slug].has(cityFa),
      );
    for (let page = 1; page <= MAX_PAGES_PER_CITY; page++) {
      // Stop paging early only when the target is met AND no category
      // still needs this city. Otherwise keep scanning later pages: rare
      // categories (ecolodge, mountain-mansion) sit deep in the
      // relevance-sorted results, and stopping at the end of page 1 would
      // never reach them.
      if (accepted >= TARGET_PER_CITY && !cityCanStillHelp()) break;
      const { total, items } = await searchCity(cityId, page);
      console.log(`  search page ${page}: total ${total}, ${items.length} items`);
      for (const searchItem of items) {
        const code = num(searchItem?.code);
        if (code === null || seenCodes.has(code)) continue;
        // Past the per-city target, fetch details ONLY for stays whose
        // (provisional) category still needs this city; skip the rest
        // without a detail call and keep scanning.
        if (accepted >= TARGET_PER_CITY) {
          const provisional =
            categorize(`${str(searchItem.type) ?? ''} ${str(searchItem.name) ?? ''}`) ??
            'furnished-apartment';
          const cities = categoryCities[provisional];
          if (cities.size >= 2 || cities.has(cityFa)) continue;
          console.log(`  [rare-scan] stay ${code} provisional category ${provisional} still needs ${cityFa}`);
        }
        seenCodes.add(code);
        await sleep(REQUEST_DELAY_MS);
        let detail;
        try {
          detail = await getStay(code);
        } catch (e) {
          logSkip(code, `get_stay failed: ${e.message}`);
          continue;
        }
        const payload = mapStay(detail, searchItem);
        if (!payload) continue;
        const errors = validatePayload(payload);
        if (errors.length > 0) {
          logSkip(code, `validation failed: ${errors.join(', ')}`);
          continue;
        }
        payloads.push(payload);
        perCity[payload.city] += 1;
        categoryCities[payload.category_slug].add(payload.city);
        accepted += 1;
      }
      if (items.length < PAGE_SIZE) break; // no more pages
      await sleep(REQUEST_DELAY_MS);
    }
    console.log(`  accepted for ${cityFa}: ${accepted}`);
  }

  // Per-category x city coverage (built incrementally above).

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outPath = join(scriptDir, 'jabama-listings.json');
  const manifestPath = join(scriptDir, 'jabama-seed-manifest.json');
  await mkdir(scriptDir, { recursive: true });
  await writeFile(outPath, `${JSON.stringify(payloads, null, 2)}\n`, 'utf8');
  const manifest = {
    generated_at: new Date().toISOString(),
    source: 'gw.jabama.com via jagir-mcp adapter endpoints (thejimbow/jagir-mcp a597af7)',
    total: payloads.length,
    per_city: perCity,
    per_category: Object.fromEntries(
      Object.entries(categoryCities).map(([slug, cities]) => [slug, [...cities].sort()]),
    ),
    stays: payloads.map((p) => ({
      jabama_id: p.jabama_id,
      title: p.title,
      city: p.city,
      category_slug: p.category_slug,
      accommodation_id: null,
    })),
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log('\n== Summary ==');
  console.log(`Total listings: ${payloads.length}`);
  console.log(`Per city: ${JSON.stringify(perCity)}`);
  console.log(
    `Per category: ${JSON.stringify(Object.fromEntries(Object.entries(categoryCities).map(([s, c]) => [s, [...c]])))}`,
  );
  console.log(`Fallbacks logged: ${fallbacks.length} | stays skipped: ${skipped.length}`);
  console.log(`Wrote ${outPath}`);
  console.log(`Wrote ${manifestPath}`);

  const problems = [];
  if (payloads.length < 100) problems.push(`total ${payloads.length} < 100`);
  for (const c of CITIES) {
    if (perCity[c] < 10) problems.push(`${c}: ${perCity[c]} < 10`);
  }
  for (const slug of CATEGORY_SLUGS) {
    const cities = categoryCities[slug] ?? new Set();
    if (cities.size < 2) problems.push(`category ${slug} in only ${cities.size} cit(ies)`);
  }
  if (problems.length > 0) {
    console.error(`\nVOLUME CRITERIA NOT MET: ${problems.join('; ')}`);
    process.exit(1);
  }
  console.log('\nVolume criteria met: >= 100 total, >= 10/city, every category in >= 2 cities.');
}

main().catch((e) => {
  console.error(`\nFATAL: ${e.message}`);
  if (e.status === 429) console.error('STOP: HTTP 429 rate limit from Jabama.');
  process.exit(1);
});
