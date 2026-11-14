"use client"

import * as React from "react"
import { Check, ChevronDown, Loader2, MapPin, Search, X } from "lucide-react"
import type { City } from "@/types/accommodation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface CityComboboxProps {
  cities: City[]
  value: number
  onChange: (cityId: number) => void
  disabled?: boolean
  isLoading?: boolean
  id?: string
  /** Inline/pill usage: no leading icon and no floating clear button. */
  compact?: boolean
  /** Extra classes merged onto the trigger (tailwind-merge decides wins). */
  className?: string
  /** Prepend a "no city" option whose value is 0. */
  showAllOption?: boolean
  allLabel?: string
  /** Trigger text when no city is selected. */
  placeholder?: string
  /** Accessible name for the trigger when no visible label wraps it. */
  ariaLabel?: string
}

/**
 * Searchable city picker shared by the host create/edit forms and the search
 * pill. Built from the existing shadcn Popover primitives so no extra
 * combobox dependency is needed.
 */
export function CityCombobox({
  cities,
  value,
  onChange,
  disabled = false,
  isLoading = false,
  id,
  compact = false,
  className,
  showAllOption = false,
  allLabel = "همه شهرها",
  placeholder = "شهر را انتخاب کنید",
  ariaLabel,
}: CityComboboxProps) {
  const generatedId = React.useId()
  const triggerId = id ?? generatedId
  const listboxId = `${generatedId}-listbox`

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const selectedCity = React.useMemo(
    () => cities.find((city) => city.id === value) ?? null,
    [cities, value],
  )

  const allCities = showAllOption
    ? [{ id: 0, province_id: 0, name: allLabel, province: null } satisfies City, ...cities]
    : cities

  const filteredCities = React.useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    if (!term) return allCities
    return allCities.filter((city) => {
      const provinceName = city.province?.name ?? ""
      return (
        city.name.toLocaleLowerCase().includes(term) ||
        provinceName.toLocaleLowerCase().includes(term)
      )
    })
  }, [allCities, query])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setQuery("")
  }

  const handleSelect = (cityId: number) => {
    onChange(cityId)
    setOpen(false)
    setQuery("")
  }

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id={triggerId}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? listboxId : undefined}
            aria-label={id ? undefined : (ariaLabel ?? "انتخاب شهر")}
            disabled={disabled}
            className={cn(
              compact
                ? "h-auto w-full min-w-0 justify-between gap-1 border-none bg-transparent px-0 shadow-none hover:bg-transparent"
                : "h-11 w-full min-w-0 justify-between gap-2 border-line bg-paper-card px-3 font-normal text-ink hover:bg-paper-card",
              className,
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              {!compact && <MapPin className="size-4 shrink-0 text-brick" aria-hidden="true" />}
              {selectedCity && selectedCity.id !== 0 ? (
                <>
                  <span className="truncate text-sm font-bold">{selectedCity.name}</span>
                  {!compact && selectedCity.province?.name ? (
                    <span className="truncate text-xs text-ink-soft">
                      {selectedCity.province.name}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="truncate text-sm text-ink-soft">{placeholder}</span>
              )}
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-ink-soft",
                !compact && selectedCity && !disabled && "me-7",
              )}
              aria-hidden="true"
            />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          dir="rtl"
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-56 overflow-hidden p-0"
          onKeyDown={(event) => {
            if (event.key === "Escape") handleOpenChange(false)
          }}
        >
          <div className="border-b border-line p-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
                aria-hidden="true"
              />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={isLoading}
                placeholder="جستجوی شهر یا استان…"
                aria-label="جستجوی شهر یا استان"
                className="h-9 border-line bg-paper pr-8 text-sm"
              />
            </div>
          </div>

          <div
            id={listboxId}
            role="listbox"
            aria-label="فهرست شهرها"
            className="max-h-60 overflow-y-auto overscroll-contain p-1"
          >
            {isLoading ? (
              <div
                role="status"
                className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-ink-soft"
              >
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span>در حال بارگذاری شهرها…</span>
              </div>
            ) : filteredCities.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-ink-soft">شهری پیدا نشد</p>
            ) : (
              filteredCities.map((city) => {
                const isSelected = city.id === value
                return (
                  <button
                    key={city.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(city.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-sm transition-colors",
                      isSelected
                        ? "bg-brick-soft/60 font-bold text-ink"
                        : "text-ink hover:bg-paper-deep",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{city.name}</span>
                      {city.id !== 0 && city.province?.name ? (
                        <span className="block truncate text-[11px] font-medium text-ink-soft">
                          {city.province.name}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <Check className="size-4 shrink-0 text-brick" aria-hidden="true" />
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedCity && selectedCity.id !== 0 && !disabled && !compact ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            handleOpenChange(false)
            onChange(0)
          }}
          aria-label="پاک کردن شهر انتخاب‌شده"
          className="absolute left-1 top-1/2 size-8 min-h-8 min-w-8 -translate-y-1/2 rounded-full text-ink-soft hover:bg-paper-deep hover:text-ink"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  )
}
