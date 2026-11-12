"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  Building,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  LogIn,
  Luggage,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Star,
  Users,
  XCircle,
} from "lucide-react"

import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { formatPersianDate, toPersianDigits } from "@/lib/format-fa"
import { getCancellationPolicyLabel } from "@/lib/cancellation-policy"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { HostCard } from "@/components/accommodation/host-card"
import { TripStatusBadge } from "@/components/trips/trip-status-badge"
import { useTripPermissions } from "@/components/trips/trip-permissions"
import { ChatDrawer } from "@/components/trips/chat-drawer"
import { ReviewDialog } from "@/components/trips/review-dialog"
import { CancellationModal } from "@/components/trips/cancellation-modal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { computeCheckoutBreakdown, formatFaPrice } from "@/types/checkout"
import type { TripReservationItem } from "@/types/trips"
import type { AccommodationDetailData } from "@/types/detail"

interface TripDetailPageProps {
  params: Promise<{ id: string }>
}

export default function TripDetailPage({ params }: TripDetailPageProps) {
  const resolvedParams = React.use(params)
  const reservationId = Number(resolvedParams.id)
  const isInvalidId =
    !reservationId ||
    Number.isNaN(reservationId) ||
    !Number.isInteger(reservationId) ||
    reservationId <= 0

  const { token, isLoading: isAuthLoading, openOtpModal } = useAuth()

  const [reservation, setReservation] = React.useState<TripReservationItem | null>(null)
  const [accommodation, setAccommodation] =
    React.useState<AccommodationDetailData | null>(null)
  const [isLoading, setIsLoading] = React.useState<boolean>(!isInvalidId)
  const [errorStatus, setErrorStatus] = React.useState<number | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    if (isAuthLoading || !token || isInvalidId) return

    let isCurrent = true

    const fetchData = async () => {
      setIsLoading(true)
      setErrorStatus(null)
      setErrorMessage(null)

      try {
        const data = await apiClient.get<TripReservationItem>(
          `/reservations/${reservationId}`
        )
        if (!isCurrent) return
        setReservation(data)
        setAccommodation(null)

        // Accommodation details enrich the invoice-style breakdown, host card
        // and cancellation policy. They can legitimately 404 (inactive stay),
        // so a failure here never blocks the reservation itself.
        try {
          const stay = await apiClient.get<AccommodationDetailData>(
            `/accommodations/${data.accommodation_id}`
          )
          if (isCurrent) setAccommodation(stay)
        } catch {
          // Keep the reservation-only view.
        }

        if (isCurrent) setIsLoading(false)
      } catch (err: unknown) {
        if (!isCurrent) return
        setIsLoading(false)
        if (err instanceof ApiError) {
          setErrorStatus(err.status)
          setErrorMessage(err.detail || err.message)
        } else {
          setErrorStatus(500)
          setErrorMessage("خطا در بارگذاری اطلاعات رزرو. لطفاً دوباره تلاش کنید.")
        }
      }
    }

    void fetchData()

    return () => {
      isCurrent = false
    }
  }, [isAuthLoading, token, reservationId, isInvalidId, reloadKey])

  const handleCancelled = (
    id: number,
    refundAmount?: number | string,
    penaltyAmount?: number | string
  ) => {
    setReservation((prev) =>
      prev && prev.id === id
        ? {
            ...prev,
            status: "cancelled",
            refund_amount: refundAmount ?? prev.refund_amount,
            penalty_amount: penaltyAmount ?? prev.penalty_amount,
            cancelled_at: new Date().toISOString(),
          }
        : prev
    )
  }

  const retry = () => setReloadKey((prev) => prev + 1)

  if (isInvalidId) {
    return (
      <StatusScreen
        title="این رزرو پیدا نشد"
        description="شناسه رزرو معتبر نیست. از دفتر سفرها رزرو موردنظر را انتخاب کنید."
      />
    )
  }

  if (isAuthLoading) {
    return <DetailSkeleton />
  }

  if (!token) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-16 sm:py-20">
        <div className="rounded-3xl border border-line/80 bg-paper-card p-8 shadow-soft">
          <EmptyState
            icon={Luggage}
            title="برای دیدن جزئیات رزرو وارد شوید"
            description="قرارداد، فاکتور، گفتگو با میزبان و شرایط لغو این سفر پس از ورود به حساب مهمانی نمایش داده می‌شوند."
            action={
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <Button onClick={openOtpModal} className="gap-2">
                  <LogIn className="size-4" />
                  <span>ورود با شماره همراه</span>
                </Button>
                <Button asChild variant="outline" className="border-line bg-transparent">
                  <Link href={`/login?next=/trips/${reservationId}`}>صفحه ورود</Link>
                </Button>
              </div>
            }
          />
        </div>
      </main>
    )
  }

  if (isLoading) {
    return <DetailSkeleton />
  }

  if (errorStatus === 403) {
    return (
      <StatusScreen
        title="این رزرو متعلق به حساب شما نیست"
        description="دسترسی به این رزرو برای حساب کاربری فعلی مجاز نیست. اگر با حساب دیگری وارد شده‌اید، دوباره وارد شوید."
      />
    )
  }

  if (errorStatus === 404) {
    return (
      <StatusScreen
        title="رزرو پیدا نشد"
        description="ممکن است این رزرو حذف شده باشد یا شناسه آن درست نباشد."
      />
    )
  }

  if (errorStatus === 401 || !reservation) {
    return (
      <StatusScreen
        title="خطا در دریافت رزرو"
        description={errorMessage || "اتصال به سرور برقرار نشد. لطفاً دوباره تلاش کنید."}
        onRetry={retry}
      />
    )
  }

  return (
    <TripDetailView
      reservation={reservation}
      accommodation={accommodation}
      onCancelled={handleCancelled}
      onReviewSubmitted={retry}
    />
  )
}

function TripDetailView({
  reservation,
  accommodation,
  onCancelled,
  onReviewSubmitted,
}: {
  reservation: TripReservationItem
  accommodation: AccommodationDetailData | null
  onCancelled: (
    reservationId: number,
    refundAmount?: number | string,
    penaltyAmount?: number | string
  ) => void
  onReviewSubmitted: () => void
}) {
  const { canCancel, canReview, canChat } = useTripPermissions(reservation)
  const [isChatOpen, setIsChatOpen] = React.useState(false)
  const [isReviewOpen, setIsReviewOpen] = React.useState(false)
  const [isCancelOpen, setIsCancelOpen] = React.useState(false)
  const [imageError, setImageError] = React.useState(false)

  const title =
    reservation.accommodation_title ||
    `اقامتگاه کد ${toPersianDigits(reservation.accommodation_id)}`
  const locationText =
    [accommodation?.city?.province?.name, accommodation?.city?.name, reservation.province, reservation.city]
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index)
      .join("، ")
  const coverImage =
    reservation.accommodation_image ||
    accommodation?.images?.find((image) => image.is_cover)?.image_url ||
    accommodation?.images?.[0]?.image_url ||
    null
  const bookingCode = `JBM-${toPersianDigits(reservation.id)}`
  const nightsText = `${toPersianDigits(reservation.total_nights)} شب`
  const guestsText = `${toPersianDigits(reservation.guests_count)} نفر`

  const breakdown = React.useMemo(
    () =>
      computeCheckoutBreakdown(
        {
          total_price: reservation.total_price,
          total_nights: reservation.total_nights,
          coupon_code: reservation.coupon_code,
        },
        accommodation
          ? {
              cleaning_fee: accommodation.cleaning_fee,
              base_price: accommodation.base_price,
            }
          : null
      ),
    [reservation, accommodation]
  )

  const nightlyRate =
    accommodation && accommodation.base_price > 0
      ? accommodation.base_price
      : breakdown.totalPayable > 0 && reservation.total_nights > 0
        ? Math.round(breakdown.baseTotal / reservation.total_nights)
        : 0

  const policyLabel = getCancellationPolicyLabel(accommodation?.cancellation_policy)

  return (
    <div className="min-h-screen bg-paper">
      <PageHeader
        backHref="/trips"
        backLabel="بازگشت به دفتر سفرها"
        eyebrow="جزئیات رزرو"
        title={title}
        description={`${locationText || "ایران"} · ${nightsText} · ${guestsText}`}
        actions={
          <>
            <TripStatusBadge trip={reservation} className="px-3 py-1 text-xs" />
            {(reservation.status === "confirmed" ||
              reservation.status === "completed") && (
              <Button asChild variant="outline" className="gap-2 border-line bg-transparent">
                <Link href={`/invoice/${reservation.id}`}>
                  <FileText className="size-4" />
                  <span>فاکتور رسمی</span>
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_370px] lg:px-8">
        <div className="space-y-6">
          {/* Stay cover */}
          <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-line/80 bg-paper-deep shadow-soft">
            {coverImage && !imageError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImage}
                alt={title}
                onError={() => setImageError(true)}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-3 bg-paper-deep text-brick">
                <span className="grid size-16 place-items-center rounded-b-2xl rounded-t-full border border-line/70 bg-paper-card">
                  <Building className="size-8 stroke-[1.4]" />
                </span>
                <span className="text-xs font-medium text-ink-soft">
                  تصویری برای این اقامتگاه ثبت نشده است
                </span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-night/70 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4 sm:p-5">
              <div>
                <p className="text-[10px] font-bold tracking-[0.18em] text-night-foreground/70">
                  کد رزرو
                </p>
                <p
                  className="mt-1 font-mono text-sm font-bold tabular-nums text-night-foreground"
                  dir="ltr"
                >
                  {bookingCode}
                </p>
              </div>
              <Link
                href={`/accommodations/${reservation.accommodation_id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-night-foreground/25 bg-night/35 px-3 py-1.5 text-[11px] font-semibold text-night-foreground backdrop-blur transition-colors hover:bg-night/55"
              >
                صفحه اقامتگاه
                <ArrowLeft className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Stay + stay dates */}
          <Card className="rounded-2xl border-line/80 bg-paper-card shadow-soft">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold tracking-[0.18em] text-brick">
                    اقامتگاه شما
                  </p>
                  <Link
                    href={`/accommodations/${reservation.accommodation_id}`}
                    className="mt-2 block text-xl font-black leading-8 text-ink transition-colors hover:text-brick"
                  >
                    {title}
                  </Link>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                    <MapPin className="size-3.5 text-brick" />
                    {locationText || "ایران"}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-line bg-paper-deep/60 text-[11px] text-ink-soft"
                >
                  {policyLabel}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line/70 bg-paper-deep/40 p-4">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
                    <CalendarDays className="size-3.5 text-brick" />
                    ورود
                  </span>
                  <p className="mt-1.5 text-sm font-bold tabular-nums text-ink">
                    {formatPersianDate(reservation.check_in)}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-soft">
                    <Clock className="size-3" />
                    از ساعت {formatTime(accommodation?.check_in_time || "14:00")}
                  </p>
                </div>

                <div className="rounded-xl border border-line/70 bg-paper-deep/40 p-4">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
                    <CalendarDays className="size-3.5 text-trust" />
                    خروج
                  </span>
                  <p className="mt-1.5 text-sm font-bold tabular-nums text-ink">
                    {formatPersianDate(reservation.check_out)}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-soft">
                    <Clock className="size-3" />
                    تا ساعت {formatTime(accommodation?.check_out_time || "12:00")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line/70 pt-4 text-xs text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <Users className="size-4 text-brick" />
                  {guestsText} مهمان
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-brick" />
                  {nightsText} اقامت
                </span>
                <span className="tabular-nums">
                  تاریخ ثبت رزرو: {formatPersianDate(reservation.created_at)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Price breakdown */}
          <Card className="rounded-2xl border-line/80 bg-paper-card shadow-soft">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold tracking-[0.18em] text-brick">
                    صورت‌حساب اقامت
                  </p>
                  <h2 className="mt-1 text-lg font-black text-ink">ریز هزینه‌ها</h2>
                </div>
                <span className="grid size-10 place-items-center rounded-b-xl rounded-t-full bg-brick/10 text-brick">
                  <FileText className="size-4" />
                </span>
              </div>

              <div className="space-y-3 rounded-xl border border-line/70 bg-paper-deep/30 p-4 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink-soft">
                    اقامت {nightsText}
                    {nightlyRate > 0 ? (
                      <span className="mr-1 text-ink-soft/80">
                        (هر شب {formatFaPrice(nightlyRate)} تومان)
                      </span>
                    ) : null}
                  </span>
                  <span className="font-semibold tabular-nums text-ink">
                    {formatFaPrice(breakdown.baseTotal)} تومان
                  </span>
                </div>

                {breakdown.cleaningFee > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-ink-soft">هزینه نظافت و آماده‌سازی</span>
                    <span className="font-semibold tabular-nums text-ink">
                      {formatFaPrice(breakdown.cleaningFee)} تومان
                    </span>
                  </div>
                )}

                {reservation.coupon_code && breakdown.discountAmount > 0 && (
                  <div className="flex items-center justify-between gap-3 text-trust">
                    <span>تخفیف کد {reservation.coupon_code}</span>
                    <span className="font-bold tabular-nums">
                      - {formatFaPrice(breakdown.discountAmount)} تومان
                    </span>
                  </div>
                )}

                <Separator className="bg-line" />

                <div className="flex items-center justify-between gap-3 text-sm font-black">
                  <span className="text-ink">مجموع پرداختی</span>
                  <span className="tabular-nums text-brick">
                    {formatFaPrice(breakdown.totalPayable)} تومان
                  </span>
                </div>
              </div>

              {!accommodation && (
                <p className="rounded-xl border border-gold/25 bg-gold/10 p-3 text-[11px] leading-6 text-ink-soft">
                  جزئیات هزینه نظافت و نرخ شبانه این اقامتگاه در دسترس نبود؛ مبلغ کل از
                  اطلاعات ثبت‌شده رزرو نمایش داده می‌شود.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Host + policy */}
          {accommodation ? (
            <HostCard
              host={accommodation.host}
              checkInTime={accommodation.check_in_time}
              checkOutTime={accommodation.check_out_time}
              cancellationPolicy={accommodation.cancellation_policy}
              cancellationFreeHours={accommodation.cancellation_free_hours}
              cancellationPenaltyPercent={accommodation.cancellation_penalty_percent}
              rules={accommodation.rules}
            />
          ) : (
            <Card className="rounded-2xl border-line/80 bg-paper-card shadow-soft">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-b-xl rounded-t-full bg-trust/10 text-trust">
                    <MessageSquare className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">هماهنگی با میزبان</p>
                    <p className="mt-0.5 text-[11px] text-ink-soft">
                      اطلاعات تفصیلی میزبان در دسترس نیست؛ از گفتگوی مستقیم استفاده کنید.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-line bg-transparent"
                  disabled={!canChat}
                  onClick={() => setIsChatOpen(true)}
                >
                  <MessageSquare className="size-3.5" />
                  گفتگو با میزبان
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sticky booking ledger + actions */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden rounded-2xl border-line/80 bg-paper-card shadow-dock">
            <div className="border-b border-line/70 bg-paper-deep/40 px-5 py-4">
              <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-brick">
                <span className="h-px w-6 bg-brick/45" />
                خلاصه رزرو
              </p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <span className="block text-[11px] text-ink-soft">مبلغ کل</span>
                  <span className="text-2xl font-black tabular-nums text-ink">
                    {formatFaPrice(breakdown.totalPayable)}
                  </span>
                  <span className="mr-1 text-[11px] text-ink-soft">تومان</span>
                </div>
                <TripStatusBadge trip={reservation} />
              </div>
            </div>

            <CardContent className="space-y-4 p-5">
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-soft">تاریخ ورود</span>
                  <span className="font-semibold tabular-nums text-ink">
                    {formatPersianDate(reservation.check_in)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-soft">تاریخ خروج</span>
                  <span className="font-semibold tabular-nums text-ink">
                    {formatPersianDate(reservation.check_out)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-soft">مدت اقامت</span>
                  <span className="font-semibold text-ink">{nightsText}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-soft">تعداد مهمان</span>
                  <span className="font-semibold text-ink">{guestsText}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-soft">کد رزرو</span>
                  <span className="font-mono font-semibold tabular-nums text-ink" dir="ltr">
                    {bookingCode}
                  </span>
                </div>
              </div>

              <Separator className="bg-line" />

              <div className="space-y-2">
                {reservation.status === "pending" && (
                  <Button asChild className="w-full gap-2">
                    <Link href={`/checkout/${reservation.id}`}>
                      <CreditCard className="size-4" />
                      ادامه پرداخت
                    </Link>
                  </Button>
                )}

                {(reservation.status === "confirmed" ||
                  reservation.status === "completed") && (
                  <Button asChild className="w-full gap-2">
                    <Link href={`/invoice/${reservation.id}`}>
                      <FileText className="size-4" />
                      مشاهده و چاپ فاکتور
                    </Link>
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full gap-2 border-line bg-transparent"
                  disabled={!canChat}
                  onClick={() => setIsChatOpen(true)}
                >
                  <MessageSquare className="size-4" />
                  گفتگو با میزبان
                </Button>

                {canReview && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-brick/35 text-brick hover:bg-brick/5 hover:text-brick"
                    onClick={() => setIsReviewOpen(true)}
                  >
                    <Star className="size-4 fill-gold text-gold" />
                    ثبت نظر و امتیاز
                  </Button>
                )}

                {canCancel && (
                  <Button
                    variant="ghost"
                    className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setIsCancelOpen(true)}
                  >
                    <XCircle className="size-4" />
                    لغو رزرو
                  </Button>
                )}
              </div>

              {reservation.status === "cancelled" && (
                <div className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-[11px] leading-6 text-destructive">
                  <p className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="size-3.5" />
                    این رزرو لغو شده است
                  </p>
                  {reservation.cancellation_reason && (
                    <p>علت: {reservation.cancellation_reason}</p>
                  )}
                  {reservation.refund_amount !== null &&
                    reservation.refund_amount !== undefined && (
                      <p className="tabular-nums">
                        مبلغ مستردشده: {formatFaPrice(reservation.refund_amount)} تومان
                      </p>
                    )}
                  {reservation.penalty_amount !== null &&
                    reservation.penalty_amount !== undefined && (
                      <p className="tabular-nums">
                        جریمه لغو: {formatFaPrice(reservation.penalty_amount)} تومان
                      </p>
                    )}
                </div>
              )}

              {reservation.status === "completed" && (
                <p className="flex items-center gap-1.5 rounded-xl border border-trust/25 bg-trust/10 p-3 text-[11px] leading-6 text-trust">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  این اقامت با موفقیت به پایان رسیده است. خاطره‌تان را با دیگران به اشتراک بگذارید.
                </p>
              )}

              <p className="flex items-start gap-1.5 border-t border-line/70 pt-3 text-[10px] leading-5 text-ink-soft">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-trust" />
                پشتیبانی آشیانک در تمام مدت اقامت همراه شماست. برای هماهنگی ورود، از گفتگوی
                مستقیم با میزبان استفاده کنید.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <ChatDrawer
        trip={reservation}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      <ReviewDialog
        trip={reservation}
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onReviewSubmitted={() => {
          onReviewSubmitted()
        }}
      />

      <CancellationModal
        trip={reservation}
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onCancelled={onCancelled}
      />
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full rounded-md" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_370px]">
        <div className="space-y-6">
          <Skeleton className="aspect-[16/9] w-full rounded-3xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    </div>
  )
}

function StatusScreen({
  title,
  description,
  onRetry,
}: {
  title: string
  description: string
  onRetry?: () => void
}) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-16 sm:py-20">
      <div className="rounded-3xl border border-line/80 bg-paper-card p-8 shadow-soft">
        <EmptyState
          icon={Luggage}
          title={title}
          description={description}
          action={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild className="gap-1.5">
                <Link href="/trips">
                  <ArrowLeft className="size-4" />
                  بازگشت به سفرها
                </Link>
              </Button>
              {onRetry && (
                <Button
                  variant="outline"
                  onClick={onRetry}
                  className="border-line bg-transparent"
                >
                  تلاش مجدد
                </Button>
              )}
            </div>
          }
        />
      </div>
    </main>
  )
}

function formatTime(value: string): string {
  if (!value) return "--:--"
  return value.slice(0, 5).replace(/\d/g, (digit) => toPersianDigits(Number(digit)))
}
