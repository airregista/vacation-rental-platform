import { describe, expect, it } from "vitest"

import { formatMessageTime, formatPersianDate, toPersianDigits } from "@/lib/format-fa"

describe("toPersianDigits", () => {
  it("converts a number", () => {
    expect(toPersianDigits(42)).toBe("۴۲")
  })

  it("converts a string and keeps leading zeros", () => {
    expect(toPersianDigits("0042")).toBe("۰۰۴۲")
  })

  it("passes non-digit characters through", () => {
    expect(toPersianDigits("a1-b2")).toBe("a۱-b۲")
  })
})

describe("formatPersianDate", () => {
  it("returns empty string for empty input", () => {
    expect(formatPersianDate("")).toBe("")
  })

  it("formats a date-only ISO string (appends midnight UTC)", () => {
    const out = formatPersianDate("2026-08-10")
    // Structure: day + Persian month name + year — assert the month name so
    // the test survives ICU string-variance across Node builds.
    expect(out).toContain("مرداد")
    expect(out).toMatch(/۱۴۰۵/) // 2026-08-10 == 1405-05-19 Persian
  })

  it("formats an instant in Asia/Tehran (plan-081 behavior)", () => {
    // 2026-08-10T21:30:00Z is 1405-05-20 01:00+03:30 in Tehran — the Tehran
    // branch must render the next Tehran day, not the UTC day (19).
    const out = formatPersianDate("2026-08-10T21:30:00Z")
    expect(out).toContain("مرداد")
    expect(out).toMatch(/۲۰/) // day 20 in Asia/Tehran
  })

  it("treats an offset-less datetime as UTC (Z suffix appended)", () => {
    const out = formatPersianDate("2026-08-10T21:30:00")
    expect(out).toContain("مرداد")
    expect(out).toMatch(/۲۰/) // normalized to Z, then formatted in Tehran
  })

  it("falls back to the raw string on invalid input", () => {
    expect(formatPersianDate("not-a-date")).toBe("not-a-date")
  })
})

describe("formatMessageTime", () => {
  it("formats an instant in Asia/Tehran with Persian digits", () => {
    // 2026-08-10T21:30:00Z == 01:00 next day in Tehran (+03:30, no DST).
    const out = formatMessageTime("2026-08-10T21:30:00Z")
    expect(out).toBe("۰۱:۰۰")
  })

  it("returns an empty string on invalid input", () => {
    expect(formatMessageTime("not-a-date")).toBe("")
  })
})
