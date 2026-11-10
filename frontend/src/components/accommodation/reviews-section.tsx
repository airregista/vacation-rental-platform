"use client"

import * as React from "react"
import { Star, MessageSquare } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { ReviewItem } from "@/types/detail"

export interface ReviewsSectionProps {
  accommodationId: number
  averageRating: number | null
  reviewsCount: number
}

export function ReviewsSection({
  accommodationId,
  averageRating,
  reviewsCount,
}: ReviewsSectionProps) {
  const [reviews, setReviews] = React.useState<ReviewItem[]>([])
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [fetchError, setFetchError] = React.useState<boolean>(false)
  const [retryCount, setRetryCount] = React.useState(0)
  const [visibleCount, setVisibleCount] = React.useState(6)

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

  const formatPersian = (n: number) => new Intl.NumberFormat("fa-IR").format(n)

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
            className={`h-3.5 w-3.5 ${
              s <= rating
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <Separator />

      {/* Ratings Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
            {averageRating ? (
              <span>
                {formatRating(averageRating)} ·{" "}
                {!isLoading && reviews.length < reviewsCount
                  ? `نمایش ${formatPersian(reviews.length)} از ${formatPersian(reviewsCount)} نظر`
                  : `${formatPersian(reviewsCount)} نظر`}
              </span>
            ) : (
              <span>نظرات مهمانان</span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">
            نظرات ثبت‌شده توسط مهمانانی است که اقامت داشته‌اند.
          </p>
        </div>
      </div>

      {/* Sub-Ratings Progress Bars (if present) */}
      {(subRatings.avgCleanliness !== null || subRatings.avgAccuracy !== null) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border/70">
          {subRatings.avgCleanliness !== null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">نظافت و بهداشت</span>
                <span className="font-bold text-foreground">
                  {formatRating(subRatings.avgCleanliness)}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary rounded-full transition-all"
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
                <span className="font-medium text-foreground">تطابق با مشخصات</span>
                <span className="font-bold text-foreground">
                  {formatRating(subRatings.avgAccuracy)}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (subRatings.avgAccuracy / 5) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reviews List */}
      {isLoading ? (
        <div className="h-40 rounded-xl bg-muted/30 animate-pulse flex items-center justify-center text-xs text-muted-foreground">
          در حال بارگذاری نظرات...
        </div>
      ) : fetchError ? (
        <div className="p-8 text-center border rounded-2xl bg-card text-muted-foreground space-y-3">
          <MessageSquare className="h-8 w-8 mx-auto stroke-1 text-muted-foreground/60" />
          <p className="text-sm font-medium">خطا در بارگذاری نظرات</p>
          <p className="text-xs text-muted-foreground/80">
            ارتباط با سرور برقرار نشد. لطفاً مجدداً تلاش کنید.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRetryCount((prev) => prev + 1)}
            className="text-xs"
          >
            تلاش مجدد
          </Button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="p-8 text-center border rounded-2xl bg-card text-muted-foreground space-y-2">
          <MessageSquare className="h-8 w-8 mx-auto stroke-1 text-muted-foreground/60" />
          <p className="text-sm font-medium">هنوز نظری برای این اقامتگاه ثبت نشده است</p>
          <p className="text-xs text-muted-foreground/80">
            پس از تکمیل اقامت، اولین نفری باشید که تجربه خود را به اشتراک می‌گذارد.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="p-4 rounded-xl border border-border bg-card space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {/* User Info Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-10 w-10 border border-border">
                          {review.user?.avatar_url && (
                            <AvatarImage src={review.user.avatar_url} alt={authorName} />
                          )}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {authorInitial}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {authorName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatDate(review.created_at)}
                          </div>
                        </div>
                      </div>
                      {renderStars(review.rating)}
                    </div>

                    {/* Review text */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
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
                className="text-xs"
              >
                نمایش نظرات بیشتر ({formatPersian(reviews.length - visibleCount)} نظر باقی‌مانده)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
