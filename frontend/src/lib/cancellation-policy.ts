import { toPersianDigits } from "@/lib/format-fa"

export type CancellationPolicy = "flexible" | "moderate" | "strict" | "custom"

export const CANCELLATION_POLICY_LABELS: Record<CancellationPolicy, string> = {
  flexible: "انعطاف‌پذیر",
  moderate: "متوسط",
  strict: "سخت‌گیرانه",
  custom: "قانون میزبان",
}

export function isCancellationPolicy(
  value: string | null | undefined,
): value is CancellationPolicy {
  return value === "flexible" || value === "moderate" || value === "strict" || value === "custom"
}

export function getCancellationPolicyLabel(policy: string | null | undefined): string {
  return isCancellationPolicy(policy) ? CANCELLATION_POLICY_LABELS[policy] : "استاندارد"
}

/**
 * One-line human explanation of the policy, including the host-defined window
 * and penalty for the `custom` policy. Shared by host forms and guest dialogs.
 */
export function describeCancellationPolicy(
  policy: string | null | undefined,
  options: { freeHours?: number | null; penaltyPercent?: number | string | null } = {},
): string {
  switch (policy) {
    case "flexible":
      return "لغو رایگان تا ۲۴ ساعت پیش از تحویل؛ پس از آن معادل یک شب اقامت به‌همراه هزینه نظافت جریمه می‌شود."
    case "moderate":
      return "لغو رایگان تا ۵ روز پیش از تحویل؛ پس از آن ۵۰٪ مبلغ اقامت جریمه می‌شود."
    case "strict":
      return "لغو رایگان تا ۱۴ روز پیش از تحویل؛ بین ۷ تا ۱۴ روز ۵۰٪ و کمتر از ۷ روز کل مبلغ جریمه می‌شود."
    case "custom": {
      const freeHours = Number(options.freeHours ?? 24)
      const penaltyPercent = Number(options.penaltyPercent ?? 50)
      return `لغو رایگان تا ${toPersianDigits(freeHours)} ساعت پیش از تحویل؛ پس از آن ${toPersianDigits(penaltyPercent)}٪ مبلغ اقامت جریمه می‌شود.`
    }
    default:
      return "شرایط لغو این اقامتگاه توسط میزبان تعیین شده است."
  }
}

/**
 * Translate known backend cancellation failures to Persian. Unknown details
 * fall back to a Persian message so raw English never reaches the guest.
 * Merges the trip cancellation modal's error table with the checkout
 * expired/cancelled banner's expiry and occupancy phrasings.
 */
export function mapCancellationReason(detail: string | null | undefined, fallback: string): string {
  if (!detail) return fallback
  const lower = detail.toLowerCase()
  if (lower.includes("cannot be cancelled from status")) {
    if (lower.includes("cancelled")) {
      return "این رزرو قبلاً لغو شده است."
    }
    if (lower.includes("completed")) {
      return "این رزرو به پایان رسیده و امکان لغو آن وجود ندارد."
    }
    return "این رزرو در وضعیتی نیست که بتوان آن را لغو کرد."
  }
  if (lower.includes("host payout has already been settled")) {
    return "تسویه حساب میزبان انجام شده و امکان لغو وجود ندارد."
  }
  if (lower.includes("check-in time has already arrived")) {
    return "موعد تحویل اقامتگاه سپری شده و امکان لغو وجود ندارد."
  }
  if (lower.includes("reservation not found")) {
    return "رزرو موردنظر یافت نشد."
  }
  if (lower.includes("access forbidden")) {
    return "شما به این رزرو دسترسی ندارید."
  }
  if (lower.includes("ttl") || lower.includes("expire") || lower.includes("timeout")) {
    return "مهلت پرداخت ۳۰ دقیقه‌ای این رزرو به پایان رسیده است و تاریخ‌های انتخابی آزاد شدند."
  }
  if (lower.includes("concurrent") || lower.includes("conflict") || lower.includes("occupied")) {
    return "متاسفانه این اقامتگاه در این بازه تاریخی هم‌اکنون توسط کاربر دیگری رزرو شد."
  }
  return /[\u0600-\u06FF]/.test(detail) ? detail : fallback
}
