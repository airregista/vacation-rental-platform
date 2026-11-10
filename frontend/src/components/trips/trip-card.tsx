"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { Building, Calendar, CreditCard, FileText, MessageSquare, Star, Users, XCircle } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatFaPrice } from "@/types/checkout"
import type { TripReservationItem } from "@/types/trips"

export interface TripCardProps {
  trip: TripReservationItem
  onOpenChat: (trip: TripReservationItem) => void
  onOpenCancel: (trip: TripReservationItem) => void
  onOpenReview: (trip: TripReservationItem) => void
}

function formatPersianDate(dateStr: string): string {
  if (!dateStr) return ""
  try {
    const isoStr = dateStr.includes("T")
      ? (dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : `${dateStr}Z`)
      : `${dateStr}T00:00:00Z`
    const d = new Date(isoStr)
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(d)
  } catch {
    return dateStr
  }
}

function toPersianDigits(n: number | string): string {
  return new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(Number(n) || 0)
}

export function TripCard({
  trip,
  onOpenChat,
  onOpenCancel,
  onOpenReview,
}: TripCardProps) {
  const [imageError, setImageError] = useState(false)

  // Determine check-in and check-out timestamps for strict guards
  const checkInTimestamp = React.useMemo(() => {
    try {
      const isoStr = trip.check_in.includes("T")
        ? trip.check_in
        : `${trip.check_in}T14:00:00Z`
      return new Date(isoStr).getTime()
    } catch {
      return 0
    }
  }, [trip.check_in])

  const checkOutTimestamp = React.useMemo(() => {
    try {
      const isoStr = trip.check_out.includes("T")
        ? trip.check_out
        : `${trip.check_out}T12:00:00Z`
      return new Date(isoStr).getTime()
    } catch {
      return 0
    }
  }, [trip.check_out])

  const [now] = useState(() => Date.now())
  const canCancel = trip.status === "confirmed" && checkInTimestamp > now
  const canReview =
    trip.status === "completed" ||
    (trip.status === "confirmed" && checkOutTimestamp <= now)
  const canChat = trip.status === "confirmed" || trip.status === "completed"

  const title =
    trip.accommodation_title || `اقامتگاه کد ${toPersianDigits(trip.accommodation_id)}`
  const nightsText = `${toPersianDigits(trip.total_nights)} شب`
  const guestsText = `${toPersianDigits(trip.guests_count)} نفر`
  const trackingCode = `کد رزرو: JBM-${toPersianDigits(trip.id)}`

  const renderStatusBadge = () => {
    switch (trip.status) {
      case "confirmed":
        return (
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90 border-0">
            تأیید شده
          </Badge>
        )
      case "completed":
        return <Badge variant="secondary">پایان‌یافته</Badge>
      case "cancelled": {
        const isExpired = trip.cancellation_reason?.toLowerCase().includes("expired")
        if (isExpired) {
          return <Badge variant="secondary">منقضی شده</Badge>
        }
        return <Badge variant="destructive">لغو شده</Badge>
      }
      case "pending":
      default:
        return (
          <Badge
            variant="outline"
            className="border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400"
          >
            در انتظار پرداخت
          </Badge>
        )
    }
  }

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Top Header bar with status and booking code */}
      <div className="bg-muted/40 px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/60">
        <div className="flex items-center gap-3">
          {renderStatusBadge()}
          <span className="text-xs text-muted-foreground font-mono font-medium">
            {trackingCode}
          </span>
        </div>
        {trip.city && (
          <span className="text-xs text-muted-foreground">
            {trip.province ? `${trip.province}، ` : ""}
            {trip.city}
          </span>
        )}
      </div>

      <div className="p-5 md:p-6">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Accommodation Thumbnail with Fallback */}
          <div className="sm:w-48 sm:h-36 w-full h-44 rounded-xl overflow-hidden relative flex-shrink-0 bg-muted">
            {trip.accommodation_image && !imageError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trip.accommodation_image}
                alt={title}
                onError={() => setImageError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-primary/5 text-primary/60 gap-1.5 p-4 text-center">
                <Building className="size-8 stroke-[1.5]" />
                <span className="text-xs font-medium text-muted-foreground">
                  تصویر اقامتگاه
                </span>
              </div>
            )}
          </div>

          {/* Details Column */}
          <div className="flex-1 flex flex-col justify-between gap-3">
            <div>
              <Link
                href={`/accommodations/${trip.accommodation_id}`}
                className="text-base sm:text-lg font-bold text-foreground hover:text-primary transition-colors line-clamp-2"
              >
                {title}
              </Link>

              {/* Schedule and guests */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-primary" />
                  <span>
                    {formatPersianDate(trip.check_in)} الی{" "}
                    {formatPersianDate(trip.check_out)} ({nightsText})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" />
                  <span>{guestsText}</span>
                </div>
              </div>

              {/* Cancellation Info for Cancelled Bookings */}
              {trip.status === "cancelled" && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs space-y-1">
                  {trip.cancellation_reason && (
                    <p>علت لغو: {trip.cancellation_reason}</p>
                  )}
                  {trip.refund_amount !== null && trip.refund_amount !== undefined && (
                    <p>
                      مبلغ مسترد شده: {formatFaPrice(trip.refund_amount)} تومان
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Price display and actions */}
            <div className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs text-muted-foreground block">
                  {trip.status === "pending"
                    ? "مبلغ قابل پرداخت:"
                    : "مبلغ کل پرداختی:"}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-extrabold text-foreground">
                    {formatFaPrice(trip.total_price)}
                  </span>
                  <span className="text-xs text-muted-foreground">تومان</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Pending: Continue to Payment */}
                {trip.status === "pending" && (
                  <Button asChild size="sm" className="gap-1.5">
                    <Link href={`/checkout/${trip.id}`}>
                      <CreditCard className="size-3.5" />
                      <span>ادامه پرداخت</span>
                    </Link>
                  </Button>
                )}

                {/* View Invoice: for confirmed or completed */}
                {(trip.status === "confirmed" || trip.status === "completed") && (
                  <Button asChild variant="ghost" size="sm" className="gap-1.5">
                    <Link href={`/checkout/${trip.id}`}>
                      <FileText className="size-3.5" />
                      <span>مشاهده فاکتور</span>
                    </Link>
                  </Button>
                )}

                {/* Host Chat: for confirmed or completed */}
                {canChat && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onOpenChat(trip)}
                  >
                    <MessageSquare className="size-3.5" />
                    <span>گفتگو با میزبان</span>
                  </Button>
                )}

                {/* Review Submission Guard */}
                {canReview && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-primary border-primary/40 hover:bg-primary/5"
                    onClick={() => onOpenReview(trip)}
                  >
                    <Star className="size-3.5 text-amber-500 fill-amber-500" />
                    <span>ثبت نظر</span>
                  </Button>
                )}

                {/* Cancellation Guard: Confirmed + Future Checkin */}
                {canCancel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                    onClick={() => onOpenCancel(trip)}
                  >
                    <XCircle className="size-3.5" />
                    <span>لغو رزرو</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
