"use client"

import * as React from "react"
import Link from "next/link"
import {
  MapPin,
  Star,
  Share2,
  Heart,
  DoorClosed,
  Bed,
  Users,
  ChevronLeft,
  AlertCircle,
  Check,
} from "lucide-react"
import { apiClient, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PhotoGallery } from "@/components/accommodation/photo-gallery"
import { HostCard } from "@/components/accommodation/host-card"
import { AmenitiesList } from "@/components/accommodation/amenities-list"
import { AvailabilityCalendar } from "@/components/accommodation/availability-calendar"
import { ReviewsSection } from "@/components/accommodation/reviews-section"
import { BookingWidget } from "@/components/accommodation/booking-widget"
import type { AccommodationDetailData } from "@/types/detail"

interface AccommodationPageProps {
  params: Promise<{ id: string }>
}

export default function AccommodationDetailPage({ params }: AccommodationPageProps) {
  const resolvedParams = React.use(params)
  const accommodationId = Number(resolvedParams.id)

  const isInvalidId = !accommodationId || isNaN(accommodationId) || accommodationId <= 0

  const [data, setData] = React.useState<AccommodationDetailData | null>(null)
  const [isLoading, setIsLoading] = React.useState<boolean>(!isInvalidId)
  const [errorStatus, setErrorStatus] = React.useState<number | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Shared booking date range state
  const [checkIn, setCheckIn] = React.useState<string | null>(null)
  const [checkOut, setCheckOut] = React.useState<string | null>(null)

  // Social actions
  const [isCopied, setIsCopied] = React.useState(false)
  const [isWishlisted, setIsWishlisted] = React.useState(false)

  React.useEffect(() => {
    if (isInvalidId) return

    let isCurrent = true
    const fetchData = async () => {
      try {
        const res = await apiClient.get<AccommodationDetailData>(
          `/accommodations/${accommodationId}`
        )
        if (isCurrent) {
          setData(res)
          setIsLoading(false)
        }
      } catch (err: unknown) {
        if (!isCurrent) return
        if (err instanceof ApiError) {
          setErrorStatus(err.status)
          setErrorMessage(err.message)
        } else {
          setErrorStatus(500)
          setErrorMessage("خطا در بارگذاری اطلاعات اقامتگاه.")
        }
        setIsLoading(false)
      }
    }

    fetchData()

    return () => {
      isCurrent = false
    }
  }, [accommodationId, isInvalidId])

  const handleDateRangeChange = (inDate: string | null, outDate: string | null) => {
    setCheckIn(inDate)
    setCheckOut(outDate)
  }

  const handleShare = async () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(window.location.href)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2500)
      } catch {
        // clipboard permission denied
      }
    }
  }

  const formatPersian = (n: number) => new Intl.NumberFormat("fa-IR").format(n)

  // 1. Defensive ID Guard & 404 / Error State
  if (isInvalidId || errorStatus === 404) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 p-8 border border-border rounded-2xl bg-card">
          <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-foreground">اقامتگاه مورد نظر یافت نشد</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            این اقامتگاه ممکن است حذف شده باشد یا شناسه وارد شده صحیح نمی‌باشد.
          </p>
          <Button asChild className="w-full">
            <Link href="/">بازگشت به صفحه جستجو</Link>
          </Button>
        </div>
      </main>
    )
  }

  // 2. Network / Server Error
  if (errorStatus && errorStatus !== 404) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-bold">خطا در بارگذاری</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {errorMessage || "ارتباط با سرور برقرار نشد. لطفاً اینترنت خود را بررسی کنید."}
            </AlertDescription>
          </Alert>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">بازگشت به صفحه اصلی</Link>
          </Button>
        </div>
      </main>
    )
  }

  // 3. Loading Skeletons
  if (isLoading || !data) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Breadcrumb Skeleton */}
        <div className="flex gap-2 items-center">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Title & Action Skeletons */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-3/4 max-w-md" />
            <Skeleton className="h-4 w-1/2 max-w-sm" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>

        {/* Photo Gallery Skeleton */}
        <Skeleton className="h-[380px] w-full rounded-2xl" />

        {/* Content & Sidebar Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
          <div className="lg:col-span-7 space-y-6">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-5 hidden lg:block">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-12 space-y-6">
      {/* Breadcrumb Navigation */}
      <nav aria-label="مسیریابی" className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto">
        <Link href="/" className="hover:text-foreground transition flex-shrink-0">
          صفحه اصلی
        </Link>
        {data.city?.province && (
          <>
            <ChevronLeft className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
            <span className="flex-shrink-0">{data.city.province.name}</span>
          </>
        )}
        {data.city && (
          <>
            <ChevronLeft className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
            <span className="flex-shrink-0">{data.city.name}</span>
          </>
        )}
        <ChevronLeft className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
        <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-xs">
          {data.title}
        </span>
      </nav>

      {/* Title & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight">
            {data.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {data.average_rating ? (
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span>
                  {new Intl.NumberFormat("fa-IR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }).format(data.average_rating)}
                </span>
                <span className="text-muted-foreground font-normal">
                  ({formatPersian(data.reviews_count)} نظر)
                </span>
              </div>
            ) : null}

            {data.category && (
              <Badge variant="outline" className="text-[11px] font-normal">
                {data.category.title}
              </Badge>
            )}

            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span>{data.address}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Share & Favorite */}
        <div className="flex items-center gap-2 self-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="text-xs h-9 gap-1.5"
          >
            {isCopied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-600 font-medium">کپی شد</span>
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                <span>اشتراک‌گذاری</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsWishlisted(!isWishlisted)}
            className="text-xs h-9 gap-1.5"
          >
            <Heart
              className={`h-4 w-4 ${
                isWishlisted ? "fill-destructive text-destructive" : "text-muted-foreground"
              }`}
            />
            <span>{isWishlisted ? "نشان شده" : "نشان کردن"}</span>
          </Button>
        </div>
      </div>

      {/* Photo Gallery Mosaic */}
      <PhotoGallery images={data.images} title={data.title} />

      {/* Two-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
        {/* Right Main Column (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-8">
          {/* Host Card */}
          <HostCard
            host={data.host}
            checkInTime={data.check_in_time}
            checkOutTime={data.check_out_time}
            cancellationPolicy={data.cancellation_policy}
            rules={data.rules}
          />

          {/* Accommodation Specs */}
          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-card border border-border text-center">
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-muted/30">
              <DoorClosed className="h-5 w-5 text-primary mb-1" />
              <span className="text-xs font-bold text-foreground">
                {formatPersian(data.rooms_count)} اتاق خواب
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-muted/30">
              <Bed className="h-5 w-5 text-primary mb-1" />
              <span className="text-xs font-bold text-foreground">
                {formatPersian(data.beds_count)} تخت خواب
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-muted/30">
              <Users className="h-5 w-5 text-primary mb-1" />
              <span className="text-xs font-bold text-foreground">
                تا {formatPersian(data.max_capacity)} مهمان
              </span>
              <span className="text-[10px] text-muted-foreground">
                (پایه {formatPersian(data.capacity)} نفر)
              </span>
            </div>
          </div>

          {/* Description */}
          {data.description && (
            <div className="space-y-3 p-5 rounded-2xl bg-card border border-border">
              <h3 className="text-base font-bold text-foreground">درباره این اقامتگاه</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {data.description}
              </p>
            </div>
          )}

          {/* Amenities List */}
          <AmenitiesList amenities={data.amenities} />

          {/* Availability Calendar */}
          <AvailabilityCalendar
            accommodationId={data.id}
            minNights={data.min_nights}
            basePrice={data.base_price}
            checkIn={checkIn}
            checkOut={checkOut}
            onDateRangeChange={handleDateRangeChange}
          />

          {/* Reviews Section */}
          <ReviewsSection
            accommodationId={data.id}
            averageRating={data.average_rating}
            reviewsCount={data.reviews_count}
          />
        </div>

        {/* Left Sticky Sidebar for Desktop (lg:col-span-5) */}
        <div className="lg:col-span-5">
          <BookingWidget
            accommodation={data}
            checkIn={checkIn}
            checkOut={checkOut}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>
      </div>
    </main>
  )
}
