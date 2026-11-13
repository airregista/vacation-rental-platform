import { describe, expect, it } from "vitest"

import { safeNext } from "@/lib/safe-next"

describe("safeNext", () => {
  it.each([
    ["/trips/123", "/trips/123"],
    ["/account", "/account"],
    [null, "/"],
    [undefined, "/"],
    ["", "/"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["/%5Cevil.com", "/"],
    ["https://evil.com", "/"],
    ["java\u0000script:", "/"],
    ["java script:", "/"],
    ["/\u0000x", "/"],
    ["/trips\n", "/"],
  ])("safeNext(%j) → %j", (value, expected) => {
    expect(safeNext(value)).toBe(expected)
  })
})
