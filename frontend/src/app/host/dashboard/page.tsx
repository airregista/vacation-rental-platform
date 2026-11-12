"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Plus,
  Power,
  Wallet,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import type { HostPayoutItem } from "@/types/host"
import type { HostListingRecord, HostReservationRecord } from "@/components/host/types"
import { HostAccessGate } from "@/components/host/host-access-gate"
import { HostPageLayout } from "@/components/host/host-page-layout"
import { HostStatCard } from "@/components/host/host-stat-card"
import { HostListingCard } from "@/components/host/listing-card"
import { HostReservationsView } from "@/components/host/reservations-view"
import { PayoutLedger } from "@/components/host/payout-ledger"
import { QuickCalendar } from "@/components/host/quick-calendar"
import { EmptyState } from "@/components/shared/empty-state"
import {
  fetchAllPages,
  formatFaNumber,
  formatToman,
  getApiErrorMessage,
} from "@/components/host/host-utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-12 w-full max-w-xl rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-80 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

function HostDashboardContent() {
  const [listings, setListings] = React.useState<HostListingRecord[]>([])
  const [reservations, setReservations] = React.useState<HostReservationRecord[]>([])
  const [payouts, setPayouts] = React.useState<HostPayoutItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  const [calendarAccommodation, setCalendarAccommodation] =
    React.useState<HostListingRecord | null>(null)

  React.useEffect(() => {
    let isCurrent = true

    const loadDashboard = async () => {
      try {
        const [nextListings, nextReservations, nextPayouts] = await Promise.all([
          fetchAllPages<HostListingRecord>("/accommodations/my"),
          fetchAllPages<HostReservationRecord>("/reservations/host"),
          fetchAllPages<HostPayoutItem>("/payments/host/payouts"),
        ])
        if (!isCurrent) return
        setListings(nextListings)
        setReservations(nextReservations)
        setPayouts(nextPayouts)
        setFetchError(null)
      } catch (error: unknown) {
        if (!isCurrent) return
        setFetchError(
          getApiErrorMessage(error, "بارگذاری داشبورد میزبان با خطا مواجه شد.")
        )
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void loadDashboard()
    return () => {
      isCurrent = false
    }
  }, [reloadKey])

  const activeListings = React.useMemo(
    () => listings.filter((listing) => listing.is_active).length,
    [listings]
  )

  const pendingReservations = React.useMemo(
    () => reservations.filter((reservation) => reservation.status === "pending").length,
    [reservations]
  )

  const pendingPayoutAmount = React.useMemo(
    () =>
      payouts
        .filter((payout) => payout.status === "pending")
        .reduce((sum, payout) => sum + payout.payout_amount, 0),
    [payouts]
  )

  const handleRetry = () => {
    setIsLoading(true)
    setFetchError(null)
    setReloadKey((key) => key + 1)
  }

  const handleCalendarSuccess = () => {
    setReloadKey((key) => key + 1)
  }

  if (isLoading) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      {fetchError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>خطا در دریافت اطلاعات</AlertTitle>
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
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="خلاصه پنل میزبان">
        <HostStatCard
          icon={Building2}
          label="اقامتگاه‌ها"
          value={formatFaNumber(listings.length)}
          hint={`${formatFaNumber(activeListings)} اقامتگاه فعال`}
          tone="brick"
        />
        <HostStatCard
          icon={Power}
          label="آماده انتشار"
          value={formatFaNumber(activeListings)}
          hint={`${formatFaNumber(listings.length - activeListings)} اقامتگاه غیرفعال`}
          tone="trust"
        />
        <HostStatCard
          icon={CalendarDays}
          label="رزرو در انتظار"
          value={formatFaNumber(pendingReservations)}
          hint={`از ${formatFaNumber(reservations.length)} رزرو دریافتی`}
          tone="gold"
        />
        <HostStatCard
          icon={Wallet}
          label="در انتظار تسویه"
          value={formatToman(pendingPayoutAmount)}
          hint="تومان · سهم خالص شما"
          tone="ink"
        />
      </section>

      <Tabs defaultValue="accommodations" className="space-y-4">
        <TabsList className="grid h-auto w-full max-w-xl grid-cols-3 gap-1 rounded-2xl border border-line/70 bg-paper-deep/60 p-1">
          <TabsTrigger
            value="accommodations"
            className="gap-1.5 rounded-xl px-2 py-2 text-xs font-bold data-[state=active]:bg-paper-card data-[state=active]:text-ink data-[state=active]:shadow-soft sm:text-sm"
          >
            <Building2 className="size-4" aria-hidden="true" />
            <span>اقامتگاه‌های من</span>
          </TabsTrigger>
          <TabsTrigger
            value="reservations"
            className="gap-1.5 rounded-xl px-2 py-2 text-xs font-bold data-[state=active]:bg-paper-card data-[state=active]:text-ink data-[state=active]:shadow-soft sm:text-sm"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            <span>رزروها</span>
          </TabsTrigger>
          <TabsTrigger
            value="payouts"
            className="gap-1.5 rounded-xl px-2 py-2 text-xs font-bold data-[state=active]:bg-paper-card data-[state=active]:text-ink data-[state=active]:shadow-soft sm:text-sm"
          >
            <Wallet className="size-4" aria-hidden="true" />
            <span>گزارش مالی</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accommodations" className="space-y-4">
          {listings.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="هنوز اقامتگاهی ثبت نکرده‌اید"
              description="اولین اقامتگاه خود را در پنج مرحله ثبت کنید تا مهمان‌ها بتوانند آن را ببینند و رزرو کنند."
              action={
                <Button asChild className="gap-2">
                  <Link href="/host/new">
                    <Plus className="size-4" aria-hidden="true" />
                    <span>ثبت اقامتگاه جدید</span>
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => (
                <HostListingCard
                  key={listing.id}
                  listing={listing}
                  mode="compact"
                  onQuickCalendar={setCalendarAccommodation}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reservations">
          <HostReservationsView
            reservations={reservations}
            emptyAction={
              <Button asChild variant="outline" className="border-line bg-transparent">
                <Link href="/host/listings">مدیریت اقامتگاه‌ها</Link>
              </Button>
            }
          />
        </TabsContent>

        <TabsContent value="payouts">
          <PayoutLedger payouts={payouts} reservations={reservations} />
        </TabsContent>
      </Tabs>

      <QuickCalendar
        accommodationId={calendarAccommodation?.id ?? null}
        open={calendarAccommodation !== null}
        onClose={() => setCalendarAccommodation(null)}
        onSuccess={handleCalendarSuccess}
      />
    </div>
  )
}

export default function HostDashboardPage() {
  const { isHost } = useAuth()

  return (
    <HostPageLayout
      showNav={isHost}
      eyebrow="پنل میزبان"
      title="داشبورد میزبان"
      description="اقامتگاه‌ها، رزروهای دریافتی و گزارش مالی خود را در یک نگاه مدیریت کنید."
      actions={
        <Button asChild className="gap-2">
          <Link href="/host/new">
            <Plus className="size-4" aria-hidden="true" />
            <span>ثبت اقامتگاه جدید</span>
          </Link>
        </Button>
      }
    >
      <HostAccessGate
        title="داشبورد میزبان"
        description="برای مدیریت اقامتگاه‌ها و مشاهده رزروها و تسویه‌ها، وارد حساب میزبان خود شوید."
      >
        <HostDashboardContent />
      </HostAccessGate>
    </HostPageLayout>
  )
}
