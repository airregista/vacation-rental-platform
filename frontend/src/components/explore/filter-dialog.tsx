"use client"

import * as React from "react"
import { apiClient } from "@/lib/api-client"
import type { Amenity, AccommodationSearchParams } from "@/types/accommodation"
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
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Plus, Minus, RotateCcw } from "lucide-react"

export interface FilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentParams: AccommodationSearchParams
  onApplyFilters: (filters: Partial<AccommodationSearchParams>) => void
}

const DEFAULT_MAX_PRICE = 20000000

interface FilterFormProps {
  priceRange: [number, number]
  setPriceRange: (range: [number, number]) => void
  minRooms: number
  setMinRooms: (n: number) => void
  minBeds: number
  setMinBeds: (n: number) => void
  selectedAmenityIds: number[]
  setSelectedAmenityIds: (ids: number[]) => void
  sortBy: "newest" | "price_asc" | "price_desc"
  setSortBy: (s: "newest" | "price_asc" | "price_desc") => void
  amenities: Amenity[]
  isLoadingAmenities: boolean
  amenitiesError: boolean
  onRetryAmenities: () => void
  onApply: (filters: Partial<AccommodationSearchParams>) => void
}

function FilterForm({
  priceRange,
  setPriceRange,
  minRooms,
  setMinRooms,
  minBeds,
  setMinBeds,
  selectedAmenityIds,
  setSelectedAmenityIds,
  sortBy,
  setSortBy,
  amenities,
  isLoadingAmenities,
  amenitiesError,
  onRetryAmenities,
  onApply,
}: FilterFormProps) {
  const handleReset = () => {
    setPriceRange([0, DEFAULT_MAX_PRICE])
    setMinRooms(0)
    setMinBeds(0)
    setSelectedAmenityIds([])
    setSortBy("newest")
  }

  const handleSubmit = () => {
    onApply({
      min_price: priceRange[0] > 0 ? priceRange[0] : undefined,
      max_price: priceRange[1] < DEFAULT_MAX_PRICE ? priceRange[1] : undefined,
      min_rooms: minRooms > 0 ? minRooms : undefined,
      min_beds: minBeds > 0 ? minBeds : undefined,
      amenity_ids: selectedAmenityIds.length > 0 ? selectedAmenityIds : undefined,
      sort_by: sortBy,
    })
  }

  const toggleAmenity = (id: number) => {
    setSelectedAmenityIds(
      selectedAmenityIds.includes(id)
        ? selectedAmenityIds.filter((item) => item !== id)
        : [...selectedAmenityIds, id],
    )
  }

  const formatToman = (val: number) => new Intl.NumberFormat("fa-IR").format(val)

  return (
    <>
      <div className="overflow-y-auto p-5 flex-1 space-y-6 text-right">
        {/* 1. Price Range */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">بازه قیمتی (هر شب)</span>
            <span className="text-xs text-primary font-semibold">
              {formatToman(priceRange[0])} تا {formatToman(priceRange[1])} تومان
            </span>
          </div>
          <Slider
            value={priceRange}
            min={0}
            max={DEFAULT_MAX_PRICE}
            step={100000}
            onValueChange={(val) => setPriceRange([val[0], val[1]])}
            className="py-4"
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>۰ تومان</span>
            <span>{formatToman(DEFAULT_MAX_PRICE)} تومان +</span>
          </div>
        </div>

        <Separator />

        {/* 2. Rooms and Beds */}
        <div className="space-y-4">
          <span className="text-sm font-bold text-foreground block">اتاق و تخت‌خواب</span>

          {/* Min Rooms */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">حداقل تعداد اتاق</span>
              <span className="text-[11px] text-muted-foreground">
                {minRooms === 0
                  ? "بدون محدودیت"
                  : `${new Intl.NumberFormat("fa-IR").format(minRooms)} اتاق یا بیشتر`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMinRooms(Math.max(0, minRooms - 1))}
                disabled={minRooms <= 0}
                aria-label="کاهش تعداد اتاق"
                className="size-8 rounded-full"
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="w-8 text-center text-xs font-bold">
                {minRooms === 0 ? "همه" : new Intl.NumberFormat("fa-IR").format(minRooms)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMinRooms(Math.min(10, minRooms + 1))}
                disabled={minRooms >= 10}
                aria-label="افزایش تعداد اتاق"
                className="size-8 rounded-full"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Min Beds */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">حداقل تخت‌خواب</span>
              <span className="text-[11px] text-muted-foreground">
                {minBeds === 0
                  ? "بدون محدودیت"
                  : `${new Intl.NumberFormat("fa-IR").format(minBeds)} تخت یا بیشتر`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMinBeds(Math.max(0, minBeds - 1))}
                disabled={minBeds <= 0}
                aria-label="کاهش تعداد تخت"
                className="size-8 rounded-full"
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="w-8 text-center text-xs font-bold">
                {minBeds === 0 ? "همه" : new Intl.NumberFormat("fa-IR").format(minBeds)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMinBeds(Math.min(20, minBeds + 1))}
                disabled={minBeds >= 20}
                aria-label="افزایش تعداد تخت"
                className="size-8 rounded-full"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* 3. Sort Order */}
        <div className="space-y-3">
          <span className="text-sm font-bold text-foreground block">مرتب‌سازی نتایج</span>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={sortBy === "newest" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("newest")}
              className="text-xs h-9 rounded-xl font-medium"
            >
              جدیدترین
            </Button>
            <Button
              type="button"
              variant={sortBy === "price_asc" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("price_asc")}
              className="text-xs h-9 rounded-xl font-medium"
            >
              ارزان‌ترین
            </Button>
            <Button
              type="button"
              variant={sortBy === "price_desc" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("price_desc")}
              className="text-xs h-9 rounded-xl font-medium"
            >
              گران‌ترین
            </Button>
          </div>
        </div>

        <Separator />

        {/* 4. Amenities Checklist */}
        <div className="space-y-3">
          <span className="text-sm font-bold text-foreground block">امکانات اقامتگاه</span>
          {isLoadingAmenities ? (
            <p className="text-xs text-muted-foreground">در حال بارگذاری امکانات...</p>
          ) : amenitiesError ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs text-destructive font-medium">خطا در بارگذاری امکانات</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetryAmenities}
                className="gap-1.5 text-xs font-semibold shrink-0"
              >
                <RotateCcw className="size-3.5" />
                <span>تلاش مجدد</span>
              </Button>
            </div>
          ) : amenities.length === 0 ? (
            <p className="text-xs text-muted-foreground">امکاناتی یافت نشد.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 pt-1">
              {amenities.map((amenity) => {
                const checked = selectedAmenityIds.includes(amenity.id)
                return (
                  <label
                    key={amenity.id}
                    className="flex items-center gap-2.5 p-2 rounded-xl border border-border/70 hover:bg-muted/40 cursor-pointer transition-colors text-right"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleAmenity(amenity.id)}
                      aria-label={amenity.name}
                    />
                    <span className="text-xs font-medium text-foreground select-none truncate">
                      {amenity.name}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border bg-card/50 flex items-center justify-between w-full gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold"
        >
          <RotateCcw className="size-3.5" />
          <span>پاک کردن همه</span>
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          className="px-6 h-10 rounded-xl text-xs font-bold shadow-sm"
        >
          اعمال فیلترها
        </Button>
      </div>
    </>
  )
}

export function FilterDialog({
  open,
  onOpenChange,
  currentParams,
  onApplyFilters,
}: FilterDialogProps) {
  const [isDesktop, setIsDesktop] = React.useState(true)
  const [amenities, setAmenities] = React.useState<Amenity[]>([])
  const [isLoadingAmenities, setIsLoadingAmenities] = React.useState(true)
  const [amenitiesError, setAmenitiesError] = React.useState(false)
  const [amenitiesRetry, setAmenitiesRetry] = React.useState(0)

  // Draft filter state lives here — not inside FilterForm — so switching
  // between the desktop Dialog and mobile Sheet branches on window resize
  // does not remount the form and discard unapplied draft changes.
  const [priceRange, setPriceRange] = React.useState<[number, number]>([
    currentParams.min_price || 0,
    currentParams.max_price || DEFAULT_MAX_PRICE,
  ])
  const [minRooms, setMinRooms] = React.useState<number>(currentParams.min_rooms || 0)
  const [minBeds, setMinBeds] = React.useState<number>(currentParams.min_beds || 0)
  const [selectedAmenityIds, setSelectedAmenityIds] = React.useState<number[]>(
    currentParams.amenity_ids || [],
  )
  const [sortBy, setSortBy] = React.useState<"newest" | "price_asc" | "price_desc">(
    currentParams.sort_by || "newest",
  )

  // Re-sync the draft from the committed params each time the dialog opens,
  // so a dismissed draft does not leak into the next open.
  const wasOpenRef = React.useRef(open)
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setPriceRange([currentParams.min_price || 0, currentParams.max_price || DEFAULT_MAX_PRICE])
      setMinRooms(currentParams.min_rooms || 0)
      setMinBeds(currentParams.min_beds || 0)
      setSelectedAmenityIds(currentParams.amenity_ids || [])
      setSortBy(currentParams.sort_by || "newest")
    }
    wasOpenRef.current = open
  }, [open, currentParams])

  // Screen size detection
  React.useEffect(() => {
    const updateSize = () => setIsDesktop(window.innerWidth >= 768)
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  // Load amenities
  React.useEffect(() => {
    let isMounted = true
    async function loadAmenities() {
      try {
        const res = await apiClient.get<Amenity[]>("/amenities/")
        if (isMounted) {
          setAmenities(res || [])
          setAmenitiesError(false)
        }
      } catch (err) {
        console.error("Failed to load amenities:", err)
        if (isMounted) {
          setAmenitiesError(true)
        }
      } finally {
        if (isMounted) {
          setIsLoadingAmenities(false)
        }
      }
    }
    loadAmenities()
    return () => {
      isMounted = false
    }
  }, [amenitiesRetry])

  const handleRetryAmenities = () => {
    setIsLoadingAmenities(true)
    setAmenitiesRetry((n) => n + 1)
  }

  const handleApply = (filters: Partial<AccommodationSearchParams>) => {
    onApplyFilters(filters)
    onOpenChange(false)
  }

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border text-right">
            <DialogTitle className="text-base font-bold">فیلترهای پیشرفته</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              تنظیم بازه قیمتی، تعداد اتاق‌ها و امکانات مورد نظر
            </DialogDescription>
          </DialogHeader>

          {open && (
            <FilterForm
              priceRange={priceRange}
              setPriceRange={setPriceRange}
              minRooms={minRooms}
              setMinRooms={setMinRooms}
              minBeds={minBeds}
              setMinBeds={setMinBeds}
              selectedAmenityIds={selectedAmenityIds}
              setSelectedAmenityIds={setSelectedAmenityIds}
              sortBy={sortBy}
              setSortBy={setSortBy}
              amenities={amenities}
              isLoadingAmenities={isLoadingAmenities}
              amenitiesError={amenitiesError}
              onRetryAmenities={handleRetryAmenities}
              onApply={handleApply}
            />
          )}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <SheetHeader className="p-5 pb-3 border-b border-border text-right">
          <SheetTitle className="text-base font-bold">فیلترهای پیشرفته</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            تنظیم بازه قیمتی، تعداد اتاق‌ها و امکانات مورد نظر
          </SheetDescription>
        </SheetHeader>

        {open && (
          <FilterForm
            priceRange={priceRange}
            setPriceRange={setPriceRange}
            minRooms={minRooms}
            setMinRooms={setMinRooms}
            minBeds={minBeds}
            setMinBeds={setMinBeds}
            selectedAmenityIds={selectedAmenityIds}
            setSelectedAmenityIds={setSelectedAmenityIds}
            sortBy={sortBy}
            setSortBy={setSortBy}
            amenities={amenities}
            isLoadingAmenities={isLoadingAmenities}
            amenitiesError={amenitiesError}
            onRetryAmenities={handleRetryAmenities}
            onApply={handleApply}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
