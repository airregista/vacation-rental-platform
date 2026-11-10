"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { Heart, Star, MapPin, Compass, Sparkles, Check, FolderPlus } from "lucide-react"
import type { WishlistFolder, WishlistItemResponse } from "@/types/wishlist"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface WishlistGridProps {
  items: WishlistItemResponse[]
  onRemove: (accommodationId: number) => Promise<void> | void
  isRemoving?: number | null
  folders: WishlistFolder[]
  onToggleFolder: (folderId: string, accommodationId: number) => void
  emptyTitle?: string
  emptyDescription?: string
}

export function WishlistGrid({
  items,
  onRemove,
  isRemoving: externalRemovingId,
  folders,
  onToggleFolder,
  emptyTitle = "هیچ اقامتگاهی در این بخش ذخیره نشده است",
  emptyDescription = "اقامتگاه‌های مورد علاقه خود را با زدن روی آیکون قلب ذخیره کنید تا برای سفرهای آینده به راحتی به آن‌ها دسترسی داشته باشید.",
}: WishlistGridProps) {
  const [internalRemovingId, setInternalRemovingId] = useState<number | null>(null)
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})

  const removingId = externalRemovingId ?? internalRemovingId

  const handleRemoveClick = async (e: React.MouseEvent, accommodationId: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (removingId === accommodationId) return

    setInternalRemovingId(accommodationId)
    try {
      await onRemove(accommodationId)
    } finally {
      setInternalRemovingId(null)
    }
  }

  const handleImageError = (id: number) => {
    setImgErrors((prev) => ({ ...prev, [id]: true }))
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-border bg-card/40 my-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
          <Heart className="w-8 h-8 text-primary/70" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">{emptyTitle}</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          {emptyDescription}
        </p>
        <Button asChild>
          <Link href="/" className="gap-2">
            <Compass className="w-4 h-4" />
            <span>مشاهده و جستجوی اقامتگاه‌ها</span>
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 my-6">
      {items.map((item) => {
        const acc = item.accommodation
        const hasImgError = imgErrors[item.accommodation_id] || !acc.cover_image

        const locationText =
          [acc.city?.province?.name, acc.city?.name].filter(Boolean).join("، ") || "ایران"

        const numericPrice = Math.round(Number(acc.base_price) || 0)
        const formattedPrice =
          new Intl.NumberFormat("fa-IR").format(numericPrice) + " تومان / شب"

        const averageRating =
          acc.average_rating !== null && acc.average_rating !== undefined
            ? Number(acc.average_rating)
            : null

        const isSuperhost =
          averageRating !== null && averageRating >= 4.8 && acc.reviews_count >= 10
        const formattedRating =
          averageRating !== null
            ? new Intl.NumberFormat("fa-IR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }).format(averageRating)
            : null

        const formattedReviewsCount = new Intl.NumberFormat("fa-IR").format(
          acc.reviews_count || 0
        )

        return (
          <Card
            key={item.accommodation_id}
            className="group overflow-hidden rounded-2xl border border-border/70 hover:shadow-lg transition-all duration-200 bg-card flex flex-col"
          >
            {/* Cover image container */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
              <Link
                href={`/accommodations/${item.accommodation_id}`}
                className="block w-full h-full"
              >
                {!hasImgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={acc.cover_image!}
                    alt={acc.title}
                    onError={() => handleImageError(item.accommodation_id)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/60">
                    <Compass className="w-8 h-8 opacity-40 mb-1" />
                    <span className="text-xs font-medium">بدون تصویر</span>
                  </div>
                )}
              </Link>

              {/* Heart toggle + add-to-folder buttons (top-left) */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleRemoveClick(e, item.accommodation_id)}
                  disabled={removingId !== null}
                  aria-label="حذف از علاقه‌مندی‌ها"
                  className="size-9 min-h-9 min-w-9 rounded-full bg-card/85 backdrop-blur-md shadow-md hover:scale-110 active:scale-90 text-primary"
                >
                  <Heart className="w-5 h-5 fill-primary text-primary transition-colors" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="افزودن به پوشه"
                      className="size-9 min-h-9 min-w-9 rounded-full bg-card/85 backdrop-blur-md shadow-md hover:scale-110 active:scale-90 text-primary"
                    >
                      <FolderPlus className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {folders
                      .filter((folder) => folder.id !== "all")
                      .map((folder) => {
                        const isInFolder = (folder.accommodation_ids || []).includes(
                          item.accommodation_id
                        )
                        return (
                          <DropdownMenuItem
                            key={folder.id}
                            onClick={() =>
                              onToggleFolder(folder.id, item.accommodation_id)
                            }
                            className="gap-2 cursor-pointer"
                          >
                            {isInFolder ? (
                              <Check className="w-4 h-4 text-primary" />
                            ) : (
                              <span className="w-4 h-4" />
                            )}
                            <span className="line-clamp-1">{folder.name}</span>
                          </DropdownMenuItem>
                        )
                      })}
                    {folders.filter((folder) => folder.id !== "all").length === 0 && (
                      <DropdownMenuItem disabled>
                        هنوز پوشه‌ای نساخته‌اید
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Badges (top-right) */}
              <div className="absolute top-3 right-3 flex flex-wrap items-center gap-1.5 pointer-events-none">
                {isSuperhost && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-amber-900 border-amber-300 text-[11px] font-bold gap-1 shadow-xs"
                  >
                    <Sparkles className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span>سوپرمیزبان</span>
                  </Badge>
                )}
              </div>
            </div>

            {/* Card Content */}
            <CardContent className="p-4 flex flex-col flex-1 justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="line-clamp-1">{locationText}</span>
                  </div>

                  {formattedRating ? (
                    <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{formattedRating}</span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        ({formattedReviewsCount})
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">جدید</span>
                  )}
                </div>

                <Link
                  href={`/accommodations/${item.accommodation_id}`}
                  className="block group-hover:text-primary transition-colors"
                >
                  <h3 className="font-bold text-sm sm:text-base text-foreground line-clamp-1">
                    {acc.title}
                  </h3>
                </Link>

                {acc.category && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {acc.category.title}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  <span>شروع از</span>
                </div>
                <div className="text-sm font-bold text-foreground font-price">
                  {formattedPrice}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
