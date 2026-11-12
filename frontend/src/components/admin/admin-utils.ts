import type {
  AdminCoupon,
  AdminPayout,
  AdminUser,
  PayoutStatus,
} from "@/components/admin/types"

export function toAmount(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

export function formatToman(value: number | string | null | undefined): string {
  return new Intl.NumberFormat("fa-IR").format(toAmount(value))
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value)
}

export function userDisplayName(user: AdminUser | undefined): string {
  if (!user) return "کاربر آشیانک"
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "کاربر آشیانک"
}

export function userInitials(user: AdminUser | undefined): string {
  if (!user) return "آ"
  if (user.first_name && user.last_name) {
    return `${user.first_name[0]} ${user.last_name[0]}`
  }
  if (user.first_name) return user.first_name[0]
  return "آ"
}

export const ROLE_LABELS: Record<string, string> = {
  guest: "مهمان",
  host: "میزبان",
  admin: "مدیر",
}

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  pending: "در انتظار پرداخت",
  confirmed: "تایید شده",
  completed: "تکمیل شده",
  cancelled: "لغو شده",
}

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus | string, string> = {
  pending: "در انتظار تسویه",
  completed: "تسویه‌شده",
  cancelled: "لغو شده",
}

export function couponDiscountLabel(coupon: AdminCoupon): string {
  const value = formatToman(coupon.discount_value)
  return coupon.discount_type === "percentage"
    ? `${value}٪ تخفیف`
    : `${value} تومان تخفیف`
}

export function couponValidityLabel(coupon: AdminCoupon): string {
  return `${coupon.valid_from} تا ${coupon.valid_until}`
}

export function payoutStatusTone(status: PayoutStatus | string) {
  if (status === "completed") return "positive" as const
  if (status === "cancelled") return "danger" as const
  return "warning" as const
}

export function reservationStatusTone(status: string) {
  if (status === "confirmed" || status === "completed") return "positive" as const
  if (status === "cancelled") return "danger" as const
  return "warning" as const
}

export function roleTone(role: string) {
  if (role === "admin") return "brand" as const
  if (role === "host") return "positive" as const
  return "neutral" as const
}

export function payoutSummary(payouts: AdminPayout[]) {
  return payouts.reduce(
    (acc, payout) => {
      if (payout.status === "pending") {
        acc.pendingCount += 1
        acc.pendingAmount += toAmount(payout.payout_amount)
      }
      if (payout.status === "completed") {
        acc.completedAmount += toAmount(payout.payout_amount)
      }
      return acc
    },
    { pendingCount: 0, pendingAmount: 0, completedAmount: 0 }
  )
}
