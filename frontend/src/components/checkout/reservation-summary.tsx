"use client"

import * as React from "react"
import Image from "next/image"
import { Home, Calendar, Users, MapPin, ShieldCheck, Headphones, Lock, Tag } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { formatPersianDate } from "@/lib/format-fa"
import { type ReservationDetail, type CheckoutAccommodationInfo } from "@/types/checkout"
import { computeCheckoutBreakdown, formatFaPrice } from "@/lib/checkout-format"

export interface ReservationSummaryProps {
  reservation: ReservationDetail
  accommodation?: CheckoutAccommodationInfo | null
  className?: string
}

function formatToman(amount: number | string | null | undefined): string {
  return `${formatFaPrice(amount)} تومان`
}

export function ReservationSummary({
  reservation,
  accommodation,
  className,
}: ReservationSummaryProps) {
  const coverImage =
    accommodation?.images?.find((img) => img.is_cover)?.image_url ||
    accommodation?.images?.[0]?.image_url

  const title = accommodation?.title || reservation.accommodation_title || "اقامتگاه انتخابی"
  const locationText = accommodation?.city
    ? `${accommodation.city.name}${accommodation.city.province ? ` • ${accommodation.city.province.name}` : ""}`
    : null

  const { totalPayable, cleaningFee, baseTotal, discountAmount } = computeCheckoutBreakdown(
    reservation,
    accommodation,
  )

  return (
    <Card
      className={cn("overflow-hidden rounded-3xl border-line bg-paper-card shadow-soft", className)}
    >
      <CardHeader className="p-5 pb-3 sm:p-6">
        <div className="space-y-2">
          <p className="text-[11px] font-bold tracking-[0.18em] text-brick">خلاصه اقامت</p>
          <CardTitle className="text-lg font-black tracking-tight text-ink">خلاصه رزرو</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
        {/* Accommodation Preview */}
        <div className="flex items-start gap-3.5">
          <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-t-full rounded-b-xl border border-line bg-paper-deep">
            {coverImage ? (
              <Image src={coverImage} alt={title} fill unoptimized className="object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-paper-deep text-ink-soft/70">
                <Home className="size-6" />
                <span className="text-[10px]">بدون تصویر</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-black leading-6 text-ink sm:text-base">
              {title}
            </h3>
            {locationText && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-ink-soft">
                <MapPin className="size-3.5 shrink-0 text-brick" />
                <span className="truncate">{locationText}</span>
              </div>
            )}
          </div>
        </div>

        <Separator className="bg-line" />

        {/* Stay Details */}
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line/60 bg-paper-deep/50 p-3.5 text-xs sm:text-sm">
          <div className="space-y-1">
            <span className="flex items-center gap-1 text-xs text-ink-soft">
              <Calendar className="size-3.5 text-brick" />
              ورود:
            </span>
            <p className="font-bold tabular-nums text-ink">
              {formatPersianDate(reservation.check_in)}
            </p>
            <span className="text-[11px] text-ink-soft">از ساعت ۱۴:۰۰</span>
          </div>

          <div className="space-y-1">
            <span className="flex items-center gap-1 text-xs text-ink-soft">
              <Calendar className="size-3.5 text-brick" />
              خروج:
            </span>
            <p className="font-bold tabular-nums text-ink">
              {formatPersianDate(reservation.check_out)}
            </p>
            <span className="text-[11px] text-ink-soft">تا ساعت ۱۲:۰۰</span>
          </div>

          <div className="col-span-2 flex items-center justify-between border-t border-line/60 pt-2 text-xs tabular-nums text-ink-soft">
            <span>
              مدت اقامت: {new Intl.NumberFormat("fa-IR").format(reservation.total_nights)} شب
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              تعداد مهمانان: {new Intl.NumberFormat("fa-IR").format(reservation.guests_count)} نفر
            </span>
          </div>
        </div>

        <Separator className="bg-line" />

        {/* Financial Breakdown */}
        <div className="space-y-2.5 text-xs sm:text-sm">
          <div className="flex items-center justify-between text-ink-soft">
            <span>
              هزینه اقامت ({new Intl.NumberFormat("fa-IR").format(reservation.total_nights)} شب)
            </span>
            <span className="font-medium tabular-nums text-ink">{formatToman(baseTotal)}</span>
          </div>

          {cleaningFee > 0 && (
            <div className="flex items-center justify-between text-ink-soft">
              <span>هزینه نظافت و خدمات</span>
              <span className="font-medium tabular-nums text-ink">{formatToman(cleaningFee)}</span>
            </div>
          )}

          {discountAmount > 0 && reservation.coupon_code && (
            <div className="flex items-center justify-between text-trust">
              <span className="flex items-center gap-1">
                <Tag className="size-3.5" />
                تخفیف کد تخفیف ({reservation.coupon_code})
              </span>
              <span className="font-medium tabular-nums">- {formatToman(discountAmount)}</span>
            </div>
          )}

          <Separator className="my-2 bg-line" />

          <div className="flex items-center justify-between pt-1 text-sm font-bold sm:text-base">
            <span className="text-ink">مبلغ کل قابل پرداخت</span>
            <span className="text-base font-black tabular-nums text-brick sm:text-lg">
              {formatToman(totalPayable)}
            </span>
          </div>
          <p className="text-[11px] leading-5 text-ink-soft">
            نرخ هر شب بر اساس تقویم اقامتگاه محاسبه شده است.
          </p>
        </div>

        {/* Trust Badges */}
        <div className="space-y-2.5 border-t border-line/70 pt-4 text-[11px] text-ink-soft sm:text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0 text-trust" />
            <span>تضمین بازگشت آنی وجه در صورت مغایرت اقامتگاه</span>
          </div>
          <div className="flex items-center gap-2">
            <Headphones className="size-4 shrink-0 text-gold" />
            <span>پشتیبانی ۲۴ ساعته در تمامی مراحل سفر</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="size-4 shrink-0 text-brick" />
            <span>پرداخت امن متصل به درگاه شاپرک با رمزنگاری ۲۵۶ بیتی SSL</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
