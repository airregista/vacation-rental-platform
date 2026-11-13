"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertCircle, Building2, CreditCard, Info, Lock, RotateCcw, XCircle } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { toPersianDigits } from "@/lib/format-fa"
import { getReservationCode } from "@/lib/reservation-code"
import {
  PaymentResultFooterLinks,
  PaymentResultSkeleton,
  PaymentResultView,
} from "@/components/checkout/payment-result-view"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatFaPrice } from "@/lib/checkout-format"
import type { CheckoutAccommodationInfo, ReservationDetail } from "@/types/checkout"

const GENERIC_FAILURE_REASON =
  "پرداخت شما انجام نشد. اگر مبلغی از حساب شما کسر شده باشد، حداکثر ظرف ۷۲ ساعت به حساب شما بازگردانده می‌شود."

const STATUS_LABELS: Record<ReservationDetail["status"], string> = {
  pending: "در انتظار پرداخت",
  confirmed: "پرداخت‌شده",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
}

/**
 * Backend/query-string reasons are mixed Persian/English. Never surface a raw
 * English message to the guest; map known terminal reasons to Persian.
 */
function getPersianFailureReason(raw: string | null): string {
  if (!raw) return GENERIC_FAILURE_REASON

  const value = raw.trim()
  if (!value) return GENERIC_FAILURE_REASON

  // Reasons produced by the payment modal are already Persian.
  if (/[\u0600-\u06FF]/.test(value)) {
    return value.length > 220 ? `${value.slice(0, 220)}…` : value
  }

  const lower = value.toLowerCase()

  if (lower.includes("expire") || lower.includes("timeout") || lower.includes("ttl")) {
    return "مهلت پرداخت ۳۰ دقیقه‌ای این رزرو به پایان رسیده است و تاریخ‌های انتخابی آزاد شدند."
  }
  if (
    lower.includes("concurrent") ||
    lower.includes("conflict") ||
    lower.includes("occupied") ||
    lower.includes("no longer available")
  ) {
    return "متاسفانه این اقامتگاه در این بازه تاریخی هم‌اکنون توسط کاربر دیگری رزرو شد."
  }
  if (lower.includes("no longer pending") || lower.includes("current status")) {
    return "این رزرو دیگر در وضعیت قابل پرداخت نیست. برای ادامه، یک رزرو جدید ثبت کنید."
  }
  if (lower.includes("invalid tracking")) {
    return "اطلاعات تراکنش با درگاه بانکی مطابقت ندارد. لطفا دوباره تلاش کنید."
  }
  if (lower.includes("already") || lower.includes("failed")) {
    return "تراکنش بانکی تایید نشد یا در وضعیت ناموفق قرار دارد."
  }
  if (lower.includes("forbidden") || lower.includes("access")) {
    return "شما دسترسی پرداخت این رزرو را ندارید."
  }
  if (lower.includes("not found")) {
    return "رزرو مورد نظر یافت نشد."
  }

  return GENERIC_FAILURE_REASON
}

interface CheckoutFailedPageProps {
  params: Promise<{ id: string }>
}

export default function CheckoutFailedPage({ params }: CheckoutFailedPageProps) {
  const resolvedParams = React.use(params)
  const reservationId = Number(resolvedParams.id)

  return (
    <React.Suspense fallback={<PaymentResultSkeleton />}>
      <FailedPaymentResult reservationId={reservationId} />
    </React.Suspense>
  )
}

function FailedPaymentResult({ reservationId }: { reservationId: number }) {
  const searchParams = useSearchParams()
  const reason = getPersianFailureReason(searchParams.get("reason"))

  const isValidId = Number.isInteger(reservationId) && reservationId > 0
  const { isAuthenticated, isLoading: isAuthLoading, openOtpModal } = useAuth()

  const [reservation, setReservation] = React.useState<ReservationDetail | null>(null)
  const [accommodation, setAccommodation] = React.useState<CheckoutAccommodationInfo | null>(null)
  const [isLoading, setIsLoading] = React.useState(isValidId)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [reloadTrigger, setReloadTrigger] = React.useState(0)

  React.useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !isValidId) return

    let isCancelled = false

    const load = async () => {
      setIsLoading(true)
      setFetchError(null)
      setReservation(null)
      setAccommodation(null)

      try {
        const data = await apiClient.get<ReservationDetail>(`/reservations/${reservationId}`)
        if (isCancelled) return
        setReservation(data)

        // The stay details are a nice-to-have here; never let a 404 block the
        // failure screen itself.
        try {
          const stay = await apiClient.get<CheckoutAccommodationInfo>(
            `/accommodations/${data.accommodation_id}`,
          )
          if (!isCancelled) setAccommodation(stay)
        } catch {
          // Keep the reservation-only view.
        }
      } catch (err) {
        if (isCancelled) return

        if (err instanceof ApiError) {
          if (err.status === 404) {
            setFetchError("رزرو مورد نظر یافت نشد.")
          } else if (err.status === 403) {
            setFetchError("شما دسترسی مشاهده این رزرو را ندارید.")
          } else if (err.status === 401) {
            setFetchError("نشست شما منقضی شده است. لطفا دوباره وارد شوید.")
          } else {
            setFetchError("خطا در دریافت اطلاعات رزرو. لطفا دوباره تلاش کنید.")
          }
        } else {
          setFetchError("خطا در دریافت اطلاعات رزرو. لطفا دوباره تلاش کنید.")
        }
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [isAuthLoading, isAuthenticated, isValidId, reservationId, reloadTrigger])

  const handleRetry = () => {
    setIsLoading(true)
    setFetchError(null)
    setReloadTrigger((prev) => prev + 1)
  }

  if (isValidId && isAuthLoading) {
    return <PaymentResultSkeleton />
  }

  if (isValidId && isAuthenticated && isLoading) {
    return <PaymentResultSkeleton />
  }

  const accommodationTitle = reservation
    ? accommodation?.title ||
      reservation.accommodation_title ||
      `اقامتگاه کد ${toPersianDigits(reservation.accommodation_id)}`
    : null
  const reservationCode = reservation ? getReservationCode(reservation.id) : undefined
  const statusLabel = reservation ? STATUS_LABELS[reservation.status] : null

  let primaryAction: React.ReactNode = null

  if (!isAuthenticated && isValidId) {
    primaryAction = (
      <Button onClick={openOtpModal} className="h-11 gap-2">
        <Lock className="size-4" />
        ورود به حساب
      </Button>
    )
  } else if (fetchError && isValidId) {
    primaryAction = (
      <Button onClick={handleRetry} className="h-11 gap-2">
        <RotateCcw className="size-4" />
        تلاش مجدد
      </Button>
    )
  } else if (reservation) {
    primaryAction =
      reservation.status === "pending" ? (
        <Button asChild className="h-11 gap-2">
          <Link href={`/checkout/${reservation.id}`}>
            <CreditCard className="size-4" />
            تلاش مجدد پرداخت
          </Link>
        </Button>
      ) : (
        <Button asChild className="h-11 gap-2">
          <Link href={`/accommodations/${reservation.accommodation_id}`}>
            <Building2 className="size-4" />
            رزرو مجدد
          </Link>
        </Button>
      )
  }

  return (
    <PaymentResultView
      variant="failed"
      icon={XCircle}
      eyebrow="تراکنش ناموفق"
      title="پرداخت انجام نشد"
      description={reason}
      code={reservationCode}
      actions={
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          {primaryAction}
          <Button asChild variant="outline" className="h-11 border-line bg-paper-card">
            <Link href="/trips">سفرهای من</Link>
          </Button>
          <Button asChild variant="ghost" className="h-11">
            <Link href="/">صفحه اصلی</Link>
          </Button>
        </div>
      }
      footer={<PaymentResultFooterLinks />}
    >
      {!isValidId ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>شناسه رزرو نامعتبر است</AlertTitle>
          <AlertDescription className="mt-1">شناسه ارسال‌شده برای رزرو صحیح نیست.</AlertDescription>
        </Alert>
      ) : null}

      {fetchError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>اطلاعات رزرو در دسترس نیست</AlertTitle>
          <AlertDescription className="mt-1">{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      {reservation ? (
        <Card className="rounded-2xl border-line/70 bg-paper shadow-none">
          <div className="flex items-start gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brick-soft/50 text-brick-deep">
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-[11px] font-semibold text-ink-soft">اقامتگاه</p>
              <p className="truncate text-sm font-black text-ink">{accommodationTitle}</p>
            </div>
          </div>

          <Separator className="bg-line/70" />

          <dl className="grid grid-cols-2 gap-3 p-4 text-xs">
            <div className="space-y-1">
              <dt className="text-[11px] text-ink-soft">مبلغ رزرو</dt>
              <dd className="text-base font-black tabular-nums text-brick">
                {formatFaPrice(reservation.total_price)}
                <span className="ms-1 text-xs font-bold text-ink-soft">تومان</span>
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-[11px] text-ink-soft">وضعیت رزرو</dt>
              <dd className="font-bold text-ink">{statusLabel}</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      <Alert className="border-gold/40 bg-gold-soft/40 text-ink [&>svg]:text-gold">
        <Info className="size-4" />
        <AlertTitle>بازگشت وجه در صورت کسر</AlertTitle>
        <AlertDescription className="mt-1 leading-6 text-ink-soft">
          اگر مبلغی از حساب شما کسر شده باشد، حداکثر ظرف ۷۲ ساعت به‌صورت خودکار به حساب شما
          بازگردانده می‌شود. برای پیگیری بیشتر با پشتیبانی آشیانک تماس بگیرید.
        </AlertDescription>
      </Alert>
    </PaymentResultView>
  )
}
