"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CreditCard,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Luggage,
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
import { cn } from "@/lib/utils"
import type {
  ReservationDetail,
  PaymentInitiateResponse,
  PaymentResponse,
} from "@/types/checkout"

export interface PaymentGatewayModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: ReservationDetail
  onSuccess: (payment: PaymentResponse) => void
  onOpenInvoice?: (payment: PaymentResponse) => void
  initialGateway?: string
  onStatusChange?: (status: "cancelled", reason: string) => void
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16)
  const parts = []
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4))
  }
  return parts.join(" - ")
}

export function PaymentGatewayModal({
  isOpen,
  onClose,
  reservation,
  onSuccess,
  onOpenInvoice,
  initialGateway = "mellat",
  onStatusChange,
}: PaymentGatewayModalProps) {
  const router = useRouter()

  const [paymentData, setPaymentData] = React.useState<PaymentInitiateResponse | null>(null)
  const [isInitiating, setIsInitiating] = React.useState(false)
  const [initiateError, setInitiateError] = React.useState<string | null>(null)

  const [gateway, setGateway] = React.useState<string>(initialGateway || "mellat")
  const [prevGatewayProp, setPrevGatewayProp] = React.useState(initialGateway)

  if (initialGateway !== prevGatewayProp) {
    setPrevGatewayProp(initialGateway)
    setGateway(initialGateway || "mellat")
  }
  const [cardNumber, setCardNumber] = React.useState("6104 3378 9821 4452")
  const [cvv2, setCvv2] = React.useState("345")
  const [expMonth, setExpMonth] = React.useState("08")
  const [expYear, setExpYear] = React.useState("06")
  const [otp, setOtp] = React.useState("")
  const [otpTimer, setOtpTimer] = React.useState(0)
  const [isRequestingOtp, setIsRequestingOtp] = React.useState(false)

  const [isVerifying, setIsVerifying] = React.useState(false)
  const [verifyError, setVerifyError] = React.useState<string | null>(null)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [completedPayment, setCompletedPayment] = React.useState<PaymentResponse | null>(null)

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

  // Initiate payment session on dialog open
  React.useEffect(() => {
    if (!isOpen) return

    // If already initiated for this reservation and pending, do not re-post
    if (hasInitiatedRef.current === reservation.id && paymentData) {
      return
    }

    let isCancelled = false
    const initiatePayment = async () => {
      setIsInitiating(true)
      setInitiateError(null)
      setVerifyError(null)
      setIsSuccess(false)
      setCompletedPayment(null)
      try {
        const response = await apiClient.post<PaymentInitiateResponse>("/payments/checkout", {
          reservation_id: reservation.id,
        })
        if (!isCancelled) {
          setPaymentData(response)
          hasInitiatedRef.current = reservation.id
        }
      } catch (err) {
        if (!isCancelled) {
          if (err instanceof ApiError) {
            setInitiateError(err.detail)
            if (err.status === 409 || (err.status === 400 && err.detail.toLowerCase().includes("expire"))) {
              hasInitiatedRef.current = null
              setPaymentData(null)
              onStatusChange?.("cancelled", err.detail)
            }
          } else {
            setInitiateError("خطا در برقراری ارتباط با درگاه شاپرک. لطفا مجددا تلاش کنید.")
          }
        }
      } finally {
        if (!isCancelled) {
          setIsInitiating(false)
        }
      }
    }

    initiatePayment()

    return () => {
      isCancelled = true
    }
  }, [isOpen, reservation.id, paymentData, onStatusChange])

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
        setCompletedPayment(response)
        setIsSuccess(true)
        onSuccess(response)
      } else {
        setVerifyError("تراکنش بانکی تایید نشد یا در وضعیت ناموفق قرار دارد.")
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          const conflictReason = "متاسفانه این اقامتگاه در این بازه تاریخی هم‌اکنون توسط کاربر دیگری رزرو شد."
          setVerifyError(conflictReason)
          hasInitiatedRef.current = null
          setPaymentData(null)
          onStatusChange?.("cancelled", conflictReason)
        } else if (err.status === 400 && err.detail.toLowerCase().includes("expire")) {
          const expiredReason = "مهلت پرداخت ۳۰ دقیقه‌ای این رزرو به پایان رسیده است."
          setVerifyError(expiredReason)
          hasInitiatedRef.current = null
          setPaymentData(null)
          onStatusChange?.("cancelled", expiredReason)
        } else {
          setVerifyError(err.detail)
        }
      } else {
        setVerifyError("خطایی در تایید پرداخت رخ داد. در صورت کسر وجه ظرف ۷۲ ساعت مسترد خواهد شد.")
      }
    } finally {
      setIsVerifying(false)
    }
  }

  const cleanCardDigits = cardNumber.replace(/\D/g, "")
  const isFormValid =
    cleanCardDigits.length === 16 &&
    cvv2.length >= 3 &&
    expMonth.length === 2 &&
    expYear.length === 2 &&
    otp.length >= 5

  const formatToman = (amount: number | string) => {
    return `${new Intl.NumberFormat("fa-IR").format(Number(amount))} تومان`
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
        {/* Success View */}
        {isSuccess && completedPayment ? (
          <div className="py-4 space-y-6 text-center">
            <div className="mx-auto size-16 sm:size-20 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 animate-in zoom-in-75">
              <CheckCircle2 className="size-10 sm:size-12" />
            </div>

            <div className="space-y-1.5">
              <DialogTitle className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">
                پرداخت شما با موفقیت انجام شد
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                رزرو شما نهایی شد و اطلاعات تاییدیه برای شما ثبت گردید.
              </DialogDescription>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-muted/50 border border-border/80 rounded-2xl p-4 sm:p-5 text-right space-y-3 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">شماره پیگیری شاپرک:</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {completedPayment.tracking_code || paymentData?.tracking_code}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">شناسه پرداخت:</span>
                <span className="font-mono font-medium text-foreground">
                  {completedPayment.id}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">مبلغ پرداختی:</span>
                <span className="font-bold text-primary font-mono text-sm sm:text-base">
                  {formatToman(completedPayment.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">درگاه پذیرنده:</span>
                <span className="font-medium text-foreground">
                  {gateway === "mellat"
                    ? "به‌پرداخت ملت"
                    : gateway === "sep"
                    ? "سامان کیش (سپ)"
                    : "اسنپ‌پی (اقساطی)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">وضعیت رزرو:</span>
                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                  تایید و نهایی‌شده
                </Badge>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {onOpenInvoice && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenInvoice(completedPayment)}
                  className="flex-1 gap-2 rounded-xl h-11"
                >
                  <FileText className="size-4" />
                  مشاهده فاکتور رسمی
                </Button>
              )}
              <Button
                type="button"
                onClick={() => {
                  onClose()
                  router.push("/trips")
                }}
                className="flex-1 gap-2 rounded-xl h-11 bg-primary text-primary-foreground font-bold"
              >
                <Luggage className="size-4" />
                مشاهده سفرهای من
              </Button>
            </div>
          </div>
        ) : (
          /* Payment Form View */
          <div className="space-y-5">
            {/* Header */}
            <DialogHeader className="text-right space-y-1">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <CreditCard className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                      درگاه امن پرداخت اینترنتی شاپرک
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      اتصال مستقیم به سوئیچ مرکزی شبکه پرداخت الکترونیک کشور
                    </DialogDescription>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <Lock className="size-3.5" />
                  <span>SSL 256-bit</span>
                </div>
              </div>
            </DialogHeader>

            {/* Loading or Initiation Error */}
            {isInitiating && (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm font-medium">در حال اتصال امن به شبکه پرداخت شاپرک...</p>
              </div>
            )}

            {initiateError && (
              <div className="space-y-4 py-2">
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>خطا در اتصال به درگاه پرداخت</AlertTitle>
                  <AlertDescription className="text-sm mt-1">{initiateError}</AlertDescription>
                </Alert>
                <Button variant="outline" onClick={onClose} className="w-full">
                  بازگشت
                </Button>
              </div>
            )}

            {!isInitiating && !initiateError && paymentData && (
              <form onSubmit={handleVerify} className="space-y-4">
                {/* Gateway Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground block">
                    انتخاب درگاه بانکی
                  </label>
                  <RadioGroup
                    value={gateway}
                    onValueChange={setGateway}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                  >
                    <label
                      htmlFor="gw-mellat"
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-colors",
                        gateway === "mellat"
                          ? "border-primary bg-primary/5 font-bold"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="mellat" id="gw-mellat" />
                        <span>به‌پرداخت ملت</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        پیشنهادی
                      </Badge>
                    </label>

                    <label
                      htmlFor="gw-sep"
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-colors",
                        gateway === "sep"
                          ? "border-primary bg-primary/5 font-bold"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="sep" id="gw-sep" />
                        <span>سامان کیش (سپ)</span>
                      </div>
                    </label>

                    <label
                      htmlFor="gw-snapppay"
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-colors",
                        gateway === "snapppay"
                          ? "border-primary bg-primary/5 font-bold"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="snapppay" id="gw-snapppay" />
                        <span>اسنپ‌پی (BNPL)</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        ۴ قسط
                      </Badge>
                    </label>
                  </RadioGroup>
                </div>

                {/* Amount and Tracking Code Banner */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between text-xs sm:text-sm">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground block text-[11px]">مبلغ تراکنش:</span>
                    <span className="font-black text-primary font-mono text-base">
                      {formatToman(paymentData.amount)}
                    </span>
                  </div>
                  <div className="text-left space-y-0.5">
                    <span className="text-muted-foreground block text-[11px]">شناسه پیگیری:</span>
                    <span className="font-mono font-medium text-foreground text-xs">
                      {paymentData.tracking_code}
                    </span>
                  </div>
                </div>

                {/* Card Fields */}
                <div className="space-y-3 bg-muted/30 p-3.5 sm:p-4 rounded-xl border border-border/70">
                  {/* Card Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>شماره کارت بانکی ۱۶ رقمی</span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        تمامی کارت‌های شتاب
                      </span>
                    </label>
                    <Input
                      type="text"
                      dir="ltr"
                      inputMode="numeric"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="XXXX - XXXX - XXXX - XXXX"
                      className="font-mono text-center tracking-widest text-base font-bold bg-background h-11"
                    />
                  </div>

                  {/* CVV2 and Expiry */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground block">
                        کد امنیتی CVV2
                      </label>
                      <Input
                        type="password"
                        dir="ltr"
                        inputMode="numeric"
                        maxLength={4}
                        value={cvv2}
                        onChange={(e) => setCvv2(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="۳ یا ۴ رقم"
                        className="font-mono text-center text-sm bg-background h-11"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground block">
                        تاریخ انقضا (ماه / سال)
                      </label>
                      <div className="flex items-center gap-1.5" dir="ltr">
                        <Input
                          type="text"
                          inputMode="numeric"
                          maxLength={2}
                          value={expMonth}
                          onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                          placeholder="ماه"
                          className="font-mono text-center text-sm bg-background h-11 px-1"
                        />
                        <span className="text-muted-foreground font-bold">/</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          maxLength={2}
                          value={expYear}
                          onChange={(e) => setExpYear(e.target.value.replace(/\D/g, "").slice(0, 2))}
                          placeholder="سال"
                          className="font-mono text-center text-sm bg-background h-11 px-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Password (رمز پویا) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      رمز پویا / دوم
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        dir="ltr"
                        inputMode="numeric"
                        maxLength={8}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="رمز ارسال‌شده به تلفن همراه"
                        className="font-mono text-center text-sm bg-background flex-1 h-11"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={otpTimer > 0 || isRequestingOtp}
                        onClick={handleRequestOtp}
                        className="text-xs shrink-0 h-11 px-3"
                      >
                        {isRequestingOtp ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : otpTimer > 0 ? (
                          `${new Intl.NumberFormat("fa-IR").format(otpTimer)} ثانیه`
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
                    <AlertDescription className="text-xs mt-1">{verifyError}</AlertDescription>
                  </Alert>
                )}

                {/* Security Footer Notice */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="size-3.5 text-emerald-600" />
                    <span>تایید هویت امن شاپرک و بانک مرکزی</span>
                  </div>
                  <span className="font-mono">IP: 185.143.***.***</span>
                </div>

                {/* Submit Actions */}
                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isVerifying}
                    className="sm:w-1/3 rounded-xl h-11 text-xs"
                  >
                    انصراف
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isFormValid || isVerifying}
                    className="flex-1 rounded-xl h-11 bg-primary text-primary-foreground font-bold text-sm gap-2"
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
        )}
      </DialogContent>
    </Dialog>
  )
}
