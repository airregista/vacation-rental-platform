"use client"

import * as React from "react"
import {
  Wifi,
  Car,
  Waves,
  Utensils,
  Tv,
  Wind,
  Flame,
  Check,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatFaNumber } from "@/lib/format-fa"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Amenity } from "@/types/accommodation"

export interface AmenitiesListProps {
  amenities: Amenity[]
  customAmenities?: string[]
}

interface DisplayAmenity {
  key: string
  name: string
  icon: string | null
}

/** Predefined amenities first, then host free-text names that are not duplicates. */
function buildAmenityItems(
  amenities: Amenity[],
  customAmenities: string[]
): DisplayAmenity[] {
  const seen = new Set(
    amenities.map((amenity) => amenity.name.trim().toLowerCase())
  )

  const items: DisplayAmenity[] = amenities.map((amenity) => ({
    key: `a-${amenity.id}`,
    name: amenity.name,
    icon: amenity.icon ?? null,
  }))

  for (const rawName of customAmenities) {
    const name = rawName.trim()
    const normalized = name.toLowerCase()
    if (!name || seen.has(normalized)) continue
    seen.add(normalized)
    items.push({ key: `custom-${name}`, name, icon: null })
  }

  return items
}

function getAmenityIcon(name: string, iconSlug?: string | null) {
  const query = `${name} ${iconSlug || ""}`.toLowerCase()

  if (query.includes("wifi") || query.includes("اینترنت") || query.includes("وای‌فای")) {
    return Wifi
  }
  if (query.includes("parking") || query.includes("پارکینگ") || query.includes("خودرو")) {
    return Car
  }
  if (query.includes("pool") || query.includes("استخر") || query.includes("شنا")) {
    return Waves
  }
  if (query.includes("kitchen") || query.includes("آشپزخانه") || query.includes("پخت")) {
    return Utensils
  }
  if (query.includes("tv") || query.includes("تلویزیون")) {
    return Tv
  }
  if (
    query.includes("wind") ||
    query.includes("cool") ||
    query.includes("کولر") ||
    query.includes("اسپلیت") ||
    query.includes("سرمایش")
  ) {
    return Wind
  }
  if (
    query.includes("heat") ||
    query.includes("flame") ||
    query.includes("گرمایش") ||
    query.includes("پکیج") ||
    query.includes("شوفاژ") ||
    query.includes("بخاری")
  ) {
    return Flame
  }

  return Check
}

export function AmenitiesList({
  amenities,
  customAmenities = [],
}: AmenitiesListProps) {
  const [isOpenAllModal, setIsOpenAllModal] = React.useState(false)

  const allAmenities = buildAmenityItems(amenities ?? [], customAmenities)

  if (allAmenities.length === 0) {
    return null
  }

  const displayedAmenities = allAmenities.slice(0, 8)
  const hasMore = allAmenities.length > 8

  const formatPersian = formatFaNumber

  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
        <p className="flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick">
          <span aria-hidden="true" className="h-px w-8 bg-brick/45" />
          امکانات
        </p>
        <h3 className="flex items-center gap-2 text-xl font-black tracking-tight text-ink">
          <Sparkles className="size-5 text-brick" />
          <span>امکانات اقامتگاه</span>
        </h3>
      </div>

      {/* Grid of 8 amenities */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {displayedAmenities.map((amenity) => {
          const Icon = getAmenityIcon(amenity.name, amenity.icon)
          return (
            <div
              key={amenity.key}
              className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line/70 bg-paper-card p-3 text-ink transition-colors hover:border-line-strong"
            >
              <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-brick-soft/60 text-brick-deep">
                <Icon className="size-4" />
              </div>
              <span className="min-w-0 break-words text-pretty text-xs font-medium leading-5">
                {amenity.name}
              </span>
            </div>
          )
        })}
      </div>

      {/* View All Amenities Button & Modal */}
      {hasMore && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpenAllModal(true)}
            className="mt-2 border-line bg-paper-card text-xs font-semibold text-ink shadow-none hover:bg-paper"
          >
            مشاهده تمام {formatPersian(allAmenities.length)} امکانات
          </Button>

          <Dialog open={isOpenAllModal} onOpenChange={setIsOpenAllModal}>
            <DialogContent className="flex max-h-[80vh] w-full max-w-md flex-col border-line bg-paper p-6">
              <DialogHeader className="border-b border-line pb-3">
                <DialogTitle className="text-base font-black text-ink">
                  تمام امکانات اقامتگاه ({formatPersian(allAmenities.length)})
                </DialogTitle>
                <DialogDescription className="sr-only">
                  لیست تمامی امکانات اقامتگاه
                </DialogDescription>
              </DialogHeader>

              <div className="no-scrollbar grid grid-cols-1 gap-3 overflow-y-auto py-4 sm:grid-cols-2">
                {allAmenities.map((amenity) => {
                  const Icon = getAmenityIcon(amenity.name, amenity.icon)
                  return (
                    <div
                      key={amenity.key}
                      className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line/70 bg-paper-card p-3"
                    >
                      <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-brick-soft/60 text-brick-deep">
                        <Icon className="size-4" />
                      </div>
                      <span className="min-w-0 break-words text-pretty text-xs font-medium leading-5 text-ink">
                        {amenity.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
