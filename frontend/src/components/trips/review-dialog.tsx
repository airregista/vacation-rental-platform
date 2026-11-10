"use client"

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, Sparkles, Star } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { apiClient, ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { toPersianDigits } from "@/lib/format-fa"
import type { ReviewSubmissionPayload, TripReservationItem } from "@/types/trips"

export interface ReviewDialogProps {
  trip: TripReservationItem | null
  isOpen: boolean
  onClose: () => void
  onReviewSubmitted: (reservationId?: number) => void
}

interface StarPickerProps {
  label: string
  description?: string
  value: number | null
  onChange: (val: number | null) => void
  required?: boolean
  disabled?: boolean
}

function StarPicker({
  label,
  description,
  value,
  onChange,
  required = false,
  disabled = false,
}: StarPickerProps) {
  const [hoverVal, setHoverVal] = useState<number | null>(null)
  const current = hoverVal ?? value ?? 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-destructive text-xs">*</span>}
        </label>
        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
          {current > 0 ? `${toPersianDigits(current)} از ۵` : "امتیاز دهید"}
        </span>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {/* 5-Star Row with 44px Accessible Touch Targets */}
      <div
        className="flex items-center gap-1 direction-ltr justify-end"
        onMouseLeave={() => setHoverVal(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= current
          return (
            <button
              key={star}
              type="button"
              disabled={disabled}
              className={cn(
                "w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95 disabled:pointer-events-none",
                isFilled
                  ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  : "text-muted-foreground/30 hover:text-amber-400 hover:bg-muted"
              )}
              onMouseEnter={() => setHoverVal(star)}
              onClick={() => onChange(star === value ? null : star)}
              aria-label={`${label}: ${star} از ۵`}
            >
              <Star
                className={cn(
                  "size-6 transition-transform",
                  isFilled && "fill-amber-500 scale-110"
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ReviewDialog({
  trip,
  isOpen,
  onClose,
  onReviewSubmitted,
}: ReviewDialogProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [cleanliness, setCleanliness] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [comment, setComment] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
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
    setRating(null)
    setCleanliness(null)
    setAccuracy(null)
    setComment("")
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(false)
    onClose()
  }

  const isValid = rating !== null && rating >= 1 && rating <= 5 && comment.trim().length >= 5 && comment.trim().length <= 1000

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trip || rating === null || !isValid) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const payload: ReviewSubmissionPayload = {
        reservation_id: trip.id,
        rating,
        cleanliness_rating: cleanliness,
        accuracy_rating: accuracy,
        comment: comment.trim(),
      }

      await apiClient.post(
        `/accommodations/${trip.accommodation_id}/reviews`,
        payload
      )

      // Closed while the request was in flight: no timer, no success
      // message — refresh the parent list right away instead (R3).
      if (!isOpenRef.current) {
        onReviewSubmitted(trip.id)
        return
      }

      setSuccessMessage("نظر ارزشمند شما با موفقیت ثبت شد و در صفحه اقامتگاه نمایش داده می‌شود.")
      pendingSuccessRef.current = () => onReviewSubmitted(trip.id)
      successTimerRef.current = window.setTimeout(() => {
        successTimerRef.current = null
        const pending = pendingSuccessRef.current
        pendingSuccessRef.current = null
        if (pending) pending()
        handleClose()
      }, 1200)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const errorDetail = err.detail || err.message || ""
        if (err.status === 400 && errorDetail.includes("already been submitted")) {
          setErrorMessage("برای این اقامت قبلاً نظر ثبت شده است.")
        } else if (err.status === 400 && errorDetail.includes("check-out time")) {
          setErrorMessage("امکان ثبت نظر تنها پس از پایان موعد تحویل و خروج از اقامتگاه فراهم است.")
        } else {
          setErrorMessage(err.detail || err.message || "خطا در ثبت نظر. لطفاً مجدداً بررسی فرمایید.")
        }
      } else {
        setErrorMessage("خطا در ارسال نظر. لطفاً اتصال اینترنت خود را بررسی کنید.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-right">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span>ثبت نظر و امتیازدهی به اقامتگاه</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {trip?.accommodation_title || (trip ? `اقامتگاه کد ${trip.accommodation_id}` : "")}
          </DialogDescription>
        </DialogHeader>

        {/* Success Alert */}
        {successMessage && (
          <Alert className="border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <AlertTitle>ثبت موفق نظر</AlertTitle>
            <AlertDescription className="text-xs">{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>خطا در ثبت نظر</AlertTitle>
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {!successMessage && (
          <form onSubmit={handleSubmit} className="space-y-5 py-2">
            {/* Rating 1: Overall (Required) */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
              <StarPicker
                label="امتیاز کلی به اقامتگاه"
                description="میزان رضایت کلی شما از اقامت، امکانات و میزبانی"
                value={rating}
                onChange={setRating}
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Rating 2: Cleanliness (Optional) */}
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <StarPicker
                label="نظافت و بهداشت"
                description="تمیزی ملحفه‌ها، سرویس بهداشتی، حمام و فضاهای اقامتگاه"
                value={cleanliness}
                onChange={setCleanliness}
                disabled={isSubmitting}
              />
            </div>

            {/* Rating 3: Accuracy (Optional) */}
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <StarPicker
                label="صحت اطلاعات و تصاویر"
                description="مطابقت مشخصات و عکس‌های سایت با واقعیت اقامتگاه"
                value={accuracy}
                onChange={setAccuracy}
                disabled={isSubmitting}
              />
            </div>

            {/* Comment Section */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="review-comment"
                  className="text-sm font-semibold text-foreground"
                >
                  متن تجربه و دیدگاه شما:
                </label>
                <span className="text-xs text-muted-foreground">
                  {toPersianDigits(comment.trim().length)} / ۱۰۰۰ کاراکتر
                </span>
              </div>
              <Textarea
                id="review-comment"
                placeholder="نقاط قوت و ضعف اقامتگاه، برخورد میزبان، دسترسی محلی و نکاتی که به مسافران دیگر کمک می‌کند را بنویسید..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={1000}
                disabled={isSubmitting}
              />
              {comment.trim().length > 0 && comment.trim().length < 5 && (
                <p className="text-xs text-destructive">
                  حداقل ۵ کاراکتر لازم است.
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>در حال ارسال نظر...</span>
                  </>
                ) : (
                  <span>ثبت و انتشار نظر</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
