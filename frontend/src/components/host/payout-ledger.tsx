"use client"

import * as React from "react"
import { useMemo } from "react"
import { Banknote, Percent, Wallet } from "lucide-react"
import { formatPersianDate } from "@/lib/format-fa"
import type { HostPayoutItem, HostReservationItem } from "@/types/host"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { formatFaNumber, formatToman } from "./host-utils"

export interface PayoutLedgerProps {
  payouts: HostPayoutItem[]
  reservations: HostReservationItem[]
}

const PAYOUT_STATUS_LABEL: Record<string, string> = {
  pending: "در انتظار تسویه",
  completed: "تسویه شده",
  cancelled: "لغو شده",
}

function PayoutStatusBadge({ status }: { status: HostPayoutItem["status"] }) {
  const className =
    status === "completed"
      ? "border-trust/40 bg-trust/10 text-trust"
      : status === "cancelled"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-gold/40 bg-gold-soft/80 text-ink"

  return (
    <Badge variant="outline" className={`px-2.5 py-1 text-[10px] font-bold ${className}`}>
      {PAYOUT_STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

export function PayoutLedger({ payouts, reservations }: PayoutLedgerProps) {
  // Metrics cover pending + completed payouts only; cancelled rows are
  // excluded (a cancelled payout is not money the host will receive).
  const counted = useMemo(
    () => payouts.filter((payout) => payout.status === "pending" || payout.status === "completed"),
    [payouts]
  )

  const totals = useMemo(
    () =>
      counted.reduce(
        (result, payout) => ({
          gross: result.gross + payout.total_booking_amount,
          commission: result.commission + payout.commission_amount,
          net: result.net + payout.payout_amount,
        }),
        { gross: 0, commission: 0, net: 0 }
      ),
    [counted]
  )

  const stayDates = (reservationId: number) => {
    const reservation = reservations.find((item) => item.id === reservationId)
    if (!reservation) return "—"
    return `${formatPersianDate(reservation.check_in)} تا ${formatPersianDate(reservation.check_out)}`
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="خلاصه مالی">
        <Card className="rounded-2xl border-line/80 bg-paper-card shadow-soft">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-ink-soft">کل درآمد ناخالص</span>
              <p className="text-2xl font-black tabular-nums text-ink">
                {formatToman(totals.gross)}
                <span className="mr-1 text-xs font-medium text-ink-soft">تومان</span>
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-xl bg-brick/10 text-brick">
              <Wallet className="size-5" aria-hidden="true" />
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-line/80 bg-paper-card shadow-soft">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-ink-soft">کارمزد ۱۰٪ سامانه</span>
              <p className="text-2xl font-black tabular-nums text-ink">
                {formatToman(totals.commission)}
                <span className="mr-1 text-xs font-medium text-ink-soft">تومان</span>
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-xl bg-gold-soft text-gold">
              <Percent className="size-5" aria-hidden="true" />
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-line/80 bg-paper-card shadow-soft">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-ink-soft">درآمد خالص قابل تسویه</span>
              <p className="text-2xl font-black tabular-nums text-ink">
                {formatToman(totals.net)}
                <span className="mr-1 text-xs font-medium text-ink-soft">تومان</span>
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-xl bg-trust/10 text-trust">
              <Banknote className="size-5" aria-hidden="true" />
            </span>
          </CardContent>
        </Card>
      </section>

      {payouts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="هنوز تسویه‌ای ثبت نشده است"
          description="پس از تکمیل اولین رزرو و پرداخت مهمان، سهم شما و وضعیت تسویه در این بخش ثبت می‌شود."
        />
      ) : (
        <>
          {/* Structured table on desktop */}
          <Card className="hidden overflow-hidden rounded-2xl border-line/80 bg-paper-card shadow-soft md:block">
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-line/70 bg-paper-deep/35 text-[11px] font-bold text-ink-soft">
                    <th scope="col" className="px-4 py-3 font-bold">رزرو</th>
                    <th scope="col" className="px-4 py-3 font-bold">تاریخ اقامت</th>
                    <th scope="col" className="px-4 py-3 font-bold">مبلغ رزرو</th>
                    <th scope="col" className="px-4 py-3 font-bold">کارمزد</th>
                    <th scope="col" className="px-4 py-3 font-bold">مبلغ قابل تسویه</th>
                    <th scope="col" className="px-4 py-3 font-bold">وضعیت</th>
                    <th scope="col" className="px-4 py-3 font-bold">تاریخ ثبت</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr
                      key={payout.id}
                      className="border-b border-line/60 transition-colors last:border-0 hover:bg-paper-deep/25"
                    >
                      <td className="px-4 py-3 tabular-nums text-ink">
                        #{formatFaNumber(payout.reservation_id)}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-soft">
                        {stayDates(payout.reservation_id)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-ink">
                        {formatToman(payout.total_booking_amount)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-ink">
                        {formatToman(payout.commission_amount)}
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums text-ink">
                        {formatToman(payout.payout_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <PayoutStatusBadge status={payout.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-soft">
                        {formatPersianDate(payout.paid_at || payout.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Touch cards on mobile */}
          <div className="space-y-3 md:hidden">
            {payouts.map((payout) => (
              <Card
                key={payout.id}
                className="rounded-2xl border-line/80 bg-paper-card shadow-soft"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-bold text-ink">
                      رزرو #{formatFaNumber(payout.reservation_id)}
                    </CardTitle>
                    <PayoutStatusBadge status={payout.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <p className="text-xs text-ink-soft">
                    {stayDates(payout.reservation_id)}
                  </p>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">مبلغ رزرو</span>
                    <span className="tabular-nums text-ink">
                      {formatToman(payout.total_booking_amount)} تومان
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">کارمزد ۱۰٪</span>
                    <span className="tabular-nums text-ink">
                      {formatToman(payout.commission_amount)} تومان
                    </span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-ink">مبلغ قابل تسویه</span>
                    <span className="tabular-nums text-brick">
                      {formatToman(payout.payout_amount)} تومان
                    </span>
                  </div>
                  <p className="text-xs text-ink-soft">
                    {formatPersianDate(payout.paid_at || payout.created_at)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
