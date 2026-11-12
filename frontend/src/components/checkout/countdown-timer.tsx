"use client"

import * as React from "react"
import { Clock, AlertCircle } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface CountdownTimerProps {
  createdAt: string
  ttlMinutes?: number
  onExpired?: () => void
  isPending: boolean
  className?: string
}

export function CountdownTimer({
  createdAt,
  ttlMinutes = 30,
  onExpired,
  isPending,
  className,
}: CountdownTimerProps) {
  const getSecondsLeft = React.useCallback(() => {
    if (!createdAt || !isPending) return 0
    const createdMs = new Date(
      createdAt.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(createdAt) ? createdAt : `${createdAt}Z`
    ).getTime()
    if (isNaN(createdMs)) return 0
    const expiresAtMs = createdMs + ttlMinutes * 60 * 1000
    return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
  }, [createdAt, ttlMinutes, isPending])

  const [remainingSeconds, setRemainingSeconds] = React.useState<number>(getSecondsLeft)
  const expiredCalledRef = React.useRef(false)

  // Derive active remaining seconds
  const currentSeconds = isPending ? remainingSeconds : 0

  React.useEffect(() => {
    if (!isPending) return

    const createdMs = new Date(
      createdAt.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(createdAt) ? createdAt : `${createdAt}Z`
    ).getTime()

    if (isNaN(createdMs)) return

    const expiresAtMs = createdMs + ttlMinutes * 60 * 1000
    const initialLeft = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))

    if (initialLeft <= 0) {
      if (!expiredCalledRef.current) {
        expiredCalledRef.current = true
        onExpired?.()
      }
      return
    }

    const timer = setInterval(() => {
      if (!isPending) {
        clearInterval(timer)
        return
      }
      const left = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
      setRemainingSeconds(left)

      if (left <= 0) {
        clearInterval(timer)
        if (!expiredCalledRef.current && isPending) {
          expiredCalledRef.current = true
          onExpired?.()
        }
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [createdAt, ttlMinutes, isPending, onExpired])

  const minutes = Math.floor(currentSeconds / 60)
  const seconds = currentSeconds % 60
  const numFormatter = new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2 })
  const formattedTime = `${numFormatter.format(minutes)}:${numFormatter.format(seconds)}`

  // Inactive or non-pending state
  if (!isPending) {
    return null
  }

  // Expired state (0s left)
  if (currentSeconds === 0) {
    return (
      <Alert
        variant="destructive"
        className={cn("border-destructive/30 bg-destructive/5 text-destructive", className)}
      >
        <AlertCircle className="size-5" />
        <AlertTitle className="text-base font-bold">مهلت پرداخت این رزرو به پایان رسیده است</AlertTitle>
        <AlertDescription className="mt-1 text-sm">
          این رزرو موقت به دلیل اتمام زمان ۳۰ دقیقه‌ای منقضی شد و تاریخ‌های انتخابی آزاد شدند. لطفا در صورت تمایل مجددا رزرو فرمایید.
        </AlertDescription>
      </Alert>
    )
  }

  // Urgent state (<= 5 minutes)
  if (currentSeconds <= 300) {
    return (
      <Alert
        variant="warning"
        className={cn(
          "border-gold/40 bg-gold-soft/70 text-ink",
          className
        )}
      >
        <Clock className="size-5 animate-pulse text-brick" />
        <AlertTitle className="flex items-center justify-between text-base font-bold">
          <span className="flex items-center gap-2">
            <span>زمان پرداخت رو به پایان است!</span>
          </span>
          <span
            dir="ltr"
            className="rounded-md border border-gold/30 bg-paper-card px-2.5 py-0.5 font-mono text-base font-extrabold tabular-nums tracking-wider text-brick"
          >
            {formattedTime}
          </span>
        </AlertTitle>
        <AlertDescription className="mt-1 text-sm">
          کمتر از ۵ دقیقه تا آزادسازی تاریخ‌ها باقی مانده است. لطفا پیش از انقضای زمان، پرداخت خود را نهایی کنید.
        </AlertDescription>
      </Alert>
    )
  }

  // Normal State (> 5 minutes)
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 rounded-2xl border border-line bg-paper-card p-4 text-ink shadow-soft sm:flex-row sm:items-center",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 rounded-xl bg-gold-soft p-2 text-gold">
          <Clock className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium">
            این رزرو موقت به مدت{" "}
            <span dir="ltr" className="px-1 font-mono text-base font-bold tabular-nums text-brick">
              {formattedTime}
            </span>{" "}
            دقیقه برای شما نگهداری شده است.
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            پس از پایان این مهلت، تاریخ‌های این اقامتگاه برای سایر مسافران قابل رزرو خواهد شد.
          </p>
        </div>
      </div>
      <Badge
        variant="outline"
        className="self-start border-gold/30 bg-gold-soft/60 px-2.5 py-1 font-mono text-xs tabular-nums text-ink sm:self-auto"
      >
        <span dir="ltr">{formattedTime}</span> مانده
      </Badge>
    </div>
  )
}
