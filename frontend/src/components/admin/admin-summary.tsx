import type { LucideIcon } from "lucide-react"
import { CalendarCheck2, TicketPercent, Users, Wallet } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type {
  AdminCoupon,
  AdminPayout,
  AdminReservation,
  AdminUser,
} from "@/components/admin/types"
import { formatCount, formatToman, payoutSummary } from "@/components/admin/admin-utils"

interface SummaryItem {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  iconClass: string
  unit?: string
}

export function AdminSummary({
  users,
  coupons,
  payouts,
  reservations,
}: {
  users: AdminUser[]
  coupons: AdminCoupon[]
  payouts: AdminPayout[]
  reservations: AdminReservation[]
}) {
  const payoutTotals = payoutSummary(payouts)
  const activeCoupons = coupons.filter((coupon) => coupon.is_active).length
  const confirmedReservations = reservations.filter(
    (reservation) => reservation.status === "confirmed",
  ).length

  const items: SummaryItem[] = [
    {
      label: "کاربران",
      value: formatCount(users.length),
      hint: "حساب‌های ثبت‌شده در سامانه",
      icon: Users,
      iconClass: "bg-brick/10 text-brick",
    },
    {
      label: "کوپن‌های فعال",
      value: formatCount(activeCoupons),
      hint: `از ${formatCount(coupons.length)} کوپن ثبت‌شده`,
      icon: TicketPercent,
      iconClass: "bg-gold-soft/70 text-gold",
    },
    {
      label: "رزروهای تاییدشده",
      value: formatCount(confirmedReservations),
      hint: `از ${formatCount(reservations.length)} رزرو ثبت‌شده`,
      icon: CalendarCheck2,
      iconClass: "bg-trust-soft/70 text-trust",
    },
    {
      label: "در انتظار تسویه",
      value: formatToman(payoutTotals.pendingAmount),
      unit: "تومان",
      hint: `${formatCount(payoutTotals.pendingCount)} ردیف تسویه‌نشده`,
      icon: Wallet,
      iconClass: "bg-paper-deep text-ink",
    },
  ]

  return (
    <section aria-label="خلاصهٔ وضعیت سامانه">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label} className="rounded-2xl border-line bg-paper-card shadow-soft">
              <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ink-soft">{item.label}</p>
                  <p className="mt-2 flex flex-wrap items-baseline gap-1 text-2xl font-black tracking-tight text-ink">
                    <span className="tabular-nums">{item.value}</span>
                    {item.unit ? (
                      <span className="text-[11px] font-bold text-ink-soft">{item.unit}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-ink-soft">{item.hint}</p>
                </div>
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-b-xl rounded-t-full ${item.iconClass}`}
                >
                  <Icon className="size-4.5" />
                </span>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
