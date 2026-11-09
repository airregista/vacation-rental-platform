"use client"

import * as React from "react"
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, AlertCircle, RotateCcw } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { CalendarDayInfo } from "@/types/detail"

export interface AvailabilityCalendarProps {
  accommodationId: number
  minNights: number
  basePrice: number
  checkIn: string | null
  checkOut: string | null
  onDateRangeChange: (checkIn: string | null, checkOut: string | null) => void
}

interface CalendarDayCell {
  isoDate: string
  persianDay: number
  dayInfo: CalendarDayInfo
  isPast?: boolean
}

interface CalendarMonthGroup {
  key: string // e.g. "1405-8"
  title: string // e.g. "آبان ۱۴۰۵"
  leadingBlanks: number
  days: CalendarDayCell[]
}

const WEEK_DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"]

const emptySubscribe = () => () => {}

export function AvailabilityCalendar({
  accommodationId,
  minNights,
  basePrice,
  checkIn,
  checkOut,
  onDateRangeChange,
}: AvailabilityCalendarProps) {
  const [calendarDays, setCalendarDays] = React.useState<CalendarDayInfo[]>([])
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [errorNotice, setErrorNotice] = React.useState<string | null>(null)
  const [mobileMonthIndex, setMobileMonthIndex] = React.useState(0)
  const [desktopMonthIndex, setDesktopMonthIndex] = React.useState(0)

  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  // Fetch 60-day calendar availability
  React.useEffect(() => {
    let isCurrent = true

    const fetchCalendar = async () => {
      try {
        const data = await apiClient.get<CalendarDayInfo[]>(
          `/accommodations/${accommodationId}/calendar?days=60`
        )
        if (isCurrent) {
          setCalendarDays(data || [])
          setIsLoading(false)
        }
      } catch {
        if (isCurrent) {
          setCalendarDays([])
          setIsLoading(false)
        }
      }
    }

    fetchCalendar()

    return () => {
      isCurrent = false
    }
  }, [accommodationId])

  // Fast map lookup for date availability and price
  const daysMap = React.useMemo(() => {
    const map = new Map<string, CalendarDayInfo>()
    for (const d of calendarDays) {
      map.set(d.date, d)
    }
    return map
  }, [calendarDays])

  // Group days into Persian months with accurate month start & past padding
  const months = React.useMemo<CalendarMonthGroup[]>(() => {
    if (calendarDays.length === 0) return []

    const groups: Map<string, CalendarMonthGroup> = new Map()

    for (const d of calendarDays) {
      const dateObj = new Date(d.date + "T00:00:00Z")

      // Extract Persian parts
      const parts = new Intl.DateTimeFormat("en-u-ca-persian", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).formatToParts(dateObj)

      let pYear = "1405"
      let pMonth = "1"
      let pDay = 1

      for (const part of parts) {
        if (part.type === "year") pYear = part.value
        if (part.type === "month") pMonth = part.value
        if (part.type === "day") pDay = parseInt(part.value, 10)
      }

      const key = `${pYear}-${pMonth}`

      if (!groups.has(key)) {
        const monthName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
          month: "long",
        }).format(dateObj)
        const yearPersian = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
          year: "numeric",
        }).format(dateObj)

        // Day 1 of this Persian month
        const firstDayOfMonthDate = new Date(dateObj.getTime() - (pDay - 1) * 86400000)
        // Weekday index starting from Saturday (0: Sat, ..., 6: Fri)
        const monthFirstWeekday = (firstDayOfMonthDate.getUTCDay() + 1) % 7

        const initialDays: CalendarDayCell[] = []
        // Pad past days of this month prior to first available date
        for (let day = 1; day < pDay; day++) {
          initialDays.push({
            isoDate: `past-${key}-${day}`,
            persianDay: day,
            dayInfo: {
              date: "",
              price: 0,
              is_available: false,
              is_exception: false,
            },
            isPast: true,
          })
        }

        groups.set(key, {
          key,
          title: `${monthName} ${yearPersian}`,
          leadingBlanks: monthFirstWeekday,
          days: initialDays,
        })
      }

      groups.get(key)!.days.push({
        isoDate: d.date,
        persianDay: pDay,
        dayInfo: d,
        isPast: false,
      })
    }

    return Array.from(groups.values())
  }, [calendarDays])

  // Date difference helper in days
  const getNights = (d1: string, d2: string): number => {
    const t1 = new Date(d1 + "T00:00:00Z").getTime()
    const t2 = new Date(d2 + "T00:00:00Z").getTime()
    return Math.round((t2 - t1) / (1000 * 60 * 60 * 24))
  }

  // Check if any day in [start, end) has is_available === false
  const hasBlockedDaysInRange = (
    start: string,
    end: string,
    lookup: Map<string, CalendarDayInfo>
  ): boolean => {
    const cur = new Date(start + "T00:00:00Z")
    const endDate = new Date(end + "T00:00:00Z")
    while (cur < endDate) {
      const dateStr = cur.toISOString().split("T")[0]
      const info = lookup.get(dateStr)
      if (!info || !info.is_available) {
        return true
      }
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return false
  }

  // Handle Day Click Selection
  const handleDayClick = (clickedDate: string, dayInfo: CalendarDayInfo) => {
    setErrorNotice(null)

    // Initial click or reset if both are already chosen
    if (!checkIn || (checkIn && checkOut)) {
      if (!dayInfo.is_available) return
      onDateRangeChange(clickedDate, null)
      return
    }

    // Second click when checkIn is selected and !checkOut
    if (clickedDate <= checkIn) {
      if (!dayInfo.is_available) return
      // User clicked same or earlier date: reset checkIn to this date
      onDateRangeChange(clickedDate, null)
      return
    }

    // User is selecting checkout on clickedDate (> checkIn):
    // Check if any day in [checkIn, clickedDate) is unavailable.
    // Note: clickedDate itself is checkout and does not need to be available.
    if (hasBlockedDaysInRange(checkIn, clickedDate, daysMap)) {
      setErrorNotice("امکان انتخاب بازه‌ای که شامل روزهای پرشده باشد وجود ندارد.")
      if (dayInfo.is_available) {
        onDateRangeChange(clickedDate, null)
      }
      return
    }

    // Scan all stayed nights strictly in [checkIn, clickedDate) for maximum dayInfo.min_nights
    let requiredMinNights = minNights
    const cur = new Date(checkIn + "T00:00:00Z")
    const end = new Date(clickedDate + "T00:00:00Z")
    while (cur < end) {
      const dStr = cur.toISOString().split("T")[0]
      const info = daysMap.get(dStr)
      if (info?.min_nights && info.min_nights > requiredMinNights) {
        requiredMinNights = info.min_nights
      }
      cur.setUTCDate(cur.getUTCDate() + 1)
    }

    const nights = getNights(checkIn, clickedDate)
    if (nights < requiredMinNights) {
      setErrorNotice(`حداقل مدت اقامت در این بازه ${formatPersian(requiredMinNights)} شب است.`)
      return
    }

    // Valid checkout date selected
    onDateRangeChange(checkIn, clickedDate)
  }

  const handleClearDates = () => {
    setErrorNotice(null)
    onDateRangeChange(null, null)
  }

  const formatPersian = (n: number) => new Intl.NumberFormat("fa-IR").format(n)

  if (!isClient) {
    return <div className="h-64 rounded-2xl bg-muted/40 animate-pulse" />
  }

  const renderMonth = (month: CalendarMonthGroup) => {
    return (
      <div key={month.key} className="flex-1 min-w-[280px]">
        <div className="text-center font-semibold text-sm mb-4 text-foreground">
          {month.title}
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground font-medium mb-2">
          {WEEK_DAYS.map((w, i) => (
            <div key={i} className="py-1">
              {w}
            </div>
          ))}
        </div>

        {/* Day Grid */}
        <div className="grid grid-cols-7 gap-y-1 gap-x-1">
          {/* Leading Blanks */}
          {Array.from({ length: month.leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} className="h-12 w-full" />
          ))}

          {/* Actual Days & Past Padded Days */}
          {month.days.map((cell) => {
            if (cell.isPast) {
              return (
                <div
                  key={cell.isoDate}
                  className="h-12 flex flex-col items-center justify-center opacity-25 text-muted-foreground pointer-events-none select-none"
                >
                  <span className="text-xs leading-none">
                    {formatPersian(cell.persianDay)}
                  </span>
                </div>
              )
            }

            const isStart = checkIn === cell.isoDate
            const isEnd = checkOut === cell.isoDate
            const isInRange =
              checkIn && checkOut && cell.isoDate > checkIn && cell.isoDate < checkOut

            // Can this date serve as checkout?
            const canBeCheckout =
              checkIn !== null &&
              checkOut === null &&
              cell.isoDate > checkIn &&
              !hasBlockedDaysInRange(checkIn, cell.isoDate, daysMap)

            // Blocked if unavailable AND cannot be selected as checkout, and not already selected as isEnd
            const isBlocked = !cell.dayInfo.is_available && !canBeCheckout && !isEnd
            const effectivePrice =
              cell.dayInfo.price > 0 ? cell.dayInfo.price : basePrice

            let dayStyle = "text-foreground hover:bg-accent cursor-pointer rounded-lg"
            if (isBlocked) {
              dayStyle =
                "opacity-40 line-through text-muted-foreground pointer-events-none bg-transparent cursor-not-allowed"
            } else if (isStart && isEnd) {
              dayStyle = "bg-primary text-primary-foreground font-bold rounded-lg shadow-sm"
            } else if (isStart) {
              dayStyle =
                "bg-primary text-primary-foreground font-bold rounded-r-lg rounded-l-none shadow-sm"
            } else if (isEnd) {
              dayStyle =
                "bg-primary text-primary-foreground font-bold rounded-l-lg rounded-r-none shadow-sm"
            } else if (isInRange) {
              dayStyle = "bg-primary/10 text-primary font-medium rounded-none"
            } else if (!cell.dayInfo.is_available && canBeCheckout) {
              // Day is booked for new check-in, but eligible as checkout
              dayStyle =
                "text-foreground hover:bg-accent cursor-pointer rounded-lg border border-dashed border-border"
            }

            return (
              <button
                type="button"
                key={cell.isoDate}
                disabled={isBlocked}
                onClick={() => handleDayClick(cell.isoDate, cell.dayInfo)}
                className={`h-12 flex flex-col items-center justify-center transition-colors select-none ${dayStyle}`}
              >
                <span className="text-xs leading-none">
                  {formatPersian(cell.persianDay)}
                </span>
                {!isBlocked && effectivePrice > 0 && (
                  <span
                    className={`text-[9px] mt-1 leading-none truncate max-w-full px-0.5 ${
                      isStart || isEnd
                        ? "text-primary-foreground/90 font-light"
                        : "text-muted-foreground"
                    }`}
                  >
                    {formatPersian(Math.round(effectivePrice / 1000))}ک
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <span>تقویم و ظرفیت اقامتگاه</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            قیمت‌ها بر حسب هزار تومان نمایش داده شده‌اند.
          </p>
        </div>

        {(checkIn || checkOut) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearDates}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>پاک کردن تاریخ‌ها</span>
          </Button>
        )}
      </div>

      {/* Minimum Stay Alert */}
      {minNights > 1 && (
        <Alert variant="default" className="py-2.5 bg-muted/60 border-border">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-xs font-semibold">شرط حداقل اقامت</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            حداقل مدت اقامت در این اقامتگاه {formatPersian(minNights)} شب است.
          </AlertDescription>
        </Alert>
      )}

      {/* Selection Validation Error Alert */}
      {errorNotice && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{errorNotice}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="h-64 rounded-2xl bg-muted/30 animate-pulse flex items-center justify-center text-muted-foreground text-sm">
          در حال بارگذاری تقویم...
        </div>
      ) : months.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground border rounded-2xl bg-muted/20">
          اطلاعات تقویم برای این اقامتگاه یافت نشد.
        </div>
      ) : (
        <div className="border border-border rounded-2xl p-4 sm:p-6 bg-card">
          {/* Desktop: 2 side-by-side months with pagination */}
          <div className="hidden md:block">
            {months.length > 2 && (
              <div className="flex items-center justify-between mb-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={desktopMonthIndex === 0}
                  onClick={() => setDesktopMonthIndex((prev) => Math.max(0, prev - 1))}
                  className="gap-1 text-xs"
                >
                  <ChevronRight className="h-4 w-4" />
                  <span>ماه قبلی</span>
                </Button>
                <span className="text-xs text-muted-foreground">
                  نمایش ماه {formatPersian(desktopMonthIndex + 1)} و {formatPersian(desktopMonthIndex + 2)} از {formatPersian(months.length)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={desktopMonthIndex + 2 >= months.length}
                  onClick={() => setDesktopMonthIndex((prev) => Math.min(months.length - 2, prev + 1))}
                  className="gap-1 text-xs"
                >
                  <span>ماه بعدی</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-8">
              {months.slice(desktopMonthIndex, desktopMonthIndex + 2).map((month) => renderMonth(month))}
            </div>
          </div>

          {/* Mobile: 1 month with switcher */}
          <div className="block md:hidden">
            <div className="flex items-center justify-between mb-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="ماه قبل"
                disabled={mobileMonthIndex === 0}
                onClick={() => setMobileMonthIndex((prev) => Math.max(0, prev - 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                ماه {formatPersian(mobileMonthIndex + 1)} از {formatPersian(months.length)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="ماه بعد"
                disabled={mobileMonthIndex >= months.length - 1}
                onClick={() =>
                  setMobileMonthIndex((prev) => Math.min(months.length - 1, prev + 1))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            {months[mobileMonthIndex] && renderMonth(months[mobileMonthIndex])}
          </div>
        </div>
      )}
    </div>
  )
}
