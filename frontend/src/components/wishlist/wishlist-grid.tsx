"use client"

import * as React from "react"
import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Heart, Star, MapPin, Compass, Sparkles, Check, FolderPlus } from "lucide-react"
import type { WishlistFolder, WishlistItemResponse } from "@/types/wishlist"
import { EmptyState } from "@/components/shared/empty-state"
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
      <div className="my-6 rounded-3xl border border-dashed border-line/80 bg-paper-card/60 px-4">
        <EmptyState
          icon={Heart}
          title={emptyTitle}
          description={emptyDescription}
          showBrandMark
          action={
            <Button asChild className="gap-2">
              <Link href="/">
                <Compass className="size-4" />
                <span>مشاهده و جستجوی اقامتگاه‌ها</span>
              </Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="my-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const acc = item.accommodation
        const hasImgError = imgErrors[item.accommodation_id] || !acc.cover_image

        const locationText =
          [acc.city?.province?.name, acc.city?.name].filter(Boolean).join("، ") || "ایران"

        const numericPrice = Math.round(Number(acc.base_price) || 0)
        const formattedPrice = new Intl.NumberFormat("fa-IR").format(numericPrice) + " تومان / شب"

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

        const formattedReviewsCount = new Intl.NumberFormat("fa-IR").format(acc.reviews_count || 0)

        return (
          <Card
            key={item.accommodation_id}
            className="group flex flex-col overflow-hidden rounded-2xl border-line/80 bg-paper-card transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-lift"
          >
            {/* Cover image container */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-paper-deep">
              <Link href={`/accommodations/${item.accommodation_id}`} className="block size-full">
                {!hasImgError ? (
                  acc.cover_image!.startsWith("/") ? (
                    <Image
                      src={acc.cover_image!}
                      alt={acc.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      onError={() => handleImageError(item.accommodation_id)}
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    // Hosts can paste arbitrary external image URLs; next/image
                    // would reject those without a per-domain allowlist.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={acc.cover_image!}
                      alt={acc.title}
                      onError={() => handleImageError(item.accommodation_id)}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )
                ) : (
                  <div className="flex size-full flex-col items-center justify-center bg-paper-deep text-ink-soft">
                    <Compass className="mb-1 size-8 opacity-40" />
                    <span className="text-xs font-medium">بدون تصویر</span>
                  </div>
                )}
              </Link>

              {/* Heart toggle + add-to-folder buttons (top-left) */}
              <div className="absolute left-3 top-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleRemoveClick(e, item.accommodation_id)}
                  disabled={removingId !== null}
                  aria-label="حذف از علاقه‌مندی‌ها"
                  className="size-9 min-h-9 min-w-9 rounded-full bg-paper/90 text-brick shadow-soft backdrop-blur-md hover:scale-110 hover:bg-paper active:scale-90"
                >
                  <Heart className="size-5 fill-brick text-brick transition-colors" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={removingId !== null}
                      aria-label="افزودن به پوشه"
                      className="size-9 min-h-9 min-w-9 rounded-full bg-paper/90 text-brick shadow-soft backdrop-blur-md hover:scale-110 hover:bg-paper active:scale-90"
                    >
                      <FolderPlus className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 border-line bg-popover">
                    {folders
                      .filter((folder) => folder.id !== "all")
                      .map((folder) => {
                        const isInFolder = (folder.accommodation_ids || []).includes(
                          item.accommodation_id,
                        )
                        return (
                          <DropdownMenuItem
                            key={folder.id}
                            onClick={() => onToggleFolder(folder.id, item.accommodation_id)}
                            className="cursor-pointer gap-2"
                          >
                            {isInFolder ? (
                              <Check className="size-4 text-brick" />
                            ) : (
                              <span className="size-4" />
                            )}
                            <span className="line-clamp-1">{folder.name}</span>
                          </DropdownMenuItem>
                        )
                      })}
                    {folders.filter((folder) => folder.id !== "all").length === 0 && (
                      <DropdownMenuItem disabled>هنوز پوشه‌ای نساخته‌اید</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Badges (top-right) */}
              <div className="pointer-events-none absolute right-3 top-3 flex flex-wrap items-center gap-1.5">
                {isSuperhost && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-transparent bg-gold text-[11px] font-bold text-secondary-foreground shadow-soft"
                  >
                    <Sparkles className="size-3 fill-secondary-foreground/80" />
                    <span>سوپرمیزبان</span>
                  </Badge>
                )}
              </div>
            </div>

            {/* Card Content */}
            <CardContent className="flex flex-1 flex-col justify-between gap-3 p-4">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] text-ink-soft">
                    <MapPin className="size-3.5 flex-shrink-0 text-brick/70" />
                    <span className="line-clamp-1">{locationText}</span>
                  </div>

                  {formattedRating ? (
                    <div className="flex items-center gap-1 text-xs font-bold tabular-nums text-ink">
                      <Star className="size-3.5 fill-gold text-gold" />
                      <span>{formattedRating}</span>
                      <span className="text-[11px] font-normal text-ink-soft">
                        ({formattedReviewsCount})
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-ink-soft">جدید</span>
                  )}
                </div>

                <Link
                  href={`/accommodations/${item.accommodation_id}`}
                  className="block transition-colors group-hover:text-brick"
                >
                  <h3 className="line-clamp-1 text-sm font-black text-ink sm:text-base">
                    {acc.title}
                  </h3>
                </Link>

                {acc.category && (
                  <p className="mt-1 text-[11px] text-ink-soft">{acc.category.title}</p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-line/70 pt-2">
                <div className="text-[11px] text-ink-soft">
                  <span>شروع از</span>
                </div>
                <div className="text-sm font-black tabular-nums text-brick">{formattedPrice}</div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
