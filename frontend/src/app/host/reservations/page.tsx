"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Wallet,
  XCircle,
} from "lucide-react"
import type { HostReservationRecord } from "@/components/host/types"
import { HostAccessGate } from "@/components/host/host-access-gate"
import { HostPageLayout } from "@/components/host/host-page-layout"
import { HostStatCard } from "@/components/host/host-stat-card"
import { HostReservationsView } from "@/components/host/reservations-view"
import {
  fetchAllPages,
  formatFaNumber,
  formatToman,
  getApiErrorMessage,
} from "@/components/host/host-utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

function ReservationsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-80 w-full rounded-2xl" />
    </div>
  )
}

function HostReservationsContent() {
  const [reservations, setReservations] = React.useState<HostReservationRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let isCurrent = true

    const loadReservations = async () => {
      try {
        const nextReservations = await fetchAllPages<HostReservationRecord>(
          "/reservations/host"
        )
        if (!isCurrent) return
        setReservations(nextReservations)
        setFetchError(null)
      } catch (error: unknown) {
        if (!isCurrent) return
        setFetchError(
          getApiErrorMessage(error, "بارگذاری رزروهای دریافتی با خطا مواجه شد.")
        )
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void loadReservations()
    return () => {
      isCurrent = false
    }
  }, [reloadKey])

  const counts = React.useMemo(() => {
    const result = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    }
    for (const reservation of reservations) {
      if (reservation.status in result) {
        result[reservation.status as keyof typeof result] += 1
      }
    }
    return result
  }, [reservations])

  const confirmedRevenue = React.useMemo(
    () =>
      reservations
        .filter(
          (reservation) =>
            reservation.status === "confirmed" || reservation.status === "completed"
        )
        .reduce((sum, reservation) => sum + reservation.total_price, 0),
    [reservations]
  )

  const handleRetry = () => {
    setIsLoading(true)
    setFetchError(null)
    setReloadKey((key) => key + 1)
  }

  if (isLoading) return <ReservationsSkeleton />

  if (fetchError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>دریافت رزروها انجام نشد</AlertTitle>
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
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="خلاصه رزروها">
        <HostStatCard
          icon={CalendarDays}
          label="کل رزروها"
          value={formatFaNumber(reservations.length)}
          hint={`${formatFaNumber(counts.pending)} رزرو در انتظار تایید`}
          tone="brick"
        />
        <HostStatCard
          icon={Clock3}
          label="در انتظار تایید"
          value={formatFaNumber(counts.pending)}
          hint="نیازمند بررسی و اقدام شما"
          tone="gold"
        />
        <HostStatCard
          icon={CheckCircle2}
          label="تاییدشده"
          value={formatFaNumber(counts.confirmed)}
          hint={`${formatFaNumber(counts.completed)} اقامت تکمیل‌شده`}
          tone="trust"
        />
        <HostStatCard
          icon={XCircle}
          label="لغوشده"
          value={formatFaNumber(counts.cancelled)}
          hint="سابقه رزروها حفظ می‌شود"
          tone="ink"
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/80 bg-paper-card px-4 py-3 shadow-soft">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-ink">درآمد رزروهای تاییدشده</p>
          <p className="text-lg font-black tabular-nums text-brick">
            {formatToman(confirmedRevenue)}
            <span className="mr-1 text-[11px] font-medium text-ink-soft">تومان</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="border-line bg-paper">
            <Link href="/host/payouts">گزارش مالی</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5 border-line bg-paper">
            <Link href="/host/listings">
              <Wallet className="size-4" aria-hidden="true" />
              <span>مدیریت اقامتگاه‌ها</span>
            </Link>
          </Button>
        </div>
      </div>

      <section className="space-y-3" aria-label="فهرست رزروها">
        <div className="space-y-1">
          <h2 className="text-lg font-black tracking-tight text-ink">رزروهای دریافتی</h2>
          <p className="text-xs leading-6 text-ink-soft">
            رزروهای همه اقامتگاه‌های شما در یک فهرست؛ با تب‌ها می‌توانید وضعیت‌ها را
            جدا کنید.
          </p>
        </div>

        <HostReservationsView
          reservations={reservations}
          enableFilters
          emptyAction={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className="gap-2">
                <Link href="/host/new">ثبت اقامتگاه جدید</Link>
              </Button>
              <Button asChild variant="outline" className="border-line bg-transparent">
                <Link href="/host/listings">مدیریت اقامتگاه‌ها</Link>
              </Button>
            </div>
          }
        />
      </section>
    </div>
  )
}

export default function HostReservationsPage() {
  return (
    <HostPageLayout
      eyebrow="میزبانی"
      title="رزروهای دریافتی"
      description="وضعیت رزروها، مهمان‌ها و درآمد هر اقامت را پیگیری کنید."
      actions={
        <Button asChild variant="outline" className="gap-2 border-line bg-paper-card">
          <Link href="/host/listings">مدیریت اقامتگاه‌ها</Link>
        </Button>
      }
    >
      <HostAccessGate
        title="رزروهای دریافتی"
        description="برای دیدن رزروهای اقامتگاه‌های خود، وارد حساب میزبان شوید."
      >
        <HostReservationsContent />
      </HostAccessGate>
    </HostPageLayout>
  )
}
