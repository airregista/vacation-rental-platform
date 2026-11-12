"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  ArrowRight,
  Heart,
  ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AccommodationImage } from "@/types/detail"

export interface PhotoGalleryProps {
  images: AccommodationImage[]
  title: string
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

export function PhotoGallery({
  images,
  title,
  isFavorite,
  onToggleFavorite,
}: PhotoGalleryProps) {
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false)
  const [activePhotoIndex, setActivePhotoIndex] = React.useState(0)
  const [internalFavorite, setInternalFavorite] = React.useState(false)

  const favorite = isFavorite !== undefined ? isFavorite : internalFavorite
  const handleToggleFavorite = () => {
    if (onToggleFavorite) {
      onToggleFavorite()
    } else {
      setInternalFavorite(!internalFavorite)
    }
  }

  // Mobile touch swipe tracking
  const [touchStartX, setTouchStartX] = React.useState<number | null>(null)
  const isSwiping = React.useRef(false)

  const sortedImages = React.useMemo(() => {
    if (!images || images.length === 0) return []
    return [...images].sort((a, b) => {
      if (a.is_cover && !b.is_cover) return -1
      if (!a.is_cover && b.is_cover) return 1
      return a.sort_order - b.sort_order
    })
  }, [images])

  const totalImages = sortedImages.length

  // Clamp: the image list can shrink (e.g. navigating to a listing with
  // fewer photos) while this index persists, so never index out of range.
  const safeActivePhotoIndex =
    totalImages > 0 ? Math.min(activePhotoIndex, totalImages - 1) : 0

  const openLightbox = (index: number) => {
    setActivePhotoIndex(index)
    setIsLightboxOpen(true)
  }

  const handleNextPhoto = React.useCallback(() => {
    if (totalImages === 0) return
    setActivePhotoIndex((prev) => (prev + 1) % totalImages)
  }, [totalImages])

  const handlePrevPhoto = React.useCallback(() => {
    if (totalImages === 0) return
    setActivePhotoIndex((prev) => (prev - 1 + totalImages) % totalImages)
  }, [totalImages])

  // Keyboard navigation for Lightbox
  React.useEffect(() => {
    if (!isLightboxOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handleNextPhoto()
      } else if (e.key === "ArrowRight") {
        handlePrevPhoto()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isLightboxOpen, handleNextPhoto, handlePrevPhoto])

  // Mobile swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    isSwiping.current = false
    setTouchStartX(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX !== null && Math.abs(e.touches[0].clientX - touchStartX) > 10) {
      isSwiping.current = true
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchStartX - touchEndX
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swiped left in RTL -> next photo
        handleNextPhoto()
      } else {
        // Swiped right in RTL -> prev photo
        handlePrevPhoto()
      }
    }
    setTouchStartX(null)
  }

  const formatPersian = (n: number) => new Intl.NumberFormat("fa-IR").format(n)

  // 0 Images Fallback
  if (totalImages === 0) {
    return (
      <div className="relative flex aspect-[21/9] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-line bg-paper-deep/50 text-ink-soft">
        <ImageIcon className="mb-2 size-16 stroke-1 text-line-strong" />
        <span className="text-sm font-medium">بدون تصویر</span>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Mobile Presentation (< lg): Carousel */}
      <div className="relative block aspect-[4/3] w-full select-none overflow-hidden rounded-t-[2rem] rounded-b-2xl border border-line bg-paper-deep lg:hidden">
        {/* Floating Top Controls */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-center justify-between">
          <Link
            href="/"
            aria-label="بازگشت"
            className="pointer-events-auto flex size-9 items-center justify-center rounded-full bg-paper/85 text-ink shadow-soft backdrop-blur-sm transition-colors hover:bg-paper"
          >
            <ArrowRight className="size-5" />
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="نشان کردن"
            onClick={handleToggleFavorite}
            className="pointer-events-auto size-9 rounded-full bg-paper/85 text-ink shadow-soft backdrop-blur-sm transition-colors hover:bg-paper"
          >
            <Heart
              className={`size-5 ${
                favorite ? "fill-brick text-brick" : "text-ink"
              }`}
            />
          </Button>
        </div>

        {/* Carousel Image Container */}
        <div
          className="relative h-full w-full cursor-pointer"
          onClick={() => {
            if (!isSwiping.current) openLightbox(safeActivePhotoIndex)
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Image
            src={sortedImages[safeActivePhotoIndex].image_url}
            alt={`${title} - تصویر ${safeActivePhotoIndex + 1}`}
            fill
            unoptimized
            priority
            className="object-cover"
          />
        </div>

        {/* Prev / Next buttons for mobile accessibility */}
        {totalImages > 1 && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="تصویر بعدی"
              onClick={handleNextPhoto}
              className="absolute left-2 top-1/2 size-8 -translate-y-1/2 rounded-full bg-paper/80 text-ink shadow-soft backdrop-blur-sm hover:bg-paper"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="تصویر قبلی"
              onClick={handlePrevPhoto}
              className="absolute right-2 top-1/2 size-8 -translate-y-1/2 rounded-full bg-paper/80 text-ink shadow-soft backdrop-blur-sm hover:bg-paper"
            >
              <ChevronRight className="size-5" />
            </Button>
          </>
        )}

        {/* Counter Badge */}
        <div className="absolute bottom-3 left-3 z-10">
          <Badge
            variant="outline"
            className="border-line-strong/60 bg-paper/90 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-ink backdrop-blur-sm"
          >
            {formatPersian(safeActivePhotoIndex + 1)} از {formatPersian(totalImages)}
          </Badge>
        </div>
      </div>

      {/* Desktop Presentation (>= lg): Adaptive Collages */}
      <div className="relative hidden w-full lg:block">
        {/* 1 Image: Full-width Hero */}
        {totalImages === 1 && (
          <div
            className="group relative aspect-[21/9] w-full cursor-pointer overflow-hidden rounded-3xl border border-line bg-paper-deep"
            onClick={() => openLightbox(0)}
          >
            <Image
              src={sortedImages[0].image_url}
              alt={title}
              fill
              unoptimized
              priority
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </div>
        )}

        {/* 2 to 4 Images: Adaptive Grid */}
        {totalImages >= 2 && totalImages <= 4 && (
          <div
            className={`grid h-[420px] gap-2 overflow-hidden rounded-3xl border border-line ${
              totalImages === 2 ? "grid-cols-2" : "grid-cols-3"
            }`}
          >
            {/* Featured Image */}
            <div
              className={`group relative h-full cursor-pointer overflow-hidden bg-paper-deep ${
                totalImages >= 3 ? "col-span-2" : "col-span-1"
              }`}
              onClick={() => openLightbox(0)}
            >
              <Image
                src={sortedImages[0].image_url}
                alt={`${title} - تصویر ۱`}
                fill
                unoptimized
                priority
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
            {/* Secondary Images */}
            <div
              className={`grid h-full gap-2 ${
                totalImages === 4 ? "grid-rows-3" : totalImages === 3 ? "grid-rows-2" : "grid-rows-1"
              }`}
            >
              {sortedImages.slice(1, totalImages).map((img, idx) => (
                <div
                  key={img.id}
                  className="group relative h-full cursor-pointer overflow-hidden bg-paper-deep"
                  onClick={() => openLightbox(idx + 1)}
                >
                  <Image
                    src={img.image_url}
                    alt={`${title} - تصویر ${idx + 2}`}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5+ Images: Standard RTL 5-Photo Collage */}
        {totalImages >= 5 && (
          <div className="relative grid h-[420px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-3xl border border-line">
            {/* Featured Right Photo (spans 2 cols, 2 rows in RTL) */}
            <div
              className="group relative col-span-2 row-span-2 cursor-pointer overflow-hidden bg-paper-deep"
              onClick={() => openLightbox(0)}
            >
              <Image
                src={sortedImages[0].image_url}
                alt={`${title} - تصویر ۱`}
                fill
                unoptimized
                priority
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>

            {/* 4 Thumbnails on Left in 2x2 layout */}
            {sortedImages.slice(1, 5).map((img, idx) => (
              <div
                key={img.id}
                className="group relative col-span-1 row-span-1 cursor-pointer overflow-hidden bg-paper-deep"
                onClick={() => openLightbox(idx + 1)}
              >
                <Image
                  src={img.image_url}
                  alt={`${title} - تصویر ${idx + 2}`}
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
            ))}

            {/* Floating All Photos Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openLightbox(0)}
              className="absolute bottom-4 left-4 flex items-center gap-2 border-line bg-paper/90 text-ink shadow-soft backdrop-blur-sm hover:bg-paper"
            >
              <LayoutGrid className="size-4" />
              <span>مشاهده تمام تصاویر ({formatPersian(totalImages)})</span>
            </Button>
          </div>
        )}
      </div>

      {/* Full-Screen Lightbox Modal */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="flex h-[90vh] w-full max-w-5xl flex-col border-line bg-paper p-4 sm:p-6">
          <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-line pb-3">
            <DialogTitle className="max-w-[70%] truncate text-base font-bold text-ink">
              {title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              مشاهده تصاویر اقامتگاه در اندازه بزرگ
            </DialogDescription>
            <Badge
              variant="outline"
              className="border-line bg-paper-card px-2.5 py-1 text-[11px] tabular-nums text-ink-soft"
            >
              {formatPersian(safeActivePhotoIndex + 1)} / {formatPersian(totalImages)}
            </Badge>
          </DialogHeader>

          {/* Main Photo Viewer */}
          <div className="relative my-4 flex w-full flex-1 select-none items-center justify-center overflow-hidden rounded-2xl bg-night">
            <div className="relative h-full w-full">
              <Image
                src={sortedImages[safeActivePhotoIndex].image_url}
                alt={`${title} - تصویر ${safeActivePhotoIndex + 1}`}
                fill
                unoptimized
                className="object-contain"
              />
            </div>

            {/* Navigation Chevrons */}
            {totalImages > 1 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="تصویر بعدی"
                  onClick={handleNextPhoto}
                  className="absolute left-4 top-1/2 z-10 size-10 -translate-y-1/2 rounded-full border-line bg-paper/90 text-ink shadow-soft hover:bg-paper"
                >
                  <ChevronLeft className="size-6" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="تصویر قبلی"
                  onClick={handlePrevPhoto}
                  className="absolute right-4 top-1/2 z-10 size-10 -translate-y-1/2 rounded-full border-line bg-paper/90 text-ink shadow-soft hover:bg-paper"
                >
                  <ChevronRight className="size-6" />
                </Button>
              </>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {totalImages > 1 && (
            <div className="no-scrollbar flex max-h-24 gap-2 overflow-x-auto px-1 py-2">
              {sortedImages.map((img, idx) => (
                <button
                  type="button"
                  key={img.id}
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    safeActivePhotoIndex === idx
                      ? "border-brick ring-2 ring-brick/25"
                      : "border-transparent opacity-55 hover:opacity-100"
                  }`}
                >
                  <Image
                    src={img.image_url}
                    alt={`${title} - پیش‌نمایش ${idx + 1}`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
