"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Info,
  Lock,
  MapPin,
  Moon,
  RotateCcw,
  Users,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { formatPersianDate, toPersianDigits } from "@/lib/format-fa"
import { findLatestSuccessfulPayment } from "@/lib/pagination"
import { cn } from "@/lib/utils"
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
import type {
  CheckoutAccommodationInfo,
  PaymentResponse,
  ReservationDetail,
} from "@/types/checkout"

const STATUS_LABELS: Record<ReservationDetail["status"], string> = {
  pending: "در انتظار پرداخت",
  confirmed: "پرداخت‌شده",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
}

function getReservationCode(id: number): string {
  return `MHM-${toPersianDigits(String(id).padStart(5, "0"))}`
}

interface CheckoutSuccessPageProps {
  params: Promise<{ id: string }>
}

export default function CheckoutSuccessPage({
  params,
}: CheckoutSuccessPageProps) {
  const resolvedParams = React.use(params)
  const reservationId = Number(resolvedParams.id)
  const isValidId = Number.isInteger(reservationId) && reservationId > 0

  const { isAuthenticated, isLoading: isAuthLoading, openOtpModal } = useAuth()

  const [reservation, setReservation] =
    React.useState<ReservationDetail | null>(null)
  const [accommodation, setAccommodation] =
    React.useState<CheckoutAccommodationInfo | null>(null)
  const [payment, setPayment] = React.useState<PaymentResponse | null>(null)
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
      setPayment(null)

      try {
        const data = await apiClient.get<ReservationDetail>(
          `/reservations/${reservationId}`
        )
        if (isCancelled) return
        setReservation(data)

        // Accommodation enrichment is optional; payment lookup is paginated
        // because /payments/my is newest-first and a frequent guest may have
        // more than one page of newer payments.
        const [stayResult, paymentResult] = await Promise.allSettled([
          apiClient.get<CheckoutAccommodationInfo>(
            `/accommodations/${data.accommodation_id}`
          ),
          findLatestSuccessfulPayment(data.id),
        ])
        if (isCancelled) return

        if (stayResult.status === "fulfilled") {
          setAccommodation(stayResult.value)
        }
        if (paymentResult.status === "fulfilled") {
          setPayment(paymentResult.value)
        }
      } catch (err) {
        if (isCancelled) return

        if (err instanceof ApiError) {
          if (err.status === 404) {
            setFetchError("رزرو مورد نظر یافت نشد.")
          } else if (err.status === 403) {
            setFetchError("شما دسترسی مشاهده این رزرو را ندارید.")
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

  if (!isValidId) {
    return (
      <PaymentResultView
        variant="neutral"
        icon={AlertCircle}
        title="شناسه رزرو نامعتبر است"
        description="شناسه ارسال‌شده برای رزرو صحیح نیست."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild className="h-11 gap-2">
              <Link href="/">صفحه اصلی</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 border-line bg-paper-card"
            >
              <Link href="/trips">سفرهای من</Link>
            </Button>
          </div>
        }
      />
    )
  }

  if (isAuthLoading) {
    return <PaymentResultSkeleton />
  }

  if (!isAuthenticated) {
    return (
      <PaymentResultView
        variant="neutral"
        icon={Lock}
        title="ورود به حساب کاربری"
        description="برای مشاهده نتیجه پرداخت و جزئیات رزرو، ابتدا وارد حساب کاربری خود شوید."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={openOtpModal} className="h-11 gap-2">
              <Lock className="size-4" />
              ورود / ثبت‌نام سریع
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 border-line bg-paper-card"
            >
              <Link href="/">صفحه اصلی</Link>
            </Button>
          </div>
        }
      />
    )
  }

  if (isLoading) {
    return <PaymentResultSkeleton />
  }

  if (fetchError || !reservation) {
    return (
      <PaymentResultView
        variant="neutral"
        icon={AlertCircle}
        title="اطلاعات رزرو دریافت نشد"
        description={fetchError || "اتصال به سرور برقرار نشد."}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button onClick={handleRetry} className="h-11 gap-2">
              <RotateCcw className="size-4" />
              تلاش مجدد
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 border-line bg-paper-card"
            >
              <Link href="/trips">سفرهای من</Link>
            </Button>
            <Button asChild variant="ghost" className="h-11">
              <Link href="/">صفحه اصلی</Link>
            </Button>
          </div>
        }
      />
    )
  }

  const isPaid =
    reservation.status === "confirmed" || reservation.status === "completed"
  const accommodationTitle =
    accommodation?.title ||
    reservation.accommodation_title ||
    `اقامتگاه کد ${toPersianDigits(reservation.accommodation_id)}`
  const location = [
    accommodation?.city?.province?.name,
    accommodation?.city?.name,
  ]
    .filter(Boolean)
    .join("، ")
  const trackingCode =
    payment?.tracking_code && !/^[0۰]+$/.test(payment.tracking_code)
      ? payment.tracking_code
      : null
  const paidAmount = payment?.amount ?? reservation.total_price
  const reservationCode = getReservationCode(reservation.id)
  const statusLabel = STATUS_LABELS[reservation.status]

  if (!isPaid) {
    return (
      <PaymentResultView
        variant="neutral"
        icon={Info}
        title="این رزرو در وضعیت پرداخت‌شده نیست"
        description={`وضعیت فعلی این رزرو «${statusLabel}» است. اگر پرداخت شما انجام شده، چند لحظه بعد وضعیت را دوباره بررسی کنید.`}
        code={reservationCode}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            {reservation.status === "pending" ? (
              <Button asChild className="h-11 gap-2">
                <Link href={`/checkout/${reservation.id}`}>
                  <CreditCard className="size-4" />
                  ادامه پرداخت
                </Link>
              </Button>
            ) : (
              <Button asChild className="h-11 gap-2">
                <Link href={`/accommodations/${reservation.accommodation_id}`}>
                  <Building2 className="size-4" />
                  رزرو مجدد
                </Link>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleRetry}
              className="h-11 gap-2 border-line bg-paper-card"
            >
              <RotateCcw className="size-4" />
              بررسی مجدد
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 gap-2 border-line bg-paper-card"
            >
              <Link href={`/trips/${reservation.id}`}>
                <ArrowLeft className="size-4" />
                جزئیات سفر
              </Link>
            </Button>
          </div>
        }
        footer={<PaymentResultFooterLinks />}
      >
        <StayDetails
          reservation={reservation}
          accommodationTitle={accommodationTitle}
          location={location}
        />
      </PaymentResultView>
    )
  }

  return (
    <PaymentResultView
      variant="success"
      icon={CheckCircle2}
      eyebrow="پرداخت موفق"
      title="پرداخت با موفقیت انجام شد"
      description="رزرو شما تایید شد و جزئیات اقامت برای شما ارسال شده است. از سفر خود لذت ببرید."
      code={reservationCode}
      brandMark
      actions={
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button asChild className="h-11 gap-2">
            <Link href={`/trips/${reservation.id}`}>
              <ArrowLeft className="size-4" />
              جزئیات سفر
            </Link>
          </Button>
          {payment ? (
            <Button
              asChild
              variant="outline"
              className="h-11 gap-2 border-line bg-paper-card"
            >
              <Link href={`/invoice/${reservation.id}`}>
                <FileText className="size-4" />
                فاکتور رسمی
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled
              className="h-11 gap-2 border-line bg-paper-card"
            >
              <FileText className="size-4" />
              فاکتور رسمی
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            className="h-11 gap-2 border-line bg-paper-card"
          >
            <Link href={`/accommodations/${reservation.accommodation_id}`}>
              <Building2 className="size-4" />
              مشاهده اقامتگاه
            </Link>
          </Button>
        </div>
      }
      footer={<PaymentResultFooterLinks />}
    >
      <StayDetails
        reservation={reservation}
        accommodationTitle={accommodationTitle}
        location={location}
      />

      <Card className="rounded-2xl border-line/70 bg-paper shadow-none">
        <div className="grid sm:grid-cols-2">
          <div className="border-b border-line/70 p-4 sm:border-b-0 sm:border-l">
            <p className="text-[11px] font-semibold text-ink-soft">
              {payment ? "مبلغ پرداخت‌شده" : "مبلغ کل رزرو"}
            </p>
            <p
              className={cn(
                "mt-1 text-xl font-black tabular-nums",
                payment ? "text-trust" : "text-ink"
              )}
            >
              {formatFaPrice(paidAmount)}
              <span className="ms-1 text-xs font-bold text-ink-soft">تومان</span>
            </p>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-semibold text-ink-soft">
              کد پیگیری پرداخت
            </p>
            <p className="mt-1 text-sm font-black tabular-nums text-ink">
              {payment ? (
                trackingCode ? (
                  <bdi dir="ltr">{toPersianDigits(trackingCode)}</bdi>
                ) : (
                  "ثبت نشده"
                )
              ) : (
                "در دسترس نیست"
              )}
            </p>
          </div>
        </div>
      </Card>

      {!payment ? (
        <Alert className="border-gold/40 bg-gold-soft/40 text-ink [&>svg]:text-gold">
          <Info className="size-4" />
          <AlertTitle>فاکتور رسمی هنوز آماده نیست</AlertTitle>
          <AlertDescription className="mt-1 leading-6 text-ink-soft">
            پرداخت موفق این رزرو در سوابق پیدا نشد؛ به همین دلیل فاکتور رسمی
            غیرفعال است. اگر مبلغی از حساب شما کسر شده، لطفا با پشتیبانی آشیانک
            تماس بگیرید.
          </AlertDescription>
        </Alert>
      ) : null}
    </PaymentResultView>
  )
}

function StayDetails({
  reservation,
  accommodationTitle,
  location,
}: {
  reservation: ReservationDetail
  accommodationTitle: string
  location: string
}) {
  return (
    <Card className="rounded-2xl border-line/70 bg-paper shadow-none">
      <div className="flex items-start gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brick-soft/50 text-brick-deep">
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-[11px] font-semibold text-ink-soft">اقامتگاه</p>
          <p className="truncate text-sm font-black text-ink">
            {accommodationTitle}
          </p>
          {location ? (
            <p className="flex items-center gap-1 text-[11px] text-ink-soft">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{location}</span>
            </p>
          ) : null}
        </div>
      </div>

      <Separator className="bg-line/70" />

      <dl className="grid grid-cols-2 gap-x-3 gap-y-4 p-4 text-xs sm:grid-cols-4">
        <div className="space-y-1">
          <dt className="flex items-center gap-1 text-[11px] text-ink-soft">
            <CalendarDays className="size-3.5" />
            ورود
          </dt>
          <dd className="font-bold text-ink">
            {formatPersianDate(reservation.check_in)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="flex items-center gap-1 text-[11px] text-ink-soft">
            <CalendarDays className="size-3.5" />
            خروج
          </dt>
          <dd className="font-bold text-ink">
            {formatPersianDate(reservation.check_out)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="flex items-center gap-1 text-[11px] text-ink-soft">
            <Moon className="size-3.5" />
            مدت اقامت
          </dt>
          <dd className="font-bold text-ink">
            {toPersianDigits(reservation.total_nights)} شب
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="flex items-center gap-1 text-[11px] text-ink-soft">
            <Users className="size-3.5" />
            مهمانان
          </dt>
          <dd className="font-bold text-ink">
            {toPersianDigits(reservation.guests_count)} نفر
          </dd>
        </div>
      </dl>
    </Card>
  )
}
