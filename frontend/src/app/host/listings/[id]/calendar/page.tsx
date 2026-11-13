"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Link2,
  Loader2,
  Lock,
  Sparkles,
  Trash2,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { formatPersianDate } from "@/lib/format-fa"
import type { CalendarDayInfo } from "@/types/detail"
import type { HostAccommodationDetail, HostReservationRecord } from "@/components/host/types"
import {
  MAX_CALENDAR_BATCH_DAYS,
  PartialBatchError,
  WEEK_DAYS,
  addDays,
  getPersianParts,
  groupByPersianMonth,
  nextPersianMonthStart,
  persianMonthStart,
  postPricingBatch,
  previousPersianMonthStart,
  splitRange,
  toDateRanges,
} from "@/components/host/calendar-utils"
import {
  fetchAllPages,
  formatFaNumber,
  formatToman,
  getApiErrorMessage,
  toLocalIsoDate,
} from "@/components/host/host-utils"
import { HostAccessGate } from "@/components/host/host-access-gate"
import { HostPageLayout } from "@/components/host/host-page-layout"
import { EmptyState } from "@/components/shared/empty-state"
import { JalaliDateField } from "@/components/shared/date-field"
import { PersianNumberInput } from "@/components/shared/persian-number-input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface CalendarPageProps {
  params: Promise<{ id: string }>
}

type DayKind = "available" | "booked" | "blocked" | "priced" | "past"

const DAY_KIND_CLASSES: Record<DayKind, string> = {
  available: "border-line bg-paper-card text-ink hover:border-line-strong hover:bg-paper-deep/30",
  booked: "border-night/30 bg-night text-night-foreground",
  blocked: "border-brick/30 bg-brick/10 text-ink",
  priced: "border-gold/40 bg-gold-soft/70 text-ink",
  past: "border-line/50 bg-paper-deep/35 text-ink-soft/70",
}

const LEGEND: { kind: DayKind; label: string; dot: string }[] = [
  { kind: "available", label: "شب عادی", dot: "bg-trust" },
  { kind: "priced", label: "نرخ ویژه", dot: "bg-gold" },
  { kind: "blocked", label: "مسدود", dot: "bg-brick" },
  { kind: "booked", label: "رزروشده", dot: "bg-night" },
]

const PRICING_STEPS = ["روزها را انتخاب کنید", "نرخ ویژه را وارد کنید", "اعمال کنید"] as const

const WEEK_DAY_LABELS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
] as const

/** Selection can span months; each batch request is still split to 90 days. */
const MAX_SELECTED_DAYS = 366

/** ISO date to Persian week index: 0 = Saturday … 6 = Friday. */
function weekIndexOf(isoDate: string): number {
  return (new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 1) % 7
}

function daysInPersianMonth(monthStart: string): number {
  const nextMonth = nextPersianMonthStart(monthStart)
  const start = Date.parse(`${monthStart}T00:00:00Z`)
  const end = Date.parse(`${nextMonth}T00:00:00Z`)
  return Math.max(1, Math.round((end - start) / 86_400_000))
}

function collectBookedDates(reservations: HostReservationRecord[]): Set<string> {
  const dates = new Set<string>()
  for (const reservation of reservations) {
    if (reservation.status !== "confirmed") continue
    let cursor = reservation.check_in.slice(0, 10)
    const checkOut = reservation.check_out.slice(0, 10)
    let guard = 0
    while (cursor < checkOut && guard < 1000) {
      dates.add(cursor)
      cursor = addDays(cursor, 1)
      guard += 1
    }
  }
  return dates
}

function dayKind(day: CalendarDayInfo, bookedDates: Set<string>, today: string): DayKind {
  if (bookedDates.has(day.date)) return "booked"
  if (!day.is_available) return "blocked"
  if (day.date < today) return "past"
  if (day.is_exception) return "priced"
  return "available"
}

function CalendarSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-[520px] w-full rounded-2xl" />
    </div>
  )
}

function ListingCalendarContent({ listingId }: { listingId: number }) {
  const { user, isAdmin } = useAuth()

  const [detail, setDetail] = React.useState<HostAccommodationDetail | null>(null)
  const [bookedDates, setBookedDates] = React.useState<Set<string>>(new Set())
  const [isMetaLoading, setIsMetaLoading] = React.useState(true)
  const [metaError, setMetaError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  const [monthStart, setMonthStart] = React.useState(() => persianMonthStart(toLocalIsoDate()))
  const [days, setDays] = React.useState<CalendarDayInfo[]>([])
  const [isCalendarLoading, setIsCalendarLoading] = React.useState(true)
  const [calendarError, setCalendarError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [priceInput, setPriceInput] = React.useState("")
  const [minNightsInput, setMinNightsInput] = React.useState("")
  const [isApplying, setIsApplying] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [clearOpen, setClearOpen] = React.useState(false)
  const [rangeStart, setRangeStart] = React.useState("")
  const [rangeEnd, setRangeEnd] = React.useState("")
  const [isRangeLoading, setIsRangeLoading] = React.useState(false)

  const today = toLocalIsoDate()

  React.useEffect(() => {
    let isCurrent = true

    const loadMeta = async () => {
      try {
        const [nextDetail, reservations] = await Promise.all([
          apiClient.get<HostAccommodationDetail>(`/accommodations/${listingId}`),
          fetchAllPages<HostReservationRecord>("/reservations/host"),
        ])
        if (!isCurrent) return
        setDetail(nextDetail)
        setBookedDates(collectBookedDates(reservations))
        setMetaError(null)
        setIsNotFound(false)
      } catch (error: unknown) {
        if (!isCurrent) return
        if (error instanceof ApiError && error.status === 404) {
          setIsNotFound(true)
        } else {
          setMetaError(getApiErrorMessage(error, "بارگذاری اطلاعات اقامتگاه با خطا مواجه شد."))
        }
      } finally {
        if (isCurrent) setIsMetaLoading(false)
      }
    }

    void loadMeta()
    return () => {
      isCurrent = false
    }
  }, [listingId, reloadKey])

  React.useEffect(() => {
    let isCurrent = true

    const loadMonth = async () => {
      try {
        const dayCount = daysInPersianMonth(monthStart)
        const calendarDays = await apiClient.get<CalendarDayInfo[]>(
          `/accommodations/${listingId}/calendar?start_date=${monthStart}&days=${dayCount}`,
        )
        if (!isCurrent) return
        setDays(Array.isArray(calendarDays) ? calendarDays : [])
        setCalendarError(null)
      } catch (error: unknown) {
        if (!isCurrent) return
        setCalendarError(getApiErrorMessage(error, "بارگذاری تقویم ماه با خطا مواجه شد."))
      } finally {
        if (isCurrent) setIsCalendarLoading(false)
      }
    }

    void loadMonth()
    return () => {
      isCurrent = false
    }
  }, [listingId, monthStart, reloadKey])

  const isOwner = Boolean(detail && (isAdmin || detail.host_id === user?.id))
  const monthTitle = getPersianParts(monthStart).title

  const monthDays = React.useMemo(
    () => days.filter((day) => getPersianParts(day.date).key === getPersianParts(monthStart).key),
    [days, monthStart],
  )

  const monthGroup = React.useMemo(() => groupByPersianMonth(monthDays)[0], [monthDays])

  const counts = React.useMemo(() => {
    const result: Record<DayKind, number> = {
      available: 0,
      booked: 0,
      blocked: 0,
      priced: 0,
      past: 0,
    }
    for (const day of monthDays) {
      result[dayKind(day, bookedDates, today)] += 1
    }
    return result
  }, [monthDays, bookedDates, today])

  const selectableDays = React.useMemo(
    () =>
      monthDays.filter((day) => {
        const kind = dayKind(day, bookedDates, today)
        return kind !== "booked" && kind !== "past"
      }),
    [monthDays, bookedDates, today],
  )

  const selectedWeekdays = React.useMemo(() => {
    const result = new Set<number>()
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const matches = selectableDays.filter((day) => weekIndexOf(day.date) === weekday)
      if (matches.length > 0 && matches.every((day) => selected.has(day.date))) {
        result.add(weekday)
      }
    }
    return result
  }, [selectableDays, selected])

  const handleMonthChange = (nextStart: string) => {
    setIsCalendarLoading(true)
    setCalendarError(null)
    setActionError(null)
    setNotice(null)
    setMonthStart(nextStart)
  }

  const handleRetry = () => {
    setIsMetaLoading(true)
    setIsCalendarLoading(true)
    setMetaError(null)
    setCalendarError(null)
    setIsNotFound(false)
    setReloadKey((key) => key + 1)
  }

  const toggleDay = (day: CalendarDayInfo) => {
    const kind = dayKind(day, bookedDates, today)
    if (kind === "booked" || kind === "past") return

    setSelected((current) => {
      const next = new Set(current)
      if (next.has(day.date)) {
        next.delete(day.date)
      } else {
        if (next.size >= MAX_SELECTED_DAYS) return current
        next.add(day.date)
      }
      return next
    })
  }

  const addDaysToSelection = (dates: string[]) => {
    setSelected((current) => {
      const next = new Set(current)
      for (const date of dates) {
        if (next.size >= MAX_SELECTED_DAYS) break
        next.add(date)
      }
      return next
    })
  }

  const toggleWeekday = (weekday: number) => {
    const matches = selectableDays.filter((day) => weekIndexOf(day.date) === weekday)
    if (matches.length === 0) return
    const allSelected = matches.every((day) => selected.has(day.date))

    setSelected((current) => {
      const next = new Set(current)
      for (const day of matches) {
        if (allSelected) next.delete(day.date)
        else if (next.size < MAX_SELECTED_DAYS) next.add(day.date)
      }
      return next
    })
  }

  const handleSelectAllFree = () => {
    addDaysToSelection(selectableDays.map((day) => day.date))
  }

  const handleWeekendPreset = () => {
    addDaysToSelection(
      selectableDays
        .filter((day) => {
          const weekday = weekIndexOf(day.date)
          return weekday === 5 || weekday === 6
        })
        .map((day) => day.date),
    )
  }

  const handleSelectRange = async () => {
    setActionError(null)
    if (!rangeStart || !rangeEnd) {
      setActionError("برای انتخاب بازه، تاریخ شروع و پایان را مشخص کنید.")
      return
    }
    if (rangeEnd < rangeStart) {
      setActionError("تاریخ پایان باید بعد از تاریخ شروع باشد.")
      return
    }

    const totalDays =
      Math.round(
        (Date.parse(`${rangeEnd}T00:00:00Z`) - Date.parse(`${rangeStart}T00:00:00Z`)) / 86_400_000,
      ) + 1
    if (totalDays > MAX_SELECTED_DAYS) {
      setActionError(`بازهٔ انتخابی نباید بیشتر از ${formatFaNumber(MAX_SELECTED_DAYS)} روز باشد.`)
      return
    }

    setIsRangeLoading(true)
    try {
      const dates: string[] = []
      for (const chunk of splitRange(rangeStart, rangeEnd)) {
        const dayCount =
          Math.round(
            (Date.parse(`${chunk.end_date}T00:00:00Z`) -
              Date.parse(`${chunk.start_date}T00:00:00Z`)) /
              86_400_000,
          ) + 1
        const chunkDays = await apiClient.get<CalendarDayInfo[]>(
          `/accommodations/${listingId}/calendar?start_date=${chunk.start_date}&days=${dayCount}`,
        )
        for (const day of chunkDays) {
          if (!day.is_available || day.date < today || bookedDates.has(day.date)) continue
          dates.push(day.date)
        }
      }
      addDaysToSelection(dates)
      setRangeStart("")
      setRangeEnd("")
    } catch (error: unknown) {
      setActionError(getApiErrorMessage(error, "انتخاب بازه با خطا مواجه شد."))
    } finally {
      setIsRangeLoading(false)
    }
  }

  const handleApplyRate = async () => {
    if (selected.size === 0) return

    const price = priceInput.trim() === "" ? undefined : Number(priceInput)
    const minNights = minNightsInput.trim() === "" ? undefined : Number(minNightsInput)

    if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
      setActionError("نرخ واردشده باید عددی بزرگ‌تر یا مساوی صفر باشد.")
      return
    }
    if (
      minNights !== undefined &&
      (!Number.isFinite(minNights) || !Number.isInteger(minNights) || minNights < 1)
    ) {
      setActionError("حداقل اقامت باید عدد صحیح و حداقل ۱ شب باشد.")
      return
    }
    if (price === undefined && minNights === undefined) {
      setActionError("برای اعمال نرخ، حداقل یکی از نرخ یا حداقل اقامت را وارد کنید.")
      return
    }

    setIsApplying(true)
    setActionError(null)
    setNotice(null)
    try {
      const ranges = toDateRanges(Array.from(selected))
      for (const range of ranges) {
        await postPricingBatch(listingId, range.start_date, range.end_date, {
          price,
          is_blocked: false,
          min_nights: minNights,
        })
      }
      setNotice(`نرخ و شرایط اقامت برای ${formatFaNumber(selected.size)} روز اعمال شد.`)
      setSelected(new Set())
      setPriceInput("")
      setMinNightsInput("")
      setIsCalendarLoading(true)
      setReloadKey((key) => key + 1)
    } catch (error: unknown) {
      if (error instanceof PartialBatchError) {
        setActionError(
          "بخشی از روزهای انتخاب‌شده اعمال شد و ادامه آن با خطا مواجه شد؛ تقویم را بررسی و برای باقی روزها دوباره تلاش کنید.",
        )
      } else {
        setActionError(getApiErrorMessage(error, "اعمال تغییرات تقویم با خطا مواجه شد."))
      }
    } finally {
      setIsApplying(false)
    }
  }

  const handleBlock = async () => {
    if (selected.size === 0) return
    setIsApplying(true)
    setActionError(null)
    setNotice(null)
    try {
      const ranges = toDateRanges(Array.from(selected))
      for (const range of ranges) {
        await postPricingBatch(listingId, range.start_date, range.end_date, {
          is_blocked: true,
        })
      }
      setNotice(`${formatFaNumber(selected.size)} روز مسدود شد.`)
      setSelected(new Set())
      setIsCalendarLoading(true)
      setReloadKey((key) => key + 1)
    } catch (error: unknown) {
      if (error instanceof PartialBatchError) {
        setActionError(
          "بخشی از روزها مسدود شد و ادامه آن با خطا مواجه شد؛ تقویم را بررسی و برای باقی روزها دوباره تلاش کنید.",
        )
      } else {
        setActionError(getApiErrorMessage(error, "مسدودسازی روزها با خطا مواجه شد."))
      }
    } finally {
      setIsApplying(false)
    }
  }

  const handleClearExceptions = async () => {
    if (selected.size === 0) return
    setIsApplying(true)
    setActionError(null)
    setNotice(null)
    try {
      for (const date of Array.from(selected).sort()) {
        try {
          await apiClient.delete(`/accommodations/${listingId}/pricing-exceptions/${date}`)
        } catch (error: unknown) {
          if (!(error instanceof ApiError) || error.status !== 404) throw error
        }
      }
      setNotice(`${formatFaNumber(selected.size)} روز آزاد و به شرایط پایه بازگشت.`)
      setSelected(new Set())
      setClearOpen(false)
      setIsCalendarLoading(true)
      setReloadKey((key) => key + 1)
    } catch (error: unknown) {
      setActionError(getApiErrorMessage(error, "آزادسازی روزها با خطا مواجه شد."))
    } finally {
      setIsApplying(false)
    }
  }

  if (isMetaLoading) return <CalendarSkeleton />

  if (isNotFound) {
    return (
      <EmptyState
        icon={Building2}
        title="اقامتگاه مورد نظر پیدا نشد"
        description="این اقامتگاه حذف شده یا شناسه آن معتبر نیست."
        action={
          <Button asChild>
            <Link href="/host/listings">بازگشت به اقامتگاه‌های من</Link>
          </Button>
        }
      />
    )
  }

  if (metaError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>بارگذاری تقویم انجام نشد</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{metaError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="border-line bg-transparent"
          >
            تلاش مجدد
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (detail && !isOwner) {
    return (
      <EmptyState
        icon={Building2}
        title="این اقامتگاه متعلق به شما نیست"
        description="فقط میزبان یا مدیر سامانه می‌تواند تقویم این اقامتگاه را مدیریت کند."
        action={
          <Button asChild variant="outline" className="border-line bg-transparent">
            <Link href="/host/listings">بازگشت به اقامتگاه‌های من</Link>
          </Button>
        }
      />
    )
  }

  if (!detail) return <CalendarSkeleton />

  const selectedCount = selected.size

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-ink">{detail.title}</h2>
            <span className="rounded-full border border-line bg-paper-card px-2.5 py-0.5 text-[10px] font-bold text-ink-soft">
              نرخ پایه {formatToman(detail.base_price)} تومان
            </span>
          </div>
          <p className="text-xs text-ink-soft">
            {detail.city?.name ? `${detail.city.name} · ` : ""}
            تقویم ماهانه قیمت و دسترس‌پذیری
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="gap-1.5">
            <a href="#pricing-panel">
              <Sparkles className="size-3.5" aria-hidden="true" />
              نرخ‌گذاری سریع
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-line bg-paper-card">
            <Link href={`/host/listings/${listingId}/edit`}>ویرایش اقامتگاه</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-line bg-paper-card">
            <Link href={`/host/listings/${listingId}/preview`}>پیش‌نمایش</Link>
          </Button>
        </div>
      </div>

      {actionError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>عملیات تقویم انجام نشد</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {notice ? (
        <Alert className="border-trust/30 bg-trust/10 text-trust">
          <CheckCircle2 className="size-4" />
          <AlertTitle>تقویم به‌روز شد</AlertTitle>
          <AlertDescription className="text-trust">{notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border border-line/70 bg-paper-deep/35 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-trust/10 text-trust">
              <Link2 className="size-4" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-ink">
                {detail.external_calendar_url
                  ? "تقویم iCal بیرونی متصل است"
                  : "تقویم iCal بیرونی متصل نیست"}
              </p>
              <p className="text-[11px] leading-5 text-ink-soft">
                {detail.external_calendar_url
                  ? detail.last_calendar_sync_at
                    ? `آخرین همگام‌سازی: ${formatPersianDate(detail.last_calendar_sync_at)}`
                    : "هنوز همگام‌سازی انجام نشده است."
                  : "برای نمایش مسدودی‌های بیرونی، آدرس iCal را در صفحه ویرایش ثبت کنید."}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="border-line bg-paper-card">
            <Link href={`/host/listings/${listingId}/edit`}>
              {detail.external_calendar_url ? "تنظیم همگام‌سازی" : "افزودن آدرس iCal"}
            </Link>
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-ink-soft">
          روزهای مسدودشده از iCal و مسدودی‌های دستی هر دو با نشان مسدود نمایش داده می‌شوند؛ مرجع
          تفکیک منبع، تنظیمات همگام‌سازی است.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="خلاصه ماه">
        <div className="rounded-xl border border-line/70 bg-paper-card p-3">
          <p className="text-[10px] font-bold text-ink-soft">آزاد</p>
          <p className="mt-1 text-lg font-black tabular-nums text-trust">
            {formatFaNumber(counts.available)}
          </p>
        </div>
        <div className="rounded-xl border border-line/70 bg-paper-card p-3">
          <p className="text-[10px] font-bold text-ink-soft">رزروشده</p>
          <p className="mt-1 text-lg font-black tabular-nums text-ink">
            {formatFaNumber(counts.booked)}
          </p>
        </div>
        <div className="rounded-xl border border-line/70 bg-paper-card p-3">
          <p className="text-[10px] font-bold text-ink-soft">مسدود</p>
          <p className="mt-1 text-lg font-black tabular-nums text-brick">
            {formatFaNumber(counts.blocked)}
          </p>
        </div>
        <div className="rounded-xl border border-line/70 bg-paper-card p-3">
          <p className="text-[10px] font-bold text-ink-soft">نرخ ویژه</p>
          <p className="mt-1 text-lg font-black tabular-nums text-gold">
            {formatFaNumber(counts.priced)}
          </p>
        </div>
      </div>

      <section
        aria-labelledby="per-night-pricing-title"
        className="rounded-2xl border border-line/80 bg-paper-card p-4 shadow-soft sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brick-soft/70 text-brick">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h3 id="per-night-pricing-title" className="text-sm font-black text-ink sm:text-base">
              قیمت هر شب را جداگانه تعیین کنید
            </h3>
            <p className="text-[11px] leading-6 text-ink-soft">
              با انتخاب چند روز از تقویم، نرخ ویژه، حداقل اقامت یا مسدودی همان شب‌ها را تعیین کنید.
            </p>
          </div>
        </div>

        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {PRICING_STEPS.map((step, index) => (
            <li
              key={step}
              className="flex items-center gap-2 rounded-xl border border-line/60 bg-paper-deep/35 px-3 py-2"
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brick text-[10px] font-black tabular-nums text-on-brick">
                {formatFaNumber(index + 1)}
              </span>
              <span className="text-[11px] font-medium leading-5 text-ink">{step}</span>
            </li>
          ))}
        </ol>

        <div
          role="group"
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/60 pt-3"
          aria-label="راهنمای روزهای تقویم"
        >
          <span className="text-[10px] font-bold text-ink-soft">راهنما:</span>
          {LEGEND.map((item) => (
            <span
              key={item.kind}
              className="flex items-center gap-1.5 text-[10px] font-medium text-ink-soft"
            >
              <span className={cn("size-2.5 rounded-full", item.dot)} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line/80 bg-paper-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-[11px] font-bold tracking-[0.18em] text-brick">تقویم ماهانه</p>
            <h3 className="text-lg font-black text-ink">{monthTitle}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="ماه قبل"
              onClick={() => handleMonthChange(previousPersianMonthStart(monthStart))}
              className="size-9 min-h-9 min-w-9 border-line bg-paper-card"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleMonthChange(persianMonthStart(today))}
              className="text-xs font-bold text-ink-soft"
            >
              امروز
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="ماه بعد"
              onClick={() => handleMonthChange(nextPersianMonthStart(monthStart))}
              className="size-9 min-h-9 min-w-9 border-line bg-paper-card"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {calendarError ? (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="size-4" />
            <AlertTitle>بارگذاری ماه انجام نشد</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{calendarError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="border-line bg-transparent"
              >
                تلاش مجدد
              </Button>
            </AlertDescription>
          </Alert>
        ) : isCalendarLoading ? (
          <Skeleton className="mt-4 h-[420px] w-full rounded-2xl" />
        ) : (
          <div className="mt-4">
            <div className="grid grid-cols-7 gap-1.5 text-center sm:gap-2">
              {WEEK_DAYS.map((weekDay) => (
                <div key={weekDay} className="py-1 text-[10px] font-bold text-ink-soft">
                  {weekDay}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
              {Array.from({ length: monthGroup?.leadingBlanks ?? 0 }).map((_, index) => (
                <div
                  key={`blank-${index}`}
                  aria-hidden="true"
                  className="min-h-16 rounded-xl border border-dashed border-line/30 bg-paper-deep/10 sm:min-h-24"
                />
              ))}
              {monthGroup?.days.map((day) => {
                const kind = dayKind(day, bookedDates, today)
                const isSelected = selected.has(day.date)
                const canSelect = kind !== "booked" && kind !== "past"
                const parts = getPersianParts(day.date)

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => toggleDay(day)}
                    disabled={!canSelect}
                    aria-pressed={isSelected}
                    aria-label={`${formatPersianDate(day.date)}، ${
                      LEGEND.find((item) => item.kind === kind)?.label ??
                      (kind === "past" ? "گذشته" : "روز تقویم")
                    }، ${formatToman(day.price)} تومان`}
                    className={cn(
                      "relative flex min-h-16 flex-col justify-between rounded-xl border p-2 text-right transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:min-h-24 sm:p-2.5",
                      DAY_KIND_CLASSES[kind],
                      canSelect ? "cursor-pointer" : "cursor-not-allowed",
                      isSelected &&
                        "z-10 border-brick ring-2 ring-brick ring-offset-2 ring-offset-paper",
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-1">
                      <span className="text-xs font-black tabular-nums sm:text-sm">
                        {formatFaNumber(parts.day)}
                      </span>
                      {kind === "booked" ? (
                        <Lock className="size-3 text-night-foreground/80" aria-hidden="true" />
                      ) : kind === "blocked" ? (
                        <Lock className="size-3 text-brick" aria-hidden="true" />
                      ) : kind === "priced" ? (
                        <Sparkles className="size-3 text-gold" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="block w-full truncate text-[9px] tabular-nums opacity-80 sm:text-[10px]">
                      {formatToman(day.price)}
                    </span>
                    {isSelected ? (
                      <span
                        className="absolute -left-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-paper-card bg-brick text-[10px] font-black text-on-brick shadow-soft"
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section
        id="pricing-panel"
        className="scroll-mt-24 rounded-2xl border border-line/80 bg-paper-card p-4 shadow-soft sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-bold tracking-[0.18em] text-brick">اقدام گروهی</p>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-ink">مدیریت روزهای انتخاب‌شده</h3>
              {selectedCount > 0 ? (
                <Badge
                  variant="outline"
                  className="border-brick/30 bg-brick-soft/60 text-[10px] font-bold tabular-nums text-brick"
                >
                  {formatFaNumber(selectedCount)} روز انتخاب‌شده
                </Badge>
              ) : null}
            </div>
            <p className="text-xs leading-6 text-ink-soft">
              {selectedCount > 0
                ? "برای اعمال تغییر، نرخ هر شب یا حداقل اقامت را وارد کنید."
                : "روزهای آزاد، دارای نرخ ویژه یا مسدود را از تقویم انتخاب کنید؛ روزهای رزروشده و گذشته قابل انتخاب نیستند."}
            </p>
          </div>
          {selectedCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={isApplying}
              className="text-xs text-ink-soft"
            >
              پاک کردن انتخاب
            </Button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line/60 bg-paper-deep/35 px-3 py-2 text-[11px] text-ink-soft">
          <span className="font-bold text-ink">
            نرخ پایه: {formatToman(detail.base_price)} تومان
          </span>
          <span aria-hidden="true" className="size-1 rounded-full bg-line-strong" />
          <span>{formatFaNumber(counts.priced)} شب با نرخ ویژه در این ماه</span>
        </div>

        <div className="mt-3 rounded-xl border border-line/60 bg-paper-deep/35 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-ink">انتخاب سریع روزها</p>
            <p className="text-[10px] leading-5 text-ink-soft">
              انتخاب با تغییر ماه پاک نمی‌شود؛ می‌توانید چند ماه را با هم نرخ‌گذاری کنید.
            </p>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {WEEK_DAYS.map((label, index) => {
              const isActive = selectedWeekdays.has(index)
              return (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  aria-pressed={isActive}
                  title={WEEK_DAY_LABELS[index]}
                  onClick={() => toggleWeekday(index)}
                  className={cn(
                    "h-8 min-w-8 px-2.5 text-[11px] font-bold",
                    !isActive && "border-line bg-paper-card",
                  )}
                >
                  {label}
                </Button>
              )
            })}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleWeekendPreset}
              className="border-line bg-paper-card text-[11px]"
            >
              آخر هفته (پنجشنبه و جمعه)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSelectAllFree}
              className="border-line bg-paper-card text-[11px]"
            >
              همهٔ روزهای آزاد ماه
            </Button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <JalaliDateField
              label="از تاریخ"
              value={rangeStart}
              min={today}
              onChange={setRangeStart}
              boxed
            />
            <JalaliDateField
              label="تا تاریخ"
              value={rangeEnd}
              min={rangeStart || today}
              onChange={setRangeEnd}
              boxed
            />
            <Button
              type="button"
              size="sm"
              onClick={handleSelectRange}
              disabled={isRangeLoading}
              className="h-11 gap-2"
            >
              {isRangeLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              افزودن بازه به انتخاب
            </Button>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-ink-soft">
            در بازهٔ انتخابی، روزهای رزروشده و گذشته نادیده گرفته می‌شوند؛ حداکثر{" "}
            {formatFaNumber(MAX_SELECTED_DAYS)} روز.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="calendar-price" className="text-xs font-bold text-ink">
              قیمت هر شب (تومان)
            </label>
            <PersianNumberInput
              id="calendar-price"
              min={0}
              value={priceInput.trim() === "" ? null : Number(priceInput)}
              emptyValue={null}
              onValueChange={(value) => setPriceInput(value === null ? "" : String(value))}
              placeholder="مثلاً ۲٬۵۰۰٬۰۰۰"
              aria-describedby="calendar-price-hint"
              className="h-11 border-line bg-paper text-sm tabular-nums"
            />
            <p id="calendar-price-hint" className="text-[10px] leading-5 text-ink-soft">
              خالی بگذارید تا نرخ پایه حفظ شود.
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="calendar-min-nights" className="text-xs font-bold text-ink">
              حداقل اقامت (شب) <span className="font-normal text-ink-soft">(اختیاری)</span>
            </label>
            <PersianNumberInput
              id="calendar-min-nights"
              min={1}
              value={minNightsInput.trim() === "" ? null : Number(minNightsInput)}
              emptyValue={null}
              onValueChange={(value) => setMinNightsInput(value === null ? "" : String(value))}
              placeholder="اختیاری"
              className="h-11 border-line bg-paper text-sm tabular-nums"
            />
            <p className="text-[10px] leading-5 text-ink-soft">
              اختیاری؛ فقط برای روزهای انتخاب‌شده اعمال می‌شود.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleApplyRate}
            disabled={selectedCount === 0 || isApplying}
            className="gap-2"
          >
            {isApplying ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            <span>اعمال نرخ و حداقل اقامت</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleBlock}
            disabled={selectedCount === 0 || isApplying}
            className="gap-2 border-brick/30 bg-brick/5 text-brick hover:bg-brick/10"
          >
            <Lock className="size-4" aria-hidden="true" />
            <span>مسدود کردن روزها</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setClearOpen(true)}
            disabled={selectedCount === 0 || isApplying}
            className="gap-2 text-ink-soft hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            <span>پاک‌کردن استثنا و آزادسازی</span>
          </Button>
        </div>

        <p className="mt-3 text-[11px] leading-5 text-ink-soft">
          هر درخواست حداکثر {formatFaNumber(MAX_CALENDAR_BATCH_DAYS)} روز را پوشش می‌دهد؛ بازه‌های
          بزرگ‌تر خودکار به چند درخواست تقسیم می‌شوند. اگر نرخ خالی بماند، نرخ ویژه روزهای انتخابی
          حذف و نرخ پایه اعمال می‌شود.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" className="border-line bg-transparent">
          <Link href="/host/listings">بازگشت به اقامتگاه‌های من</Link>
        </Button>
        <Button asChild variant="ghost" className="gap-1.5 text-ink-soft">
          <Link href={`/host/listings/${listingId}/edit`}>
            <CalendarDays className="size-4" aria-hidden="true" />
            تنظیمات اقامتگاه
          </Link>
        </Button>
      </div>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent dir="rtl" className="text-right sm:max-w-md">
          <DialogHeader>
            <DialogTitle>پاک‌کردن استثناهای تقویم</DialogTitle>
            <DialogDescription className="leading-7">
              استثناهای نرخ، حداقل اقامت و مسدودی برای {formatFaNumber(selectedCount)} روز
              انتخاب‌شده حذف می‌شود و این روزها به شرایط پایه اقامتگاه برمی‌گردند. رزروهای ثبت‌شده
              تغییری نمی‌کنند.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearOpen(false)}
              disabled={isApplying}
              className="border-line bg-transparent"
            >
              انصراف
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleClearExceptions}
              disabled={isApplying}
            >
              {isApplying ? "در حال آزادسازی…" : "آزادسازی روزها"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ListingCalendarPage({ params }: CalendarPageProps) {
  const resolvedParams = React.use(params)
  const listingId = Number(resolvedParams.id)
  const isInvalidId =
    !listingId || Number.isNaN(listingId) || !Number.isInteger(listingId) || listingId <= 0

  return (
    <HostPageLayout
      eyebrow="مدیریت تقویم"
      title="تقویم اقامتگاه"
      description="دسترس‌پذیری، نرخ هر شب و مسدودی‌ها را برای ماه‌های مختلف مدیریت کنید."
      backHref="/host/listings"
      backLabel="بازگشت به اقامتگاه‌های من"
      contentClassName="max-w-6xl"
    >
      {isInvalidId ? (
        <EmptyState
          icon={Building2}
          title="اقامتگاه مورد نظر پیدا نشد"
          description="شناسه اقامتگاه معتبر نیست. از فهرست اقامتگاه‌ها یک مورد را انتخاب کنید."
          action={
            <Button asChild>
              <Link href="/host/listings">فهرست اقامتگاه‌ها</Link>
            </Button>
          }
        />
      ) : (
        <HostAccessGate
          title="تقویم اقامتگاه"
          description="برای مدیریت تقویم، وارد حساب میزبان خود شوید."
        >
          <ListingCalendarContent listingId={listingId} />
        </HostAccessGate>
      )}
    </HostPageLayout>
  )
}
