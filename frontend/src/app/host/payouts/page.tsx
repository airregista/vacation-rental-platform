"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, Banknote, CalendarDays, Wallet } from "lucide-react"
import type { HostPayoutItem } from "@/types/host"
import type { HostReservationRecord } from "@/components/host/types"
import { HostAccessGate } from "@/components/host/host-access-gate"
import { HostPageLayout } from "@/components/host/host-page-layout"
import { PayoutLedger } from "@/components/host/payout-ledger"
import { PayoutStatusSummary } from "@/components/host/payout-summary"
import { fetchAllPages, formatFaNumber, getApiErrorMessage } from "@/components/host/host-utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

function PayoutsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-2xl" />
    </div>
  )
}

function HostPayoutsContent() {
  const [payouts, setPayouts] = React.useState<HostPayoutItem[]>([])
  const [reservations, setReservations] = React.useState<HostReservationRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let isCurrent = true

    const loadPayouts = async () => {
      try {
        const [nextPayouts, nextReservations] = await Promise.all([
          fetchAllPages<HostPayoutItem>("/payments/host/payouts"),
          fetchAllPages<HostReservationRecord>("/reservations/host"),
        ])
        if (!isCurrent) return
        setPayouts(nextPayouts)
        setReservations(nextReservations)
        setFetchError(null)
      } catch (error: unknown) {
        if (!isCurrent) return
        setFetchError(getApiErrorMessage(error, "بارگذاری گزارش مالی میزبان با خطا مواجه شد."))
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void loadPayouts()
    return () => {
      isCurrent = false
    }
  }, [reloadKey])

  const payoutCounts = React.useMemo(() => {
    const result = { pending: 0, completed: 0, cancelled: 0 }
    for (const payout of payouts) {
      if (payout.status in result) {
        result[payout.status] += 1
      }
    }
    return result
  }, [payouts])

  const handleRetry = () => {
    setIsLoading(true)
    setFetchError(null)
    setReloadKey((key) => key + 1)
  }

  if (isLoading) return <PayoutsSkeleton />

  if (fetchError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>دریافت گزارش مالی انجام نشد</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{fetchError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="border-line bg-transparent"
          >
            تلاش مجدد
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-label="خلاصه تسویه‌ها">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-lg font-black tracking-tight text-ink">وضعیت تسویه‌ها</h2>
            <p className="text-xs leading-6 text-ink-soft">
              {formatFaNumber(payoutCounts.pending)} تسویه در انتظار ·{" "}
              {formatFaNumber(payoutCounts.completed)} تسویه انجام‌شده
              {payoutCounts.cancelled > 0
                ? ` · ${formatFaNumber(payoutCounts.cancelled)} لغوشده`
                : ""}
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-trust/10 text-trust">
            <Banknote className="size-5" aria-hidden="true" />
          </span>
        </div>
        <PayoutStatusSummary payouts={payouts} />
      </section>

      <section className="space-y-3" aria-label="دفتر تسویه‌ها">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-lg font-black tracking-tight text-ink">دفتر تسویه‌ها</h2>
            <p className="text-xs leading-6 text-ink-soft">
              مبلغ ناخالص رزرو، کمیسیون سامانه و سهم خالص شما برای هر رزرو.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5 border-line bg-paper">
              <Link href="/host/reservations">
                <CalendarDays className="size-4" aria-hidden="true" />
                <span>رزروها</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 border-line bg-paper">
              <Link href="/host/listings">
                <Wallet className="size-4" aria-hidden="true" />
                <span>اقامتگاه‌ها</span>
              </Link>
            </Button>
          </div>
        </div>

        <PayoutLedger payouts={payouts} reservations={reservations} />
      </section>

      <div className="rounded-2xl border border-line/70 bg-paper-deep/35 p-4">
        <p className="text-[11px] leading-6 text-ink-soft">
          تسویه‌ها پس از تکمیل اقامت و تایید مالی سامانه انجام می‌شوند. مبلغ کمیسیون از مبلغ ناخالص
          رزرو کسر و باقی‌مانده به‌عنوان سهم خالص میزبان ثبت می‌شود. در صورت نیاز به اصلاح اطلاعات
          بانکی، با پشتیبانی سامانه در تماس باشید.
        </p>
      </div>
    </div>
  )
}

export default function HostPayoutsPage() {
  return (
    <HostPageLayout
      eyebrow="میزبانی"
      title="گزارش مالی و تسویه‌ها"
      description="درآمد رزروها، کمیسیون سامانه و وضعیت پرداخت سهم میزبان را ببینید."
      actions={
        <Button asChild variant="outline" className="gap-2 border-line bg-paper-card">
          <Link href="/host/reservations">رزروهای دریافتی</Link>
        </Button>
      }
    >
      <HostAccessGate
        title="گزارش مالی میزبان"
        description="برای دیدن تسویه‌ها و درآمد اقامتگاه‌های خود، وارد حساب میزبان شوید."
      >
        <HostPayoutsContent />
      </HostAccessGate>
    </HostPageLayout>
  )
}
