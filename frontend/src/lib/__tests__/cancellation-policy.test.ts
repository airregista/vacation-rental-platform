import { describe, expect, it } from "vitest"

import {
  CANCELLATION_POLICY_LABELS,
  describeCancellationPolicy,
  getCancellationPolicyLabel,
  isCancellationPolicy,
} from "@/lib/cancellation-policy"

describe("CANCELLATION_POLICY_LABELS", () => {
  it("maps every policy to its Persian label", () => {
    expect(CANCELLATION_POLICY_LABELS.flexible).toBe("انعطاف‌پذیر")
    expect(CANCELLATION_POLICY_LABELS.moderate).toBe("متوسط")
    expect(CANCELLATION_POLICY_LABELS.strict).toBe("سخت‌گیرانه")
    expect(CANCELLATION_POLICY_LABELS.custom).toBe("قانون میزبان")
  })
})

describe("isCancellationPolicy", () => {
  it("accepts the four known policies", () => {
    expect(isCancellationPolicy("flexible")).toBe(true)
    expect(isCancellationPolicy("moderate")).toBe(true)
    expect(isCancellationPolicy("strict")).toBe(true)
    expect(isCancellationPolicy("custom")).toBe(true)
  })

  it("rejects junk", () => {
    expect(isCancellationPolicy(" Flexible")).toBe(false)
    expect(isCancellationPolicy("unknown")).toBe(false)
    expect(isCancellationPolicy("")).toBe(false)
    expect(isCancellationPolicy(null)).toBe(false)
    expect(isCancellationPolicy(undefined)).toBe(false)
  })
})

describe("getCancellationPolicyLabel", () => {
  it("returns the mapped label", () => {
    expect(getCancellationPolicyLabel("strict")).toBe("سخت‌گیرانه")
  })

  it("falls back to the standard label for unknown policies", () => {
    expect(getCancellationPolicyLabel("whatever")).toBe("استاندارد")
    expect(getCancellationPolicyLabel(null)).toBe("استاندارد")
  })
})

describe("describeCancellationPolicy", () => {
  it("describes the fixed policies", () => {
    expect(describeCancellationPolicy("flexible")).toBe(
      "لغو رایگان تا ۲۴ ساعت پیش از تحویل؛ پس از آن معادل یک شب اقامت به‌همراه هزینه نظافت جریمه می‌شود.",
    )
    expect(describeCancellationPolicy("moderate")).toBe(
      "لغو رایگان تا ۵ روز پیش از تحویل؛ پس از آن ۵۰٪ مبلغ اقامت جریمه می‌شود.",
    )
    expect(describeCancellationPolicy("strict")).toBe(
      "لغو رایگان تا ۱۴ روز پیش از تحویل؛ بین ۷ تا ۱۴ روز ۵۰٪ و کمتر از ۷ روز کل مبلغ جریمه می‌شود.",
    )
  })

  it("interpolates custom freeHours/penaltyPercent with Persian digits", () => {
    const out = describeCancellationPolicy("custom", { freeHours: 48, penaltyPercent: 30 })
    expect(out).toContain("۴۸")
    expect(out).toContain("۳۰٪")
  })

  it("accepts string penalty values", () => {
    const out = describeCancellationPolicy("custom", {
      freeHours: 12 as unknown as number,
      penaltyPercent: "25" as unknown as number,
    })
    expect(out).toContain("۱۲")
    expect(out).toContain("۲۵٪")
  })

  it("falls back to defaults when custom options are missing", () => {
    const out = describeCancellationPolicy("custom")
    expect(out).toContain("۲۴")
    expect(out).toContain("۵۰٪")
  })

  it("returns the default sentence for unknown policies", () => {
    expect(describeCancellationPolicy("bogus")).toBe(
      "شرایط لغو این اقامتگاه توسط میزبان تعیین شده است.",
    )
    expect(describeCancellationPolicy(undefined)).toBe(
      "شرایط لغو این اقامتگاه توسط میزبان تعیین شده است.",
    )
  })
})
