"use client"

import * as React from "react"
import Image from "next/image"
import { Home, Calendar, Users, MapPin, ShieldCheck, Headphones, Lock, Tag } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { ReservationDetail, CheckoutAccommodationInfo } from "@/types/checkout"

export interface ReservationSummaryProps {
  reservation: ReservationDetail
  accommodation?: CheckoutAccommodationInfo | null
  className?: string
}

function formatPersianDate(dateStr: string): string {
  if (!dateStr) return ""
  try {
    const isoStr = dateStr.includes("T")
      ? (dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : `${dateStr}Z`)
      : `${dateStr}T00:00:00Z`
    const d = new Date(isoStr)
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(d)
  } catch {
    return dateStr
  }
}

function formatToman(amount: number): string {
  return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`
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

  const totalPayable = Number(reservation.total_price || 0)
  const cleaningFee = accommodation?.cleaning_fee ?? 0
  const basePrice = accommodation?.base_price ?? 0

  // When no coupon is present, stay total is (totalPayable - cleaningFee) to strictly
  // reflect extra guest fees, weekend pricing exceptions, and preserve line item sum.
  const baseTotal = !reservation.coupon_code
    ? Math.max(0, totalPayable - cleaningFee)
    : basePrice > 0
    ? basePrice * reservation.total_nights
    : Math.max(0, totalPayable - cleaningFee)

  const discountAmount = reservation.coupon_code
    ? Math.max(0, baseTotal + cleaningFee - totalPayable)
    : 0

  return (
    <Card className={cn("border border-border/70 shadow-sm rounded-2xl overflow-hidden", className)}>
      <CardHeader className="p-4 sm:p-5 pb-3">
        <CardTitle className="text-base sm:text-lg font-bold">خلاصه رزرو</CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
        {/* Accommodation Preview */}
        <div className="flex gap-3.5 items-start">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-muted shrink-0">
            {coverImage ? (
              <Image
                src={coverImage}
                alt={title}
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/60 bg-muted/60">
                <Home className="h-6 w-6" />
                <span className="text-[10px] mt-1">بدون تصویر</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm sm:text-base leading-snug line-clamp-2 text-foreground">
              {title}
            </h3>
            {locationText && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                <span className="truncate">{locationText}</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Stay Details */}
        <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm bg-muted/40 p-3 rounded-xl">
          <div className="space-y-1">
            <span className="text-muted-foreground text-xs flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              ورود:
            </span>
            <p className="font-bold text-foreground">
              {formatPersianDate(reservation.check_in)}
            </p>
            <span className="text-[11px] text-muted-foreground">از ساعت ۱۴:۰۰</span>
          </div>

          <div className="space-y-1">
            <span className="text-muted-foreground text-xs flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              خروج:
            </span>
            <p className="font-bold text-foreground">
              {formatPersianDate(reservation.check_out)}
            </p>
            <span className="text-[11px] text-muted-foreground">تا ساعت ۱۲:۰۰</span>
          </div>

          <div className="col-span-2 pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>مدت اقامت: {new Intl.NumberFormat("fa-IR").format(reservation.total_nights)} شب</span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              تعداد مهمانان: {new Intl.NumberFormat("fa-IR").format(reservation.guests_count)} نفر
            </span>
          </div>
        </div>

        <Separator />

        {/* Financial Breakdown */}
        <div className="space-y-2.5 text-xs sm:text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>
              هزینه اقامت ({new Intl.NumberFormat("fa-IR").format(reservation.total_nights)} شب)
            </span>
            <span className="font-medium text-foreground">{formatToman(baseTotal)}</span>
          </div>

          {cleaningFee > 0 && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>هزینه نظافت و خدمات</span>
              <span className="font-medium text-foreground">{formatToman(cleaningFee)}</span>
            </div>
          )}

          {discountAmount > 0 && reservation.coupon_code && (
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" />
                تخفیف کد تخفیف ({reservation.coupon_code})
              </span>
              <span className="font-medium">
                - {formatToman(discountAmount)}
              </span>
            </div>
          )}

          <Separator className="my-2" />

          <div className="flex items-center justify-between pt-1 text-sm sm:text-base font-bold">
            <span className="text-foreground">مبلغ کل قابل پرداخت</span>
            <span className="text-primary text-base sm:text-lg font-black font-mono">
              {formatToman(totalPayable)}
            </span>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="pt-2 space-y-2 text-[11px] sm:text-xs text-muted-foreground border-t border-border/40">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>تضمین بازگشت آنی وجه در صورت مغایرت اقامتگاه</span>
          </div>
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-blue-600 shrink-0" />
            <span>پشتیبانی ۲۴ ساعته در تمامی مراحل سفر</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-600 shrink-0" />
            <span>پرداخت امن متصل به درگاه شاپرک با رمزنگاری ۲۵۶ بیتی SSL</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
