"use client"

import * as React from "react"
import type { AccommodationListItem } from "@/types/accommodation"
import { AccommodationCard } from "@/components/explore/accommodation-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { SearchX, RotateCcw } from "lucide-react"

export interface AccommodationGridProps {
  items: AccommodationListItem[]
  isLoading: boolean
  wishlistIds: Set<number>
  pendingWishlistIds?: Set<number>
  onToggleWishlist: (id: number) => void
  onClearFilters?: () => void
}

export function AccommodationGrid({
  items,
  isLoading,
  wishlistIds,
  pendingWishlistIds,
  onToggleWishlist,
  onClearFilters,
}: AccommodationGridProps) {
  if (isLoading) {
    return (
      <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl bg-paper-deep" />
            <div className="space-y-2 px-1">
              <Skeleton className="h-5 w-3/4 rounded-md bg-paper-deep" />
              <Skeleton className="h-4 w-1/2 rounded-md bg-paper-deep" />
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-4 w-1/3 rounded-md bg-paper-deep" />
                <Skeleton className="h-4 w-1/4 rounded-md bg-paper-deep" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="اقامتگاهی با فیلترهای انتخابی شما یافت نشد"
        description="لطفاً تاریخ‌های دیگر، شهر مقصد یا شرایط فیلترها را تغییر داده و مجدداً امتحان کنید."
        action={
          onClearFilters ? (
            <Button
              type="button"
              variant="outline"
              onClick={onClearFilters}
              shape="pill"
              className="gap-2 border-line text-xs font-semibold"
            >
              <RotateCcw className="size-3.5" />
              <span>پاک کردن فیلترها</span>
            </Button>
          ) : null
        }
      />
    )
  }

  return (
    <div
      role="region"
      aria-label="لیست اقامتگاه‌ها"
      className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 2xl:grid-cols-4"
    >
      {items.map((item) => (
        <AccommodationCard
          key={item.id}
          item={item}
          isWishlisted={wishlistIds.has(item.id)}
          isWishlistLoading={pendingWishlistIds?.has(item.id)}
          onToggleWishlist={onToggleWishlist}
        />
      ))}
    </div>
  )
}
