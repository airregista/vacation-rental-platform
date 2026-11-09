"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import type { AccommodationListItem } from "@/types/accommodation"
import { Badge } from "@/components/ui/badge"
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
      return item.average_rating.toFixed(1)
    }
    return "جدید"
  }, [item.average_rating])

  return (
    <div className="group flex flex-col rounded-2xl bg-card transition-all duration-200">
      {/* 4:3 Aspect Ratio Photo Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted shadow-xs">
        <Link
          href={`/accommodations/${item.id}`}
          className="block w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
          tabIndex={0}
        >
          {item.cover_image ? (
            <Image
              src={item.cover_image}
              alt={item.title}
              fill
              unoptimized
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/60 bg-muted/40 gap-1.5">
              <Home className="size-8" />
              <span className="text-xs font-medium">بدون تصویر</span>
            </div>
          )}
        </Link>

        {/* Floating Wishlist Heart Button (Top-Left in RTL) */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isWishlistLoading}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleWishlist?.(item.id)
          }}
          aria-label={isWishlisted ? "حذف از نشان‌شده‌ها" : "نشان کردن اقامتگاه"}
          className="absolute top-2.5 left-2.5 size-8 rounded-full bg-background/80 backdrop-blur-sm shadow-xs hover:bg-background transition-colors text-foreground z-10 disabled:opacity-50"
        >
          <Heart
            className={cn(
              "size-4 transition-colors",
              isWishlisted ? "text-primary fill-primary" : "text-foreground/70"
            )}
          />
        </Button>

        {/* Floating Rating Badge (Bottom-Right in RTL) */}
        <div className="absolute bottom-2.5 right-2.5 z-10">
          <Badge
            variant="secondary"
            className="gap-1 bg-background/90 backdrop-blur-sm text-foreground text-xs font-bold shadow-xs px-2 py-0.5"
          >
            {item.average_rating && item.average_rating > 0 && (
              <Star className="size-3 fill-amber-400 text-amber-400" />
            )}
            <span>{ratingDisplay}</span>
          </Badge>
        </div>
      </div>

      {/* Card Info Content */}
      <div className="pt-3 pb-1 px-1 flex flex-col gap-1 text-right">
        <Link
          href={`/accommodations/${item.id}`}
          className="hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm truncate"
        >
          <h3 className="font-bold text-sm sm:text-base text-foreground truncate">
            {item.title}
          </h3>
        </Link>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 text-muted-foreground/70 shrink-0" />
          <span className="truncate">
            {item.city?.name}
            {item.city?.province?.name ? `، ${item.city.province.name}` : ""}
          </span>
          {item.category?.title && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className="truncate">{item.category.title}</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-1.5 mt-0.5 border-t border-border/30">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-extrabold text-primary">
              {formattedPrice}
            </span>
            <span className="text-[11px] text-muted-foreground">تومان / شب</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            تا {formattedCapacity} نفر
          </span>
        </div>
      </div>
    </div>
  )
}
