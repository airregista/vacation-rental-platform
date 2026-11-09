"use client"

import * as React from "react"
import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react"
import { useAuth } from "@/context/auth-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { ApiError } from "@/lib/api-client"
import {
  Smartphone,
  ArrowRight,
  ShieldCheck,
  Headphones,
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

function subscribeMediaQuery(callback: () => void) {
  const mql = window.matchMedia("(max-width: 639px)")
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getMobileSnapshot(): boolean {
  return window.matchMedia("(max-width: 639px)").matches
}

function getServerMobileSnapshot(): boolean {
  return false
}

function subscribeMounted() {
  return () => {}
}

function getMountedSnapshot(): boolean {
  return true
}

function getServerMountedSnapshot(): boolean {
  return false
}

export function OtpModal() {
  const { isOtpModalOpen, closeOtpModal, sendOtp, verifyOtp } = useAuth()

  const mounted = useSyncExternalStore(
    subscribeMounted,
    getMountedSnapshot,
    getServerMountedSnapshot
  )
  const isMobile = useSyncExternalStore(
    subscribeMediaQuery,
    getMobileSnapshot,
    getServerMobileSnapshot
  )

  const [step, setStep] = useState<1 | 2>(1)
  const [phone, setPhone] = useState<string>("")
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""])
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [timer, setTimer] = useState<number>(120)
  const [canResend, setCanResend] = useState<boolean>(false)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // 120-Second Resend Timer
  useEffect(() => {
    if (!isOtpModalOpen || step !== 2 || timer <= 0) return
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
  }, [isOtpModalOpen, step, timer])

  const handleModalClose = useCallback(() => {
    setStep(1)
    setPhone("")
    setOtpDigits(["", "", "", ""])
    setError(null)
    setIsSubmitting(false)
    setTimer(120)
    setCanResend(false)
    closeOtpModal()
  }, [closeOtpModal])

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
      if (isSubmitting) return
      setError(null)
      const rawCode = codeToVerify ?? otpDigits.join("")
      const normalizedCode = toEnglishDigits(rawCode)
      if (normalizedCode.length !== 4) {
        setError("لطفاً کد تایید ۴ رقمی را به طور کامل وارد نمایید.")
        return
      }
      setIsSubmitting(true)
      try {
        const normalizedPhone = toEnglishDigits(phone.trim())
        await verifyOtp(normalizedPhone, normalizedCode)
        handleModalClose()
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setError(err.detail)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError("کد تایید وارد شده اشتباه یا منقضی شده است.")
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, otpDigits, phone, verifyOtp, handleModalClose]
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
    if (!singleDigit) return

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
      otpRefs.current[0]?.focus()
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
    }
  }

  if (!mounted) return null

  const modalBody = (
    <div className="flex flex-col gap-5 py-2">
      {step === 1 ? (
        <>
          {/* Step 1 Header */}
          <div className="space-y-1.5 text-center sm:text-right">
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">
              ورود یا ثبت‌نام در آشیانک
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              لطفاً شماره موبایل خود را وارد نمایید
            </p>
          </div>

          {/* Promotional value banner */}
          <div className="rounded-xl bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-3 border border-border/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" />
                هدیه ورود کاربران جدید
              </span>
              <p className="text-xs font-bold text-foreground">
                ۲۰۰،۰۰۰ تومان تخفیف رزرو نخست
              </p>
            </div>
            <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                بیمه کامل اقامتگاه
              </span>
              <span className="flex items-center gap-1">
                <Headphones className="h-3 w-3 text-secondary" />
                پشتیبانی ۲۴ ساعته
              </span>
            </div>
          </div>

          {/* Step 1 Form */}
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="mobile-input"
                className="text-xs font-semibold text-foreground flex items-center gap-1"
              >
                <span>شماره موبایل همراه</span>
                <span className="text-primary">*</span>
              </label>
              <div className="relative flex items-center h-12 w-full rounded-xl border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all overflow-hidden">
                <div className="pr-3 pl-1 text-muted-foreground flex items-center justify-center">
                  <Smartphone className="h-4 w-4" />
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
                  className="h-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 tracking-widest font-mono text-left px-2 text-sm"
                  required
                />
                <div className="flex items-center gap-1 pl-3 pr-2 border-r border-border bg-muted/40 h-full select-none text-xs font-bold font-mono">
                  <span>+۹۸</span>
                  <span className="text-sm">🇮🇷</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                شماره همراه ۱۱ رقمی را با صفر اول وارد فرمایید (مانند ۰۹۱۲۳۴۵۶۷۸۹)
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !phone.trim()}
              className="w-full h-11 rounded-xl text-sm font-bold gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>در حال ارسال کد...</span>
                </>
              ) : (
                <>
                  <span>دریافت کد تایید</span>
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
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
              className="p-0 h-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>ویرایش شماره موبایل</span>
            </Button>
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">
              کد تایید پیامک‌شده را وارد کنید
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              کد ۴ رقمی به شماره{" "}
              <span className="font-bold text-foreground font-mono" dir="ltr">
                {toPersianDigits(phone)}
              </span>{" "}
              ارسال گردید.
            </p>
          </div>

          {/* Mandatory Test Code Banner */}
          <Alert className="border-secondary/40 bg-secondary/10 text-secondary-foreground">
            <Info className="h-4 w-4 text-secondary" />
            <AlertTitle className="font-bold text-sm">کد تایید آزمایشی سیستم</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed mt-1">
              جهت بررسی و ارزیابی سامانه، کد آزمایشی <strong>۱۲۳۴</strong> را وارد نمایید.
            </AlertDescription>
          </Alert>

          {/* Step 2 OTP 4-Digit Input */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-center text-foreground">
                کد تایید ۴ رقمی
              </label>
              <div className="flex justify-center gap-3 dir-ltr" dir="ltr">
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
                    className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-input focus:border-primary font-mono shadow-sm"
                  />
                ))}
              </div>
            </div>

            {/* 120-Second Resend Timer */}
            <div className="flex items-center justify-between bg-muted/60 p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Timer className="h-4 w-4 text-primary" />
                <span>زمان باقی‌مانده:</span>
                <span className="font-bold text-primary font-mono">{formatTimer(timer)}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canResend || isSubmitting}
                onClick={handleResend}
                className="text-xs font-semibold hover:bg-muted text-primary disabled:text-muted-foreground disabled:opacity-50 h-8 px-2"
              >
                ارسال مجدد کد تایید
              </Button>
            </div>

            {error && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="button"
              onClick={() => handleVerifySubmit()}
              disabled={isSubmitting || otpDigits.some((d) => !d)}
              className="w-full h-11 rounded-xl text-sm font-bold gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>در حال بررسی کد...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>تایید و ورود</span>
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <Sheet
        open={isOtpModalOpen}
        onOpenChange={(open) => {
          if (!open) handleModalClose()
        }}
      >
        <SheetContent side="bottom" className="p-6 pt-3">
          <SheetHeader className="sr-only">
            <SheetTitle>ورود یا ثبت‌نام در آشیانک</SheetTitle>
            <SheetDescription>پنجره تایید هویت دو مرحله‌ای با شماره موبایل</SheetDescription>
          </SheetHeader>
          <div className="mx-auto h-1.5 w-12 rounded-full bg-muted-foreground/30 mb-3" />
          {modalBody}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog
      open={isOtpModalOpen}
      onOpenChange={(open) => {
        if (!open) handleModalClose()
      }}
    >
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>ورود یا ثبت‌نام در آشیانک</DialogTitle>
          <DialogDescription>پنجره تایید هویت دو مرحله‌ای با شماره موبایل</DialogDescription>
        </DialogHeader>
        {modalBody}
      </DialogContent>
    </Dialog>
  )
}
