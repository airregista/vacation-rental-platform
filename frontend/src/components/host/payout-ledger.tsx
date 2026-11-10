"use client"

import * as React from "react"
import { useMemo } from "react"
import { Wallet, Percent, Banknote } from "lucide-react"
import { formatPersianDate } from "@/lib/format-fa"
import type { HostPayoutItem, HostReservationItem } from "@/types/host"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export interface PayoutLedgerProps {
  payouts: HostPayoutItem[]
  reservations: HostReservationItem[]
}

const PAYOUT_STATUS_LABEL: Record<string, string> = {
  pending: "در انتظار تسویه",
  completed: "تسویه شده",
  cancelled: "لغو شده",
}

function formatToman(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n)
}

export function PayoutLedger({ payouts, reservations }: PayoutLedgerProps) {
  // Metrics cover pending + completed payouts only; cancelled rows are
  // excluded (a cancelled payout is not money the host will receive).
  const counted = useMemo(
    () => payouts.filter((p) => p.status === "pending" || p.status === "completed"),
    [payouts]
  )

  const totals = useMemo(() => {
    return counted.reduce(
      (acc, p) => ({
        gross: acc.gross + p.total_booking_amount,
        commission: acc.commission + p.commission_amount,
        net: acc.net + p.payout_amount,
      }),
      { gross: 0, commission: 0, net: 0 }
    )
  }, [counted])

  const stayDates = (reservationId: number) => {
    const r = reservations.find((item) => item.id === reservationId)
    if (!r) return "—"
    return `${formatPersianDate(r.check_in)} تا ${formatPersianDate(r.check_out)}`
  }

  const statusBadge = (status: HostPayoutItem["status"]) => (
    <Badge variant={status === "completed" ? "default" : "secondary"}>
      {PAYOUT_STATUS_LABEL[status] || status}
    </Badge>
  )

  return (
    <div className="space-y-4">
      {/* Financial metrics cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4" aria-label="خلاصه مالی">
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">کل درآمد ناخالص</span>
              <div className="text-2xl font-black text-foreground font-price">
                {formatToman(totals.gross)}
                <span className="text-xs font-medium text-muted-foreground mr-1">تومان</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Wallet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">کارمزد ۱۰٪ سامانه</span>
              <div className="text-2xl font-black text-foreground font-price">
                {formatToman(totals.commission)}
                <span className="text-xs font-medium text-muted-foreground mr-1">تومان</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Percent className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">درآمد خالص قابل تسویه</span>
              <div className="text-2xl font-black text-foreground font-price">
                {formatToman(totals.net)}
                <span className="text-xs font-medium text-muted-foreground mr-1">تومان</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
              <Banknote className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </section>

      {payouts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          هنوز تسویه‌ای ثبت نشده است.
        </p>
      ) : (
        <>
          {/* Structured table on desktop */}
          <Card className="hidden md:block rounded-2xl">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">رزرو</th>
                    <th className="px-4 py-3 font-medium">تاریخ اقامت</th>
                    <th className="px-4 py-3 font-medium">مبلغ رزرو</th>
                    <th className="px-4 py-3 font-medium">کارمزد</th>
                    <th className="px-4 py-3 font-medium">مبلغ قابل تسویه</th>
                    <th className="px-4 py-3 font-medium">وضعیت</th>
                    <th className="px-4 py-3 font-medium">تاریخ ثبت</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-price">#{formatToman(p.reservation_id)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{stayDates(p.reservation_id)}</td>
                      <td className="px-4 py-3 font-price">{formatToman(p.total_booking_amount)}</td>
                      <td className="px-4 py-3 font-price">{formatToman(p.commission_amount)}</td>
                      <td className="px-4 py-3 font-price font-bold">{formatToman(p.payout_amount)}</td>
                      <td className="px-4 py-3">{statusBadge(p.status)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatPersianDate(p.paid_at || p.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Touch cards on mobile */}
          <div className="md:hidden space-y-3">
            {payouts.map((p) => (
              <Card key={p.id} className="rounded-2xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-bold">
                      رزرو #{formatToman(p.reservation_id)}
                    </CardTitle>
                    {statusBadge(p.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <p className="text-muted-foreground text-xs">
                    {stayDates(p.reservation_id)}
                  </p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مبلغ رزرو</span>
                    <span className="font-price">{formatToman(p.total_booking_amount)} تومان</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">کارمزد ۱۰٪</span>
                    <span className="font-price">{formatToman(p.commission_amount)} تومان</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>مبلغ قابل تسویه</span>
                    <span className="font-price">{formatToman(p.payout_amount)} تومان</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatPersianDate(p.paid_at || p.created_at)}
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
