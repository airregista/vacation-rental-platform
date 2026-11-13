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
  ChevronDown,
  ChevronUp,
  Star,
  ShieldCheck,
} from "lucide-react"
import { apiClient, ApiError } from "@/lib/api-client"
import { formatPersianDate as formatFullPersianDate } from "@/lib/format-fa"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
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

export function BookingWidget({ accommodation, checkIn, checkOut }: BookingWidgetProps) {
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
  const [isBreakdownOpen, setIsBreakdownOpen] = React.useState<boolean>(false)

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
          payload,
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
          "Coupon has expired",
          "Coupon is not yet active",
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
  }, [accommodation.id, checkIn, checkOut, guestsCount, appliedCoupon, isValidRange])

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
    const nightlyBreakdown = effectivePriceData?.breakdown ?? []

    return (
      <div className="space-y-5">
        <p className="flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick">
          <span aria-hidden="true" className="h-px w-8 bg-brick/45" />
          رزرو اقامت
        </p>

        {/* Base Rate Header */}
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black tracking-tight text-ink tabular-nums">
              {formatPersian(accommodation.base_price)}
            </span>
            <span className="text-xs text-ink-soft">تومان / هر شب</span>
          </div>

          {accommodation.average_rating ? (
            <div className="flex items-center gap-1 text-xs font-bold tabular-nums text-ink">
              <Star className="size-3.5 fill-gold text-gold" />
              <span>{formatPersian(Number(accommodation.average_rating.toFixed(1)))}</span>
              <span className="font-normal text-ink-soft">
                ({formatPersian(accommodation.reviews_count)})
              </span>
            </div>
          ) : null}
        </div>

        {/* Date Selector Box */}
        <div className="space-y-2 rounded-2xl border border-line bg-paper p-3">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="size-3.5 text-brick" />
              <span>تاریخ سفر</span>
            </span>
            {nightsCount > 0 && (
              <Badge variant="secondary" className="px-2 py-0.5 text-[11px] font-bold tabular-nums">
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
              className="cursor-pointer rounded-xl border border-line bg-paper-card p-2.5 transition-colors hover:border-brick/50"
              onClick={handleDateBoxClick}
            >
              <span className="mb-0.5 block text-[10px] text-ink-soft">تاریخ ورود</span>
              <span className="font-bold tabular-nums text-ink">{formatPersianDate(checkIn)}</span>
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
              className="cursor-pointer rounded-xl border border-line bg-paper-card p-2.5 transition-colors hover:border-brick/50"
              onClick={handleDateBoxClick}
            >
              <span className="mb-0.5 block text-[10px] text-ink-soft">تاریخ خروج</span>
              <span className="font-bold tabular-nums text-ink">{formatPersianDate(checkOut)}</span>
            </div>
          </div>

          {checkIn && !checkOut && (
            <p className="text-[11px] font-medium text-brick">
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
        <div className="space-y-2 rounded-2xl border border-line bg-paper p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Users className="size-4 text-brick" />
              <span>تعداد نفرات</span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="کاهش تعداد نفرات"
                className="size-7 rounded-full border-line bg-paper-card text-ink shadow-none hover:bg-paper-deep"
                disabled={guestsCount <= 1}
                onClick={() => setGuestsCount((prev) => Math.max(1, prev - 1))}
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-4 text-center text-sm font-black tabular-nums text-ink">
                {formatPersian(guestsCount)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="افزایش تعداد نفرات"
                className="size-7 rounded-full border-line bg-paper-card text-ink shadow-none hover:bg-paper-deep"
                disabled={guestsCount >= accommodation.max_capacity}
                onClick={() =>
                  setGuestsCount((prev) => Math.min(accommodation.max_capacity, prev + 1))
                }
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </div>

          <div className="flex justify-between text-[11px] tabular-nums text-ink-soft">
            <span>ظرفیت پایه: {formatPersian(accommodation.capacity)} نفر</span>
            <span>حداکثر ظرفیت: {formatPersian(accommodation.max_capacity)} نفر</span>
          </div>

          {extraGuestsCount > 0 && accommodation.extra_guest_fee > 0 && (
            <p className="rounded-lg bg-brick-soft/40 p-2 text-[11px] text-brick-deep">
              نفر اضافه: {formatPersian(extraGuestsCount)} نفر ×{" "}
              {formatPersian(accommodation.extra_guest_fee)} تومان هر شب
            </p>
          )}
        </div>

        {/* Coupon Code Input */}
        <div className="space-y-1.5">
          <form onSubmit={handleApplyCoupon} className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-soft" />
              <Input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="کد تخفیف دارید؟"
                className="h-9 border-line bg-paper-card pr-9 text-xs"
                disabled={isCalculating || !!appliedCoupon}
              />
            </div>
            {appliedCoupon ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveCoupon}
                className="flex h-9 items-center gap-1 border-line bg-paper-card px-3 text-xs text-destructive shadow-none hover:bg-paper hover:text-destructive"
              >
                <X className="size-3.5" />
                <span>حذف</span>
              </Button>
            ) : (
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="h-9 px-4 text-xs font-bold"
                disabled={!couponInput.trim() || isCalculating}
              >
                اعمال
              </Button>
            )}
          </form>

          {appliedCoupon &&
            !couponError &&
            effectivePriceData &&
            effectivePriceData.discount_amount > 0 && (
              <div className="flex items-center gap-1 pt-1 text-[11px] font-medium text-trust">
                <CheckCircle2 className="size-3.5" />
                <span>
                  کد «{appliedCoupon}» اعمال شد ({formatPersian(effectivePriceData.discount_amount)}{" "}
                  تومان تخفیف)
                </span>
              </div>
            )}

          {couponError && <p className="pt-0.5 text-[11px] text-destructive">{couponError}</p>}
        </div>

        {/* Error Alert */}
        {submitError && (
          <Alert variant="destructive" className="py-2.5">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">{submitError}</AlertDescription>
          </Alert>
        )}

        {/* Itemized Price Breakdown */}
        {checkIn && checkOut && isValidRange && (
          <div className="space-y-3 pt-1">
            <Separator className="bg-line" />
            <p className="text-[10px] leading-5 text-ink-soft sm:text-[11px]">
              نرخ برخی شب‌ها ممکن است بر اساس تقویم اقامتگاه متفاوت باشد.
            </p>
            <div className="space-y-2 text-xs text-ink-soft">
              {isCalculating ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-ink-soft">
                  <Loader2 className="size-4 animate-spin text-brick" />
                  <span>در حال محاسبه قیمت...</span>
                </div>
              ) : effectivePriceData ? (
                <>
                  <div className="flex justify-between">
                    <span>{formatPersian(effectivePriceData.total_nights)} شب اقامت</span>
                    <span className="font-medium tabular-nums text-ink">
                      {formatPersian(effectivePriceData.nights_total)} تومان
                    </span>
                  </div>

                  {nightlyBreakdown.length > 0 ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsBreakdownOpen((open) => !open)}
                        aria-expanded={isBreakdownOpen}
                        className="flex h-9 w-full items-center justify-between rounded-lg px-0 text-[11px] font-semibold text-ink-soft hover:bg-transparent hover:text-ink"
                      >
                        <span>
                          جزئیات قیمت هر شب ({formatPersian(effectivePriceData.total_nights)} شب)
                        </span>
                        {isBreakdownOpen ? (
                          <ChevronUp className="size-4 text-brick" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="size-4 text-brick" aria-hidden="true" />
                        )}
                      </Button>

                      {isBreakdownOpen ? (
                        <ul className="space-y-1.5 rounded-xl border border-line/60 bg-paper-deep/35 p-2.5">
                          {nightlyBreakdown.map((night) => (
                            <li
                              key={night.date}
                              className="flex items-center justify-between gap-2 text-[11px]"
                            >
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <span className="truncate text-ink-soft">
                                  {formatFullPersianDate(night.date)}
                                </span>
                                {night.is_exception ? (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 border-gold/30 bg-gold-soft/60 px-1.5 py-0 text-[9px] font-bold text-gold"
                                  >
                                    نرخ ویژه
                                  </Badge>
                                ) : null}
                              </div>
                              <span className="shrink-0 font-medium tabular-nums text-ink">
                                {formatPersian(night.price)} تومان
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : null}

                  {effectivePriceData.extra_guest_total > 0 && (
                    <div className="flex justify-between">
                      <span>
                        هزینه نفرات اضافه ({formatPersian(effectivePriceData.extra_guests_count)}{" "}
                        نفر)
                      </span>
                      <span className="font-medium tabular-nums text-ink">
                        {formatPersian(effectivePriceData.extra_guest_total)} تومان
                      </span>
                    </div>
                  )}

                  {effectivePriceData.cleaning_fee > 0 && (
                    <div className="flex justify-between">
                      <span>هزینه نظافت</span>
                      <span className="font-medium tabular-nums text-ink">
                        {formatPersian(effectivePriceData.cleaning_fee)} تومان
                      </span>
                    </div>
                  )}

                  {effectivePriceData.discount_amount > 0 && (
                    <div className="flex justify-between font-medium text-trust">
                      <span>تخفیف</span>
                      <span className="tabular-nums">
                        - {formatPersian(effectivePriceData.discount_amount)} تومان
                      </span>
                    </div>
                  )}

                  <Separator className="bg-line" />

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-sm font-bold text-ink">مجموع قابل پرداخت</span>
                    <span className="text-xl font-black tabular-nums text-brick">
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
          className="mt-1 h-12 w-full text-sm font-bold shadow-lift"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span>در حال ثبت رزرو...</span>
            </span>
          ) : isCalculating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
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
      <div className="hidden w-full lg:sticky lg:top-28 lg:block">
        <Card className="overflow-hidden rounded-3xl border-line bg-paper-card shadow-dock">
          <CardHeader className="sr-only p-6 pb-2">
            <CardTitle>ویجت رزرو اقامتگاه</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">{renderBookingContent()}</CardContent>
          <CardFooter className="flex flex-col gap-1.5 border-t border-line bg-paper-deep/30 px-6 py-4 text-center text-[11px] text-ink-soft">
            <span className="flex items-center gap-1.5 font-semibold text-trust">
              <ShieldCheck className="size-3.5" />
              پرداخت امن و تایید فوری رزرو
            </span>
            <span>در این مرحله هزینه‌ای کسر نمی‌شود.</span>
          </CardFooter>
        </Card>
      </div>

      {/* Mobile Fixed Bottom Action Bar (< lg) */}
      <div className="fixed inset-x-0 bottom-0 z-40 block border-t border-line bg-paper-card/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-dock backdrop-blur-md sm:p-4 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex flex-col">
            {isCalculating ? (
              <span className="flex items-center gap-2 text-sm text-ink-soft">
                <Loader2 className="size-4 animate-spin text-brick" />
                <span>در حال محاسبه قیمت...</span>
              </span>
            ) : effectivePriceData ? (
              <>
                <span className="text-lg font-black tabular-nums text-brick">
                  {formatPersian(effectivePriceData.total_price)} تومان
                </span>
                <span className="text-[10px] text-ink-soft">
                  مجموع برای {formatPersian(nightsCount)} شب
                </span>
              </>
            ) : (
              <>
                <span className="text-lg font-black tabular-nums text-ink">
                  {formatPersian(accommodation.base_price)} تومان
                </span>
                <span className="text-[10px] text-ink-soft">هر شب</span>
              </>
            )}
          </div>

          <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button className="px-6 text-xs font-bold sm:text-sm">
                {!checkIn || !checkOut ? "انتخاب تاریخ و رزرو" : "تکمیل رزرو"}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-line bg-paper p-6"
            >
              <SheetHeader className="border-b border-line pb-3 text-right">
                <SheetTitle className="text-base font-black tracking-tight text-ink">
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
                        document
                          .getElementById("availability-calendar")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }, 100)
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-2 border-line bg-paper-card text-xs font-semibold text-ink shadow-none hover:bg-paper"
                  >
                    <CalendarIcon className="size-4 text-brick" />
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
