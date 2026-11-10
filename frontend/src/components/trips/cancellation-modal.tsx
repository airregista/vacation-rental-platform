"use client"

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Clock, HelpCircle, Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { apiClient, ApiError } from "@/lib/api-client"
import { formatFaPrice } from "@/types/checkout"
import { toPersianDigits } from "@/lib/format-fa"
import type {
  CancellationPreviewData,
  CancellationResponseData,
  TripReservationItem,
} from "@/types/trips"

export interface CancellationModalProps {
  trip: TripReservationItem | null
  isOpen: boolean
  onClose: () => void
  onCancelled: (
    reservationId: number,
    refundAmount?: number | string,
    penaltyAmount?: number | string
  ) => void
}

function getPolicyLabel(policy?: string): string {
  switch (policy?.toLowerCase()) {
    case "flexible":
      return "آسان (انعطاف‌پذیر)"
    case "moderate":
      return "متعادل"
    case "strict":
      return "سخت‌گیرانه"
    default:
      return policy || "استاندارد"
  }
}

// Translate known backend preview-failure details to Persian; unknown
// errors pass through unchanged so they are never dropped.
function mapPreviewError(detail: string): string {
  if (detail.includes("cannot be cancelled from status")) {
    return "این رزرو در وضعیتی نیست که بتوان آن را لغو کرد."
  }
  if (detail.includes("Host payout has already been settled")) {
    return "تسویه حساب میزبان انجام شده و امکان لغو وجود ندارد."
  }
  if (detail.includes("check-in time has already arrived")) {
    return "موعد تحویل اقامتگاه سپری شده و امکان لغو وجود ندارد."
  }
  return detail
}

export function CancellationModal({
  trip,
  isOpen,
  onClose,
  onCancelled,
}: CancellationModalProps) {
  const [preview, setPreview] = useState<CancellationPreviewData | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reason, setReason] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const successTimerRef = useRef<number | null>(null)
  // Pending parent callback for a success whose 1200ms timer has not fired
  // yet: closing the dialog in that window must still deliver it (R3).
  const pendingSuccessRef = useRef<(() => void) | null>(null)
  // Whether the dialog is currently open; the POST can resolve after the
  // user closed the dialog mid-submit (R3).
  const isOpenRef = useRef(isOpen)

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  // Clear the success timer if the dialog unmounts before it fires.
  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current)
      }
    }
  }, [])

  const isLoadingPreview = isOpen && !preview && !errorMessage

  const handleClose = () => {
    // If a success is still pending, deliver the parent update first so
    // closing in the 1200ms success window does not drop it (R3).
    const pending = pendingSuccessRef.current
    pendingSuccessRef.current = null
    if (pending) pending()
    if (successTimerRef.current !== null) {
      window.clearTimeout(successTimerRef.current)
      successTimerRef.current = null
    }
    isOpenRef.current = false
    setPreview(null)
    setReason("")
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(false)
    onClose()
  }

  useEffect(() => {
    if (!isOpen || !trip) return

    let isMounted = true

    apiClient
      .get<CancellationPreviewData>(`/reservations/${trip.id}/cancel-preview`)
      .then((data) => {
        if (isMounted) {
          setPreview(data)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setErrorMessage(
              mapPreviewError(err.detail || err.message) ||
                "امکان محاسبه شرایط کنسلی برای این رزرو وجود ندارد."
            )
          } else {
            setErrorMessage("خطا در برقراری ارتباط با سامانه. لطفاً مجدداً تلاش کنید.")
          }
        }
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, trip])

  const handleConfirmCancel = async () => {
    if (!trip) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const payload = {
        reason: reason.trim() || undefined,
      }
      const response = await apiClient.post<CancellationResponseData>(
        `/reservations/${trip.id}/cancel`,
        payload
      )

      // Closed while the request was in flight: no timer, no success
      // message — refresh the parent list right away instead (R3).
      if (!isOpenRef.current) {
        onCancelled(trip.id, response.refund_amount, response.penalty_amount)
        return
      }

      setSuccessMessage(response.message || "رزرو شما با موفقیت لغو شد و فرآیند استرداد وجه آغاز گردید.")
      pendingSuccessRef.current = () =>
        onCancelled(trip.id, response.refund_amount, response.penalty_amount)
      successTimerRef.current = window.setTimeout(() => {
        successTimerRef.current = null
        const pending = pendingSuccessRef.current
        pendingSuccessRef.current = null
        if (pending) pending()
        handleClose()
      }, 1200)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail || err.message || "خطا در لغو رزرو. ممکن است زمان تحویل سپری شده باشد.")
      } else {
        setErrorMessage("خطا در ارسال درخواست لغو. لطفاً دوباره امتحان کنید.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Penalty calculations
  const total = Number(preview?.total_price) || 1
  const penalty = Number(preview?.penalty_amount) || 0
  const penaltyPercent = Math.min(100, Math.max(0, Math.round((penalty / total) * 100)))
  const remainingHours = Math.max(0, Math.floor(preview?.hours_to_checkin || 0))

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-right">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span>درخواست لغو رزرو و استرداد وجه</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {trip?.accommodation_title || (trip ? `اقامتگاه کد ${trip.accommodation_id}` : "")}
          </DialogDescription>
        </DialogHeader>

        {/* Success Alert */}
        {successMessage && (
          <Alert className="border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <AlertTitle>لغو موفقیت‌آمیز</AlertTitle>
            <AlertDescription className="text-xs">{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Loading Skeleton */}
        {isLoadingPreview && (
          <div className="space-y-4 py-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        )}

        {/* Preview Details */}
        {!isLoadingPreview && preview && !successMessage && (
          <div className="space-y-4 py-1">
            {/* Policy Badge & Remaining Hours */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-2">
                <HelpCircle className="size-4 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  قوانین کنسلی اقامتگاه:
                </span>
                <Badge variant="outline" className="font-semibold text-primary border-primary/40">
                  {getPolicyLabel(preview.cancellation_policy)}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                <span>{toPersianDigits(remainingHours)} ساعت تا موعد تحویل</span>
              </div>
            </div>

            {/* Itemized Calculation Alert Card */}
            <div className="rounded-xl border border-border p-4 space-y-3 bg-card">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">مبلغ کل پرداخت‌شده:</span>
                <span className="font-semibold text-foreground">
                  {formatFaPrice(preview.total_price)} تومان
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  جریمه کنسلی ({toPersianDigits(penaltyPercent)}٪):
                </span>
                <span className="font-semibold text-destructive">
                  {formatFaPrice(preview.penalty_amount)} تومان
                </span>
              </div>

              <Separator />

              <div className="flex justify-between items-center text-base font-bold">
                <span className="text-foreground">مبلغ قابل استرداد:</span>
                <span className="text-primary text-lg">
                  {formatFaPrice(preview.refundable_amount)} تومان
                </span>
              </div>
            </div>

            {/* Explanation Note */}
            <p className="text-xs leading-relaxed text-muted-foreground">
              مبلغ مستردشده طبق ضوابط شبکه شتاب طی ۲۴ الی ۷۲ ساعت کاری به حساب بانکی اولیه بازگردانده خواهد شد.
            </p>

            {/* Reason Textarea */}
            <div className="space-y-1.5 pt-1">
              <label htmlFor="cancel-reason" className="text-xs font-semibold text-foreground">
                علت لغو اقامت (اختیاری):
              </label>
              <Textarea
                id="cancel-reason"
                placeholder="تغییر در برنامه سفر، شرایط اضطراری یا دلایل دیگر..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            انصراف و بازگشت
          </Button>

          {!isLoadingPreview && preview && !successMessage && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>در حال ثبت لغو...</span>
                </>
              ) : (
                <span>تأیید و ثبت نهایی لغو رزرو</span>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
