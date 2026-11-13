import { describe, expect, it } from "vitest"

import {
  addDays,
  getPersianParts,
  localTodayIso,
  nextPersianMonthStart,
  persianMonthStart,
  previousPersianMonthStart,
  toISODate,
} from "@/lib/persian-calendar"

describe("toISODate", () => {
  it("round-trips a fixed UTC Date", () => {
    // toISODate reads UTC getters; construct the input in UTC so the
    // assertion is timezone-independent (a local `new Date(2026, 0, 15)`
    // in a UTC+3:30 environment lands on 2026-01-14 in UTC).
    expect(toISODate(new Date(Date.UTC(2026, 0, 15)))).toBe("2026-01-15")
  })

  it("zero-pads month and day", () => {
    expect(toISODate(new Date(Date.UTC(2026, 2, 5)))).toBe("2026-03-05")
  })
})

describe("addDays", () => {
  it("crosses a month boundary", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01")
  })

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
  })

  it("handles negative days", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
  })

  it("does not mutate the parsed input semantics (pure on its string arg)", () => {
    const input = "2026-02-28"
    addDays(input, 1)
    expect(input).toBe("2026-02-28")
  })
})

describe("getPersianParts", () => {
  it("matches Intl computed inline (mirror, not magic constants)", () => {
    const iso = "2026-08-10"
    const parts = getPersianParts(iso)
    const expected = new Intl.DateTimeFormat("en-u-ca-persian", {
      timeZone: "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date(`${iso}T00:00:00Z`))
    let year = 0
    let month = 0
    let day = 0
    for (const part of expected) {
      if (part.type === "year") year = Number(part.value)
      if (part.type === "month") month = Number(part.value)
      if (part.type === "day") day = Number(part.value)
    }
    expect(parts.year).toBe(year)
    expect(parts.month).toBe(month)
    expect(parts.day).toBe(day)
  })

  it("exposes monthName/yearLabel in Persian", () => {
    const parts = getPersianParts("2026-08-10")
    expect(parts.monthName).toBe("مرداد")
    expect(parts.yearLabel).toMatch(/۱۴۰۵/)
    expect(parts.title).toBe("مرداد ۱۴۰۵")
    expect(parts.key).toBe("1405-5")
  })
})

describe("persianMonthStart", () => {
  it("lands on day 1 of the Persian month", () => {
    const start = persianMonthStart("2026-08-10")
    expect(getPersianParts(start).day).toBe(1)
    // 2026-08-10 is 1405-05-19, so the month starts 18 days earlier.
    expect(start).toBe("2026-07-23")
  })
})

describe("previousPersianMonthStart", () => {
  it("lands on day 1 of the previous Persian month", () => {
    const prev = previousPersianMonthStart("2026-08-10")
    expect(getPersianParts(prev).day).toBe(1)
    expect(getPersianParts(prev).key).not.toBe(getPersianParts("2026-08-10").key)
    expect(prev < "2026-08-10").toBe(true)
  })
})

describe("nextPersianMonthStart", () => {
  it("lands on day 1 of the next Persian month", () => {
    const next = nextPersianMonthStart("2026-08-10")
    expect(getPersianParts(next).day).toBe(1)
    expect(next > "2026-08-10").toBe(true)
  })

  it("orders previous < current < next", () => {
    const iso = "2026-08-10"
    const prev = previousPersianMonthStart(iso)
    const next = nextPersianMonthStart(iso)
    expect(prev < iso).toBe(true)
    expect(next > iso).toBe(true)
  })

  it("works across the Persian new year (Esfand -> Farvardin)", () => {
    // 2026-03-20 is the last day of Esfand 1404 (non-leap: 29 days).
    const next = nextPersianMonthStart("2026-03-15")
    expect(getPersianParts(next).month).toBe(1)
    expect(getPersianParts(next).day).toBe(1)
  })
})

describe("localTodayIso", () => {
  it("matches the local Y-M-D of now", () => {
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    expect(localTodayIso()).toBe(expected)
  })
})
