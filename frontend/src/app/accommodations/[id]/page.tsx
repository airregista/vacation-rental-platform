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
import { formatFaNumber } from "@/lib/format-fa"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PhotoGallery } from "@/components/accommodation/photo-gallery"
import { HostCard } from "@/components/accommodation/host-card"
import { AmenitiesList } from "@/components/accommodation/amenities-list"
import { AvailabilityCalendar } from "@/components/accommodation/availability-calendar"
import { ReviewsSection } from "@/components/accommodation/reviews-section"
import { BookingWidget } from "@/components/accommodation/booking-widget"
import type { AccommodationDetailData } from "@/types/detail"
import type { WishlistItemResponse, WishlistToggleResponse } from "@/types/wishlist"

interface AccommodationPageProps {
  params: Promise<{ id: string }>
}

export default function AccommodationDetailPage({ params }: AccommodationPageProps) {
  const resolvedParams = React.use(params)
  const accommodationId = Number(resolvedParams.id)
  const { token, openOtpModal } = useAuth()

  const isInvalidId =
    !accommodationId ||
    isNaN(accommodationId) ||
    !Number.isInteger(accommodationId) ||
    accommodationId <= 0

  const [data, setData] = React.useState<AccommodationDetailData | null>(null)
  const [isLoading, setIsLoading] = React.useState<boolean>(!isInvalidId)
  const [errorStatus, setErrorStatus] = React.useState<number | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Shared booking date range state
  const [checkIn, setCheckIn] = React.useState<string | null>(null)
  const [checkOut, setCheckOut] = React.useState<string | null>(null)

  // Social actions
  const [isCopied, setIsCopied] = React.useState(false)
  const [shareError, setShareError] = React.useState<string | null>(null)
  const [isWishlisted, setIsWishlisted] = React.useState(false)

  // Reset page-level booking state when the [id] param changes client-side
  // (key={accommodationId} below remounts the children; this resets the
  // state owned by this page itself so dates/wishlist never carry over).
  // Adjusting state during render is the documented pattern for "reset
  // state when a prop changes" — an effect would cascade re-renders.
  const [prevAccommodationId, setPrevAccommodationId] = React.useState(accommodationId)
  if (prevAccommodationId !== accommodationId) {
    setPrevAccommodationId(accommodationId)
    setCheckIn(null)
    setCheckOut(null)
    setIsWishlisted(false)
    setIsCopied(false)
    setData(null)
    setErrorStatus(null)
    setErrorMessage(null)
    setIsLoading(!isInvalidId)
  }

  React.useEffect(() => {
    if (isInvalidId) return

    let isCurrent = true
    const fetchData = async () => {
      try {
        const res = await apiClient.get<AccommodationDetailData>(
          `/accommodations/${accommodationId}`,
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

  // Seed the heart from the user's real wishlist once we know who they are.
  // Guests (no token) see the un-hearted state; toggling routes to the OTP
  // modal instead. Bounded pagination, same contract as the wishlists page.
  React.useEffect(() => {
    if (!token || isInvalidId || !accommodationId) return

    let isCurrent = true
    const seedWishlistState = async () => {
      try {
        const limit = 100
        let skip = 0
        for (;;) {
          const page = await apiClient.get<WishlistItemResponse[]>(
            `/wishlists/?skip=${skip}&limit=${limit}`,
          )
          const batch = Array.isArray(page) ? page : []
          if (isCurrent && batch.some((item) => item.accommodation_id === accommodationId)) {
            setIsWishlisted(true)
          }
          if (batch.length < limit) break
          skip += limit
        }
      } catch {
        // Silent: an un-hearted default is safe; the toggle reconciles truth.
      }
    }

    seedWishlistState()

    return () => {
      isCurrent = false
    }
  }, [token, accommodationId, isInvalidId])

  const handleDateRangeChange = (inDate: string | null, outDate: string | null) => {
    setCheckIn(inDate)
    setCheckOut(outDate)
  }

  const handleShare = async () => {
    const url = window.location.href
    const shareData = { title: document.title, url }

    // 1. Web Share API — mobile / OS share sheet when available.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        // AbortError = user closed the sheet; anything else falls through to copy.
        if (err instanceof DOMException && err.name === "AbortError") return
      }
    }

    // 2. Async Clipboard API. Some embedding browsers deny clipboard-write
    //    (NotAllowedError) even in secure contexts.
    try {
      await navigator.clipboard.writeText(url)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2500)
      return
    } catch {
      // fall through to the legacy path
    }

    // 3. Legacy execCommand fallback — still works where the async API is denied.
    try {
      const textarea = document.createElement("textarea")
      textarea.value = url
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const copied = document.execCommand("copy")
      document.body.removeChild(textarea)
      if (copied) {
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2500)
        return
      }
    } catch {
      // fall through to the failure notice
    }

    // 4. Everything failed — surface it instead of failing silently.
    setShareError("کپی نشد. لینک صفحه را از نوار آدرس مرورگر کپی کنید.")
    setTimeout(() => setShareError(null), 4000)
  }

  const formatPersian = formatFaNumber
  // Persist the wishlist heart via the same toggle endpoint the search page
  // uses. One accommodation per page, so a single pending ref guards it.
  const pendingWishlistRef = React.useRef<number | null>(null)
  const handleToggleWishlist = async () => {
    if (!token) {
      openOtpModal()
      return
    }
    if (pendingWishlistRef.current === accommodationId) return

    const previous = isWishlisted
    pendingWishlistRef.current = accommodationId
    setIsWishlisted(!previous)

    try {
      const res = await apiClient.post<WishlistToggleResponse>(
        `/wishlists/${accommodationId}/toggle`,
      )
      if (res && typeof res.is_favorite === "boolean") {
        setIsWishlisted(res.is_favorite)
      }
    } catch (err) {
      console.error("Failed to toggle wishlist:", err)
      setIsWishlisted(previous)
      setErrorMessage("خطا در ثبت نشان. لطفا دوباره تلاش کنید.")
    } finally {
      pendingWishlistRef.current = null
    }
  }

  // 1. Defensive ID Guard & 404 / Error State
  if (isInvalidId || errorStatus === 404) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-paper p-4 text-ink">
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-line bg-paper-card p-8 text-center shadow-soft">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brick-soft/70 text-brick-deep">
            <AlertCircle className="size-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black tracking-tight text-ink">
              اقامتگاه مورد نظر یافت نشد
            </h1>
            <p className="text-xs leading-6 text-ink-soft">
              این اقامتگاه ممکن است حذف شده باشد یا شناسه وارد شده صحیح نباشد.
            </p>
          </div>
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
      <main className="flex min-h-[70vh] items-center justify-center bg-paper p-4 text-ink">
        <div className="w-full max-w-md space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-bold">خطا در بارگذاری</AlertTitle>
            <AlertDescription className="mt-1 text-xs">
              {errorMessage || "ارتباط با سرور برقرار نشد. لطفاً اینترنت خود را بررسی کنید."}
            </AlertDescription>
          </Alert>
          <Button asChild variant="outline" className="w-full border-line bg-paper-card text-ink">
            <Link href="/">بازگشت به صفحه اصلی</Link>
          </Button>
        </div>
      </main>
    )
  }

  // 3. Loading Skeletons
  if (isLoading || !data) {
    return (
      <main className="min-h-screen bg-paper text-ink">
        <div className="mx-auto max-w-[1360px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {/* Breadcrumb Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-16 bg-paper-deep" />
            <Skeleton className="h-3 w-3 bg-paper-deep" />
            <Skeleton className="h-3 w-24 bg-paper-deep" />
          </div>

          {/* Title & Action Skeletons */}
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-3 w-30 bg-paper-deep" />
              <Skeleton className="h-9 w-3/4 max-w-md bg-paper-deep" />
              <Skeleton className="h-4 w-1/2 max-w-sm bg-paper-deep" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 bg-paper-deep" />
              <Skeleton className="h-9 w-24 bg-paper-deep" />
            </div>
          </div>

          {/* Photo Gallery Skeleton */}
          <Skeleton className="h-[320px] w-full rounded-2xl bg-paper-deep sm:h-[420px]" />

          {/* Content & Sidebar Grid Skeleton */}
          <div className="grid grid-cols-1 items-start gap-8 pt-2 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <Skeleton className="h-32 w-full rounded-2xl bg-paper-deep" />
              <Skeleton className="h-24 w-full rounded-2xl bg-paper-deep" />
              <Skeleton className="h-48 w-full rounded-2xl bg-paper-deep" />
            </div>
            <div className="hidden lg:col-span-5 lg:block">
              <Skeleton className="h-96 w-full rounded-3xl bg-paper-deep" />
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main key={accommodationId} className="min-h-screen bg-paper pb-28 text-ink lg:pb-16">
      <div className="mx-auto w-full max-w-[1360px] space-y-6 px-4 py-5 sm:px-6 lg:space-y-8 lg:px-8 lg:py-8">
        {/* Breadcrumb Navigation */}
        <nav
          aria-label="مسیریابی"
          className="no-scrollbar flex items-center gap-1.5 overflow-x-auto text-xs text-ink-soft"
        >
          <Link href="/" className="flex-shrink-0 transition-colors hover:text-brick">
            صفحه اصلی
          </Link>
          {data.city?.province && (
            <>
              <ChevronLeft className="size-3 flex-shrink-0 text-line-strong" />
              <span className="flex-shrink-0">{data.city.province.name}</span>
            </>
          )}
          {data.city && (
            <>
              <ChevronLeft className="size-3 flex-shrink-0 text-line-strong" />
              <span className="flex-shrink-0">{data.city.name}</span>
            </>
          )}
          <ChevronLeft className="size-3 flex-shrink-0 text-line-strong" />
          <span className="max-w-[200px] truncate font-semibold text-ink sm:max-w-xs">
            {data.title}
          </span>
        </nav>

        {/* Title & Action Header */}
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="max-w-3xl space-y-3">
            <p className="flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick">
              <span aria-hidden="true" className="h-px w-8 bg-brick/45" />
              {data.category?.title ?? "اقامتگاه بومی"}
            </p>

            <h1 className="text-balance text-2xl font-black tracking-tight text-ink sm:text-3xl lg:text-4xl">
              {data.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-soft">
              {data.average_rating ? (
                <div className="flex items-center gap-1 font-semibold text-ink">
                  <Star className="size-4 fill-gold text-gold" />
                  <span className="tabular-nums">
                    {new Intl.NumberFormat("fa-IR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }).format(data.average_rating)}
                  </span>
                  <span className="font-normal text-ink-soft">
                    ({formatPersian(data.reviews_count)} نظر)
                  </span>
                </div>
              ) : null}

              {data.average_rating && data.address ? (
                <span aria-hidden="true" className="hidden h-3 w-px bg-line sm:block" />
              ) : null}

              <div className="flex items-center gap-1">
                <MapPin className="size-3.5 text-brick" />
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
              className="h-9 gap-1.5 border-line bg-paper-card text-xs text-ink shadow-none hover:bg-paper"
              aria-live="polite"
            >
              {isCopied ? (
                <>
                  <Check className="size-4 text-trust" />
                  <span className="font-semibold text-trust">کپی شد</span>
                </>
              ) : (
                <>
                  <Share2 className="size-4" />
                  <span>اشتراک‌گذاری</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleWishlist}
              className="h-9 gap-1.5 border-line bg-paper-card text-xs text-ink shadow-none hover:bg-paper"
            >
              <Heart
                className={`size-4 ${isWishlisted ? "fill-brick text-brick" : "text-ink-soft"}`}
              />
              <span>{isWishlisted ? "نشان شده" : "نشان کردن"}</span>
            </Button>
          </div>
        </div>

        {shareError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {shareError}
          </p>
        ) : null}

        {/* Photo Gallery Mosaic */}
        <PhotoGallery
          images={data.images}
          title={data.title}
          isFavorite={isWishlisted}
          onToggleFavorite={handleToggleWishlist}
        />

        {/* Two-Column Responsive Layout */}
        <div className="grid grid-cols-1 items-start gap-8 pt-2 lg:grid-cols-12 lg:gap-10">
          {/* Right Main Column (lg:col-span-7) */}
          <div className="space-y-8 lg:col-span-7 lg:space-y-10">
            {/* Host Card */}
            <HostCard
              host={data.host}
              checkInTime={data.check_in_time}
              checkOutTime={data.check_out_time}
              cancellationPolicy={data.cancellation_policy}
              cancellationFreeHours={data.cancellation_free_hours}
              cancellationPenaltyPercent={data.cancellation_penalty_percent}
              rules={data.rules}
            />

            {/* Accommodation Specs */}
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-line bg-paper-card p-4 text-center shadow-soft">
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-line/60 bg-paper p-3">
                <DoorClosed className="size-5 text-brick" />
                <span className="text-xs font-bold tabular-nums text-ink sm:text-sm">
                  {formatPersian(data.rooms_count)} اتاق خواب
                </span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-line/60 bg-paper p-3">
                <Bed className="size-5 text-brick" />
                <span className="text-xs font-bold tabular-nums text-ink sm:text-sm">
                  {formatPersian(data.beds_count)} تخت خواب
                </span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-line/60 bg-paper p-3">
                <Users className="size-5 text-brick" />
                <span className="text-xs font-bold tabular-nums text-ink sm:text-sm">
                  تا {formatPersian(data.max_capacity)} مهمان
                </span>
                <span className="text-[10px] text-ink-soft">
                  (پایه {formatPersian(data.capacity)} نفر)
                </span>
              </div>
            </div>

            {/* Description */}
            {data.description && (
              <section className="space-y-3">
                <p className="flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick">
                  <span aria-hidden="true" className="h-px w-8 bg-brick/45" />
                  درباره اقامتگاه
                </p>
                <h3 className="text-xl font-black tracking-tight text-ink">خانه را بشناسید</h3>
                <p className="whitespace-pre-line text-sm leading-8 text-ink-soft">
                  {data.description}
                </p>
              </section>
            )}

            {/* Amenities List */}
            <AmenitiesList
              amenities={data.amenities}
              customAmenities={data.custom_amenities ?? []}
            />

            {/* Availability Calendar */}
            <section id="availability-calendar" className="scroll-mt-28">
              <AvailabilityCalendar
                accommodationId={data.id}
                minNights={data.min_nights}
                basePrice={data.base_price}
                checkIn={checkIn}
                checkOut={checkOut}
                onDateRangeChange={handleDateRangeChange}
              />
            </section>

            {/* Reviews Section */}
            <ReviewsSection
              accommodationId={data.id}
              averageRating={data.average_rating}
              reviewsCount={data.reviews_count}
              accommodationTitle={data.title}
            />
          </div>

          {/* Left Sticky Sidebar for Desktop (lg:col-span-5) */}
          <div className="lg:col-span-5">
            <BookingWidget accommodation={data} checkIn={checkIn} checkOut={checkOut} />
          </div>
        </div>
      </div>
    </main>
  )
}
