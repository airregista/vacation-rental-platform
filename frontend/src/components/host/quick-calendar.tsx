"use client"

import * as React from "react"
import { useState, useEffect, useSyncExternalStore } from "react"
import { AlertCircle } from "lucide-react"
import { apiClient, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { JalaliDateField } from "@/components/shared/date-field"
import { PersianNumberInput } from "@/components/shared/persian-number-input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export interface QuickCalendarProps {
  accommodationId: number | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// The backend caps one batch call at 90 days (CALENDAR_MAX_BLOCK_DAYS).
const MAX_BLOCK_DAYS = 90

function subscribeResize(callback: () => void) {
  window.addEventListener("resize", callback)
  return () => window.removeEventListener("resize", callback)
}

function getMobileSnapshot() {
  return window.innerWidth < 640
}

function getServerMobileSnapshot() {
  return false
}

function toISODate(d: Date): string {
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

// Split a date range into consecutive chunks of at most maxDays days.
function splitRange(
  start: string,
  end: string,
  maxDays: number,
): { start_date: string; end_date: string }[] {
  const chunks: { start_date: string; end_date: string }[] = []
  let cur = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cur <= last) {
    const chunkEnd = new Date(cur)
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + maxDays - 1)
    if (chunkEnd > last) chunkEnd.setTime(last.getTime())
    chunks.push({ start_date: toISODate(cur), end_date: toISODate(chunkEnd) })
    cur = new Date(chunkEnd)
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return chunks
}

export function QuickCalendar({ accommodationId, open, onClose, onSuccess }: QuickCalendarProps) {
  const isMobile = useSyncExternalStore(subscribeResize, getMobileSnapshot, getServerMobileSnapshot)

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [price, setPrice] = useState("")
  const [minNights, setMinNights] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reset the form every time the modal opens. Deferred via setTimeout
  // so the state updates happen after mount (see
  // react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setStartDate("")
      setEndDate("")
      setPrice("")
      setMinNights("")
      setErrorMessage(null)
    }, 0)
    return () => clearTimeout(timer)
  }, [open])

  const datesValid = startDate !== "" && endDate !== "" && endDate >= startDate
  const priceValue = Number(price)
  const minNightsValue = minNights === "" ? null : Number(minNights)
  const minNightsValid =
    minNights === "" ||
    (minNightsValue !== null &&
      Number.isFinite(minNightsValue) &&
      Number.isInteger(minNightsValue) &&
      minNightsValue >= 1)
  const minNightsError =
    minNights === "" || minNightsValid
      ? null
      : minNightsValue !== null && Number.isFinite(minNightsValue) && minNightsValue < 1
        ? "حداقل اقامت باید حداقل ۱ شب باشد."
        : "حداقل اقامت باید عدد صحیح باشد."
  const rateValid =
    datesValid && price !== "" && Number.isFinite(priceValue) && priceValue >= 0 && minNightsValid

  const runBatch = async (body: Record<string, unknown>): Promise<void> => {
    if (accommodationId === null) return
    const chunks = splitRange(startDate, endDate, MAX_BLOCK_DAYS)
    let applied = 0
    try {
      for (const chunk of chunks) {
        await apiClient.post(`/accommodations/${accommodationId}/pricing-exceptions/batch`, {
          ...chunk,
          ...body,
        })
        applied += 1
      }
    } catch (err) {
      if (applied > 0) {
        // Earlier chunks already committed; say so, so the host knows
        // part of the range was applied and can safely retry the rest.
        throw new Error(
          "بخشی از بازهٔ انتخاب‌شده اعمال شد و ادامهٔ آن با خطا مواجه شد؛ برای تکمیل بازه دوباره تلاش کنید.",
        )
      }
      throw err
    }
    // Refresh the calendar so the change is confirmed on the server,
    // then close and let the dashboard refresh its own data.
    try {
      await apiClient.get(`/accommodations/${accommodationId}/calendar`)
    } catch {
      // The mutation already succeeded; a failed refresh must not
      // hide that from the host.
    }
    onSuccess()
    onClose()
  }

  const handleBlock = async () => {
    if (!datesValid || accommodationId === null) return
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await runBatch({ is_blocked: true })
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail || err.message || "مسدودسازی تقویم با خطا مواجه شد.")
      } else if (err instanceof Error && err.message) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("مسدودسازی تقویم با خطا مواجه شد.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRate = async () => {
    if (!rateValid || accommodationId === null) return
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      // is_blocked must be false here: the schema defaults it to true,
      // and sending only a price would block the dates as well.
      const body: Record<string, unknown> = {
        price: priceValue,
        is_blocked: false,
      }
      if (minNightsValue !== null && minNightsValid) {
        body.min_nights = minNightsValue
      }
      await runBatch(body)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail || err.message || "تغییر نرخ با خطا مواجه شد.")
      } else if (err instanceof Error && err.message) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("تغییر نرخ با خطا مواجه شد.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const form = (
    <div className="space-y-4 py-2 text-right" dir="rtl">
      <div className="grid grid-cols-2 gap-3">
        <JalaliDateField boxed label="تاریخ شروع" value={startDate} onChange={setStartDate} />
        <JalaliDateField
          boxed
          label="تاریخ پایان"
          value={endDate}
          min={startDate}
          onChange={setEndDate}
        />
      </div>

      {!datesValid && startDate !== "" && endDate !== "" && (
        <p className="text-xs text-destructive font-medium">
          تاریخ پایان باید بعد از تاریخ شروع باشد.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="qc-price" className="text-xs font-bold text-foreground">
            نرخ جدید (تومان)
          </label>
          <PersianNumberInput
            id="qc-price"
            min={0}
            value={price.trim() === "" ? null : Number(price)}
            emptyValue={null}
            onValueChange={(value) => setPrice(value === null ? "" : String(value))}
            placeholder="مثلاً ۲٬۵۰۰٬۰۰۰"
            className="h-11 rounded-xl text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="qc-min-nights" className="text-xs font-bold text-foreground">
            حداقل اقامت (شب)
          </label>
          <PersianNumberInput
            id="qc-min-nights"
            min={1}
            value={minNights.trim() === "" ? null : Number(minNights)}
            emptyValue={null}
            onValueChange={(value) => setMinNights(value === null ? "" : String(value))}
            placeholder="اختیاری"
            className="h-11 rounded-xl text-sm"
          />
          {minNightsError && (
            <p className="text-xs text-destructive font-medium">{minNightsError}</p>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        بازه‌های طولانی‌تر از ۹۰ روز به‌صورت خودکار به چند درخواست تقسیم می‌شوند.
      </p>

      {errorMessage && (
        <Alert variant="destructive" className="text-right">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>خطا</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={handleBlock}
          disabled={!datesValid || isSubmitting}
          className="flex-1 h-11 font-bold"
        >
          بستن تقویم (مسدودسازی)
        </Button>
        <Button
          type="button"
          onClick={handleRate}
          disabled={!rateValid || isSubmitting}
          className="flex-1 h-11 font-bold"
        >
          تغییر نرخ دوره
        </Button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet
        open={open}
        onOpenChange={(o) => {
          if (!o) onClose()
        }}
      >
        <SheetContent side="bottom" className="p-6" dir="rtl">
          <SheetHeader className="text-right pb-2">
            <SheetTitle className="text-base font-bold">تقویم سریع</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              بازه‌ای را انتخاب کنید تا مسدود شود یا نرخ آن تغییر کند.
            </SheetDescription>
          </SheetHeader>
          {form}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle>تقویم سریع</DialogTitle>
          <DialogDescription>
            بازه‌ای را انتخاب کنید تا مسدود شود یا نرخ آن تغییر کند.
          </DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  )
}
