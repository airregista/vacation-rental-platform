"use client"

import * as React from "react"
import type { AccommodationListItem } from "@/types/accommodation"
import { AccommodationCard } from "@/components/explore/accommodation-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { SearchX, RotateCcw } from "lucide-react"

export interface AccommodationGridProps {
  items: AccommodationListItem[]
  isLoading: boolean
  wishlistIds: Set<number>
  onToggleWishlist: (id: number) => void
  onClearFilters?: () => void
}

export function AccommodationGrid({
  items,
  isLoading,
  wishlistIds,
  onToggleWishlist,
  onClearFilters,
}: AccommodationGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 sm:gap-6 px-4 sm:px-6 lg:px-8 max-w-[1360px] mx-auto w-full py-6">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="flex flex-col space-y-3">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <div className="space-y-2 px-1">
              <Skeleton className="h-5 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
              <div className="pt-2 flex items-center justify-between">
                <Skeleton className="h-4 w-1/3 rounded-md" />
                <Skeleton className="h-4 w-1/4 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto space-y-4">
        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
          <SearchX className="size-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">
            اقامتگاهی با فیلترهای انتخابی شما یافت نشد
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            لطفاً تاریخ‌های دیگر، شهر مقصد یا شرایط فیلترها را تغییر داده و مجدداً امتحان کنید.
          </p>
        </div>
        {onClearFilters && (
          <Button
            type="button"
            variant="outline"
            onClick={onClearFilters}
            className="rounded-full gap-2 text-xs font-semibold mt-2"
          >
            <RotateCcw className="size-3.5" />
            <span>پاک کردن فیلترها</span>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div
      role="region"
      aria-label="لیست اقامتگاه‌ها"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 sm:gap-6 px-4 sm:px-6 lg:px-8 max-w-[1360px] mx-auto w-full py-6"
    >
      {items.map((item) => (
        <AccommodationCard
          key={item.id}
          item={item}
          isWishlisted={wishlistIds.has(item.id)}
          onToggleWishlist={onToggleWishlist}
        />
      ))}
    </div>
  )
}
