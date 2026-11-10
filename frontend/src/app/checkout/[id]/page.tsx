"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  FileText,
  Lock,
  ArrowRight,
  Check,
  Info,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
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

function getPolicyText(policy?: string): { title: string; description: string } {
  switch (policy?.toLowerCase()) {
    case "strict":
      return {
        title: "سخت‌گیرانه (Strict)",
        description:
          "لغو تا ۷ روز قبل از ورود با کسر شب اول و استرداد ۵۰٪ باقی‌مانده امکان‌پذیر است؛ پس از آن مبلغی مسترد نمی‌شود.",
      }
    case "moderate":
      return {
        title: "متعادل (Moderate)",
        description:
          "لغو تا ۵ روز قبل از تاریخ ورود شامل استرداد ۱۰۰٪ وجه است؛ پس از آن تا ۲۴ ساعت قبل شامل کسر شب اول می‌باشد.",
      }
    case "flexible":
    default:
      return {
        title: "انعطاف‌پذیر (Flexible)",
        description:
          "لغو رزرو تا ۲۴ ساعت قبل از ساعت ورود (۱۴:۰۰) بدون جریمه و با بازگشت ۱۰۰٪ مبلغ پرداختی انجام می‌شود.",
      }
  }
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

  // Payment success handler
  const handlePaymentSuccess = React.useCallback((payment: PaymentResponse) => {
    setLatestPayment(payment)
    setReservation((prev) => (prev ? { ...prev, status: "confirmed" } : null))
  }, [])

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
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4 rounded-2xl border-border">
          <div className="size-14 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="size-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold">شناسه رزرو نامعتبر است</h1>
            <p className="text-sm text-muted-foreground">شناسه ارسال شده برای رزرو صحیح نمی‌باشد.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/")}
            className="w-full rounded-xl"
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
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4 rounded-2xl border-border">
          <div className="size-14 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Lock className="size-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold">ورود به حساب کاربری</h1>
            <p className="text-sm text-muted-foreground">
              برای مشاهده جزئیات فاکتور، تکمیل رزرو و اتصال به درگاه بانکی، ابتدا وارد حساب کاربری خود شوید.
            </p>
          </div>
          <Button
            type="button"
            onClick={openOtpModal}
            className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl"
          >
            ورود / ثبت‌نام سریع با شماره موبایل
          </Button>
        </Card>
      </div>
    )
  }

  // Loading State
  if (isLoading || isAuthLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 p-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">در حال دریافت اطلاعات رزرو...</p>
      </div>
    )
  }

  // Error State
  if (fetchError || !reservation) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4 rounded-2xl border-border">
          <div className="size-14 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="size-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold">خطا در بارگذاری رزرو</h1>
            <p className="text-sm text-muted-foreground">{fetchError || "رزرو مورد نظر یافت نشد."}</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/")}
              className="flex-1 rounded-xl"
            >
              صفحه اصلی
            </Button>
            <Button
              type="button"
              onClick={handleRetry}
              className="flex-1 rounded-xl bg-primary text-primary-foreground"
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

  const policyInfo = getPolicyText(accommodation?.cancellation_policy)
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
    <div className="min-h-screen bg-background pb-28 sm:pb-16 pt-4 sm:pt-8">
      <div className="container mx-auto px-4 max-w-6xl space-y-6">
        {/* Navigation Breadcrumb / Header */}
        <div className="flex items-center justify-between">
          <Link
            href={`/accommodations/${reservation.accommodation_id}`}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="size-4" />
            <span>بازگشت به صفحه اقامتگاه</span>
          </Link>
          <span className="text-xs font-mono text-muted-foreground">
            شناسه رزرو: MHM-{reservation.id.toString().padStart(5, "0")}
          </span>
        </div>

        {/* 3-Step Checkout Stepper */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "size-8 sm:size-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold",
                  isConfirmed || isCompleted
                    ? "bg-emerald-600 text-white"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {isConfirmed || isCompleted ? <Check className="size-4" /> : "۱"}
              </div>
              <span className="text-xs sm:text-sm font-bold text-foreground">مشخصات مهمانان</span>
              <span className="hidden sm:inline text-[11px] text-muted-foreground">اطلاعات مسافران</span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "size-8 sm:size-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold",
                  isConfirmed || isCompleted
                    ? "bg-emerald-600 text-white"
                    : isPending
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isConfirmed || isCompleted ? <Check className="size-4" /> : "۲"}
              </div>
              <span
                className={cn(
                  "text-xs sm:text-sm font-bold",
                  isPending ? "text-primary" : "text-foreground"
                )}
              >
                شیوه پرداخت
              </span>
              <span className="hidden sm:inline text-[11px] text-muted-foreground">درگاه امن شاپرک</span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "size-8 sm:size-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold",
                  isConfirmed || isCompleted
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-500/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isConfirmed || isCompleted ? <Check className="size-4" /> : "۳"}
              </div>
              <span
                className={cn(
                  "text-xs sm:text-sm font-bold",
                  isConfirmed || isCompleted ? "text-emerald-600 font-extrabold" : "text-muted-foreground"
                )}
              >
                صدور فاکتور و ووچر
              </span>
              <span className="hidden sm:inline text-[11px] text-muted-foreground">تایید نهایی اقامتگاه</span>
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
          <Card className="border-emerald-500/40 bg-emerald-500/10 p-5 sm:p-6 rounded-2xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-7" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-emerald-950 dark:text-emerald-100">
                    رزرو شما با موفقیت تایید و پرداخت گردید
                  </h2>
                  <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 mt-0.5">
                    کد پیگیری و اطلاعات ورود برای شماره همراه شما پیامک شد.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  disabled={!invoiceData}
                  onClick={() => setIsInvoiceModalOpen(true)}
                  className="flex-1 sm:flex-none gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 text-xs sm:text-sm font-bold"
                >
                  <FileText className="size-4" />
                  مشاهده و چاپ فاکتور رسمی
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/trips")}
                  className="flex-1 sm:flex-none rounded-xl h-11 text-xs sm:text-sm border-emerald-600/40 text-emerald-900 dark:text-emerald-200"
                >
                  سفرهای من
                </Button>
              </div>
            </div>
            {paymentLookupError && (
              <p className="text-xs sm:text-sm text-destructive font-medium mt-3 text-center sm:text-right">
                {paymentLookupError}
              </p>
            )}
          </Card>
        )}

        {/* Completed State Banner (T1): a completed reservation has no
            confirmed banner, but its invoice must still be reachable. */}
        {isCompleted && (
          <Card className="border-emerald-500/40 bg-emerald-500/10 p-5 sm:p-6 rounded-2xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-7" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-emerald-950 dark:text-emerald-100">
                    اقامت شما با موفقیت به پایان رسید
                  </h2>
                  <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 mt-0.5">
                    فاکتور رسمی این رزرو در دسترس است.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  disabled={!invoiceData}
                  onClick={() => setIsInvoiceModalOpen(true)}
                  className="flex-1 sm:flex-none gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 text-xs sm:text-sm font-bold"
                >
                  <FileText className="size-4" />
                  مشاهده و چاپ فاکتور رسمی
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/trips")}
                  className="flex-1 sm:flex-none rounded-xl h-11 text-xs sm:text-sm border-emerald-600/40 text-emerald-900 dark:text-emerald-200"
                >
                  سفرهای من
                </Button>
              </div>
            </div>
            {paymentLookupError && (
              <p className="text-xs sm:text-sm text-destructive font-medium mt-3 text-center sm:text-right">
                {paymentLookupError}
              </p>
            )}
          </Card>
        )}

        {/* Cancelled / Expired State Banner */}
        {isCancelled && (
          <Card className="border-destructive/30 bg-destructive/5 p-5 sm:p-6 rounded-2xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                  <AlertCircle className="size-7" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-destructive">
                    این رزرو منقضی یا لغو شده است
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {formatCancellationReason(reservation.cancellation_reason)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => router.push(`/accommodations/${reservation.accommodation_id}`)}
                className="w-full sm:w-auto rounded-xl h-11 bg-primary text-primary-foreground font-bold"
              >
                رزرو مجدد این اقامتگاه
              </Button>
            </div>
          </Card>
        )}

        {/* Main Content 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Guest & Payment Settings */}
          <div className="lg:col-span-7 space-y-6">
            {/* Guest Contact Details Card */}
            <Card className="border-border/80 rounded-2xl">
              <CardHeader className="p-4 sm:p-5 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <User className="size-4 text-primary" />
                    مشخصات تحویل‌گیرنده و مهمان اصلی
                  </CardTitle>
                  <span className="text-[11px] text-muted-foreground">برای ارائه به میزبان و بیمه</span>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>نام و نام خانوادگی *</span>
                    </label>
                    <Input
                      type="text"
                      disabled={!isPending}
                      value={guestName}
                      onChange={(e) => setCustomGuestName(e.target.value)}
                      placeholder="مطابق با کارت ملی"
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>شماره موبایل *</span>
                      <span className="text-[11px] text-muted-foreground">ارسال پیامک تایید</span>
                    </label>
                    <Input
                      type="tel"
                      dir="ltr"
                      disabled={!isPending}
                      value={guestPhone}
                      onChange={(e) => setCustomGuestPhone(e.target.value)}
                      placeholder="۰۹۱۲XXXXXXX"
                      className="h-11 rounded-xl font-mono text-left"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>کد ملی (اختیاری)</span>
                    </label>
                    <Input
                      type="text"
                      dir="ltr"
                      disabled={!isPending}
                      value={guestNationalCode}
                      onChange={(e) => setGuestNationalCode(e.target.value)}
                      placeholder="۱۰ رقم کد ملی"
                      className="h-11 rounded-xl font-mono text-left"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>ایمیل (اختیاری)</span>
                      <span className="text-[11px] text-muted-foreground">ارسال فاکتور الکترونیک</span>
                    </label>
                    <Input
                      type="email"
                      dir="ltr"
                      disabled={!isPending}
                      value={guestEmail}
                      onChange={(e) => setCustomGuestEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="h-11 rounded-xl text-left"
                    />
                  </div>
                </div>
                {isPending && guestFormError && (
                  <p className="text-xs text-destructive font-medium">{guestFormError}</p>
                )}
              </CardContent>
            </Card>

            {/* Payment Gateway Selector Card */}
            <Card className="border-border/80 rounded-2xl">
              <CardHeader className="p-4 sm:p-5 pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <CreditCard className="size-4 text-primary" />
                  شیوه و درگاه پرداخت
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
                <RadioGroup
                  value={gateway}
                  onValueChange={setGateway}
                  disabled={!isPending}
                  className="space-y-2.5"
                >
                  <label
                    htmlFor="page-gw-mellat"
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border text-xs sm:text-sm cursor-pointer transition-colors",
                      gateway === "mellat"
                        ? "border-primary bg-primary/5 font-bold"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="mellat" id="page-gw-mellat" />
                      <div>
                        <span className="font-bold text-foreground">به‌پرداخت ملت (شاپرک)</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          پایدارترین درگاه شتابی • کارت تمامی بانک‌ها
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[11px]">
                      پیشنهادی
                    </Badge>
                  </label>

                  <label
                    htmlFor="page-gw-sep"
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border text-xs sm:text-sm cursor-pointer transition-colors",
                      gateway === "sep"
                        ? "border-primary bg-primary/5 font-bold"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="sep" id="page-gw-sep" />
                      <div>
                        <span className="font-bold text-foreground">پرداخت الکترونیک سامان کیش (سپ)</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          شبکه رسمی شاپرک • تسویه آنی
                        </p>
                      </div>
                    </div>
                  </label>

                  <label
                    htmlFor="page-gw-snapppay"
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border text-xs sm:text-sm cursor-pointer transition-colors",
                      gateway === "snapppay"
                        ? "border-primary bg-primary/5 font-bold"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="snapppay" id="page-gw-snapppay" />
                      <div>
                        <span className="font-bold text-foreground">پرداخت اقساطی اسنپ‌پی (BNPL)</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          پرداخت در ۴ قسط مساوی بدون کارمزد و ضامن
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[11px]">
                      ۴ قسط
                    </Badge>
                  </label>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Cancellation Policy and Agreement */}
            <Card className="border-border/80 rounded-2xl">
              <CardHeader className="p-4 sm:p-5 pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Info className="size-4 text-primary" />
                  قوانین کنسلی و شرایط اقامت
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs sm:text-sm space-y-1">
                  <div className="flex items-center justify-between font-bold text-foreground">
                    <span>قوانین استرداد: {policyInfo.title}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {policyInfo.description}
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
                    className="text-xs sm:text-sm text-foreground cursor-pointer leading-snug select-none"
                  >
                    <span className="font-bold">قوانین و مقررات آشیانک</span>، شرایط کنسلی این اقامتگاه و قوانین ورود و خروج را مطالعه نموده و با آن موافقم.
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Desktop Direct Pay CTA */}
            {isPending && (
              <div className="hidden lg:block pt-2">
                <Button
                  type="button"
                  disabled={!isFormValid}
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black text-base shadow-md hover:bg-primary/90 gap-2"
                >
                  <Lock className="size-5" />
                  انتقال به درگاه امن بانکی و پرداخت (
                  {formatFaPrice(reservation.total_price)} تومان)
                </Button>
                {!isFormValid && guestFormError && (
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    {guestFormError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Order Summary Sidebar (Desktop) */}
          <div className="lg:col-span-5 space-y-6">
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
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border p-3.5 px-4 shadow-lg flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-muted-foreground block">مبلغ کل قابل پرداخت:</span>
            <div className="font-black text-primary font-mono text-base">
              {formatFaPrice(reservation.total_price)} تومان
            </div>
          </div>
          <Button
            type="button"
            disabled={!isFormValid}
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex-1 max-w-[200px] h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm gap-2"
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
