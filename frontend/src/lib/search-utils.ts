import type { AccommodationSearchParams } from "@/types/accommodation"

export function buildAccommodationQuery(params: AccommodationSearchParams): string {
  const query = new URLSearchParams()

  if (params.city_id !== undefined) query.set("city_id", String(params.city_id))
  if (params.province_id !== undefined) query.set("province_id", String(params.province_id))
  if (params.category_id !== undefined) query.set("category_id", String(params.category_id))
  if (params.guests_count !== undefined && params.guests_count > 0) query.set("guests_count", String(params.guests_count))
  if (params.min_rooms !== undefined && params.min_rooms > 0) query.set("min_rooms", String(params.min_rooms))
  if (params.min_beds !== undefined && params.min_beds > 0) query.set("min_beds", String(params.min_beds))
  if (params.min_price !== undefined && params.min_price > 0) query.set("min_price", String(params.min_price))
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

export function parseAccommodationQuery(searchParams: SearchParamsGetter): AccommodationSearchParams {
  const params: AccommodationSearchParams = {}

  const cityId = searchParams.get("city_id")
  if (cityId && !isNaN(Number(cityId))) params.city_id = Number(cityId)

  const provinceId = searchParams.get("province_id")
  if (provinceId && !isNaN(Number(provinceId))) params.province_id = Number(provinceId)

  const categoryId = searchParams.get("category_id")
  if (categoryId && !isNaN(Number(categoryId))) params.category_id = Number(categoryId)

  const guestsCount = searchParams.get("guests_count")
  if (guestsCount && Number(guestsCount) > 0) params.guests_count = Number(guestsCount)

  const minRooms = searchParams.get("min_rooms")
  if (minRooms && Number(minRooms) > 0) params.min_rooms = Number(minRooms)

  const minBeds = searchParams.get("min_beds")
  if (minBeds && Number(minBeds) > 0) params.min_beds = Number(minBeds)

  const minPrice = searchParams.get("min_price")
  if (minPrice && Number(minPrice) > 0) params.min_price = Number(minPrice)

  const maxPrice = searchParams.get("max_price")
  if (maxPrice && !isNaN(Number(maxPrice))) params.max_price = Number(maxPrice)

  const checkIn = searchParams.get("check_in")
  const checkOut = searchParams.get("check_out")
  if (checkIn && checkOut && checkOut > checkIn) {
    params.check_in = checkIn
    params.check_out = checkOut
  }

  const sortBy = searchParams.get("sort_by")
  if (sortBy === "newest" || sortBy === "price_asc" || sortBy === "price_desc") {
    params.sort_by = sortBy
  }

  const amenityIds = searchParams.getAll("amenity_ids")
  if (amenityIds.length > 0) {
    const parsed = amenityIds.map(Number).filter((n) => !isNaN(n) && n > 0)
    if (parsed.length > 0) params.amenity_ids = parsed
  }

  return params
}
