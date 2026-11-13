import { describe, expect, it } from "vitest"

import { toPersianDigits } from "@/lib/format-fa"

describe("smoke", () => {
  it("converts digits to Persian", () => {
    expect(toPersianDigits(42)).toMatch(/^[\u06F0-\u06F9]{2}$/)
  })
})
