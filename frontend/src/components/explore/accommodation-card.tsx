"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import type { AccommodationListItem } from "@/types/accommodation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Heart, Home, Star, MapPin } from "lucide-react"

export interface AccommodationCardProps {
  item: AccommodationListItem
  isWishlisted?: boolean
  isWishlistLoading?: boolean
  onToggleWishlist?: (id: number) => void
}

export function AccommodationCard({
  item,
  isWishlisted = false,
  isWishlistLoading = false,
  onToggleWishlist,
}: AccommodationCardProps) {
  const formattedPrice = React.useMemo(() => {
    return new Intl.NumberFormat("fa-IR").format(Number(item.base_price) || 0)
  }, [item.base_price])

  const formattedCapacity = React.useMemo(() => {
    return new Intl.NumberFormat("fa-IR").format(item.max_capacity || item.capacity || 1)
  }, [item.max_capacity, item.capacity])

  const ratingDisplay = React.useMemo(() => {
    if (item.average_rating && item.average_rating > 0) {
      return new Intl.NumberFormat("fa-IR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(item.average_rating)
    }
    return "جدید"
  }, [item.average_rating])

  // URL of the cover image that failed to load, if any. Kept as the URL
  // (not a boolean) so a changed cover_image automatically retries.
  const [failedImageSrc, setFailedImageSrc] = React.useState<string | null>(null)
  const imageFailed = failedImageSrc !== null && failedImageSrc === item.cover_image

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper-card transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-lift">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-paper-deep">
        <Link
          href={`/accommodations/${item.id}`}
          className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          tabIndex={-1}
          aria-hidden="true"
        >
          {item.cover_image && !imageFailed ? (
            <Image
              src={item.cover_image}
              alt={item.title}
              fill
              unoptimized
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              onError={() => setFailedImageSrc(item.cover_image)}
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-paper-deep text-ink-soft/70">
              <Home className="size-8" />
              <span className="text-xs font-medium">بدون تصویر</span>
            </div>
          )}
        </Link>

        {item.category?.title ? (
          <span className="absolute right-3 top-3 z-10 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-semibold text-ink backdrop-blur">
            {item.category.title}
          </span>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isWishlistLoading}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onToggleWishlist?.(item.id)
          }}
          aria-label={isWishlisted ? "حذف از نشان‌شده‌ها" : "نشان کردن اقامتگاه"}
          className="absolute left-3 top-3 z-10 size-8 rounded-full bg-paper/90 text-ink shadow-soft backdrop-blur transition-colors hover:bg-paper disabled:opacity-50"
        >
          <Heart
            className={cn(
              "size-4 transition-colors",
              isWishlisted ? "fill-brick text-brick" : "text-ink/70"
            )}
          />
        </Button>

        <div className="absolute bottom-3 right-3 z-10">
          <span className="flex items-center gap-1 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-bold text-ink shadow-soft backdrop-blur">
            {item.average_rating && item.average_rating > 0 ? (
              <Star className="size-3 fill-gold text-gold" />
            ) : null}
            {ratingDisplay}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link
          href={`/accommodations/${item.id}`}
          className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h3 className="truncate text-[15px] font-bold leading-6 text-ink transition-colors group-hover:text-brick">
            {item.title}
          </h3>
        </Link>

        <p className="flex items-center gap-1 text-xs text-ink-soft">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">
            {item.city?.name}
            {item.city?.province?.name ? `، ${item.city.province.name}` : ""}
          </span>
        </p>

        <p className="text-xs text-ink-soft">تا {formattedCapacity} مهمان</p>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-line/70 pt-3">
          <p className="text-xs text-ink-soft">
            <span className="text-[15px] font-black text-brick">{formattedPrice}</span> تومان / شب
          </p>
          <span className="text-[11px] text-ink-soft">
            {item.reviews_count > 0
              ? `${new Intl.NumberFormat("fa-IR").format(item.reviews_count)} نظر`
              : "اقامتگاه تازه"}
          </span>
        </div>
      </div>
    </article>
  )
}
