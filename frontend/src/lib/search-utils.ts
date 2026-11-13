import type { AccommodationSearchParams } from "@/types/accommodation"

export function buildAccommodationQuery(params: AccommodationSearchParams): string {
  const query = new URLSearchParams()

  if (params.city_id !== undefined) query.set("city_id", String(params.city_id))
  if (params.province_id !== undefined) query.set("province_id", String(params.province_id))
  if (params.category_id !== undefined) query.set("category_id", String(params.category_id))
  if (params.guests_count !== undefined && params.guests_count > 0)
    query.set("guests_count", String(params.guests_count))
  if (params.min_rooms !== undefined && params.min_rooms > 0)
    query.set("min_rooms", String(params.min_rooms))
  if (params.min_beds !== undefined && params.min_beds > 0)
    query.set("min_beds", String(params.min_beds))
  if (params.min_price !== undefined && params.min_price > 0)
    query.set("min_price", String(params.min_price))
  if (params.max_price !== undefined) query.set("max_price", String(params.max_price))

  // Date invariant: Both check_in and check_out must be supplied together
  if (params.check_in && params.check_out) {
    query.set("check_in", params.check_in)
    query.set("check_out", params.check_out)
  }

  if (params.sort_by) query.set("sort_by", params.sort_by)
  if (params.skip !== undefined) query.set("skip", String(params.skip))
  if (params.limit !== undefined) query.set("limit", String(params.limit))

  // FastAPI expects repeated keys for list params: ?amenity_ids=1&amenity_ids=2
  if (params.amenity_ids && params.amenity_ids.length > 0) {
    params.amenity_ids.forEach((id) => query.append("amenity_ids", String(id)))
  }

  const qs = query.toString()
  return qs ? `?${qs}` : ""
}

export interface SearchParamsGetter {
  get(name: string): string | null
  getAll(name: string): string[]
}

// Strict parsers: the backend rejects invalid values with 422, which the
// page surfaces as a generic error screen, so drop anything invalid here.

function parsePositiveInt(raw: string | null): number | undefined {
  if (raw === null || raw === "") return undefined
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return undefined
  return n
}

function parseNonNegativeNumber(raw: string | null): number | undefined {
  if (raw === null || raw === "") return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

function parseSkip(raw: string | null): number | undefined {
  if (raw === null || raw === "") return undefined
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return undefined
  return n
}

function parseLimit(raw: string | null): number | undefined {
  if (raw === null || raw === "") return undefined
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 100) return undefined
  return n
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export function parseAccommodationQuery(
  searchParams: SearchParamsGetter,
): AccommodationSearchParams {
  const params: AccommodationSearchParams = {}

  const cityId = parsePositiveInt(searchParams.get("city_id"))
  if (cityId !== undefined) params.city_id = cityId

  const provinceId = parsePositiveInt(searchParams.get("province_id"))
  if (provinceId !== undefined) params.province_id = provinceId

  const categoryId = parsePositiveInt(searchParams.get("category_id"))
  if (categoryId !== undefined) params.category_id = categoryId

  const guestsCount = parsePositiveInt(searchParams.get("guests_count"))
  if (guestsCount !== undefined) params.guests_count = guestsCount

  const minRooms = parsePositiveInt(searchParams.get("min_rooms"))
  if (minRooms !== undefined) params.min_rooms = minRooms

  const minBeds = parsePositiveInt(searchParams.get("min_beds"))
  if (minBeds !== undefined) params.min_beds = minBeds

  const minPrice = parseNonNegativeNumber(searchParams.get("min_price"))
  if (minPrice !== undefined) params.min_price = minPrice

  const maxPrice = parseNonNegativeNumber(searchParams.get("max_price"))
  if (maxPrice !== undefined) params.max_price = maxPrice

  const checkIn = searchParams.get("check_in")
  const checkOut = searchParams.get("check_out")
  if (checkIn && checkOut && isRealDate(checkIn) && isRealDate(checkOut) && checkOut > checkIn) {
    params.check_in = checkIn
    params.check_out = checkOut
  }

  const sortBy = searchParams.get("sort_by")
  if (sortBy === "newest" || sortBy === "price_asc" || sortBy === "price_desc") {
    params.sort_by = sortBy
  }

  const skip = parseSkip(searchParams.get("skip"))
  if (skip !== undefined) params.skip = skip

  const limit = parseLimit(searchParams.get("limit"))
  if (limit !== undefined) params.limit = limit

  const amenityIds = searchParams.getAll("amenity_ids")
  if (amenityIds.length > 0) {
    const parsed = amenityIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    if (parsed.length > 0) params.amenity_ids = parsed
  }

  return params
}
