import type { AccommodationSearchParams } from "@/types/accommodation"

export function buildAccommodationQuery(params: AccommodationSearchParams): string {
  const query = new URLSearchParams()

  if (params.city_id !== undefined) query.set("city_id", String(params.city_id))
  if (params.province_id !== undefined) query.set("province_id", String(params.province_id))
  if (params.category_id !== undefined) query.set("category_id", String(params.category_id))
  if (params.guests_count !== undefined && params.guests_count > 0) query.set("guests_count", String(params.guests_count))
  if (params.min_rooms !== undefined && params.min_rooms > 0) query.set("min_rooms", String(params.min_rooms))
  if (params.min_beds !== undefined && params.min_beds > 0) query.set("min_beds", String(params.min_beds))
  if (params.min_price !== undefined) query.set("min_price", String(params.min_price))
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
