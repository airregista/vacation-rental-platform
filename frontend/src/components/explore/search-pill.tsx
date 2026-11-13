"use client"

import * as React from "react"
import { apiClient } from "@/lib/api-client"
import type { City, AccommodationSearchParams } from "@/types/accommodation"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { JalaliDateField } from "@/components/shared/date-field"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Search, MapPin, Calendar, Users, Plus, Minus, SlidersHorizontal } from "lucide-react"

export interface SearchPillProps {
  currentParams: AccommodationSearchParams
  onSearch: (params: Partial<AccommodationSearchParams>) => void
  onOpenFilters?: () => void
  /** `dock` is the editorial homepage capsule; `pill` is the results bar. */
  variant?: "pill" | "dock"
}

export function SearchPill({
  currentParams,
  onSearch,
  onOpenFilters,
  variant = "pill",
}: SearchPillProps) {
  const [cities, setCities] = React.useState<City[]>([])
  const [isMobileOpen, setIsMobileOpen] = React.useState(false)

  // Local draft states
  const [cityId, setCityId] = React.useState<number | undefined>(currentParams.city_id)
  const [checkIn, setCheckIn] = React.useState<string>(currentParams.check_in || "")
  const [checkOut, setCheckOut] = React.useState<string>(currentParams.check_out || "")
  const [guests, setGuests] = React.useState<number>(currentParams.guests_count || 1)
  const [dateError, setDateError] = React.useState<string | null>(null)

  // Re-sync drafts when the committed params change elsewhere (filter
  // dialog, category chip, clear-filters): the desktop pill has no open
  // event to re-sync on, so without this it keeps showing a stale
  // uncommitted draft as if it were applied.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCityId(currentParams.city_id)
    setCheckIn(currentParams.check_in || "")
    setCheckOut(currentParams.check_out || "")
    setGuests(currentParams.guests_count || 1)
    setDateError(null)
  }, [
    currentParams.city_id,
    currentParams.check_in,
    currentParams.check_out,
    currentParams.guests_count,
  ])

  // Fetch cities on mount
  React.useEffect(() => {
    let isMounted = true
    async function loadCities() {
      try {
        const res = await apiClient.get<City[]>("/geo/cities?limit=100")
        if (isMounted) {
          setCities(res || [])
        }
      } catch (err) {
        console.error("Failed to load cities:", err)
      }
    }
    loadCities()
    return () => {
      isMounted = false
    }
  }, [])

  const todayStr = React.useMemo(() => {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }, [])

  const minCheckOutStr = React.useMemo(() => {
    if (!checkIn) return todayStr
    const [y, m, d] = checkIn.split("-").map(Number)
    if (!y || !m || !d) return todayStr
    const next = new Date(y, m - 1, d + 1)
    const yyyy = next.getFullYear()
    const mm = String(next.getMonth() + 1).padStart(2, "0")
    const dd = String(next.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }, [checkIn, todayStr])

  const handleCheckInChange = (val: string) => {
    setCheckIn(val)
    setDateError(null)
    if (val && checkOut && checkOut <= val) {
      // Auto-adjust or clear checkout if invalid
      setCheckOut("")
    }
  }

  const handleCheckOutChange = (val: string) => {
    setCheckOut(val)
    setDateError(null)
  }

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    // Validate dates invariant: either both provided or neither
    if ((checkIn && !checkOut) || (!checkIn && checkOut)) {
      setDateError("لطفاً هر دو تاریخ ورود و خروج را وارد کنید یا خالی بگذارید.")
      return
    }

    if (checkIn && checkOut && checkOut <= checkIn) {
      setDateError("تاریخ خروج باید بعد از تاریخ ورود باشد.")
      return
    }

    setDateError(null)
    onSearch({
      city_id: cityId,
      check_in: checkIn || undefined,
      check_out: checkOut || undefined,
      guests_count: guests > 1 ? guests : undefined,
    })
    setIsMobileOpen(false)
  }

  const committedCityName = React.useMemo(() => {
    if (!currentParams.city_id) return null
    return cities.find((c) => c.id === currentParams.city_id)?.name || null
  }, [currentParams.city_id, cities])

  const committedGuestsFa = React.useMemo(() => {
    return new Intl.NumberFormat("fa-IR").format(currentParams.guests_count || 1)
  }, [currentParams.guests_count])

  const persianGuests = React.useMemo(() => {
    return new Intl.NumberFormat("fa-IR").format(guests)
  }, [guests])

  const handleOpenMobile = () => {
    setCityId(currentParams.city_id)
    setCheckIn(currentParams.check_in || "")
    setCheckOut(currentParams.check_out || "")
    setGuests(currentParams.guests_count || 1)
    setDateError(null)
    setIsMobileOpen(true)
  }

  return (
    <div className="w-full">
      {/* 1. Desktop Segmented Search Pill (>= md) */}
      <form
        onSubmit={handleSearchSubmit}
        className={
          variant === "dock"
            ? "hidden md:flex items-center justify-between rounded-[1.75rem] border border-line/80 shadow-dock bg-card/90 backdrop-blur-xl p-2 gap-1.5 max-w-5xl mx-auto transition-shadow hover:shadow-lg"
            : "hidden md:flex items-center justify-between rounded-full border border-border shadow-md bg-card p-1.5 gap-2 max-w-4xl mx-auto transition-shadow hover:shadow-lg"
        }
      >
        {/* Segment 1: Destination */}
        <div className="flex-1 flex items-center gap-2.5 px-4 py-1.5 rounded-2xl hover:bg-muted/50 transition-colors">
          <MapPin className="size-4 text-primary shrink-0" />
          <div className="flex flex-col text-right w-full min-w-0">
            <span className="text-[11px] font-bold text-foreground">مقصد</span>
            <select
              value={cityId || ""}
              onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : undefined)}
              aria-label="انتخاب شهر مقصد"
              className="bg-transparent text-xs font-medium text-muted-foreground focus:outline-none cursor-pointer w-full truncate border-none p-0"
            >
              <option value="" className="text-foreground bg-background">
                همه شهرها (کجا می‌روید؟)
              </option>
              {cities.map((city) => (
                <option key={city.id} value={city.id} className="text-foreground bg-background">
                  {city.province?.name ? `${city.name} (${city.province.name})` : city.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Separator orientation="vertical" className="h-8" />

        {/* Segment 2: Dates */}
        <div className="flex-[1.5] flex items-center gap-2 px-3 py-1.5">
          <Calendar className="size-4 text-primary shrink-0" />
          <div className="flex items-center gap-1 text-right">
            <JalaliDateField
              label="ورود"
              ariaLabel="تاریخ ورود"
              value={checkIn}
              min={todayStr}
              onChange={handleCheckInChange}
            />
            <span aria-hidden="true" className="text-xs text-muted-foreground/50">
              –
            </span>
            <JalaliDateField
              label="خروج"
              ariaLabel="تاریخ خروج"
              value={checkOut}
              min={minCheckOutStr}
              onChange={handleCheckOutChange}
            />
          </div>
        </div>

        <Separator orientation="vertical" className="h-8" />

        {/* Segment 3: Guests */}
        <div className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-full hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary shrink-0" />
            <div className="flex flex-col text-right">
              <span className="text-[11px] font-bold text-foreground">مهمانان</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 rounded-full border border-line/70 bg-paper-deep/40 p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setGuests((g) => Math.max(1, g - 1))}
              disabled={guests <= 1}
              aria-label="کاهش مسافران"
              className="size-6 rounded-full p-0 text-ink-soft hover:bg-paper-card hover:text-ink"
            >
              <Minus className="size-3" />
            </Button>
            <span className="min-w-5 text-center text-xs font-bold tabular-nums text-foreground">
              {persianGuests}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setGuests((g) => Math.min(20, g + 1))}
              disabled={guests >= 20}
              aria-label="افزایش مسافران"
              className="size-6 rounded-full p-0 text-ink-soft hover:bg-paper-card hover:text-ink"
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>

        {/* Filter Modal Trigger */}
        {onOpenFilters && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onOpenFilters}
            aria-label="فیلترهای پیشرفته"
            className="size-10 rounded-full shrink-0 text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        )}

        {/* Search Action Button */}
        <Button
          type="submit"
          className="rounded-full px-5 h-10 gap-2 shrink-0 font-bold shadow-sm"
          aria-label="جستجوی اقامتگاه"
        >
          <Search className="size-4" />
          <span>جستجو</span>
        </Button>
      </form>

      {/* Date error alert for desktop */}
      {dateError && (
        <p className="hidden md:block text-xs text-destructive text-center mt-2 font-medium">
          {dateError}
        </p>
      )}

      {/* 2. Mobile Compact Pill (< md) */}
      <div className="flex md:hidden items-center gap-2">
        <button
          type="button"
          onClick={handleOpenMobile}
          className="flex-1 flex items-center justify-between p-3 rounded-full border border-border shadow-sm bg-card text-right hover:border-primary/50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Search className="size-4" />
            </div>
            <div className="flex flex-col min-w-0 truncate">
              <span className="text-xs font-bold text-foreground truncate">
                {committedCityName || "کجا می‌روید؟"}
              </span>
              <span className="text-[11px] text-muted-foreground truncate">
                {currentParams.check_in && currentParams.check_out ? "تاریخ انتخاب شد" : "هر زمان"}{" "}
                • {committedGuestsFa} مسافر
              </span>
            </div>
          </div>
        </button>

        {onOpenFilters && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onOpenFilters}
            aria-label="فیلترهای پیشرفته"
            className="size-12 rounded-full shrink-0 border-border bg-card shadow-sm"
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        )}
      </div>

      {/* 3. Mobile 3-Step Search Drawer */}
      <Sheet
        open={isMobileOpen}
        onOpenChange={(open) => {
          setIsMobileOpen(open)
          if (open) {
            setCityId(currentParams.city_id)
            setCheckIn(currentParams.check_in || "")
            setCheckOut(currentParams.check_out || "")
            setGuests(currentParams.guests_count || 1)
            setDateError(null)
          }
        }}
      >
        <SheetContent side="bottom" className="p-6">
          <SheetHeader className="text-right pb-4">
            <SheetTitle className="text-base font-bold">جستجوی اقامتگاه</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              انتخاب مقصد، تاریخ سفر و تعداد مسافران
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 py-2">
            {/* Step 1: Destination */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary" />
                مقصد
              </label>
              <select
                value={cityId || ""}
                onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : undefined)}
                aria-label="انتخاب شهر مقصد"
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="" className="text-foreground bg-background">
                  همه شهرها
                </option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id} className="text-foreground bg-background">
                    {city.province?.name ? `${city.name} (${city.province.name})` : city.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Dates */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-primary" />
                تاریخ سفر
              </label>
              <div className="grid grid-cols-2 gap-3">
                <JalaliDateField
                  boxed
                  label="ورود"
                  ariaLabel="تاریخ ورود"
                  value={checkIn}
                  min={todayStr}
                  onChange={handleCheckInChange}
                />
                <JalaliDateField
                  boxed
                  label="خروج"
                  ariaLabel="تاریخ خروج"
                  value={checkOut}
                  min={minCheckOutStr}
                  onChange={handleCheckOutChange}
                />
              </div>
            </div>

            {/* Step 3: Guests */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Users className="size-3.5 text-primary" />
                تعداد مسافران
              </label>
              <div className="flex items-center justify-between p-3 rounded-xl border border-input bg-background">
                <span className="text-sm font-medium">{persianGuests} مسافر</span>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setGuests((g) => Math.max(1, g - 1))}
                    disabled={guests <= 1}
                    aria-label="کاهش مسافران"
                    className="size-8 rounded-full"
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setGuests((g) => Math.min(20, g + 1))}
                    disabled={guests >= 20}
                    aria-label="افزایش مسافران"
                    className="size-8 rounded-full"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {dateError && (
              <p className="text-xs text-destructive text-right font-medium">{dateError}</p>
            )}

            {/* Sticky Action Button */}
            <div className="pt-3">
              <Button
                type="button"
                onClick={() => handleSearchSubmit()}
                className="w-full h-12 rounded-xl text-base font-bold gap-2 shadow-md"
              >
                <Search className="size-5" />
                <span>جستجو در آشیانک</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
