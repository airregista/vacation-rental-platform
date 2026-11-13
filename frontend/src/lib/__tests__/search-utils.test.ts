import { describe, expect, it } from "vitest"

import {
  buildAccommodationQuery,
  parseAccommodationQuery,
  type SearchParamsGetter,
} from "@/lib/search-utils"

/** Minimal URLSearchParams-backed getter matching the page's usage. */
function fromQueryString(qs: string): SearchParamsGetter {
  const sp = new URLSearchParams(qs)
  return {
    get: (name) => sp.get(name),
    getAll: (name) => sp.getAll(name),
  }
}

describe("parseAccommodationQuery", () => {
  it("accepts a full set of valid filters", () => {
    const params = parseAccommodationQuery(
      fromQueryString(
        "city_id=3&province_id=2&category_id=1&guests_count=4&min_rooms=2&min_beds=3&min_price=100&max_price=900&check_in=2026-08-10&check_out=2026-08-15&sort_by=price_asc&skip=20&limit=50&amenity_ids=1&amenity_ids=2",
      ),
    )
    expect(params).toEqual({
      city_id: 3,
      province_id: 2,
      category_id: 1,
      guests_count: 4,
      min_rooms: 2,
      min_beds: 3,
      min_price: 100,
      max_price: 900,
      check_in: "2026-08-10",
      check_out: "2026-08-15",
      sort_by: "price_asc",
      skip: 20,
      limit: 50,
      amenity_ids: [1, 2],
    })
  })

  it("drops negative skip", () => {
    expect(parseAccommodationQuery(fromQueryString("skip=-1")).skip).toBeUndefined()
  })

  it("drops limit=0 and limit above the 100 cap", () => {
    expect(parseAccommodationQuery(fromQueryString("limit=0")).limit).toBeUndefined()
    expect(parseAccommodationQuery(fromQueryString("limit=101")).limit).toBeUndefined()
    expect(parseAccommodationQuery(fromQueryString("limit=100")).limit).toBe(100)
  })

  it("drops bad dates (wrong pattern and impossible dates)", () => {
    expect(
      parseAccommodationQuery(fromQueryString("check_in=2026-13-01&check_out=2026-13-05")).check_in,
    ).toBeUndefined()
    expect(
      parseAccommodationQuery(fromQueryString("check_in=2026-02-30&check_out=2026-03-02")).check_in,
    ).toBeUndefined()
    expect(
      parseAccommodationQuery(fromQueryString("check_in=20260810&check_out=20260815")).check_in,
    ).toBeUndefined()
  })

  it("drops check_out <= check_in", () => {
    const params = parseAccommodationQuery(
      fromQueryString("check_in=2026-08-10&check_out=2026-08-10"),
    )
    expect(params.check_in).toBeUndefined()
    expect(params.check_out).toBeUndefined()
  })

  it("drops non-integer ids", () => {
    expect(parseAccommodationQuery(fromQueryString("city_id=1.5")).city_id).toBeUndefined()
    expect(parseAccommodationQuery(fromQueryString("city_id=abc")).city_id).toBeUndefined()
    expect(parseAccommodationQuery(fromQueryString("city_id=-3")).city_id).toBeUndefined()
  })

  it("filters invalid amenity_ids but keeps valid ones", () => {
    const params = parseAccommodationQuery(
      fromQueryString("amenity_ids=2&amenity_ids=x&amenity_ids=-1"),
    )
    expect(params.amenity_ids).toEqual([2])
  })

  it("returns an empty object for an empty query", () => {
    expect(parseAccommodationQuery(fromQueryString(""))).toEqual({})
  })
})

describe("buildAccommodationQuery", () => {
  it("round-trips a representative param object", () => {
    const params = {
      city_id: 3,
      guests_count: 4,
      max_price: 900,
      check_in: "2026-08-10" as const,
      check_out: "2026-08-15" as const,
      sort_by: "price_desc" as const,
      skip: 20,
      limit: 50,
      amenity_ids: [1, 2],
    }
    const qs = buildAccommodationQuery(params)
    expect(parseAccommodationQuery(fromQueryString(qs.replace(/^\?/, "")))).toEqual(params)
  })

  it("omits non-positive counts and empty arrays", () => {
    const qs = buildAccommodationQuery({
      guests_count: 0,
      min_rooms: 0,
      min_beds: 0,
      min_price: 0,
      amenity_ids: [],
    })
    expect(qs).toBe("")
  })

  it("only emits dates when both bounds are present", () => {
    expect(buildAccommodationQuery({ check_in: "2026-08-10" as const })).toBe("")
    expect(buildAccommodationQuery({ check_out: "2026-08-15" as const })).toBe("")
  })

  it("returns an empty string (no ?) when nothing is set", () => {
    expect(buildAccommodationQuery({})).toBe("")
  })
})
