"use client"

import * as React from "react"
import {
  Star,
  MessageSquare,
  Sparkles,
  CheckCircle,
  Clock,
  LogIn,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { formatFaNumber } from "@/lib/format-fa"
import { useAuth } from "@/context/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ReviewDialog,
  type ReviewDialogTarget,
} from "@/components/trips/review-dialog"
import type { ReviewItem } from "@/types/detail"

interface ReviewEligibility {
  can_review: boolean
  reservation_id: number | null
  has_review: boolean
  reason: "no_stay" | "stay_not_finished" | "already_reviewed" | null
}

export interface ReviewsSectionProps {
  accommodationId: number
  averageRating: number | null
  reviewsCount: number
  accommodationTitle?: string | null
}

export function ReviewsSection({
  accommodationId,
  averageRating,
  reviewsCount,
  accommodationTitle,
}: ReviewsSectionProps) {
  const {
    user,
    isAuthenticated,
    isLoading: isAuthLoading,
    openOtpModal,
  } = useAuth()

  const [reviews, setReviews] = React.useState<ReviewItem[]>([])
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [fetchError, setFetchError] = React.useState<boolean>(false)
  const [retryCount, setRetryCount] = React.useState(0)
  const [visibleCount, setVisibleCount] = React.useState(6)
  // Eligibility is keyed by accommodation + user so a previous account's
  // result is never shown while a fresh request is in flight.
  const [eligibility, setEligibility] = React.useState<{
    key: string
    data: ReviewEligibility
  } | null>(null)
  const [eligibilityRefreshKey, setEligibilityRefreshKey] =
    React.useState(0)
  const [reviewTarget, setReviewTarget] =
    React.useState<ReviewDialogTarget | null>(null)

  const eligibilityKey = `${accommodationId}:${user?.id ?? "anonymous"}`
  const activeEligibility =
    eligibility?.key === eligibilityKey ? eligibility.data : null

  React.useEffect(() => {
    let isCurrent = true

    const fetchReviews = async () => {
      setIsLoading(true)
      setFetchError(false)
      try {
        const data = await apiClient.get<ReviewItem[]>(
          `/accommodations/${accommodationId}/reviews?limit=100`
        )
        if (isCurrent) {
          setReviews(data || [])
          setIsLoading(false)
        }
      } catch {
        if (isCurrent) {
          setReviews([])
          setFetchError(true)
          setIsLoading(false)
        }
      }
    }

    fetchReviews()

    return () => {
      isCurrent = false
    }
  }, [accommodationId, retryCount])

  // Review eligibility is a secondary signal: any failure (401, 404, network)
  // simply hides the CTA instead of blocking the public reviews list.
  React.useEffect(() => {
    if (
      !isAuthenticated ||
      !Number.isInteger(accommodationId) ||
      accommodationId <= 0
    ) {
      return
    }

    let isCurrent = true
    const requestKey = `${accommodationId}:${user?.id ?? "anonymous"}`

    const fetchEligibility = async () => {
      try {
        const data = await apiClient.get<ReviewEligibility>(
          `/accommodations/${accommodationId}/reviews/eligibility`
        )
        if (isCurrent) setEligibility({ key: requestKey, data })
      } catch {
        if (isCurrent) setEligibility(null)
      }
    }

    fetchEligibility()

    return () => {
      isCurrent = false
    }
  }, [
    accommodationId,
    isAuthenticated,
    user?.id,
    eligibilityRefreshKey,
  ])

  const handleReviewSubmitted = () => {
    setRetryCount((prev) => prev + 1)
    setEligibilityRefreshKey((prev) => prev + 1)
  }

  const handleOpenReviewDialog = () => {
    if (
      !activeEligibility?.can_review ||
      activeEligibility.reservation_id === null
    )
      return
    setReviewTarget({
      id: activeEligibility.reservation_id,
      accommodation_id: accommodationId,
      accommodation_title: accommodationTitle,
    })
  }

  // Derive cleanliness and accuracy averages client-side
  const subRatings = React.useMemo(() => {
    const withCleanliness = reviews.filter((r) => r.cleanliness_rating !== null)
    const withAccuracy = reviews.filter((r) => r.accuracy_rating !== null)

    const avgCleanliness =
      withCleanliness.length > 0
        ? withCleanliness.reduce((sum, r) => sum + (r.cleanliness_rating ?? 0), 0) /
          withCleanliness.length
        : null

    const avgAccuracy =
      withAccuracy.length > 0
        ? withAccuracy.reduce((sum, r) => sum + (r.accuracy_rating ?? 0), 0) /
          withAccuracy.length
        : null

    return {
      avgCleanliness,
      cleanlinessCount: withCleanliness.length,
      avgAccuracy,
      accuracyCount: withAccuracy.length,
    }
  }, [reviews])

  const formatPersian = formatFaNumber

  const formatRating = (n: number) =>
    new Intl.NumberFormat("fa-IR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(n)

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      return new Intl.DateTimeFormat("fa-IR", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(d)
    } catch {
      return ""
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`size-3.5 ${
              s <= rating
                ? "fill-gold text-gold"
                : "text-line-strong"
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <Separator className="bg-line" />

      {/* Ratings Header */}
      <div className="space-y-2">
        <p className="flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick">
          <span aria-hidden="true" className="h-px w-8 bg-brick/45" />
          نظر مهمانان
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-xl font-black tracking-tight text-ink">
            {averageRating ? "تجربه مهمانان این خانه" : "نظرات مهمانان"}
          </h3>
          {averageRating ? (
            <span className="flex items-center gap-1 text-sm font-black tabular-nums text-ink">
              <Star className="size-4 fill-gold text-gold" />
              {formatRating(averageRating)}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-ink-soft">
          {averageRating
            ? !isLoading && reviews.length < reviewsCount
              ? `نمایش ${formatPersian(reviews.length)} از ${formatPersian(reviewsCount)} نظر ثبت‌شده`
              : `${formatPersian(reviewsCount)} نظر ثبت‌شده`
            : "نظرات ثبت‌شده توسط مهمانانی است که اقامت داشته‌اند."}
        </p>
      </div>

      {/* Sub-Ratings Progress Bars (if present) */}
      {(subRatings.avgCleanliness !== null || subRatings.avgAccuracy !== null) && (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-paper-card p-4 sm:grid-cols-2 sm:p-5">
          {subRatings.avgCleanliness !== null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink-soft">نظافت و بهداشت</span>
                <span className="font-black tabular-nums text-ink">
                  {formatRating(subRatings.avgCleanliness)}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-paper-deep">
                <div
                  className="h-full rounded-full bg-brick transition-all"
                  style={{
                    width: `${Math.min(100, (subRatings.avgCleanliness / 5) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {subRatings.avgAccuracy !== null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink-soft">تطابق با مشخصات</span>
                <span className="font-black tabular-nums text-ink">
                  {formatRating(subRatings.avgAccuracy)}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-paper-deep">
                <div
                  className="h-full rounded-full bg-brick transition-all"
                  style={{
                    width: `${Math.min(100, (subRatings.avgAccuracy / 5) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review eligibility / CTA — integrated above the list, no extra heading */}
      {isAuthLoading ? null : isAuthenticated ? (
        activeEligibility?.can_review &&
        activeEligibility.reservation_id !== null ? (
          <div className="flex flex-col gap-4 rounded-3xl border border-brick/25 bg-brick-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brick/10 text-brick">
                <Sparkles className="size-5" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-black text-ink">
                  شما در این اقامتگاه اقامت داشته‌اید
                </p>
                <p className="text-xs leading-6 text-ink-soft">
                  تجربه خود را با مهمان‌های بعدی به اشتراک بگذارید
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={handleOpenReviewDialog}
              className="w-full shrink-0 gap-2 sm:w-auto"
            >
              <Star className="size-4" />
              <span>ثبت نظر و امتیاز</span>
            </Button>
          </div>
        ) : activeEligibility?.reason === "stay_not_finished" ? (
          <p className="flex items-center gap-2 rounded-xl border border-line/70 bg-paper-deep/40 px-3 py-2 text-xs text-ink-soft">
            <Clock className="size-4 shrink-0" />
            پس از پایان اقامت می‌توانید نظر ثبت کنید
          </p>
        ) : activeEligibility?.reason === "already_reviewed" ||
          activeEligibility?.has_review ? (
          <p className="flex items-center gap-2 rounded-xl border border-trust/20 bg-trust/5 px-3 py-2 text-xs font-semibold text-trust">
            <CheckCircle className="size-4 shrink-0" />
            نظر شما برای این اقامت ثبت شده است
          </p>
        ) : null
      ) : (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-line bg-paper-card px-4 py-3 sm:flex-row sm:items-center">
          <p className="text-xs leading-6 text-ink-soft">
            برای ثبت نظر و امتیاز، ابتدا وارد حساب کاربری خود شوید.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openOtpModal}
            className="w-full shrink-0 gap-1.5 border-line bg-paper-card text-xs font-semibold text-ink shadow-none hover:bg-paper sm:w-auto"
          >
            <LogIn className="size-4" />
            <span>برای ثبت نظر وارد شوید</span>
          </Button>
        </div>
      )}

      {/* Reviews List */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-line bg-paper-deep/40 text-xs text-ink-soft">
          در حال بارگذاری نظرات...
        </div>
      ) : fetchError ? (
        <div className="space-y-3 rounded-3xl border border-line bg-paper-card p-8 text-center text-ink-soft">
          <MessageSquare className="mx-auto size-8 stroke-1 text-line-strong" />
          <p className="text-sm font-bold text-ink">خطا در بارگذاری نظرات</p>
          <p className="text-xs">
            ارتباط با سرور برقرار نشد. لطفاً مجدداً تلاش کنید.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRetryCount((prev) => prev + 1)}
            className="border-line bg-paper-card text-xs font-semibold text-ink shadow-none hover:bg-paper"
          >
            تلاش مجدد
          </Button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="space-y-2 rounded-3xl border border-dashed border-line bg-paper-card/60 p-8 text-center text-ink-soft">
          <MessageSquare className="mx-auto size-8 stroke-1 text-line-strong" />
          <p className="text-sm font-bold text-ink">هنوز نظری برای این اقامتگاه ثبت نشده است</p>
          <p className="text-xs">
            پس از تکمیل اقامت، اولین نفری باشید که تجربه خود را به اشتراک می‌گذارد.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {reviews.slice(0, visibleCount).map((review) => {
              const authorName = review.user
                ? `${review.user.first_name || ""} ${review.user.last_name || ""}`.trim() ||
                  "کاربر مهمان‌شو"
                : "کاربر مهمان‌شو"

              const authorInitial =
                review.user?.first_name?.[0] || review.user?.last_name?.[0] || "ک"

              return (
                <div
                  key={review.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-line/80 bg-paper-card p-5 transition-colors hover:border-line-strong"
                >
                  <div className="space-y-3">
                    {/* User Info Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-10 border border-line">
                          {review.user?.avatar_url && (
                            <AvatarImage src={review.user.avatar_url} alt={authorName} />
                          )}
                          <AvatarFallback className="bg-brick-soft/60 text-xs font-bold text-brick-deep">
                            {authorInitial}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-xs font-bold text-ink">
                            {authorName}
                          </div>
                          <div className="mt-0.5 text-[11px] text-ink-soft">
                            {formatDate(review.created_at)}
                          </div>
                        </div>
                      </div>
                      {renderStars(review.rating)}
                    </div>

                    {/* Review text */}
                    <p className="text-sm leading-7 text-ink-soft">
                      {review.comment}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {reviews.length > visibleCount && (
            <div className="pt-2 text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((prev) => prev + 6)}
                className="border-line bg-paper-card text-xs font-semibold text-ink shadow-none hover:bg-paper"
              >
                نمایش نظرات بیشتر ({formatPersian(reviews.length - visibleCount)} نظر باقی‌مانده)
              </Button>
            </div>
          )}
        </div>
      )}

      <ReviewDialog
        trip={reviewTarget}
        isOpen={reviewTarget !== null}
        onClose={() => setReviewTarget(null)}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </div>
  )
}
