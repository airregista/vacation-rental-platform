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

  it("formats a UTC instant via the UTC branch (pre-plan-081 behavior)", () => {
    // FIXME(P081): dateStr ending in Z is formatted in UTC, not Asia/Tehran.
    // 2026-08-10T21:30:00Z is already 1395-08-19 01:00+03:30 in Tehran, so
    // the UTC formatting pins the pre-081 behavior on purpose.
    const out = formatPersianDate("2026-08-10T21:30:00Z")
    expect(out).toContain("مرداد")
    expect(out).toMatch(/۱۹/) // day 19 in UTC
  })

  it("treats an offset-less datetime as UTC (Z suffix appended)", () => {
    const out = formatPersianDate("2026-08-10T21:30:00")
    expect(out).toContain("مرداد")
    expect(out).toMatch(/۱۹/)
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
