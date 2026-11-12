"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Building,
  Calendar,
  CreditCard,
  FileText,
  MapPin,
  MessageSquare,
  Star,
  Users,
  XCircle,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TripStatusBadge } from "@/components/trips/trip-status-badge"
import { useTripPermissions } from "@/components/trips/trip-permissions"
import { formatFaPrice } from "@/types/checkout"
import { formatPersianDate, toPersianDigits } from "@/lib/format-fa"
import type { TripReservationItem } from "@/types/trips"

export interface TripCardProps {
  trip: TripReservationItem
  onOpenChat: (trip: TripReservationItem) => void
  onOpenCancel: (trip: TripReservationItem) => void
  onOpenReview: (trip: TripReservationItem) => void
}

export function TripCard({
  trip,
  onOpenChat,
  onOpenCancel,
  onOpenReview,
}: TripCardProps) {
  const [imageError, setImageError] = useState(false)
  const { canCancel, canReview, canChat } = useTripPermissions(trip)

  const title =
    trip.accommodation_title || `اقامتگاه کد ${toPersianDigits(trip.accommodation_id)}`
  const nightsText = `${toPersianDigits(trip.total_nights)} شب`
  const guestsText = `${toPersianDigits(trip.guests_count)} نفر`
  const trackingCode = `JBM-${toPersianDigits(trip.id)}`
  const detailHref = `/trips/${trip.id}`
  const locationText = [trip.province, trip.city].filter(Boolean).join("، ")

  return (
    <Card className="overflow-hidden rounded-2xl border-line/80 bg-paper-card shadow-soft transition-shadow hover:shadow-lift">
      {/* Status + reservation code ledger strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 bg-paper-deep/40 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <TripStatusBadge trip={trip} />
          <span className="font-mono text-[11px] font-medium text-ink-soft" dir="ltr">
            {trackingCode}
          </span>
        </div>
        {locationText ? (
          <span className="flex items-center gap-1 text-[11px] text-ink-soft">
            <MapPin className="size-3" />
            {locationText}
          </span>
        ) : null}
      </div>

      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          {/* Stay thumbnail */}
          <Link
            href={detailHref}
            className="relative block h-44 w-full shrink-0 overflow-hidden rounded-xl bg-paper-deep sm:h-36 sm:w-48"
            aria-label={`جزئیات رزرو ${title}`}
          >
            {trip.accommodation_image && !imageError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trip.accommodation_image}
                alt={title}
                onError={() => setImageError(true)}
                className="size-full object-cover transition-transform duration-500 hover:scale-[1.03]"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-paper-deep p-4 text-center text-brick/70">
                <span className="grid size-11 place-items-center rounded-b-xl rounded-t-full bg-brick/10">
                  <Building className="size-6 stroke-[1.5]" />
                </span>
                <span className="text-[11px] font-medium text-ink-soft">
                  تصویر اقامتگاه
                </span>
              </div>
            )}
          </Link>

          {/* Details */}
          <div className="flex flex-1 flex-col justify-between gap-3">
            <div>
              <Link
                href={detailHref}
                className="text-base font-black leading-7 text-ink transition-colors hover:text-brick sm:text-lg"
              >
                {title}
              </Link>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ink-soft">
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-brick" />
                  <span className="tabular-nums">
                    {formatPersianDate(trip.check_in)} الی{" "}
                    {formatPersianDate(trip.check_out)} ({nightsText})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-brick" />
                  <span>{guestsText}</span>
                </div>
              </div>

              {trip.status === "cancelled" && (
                <div className="mt-3 space-y-1 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-[11px] leading-6 text-destructive">
                  {trip.cancellation_reason && (
                    <p>علت لغو: {trip.cancellation_reason}</p>
                  )}
                  {trip.refund_amount !== null &&
                    trip.refund_amount !== undefined && (
                      <p className="tabular-nums">
                        مبلغ مسترد شده: {formatFaPrice(trip.refund_amount)} تومان
                      </p>
                    )}
                </div>
              )}
            </div>

            {/* Price + actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-3">
              <div>
                <span className="block text-[11px] text-ink-soft">
                  {trip.status === "pending"
                    ? "مبلغ قابل پرداخت"
                    : "مبلغ کل پرداختی"}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black tabular-nums text-ink">
                    {formatFaPrice(trip.total_price)}
                  </span>
                  <span className="text-[11px] text-ink-soft">تومان</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="ghost" size="sm" className="gap-1.5 text-ink-soft hover:text-brick">
                  <Link href={detailHref}>
                    <span>جزئیات رزرو</span>
                    <ArrowLeft className="size-3.5" />
                  </Link>
                </Button>

                {trip.status === "pending" && (
                  <Button asChild size="sm" className="gap-1.5">
                    <Link href={`/checkout/${trip.id}`}>
                      <CreditCard className="size-3.5" />
                      <span>ادامه پرداخت</span>
                    </Link>
                  </Button>
                )}

                {(trip.status === "confirmed" || trip.status === "completed") && (
                  <Button asChild variant="ghost" size="sm" className="gap-1.5">
                    <Link href={`/invoice/${trip.id}`}>
                      <FileText className="size-3.5" />
                      <span>مشاهده فاکتور</span>
                    </Link>
                  </Button>
                )}

                {canChat && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-line bg-transparent"
                    onClick={() => onOpenChat(trip)}
                  >
                    <MessageSquare className="size-3.5" />
                    <span>گفتگو با میزبان</span>
                  </Button>
                )}

                {canReview && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-brick/35 text-brick hover:bg-brick/5 hover:text-brick"
                    onClick={() => onOpenReview(trip)}
                  >
                    <Star className="size-3.5 fill-gold text-gold" />
                    <span>ثبت نظر</span>
                  </Button>
                )}

                {canCancel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
