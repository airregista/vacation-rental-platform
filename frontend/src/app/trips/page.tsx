"use client"

import * as React from "react"
import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import {
  CalendarDays,
  Compass,
  History,
  LogIn,
  Luggage,
  RefreshCw,
  XCircle,
} from "lucide-react"

import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { toPersianDigits } from "@/lib/format-fa"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TripCard } from "@/components/trips/trip-card"
import { CancellationModal } from "@/components/trips/cancellation-modal"
import { ReviewDialog } from "@/components/trips/review-dialog"
import { ChatDrawer } from "@/components/trips/chat-drawer"
import type { TripReservationItem } from "@/types/trips"

export default function TripsPage() {
  const { token, isLoading: isAuthLoading, openOtpModal } = useAuth()

  const [trips, setTrips] = useState<TripReservationItem[]>([])
  const [isLoadingTrips, setIsLoadingTrips] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState<number>(0)

  // Active modals
  const [cancelTrip, setCancelTrip] = useState<TripReservationItem | null>(null)
  const [reviewTrip, setReviewTrip] = useState<TripReservationItem | null>(null)
  const [chatTrip, setChatTrip] = useState<TripReservationItem | null>(null)

  useEffect(() => {
    if (isAuthLoading || !token) {
      return
    }

    let isMounted = true

    // The backend defaults to limit=20; fetch every page so the list and
    // the totals include all of the user's reservations.
    const fetchAllTrips = async (): Promise<TripReservationItem[]> => {
      const all: TripReservationItem[] = []
      let skip = 0
      let hasMore = true
      while (hasMore) {
        const page = await apiClient.get<TripReservationItem[]>(
          `/reservations/my?skip=${skip}&limit=100`
        )
        all.push(...page)
        hasMore = page.length === 100
        skip += 100
      }
      return all
    }

    fetchAllTrips()
      .then((data) => {
        if (isMounted) {
          setTrips(data)
          setFetchError(null)
          setIsLoadingTrips(false)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setIsLoadingTrips(false)
          if (err instanceof ApiError) {
            setFetchError(
              err.detail || err.message || "خطا در بارگذاری لیست سفرها."
            )
          } else {
            setFetchError("خطا در برقراری ارتباط با سرور. لطفاً مجدداً تلاش فرمایید.")
          }
        }
      })

    return () => {
      isMounted = false
    }
  }, [isAuthLoading, token, reloadKey])

  // Category partition
  const upcomingTrips = useMemo(
    () => trips.filter((t) => t.status === "confirmed" || t.status === "pending"),
    [trips]
  )

  const completedTrips = useMemo(
    () => trips.filter((t) => t.status === "completed"),
    [trips]
  )

  const cancelledTrips = useMemo(
    () => trips.filter((t) => t.status === "cancelled"),
    [trips]
  )

  const handleCancelled = (
    id: number,
    refundAmount?: number | string,
    penaltyAmount?: number | string
  ) => {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: "cancelled",
              refund_amount: refundAmount ?? t.refund_amount,
              penalty_amount: penaltyAmount ?? t.penalty_amount,
              cancelled_at: new Date().toISOString(),
            }
          : t
      )
    )
  }

  const handleReviewSubmitted = () => {
    setReloadKey((prev) => prev + 1)
  }

  const handleRefresh = () => {
    setIsLoadingTrips(true)
    setFetchError(null)
    setReloadKey((prev) => prev + 1)
  }

  // 1. Initial Auth Loading State
  if (isAuthLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-5 w-96 max-w-full rounded-lg" />
          <div className="grid gap-6 pt-6">
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  // 2. Unauthenticated State
  if (!token) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-16 sm:py-20">
        <div className="rounded-3xl border border-line/80 bg-paper-card p-8 shadow-soft">
          <EmptyState
            icon={Luggage}
            title="اول کلید خانه را بگیریم"
            description="برای دیدن سفرها، ووچر رزرو، گفتگو با میزبان و استرداد وجه، وارد حساب مهمانی خود شوید."
            showBrandMark
            action={
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <Button onClick={openOtpModal} className="gap-2">
                  <LogIn className="size-4" />
                  <span>ورود با شماره همراه</span>
                </Button>
                <Button asChild variant="outline" className="border-line bg-transparent">
                  <Link href="/login?next=/trips">صفحه ورود</Link>
                </Button>
              </div>
            }
          />
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      <PageHeader
        eyebrow="سفرهای من"
        title="دفتر سفرهای شما"
        description="رزروها، ووچرها، گفتگوی مستقیم با میزبان و پیگیری استرداد وجه، همه در یک دفتر."
        actions={
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-line/80 bg-paper-card px-4 py-2.5 shadow-soft">
              <span className="grid size-9 place-items-center rounded-b-xl rounded-t-full bg-brick/10 text-brick">
                <CalendarDays className="size-4" />
              </span>
              <div>
                <span className="block text-[11px] text-ink-soft">مجموع رزروها</span>
                <span className="text-sm font-black tabular-nums text-ink">
                  {toPersianDigits(trips.length)} سفر
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-line/80 bg-paper-card px-4 py-2.5 shadow-soft">
              <span className="grid size-9 place-items-center rounded-b-xl rounded-t-full bg-trust/10 text-trust">
                <Compass className="size-4" />
              </span>
              <div>
                <span className="block text-[11px] text-ink-soft">سفرهای فعال</span>
                <span className="text-sm font-black tabular-nums text-trust">
                  {toPersianDigits(upcomingTrips.length)} سفر
                </span>
              </div>
            </div>
          </>
        }
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 pb-20 sm:px-6 lg:px-8">
        {fetchError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>خطا در دریافت اطلاعات</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{fetchError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="gap-1.5 border-line bg-transparent"
              >
                <RefreshCw className="size-3.5" />
                <span>تلاش مجدد</span>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="all">
          <TabsList className="grid h-auto w-full max-w-xl grid-cols-4 gap-1 rounded-2xl border border-line/70 bg-paper-deep/60 p-1">
            <TabsTrigger
              value="all"
              className="gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold data-[state=active]:bg-paper-card data-[state=active]:text-ink data-[state=active]:shadow-soft sm:text-sm"
            >
              <span>همه</span>
              <Badge
                variant="outline"
                className="border-transparent bg-brick/10 px-1.5 py-0 text-[10px] font-bold text-brick"
              >
                {toPersianDigits(trips.length)}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="upcoming"
              className="gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold data-[state=active]:bg-paper-card data-[state=active]:text-ink data-[state=active]:shadow-soft sm:text-sm"
            >
              <span>پیش‌رو</span>
              {upcomingTrips.length > 0 && (
                <Badge
                  variant="outline"
                  className="border-transparent bg-trust/15 px-1.5 py-0 text-[10px] font-bold text-trust"
                >
                  {toPersianDigits(upcomingTrips.length)}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="completed"
              className="gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold data-[state=active]:bg-paper-card data-[state=active]:text-ink data-[state=active]:shadow-soft sm:text-sm"
            >
              <span>پایان‌یافته</span>
              {completedTrips.length > 0 && (
                <Badge
                  variant="outline"
                  className="border-line bg-paper-deep px-1.5 py-0 text-[10px] font-bold text-ink-soft"
                >
                  {toPersianDigits(completedTrips.length)}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="cancelled"
              className="gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold data-[state=active]:bg-paper-card data-[state=active]:text-ink data-[state=active]:shadow-soft sm:text-sm"
            >
              <span>لغوشده</span>
              {cancelledTrips.length > 0 && (
                <Badge
                  variant="outline"
                  className="border-destructive/30 bg-destructive/10 px-1.5 py-0 text-[10px] font-bold text-destructive"
                >
                  {toPersianDigits(cancelledTrips.length)}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: All Trips */}
          <TabsContent value="all" className="mt-6 space-y-4">
            {isLoadingTrips ? (
              <LoadingCardsSkeleton />
            ) : trips.length === 0 ? (
              <EmptyState
                icon={Luggage}
                title="هنوز هیچ سفری رزرو نکرده‌اید"
                description="برای تعطیلات بعدی خود از میان ویلا، سوئیت و اقامتگاه بوم‌گردی آشیانک انتخاب کنید."
                showBrandMark
                action={
                  <Button asChild className="gap-1.5">
                    <Link href="/">
                      <Compass className="size-4" />
                      <span>جستجوی اقامتگاه</span>
                    </Link>
                  </Button>
                }
              />
            ) : (
              trips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onOpenCancel={setCancelTrip}
                  onOpenReview={setReviewTrip}
                  onOpenChat={setChatTrip}
                />
              ))
            )}
          </TabsContent>

          {/* Tab 2: Upcoming Trips */}
          <TabsContent value="upcoming" className="mt-6 space-y-4">
            {isLoadingTrips ? (
              <LoadingCardsSkeleton />
            ) : upcomingTrips.length === 0 ? (
              <EmptyState
                icon={Compass}
                title="هیچ سفر فعالی ندارید"
                description="شما در حال حاضر رزرو در انتظار پرداخت یا اقامت قطعی تاییدشده ندارید."
                showBrandMark
                action={
                  <Button asChild className="gap-1.5">
                    <Link href="/">
                      <Compass className="size-4" />
                      <span>رزرو اقامتگاه جدید</span>
                    </Link>
                  </Button>
                }
              />
            ) : (
              upcomingTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onOpenCancel={setCancelTrip}
                  onOpenReview={setReviewTrip}
                  onOpenChat={setChatTrip}
                />
              ))
            )}
          </TabsContent>

          {/* Tab 3: Completed Trips */}
          <TabsContent value="completed" className="mt-6 space-y-4">
            {isLoadingTrips ? (
              <LoadingCardsSkeleton />
            ) : completedTrips.length === 0 ? (
              <EmptyState
                icon={History}
                title="اقامت پایان‌یافته‌ای ثبت نشده است"
                description="پس از پایان مهلت اقامتگاه و خروج از آن، سفرهای پایان‌یافته اینجا نمایش داده می‌شوند و می‌توانید نظر خود را ثبت کنید."
              />
            ) : (
              completedTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onOpenCancel={setCancelTrip}
                  onOpenReview={setReviewTrip}
                  onOpenChat={setChatTrip}
                />
              ))
            )}
          </TabsContent>

          {/* Tab 4: Cancelled Trips */}
          <TabsContent value="cancelled" className="mt-6 space-y-4">
            {isLoadingTrips ? (
              <LoadingCardsSkeleton />
            ) : cancelledTrips.length === 0 ? (
              <EmptyState
                icon={XCircle}
                title="هیچ رزرو لغوشده‌ای ندارید"
                description="رزروهایی که توسط شما لغو شده یا مهلت پرداخت آنها منقضی شده باشد در این بخش قرار می‌گیرند."
              />
            ) : (
              cancelledTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onOpenCancel={setCancelTrip}
                  onOpenReview={setReviewTrip}
                  onOpenChat={setChatTrip}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Cancellation Modal */}
      <CancellationModal
        trip={cancelTrip}
        isOpen={!!cancelTrip}
        onClose={() => setCancelTrip(null)}
        onCancelled={handleCancelled}
      />

      {/* Review Dialog */}
      <ReviewDialog
        trip={reviewTrip}
        isOpen={!!reviewTrip}
        onClose={() => setReviewTrip(null)}
        onReviewSubmitted={handleReviewSubmitted}
      />

      {/* Chat Drawer */}
      <ChatDrawer
        trip={chatTrip}
        isOpen={!!chatTrip}
        onClose={() => setChatTrip(null)}
      />
    </div>
  )
}

function LoadingCardsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="space-y-4 rounded-2xl border border-line/80 bg-paper-card p-5"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Skeleton className="h-36 w-full shrink-0 rounded-xl sm:w-48" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
