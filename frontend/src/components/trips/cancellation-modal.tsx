"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react"

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
import { describeCancellationPolicy, getCancellationPolicyLabel } from "@/lib/cancellation-policy"
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
    penaltyAmount?: number | string,
  ) => void
}

const REFUND_TIMELINE_NOTE =
  "مبلغ مستردشده طبق ضوابط شبکه شتاب طی ۲۴ الی ۷۲ ساعت کاری به حساب بانکی اولیه بازگردانده خواهد شد."

const NETWORK_ERROR =
  "خطا در برقراری ارتباط با سامانه. لطفاً اتصال اینترنت خود را بررسی و دوباره تلاش کنید."

const PREVIEW_FALLBACK = "امکان دریافت شرایط لغو این رزرو وجود ندارد. لطفاً دوباره تلاش کنید."

const SUBMIT_FALLBACK = "لغو رزرو انجام نشد. لطفاً دوباره تلاش کنید."

// Translate known backend cancellation failures to Persian. Unknown details
// fall back to a Persian message so raw English never reaches the guest.
function mapCancellationError(detail: string, fallback: string): string {
  if (detail.includes("cannot be cancelled from status")) {
    if (detail.includes("cancelled")) {
      return "این رزرو قبلاً لغو شده است."
    }
    if (detail.includes("completed")) {
      return "این رزرو به پایان رسیده و امکان لغو آن وجود ندارد."
    }
    return "این رزرو در وضعیتی نیست که بتوان آن را لغو کرد."
  }
  if (detail.includes("Host payout has already been settled")) {
    return "تسویه حساب میزبان انجام شده و امکان لغو وجود ندارد."
  }
  if (detail.includes("check-in time has already arrived")) {
    return "موعد تحویل اقامتگاه سپری شده و امکان لغو وجود ندارد."
  }
  if (detail.includes("Reservation not found")) {
    return "رزرو موردنظر یافت نشد."
  }
  if (detail.includes("Access forbidden")) {
    return "شما به این رزرو دسترسی ندارید."
  }
  return /[\u0600-\u06FF]/.test(detail) ? detail : fallback
}

function formatHoursToCheckin(value: number | null | undefined): string {
  const hours = Number(value)
  if (!Number.isFinite(hours) || hours < 1) {
    return "کمتر از ۱ ساعت"
  }
  return `${toPersianDigits(Math.floor(hours))} ساعت`
}

function getAccommodationTitle(trip: TripReservationItem | null): string {
  if (!trip) return ""
  return trip.accommodation_title?.trim() || `اقامتگاه کد ${toPersianDigits(trip.accommodation_id)}`
}

/**
 * Remount per reservation id so a reservation swap while the dialog is open
 * starts from a clean preview/result state. The dialog stays mounted for the
 * same reservation, which lets the success receipt survive the parent's list
 * refresh until the guest acknowledges it.
 */
export function CancellationModal(props: CancellationModalProps) {
  return <CancellationModalContent key={props.trip?.id ?? "none"} {...props} />
}

function CancellationModalContent({ trip, isOpen, onClose, onCancelled }: CancellationModalProps) {
  const [preview, setPreview] = useState<CancellationPreviewData | null>(null)
  const [result, setResult] = useState<CancellationResponseData | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reason, setReason] = useState("")
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Bumped by the preview retry button; part of the preview effect's deps so
  // the request is re-issued without duplicating the fetch logic.
  const [previewReloadKey, setPreviewReloadKey] = useState(0)

  const isOpenRef = useRef(isOpen)
  const isMountedRef = useRef(true)
  const previewRequestIdRef = useRef(0)
  // Incremented whenever the dialog closes: a POST that resolves after the
  // guest closed the dialog must notify the parent but show no result here.
  const sessionRef = useRef(0)
  // The parent callback is stored in a ref so the unmount/close guards below
  // do not re-run (and notify early) whenever the parent re-renders.
  const onCancelledRef = useRef(onCancelled)
  // Guarantees the parent update is delivered at most once per reservation,
  // whether the guest taps "متوجه شدم", closes the dialog, or navigates away.
  const notifiedReservationIdRef = useRef<number | null>(null)

  useEffect(() => {
    onCancelledRef.current = onCancelled
  }, [onCancelled])

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const notifyCancelled = useCallback(
    (reservationId: number, response: CancellationResponseData) => {
      if (notifiedReservationIdRef.current === reservationId) return
      notifiedReservationIdRef.current = reservationId
      onCancelledRef.current(reservationId, response.refund_amount, response.penalty_amount)
    },
    [],
  )

  const tripId = trip?.id ?? null

  useEffect(() => {
    if (!isOpen || tripId === null) return

    let isCurrent = true
    const requestId = ++previewRequestIdRef.current

    apiClient
      .get<CancellationPreviewData>(`/reservations/${tripId}/cancel-preview`)
      .then((data) => {
        if (isCurrent && requestId === previewRequestIdRef.current) {
          setPreview(data)
        }
      })
      .catch((err: unknown) => {
        if (!isCurrent || requestId !== previewRequestIdRef.current) return
        if (err instanceof ApiError) {
          setPreviewError(mapCancellationError(err.detail || err.message, PREVIEW_FALLBACK))
        } else {
          setPreviewError(NETWORK_ERROR)
        }
      })

    return () => {
      // Ignore a preview response that lands after close or reservation swap.
      isCurrent = false
      previewRequestIdRef.current += 1
    }
  }, [isOpen, tripId, previewReloadKey])

  // Safety net for a parent-driven close that did not go through handleClose
  // (e.g. the reservation page swaps data while the receipt is visible).
  useEffect(() => {
    if (!isOpen && result) {
      notifyCancelled(result.reservation_id, result)
    }
  }, [isOpen, result, notifyCancelled])

  // Unmount (route change, list refresh removing the modal) must not drop the
  // parent update when a successful cancellation has not been acknowledged.
  useEffect(() => {
    return () => {
      if (result) {
        notifyCancelled(result.reservation_id, result)
      }
    }
  }, [result, notifyCancelled])

  const handleClose = () => {
    if (result) {
      notifyCancelled(result.reservation_id, result)
    }
    isOpenRef.current = false
    sessionRef.current += 1
    previewRequestIdRef.current += 1
    setPreview(null)
    setResult(null)
    setReason("")
    setPreviewError(null)
    setSubmitError(null)
    setIsSubmitting(false)
    onClose()
  }

  const handleAcknowledge = () => {
    handleClose()
  }

  const handleRetryPreview = () => {
    setPreview(null)
    setPreviewError(null)
    setPreviewReloadKey((key) => key + 1)
  }

  const handleConfirmCancel = async () => {
    if (!trip || isSubmitting) return

    const reservationId = trip.id
    const session = ++sessionRef.current

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await apiClient.post<CancellationResponseData>(
        `/reservations/${reservationId}/cancel`,
        { reason: reason.trim() || undefined },
      )

      // Closed (or moved to another reservation) while the request was in
      // flight: deliver the parent update immediately, show no receipt.
      if (!isMountedRef.current || !isOpenRef.current || session !== sessionRef.current) {
        notifyCancelled(reservationId, response)
        return
      }

      setResult(response)
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      if (!isOpenRef.current || session !== sessionRef.current) return

      if (err instanceof ApiError) {
        setSubmitError(mapCancellationError(err.detail || err.message, SUBMIT_FALLBACK))
      } else {
        setSubmitError(NETWORK_ERROR)
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }

  const policy = result?.cancellation_policy ?? preview?.cancellation_policy
  const policyLabel = getCancellationPolicyLabel(policy)
  const policyDescription = describeCancellationPolicy(policy, {
    freeHours: preview?.cancellation_free_hours,
    penaltyPercent: preview?.cancellation_penalty_percent,
  })

  const previewTotal = Number(preview?.total_price)
  const previewPenalty = Number(preview?.penalty_amount)
  const penaltyShare =
    Number.isFinite(previewTotal) && previewTotal > 0 && Number.isFinite(previewPenalty)
      ? Math.min(100, Math.max(0, Math.round((previewPenalty / previewTotal) * 100)))
      : null

  const accommodationTitle = getAccommodationTitle(trip)
  const isLoadingPreview = isOpen && !preview && !previewError && !result

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-h-[90vh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-lg"
        aria-busy={isSubmitting}
      >
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-ink">
            <span
              className={
                result
                  ? "grid size-9 shrink-0 place-items-center rounded-b-xl rounded-t-full bg-trust/10 text-trust"
                  : "grid size-9 shrink-0 place-items-center rounded-b-xl rounded-t-full bg-destructive/10 text-destructive"
              }
            >
              {result ? (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              ) : (
                <AlertCircle className="size-4" aria-hidden="true" />
              )}
            </span>
            <span>{result ? "نتیجه لغو رزرو" : "درخواست لغو رزرو و استرداد وجه"}</span>
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-ink-soft">
            {result ? "رسید لغو رزرو و جزئیات استرداد وجه" : accommodationTitle}
          </DialogDescription>
        </DialogHeader>

        {/* Preview failure: no amount has been calculated yet. */}
        {previewError && !preview && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertTitle>امکان دریافت شرایط لغو</AlertTitle>
            <AlertDescription className="text-xs leading-6">{previewError}</AlertDescription>
          </Alert>
        )}

        {/* Submit failure: the preview stays visible below the alert. */}
        {submitError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertTitle>لغو رزرو انجام نشد</AlertTitle>
            <AlertDescription className="text-xs leading-6">{submitError}</AlertDescription>
          </Alert>
        )}

        {isLoadingPreview && (
          <div className="space-y-4 py-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        )}

        {/* Detailed success receipt */}
        {result && (
          <div className="space-y-4 py-1" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <span className="grid size-16 place-items-center rounded-full bg-trust/10 text-trust ring-8 ring-trust/5">
                <CheckCircle2 className="size-8" aria-hidden="true" />
              </span>
              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-ink">رزرو شما با موفقیت لغو شد</h3>
                <p className="text-xs leading-6 text-ink-soft">
                  لغو رزرو ثبت شد و جزئیات استرداد وجه در ادامه آمده است.
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-3 rounded-xl border border-line/80 bg-paper-deep/50 p-4 text-xs sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-ink-soft">شماره رزرو</dt>
                <dd className="font-bold tabular-nums text-ink">
                  {toPersianDigits(result.reservation_id)}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-ink-soft">اقامتگاه</dt>
                <dd className="font-semibold leading-6 text-ink">{accommodationTitle}</dd>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <dt className="text-ink-soft">سیاست لغو</dt>
                <dd className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-brick/30 bg-brick/5 font-semibold text-brick"
                    >
                      {policyLabel}
                    </Badge>
                    <span className="text-[11px] tabular-nums text-ink-soft">
                      {formatHoursToCheckin(result.hours_to_checkin)} تا موعد تحویل در زمان لغو
                    </span>
                  </div>
                  <p className="text-[11px] leading-6 text-ink-soft">{policyDescription}</p>
                </dd>
              </div>
            </dl>

            <div className="space-y-3 rounded-xl border border-line/80 bg-paper-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink-soft">مبلغ کل پرداخت‌شده</span>
                <span className="font-semibold tabular-nums text-ink">
                  {formatFaPrice(result.total_price)} تومان
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink-soft">جریمه لغو</span>
                <span className="font-semibold tabular-nums text-destructive">
                  {formatFaPrice(result.penalty_amount)} تومان
                </span>
              </div>

              <Separator className="bg-line" />

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-trust/10 p-3">
                <span className="text-sm font-bold text-ink">مبلغ استردادشده</span>
                <span className="text-lg font-black tabular-nums text-trust">
                  {formatFaPrice(result.refund_amount)} تومان
                </span>
              </div>
            </div>

            <p className="flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/10 p-3 text-[11px] leading-6 text-ink-soft">
              <Wallet className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
              <span>{REFUND_TIMELINE_NOTE}</span>
            </p>
          </div>
        )}

        {/* Pre-submit review and itemized calculation */}
        {!isLoadingPreview && preview && !result && (
          <div className="space-y-4 py-1">
            <div className="space-y-2 rounded-xl border border-line/80 bg-paper-deep/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <HelpCircle className="size-4 shrink-0 text-brick" aria-hidden="true" />
                  <span className="text-xs font-semibold text-ink">سیاست لغو اقامتگاه</span>
                  <Badge
                    variant="outline"
                    className="border-brick/30 bg-brick/5 font-semibold text-brick"
                  >
                    {policyLabel}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                  <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="tabular-nums">
                    {formatHoursToCheckin(preview.hours_to_checkin)} تا موعد تحویل
                  </span>
                </div>
              </div>

              <p className="text-[11px] leading-6 text-ink-soft">{policyDescription}</p>
            </div>

            <div className="space-y-3 rounded-xl border border-line/80 bg-paper-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink-soft">مبلغ کل پرداخت‌شده</span>
                <span className="font-semibold tabular-nums text-ink">
                  {formatFaPrice(preview.total_price)} تومان
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-1.5 text-ink-soft">
                  <span>جریمه لغو</span>
                  {penaltyShare !== null && (
                    <Badge
                      variant="outline"
                      className="border-destructive/20 bg-destructive/5 px-1.5 py-0 text-[10px] font-semibold text-destructive"
                    >
                      {toPersianDigits(penaltyShare)}٪
                    </Badge>
                  )}
                </div>
                <span className="font-semibold tabular-nums text-destructive">
                  {formatFaPrice(preview.penalty_amount)} تومان
                </span>
              </div>

              <Separator className="bg-line" />

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-trust/10 p-3">
                <span className="text-sm font-bold text-ink">مبلغ قابل استرداد</span>
                <span className="text-lg font-black tabular-nums text-trust">
                  {formatFaPrice(preview.refundable_amount)} تومان
                </span>
              </div>
            </div>

            <p className="flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/10 p-3 text-[11px] leading-6 text-ink-soft">
              <Wallet className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
              <span>{REFUND_TIMELINE_NOTE}</span>
            </p>

            <div className="space-y-1.5 pt-1">
              <label htmlFor="cancel-reason" className="text-xs font-semibold text-ink">
                علت لغو اقامت (اختیاری)
              </label>
              <Textarea
                id="cancel-reason"
                placeholder="تغییر در برنامه سفر، شرایط اضطراری یا دلایل دیگر..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                disabled={isSubmitting}
                className="border-line bg-paper-card"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2 sm:gap-0">
          {result ? (
            <Button type="button" onClick={handleAcknowledge} className="w-full gap-2">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              <span>متوجه شدم</span>
            </Button>
          ) : previewError && !preview ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="border-line bg-transparent"
              >
                بستن
              </Button>
              <Button type="button" onClick={handleRetryPreview} className="gap-2">
                <RefreshCw className="size-4" aria-hidden="true" />
                <span>تلاش مجدد</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="border-line bg-transparent"
              >
                انصراف و بازگشت
              </Button>

              {!isLoadingPreview && preview && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirmCancel}
                  disabled={isSubmitting}
                  className="gap-2 sm:min-w-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      <span>در حال ثبت لغو...</span>
                    </>
                  ) : submitError ? (
                    <>
                      <RefreshCw className="size-4" aria-hidden="true" />
                      <span>تلاش مجدد</span>
                    </>
                  ) : (
                    <span>تأیید و ثبت نهایی لغو رزرو</span>
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
