"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  Building,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Loader2,
  LogIn,
  MapPin,
  Printer,
  ShieldCheck,
  Users,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { findLatestSuccessfulPayment } from "@/lib/pagination"
import { formatPersianDate, toPersianDigits } from "@/lib/format-fa"
import { getReservationCode } from "@/lib/reservation-code"
import { AshianakLogo } from "@/components/brand/ashianak-logo"
import { EmptyState } from "@/components/shared/empty-state"
import { TripStatusBadge } from "@/components/trips/trip-status-badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { computeCheckoutBreakdown, formatFaPrice } from "@/lib/checkout-format"
import type { TripReservationItem } from "@/types/trips"
import type { PaymentResponse } from "@/types/checkout"
import type { AccommodationDetailData } from "@/types/detail"

const STATUS_LABEL: Record<string, string> = {
  pending: "در انتظار پرداخت",
  confirmed: "پرداخت‌شده",
  completed: "تسویه‌شده",
  cancelled: "لغوشده",
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = React.use(params)
  const reservationId = Number(resolved.id)
  const isValidId = Number.isInteger(reservationId) && reservationId > 0

  const { user, token, isLoading: isAuthLoading, openOtpModal } = useAuth()
  const [reservation, setReservation] = React.useState<TripReservationItem | null>(null)
  const [accommodation, setAccommodation] = React.useState<AccommodationDetailData | null>(null)
  const [payment, setPayment] = React.useState<PaymentResponse | null>(null)
  const [isLoading, setIsLoading] = React.useState(isValidId)
  const [errorStatus, setErrorStatus] = React.useState<number | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    if (isAuthLoading || !token || !isValidId) return
    let isCurrent = true

    async function load() {
      setIsLoading(true)
      setErrorStatus(null)
      setErrorMessage(null)
      try {
        const data = await apiClient.get<TripReservationItem>(`/reservations/${reservationId}`)
        if (!isCurrent) return
        setReservation(data)

        const [stayResult, paymentsResult] = await Promise.allSettled([
          apiClient.get<AccommodationDetailData>(`/accommodations/${data.accommodation_id}`),
          findLatestSuccessfulPayment(reservationId),
        ])
        if (!isCurrent) return
        if (stayResult.status === "fulfilled") setAccommodation(stayResult.value)
        if (paymentsResult.status === "fulfilled" && paymentsResult.value) {
          setPayment(paymentsResult.value)
        }
      } catch (err: unknown) {
        if (!isCurrent) return
        if (err instanceof ApiError) {
          setErrorStatus(err.status)
          setErrorMessage(err.detail || err.message)
        } else {
          setErrorStatus(500)
          setErrorMessage("خطا در دریافت فاکتور. لطفاً دوباره تلاش کنید.")
        }
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void load()
    return () => {
      isCurrent = false
    }
  }, [isAuthLoading, token, isValidId, reservationId, reloadKey])

  if (!isValidId) {
    return (
      <Shell>
        <EmptyState
          icon={FileText}
          title="این فاکتور پیدا نشد"
          description="شناسهٔ فاکتور معتبر نیست. از دفتر سفرها رزرو موردنظر را انتخاب کنید."
          action={
            <Button asChild variant="outline" className="border-line bg-transparent">
              <Link href="/trips">بازگشت به سفرها</Link>
            </Button>
          }
        />
      </Shell>
    )
  }

  if (isAuthLoading) return <InvoiceSkeleton />

  if (!token) {
    return (
      <Shell>
        <EmptyState
          icon={LogIn}
          title="برای دیدن فاکتور وارد شوید"
          description="فاکتور رسمی فقط برای صاحب رزرو نمایش داده می‌شود."
          action={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={openOtpModal} className="gap-2">
                <LogIn className="size-4" />
                <span>ورود با شماره همراه</span>
              </Button>
              <Button asChild variant="outline" className="border-line bg-transparent">
                <Link href={`/login?next=/invoice/${reservationId}`}>صفحه ورود</Link>
              </Button>
            </div>
          }
        />
      </Shell>
    )
  }

  if (isLoading) return <InvoiceSkeleton />

  if (errorStatus || !reservation) {
    const is403 = errorStatus === 403
    const is404 = errorStatus === 404
    return (
      <Shell>
        <EmptyState
          icon={is403 ? ShieldCheck : AlertCircle}
          title={
            is403
              ? "این فاکتور متعلق به حساب شما نیست"
              : is404
                ? "فاکتور پیدا نشد"
                : "خطا در دریافت فاکتور"
          }
          description={
            is403
              ? "با حساب کاربری صاحب رزرو وارد شوید و دوباره تلاش کنید."
              : errorMessage || "اتصال به سرور برقرار نشد."
          }
          action={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild className="gap-1.5">
                <Link href="/trips">
                  <ArrowRight className="size-4" />
                  بازگشت به سفرها
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-line bg-transparent"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                تلاش مجدد
              </Button>
            </div>
          }
        />
      </Shell>
    )
  }

  const title =
    reservation.accommodation_title ||
    accommodation?.title ||
    `اقامتگاه کد ${toPersianDigits(reservation.accommodation_id)}`
  const location =
    [
      accommodation?.city?.province?.name,
      accommodation?.city?.name,
      reservation.province,
      reservation.city,
    ]
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index)
      .join("، ") || "ایران"
  const breakdown = computeCheckoutBreakdown(
    {
      total_price: reservation.total_price,
      total_nights: reservation.total_nights,
      coupon_code: reservation.coupon_code,
    },
    accommodation
      ? { cleaning_fee: accommodation.cleaning_fee, base_price: accommodation.base_price }
      : null
  )
  const nightlyRate =
    accommodation && accommodation.base_price > 0
      ? accommodation.base_price
      : reservation.total_nights > 0
        ? Math.round(breakdown.baseTotal / reservation.total_nights)
        : 0
  const guestName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "مهمان آشیانک"
  const invoiceNumber = getReservationCode(reservation.id)
  const trackingCode =
    payment?.tracking_code && !/^[0۰]+$/.test(payment.tracking_code)
      ? payment.tracking_code
      : null
  const paymentStatus = payment
    ? trackingCode
      ? `پرداخت‌شده با کد پیگیری ${toPersianDigits(trackingCode)}`
      : "پرداخت‌شده"
    : STATUS_LABEL[reservation.status] ?? "در انتظار بررسی"

  return (
    <div className="invoice-page bg-paper">
      {/* Screen toolbar */}
      <div className="print-hidden border-b border-line/70 bg-paper-deep/35">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href={`/trips/${reservation.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-brick"
          >
            <ArrowRight className="size-3.5" />
            بازگشت به جزئیات رزرو
          </Link>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-line bg-paper-card"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              <span>چاپ فاکتور</span>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href={`/trips/${reservation.id}`}>
                <Download className="size-3.5" />
                <span>جزئیات رزرو</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <article className="invoice-sheet overflow-hidden rounded-3xl border border-line/80 bg-paper-card shadow-lift">
          {/* Header */}
          <header className="border-b border-line/70 bg-paper-deep/30 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex items-center gap-3">
                <AshianakLogo size="lg" />
                <div>
                  <p className="mt-1 text-[11px] text-ink-soft">اقامتگاه‌های بومی ایران</p>
                  <p className="text-[10px] text-ink-soft">
                    ashianak.ir · ۰۲۱–۹۱۰۰۰۰۰۰
                  </p>
                </div>
              </div>
              <div className="text-left">
                <p className="text-[11px] font-bold tracking-[0.18em] text-brick">فاکتور رسمی</p>
                <p className="mt-2 text-lg font-black tabular-nums text-ink" dir="ltr">
                  {invoiceNumber}
                </p>
                <p className="mt-2 text-[11px] text-ink-soft">
                  تاریخ صدور: {formatPersianDate(reservation.created_at)}
                </p>
                <div className="mt-2">
                  <TripStatusBadge trip={reservation} />
                </div>
              </div>
            </div>
          </header>

          <div className="p-6 sm:p-8">
            {/* Parties */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-line/70 bg-paper/60 p-4">
                <p className="text-[10px] font-bold tracking-[0.16em] text-ink-soft">مشتری</p>
                <p className="mt-2 text-sm font-bold text-ink">{guestName}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-soft">
                  <span className="tabular-nums">
                    {toPersianDigits(user?.phone ?? "")}
                  </span>
                </p>
                {user?.email ? (
                  <p className="mt-1 text-[11px] text-ink-soft" dir="ltr">
                    {user.email}
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-line/70 bg-paper/60 p-4">
                <p className="text-[10px] font-bold tracking-[0.16em] text-ink-soft">اقامتگاه</p>
                <p className="mt-2 text-sm font-bold text-ink">{title}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-soft">
                  <MapPin className="size-3 text-brick" />
                  {location}
                </p>
                {accommodation?.address ? (
                  <p className="mt-1 text-[11px] leading-5 text-ink-soft">{accommodation.address}</p>
                ) : null}
              </div>
            </div>

            {/* Stay summary */}
            <div className="mt-5 grid gap-3 rounded-2xl border border-line/70 bg-paper-deep/25 p-4 text-xs sm:grid-cols-4">
              <div>
                <p className="flex items-center gap-1 text-[10px] text-ink-soft">
                  <CalendarDays className="size-3 text-brick" />
                  ورود
                </p>
                <p className="mt-1.5 font-bold tabular-nums text-ink">
                  {formatPersianDate(reservation.check_in)}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-[10px] text-ink-soft">
                  <CalendarDays className="size-3 text-trust" />
                  خروج
                </p>
                <p className="mt-1.5 font-bold tabular-nums text-ink">
                  {formatPersianDate(reservation.check_out)}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-[10px] text-ink-soft">
                  <Building className="size-3 text-brick" />
                  مدت اقامت
                </p>
                <p className="mt-1.5 font-bold text-ink">
                  {toPersianDigits(reservation.total_nights)} شب
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-[10px] text-ink-soft">
                  <Users className="size-3 text-trust" />
                  مهمانان
                </p>
                <p className="mt-1.5 font-bold text-ink">
                  {toPersianDigits(reservation.guests_count)} نفر
                </p>
              </div>
            </div>

            {/* Line items */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-line/70">
              <table className="w-full text-right text-xs">
                <thead className="bg-paper-deep/40 text-[10px] text-ink-soft">
                  <tr>
                    <th className="px-4 py-3 font-semibold">شرح خدمات</th>
                    <th className="px-4 py-3 font-semibold">تعداد</th>
                    <th className="px-4 py-3 font-semibold">مبلغ (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  <tr>
                    <td className="px-4 py-3.5 text-ink">
                      اقامت در {title}
                      {nightlyRate > 0 ? (
                        <span className="mr-1 text-[10px] text-ink-soft">
                          (هر شب {formatFaPrice(nightlyRate)})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-ink-soft">
                      {toPersianDigits(reservation.total_nights)} شب
                    </td>
                    <td className="px-4 py-3.5 font-semibold tabular-nums text-ink">
                      {formatFaPrice(breakdown.baseTotal)}
                    </td>
                  </tr>
                  {breakdown.cleaningFee > 0 ? (
                    <tr>
                      <td className="px-4 py-3.5 text-ink">هزینه نظافت و آماده‌سازی</td>
                      <td className="px-4 py-3.5 tabular-nums text-ink-soft">—</td>
                      <td className="px-4 py-3.5 font-semibold tabular-nums text-ink">
                        {formatFaPrice(breakdown.cleaningFee)}
                      </td>
                    </tr>
                  ) : null}
                  {reservation.coupon_code && breakdown.discountAmount > 0 ? (
                    <tr className="text-trust">
                      <td className="px-4 py-3.5">
                        تخفیف کد {reservation.coupon_code}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">—</td>
                      <td className="px-4 py-3.5 font-bold tabular-nums">
                        - {formatFaPrice(breakdown.discountAmount)}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-paper-deep/35">
                    <td className="px-4 py-4 text-sm font-black text-ink" colSpan={2}>
                      مبلغ قابل پرداخت
                    </td>
                    <td className="px-4 py-4 text-base font-black tabular-nums text-brick">
                      {formatFaPrice(breakdown.totalPayable)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/70 bg-paper/50 p-4">
              <div className="flex items-center gap-2">
                {reservation.status === "confirmed" || reservation.status === "completed" ? (
                  <CheckCircle2 className="size-4 text-trust" />
                ) : (
                  <CreditCard className="size-4 text-gold" />
                )}
                <div>
                  <p className="text-[11px] font-bold text-ink">وضعیت پرداخت</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">{paymentStatus}</p>
                </div>
              </div>
              {payment?.paid_at ? (
                <p className="text-[11px] tabular-nums text-ink-soft">
                  تاریخ پرداخت: {formatPersianDate(payment.paid_at)}
                </p>
              ) : null}
            </div>

            <Separator className="my-6 bg-line/60" />

            <div className="flex flex-col gap-4 text-[10px] leading-6 text-ink-soft sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-1.5">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-trust" />
                این فاکتور به‌صورت الکترونیکی صادر شده و برای پیگیری رزرو معتبر است.
                پشتیبانی آشیانک: ۰۲۱–۹۱۰۰۰۰۰۰
              </p>
              <p className="shrink-0 tabular-nums" dir="ltr">
                {invoiceNumber}
              </p>
            </div>
          </div>
        </article>

        <p className="print-hidden mt-4 text-center text-[11px] text-ink-soft">
          برای ذخیرهٔ PDF، در پنجرهٔ چاپ گزینهٔ «Save as PDF» را انتخاب کنید.
        </p>
      </main>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-16 sm:py-20">
      <div className="rounded-3xl border border-line/80 bg-paper-card p-8 shadow-soft">
        {children}
      </div>
    </main>
  )
}

function InvoiceSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="h-6 w-52 rounded-md bg-paper-deep" />
      <Skeleton className="mt-6 h-[560px] w-full rounded-3xl bg-paper-deep" />
      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-soft">
        <Loader2 className="size-3.5 animate-spin" />
        در حال آماده‌سازی فاکتور...
      </p>
    </div>
  )
}
