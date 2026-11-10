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

export function AmenitiesList({ amenities }: AmenitiesListProps) {
  const [isOpenAllModal, setIsOpenAllModal] = React.useState(false)

  if (!amenities || amenities.length === 0) {
    return null
  }

  const displayedAmenities = amenities.slice(0, 8)
  const hasMore = amenities.length > 8

  const formatPersian = (n: number) => new Intl.NumberFormat("fa-IR").format(n)

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          <span>امکانات اقامتگاه</span>
        </h3>
      </div>

      {/* Grid of 8 amenities */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {displayedAmenities.map((amenity) => {
          const Icon = getAmenityIcon(amenity.name, amenity.icon)
          return (
            <div
              key={amenity.id}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-card border border-border text-foreground transition-colors"
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium truncate">{amenity.name}</span>
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
            className="text-xs mt-2"
          >
            مشاهده تمام {formatPersian(amenities.length)} امکانات
          </Button>

          <Dialog open={isOpenAllModal} onOpenChange={setIsOpenAllModal}>
            <DialogContent className="max-w-md w-full max-h-[80vh] flex flex-col p-6">
              <DialogHeader className="pb-3 border-b border-border">
                <DialogTitle className="text-base font-bold">
                  تمام امکانات اقامتگاه ({formatPersian(amenities.length)})
                </DialogTitle>
                <DialogDescription className="sr-only">
                  لیست تمامی امکانات اقامتگاه
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto py-4 scrollbar-thin">
                {amenities.map((amenity) => {
                  const Icon = getAmenityIcon(amenity.name, amenity.icon)
                  return (
                    <div
                      key={amenity.id}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/70"
                    >
                      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium">{amenity.name}</span>
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
