"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  User,
  FileText,
  Lock,
  ArrowRight,
  Check,
  Info,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { BrandLoader } from "@/components/brand/brand-loader"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { CountdownTimer } from "@/components/checkout/countdown-timer"
import { ReservationSummary } from "@/components/checkout/reservation-summary"
import { PaymentGatewayModal } from "@/components/checkout/payment-gateway-modal"
import { InvoiceModal } from "@/components/checkout/invoice-modal"
import { cn } from "@/lib/utils"
import {
  describeCancellationPolicy,
  getCancellationPolicyLabel,
} from "@/lib/cancellation-policy"
import { toPersianDigits } from "@/lib/format-fa"
import {
  type ReservationDetail,
  type CheckoutAccommodationInfo,
  type PaymentResponse,
  type InvoiceData,
  formatFaPrice,
  getPersianYear,
} from "@/types/checkout"

interface CheckoutPageProps {
  params: Promise<{ id: string }>
}

function normalizeFaDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[\s-]/g, "")
}

function isValidIranianMobile(phone: string): boolean {
  const digits = normalizeFaDigits(phone).replace(/^(?:\+98|0098)/, "0")
  return /^09\d{9}$/.test(digits)
}

function isValidNationalCode(code: string): boolean {
  const trimmed = code.trim()
  return trimmed === "" || /^\d{10}$/.test(normalizeFaDigits(trimmed))
}

function formatCancellationReason(reason?: string | null): string {
  if (!reason) return "مهلت پرداخت ۳۰ دقیقه‌ای به پایان رسید و تقویم اقامتگاه آزاد شد."
  const lower = reason.toLowerCase()
  if (lower.includes("ttl") || lower.includes("expire") || lower.includes("timeout")) {
    return "مهلت پرداخت ۳۰ دقیقه‌ای این رزرو به پایان رسیده است و تاریخ‌های انتخابی آزاد شدند."
  }
  if (lower.includes("concurrent") || lower.includes("conflict") || lower.includes("occupied")) {
    return "متاسفانه این اقامتگاه در این بازه تاریخی هم‌اکنون توسط کاربر دیگری رزرو شد."
  }
  return reason
}

export default function CheckoutPage({ params }: CheckoutPageProps) {
  const resolvedParams = React.use(params)
  const reservationId = Number(resolvedParams.id)
  const router = useRouter()

  const { user, isAuthenticated, isLoading: isAuthLoading, openOtpModal } = useAuth()

  const [reservation, setReservation] = React.useState<ReservationDetail | null>(null)
  const [accommodation, setAccommodation] = React.useState<CheckoutAccommodationInfo | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [reloadTrigger, setReloadTrigger] = React.useState(0)

  // Guest Contact Form State (with user defaults)
  const [customGuestName, setCustomGuestName] = React.useState<string | null>(null)
  const [customGuestPhone, setCustomGuestPhone] = React.useState<string | null>(null)
  const [guestNationalCode, setGuestNationalCode] = React.useState("")
  const [customGuestEmail, setCustomGuestEmail] = React.useState<string | null>(null)

  const defaultGuestName = [user?.first_name, user?.last_name].filter(Boolean).join(" ")
  const defaultGuestPhone = user?.phone || ""
  const defaultGuestEmail = user?.email || ""

  const guestName = customGuestName ?? defaultGuestName
  const guestPhone = customGuestPhone ?? defaultGuestPhone
  const guestEmail = customGuestEmail ?? defaultGuestEmail

  // Payment Selection & Terms
  const [gateway, setGateway] = React.useState("mellat")
  const [agreedToTerms, setAgreedToTerms] = React.useState(false)

  // Modals & Payment Confirmation
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState(false)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = React.useState(false)
  const [latestPayment, setLatestPayment] = React.useState<PaymentResponse | null>(null)
  const [paymentLookupError, setPaymentLookupError] = React.useState<string | null>(null)

  // Reset page-level checkout state when the [id] param changes client-side:
  // same-route navigation (e.g. /checkout/A → back → /checkout/B) does NOT
  // remount this page in the App Router, so without this, reservation A's
  // amounts/dates render under URL B — with the pay button enabled and the
  // payment modal posting against the stale reservation.id.
  // Adjusting state during render is the documented pattern for "reset state
  // when a prop changes" — an effect would cascade re-renders.
  const [prevReservationId, setPrevReservationId] = React.useState(reservationId)
  if (prevReservationId !== reservationId) {
    setPrevReservationId(reservationId)
    setReservation(null)
    setAccommodation(null)
    setLatestPayment(null)
    setPaymentLookupError(null)
    setFetchError(null)
    setCustomGuestName(null)
    setCustomGuestPhone(null)
    setGuestNationalCode("")
    setCustomGuestEmail(null)
    setGateway("mellat")
    setAgreedToTerms(false)
    setIsPaymentModalOpen(false)
    setIsInvoiceModalOpen(false)
    setReloadTrigger(0)
    setIsLoading(true)
  }

  // Fetch reservation and accommodation details
  React.useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !reservationId || isNaN(reservationId)) return

    let isCancelled = false
    const fetchData = async () => {
      setAccommodation(null)
      setLatestPayment(null)
      setPaymentLookupError(null)
      try {
        const res = await apiClient.get<ReservationDetail>(`/reservations/${reservationId}`)
        if (!isCancelled) {
          setReservation(res)
          try {
            const acc = await apiClient.get<CheckoutAccommodationInfo>(
              `/accommodations/${res.accommodation_id}`
            )
            if (!isCancelled) setAccommodation(acc)
          } catch {
            // Fallback gracefully
          }

          if (res.status === "confirmed" || res.status === "completed") {
            // Paginate /payments/my (newest-first) until this reservation's
            // successful payment is found — a plain limit=50 lookup misses it
            // for frequent guests with 50+ newer payments (R1).
            try {
              const PAGE_SIZE = 100
              let skip = 0
              let found: PaymentResponse | null = null
              for (let page = 0; page < 10 && !found; page += 1) {
                const myPayments = await apiClient.get<PaymentResponse[]>(
                  `/payments/my?limit=${PAGE_SIZE}&skip=${skip}`
                )
                found =
                  myPayments.find((p) => p.reservation_id === res.id && p.status === "success") ||
                  null
                if (myPayments.length < PAGE_SIZE) break
                skip += PAGE_SIZE
              }
              if (!isCancelled) {
                if (found) {
                  setLatestPayment(found)
                } else {
                  setPaymentLookupError(
                    "پرداخت موفق این رزرو یافت نشد؛ فاکتور رسمی در دسترس نیست. در صورت کسر وجه، با پشتیبانی تماس بگیرید."
                  )
                }
              }
            } catch {
              if (!isCancelled) {
                setPaymentLookupError(
                  "دریافت اطلاعات پرداخت ناموفق بود؛ فاکتور رسمی در دسترس نیست. لطفا دوباره تلاش کنید."
                )
              }
            }
          }
        }
      } catch (err) {
        if (!isCancelled) {
          if (err instanceof ApiError) {
            if (err.status === 404) {
              setFetchError("رزرو مورد نظر یافت نشد.")
            } else if (err.status === 403) {
              setFetchError("شما دسترسی مشاهده این رزرو را ندارید.")
            } else {
              setFetchError(err.detail)
            }
          } else {
            setFetchError("خطا در بارگذاری اطلاعات رزرو. لطفا دوباره تلاش کنید.")
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isCancelled = true
    }
  }, [reservationId, isAuthLoading, isAuthenticated, reloadTrigger])

  const handleRetry = () => {
    setIsLoading(true)
    setFetchError(null)
    setReloadTrigger((prev) => prev + 1)
  }

  // Timer expiration handler (strictly guarded against overwriting confirmed/completed reservations)
  const handleExpired = React.useCallback(() => {
    setReservation((prev) => {
      if (!prev || prev.status !== "pending") return prev
      return {
        ...prev,
        status: "cancelled",
        cancellation_reason: "Payment session expired (TTL timeout)",
      }
    })
  }, [])

  // Payment success handler: keep local state so direct visits / browser-back
  // still show the inline confirmed banner, then hand off to the result page.
  const handlePaymentSuccess = React.useCallback(
    (payment: PaymentResponse) => {
      setLatestPayment(payment)
      setReservation((prev) => (prev ? { ...prev, status: "confirmed" } : null))
      router.push(`/checkout/${payment.reservation_id}/success`)
    },
    [router]
  )

  // Terminal gateway failures get their own screen; generic network errors
  // stay inline in the modal with retry.
  const handlePaymentFailure = React.useCallback(
    (reason: string) => {
      router.push(
        `/checkout/${reservationId}/failed?reason=${encodeURIComponent(reason)}`
      )
    },
    [router, reservationId]
  )

  // Handle terminal status change from payment gateway (e.g. 409 conflict or expiration)
  const handleReservationStatusChange = React.useCallback(
    (status: "cancelled", reason: string) => {
      setReservation((prev) =>
        prev
          ? {
              ...prev,
              status,
              cancellation_reason: reason,
            }
          : null
      )
    },
    []
  )

  // InvoiceData builder (strictly produced only when reservation is confirmed/completed
  // AND a real successful payment was found — never fabricate a payment (R1))
  const invoiceData: InvoiceData | null = React.useMemo(() => {
    if (!reservation || (reservation.status !== "confirmed" && reservation.status !== "completed")) {
      return null
    }
    if (!latestPayment) {
      return null
    }
    const confirmedAt = latestPayment.paid_at || reservation.updated_at || reservation.created_at
    const solarYear = getPersianYear(confirmedAt)
    return {
      invoice_number: `INV-${solarYear}-${reservation.id.toString().padStart(5, "0")}`,
      issuance_date: confirmedAt,
      reservation,
      accommodation,
      payment: latestPayment,
      guest: {
        full_name: guestName || "-",
        phone: guestPhone || "-",
        national_code: guestNationalCode || "-",
        email: guestEmail || "-",
      },
    }
  }, [reservation, accommodation, latestPayment, guestName, guestPhone, guestNationalCode, guestEmail])

  // Invalid ID Guard
  if (!reservationId || isNaN(reservationId)) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-paper p-4 text-ink">
        <Card className="w-full max-w-md space-y-5 rounded-3xl border-line bg-paper-card p-8 text-center shadow-soft">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brick-soft/70 text-brick-deep">
            <AlertCircle className="size-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-black tracking-tight text-ink">شناسه رزرو نامعتبر است</h1>
            <p className="text-sm leading-6 text-ink-soft">شناسه ارسال شده برای رزرو صحیح نمی‌باشد.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/")}
            className="w-full border-line bg-paper-card text-ink shadow-none hover:bg-paper"
          >
            صفحه اصلی
          </Button>
        </Card>
      </div>
    )
  }

  // Authentication Guard
  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-paper p-4 text-ink">
        <Card className="w-full max-w-md space-y-5 rounded-3xl border-line bg-paper-card p-8 text-center shadow-soft">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brick-soft/70 text-brick-deep">
            <Lock className="size-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-black tracking-tight text-ink">ورود به حساب کاربری</h1>
            <p className="text-sm leading-6 text-ink-soft">
              برای مشاهده جزئیات فاکتور، تکمیل رزرو و اتصال به درگاه بانکی، ابتدا وارد حساب کاربری خود شوید.
            </p>
          </div>
          <Button
            type="button"
            onClick={openOtpModal}
            className="h-11 w-full font-bold"
          >
            ورود / ثبت‌نام سریع با شماره موبایل
          </Button>
        </Card>
      </div>
    )
  }

  // Loading State
  if (isLoading || isAuthLoading) {
    return <BrandLoader label="در حال دریافت اطلاعات رزرو..." />
  }

  // Error State
  if (fetchError || !reservation) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-paper p-4 text-ink">
        <Card className="w-full max-w-md space-y-5 rounded-3xl border-line bg-paper-card p-8 text-center shadow-soft">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="size-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-black tracking-tight text-ink">خطا در بارگذاری رزرو</h1>
            <p className="text-sm leading-6 text-ink-soft">{fetchError || "رزرو مورد نظر یافت نشد."}</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/")}
              className="flex-1 border-line bg-paper-card text-ink shadow-none hover:bg-paper"
            >
              صفحه اصلی
            </Button>
            <Button
              type="button"
              onClick={handleRetry}
              className="flex-1 font-bold"
            >
              تلاش مجدد
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const isPending = reservation.status === "pending"
  const isConfirmed = reservation.status === "confirmed"
  const isCancelled = reservation.status === "cancelled"
  const isCompleted = reservation.status === "completed"

  const policyLabel = getCancellationPolicyLabel(
    accommodation?.cancellation_policy
  )
  const policyDescription = describeCancellationPolicy(
    accommodation?.cancellation_policy,
    {
      freeHours: accommodation?.cancellation_free_hours,
      penaltyPercent: accommodation?.cancellation_penalty_percent,
    }
  )
  const isPhoneValid = isValidIranianMobile(guestPhone)
  const isNationalCodeValid = isValidNationalCode(guestNationalCode)
  const isFormValid =
    Boolean(guestName.trim()) && isPhoneValid && isNationalCodeValid && agreedToTerms
  // Specific Persian error for the first invalid guest field (T9); null when
  // the form is valid or the reservation is no longer pending.
  const guestFormError = !isPending
    ? null
    : !guestName.trim()
      ? "نام و نام خانوادگی را وارد کنید."
      : !isPhoneValid
        ? "شماره موبایل معتبر نیست؛ شماره باید ۱۱ رقم و با ۰۹ شروع شود."
        : !isNationalCodeValid
          ? "کد ملی باید ۱۰ رقم باشد."
          : !agreedToTerms
            ? "لطفا قوانین و شرایط را مطالعه و تایید کنید."
            : null

  return (
    <div className="min-h-screen bg-paper pb-28 pt-4 text-ink sm:pb-16 sm:pt-8">
      <div className="container mx-auto max-w-6xl space-y-6 px-4">
        {/* Navigation Breadcrumb / Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/accommodations/${reservation.accommodation_id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-brick sm:text-sm"
          >
            <ArrowRight className="size-4" />
            <span>بازگشت به صفحه اقامتگاه</span>
          </Link>
          <span className="text-[11px] text-ink-soft">
            شناسه رزرو:{" "}
            <bdi dir="ltr" className="font-semibold tabular-nums text-ink">
              MHM-{toPersianDigits(reservation.id.toString().padStart(5, "0"))}
            </bdi>
          </span>
        </div>

        {/* 3-Step Checkout Stepper */}
        <div className="rounded-3xl border border-line bg-paper-card p-4 shadow-soft sm:p-5">
          <div className="grid grid-cols-3 gap-2 text-center sm:gap-4">
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-xs font-bold sm:text-sm",
                  isConfirmed || isCompleted
                    ? "bg-trust text-on-brick"
                    : "bg-brick text-on-brick"
                )}
              >
                {isConfirmed || isCompleted ? <Check className="size-4" /> : "۱"}
              </div>
              <span className="text-xs font-bold text-ink sm:text-sm">مشخصات مهمانان</span>
              <span className="hidden text-[11px] text-ink-soft sm:inline">اطلاعات مسافران</span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-xs font-bold sm:text-sm",
                  isConfirmed || isCompleted
                    ? "bg-trust text-on-brick"
                    : isPending
                    ? "bg-brick text-on-brick ring-4 ring-brick/15"
                    : "bg-paper-deep text-ink-soft"
                )}
              >
                {isConfirmed || isCompleted ? <Check className="size-4" /> : "۲"}
              </div>
              <span
                className={cn(
                  "text-xs font-bold sm:text-sm",
                  isPending ? "text-brick" : "text-ink"
                )}
              >
                شیوه پرداخت
              </span>
              <span className="hidden text-[11px] text-ink-soft sm:inline">درگاه امن شاپرک</span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-xs font-bold sm:text-sm",
                  isConfirmed || isCompleted
                    ? "bg-trust text-on-brick ring-4 ring-trust/15"
                    : "bg-paper-deep text-ink-soft"
                )}
              >
                {isConfirmed || isCompleted ? <Check className="size-4" /> : "۳"}
              </div>
              <span
                className={cn(
                  "text-xs font-bold sm:text-sm",
                  isConfirmed || isCompleted ? "font-black text-trust" : "text-ink-soft"
                )}
              >
                صدور فاکتور و ووچر
              </span>
              <span className="hidden text-[11px] text-ink-soft sm:inline">تایید نهایی اقامتگاه</span>
            </div>
          </div>
        </div>

        {/* Countdown Timer Banner */}
        {isPending && (
          <CountdownTimer
            key={reservation.id}
            createdAt={reservation.created_at}
            isPending={isPending}
            onExpired={handleExpired}
          />
        )}

        {/* Confirmed State Hero Banner */}
        {isConfirmed && (
          <Card className="rounded-3xl border-trust/25 bg-trust-soft/60 p-5 shadow-soft sm:p-6">
            <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-right">
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-trust text-on-brick">
                  <CheckCircle2 className="size-7" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-ink sm:text-lg">
                    رزرو شما با موفقیت تایید و پرداخت گردید
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-soft sm:text-sm">
                    کد پیگیری و اطلاعات ورود برای شماره همراه شما پیامک شد.
                  </p>
                </div>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <Button
                  type="button"
                  disabled={!invoiceData}
                  onClick={() => setIsInvoiceModalOpen(true)}
                  className="h-11 flex-1 gap-2 rounded-xl bg-trust text-xs font-bold text-on-brick hover:bg-trust/90 sm:flex-none sm:text-sm"
                >
                  <FileText className="size-4" />
                  مشاهده و چاپ فاکتور رسمی
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/trips")}
                  className="h-11 flex-1 rounded-xl border-line bg-paper-card/70 text-xs font-semibold text-ink shadow-none hover:bg-paper sm:flex-none sm:text-sm"
                >
                  سفرهای من
                </Button>
              </div>
            </div>
            {paymentLookupError && (
              <p className="mt-3 text-center text-xs font-medium text-destructive sm:text-right sm:text-sm">
                {paymentLookupError}
              </p>
            )}
          </Card>
        )}

        {/* Completed State Banner (T1): a completed reservation has no
            confirmed banner, but its invoice must still be reachable. */}
        {isCompleted && (
          <Card className="rounded-3xl border-trust/25 bg-trust-soft/60 p-5 shadow-soft sm:p-6">
            <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-right">
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-trust text-on-brick">
                  <CheckCircle2 className="size-7" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-ink sm:text-lg">
                    اقامت شما با موفقیت به پایان رسید
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-soft sm:text-sm">
                    فاکتور رسمی این رزرو در دسترس است.
                  </p>
                </div>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <Button
                  type="button"
                  disabled={!invoiceData}
                  onClick={() => setIsInvoiceModalOpen(true)}
                  className="h-11 flex-1 gap-2 rounded-xl bg-trust text-xs font-bold text-on-brick hover:bg-trust/90 sm:flex-none sm:text-sm"
                >
                  <FileText className="size-4" />
                  مشاهده و چاپ فاکتور رسمی
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/trips")}
                  className="h-11 flex-1 rounded-xl border-line bg-paper-card/70 text-xs font-semibold text-ink shadow-none hover:bg-paper sm:flex-none sm:text-sm"
                >
                  سفرهای من
                </Button>
              </div>
            </div>
            {paymentLookupError && (
              <p className="mt-3 text-center text-xs font-medium text-destructive sm:text-right sm:text-sm">
                {paymentLookupError}
              </p>
            )}
          </Card>
        )}

        {/* Cancelled / Expired State Banner */}
        {isCancelled && (
          <Card className="rounded-3xl border-destructive/30 bg-destructive/5 p-5 shadow-soft sm:p-6">
            <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-right">
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <AlertCircle className="size-7" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-destructive sm:text-lg">
                    این رزرو منقضی یا لغو شده است
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-soft sm:text-sm">
                    {formatCancellationReason(reservation.cancellation_reason)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => router.push(`/accommodations/${reservation.accommodation_id}`)}
                className="h-11 w-full font-bold sm:w-auto"
              >
                رزرو مجدد این اقامتگاه
              </Button>
            </div>
          </Card>
        )}

        {/* Main Content 2-Column Grid */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Guest & Payment Settings */}
          <div className="space-y-6 lg:col-span-7">
            {/* Guest Contact Details Card */}
            <Card className="rounded-3xl border-line bg-paper-card shadow-soft">
              <CardHeader className="p-5 pb-3 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold tracking-[0.18em] text-brick">مهمان</p>
                    <CardTitle className="flex items-center gap-2.5 text-base font-black tracking-tight text-ink">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-brick-soft/60 text-brick-deep">
                        <User className="size-4" />
                      </span>
                      مشخصات تحویل‌گیرنده و مهمان اصلی
                    </CardTitle>
                  </div>
                  <span className="text-[11px] text-ink-soft">برای ارائه به میزبان و بیمه</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between text-xs font-semibold text-ink">
                      <span>نام و نام خانوادگی *</span>
                    </label>
                    <Input
                      type="text"
                      disabled={!isPending}
                      value={guestName}
                      onChange={(e) => setCustomGuestName(e.target.value)}
                      placeholder="مطابق با کارت ملی"
                      className="h-11 border-line bg-paper text-ink"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between text-xs font-semibold text-ink">
                      <span>شماره موبایل *</span>
                      <span className="text-[11px] font-normal text-ink-soft">ارسال پیامک تایید</span>
                    </label>
                    <Input
                      type="tel"
                      dir="ltr"
                      disabled={!isPending}
                      value={guestPhone}
                      onChange={(e) => setCustomGuestPhone(e.target.value)}
                      placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                      className="h-11 border-line bg-paper text-left tabular-nums text-ink"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between text-xs font-semibold text-ink">
                      <span>کد ملی (اختیاری)</span>
                    </label>
                    <Input
                      type="text"
                      dir="ltr"
                      disabled={!isPending}
                      value={guestNationalCode}
                      onChange={(e) => setGuestNationalCode(e.target.value)}
                      placeholder="۱۰ رقم کد ملی"
                      className="h-11 border-line bg-paper text-left tabular-nums text-ink"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between text-xs font-semibold text-ink">
                      <span>ایمیل (اختیاری)</span>
                      <span className="text-[11px] font-normal text-ink-soft">ارسال فاکتور الکترونیک</span>
                    </label>
                    <Input
                      type="email"
                      dir="ltr"
                      disabled={!isPending}
                      value={guestEmail}
                      onChange={(e) => setCustomGuestEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="h-11 border-line bg-paper text-left tabular-nums text-ink"
                    />
                  </div>
                </div>
                {isPending && guestFormError && (
                  <p className="text-xs font-medium text-destructive">{guestFormError}</p>
                )}
              </CardContent>
            </Card>

            {/* Payment Gateway Selector Card */}
            <Card className="rounded-3xl border-line bg-paper-card shadow-soft">
              <CardHeader className="p-5 pb-3 sm:p-6">
                <div className="space-y-2">
                  <p className="text-[11px] font-bold tracking-[0.18em] text-brick">پرداخت</p>
                  <CardTitle className="flex items-center gap-2.5 text-base font-black tracking-tight text-ink">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-brick-soft/60 text-brick-deep">
                      <CreditCard className="size-4" />
                    </span>
                    شیوه و درگاه پرداخت
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-5 pt-0 sm:p-6 sm:pt-0">
                <RadioGroup
                  value={gateway}
                  onValueChange={setGateway}
                  disabled={!isPending}
                  className="space-y-2.5"
                >
                  <label
                    htmlFor="page-gw-mellat"
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3.5 text-xs transition-colors sm:text-sm",
                      gateway === "mellat"
                        ? "border-brick bg-brick-soft/40 font-bold"
                        : "border-line bg-paper hover:border-line-strong"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="mellat" id="page-gw-mellat" />
                      <div>
                        <span className="font-bold text-ink">به‌پرداخت ملت (شاپرک)</span>
                        <p className="mt-0.5 text-[11px] text-ink-soft">
                          پایدارترین درگاه شتابی • کارت تمامی بانک‌ها
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-bold">
                      پیشنهادی
                    </Badge>
                  </label>

                  <label
                    htmlFor="page-gw-sep"
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3.5 text-xs transition-colors sm:text-sm",
                      gateway === "sep"
                        ? "border-brick bg-brick-soft/40 font-bold"
                        : "border-line bg-paper hover:border-line-strong"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="sep" id="page-gw-sep" />
                      <div>
                        <span className="font-bold text-ink">پرداخت الکترونیک سامان کیش (سپ)</span>
                        <p className="mt-0.5 text-[11px] text-ink-soft">
                          شبکه رسمی شاپرک • تسویه آنی
                        </p>
                      </div>
                    </div>
                  </label>

                  <label
                    htmlFor="page-gw-snapppay"
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3.5 text-xs transition-colors sm:text-sm",
                      gateway === "snapppay"
                        ? "border-brick bg-brick-soft/40 font-bold"
                        : "border-line bg-paper hover:border-line-strong"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="snapppay" id="page-gw-snapppay" />
                      <div>
                        <span className="font-bold text-ink">پرداخت اقساطی اسنپ‌پی (BNPL)</span>
                        <p className="mt-0.5 text-[11px] text-ink-soft">
                          پرداخت در ۴ قسط مساوی بدون کارمزد و ضامن
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-line text-[11px] text-ink-soft">
                      ۴ قسط
                    </Badge>
                  </label>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Cancellation Policy and Agreement */}
            <Card className="rounded-3xl border-line bg-paper-card shadow-soft">
              <CardHeader className="p-5 pb-3 sm:p-6">
                <div className="space-y-2">
                  <p className="text-[11px] font-bold tracking-[0.18em] text-brick">شرایط</p>
                  <CardTitle className="flex items-center gap-2.5 text-base font-black tracking-tight text-ink">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-brick-soft/60 text-brick-deep">
                      <Info className="size-4" />
                    </span>
                    قوانین کنسلی و شرایط اقامت
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
                <div className="space-y-1 rounded-2xl border border-line/70 bg-paper p-3.5 text-xs sm:text-sm">
                  <div className="flex items-center justify-between font-bold text-ink">
                    <span>قوانین استرداد: {policyLabel}</span>
                  </div>
                  <p className="leading-6 text-ink-soft">
                    {policyDescription}
                  </p>
                </div>

                <div className="flex items-start gap-2.5 pt-1">
                  <Checkbox
                    id="terms"
                    disabled={!isPending}
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(Boolean(checked))}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="terms"
                    className="cursor-pointer select-none text-xs leading-6 text-ink sm:text-sm"
                  >
                    <span className="font-bold">قوانین و مقررات آشیانک</span>، شرایط کنسلی این اقامتگاه و قوانین ورود و خروج را مطالعه نموده و با آن موافقم.
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Desktop Direct Pay CTA */}
            {isPending && (
              <div className="hidden pt-1 lg:block">
                <Button
                  type="button"
                  disabled={!isFormValid}
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="h-12 w-full gap-2 text-base font-black shadow-lift"
                >
                  <Lock className="size-5" />
                  انتقال به درگاه امن بانکی و پرداخت (
                  {formatFaPrice(reservation.total_price)} تومان)
                </Button>
                {!isFormValid && guestFormError && (
                  <p className="mt-2 text-center text-xs text-ink-soft">
                    {guestFormError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Order Summary Sidebar (Desktop) */}
          <div className="space-y-6 lg:col-span-5">
            <ReservationSummary
              reservation={reservation}
              accommodation={accommodation}
              className="sticky top-6"
            />
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      {isPending && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 border-t border-line bg-paper-card/95 p-3.5 px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] shadow-dock backdrop-blur-md lg:hidden">
          <div>
            <span className="block text-[11px] text-ink-soft">مبلغ کل قابل پرداخت:</span>
            <div className="text-base font-black tabular-nums text-brick">
              {formatFaPrice(reservation.total_price)} تومان
            </div>
          </div>
          <Button
            type="button"
            disabled={!isFormValid}
            onClick={() => setIsPaymentModalOpen(true)}
            className="h-11 max-w-[200px] flex-1 gap-2 text-sm font-bold"
          >
            <Lock className="size-4" />
            پرداخت امن
          </Button>
        </div>
      )}

      {/* Payment Gateway Simulation Modal (strictly mounted only for pending reservations) */}
      {reservation && isPending && (
        <PaymentGatewayModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          reservation={reservation}
          initialGateway={gateway}
          onSuccess={handlePaymentSuccess}
          onStatusChange={handleReservationStatusChange}
          onFailure={handlePaymentFailure}
        />
      )}

      {/* Printable Tax Invoice Modal (strictly gated to confirmed/completed reservations) */}
      {invoiceData && (isConfirmed || isCompleted) && (
        <InvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          data={invoiceData}
        />
      )}
    </div>
  )
}
