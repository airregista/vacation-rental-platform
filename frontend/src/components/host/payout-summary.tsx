"use client"

import { BadgeCheck, Clock3 } from "lucide-react"
import type { HostPayoutItem } from "@/types/host"
import { HostStatCard } from "./host-stat-card"
import { formatFaNumber, formatToman } from "./host-utils"

/**
 * Pending / settled totals for the payouts page. The detailed ledger and its
 * gross/commission/net cards stay in `PayoutLedger`.
 */
export function PayoutStatusSummary({ payouts }: { payouts: HostPayoutItem[] }) {
  const pending = payouts.filter((payout) => payout.status === "pending")
  const settled = payouts.filter((payout) => payout.status === "completed")

  const pendingAmount = pending.reduce((sum, payout) => sum + payout.payout_amount, 0)
  const settledAmount = settled.reduce((sum, payout) => sum + payout.payout_amount, 0)

  return (
    <section className="grid gap-3 sm:grid-cols-2" aria-label="خلاصه وضعیت تسویه‌ها">
      <HostStatCard
        icon={Clock3}
        label="در انتظار تسویه"
        value={formatToman(pendingAmount)}
        hint={`${formatFaNumber(pending.length)} تسویه در صف · تومان`}
        tone="gold"
      />
      <HostStatCard
        icon={BadgeCheck}
        label="تسویه‌شده"
        value={formatToman(settledAmount)}
        hint={`${formatFaNumber(settled.length)} تسویه تکمیل‌شده · تومان`}
        tone="trust"
      />
    </section>
  )
}
