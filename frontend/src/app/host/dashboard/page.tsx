"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  CalendarDays,
  Wallet,
  Plus,
  LogIn,
  AlertCircle,
  Sparkles,
  Star,
  Compass,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { formatPersianDate } from "@/lib/format-fa"
import type {
  HostAccommodationItem,
  HostReservationItem,
  HostPayoutItem,
} from "@/types/host"
import { QuickCalendar } from "@/components/host/quick-calendar"
import { PayoutLedger } from "@/components/host/payout-ledger"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const RESERVATION_STATUS_LABEL: Record<string, string> = {
  pending: "در انتظار",
  confirmed: "تایید شده",
  cancelled: "لغو شده",
  completed: "تکمیل شده",
}

function formatToman(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n)
}

function formatCount(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n)
}

// Paginated fetch: loop skip/limit=100 until a short page, otherwise the
// endpoint's default limit=20 silently truncates the list.
async function fetchAll<T>(path: string): Promise<T[]> {
  const all: T[] = []
  let skip = 0
  for (;;) {
    const page = await apiClient.get<T[]>(`${path}?skip=${skip}&limit=100`)
    const batch = Array.isArray(page) ? page : []
    all.push(...batch)
    if (batch.length < 100) break
    skip += 100
  }
  return all
}

function HostDashboardSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6" dir="rtl">
      <Skeleton className="h-8 w-64 rounded-lg" />
      <Skeleton className="h-10 w-full max-w-md rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border p-3">
            <Skeleton className="aspect-[16/10] w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HostDashboardPage() {
  const router = useRouter()
  const { token, isLoading, isHost, becomeHost, openOtpModal } = useAuth()

  const [accommodations, setAccommodations] = useState<HostAccommodationItem[]>([])
  const [reservations, setReservations] = useState<HostReservationItem[]>([])
  const [payouts, setPayouts] = useState<HostPayoutItem[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isPromoting, setIsPromoting] = useState(false)
  const [promoteError, setPromoteError] = useState<string | null>(null)
  const [calendarAccommodationId, setCalendarAccommodationId] = useState<number | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({})

  const fetchAllData = useCallback(async () => {
    setIsFetching(true)
    setFetchError(null)
    try {
      const [accs, res, pay] = await Promise.all([
        fetchAll<HostAccommodationItem>("/accommodations/my"),
        fetchAll<HostReservationItem>("/reservations/host"),
        fetchAll<HostPayoutItem>("/payments/host/payouts"),
      ])
      setAccommodations(accs)
      setReservations(res)
      setPayouts(pay)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setFetchError(err.detail || err.message || "بارگذاری داشبورد میزبان با خطا مواجه شد.")
      } else {
        setFetchError("بارگذاری داشبورد میزبان با خطا مواجه شد.")
      }
    } finally {
      setIsFetching(false)
    }
  }, [])

  useEffect(() => {
    if (!token || !isHost) {
      return
    }
    // Deferred via setTimeout so the fetch's state updates happen after
    // mount (see react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      void fetchAllData()
    }, 0)

    return () => clearTimeout(timer)
  }, [token, isHost, fetchAllData])

  const handleBecomeHost = async () => {
    setPromoteError(null)
    setIsPromoting(true)
    try {
      await becomeHost()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPromoteError(err.detail || err.message || "خطایی در ارتقای نقش کاربری رخ داد.")
      } else {
        setPromoteError("خطایی در ارتقای نقش کاربری رخ داد.")
      }
    } finally {
      setIsPromoting(false)
    }
  }

  if (isLoading) {
    return <HostDashboardSkeleton />
  }

  if (!token) {
    return (
      <main className="container mx-auto px-4 py-16 text-right" dir="rtl">
        <Card className="max-w-md mx-auto text-center p-8 rounded-2xl border border-border shadow-sm">
          <CardContent className="space-y-6 pt-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">داشبورد میزبان</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                برای مدیریت اقامتگاه‌ها و مشاهده رزروها و تسویه‌ها، لطفاً وارد حساب کاربری خود شوید.
              </p>
            </div>
            <Button onClick={openOtpModal} className="w-full gap-2 font-bold py-5">
              <LogIn className="w-4 h-4" />
              <span>ورود یا ثبت‌نام</span>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!isHost) {
    return (
      <main className="container mx-auto px-4 py-16 text-right" dir="rtl">
        <Card className="max-w-md mx-auto text-center p-8 rounded-2xl border border-border shadow-sm">
          <CardContent className="space-y-6 pt-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">میزبان شوید</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                برای دسترسی به داشبورد میزبان و ثبت اقامتگاه، ابتدا حساب کاربری خود را به میزبان ارتقا دهید.
              </p>
            </div>
            {promoteError && (
              <Alert variant="destructive" className="text-right">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle>خطا</AlertTitle>
                <AlertDescription>{promoteError}</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={handleBecomeHost}
              disabled={isPromoting}
              className="w-full gap-2 font-bold py-5"
            >
              <Sparkles className="w-4 h-4" />
              <span>میزبان شوید (ارتقای حساب)</span>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 space-y-6 text-right" dir="rtl">
      <header className="space-y-1 pb-2 border-b border-border/60">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">داشبورد میزبان</h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
          اقامتگاه‌ها، رزروهای دریافتی و گزارش مالی خود را در یکجا مدیریت کنید.
        </p>
      </header>

      {fetchError && (
        <Alert variant="destructive" className="text-right">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>خطا</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="accommodations" className="space-y-6">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="accommodations" className="gap-1.5">
            <Building2 className="w-4 h-4" />
            <span>اقامتگاه‌های من</span>
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-1.5">
            <CalendarDays className="w-4 h-4" />
            <span>رزروهای دریافتی</span>
          </TabsTrigger>
          <TabsTrigger value="payouts" className="gap-1.5">
            <Wallet className="w-4 h-4" />
            <span>گزارش مالی و تسویه</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accommodations" className="space-y-4">
          {isFetching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-3 rounded-2xl border border-border p-3">
                  <Skeleton className="aspect-[16/10] w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : accommodations.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <p className="text-sm text-muted-foreground">
                هنوز اقامتگاهی ثبت نکرده‌اید.
              </p>
              <Button onClick={() => router.push("/host/new")} className="gap-2 font-bold">
                <Plus className="w-4 h-4" />
                <span>ثبت اقامتگاه جدید</span>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {accommodations.map((acc) => (
                <Card key={acc.id} className="rounded-2xl overflow-hidden">
                  <div className="relative aspect-[16/10] w-full bg-muted/60">
                    {acc.cover_image && !imageErrors[acc.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={acc.cover_image}
                        alt={acc.title}
                        onError={() =>
                          setImageErrors((prev) => ({ ...prev, [acc.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                        <Compass className="w-8 h-8 opacity-40 mb-1" />
                        <span className="text-xs font-medium">بدون تصویر</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <Badge variant={acc.is_active ? "default" : "secondary"}>
                        {acc.is_active ? "فعال" : "غیرفعال"}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="space-y-2 p-4">
                    <h2 className="font-bold text-foreground">{acc.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {acc.city?.name || "—"}
                      {acc.city?.province?.name ? ` (${acc.city.province.name})` : ""}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-price font-bold">
                        {formatToman(acc.base_price)}
                        <span className="text-xs font-medium text-muted-foreground mr-1">
                          تومان / شب
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        {acc.average_rating !== null
                          ? new Intl.NumberFormat("fa-IR", {
                              maximumFractionDigits: 1,
                            }).format(acc.average_rating)
                          : "بدون امتیاز"}
                        {acc.reviews_count > 0 && ` (${formatCount(acc.reviews_count)})`}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCalendarAccommodationId(acc.id)
                        setIsCalendarOpen(true)
                      }}
                      className="w-full gap-2 font-bold"
                    >
                      <CalendarDays className="w-4 h-4" />
                      <span>تقویم سریع</span>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reservations" className="space-y-3">
          {isFetching ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : reservations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              هنوز رزروی دریافت نکرده‌اید.
            </p>
          ) : (
            reservations.map((res) => (
              <Card key={res.id} className="rounded-2xl">
                <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                  <div className="space-y-1">
                    <h2 className="font-bold text-foreground">
                      {res.accommodation_title || `اقامتگاه #${formatCount(res.accommodation_id)}`}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {formatPersianDate(res.check_in)} تا {formatPersianDate(res.check_out)}
                      {" • "}
                      {formatCount(res.guests_count)} مهمان
                      {" • "}
                      {formatCount(res.total_nights)} شب
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-price font-bold text-sm">
                      {formatToman(res.total_price)}
                      <span className="text-xs font-medium text-muted-foreground mr-1">تومان</span>
                    </span>
                    <Badge variant={res.status === "cancelled" ? "secondary" : "default"}>
                      {RESERVATION_STATUS_LABEL[res.status] || res.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="payouts">
          <PayoutLedger payouts={payouts} reservations={reservations} />
        </TabsContent>
      </Tabs>

      {/* Floating action button */}
      <Button
        type="button"
        onClick={() => router.push("/host/new")}
        className="fixed bottom-6 end-6 z-40 gap-2 font-bold shadow-lg h-12 px-5 rounded-full"
      >
        <Plus className="w-5 h-5" />
        <span>ثبت اقامتگاه جدید</span>
      </Button>

      <QuickCalendar
        accommodationId={calendarAccommodationId}
        open={isCalendarOpen}
        onClose={() => {
          setIsCalendarOpen(false)
          setCalendarAccommodationId(null)
        }}
        onSuccess={() => void fetchAllData()}
      />
    </main>
  )
}
