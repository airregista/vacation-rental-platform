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
}

export function PhotoGallery({ images, title }: PhotoGalleryProps) {
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false)
  const [activePhotoIndex, setActivePhotoIndex] = React.useState(0)
  const [isFavorite, setIsFavorite] = React.useState(false)

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
      <div className="relative aspect-[21/9] w-full overflow-hidden rounded-2xl bg-muted flex flex-col items-center justify-center text-muted-foreground border border-border">
        <ImageIcon className="h-16 w-16 mb-2 stroke-1" />
        <span className="text-sm font-medium">بدون تصویر</span>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Mobile Presentation (< lg): Carousel */}
      <div className="block lg:hidden relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted select-none">
        {/* Floating Top Controls */}
        <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
          <Link
            href="/"
            aria-label="بازگشت"
            className="pointer-events-auto h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm shadow flex items-center justify-center text-foreground hover:bg-background transition"
          >
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="نشان کردن"
            onClick={() => setIsFavorite(!isFavorite)}
            className="pointer-events-auto h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm shadow text-foreground hover:bg-background transition"
          >
            <Heart
              className={`h-5 w-5 ${
                isFavorite ? "fill-destructive text-destructive" : "text-foreground"
              }`}
            />
          </Button>
        </div>

        {/* Carousel Image Container */}
        <div
          className="relative h-full w-full cursor-pointer"
          onClick={() => {
            if (!isSwiping.current) openLightbox(activePhotoIndex)
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Image
            src={sortedImages[activePhotoIndex].image_url}
            alt={`${title} - تصویر ${activePhotoIndex + 1}`}
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
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/70 backdrop-blur-sm shadow text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="تصویر قبلی"
              onClick={handlePrevPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/70 backdrop-blur-sm shadow text-foreground"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Counter Badge */}
        <div className="absolute bottom-3 left-3 z-10">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm px-2.5 py-0.5 text-xs">
            {formatPersian(activePhotoIndex + 1)} از {formatPersian(totalImages)}
          </Badge>
        </div>
      </div>

      {/* Desktop Presentation (>= lg): Adaptive Collages */}
      <div className="hidden lg:block relative w-full">
        {/* 1 Image: Full-width Hero */}
        {totalImages === 1 && (
          <div
            className="relative aspect-[21/9] w-full overflow-hidden rounded-2xl bg-muted cursor-pointer group"
            onClick={() => openLightbox(0)}
          >
            <Image
              src={sortedImages[0].image_url}
              alt={title}
              fill
              unoptimized
              priority
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        {/* 2 to 4 Images: Adaptive Grid */}
        {totalImages >= 2 && totalImages <= 4 && (
          <div
            className={`grid gap-2 h-[420px] rounded-2xl overflow-hidden ${
              totalImages === 2 ? "grid-cols-2" : "grid-cols-3"
            }`}
          >
            {/* Featured Image */}
            <div
              className={`relative h-full bg-muted cursor-pointer group overflow-hidden ${
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
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            {/* Secondary Images */}
            <div
              className={`grid gap-2 h-full ${
                totalImages === 4 ? "grid-rows-3" : totalImages === 3 ? "grid-rows-2" : "grid-rows-1"
              }`}
            >
              {sortedImages.slice(1, totalImages).map((img, idx) => (
                <div
                  key={img.id}
                  className="relative h-full bg-muted cursor-pointer group overflow-hidden"
                  onClick={() => openLightbox(idx + 1)}
                >
                  <Image
                    src={img.image_url}
                    alt={`${title} - تصویر ${idx + 2}`}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5+ Images: Standard RTL 5-Photo Collage */}
        {totalImages >= 5 && (
          <div className="relative grid grid-cols-4 grid-rows-2 gap-2 h-[420px] rounded-2xl overflow-hidden">
            {/* Featured Right Photo (spans 2 cols, 2 rows in RTL) */}
            <div
              className="relative col-span-2 row-span-2 bg-muted cursor-pointer group overflow-hidden"
              onClick={() => openLightbox(0)}
            >
              <Image
                src={sortedImages[0].image_url}
                alt={`${title} - تصویر ۱`}
                fill
                unoptimized
                priority
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            {/* 4 Thumbnails on Left in 2x2 layout */}
            {sortedImages.slice(1, 5).map((img, idx) => (
              <div
                key={img.id}
                className="relative col-span-1 row-span-1 bg-muted cursor-pointer group overflow-hidden"
                onClick={() => openLightbox(idx + 1)}
              >
                <Image
                  src={img.image_url}
                  alt={`${title} - تصویر ${idx + 2}`}
                  fill
                  unoptimized
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}

            {/* Floating All Photos Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openLightbox(0)}
              className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm hover:bg-background shadow-md flex items-center gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              <span>مشاهده تمام تصاویر ({formatPersian(totalImages)})</span>
            </Button>
          </div>
        )}
      </div>

      {/* Full-Screen Lightbox Modal */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-4 sm:p-6 bg-background">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border">
            <DialogTitle className="text-base font-medium truncate max-w-[70%]">
              {title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              مشاهده تصاویر اقامتگاه در اندازه بزرگ
            </DialogDescription>
            <Badge variant="outline" className="text-xs">
              {formatPersian(activePhotoIndex + 1)} / {formatPersian(totalImages)}
            </Badge>
          </DialogHeader>

          {/* Main Photo Viewer */}
          <div className="relative flex-1 w-full my-4 bg-black/5 rounded-xl overflow-hidden flex items-center justify-center select-none">
            <div className="relative h-full w-full">
              <Image
                src={sortedImages[activePhotoIndex].image_url}
                alt={`${title} - تصویر ${activePhotoIndex + 1}`}
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
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background shadow-md z-10"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="تصویر قبلی"
                  onClick={handlePrevPhoto}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background shadow-md z-10"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {totalImages > 1 && (
            <div className="flex gap-2 overflow-x-auto py-2 px-1 max-h-24 scrollbar-thin">
              {sortedImages.map((img, idx) => (
                <button
                  type="button"
                  key={img.id}
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`relative flex-shrink-0 w-20 h-16 rounded-md overflow-hidden border-2 transition ${
                    activePhotoIndex === idx
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent opacity-60 hover:opacity-100"
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
