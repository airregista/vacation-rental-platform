"use client"

import * as React from "react"
import {
  AlertCircle,
  Check,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { apiClient, ApiError } from "@/lib/api-client"
import { toPersianDigits } from "@/lib/format-fa"
import { cn } from "@/lib/utils"
import {
  type PaymentGatewayModalProps,
  type PaymentInitiateResponse,
  type PaymentResponse,
} from "@/types/checkout"
import { formatFaPrice } from "@/lib/checkout-format"

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"

/** Normalise Persian/Arabic-Indic digits to Latin for validation only. */
function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
}

function onlyDigits(value: string, maxLength: number): string {
  return toLatinDigits(value).replace(/\D/g, "").slice(0, maxLength)
}

/** Groups a raw 16-digit card number and renders it with Persian digits. */
function formatCardNumberFa(digits: string): string {
  const clean = digits.replace(/\D/g, "").slice(0, 16)
  const parts: string[] = []
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4))
  }
  return toPersianDigits(parts.join(" - "))
}

const GATEWAYS = [
  {
    value: "mellat",
    label: "به‌پرداخت ملت",
    badge: "پیشنهادی",
    badgeVariant: "secondary" as const,
  },
  {
    value: "sep",
    label: "سامان کیش (سپ)",
  },
  {
    value: "snapppay",
    label: "اسنپ‌پی (BNPL)",
    badge: "۴ قسط",
    badgeVariant: "outline" as const,
  },
] as const

const CONFLICT_REASON =
  "متاسفانه این اقامتگاه در این بازه تاریخی هم‌اکنون توسط کاربر دیگری رزرو شد."
const EXPIRED_REASON = "مهلت پرداخت ۳۰ دقیقه‌ای این رزرو به پایان رسیده است."

function getInitiateError(err: ApiError): {
  message: string
  terminalReason?: string
} {
  const detail = err.detail.toLowerCase()

  if (err.status === 404) {
    return { message: "رزرو مورد نظر یافت نشد." }
  }
  if (err.status === 403) {
    return { message: "شما دسترسی پرداخت این رزرو را ندارید." }
  }
  if (err.status === 409) {
    return { message: CONFLICT_REASON, terminalReason: CONFLICT_REASON }
  }
  if (
    detail.includes("expire") ||
    detail.includes("timeout") ||
    detail.includes("ttl")
  ) {
    return { message: EXPIRED_REASON, terminalReason: EXPIRED_REASON }
  }
  if (detail.includes("only 'pending'") || detail.includes("no longer pending")) {
    return { message: "این رزرو دیگر در وضعیت قابل پرداخت نیست." }
  }
  if (detail.includes("zero")) {
    return { message: "مبلغ این رزرو صفر است و نیازی به پرداخت ندارد." }
  }
  return {
    message: "خطا در برقراری ارتباط با درگاه پرداخت. لطفا دوباره تلاش کنید.",
  }
}

function getVerifyError(err: ApiError): {
  message: string
  terminalReason?: string
} {
  const detail = err.detail.toLowerCase()

  if (err.status === 409) {
    return { message: CONFLICT_REASON, terminalReason: CONFLICT_REASON }
  }
  if (
    err.status === 400 &&
    (detail.includes("expire") ||
      detail.includes("timeout") ||
      detail.includes("ttl"))
  ) {
    return { message: EXPIRED_REASON, terminalReason: EXPIRED_REASON }
  }
  if (detail.includes("invalid tracking")) {
    return { message: "اطلاعات تراکنش با درگاه بانکی مطابقت ندارد." }
  }
  if (detail.includes("no longer pending")) {
    return { message: "این رزرو دیگر در وضعیت قابل پرداخت نیست." }
  }
  if (detail.includes("already") || detail.includes("failed")) {
    return {
      message: "تراکنش بانکی تایید نشد یا در وضعیت ناموفق قرار دارد.",
    }
  }
  if (err.status === 403) {
    return { message: "شما دسترسی پرداخت این رزرو را ندارید." }
  }
  if (err.status === 404) {
    return {
      message: "رکورد پرداخت یافت نشد. لطفا صفحه را دوباره بارگذاری کنید.",
    }
  }
  return {
    message: "خطایی در تایید پرداخت رخ داد. لطفا دوباره تلاش کنید.",
  }
}

export function PaymentGatewayModal({
  isOpen,
  onClose,
  reservation,
  onSuccess,
  initialGateway = "mellat",
  onStatusChange,
  onFailure,
}: PaymentGatewayModalProps) {
  const [paymentData, setPaymentData] =
    React.useState<PaymentInitiateResponse | null>(null)
  const [isInitiating, setIsInitiating] = React.useState(false)
  const [initiateError, setInitiateError] = React.useState<string | null>(null)

  const [gateway, setGateway] = React.useState<string>(initialGateway || "mellat")
  const [prevGatewayProp, setPrevGatewayProp] = React.useState(initialGateway)

  if (initialGateway !== prevGatewayProp) {
    setPrevGatewayProp(initialGateway)
    setGateway(initialGateway || "mellat")
  }
  const [cardNumber, setCardNumber] = React.useState("")
  const [cvv2, setCvv2] = React.useState("")
  const [expMonth, setExpMonth] = React.useState("")
  const [expYear, setExpYear] = React.useState("")
  const [otp, setOtp] = React.useState("")
  const [otpTimer, setOtpTimer] = React.useState(0)
  const [isRequestingOtp, setIsRequestingOtp] = React.useState(false)

  const [isVerifying, setIsVerifying] = React.useState(false)
  const [verifyError, setVerifyError] = React.useState<string | null>(null)

  const hasInitiatedRef = React.useRef<number | null>(null)
  const otpTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Cleanup pending OTP timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (otpTimeoutRef.current) {
        clearTimeout(otpTimeoutRef.current)
      }
    }
  }, [])

  // Memoized initiate payment handler (strictly guarded to pending reservations)
  const initiatePayment = React.useCallback(async () => {
    if (reservation.status !== "pending") return
    // Claim the initiation synchronously, before the await (T2): closing and
    // reopening the modal mid-flight must not start a second POST.
    hasInitiatedRef.current = reservation.id
    setIsInitiating(true)
    setInitiateError(null)
    try {
      const response = await apiClient.post<PaymentInitiateResponse>(
        "/payments/checkout",
        {
          reservation_id: reservation.id,
        }
      )
      setPaymentData(response)
    } catch (err) {
      hasInitiatedRef.current = null
      if (err instanceof ApiError) {
        const { message, terminalReason } = getInitiateError(err)
        setInitiateError(message)
        if (terminalReason) {
          onStatusChange?.("cancelled", terminalReason)
        }
      } else {
        setInitiateError(
          "خطا در برقراری ارتباط با درگاه شاپرک. لطفا مجددا تلاش کنید."
        )
      }
    } finally {
      setIsInitiating(false)
    }
  }, [reservation.id, reservation.status, onStatusChange])

  // Clear the payment session when the reservation prop changes (T5): a
  // session belongs to one reservation id and must never verify another's.
  // Declared before the initiation effect so it runs first on id change.
  const prevReservationIdRef = React.useRef(reservation.id)
  React.useEffect(() => {
    if (prevReservationIdRef.current !== reservation.id) {
      prevReservationIdRef.current = reservation.id
      hasInitiatedRef.current = null
      setPaymentData(null)
    }
  }, [reservation.id])

  // Initiate payment session on dialog open. The initiation is NOT reset on
  // close: reopening the gateway must reuse the existing payment session,
  // otherwise every reopen creates a duplicate pending Payment row (R3).
  // The ref is only cleared on initiation error (and by the manual retry).
  React.useEffect(() => {
    if (!isOpen || reservation.status !== "pending") {
      return
    }

    // If a payment session already exists for this reservation, do not re-post
    if (
      hasInitiatedRef.current === reservation.id ||
      paymentData?.reservation_id === reservation.id
    ) {
      return
    }

    initiatePayment()
  }, [isOpen, reservation.id, reservation.status, paymentData, initiatePayment])

  // OTP cooldown timer
  React.useEffect(() => {
    if (otpTimer <= 0) return
    const timer = setInterval(() => {
      setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [otpTimer])

  const handleRequestOtp = () => {
    setIsRequestingOtp(true)
    if (otpTimeoutRef.current) {
      clearTimeout(otpTimeoutRef.current)
    }
    otpTimeoutRef.current = setTimeout(() => {
      setOtp("849201")
      setOtpTimer(120)
      setIsRequestingOtp(false)
    }, 600)
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentData) return

    setIsVerifying(true)
    setVerifyError(null)

    try {
      const response = await apiClient.post<PaymentResponse>("/payments/verify", {
        payment_id: paymentData.payment_id,
        tracking_code: paymentData.tracking_code,
        simulate_success: true,
      })

      if (response.status === "success") {
        // The parent flips the reservation to confirmed in the same batch and
        // routes to the dedicated success page. The inline confirmed banner
        // remains for direct visits / browser-back.
        onSuccess(response)
        return
      }

      const reason = "تراکنش بانکی تایید نشد یا در وضعیت ناموفق قرار دارد."
      setVerifyError(reason)
      onFailure?.(reason)
    } catch (err) {
      if (err instanceof ApiError) {
        const { message, terminalReason } = getVerifyError(err)
        setVerifyError(message)
        if (terminalReason) {
          onStatusChange?.("cancelled", terminalReason)
          onFailure?.(terminalReason)
        }
      } else {
        setVerifyError(
          "خطایی در تایید پرداخت رخ داد. در صورت کسر وجه ظرف ۷۲ ساعت مسترد خواهد شد."
        )
      }
    } finally {
      setIsVerifying(false)
    }
  }

  const isFormValid =
    cardNumber.length === 16 &&
    cvv2.length >= 3 &&
    expMonth.length === 2 &&
    expYear.length === 2 &&
    otp.length >= 5

  const formatToman = (amount: number | string | null | undefined) => {
    return `${formatFaPrice(amount)} تومان`
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-3xl border-line bg-paper p-4 sm:p-6">
        <div className="space-y-5">
          {/* Header */}
          <DialogHeader className="space-y-1 text-right">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3 pl-8 sm:pl-10">
              <div className="flex items-start gap-2.5">
                <div className="rounded-xl bg-brick-soft/60 p-2 text-brick-deep">
                  <CreditCard className="size-5" />
                </div>
                <div className="space-y-0.5">
                  <DialogTitle className="text-base font-black tracking-tight text-ink sm:text-lg">
                    درگاه امن پرداخت اینترنتی شاپرک
                  </DialogTitle>
                  <DialogDescription className="text-xs leading-5 text-ink-soft">
                    اتصال مستقیم به سوئیچ مرکزی شبکه پرداخت الکترونیک کشور
                  </DialogDescription>
                </div>
              </div>
              <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-trust/25 bg-trust-soft/60 px-2.5 py-1 text-[11px] font-semibold text-trust sm:flex">
                <Lock className="size-3.5" />
                <span className="tabular-nums">اتصال امن ۲۵۶ بیتی</span>
              </div>
            </div>
          </DialogHeader>

          {/* Loading or Initiation Error */}
          {isInitiating && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-ink-soft">
              <Loader2 className="size-8 animate-spin text-brick" />
              <p className="text-sm font-medium">
                در حال اتصال امن به شبکه پرداخت شاپرک...
              </p>
            </div>
          )}

          {initiateError && (
            <div className="space-y-4 py-2">
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>خطا در اتصال به درگاه پرداخت</AlertTitle>
                <AlertDescription className="mt-1 text-sm">
                  {initiateError}
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 border-line bg-paper-card text-ink shadow-none hover:bg-paper"
                >
                  بازگشت
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    hasInitiatedRef.current = null
                    setInitiateError(null)
                    initiatePayment()
                  }}
                  className="flex-1 font-bold"
                >
                  تلاش مجدد
                </Button>
              </div>
            </div>
          )}

          {!isInitiating && !initiateError && paymentData && (
            <form onSubmit={handleVerify} className="space-y-4">
              {/* Gateway Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-ink">
                  انتخاب درگاه بانکی
                </label>
                <RadioGroup
                  value={gateway}
                  onValueChange={setGateway}
                  aria-label="انتخاب درگاه بانکی"
                  className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                >
                  {GATEWAYS.map((item) => {
                    const isActive = gateway === item.value
                    return (
                      <label
                        key={item.value}
                        htmlFor={`gw-${item.value}`}
                        className={cn(
                          "relative flex cursor-pointer items-center justify-between gap-2 rounded-2xl border p-3 text-xs transition-all",
                          isActive
                            ? "border-brick bg-brick-soft/60 font-bold shadow-soft ring-2 ring-brick/15"
                            : "border-line bg-paper hover:border-line-strong hover:bg-paper-deep/30"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <RadioGroupItem
                            value={item.value}
                            id={`gw-${item.value}`}
                            className="border-line-strong data-[state=checked]:border-brick"
                          />
                          <span className="truncate text-ink">{item.label}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {"badge" in item && item.badge && (
                            <Badge
                              variant={item.badgeVariant}
                              className={cn(
                                "px-1.5 py-0 text-[10px]",
                                isActive ? "font-bold" : "font-medium"
                              )}
                            >
                              {item.badge}
                            </Badge>
                          )}
                          {isActive && (
                            <span
                              className="flex size-5 items-center justify-center rounded-full bg-brick text-on-brick"
                              aria-hidden="true"
                            >
                              <Check className="size-3.5" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </RadioGroup>
              </div>

              {/* Amount and Tracking Code Banner */}
              <div className="flex flex-col gap-2 rounded-2xl border border-brick/20 bg-brick-soft/40 p-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
                <div className="space-y-0.5">
                  <span className="block text-[11px] text-ink-soft">
                    مبلغ تراکنش
                  </span>
                  <span className="text-base font-black tabular-nums text-brick">
                    {formatToman(paymentData.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-brick/15 pt-2 sm:flex-col sm:items-start sm:border-0 sm:pt-0 sm:text-left">
                  <span className="block text-[11px] text-ink-soft">
                    شناسه پیگیری
                  </span>
                  <span
                    dir="ltr"
                    className="text-xs font-semibold tabular-nums text-ink"
                  >
                    {toPersianDigits(paymentData.tracking_code)}
                  </span>
                </div>
              </div>

              {/* Card Fields */}
              <div className="space-y-3 rounded-2xl border border-line/70 bg-paper-deep/40 p-3.5 sm:p-4">
                {/* Card Number */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="pg-card-number"
                    className="flex items-center justify-between gap-2 text-xs font-semibold text-ink"
                  >
                    <span>شماره کارت بانکی ۱۶ رقمی</span>
                    <span className="text-[11px] font-normal text-ink-soft">
                      تمامی کارت‌های شتاب
                    </span>
                  </label>
                  <Input
                    id="pg-card-number"
                    type="text"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={formatCardNumberFa(cardNumber)}
                    onChange={(e) =>
                      setCardNumber(onlyDigits(e.target.value, 16))
                    }
                    placeholder="۶۰۳۷ - ۹۹۷۵ - ۰۰۰۰ - ۰۰۰۰"
                    className="h-11 border-line bg-paper text-center text-base font-bold tabular-nums tracking-wider text-ink"
                  />
                </div>

                {/* CVV2 and Expiry */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="pg-cvv2"
                      className="block text-xs font-semibold text-ink"
                    >
                      کد امنیتی CVV
                    </label>
                    <Input
                      id="pg-cvv2"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      maxLength={4}
                      value={toPersianDigits(cvv2)}
                      onChange={(e) => setCvv2(onlyDigits(e.target.value, 4))}
                      placeholder="۳ یا ۴ رقم"
                      className="h-11 border-line bg-paper text-center text-sm tabular-nums text-ink"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="pg-exp-month"
                      className="block text-xs font-semibold text-ink"
                    >
                      تاریخ انقضا (ماه / سال)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        id="pg-exp-month"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-exp-month"
                        maxLength={2}
                        value={toPersianDigits(expMonth)}
                        onChange={(e) =>
                          setExpMonth(onlyDigits(e.target.value, 2))
                        }
                        placeholder="ماه"
                        className="h-11 border-line bg-paper px-1 text-center text-sm tabular-nums text-ink"
                      />
                      <span className="font-bold text-ink-soft">/</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-exp-year"
                        maxLength={2}
                        value={toPersianDigits(expYear)}
                        onChange={(e) =>
                          setExpYear(onlyDigits(e.target.value, 2))
                        }
                        placeholder="سال"
                        aria-label="سال انقضا"
                        className="h-11 border-line bg-paper px-1 text-center text-sm tabular-nums text-ink"
                      />
                    </div>
                  </div>
                </div>

                {/* Dynamic Password (رمز پویا) */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="pg-otp"
                    className="block text-xs font-semibold text-ink"
                  >
                    رمز پویا / دوم
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="pg-otp"
                      type="password"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      value={otp}
                      onChange={(e) => setOtp(onlyDigits(e.target.value, 8))}
                      placeholder="رمز ارسال‌شده به تلفن همراه"
                      className="h-11 flex-1 border-line bg-paper text-center text-sm tabular-nums text-ink"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={otpTimer > 0 || isRequestingOtp}
                      onClick={handleRequestOtp}
                      className="h-11 shrink-0 px-3 text-xs font-bold"
                    >
                      {isRequestingOtp ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : otpTimer > 0 ? (
                        `${toPersianDigits(otpTimer)} ثانیه`
                      ) : (
                        "دریافت رمز پویا"
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Verification Error */}
              {verifyError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>پرداخت ناموفق</AlertTitle>
                  <AlertDescription className="mt-1 text-xs">
                    {verifyError}
                  </AlertDescription>
                </Alert>
              )}

              {/* Security Footer Notice */}
              <div className="flex flex-wrap items-center justify-between gap-1 pt-1 text-[11px] text-ink-soft">
                <div className="flex items-center gap-1">
                  <ShieldCheck className="size-3.5 text-trust" />
                  <span>تایید هویت امن شاپرک و بانک مرکزی</span>
                </div>
                <span className="tabular-nums">
                  آی‌پی:{" "}
                  <bdi dir="ltr">{toPersianDigits("185.143.***.***")}</bdi>
                </span>
              </div>

              {/* Submit Actions */}
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isVerifying}
                  className="h-11 border-line bg-paper-card text-xs text-ink shadow-none hover:bg-paper sm:w-1/3"
                >
                  انصراف
                </Button>
                <Button
                  type="submit"
                  disabled={!isFormValid || isVerifying}
                  className="h-11 flex-1 gap-2 text-sm font-bold"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      در حال تایید و کسر از حساب...
                    </>
                  ) : (
                    `پرداخت و تایید نهایی (${formatToman(paymentData.amount)})`
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
