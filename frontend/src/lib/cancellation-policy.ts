import { toPersianDigits } from "@/lib/format-fa"

export type CancellationPolicy = "flexible" | "moderate" | "strict" | "custom"

export const CANCELLATION_POLICY_LABELS: Record<CancellationPolicy, string> = {
  flexible: "انعطاف‌پذیر",
  moderate: "متوسط",
  strict: "سخت‌گیرانه",
  custom: "قانون میزبان",
}

export function isCancellationPolicy(
  value: string | null | undefined
): value is CancellationPolicy {
  return (
    value === "flexible" ||
    value === "moderate" ||
    value === "strict" ||
    value === "custom"
  )
}

export function getCancellationPolicyLabel(
  policy: string | null | undefined
): string {
  return isCancellationPolicy(policy)
    ? CANCELLATION_POLICY_LABELS[policy]
    : "استاندارد"
}

/**
 * One-line human explanation of the policy, including the host-defined window
 * and penalty for the `custom` policy. Shared by host forms and guest dialogs.
 */
export function describeCancellationPolicy(
  policy: string | null | undefined,
  options: { freeHours?: number | null; penaltyPercent?: number | string | null } = {}
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
