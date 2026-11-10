"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Calendar as CalendarIcon,
  Users,
  Minus,
  Plus,
  Tag,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import { apiClient, ApiError } from "@/lib/api-client"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type {
  AccommodationDetailData,
  PriceCalculationResponse,
  ReservationResponse,
} from "@/types/detail"

export interface BookingWidgetProps {
  accommodation: AccommodationDetailData
  checkIn: string | null
  checkOut: string | null
}

export function BookingWidget({
  accommodation,
  checkIn,
  checkOut,
}: BookingWidgetProps) {
  const router = useRouter()
  const { isAuthenticated, openOtpModal } = useAuth()

  const [guestsCount, setGuestsCount] = React.useState<number>(1)
  const [couponInput, setCouponInput] = React.useState<string>("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<string | null>(null)
  const [couponError, setCouponError] = React.useState<string | null>(null)

  const [priceData, setPriceData] = React.useState<PriceCalculationResponse | null>(null)
  const [isCalculating, setIsCalculating] = React.useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const [isMobileSheetOpen, setIsMobileSheetOpen] = React.useState<boolean>(false)

  // Calculate nights count
  const nightsCount = React.useMemo(() => {
    if (!checkIn || !checkOut) return 0
    const t1 = new Date(checkIn + "T00:00:00Z").getTime()
    const t2 = new Date(checkOut + "T00:00:00Z").getTime()
    return Math.max(0, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)))
  }, [checkIn, checkOut])

  const isValidRange = nightsCount >= accommodation.min_nights

  // Safe effective price data derived from valid selection
  const effectivePriceData = checkIn && checkOut && isValidRange ? priceData : null

  // Trigger price calculation when dates, guests, or applied coupon change
  React.useEffect(() => {
    if (!checkIn || !checkOut || !isValidRange) {
      return
    }

    let isCurrent = true

    const calculatePrice = async () => {
      setIsCalculating(true)
      setSubmitError(null)

      const payload = {
        accommodation_id: accommodation.id,
        check_in: checkIn,
        check_out: checkOut,
        guests_count: guestsCount,
        coupon_code: appliedCoupon || undefined,
      }

      try {
        const res = await apiClient.post<PriceCalculationResponse>(
          "/reservations/calculate-price",
          payload
        )
        if (isCurrent) {
          setPriceData(res)
          setCouponError(null)
          setIsCalculating(false)
        }
      } catch (err: unknown) {
        if (!isCurrent) return

        // Only an invalid/expired coupon is a coupon error: clear it and
        // retry without it. Any other 400 (e.g. minimum-subtotal or
        // usage-limit) means the coupon is valid but inapplicable, so keep
        // it and surface the backend message instead.
        const INVALID_COUPON_DETAILS = [
          "Invalid or inactive coupon code",
          "Coupon code has expired or is not yet valid",
        ]
        if (
          appliedCoupon &&
          err instanceof ApiError &&
          err.status === 400 &&
          INVALID_COUPON_DETAILS.includes(err.detail)
        ) {
          setCouponError("کد تخفیف معتبر نیست یا منقضی شده است.")
          // Clearing the coupon re-triggers this effect for a no-coupon
          // calculation; no manual fallback fetch is needed.
          setAppliedCoupon(null)
        } else if (err instanceof ApiError) {
          setSubmitError(err.detail)
          setPriceData(null)
        } else {
          setSubmitError("خطا در برقراری ارتباط با سرور برای محاسبه قیمت.")
          setPriceData(null)
        }
        setIsCalculating(false)
      }
    }

    calculatePrice()

    return () => {
      isCurrent = false
      // A calc in flight when the effect re-runs (e.g. dates cleared
      // mid-flight) never reaches its own setIsCalculating(false) because
      // of the isCurrent guard above; reset here so the button label
      // doesn't stick on "در حال محاسبه قیمت...".
      setIsCalculating(false)
    }
  }, [
    accommodation.id,
    checkIn,
    checkOut,
    guestsCount,
    appliedCoupon,
    isValidRange,
  ])

  // Coupon handlers
  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = couponInput.trim()
    if (!trimmed) return
    setCouponError(null)
    setAppliedCoupon(trimmed)
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput("")
    setCouponError(null)
  }

  // Reservation booking handler
  const handleBook = async () => {
    if (!checkIn || !checkOut || !isValidRange || isCalculating) return

    if (!isAuthenticated) {
      openOtpModal()
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const res = await apiClient.post<ReservationResponse>("/reservations/", {
        accommodation_id: accommodation.id,
        check_in: checkIn,
        check_out: checkOut,
        guests_count: guestsCount,
        coupon_code: appliedCoupon || undefined,
      })

      router.push(`/checkout/${res.id}`)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        // Token expired since page load: open the login modal right away
        // instead of showing a cryptic error and waiting for a 2nd click.
        openOtpModal()
      } else if (err instanceof ApiError) {
        setSubmitError(err.detail)
      } else {
        setSubmitError("خطا در ایجاد رزرو. لطفاً مجدداً تلاش کنید.")
      }
      setIsSubmitting(false)
    }
  }

  const formatPersian = (n: number) => new Intl.NumberFormat("fa-IR").format(n)

  const formatPersianDate = (isoStr: string | null) => {
    if (!isoStr) return "انتخاب تاریخ"
    try {
      const d = new Date(isoStr + "T00:00:00Z")
      return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        timeZone: "UTC",
        month: "numeric",
        day: "numeric",
      }).format(d)
    } catch {
      return isoStr
    }
  }

  const extraGuestsCount = Math.max(0, guestsCount - accommodation.capacity)

  // Scroll to the calendar so the guest can (re)pick dates there. The
  // existing selection is preserved: clicking a date box never wipes it.
  const scrollToCalendar = () => {
    document
      .getElementById("availability-calendar")
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // Date boxes are rendered both in the desktop card and inside the mobile
  // bottom sheet. While the sheet is open body scroll is locked and the
  // sheet covers the page, so scrolling alone does nothing visible: close
  // the sheet first (like the "مشاهده تقویم" button below), then scroll.
  const handleDateBoxClick = () => {
    if (isMobileSheetOpen) {
      setIsMobileSheetOpen(false)
      setTimeout(() => scrollToCalendar(), 100)
    } else {
      scrollToCalendar()
    }
  }

  // Booking Card Body renderer
  const renderBookingContent = () => {
    return (
      <div className="space-y-4">
        {/* Base Rate Header */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">
              {formatPersian(accommodation.base_price)}
            </span>
            <span className="text-xs text-muted-foreground">تومان / هر شب</span>
          </div>

          {accommodation.average_rating ? (
            <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
              <span>★ {formatPersian(Number(accommodation.average_rating.toFixed(1)))}</span>
              <span className="text-muted-foreground">
                ({formatPersian(accommodation.reviews_count)})
              </span>
            </div>
          ) : null}
        </div>

        {/* Date Selector Box */}
        <div className="border border-border rounded-xl p-3 bg-muted/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              <span>تاریخ سفر</span>
            </span>
            {nightsCount > 0 && (
              <Badge variant="secondary" className="text-[11px] px-2 py-0">
                {formatPersian(nightsCount)} شب
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handleDateBoxClick()
                }
              }}
              title="مشاهده تقویم برای تغییر تاریخ ورود"
              className="p-2.5 rounded-lg bg-background border border-border cursor-pointer hover:border-primary/50 transition"
              onClick={handleDateBoxClick}
            >
              <span className="block text-[10px] text-muted-foreground mb-0.5">تاریخ ورود</span>
              <span className="font-semibold text-foreground">
                {formatPersianDate(checkIn)}
              </span>
            </div>
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handleDateBoxClick()
                }
              }}
              title="مشاهده تقویم برای تغییر تاریخ خروج"
              className="p-2.5 rounded-lg bg-background border border-border cursor-pointer hover:border-primary/50 transition"
              onClick={handleDateBoxClick}
            >
              <span className="block text-[10px] text-muted-foreground mb-0.5">تاریخ خروج</span>
              <span className="font-semibold text-foreground">
                {formatPersianDate(checkOut)}
              </span>
            </div>
          </div>

          {checkIn && !checkOut && (
            <p className="text-[11px] text-primary">
              اکنون تاریخ خروج را از تقویم زیر انتخاب کنید.
            </p>
          )}

          {checkIn && checkOut && !isValidRange && (
            <p className="text-[11px] text-destructive">
              حداقل اقامت در این اقامتگاه {formatPersian(accommodation.min_nights)} شب است.
            </p>
          )}
        </div>

        {/* Guests Stepper */}
        <div className="border border-border rounded-xl p-3 bg-muted/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Users className="h-4 w-4 text-primary" />
              <span>تعداد نفرات</span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="کاهش تعداد نفرات"
                className="h-7 w-7 rounded-full"
                disabled={guestsCount <= 1}
                onClick={() => setGuestsCount((prev) => Math.max(1, prev - 1))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-sm font-bold w-4 text-center">
                {formatPersian(guestsCount)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="افزایش تعداد نفرات"
                className="h-7 w-7 rounded-full"
                disabled={guestsCount >= accommodation.max_capacity}
                onClick={() =>
                  setGuestsCount((prev) => Math.min(accommodation.max_capacity, prev + 1))
                }
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground flex justify-between">
            <span>ظرفیت پایه: {formatPersian(accommodation.capacity)} نفر</span>
            <span>حداکثر ظرفیت: {formatPersian(accommodation.max_capacity)} نفر</span>
          </div>

          {extraGuestsCount > 0 && accommodation.extra_guest_fee > 0 && (
            <p className="text-[11px] text-primary/90 bg-primary/5 p-2 rounded-lg">
              نفر اضافه: {formatPersian(extraGuestsCount)} نفر ×{" "}
              {formatPersian(accommodation.extra_guest_fee)} تومان هر شب
            </p>
          )}
        </div>

        {/* Coupon Code Input */}
        <div className="space-y-1.5">
          <form onSubmit={handleApplyCoupon} className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="کد تخفیف دارید؟"
                className="pr-9 text-xs h-9"
                disabled={isCalculating || !!appliedCoupon}
              />
            </div>
            {appliedCoupon ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveCoupon}
                className="text-xs h-9 px-3 text-destructive hover:text-destructive flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" />
                <span>حذف</span>
              </Button>
            ) : (
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="text-xs h-9 px-4"
                disabled={!couponInput.trim() || isCalculating}
              >
                اعمال
              </Button>
            )}
          </form>

          {appliedCoupon && !couponError && effectivePriceData && effectivePriceData.discount_amount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium pt-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                کد «{appliedCoupon}» اعمال شد ({formatPersian(effectivePriceData.discount_amount)} تومان تخفیف)
              </span>
            </div>
          )}

          {couponError && (
            <p className="text-[11px] text-destructive pt-0.5">{couponError}</p>
          )}
        </div>

        {/* Error Alert */}
        {submitError && (
          <Alert variant="destructive" className="py-2.5">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{submitError}</AlertDescription>
          </Alert>
        )}

        {/* Itemized Price Breakdown */}
        {checkIn && checkOut && isValidRange && (
          <div className="space-y-3 pt-2">
            <Separator />
            <div className="text-xs space-y-2 text-muted-foreground">
              {isCalculating ? (
                <div className="py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>در حال محاسبه قیمت...</span>
                </div>
              ) : effectivePriceData ? (
                <>
                  <div className="flex justify-between">
                    <span>
                      {formatPersian(effectivePriceData.total_nights)} شب اقامت
                    </span>
                    <span className="font-medium text-foreground">
                      {formatPersian(effectivePriceData.nights_total)} تومان
                    </span>
                  </div>

                  {effectivePriceData.extra_guest_total > 0 && (
                    <div className="flex justify-between">
                      <span>
                        هزینه نفرات اضافه ({formatPersian(effectivePriceData.extra_guests_count)} نفر)
                      </span>
                      <span className="font-medium text-foreground">
                        {formatPersian(effectivePriceData.extra_guest_total)} تومان
                      </span>
                    </div>
                  )}

                  {effectivePriceData.cleaning_fee > 0 && (
                    <div className="flex justify-between">
                      <span>هزینه نظافت</span>
                      <span className="font-medium text-foreground">
                        {formatPersian(effectivePriceData.cleaning_fee)} تومان
                      </span>
                    </div>
                  )}

                  {effectivePriceData.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>تخفیف</span>
                      <span>- {formatPersian(effectivePriceData.discount_amount)} تومان</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-sm font-bold text-foreground">
                      مجموع قابل پرداخت
                    </span>
                    <span className="text-xl font-extrabold text-primary">
                      {formatPersian(effectivePriceData.total_price)} تومان
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Primary Reservation Action Button */}
        <Button
          type="button"
          onClick={handleBook}
          disabled={
            !checkIn ||
            !checkOut ||
            !isValidRange ||
            isCalculating ||
            isSubmitting ||
            !effectivePriceData
          }
          className="w-full h-11 text-sm font-bold mt-2 shadow-md"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>در حال ثبت رزرو...</span>
            </span>
          ) : isCalculating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>در حال محاسبه قیمت...</span>
            </span>
          ) : !checkIn || !checkOut ? (
            "تاریخ سفر را انتخاب کنید"
          ) : !isValidRange ? (
            `حداقل اقامت ${formatPersian(accommodation.min_nights)} شب است`
          ) : !effectivePriceData && submitError ? (
            "خطا در محاسبه قیمت"
          ) : (
            "رزرو اقامتگاه"
          )}
        </Button>
      </div>
    )
  }

  return (
    <>
      {/* Desktop Sticky Widget (>= lg) */}
      <div className="hidden lg:block lg:sticky lg:top-28 w-full">
        <Card className="border border-border shadow-lg rounded-2xl bg-card">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="sr-only">ویجت رزرو اقامتگاه</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">{renderBookingContent()}</CardContent>
          <CardFooter className="p-6 pt-0 text-[11px] text-muted-foreground text-center flex flex-col gap-1">
            <span>در این مرحله هزینه‌ای کسر نمی‌شود.</span>
          </CardFooter>
        </Card>
      </div>

      {/* Mobile Fixed Bottom Action Bar (< lg) */}
      <div className="block lg:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t border-border p-3 sm:p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col">
            {isCalculating ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>در حال محاسبه قیمت...</span>
              </span>
            ) : effectivePriceData ? (
              <>
                <span className="text-base font-extrabold text-foreground">
                  {formatPersian(effectivePriceData.total_price)} تومان
                </span>
                <span className="text-[10px] text-muted-foreground">
                  مجموع برای {formatPersian(nightsCount)} شب
                </span>
              </>
            ) : (
              <>
                <span className="text-base font-bold text-foreground">
                  {formatPersian(accommodation.base_price)} تومان
                </span>
                <span className="text-[10px] text-muted-foreground">هر شب</span>
              </>
            )}
          </div>

          <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button size="default" className="font-bold text-xs sm:text-sm px-6">
                {!checkIn || !checkOut ? "انتخاب تاریخ و رزرو" : "تکمیل رزرو"}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-6"
            >
              <SheetHeader className="pb-3 border-b border-border text-right">
                <SheetTitle className="text-base font-bold">
                  رزرو {accommodation.title}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  انتخاب تاریخ و جزئیات رزرو اقامتگاه
                </SheetDescription>
              </SheetHeader>
              <div className="py-4">
                {renderBookingContent()}
                {(!checkIn || !checkOut) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsMobileSheetOpen(false)
                      setTimeout(() => {
                        document.getElementById("availability-calendar")?.scrollIntoView({ behavior: "smooth" })
                      }, 100)
                    }}
                    className="w-full mt-3 flex items-center justify-center gap-2 text-xs"
                  >
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <span>مشاهده تقویم و انتخاب تاریخ</span>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  )
}
