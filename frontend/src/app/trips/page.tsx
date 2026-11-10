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
  Search,
  XCircle,
} from "lucide-react"

import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { toPersianDigits } from "@/lib/format-fa"
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
      <div className="container max-w-5xl mx-auto px-4 py-12">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-5 w-96 rounded-lg" />
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
      <div className="container max-w-lg mx-auto px-4 py-20 text-center">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Luggage className="size-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            ورود به حساب کاربری
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
            برای مشاهده سابقه سفرها، دریافت ووچر رزرو، چت مستقیم با میزبان و استرداد وجه، ابتدا وارد حساب کاربری خود شوید.
          </p>
          <Button onClick={openOtpModal} className="mt-2 gap-2 w-full sm:w-auto px-8">
            <LogIn className="size-4" />
            <span>ورود / ثبت‌نام با شماره همراه</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1">
            <Luggage className="size-4" />
            <span>پنل مدیریت سفرهای مهمان</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            سفرهای من و مدیریت اقامتگاه‌ها
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            مشاهده قراردادها، کدهای رزرو، چت مستقیم با میزبان و استرداد آنلاین وجوه
          </p>
        </div>

        {/* Quick summary metrics */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 rounded-2xl bg-card border border-border shadow-xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CalendarDays className="size-4" />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">
                مجموع رزروها
              </span>
              <span className="text-sm font-bold text-foreground">
                {toPersianDigits(trips.length)} سفر
              </span>
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-2xl bg-card border border-border shadow-xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Compass className="size-4" />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">
                سفرهای فعال
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {toPersianDigits(upcomingTrips.length)} سفر
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Fetch Error Display */}
      {fetchError && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>خطا در دریافت اطلاعات</AlertTitle>
          <AlertDescription className="text-xs flex items-center justify-between">
            <span>{fetchError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-1.5 bg-background text-foreground"
            >
              <RefreshCw className="size-3.5" />
              <span>تلاش مجدد</span>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs Layout */}
      <Tabs defaultValue="all" className="mt-8">
        <TabsList className="grid grid-cols-4 w-full max-w-xl p-1 bg-muted/60 rounded-xl">
          <TabsTrigger value="all" className="rounded-lg text-xs sm:text-sm gap-1.5">
            <span>همه</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">
              {toPersianDigits(trips.length)}
            </Badge>
          </TabsTrigger>

          <TabsTrigger value="upcoming" className="rounded-lg text-xs sm:text-sm gap-1.5">
            <span>پیش‌رو</span>
            {upcomingTrips.length > 0 && (
              <Badge className="bg-emerald-600 text-white px-1.5 py-0 text-[10px] font-bold">
                {toPersianDigits(upcomingTrips.length)}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="completed" className="rounded-lg text-xs sm:text-sm gap-1.5">
            <span>پایان‌یافته</span>
            {completedTrips.length > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">
                {toPersianDigits(completedTrips.length)}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="cancelled" className="rounded-lg text-xs sm:text-sm gap-1.5">
            <span>لغوشده</span>
            {cancelledTrips.length > 0 && (
              <Badge variant="destructive" className="px-1.5 py-0 text-[10px] font-bold">
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
              title="هنوز هیچ سفری رزرو نکرده‌اید"
              description="برای تعطیلات بعدی خود از میان هزاران ویلا، سوئیت و اقامتگاه بوم‌گردی آشیانک انتخاب کنید."
              actionHref="/"
              actionLabel="جستجوی اقامتگاه"
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
              title="هیچ سفر فعالی ندارید"
              description="شما در حال حاضر رزرو در انتظار پرداخت یا اقامت قطعی تاییدشده ندارید."
              actionHref="/"
              actionLabel="رزرو اقامتگاه جدید"
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
              title="اقامت پایان‌یافته‌ای ثبت نشده است"
              description="پس از پایان مهلت اقامتگاه و خروج از آن، سفرهای پایان‌یافته اینجا نمایش داده می‌شوند و می‌توانید نظر خود را ثبت کنید."
              icon={<History className="size-8" />}
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
              title="هیچ رزرو لغوشده‌ای ندارید"
              description="رزروهایی که توسط شما لغو شده یا مهلت پرداخت آنها منقضی شده باشد در این بخش قرار می‌گیرند."
              icon={<XCircle className="size-8" />}
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
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
        >
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Skeleton className="sm:w-48 h-36 w-full rounded-xl shrink-0" />
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

interface EmptyStateProps {
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
  icon?: React.ReactNode
}

function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  icon,
}: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center flex flex-col items-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground/70">
        {icon || <Search className="size-7" />}
      </div>
      <h3 className="text-lg font-bold text-foreground mt-1">{title}</h3>
      <p className="text-xs sm:text-sm text-muted-foreground max-w-md leading-relaxed">
        {description}
      </p>
      {actionHref && actionLabel && (
        <Button asChild className="mt-3 gap-1.5">
          <Link href={actionHref}>
            <Compass className="size-4" />
            <span>{actionLabel}</span>
          </Link>
        </Button>
      )}
    </div>
  )
}
