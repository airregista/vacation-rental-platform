"use client"

import * as React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import {
  Smartphone,
  ArrowRight,
  ShieldCheck,
  Info,
  Timer,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react"

function toEnglishDigits(str: string): string {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"]
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"]
  let result = String(str ?? "")
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianDigits[i], "g"), i.toString())
    result = result.replace(new RegExp(arabicDigits[i], "g"), i.toString())
  }
  return result
}

// shortcut: digit-by-digit replacement keeps leading zeros (phone "0912…", timer "05"); the shared Intl helper in @/lib/format-fa drops them — do not dedupe.
function toPersianDigits(num: number | string): string {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"]
  return String(num).replace(/\d/g, (digit) => persianDigits[parseInt(digit, 10)])
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const formattedMins = mins.toString().padStart(2, "0")
  const formattedSecs = secs.toString().padStart(2, "0")
  return `${toPersianDigits(formattedMins)}:${toPersianDigits(formattedSecs)}`
}

export interface OtpFormProps {
  /** Pauses the resend countdown while the containing dialog is closed. */
  active?: boolean
  /** Called after a successful verify; the parent owns closing/redirecting. */
  onSuccess?: () => void
  className?: string
}

/**
 * Shared phone + OTP flow used by the auth modal and the /login page.
 * Every state transition, digit helper and API call lives here so the two
 * entry points can never drift apart.
 */
export function OtpForm({ active = true, onSuccess, className }: OtpFormProps) {
  const { sendOtp, verifyOtp } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [phone, setPhone] = useState<string>("")
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""])
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [timer, setTimer] = useState<number>(120)
  const [canResend, setCanResend] = useState<boolean>(false)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  // In-flight flag for OTP verification: the isSubmitting state guard
  // reads a stale render closure, so a rapid double-click (quick-fill
  // button, or 4th-digit auto-submit + immediate Enter) can pass it
  // twice before React re-renders. The ref updates synchronously.
  const verifyInFlightRef = useRef<boolean>(false)

  // 120-Second Resend Timer
  useEffect(() => {
    if (!active || step !== 2 || timer <= 0) return
    const timeout = setTimeout(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearTimeout(timeout)
  }, [active, step, timer])

  const handlePhoneSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isSubmitting) return
    setError(null)
    let normalizedPhone = toEnglishDigits(phone.trim()).replace(/[\s\-_]/g, "")
    if (normalizedPhone.startsWith("+98")) normalizedPhone = "0" + normalizedPhone.slice(3)
    else if (normalizedPhone.startsWith("0098")) normalizedPhone = "0" + normalizedPhone.slice(4)
    else if (normalizedPhone.startsWith("98") && normalizedPhone.length > 10) normalizedPhone = "0" + normalizedPhone.slice(2)
    else if (normalizedPhone.startsWith("9") && normalizedPhone.length === 10) normalizedPhone = "0" + normalizedPhone

    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError("شماره موبایل وارد شده باید ۱۱ رقمی بوده و با ۰۹ آغاز شود.")
      return
    }
    setIsSubmitting(true)
    try {
      await sendOtp(normalizedPhone)
      setPhone(normalizedPhone)
      setStep(2)
      setTimer(120)
      setCanResend(false)
      setOtpDigits(["", "", "", ""])
      setTimeout(() => {
        otpRefs.current[0]?.focus()
      }, 100)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("خطایی در ارسال کد تایید رخ داد. لطفاً مجدداً تلاش نمایید.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifySubmit = useCallback(
    async (codeToVerify?: string) => {
      if (verifyInFlightRef.current || isSubmitting) return
      verifyInFlightRef.current = true
      setError(null)
      const rawCode = codeToVerify ?? otpDigits.join("")
      const normalizedCode = toEnglishDigits(rawCode)
      if (normalizedCode.length !== 4) {
        verifyInFlightRef.current = false
        setError("لطفاً کد تایید ۴ رقمی را به طور کامل وارد نمایید.")
        return
      }
      setIsSubmitting(true)
      try {
        const normalizedPhone = toEnglishDigits(phone.trim())
        await verifyOtp(normalizedPhone, normalizedCode)
        onSuccess?.()
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setError(err.detail)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError("کد تایید وارد شده اشتباه یا منقضی شده است.")
        }
      } finally {
        verifyInFlightRef.current = false
        setIsSubmitting(false)
      }
    },
    [isSubmitting, otpDigits, phone, verifyOtp, onSuccess]
  )

  const handleDigitChange = (index: number, val: string) => {
    const digitsOnly = toEnglishDigits(val).replace(/\D/g, "")

    // Handle overwriting/editing a digit in an already filled box
    if (digitsOnly.length === 2 && otpDigits[index]) {
      const replacement = digitsOnly[0] === otpDigits[index] ? digitsOnly[1] : digitsOnly[0]
      const nextDigits = [...otpDigits]
      nextDigits[index] = replacement
      setOtpDigits(nextDigits)
      if (index < 3) {
        otpRefs.current[index + 1]?.focus()
      }
      if (nextDigits.every((d) => d.length === 1)) {
        handleVerifySubmit(nextDigits.join(""))
      }
      return
    }

    // Handle multi-character paste or fast autofill (e.g. 4-digit SMS autofill)
    if (digitsOnly.length > 1) {
      const chars = digitsOnly.slice(0, 4).split("")
      const nextDigits = [...otpDigits]
      chars.forEach((c, i) => {
        if (index + i < 4) nextDigits[index + i] = c
      })
      setOtpDigits(nextDigits)
      const nextFocus = Math.min(index + chars.length, 3)
      otpRefs.current[nextFocus]?.focus()
      if (nextDigits.every((d) => d.length === 1)) {
        handleVerifySubmit(nextDigits.join(""))
      }
      return
    }

    // Handle backspace / clear
    if (!digitsOnly && val === "") {
      const nextDigits = [...otpDigits]
      nextDigits[index] = ""
      setOtpDigits(nextDigits)
      return
    }

    // Ignore non-digit characters
    const singleDigit = digitsOnly.slice(-1)
    if (!singleDigit) {
      if (otpRefs.current[index]) {
        otpRefs.current[index]!.value = toPersianDigits(otpDigits[index])
      }
      return
    }

    const nextDigits = [...otpDigits]
    nextDigits[index] = singleDigit
    setOtpDigits(nextDigits)

    if (index < 3) {
      otpRefs.current[index + 1]?.focus()
    }

    if (nextDigits.every((d) => d.length === 1)) {
      handleVerifySubmit(nextDigits.join(""))
    }
  }

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      e.key.length === 1 &&
      !/^\d$/.test(toEnglishDigits(e.key))
    ) {
      e.preventDefault()
      return
    }

    if (e.key === "Enter") {
      e.preventDefault()
      if (!isSubmitting && otpDigits.every((d) => d.length === 1)) {
        handleVerifySubmit(otpDigits.join(""))
      }
    } else if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        e.preventDefault()
        const nextDigits = [...otpDigits]
        nextDigits[index - 1] = ""
        setOtpDigits(nextDigits)
        otpRefs.current[index - 1]?.focus()
      } else {
        const nextDigits = [...otpDigits]
        nextDigits[index] = ""
        setOtpDigits(nextDigits)
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault()
      otpRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < 3) {
      e.preventDefault()
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const englishPasted = toEnglishDigits(pastedData).replace(/\D/g, "").slice(0, 4)
    if (!englishPasted) return

    const chars = englishPasted.split("")
    const nextDigits = ["", "", "", ""]
    chars.forEach((c, i) => {
      if (i < 4) nextDigits[i] = c
    })
    setOtpDigits(nextDigits)
    const lastIdx = Math.min(chars.length - 1, 3)
    otpRefs.current[lastIdx]?.focus()
    if (nextDigits.every((d) => d.length === 1)) {
      handleVerifySubmit(nextDigits.join(""))
    }
  }

  const handleResend = async () => {
    if (!canResend || isSubmitting) return
    setError(null)
    setIsSubmitting(true)
    try {
      const normalizedPhone = toEnglishDigits(phone.trim())
      await sendOtp(normalizedPhone)
      setTimer(120)
      setCanResend(false)
      setOtpDigits(["", "", "", ""])
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("خطایی در ارسال مجدد کد رخ داد.")
      }
    } finally {
      setIsSubmitting(false)
      // Focus only after the inputs are re-enabled (disabled={isSubmitting});
      // focusing a disabled input is a no-op. Same 100ms pattern as
      // handlePhoneSubmit so the re-render has landed first.
      setTimeout(() => {
        otpRefs.current[0]?.focus()
      }, 100)
    }
  }

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {step === 1 ? (
        <>
          {/* Step 1 Header */}
          <div className="space-y-1.5 text-center sm:text-right">
            <h2 className="text-xl font-extrabold tracking-tight text-ink">
              ورود یا ثبت‌نام در آشیانک
            </h2>
            <p className="text-xs leading-relaxed text-ink-soft sm:text-sm">
              لطفاً شماره موبایل خود را وارد نمایید
            </p>
          </div>

          {/* Promotional value banner */}
          <div className="flex items-center justify-between rounded-xl border border-line/80 bg-paper-deep/50 p-3">
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brick">
                <Sparkles className="size-3" />
                هدیه ورود کاربران جدید
              </span>
              <p className="text-xs font-bold text-ink">
                ۲۰۰،۰۰۰ تومان تخفیف رزرو نخست
              </p>
            </div>
            <div className="flex flex-col gap-1 text-[10px] text-ink-soft">
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3 text-trust" />
                بیمه کامل اقامتگاه
              </span>
              <span className="flex items-center gap-1">
                <Info className="size-3 text-gold" />
                پشتیبانی ۲۴ ساعته
              </span>
            </div>
          </div>

          {/* Step 1 Form */}
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="mobile-input"
                className="flex items-center gap-1 text-xs font-semibold text-ink"
              >
                <span>شماره موبایل همراه</span>
                <span className="text-brick">*</span>
              </label>
              <div className="relative flex h-12 w-full items-center overflow-hidden rounded-xl border border-line bg-paper-card transition-all focus-within:border-brick focus-within:ring-2 focus-within:ring-brick/20">
                <div className="flex items-center justify-center pl-1 pr-3 text-ink-soft">
                  <Smartphone className="size-4" />
                </div>
                <Input
                  id="mobile-input"
                  type="tel"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={16}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  value={phone}
                  onChange={(e) => {
                    let val = toEnglishDigits(e.target.value).replace(/[\s\-_]/g, "")
                    if (val.startsWith("+98")) val = "0" + val.slice(3)
                    else if (val.startsWith("0098")) val = "0" + val.slice(4)
                    else if (val.startsWith("98") && val.length > 10) val = "0" + val.slice(2)
                    setPhone(val.replace(/[^\d+]/g, "").slice(0, 11))
                  }}
                  disabled={isSubmitting}
                  className="h-full border-0 px-2 text-left font-mono text-sm tracking-widest focus-visible:ring-0 focus-visible:ring-offset-0"
                  required
                />
                <div className="flex h-full select-none items-center gap-1 border-r border-line bg-paper-deep/60 pl-3 pr-2 font-mono text-xs font-bold">
                  <span>+۹۸</span>
                </div>
              </div>
              <p className="flex items-center gap-1 text-[11px] text-ink-soft">
                <Info className="size-3" />
                شماره همراه ۱۱ رقمی را با صفر اول وارد فرمایید (مانند ۰۹۱۲۳۴۵۶۷۸۹)
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="size-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !phone.trim()}
              className="h-11 w-full gap-2 rounded-xl text-sm font-bold shadow-soft"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>در حال ارسال کد...</span>
                </>
              ) : (
                <>
                  <span>دریافت کد تایید</span>
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </>
              )}
            </Button>
          </form>
        </>
      ) : (
        <>
          {/* Step 2 Header & Edit Phone Button */}
          <div className="space-y-2 text-center sm:text-right">
            <Button
              type="button"
              variant="link"
              onClick={() => {
                setStep(1)
                setError(null)
              }}
              className="inline-flex h-auto items-center gap-1 p-0 text-xs font-medium text-brick hover:underline"
            >
              <ArrowRight className="size-3.5" />
              <span>ویرایش شماره موبایل</span>
            </Button>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">
              کد تایید پیامک‌شده را وارد کنید
            </h2>
            <p className="text-xs text-ink-soft sm:text-sm">
              کد ۴ رقمی به شماره{" "}
              <span className="font-bold font-mono text-ink" dir="ltr">
                {toPersianDigits(phone)}
              </span>{" "}
              ارسال گردید.
            </p>
          </div>

          {/* Mandatory Test Code Banner */}
          <Alert className="border-gold/40 bg-gold/10 p-3 text-ink sm:p-4">
            <div className="flex w-full flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-gold" />
                <div className="space-y-0.5">
                  <AlertTitle className="text-sm font-bold text-ink">
                    کد تایید آزمایشی سیستم
                  </AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed text-ink-soft">
                    جهت بررسی و ارزیابی سامانه، کد آزمایشی{" "}
                    <strong className="font-mono text-ink">۱۲۳۴</strong> را وارد نمایید.
                  </AlertDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const testCode = ["1", "2", "3", "4"]
                  setOtpDigits(testCode)
                  otpRefs.current[3]?.focus()
                  handleVerifySubmit("1234")
                }}
                disabled={isSubmitting}
                className="h-8 shrink-0 self-end rounded-lg border-gold/40 px-2.5 font-mono text-xs font-bold text-ink hover:bg-gold/20 sm:self-center"
              >
                درج خودکار ۱۲۳۴
              </Button>
            </div>
          </Alert>

          {/* Step 2 OTP 4-Digit Input */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-center text-xs font-semibold text-ink">
                کد تایید ۴ رقمی
              </label>
              <div className="flex justify-center gap-3" dir="ltr">
                {otpDigits.map((digit, idx) => (
                  <Input
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={idx === 0 ? "one-time-code" : "off"}
                    maxLength={idx === 0 ? 4 : 2}
                    value={toPersianDigits(digit)}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                    onPaste={handlePaste}
                    disabled={isSubmitting}
                    className="h-14 w-12 rounded-xl border-line bg-paper-card text-center font-mono text-xl font-bold shadow-soft focus:border-brick"
                  />
                ))}
              </div>
            </div>

            {/* 120-Second Resend Timer */}
            <div className="flex items-center justify-between rounded-xl border border-line bg-paper-deep/60 p-3">
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <Timer className="size-4 text-brick" />
                <span>زمان باقی‌مانده:</span>
                <span className="font-bold font-mono text-brick">{formatTimer(timer)}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canResend || isSubmitting}
                onClick={handleResend}
                className="h-8 px-2 text-xs font-semibold text-brick hover:bg-paper-card disabled:text-ink-soft disabled:opacity-50"
              >
                ارسال مجدد کد تایید
              </Button>
            </div>

            {error && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="size-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="button"
              onClick={() => handleVerifySubmit()}
              disabled={isSubmitting || otpDigits.some((d) => !d)}
              className="h-11 w-full gap-2 rounded-xl text-sm font-bold shadow-soft"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>در حال بررسی کد...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4" />
                  <span>تایید و ورود</span>
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
