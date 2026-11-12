"use client"

import * as React from "react"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Tag,
  TicketPercent,
} from "lucide-react"

import { apiClient, ApiError } from "@/lib/api-client"
import { formatPersianDate } from "@/lib/format-fa"
import type { AdminCoupon } from "@/components/admin/types"
import { AdminStatusBadge } from "@/components/admin/status-badge"
import {
  couponDiscountLabel,
  formatCount,
  formatToman,
  toAmount,
} from "@/components/admin/admin-utils"
import { EmptyState } from "@/components/shared/empty-state"
import { JalaliDateField } from "@/components/shared/date-field"
import { PersianNumberInput } from "@/components/shared/persian-number-input"
import { PersianTimeInput } from "@/components/shared/persian-time-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

type DiscountType = "percentage" | "fixed"

interface CouponFormState {
  code: string
  discountType: DiscountType
  discountValue: string
  maxDiscount: string
  minBooking: string
  validFrom: string
  validUntil: string
  usageLimit: string
  isActive: boolean
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function toDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

function datePart(value: string): string {
  return value.slice(0, 10)
}

function timePart(value: string): string {
  return value.length >= 16 ? value.slice(11, 16) : "00:00"
}

function withDatePart(value: string, isoDate: string): string {
  return isoDate ? `${isoDate}T${timePart(value)}` : ""
}

function withTimePart(value: string, time: string): string {
  return datePart(value) ? `${datePart(value)}T${time}` : ""
}

function freshForm(): CouponFormState {
  const now = new Date()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return {
    code: "",
    discountType: "percentage",
    discountValue: "",
    maxDiscount: "",
    minBooking: "",
    validFrom: toDateTimeLocal(now),
    validUntil: toDateTimeLocal(nextWeek),
    usageLimit: "",
    isActive: true,
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (/already exists/i.test(error.detail)) {
      return "این کد تخفیف قبلاً ثبت شده است. کد دیگری انتخاب کنید."
    }
    if (error.status === 422) {
      return "اطلاعات فرم کامل یا معتبر نیست. مقادیر را بررسی و دوباره تلاش کنید."
    }
    return error.detail || "ساخت کوپن با خطا مواجه شد."
  }
  return "ساخت کوپن با خطا مواجه شد. اتصال شبکه را بررسی کنید."
}

function CouponCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (coupon: AdminCoupon) => void
}) {
  const [form, setForm] = React.useState<CouponFormState>(freshForm)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const update = <K extends keyof CouponFormState>(key: K, value: CouponFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const code = form.code.trim().toUpperCase()
    const discountValue = Number(form.discountValue)
    const minBooking = form.minBooking.trim() ? Number(form.minBooking) : 0
    const maxDiscount = form.maxDiscount.trim() ? Number(form.maxDiscount) : null
    const usageLimit = form.usageLimit.trim() ? Number(form.usageLimit) : null

    if (code.length < 3) {
      setError("کد تخفیف باید حداقل ۳ کاراکتر باشد.")
      return
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setError("مقدار تخفیف باید یک عدد بزرگ‌تر از صفر باشد.")
      return
    }
    if (form.discountType === "percentage" && discountValue > 100) {
      setError("درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.")
      return
    }
    if (!form.validFrom || !form.validUntil) {
      setError("بازهٔ اعتبار کوپن را مشخص کنید.")
      return
    }
    const validFrom = new Date(form.validFrom)
    const validUntil = new Date(form.validUntil)
    if (
      Number.isNaN(validFrom.getTime()) ||
      Number.isNaN(validUntil.getTime()) ||
      validUntil <= validFrom
    ) {
      setError("پایان اعتبار باید بعد از شروع آن باشد.")
      return
    }
    if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount <= 0)) {
      setError("سقف تخفیف باید بزرگ‌تر از صفر باشد یا خالی بماند.")
      return
    }
    if (!Number.isFinite(minBooking) || minBooking < 0) {
      setError("حداقل مبلغ رزرو نمی‌تواند منفی باشد.")
      return
    }
    if (
      usageLimit !== null &&
      (!Number.isInteger(usageLimit) || usageLimit <= 0)
    ) {
      setError("سقف استفاده باید یک عدد صحیح بزرگ‌تر از صفر باشد.")
      return
    }

    setIsSubmitting(true)
    try {
      const coupon = await apiClient.post<AdminCoupon>("/coupons/", {
        code,
        discount_type: form.discountType,
        discount_value: discountValue,
        max_discount_amount: maxDiscount,
        min_booking_amount: minBooking,
        valid_from: validFrom.toISOString(),
        valid_until: validUntil.toISOString(),
        usage_limit: usageLimit,
        is_active: form.isActive,
      })
      onCreated(coupon)
      setForm(freshForm())
      onOpenChange(false)
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-line bg-paper-card text-ink sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">ساخت کوپن تخفیف</DialogTitle>
          <DialogDescription className="text-xs leading-6 text-ink-soft">
            کد، نوع تخفیف و بازهٔ اعتبار را مشخص کنید. کد به‌صورت خودکار با حروف
            بزرگ ذخیره می‌شود.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="coupon-code" className="text-xs font-bold text-ink">
              کد تخفیف
            </label>
            <Input
              id="coupon-code"
              value={form.code}
              onChange={(event) => update("code", event.target.value.toUpperCase())}
              placeholder="NOWRUZ1405"
              dir="ltr"
              autoComplete="off"
              className="mt-2 text-left font-semibold uppercase tracking-wider"
              maxLength={30}
              required
            />
            <p className="mt-1.5 text-[11px] text-ink-soft">
              بین ۳ تا ۳۰ کاراکتر؛ حروف انگلیسی و عدد.
            </p>
          </div>

          <fieldset>
            <legend className="text-xs font-bold text-ink">نوع تخفیف</legend>
            <RadioGroup
              value={form.discountType}
              onValueChange={(value) => update("discountType", value as DiscountType)}
              className="mt-2 grid grid-cols-2 gap-2"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 text-xs font-semibold text-ink transition-colors has-[:checked]:border-brick/50 has-[:checked]:bg-brick/5">
                <RadioGroupItem value="percentage" id="discount-percentage" />
                تخفیف درصدی
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 text-xs font-semibold text-ink transition-colors has-[:checked]:border-brick/50 has-[:checked]:bg-brick/5">
                <RadioGroupItem value="fixed" id="discount-fixed" />
                مبلغ ثابت
              </label>
            </RadioGroup>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="discount-value" className="text-xs font-bold text-ink">
                مقدار تخفیف
              </label>
              <PersianNumberInput
                id="discount-value"
                allowDecimal
                min={0}
                value={
                  form.discountValue.trim() === ""
                    ? null
                    : Number(form.discountValue)
                }
                emptyValue={null}
                onValueChange={(value) =>
                  update("discountValue", value === null ? "" : String(value))
                }
                placeholder={form.discountType === "percentage" ? "۱۵" : "۲۰۰۰۰۰"}
                className="mt-2 text-left tabular-nums"
                required
              />
              <p className="mt-1.5 text-[11px] text-ink-soft">
                {form.discountType === "percentage"
                  ? "درصد تخفیف از مبلغ رزرو"
                  : "مبلغ تخفیف به تومان"}
              </p>
            </div>

            <div>
              <label htmlFor="max-discount" className="text-xs font-bold text-ink">
                سقف تخفیف (اختیاری)
              </label>
              <PersianNumberInput
                id="max-discount"
                min={0}
                value={
                  form.maxDiscount.trim() === "" ? null : Number(form.maxDiscount)
                }
                emptyValue={null}
                onValueChange={(value) =>
                  update("maxDiscount", value === null ? "" : String(value))
                }
                placeholder="۵۰۰۰۰۰"
                className="mt-2 text-left tabular-nums"
              />
              <p className="mt-1.5 text-[11px] text-ink-soft">
                برای تخفیف درصدی، حداکثر مبلغ کسرشده
              </p>
            </div>

            <div>
              <label htmlFor="min-booking" className="text-xs font-bold text-ink">
                حداقل مبلغ رزرو
              </label>
              <PersianNumberInput
                id="min-booking"
                min={0}
                value={
                  form.minBooking.trim() === "" ? null : Number(form.minBooking)
                }
                emptyValue={null}
                onValueChange={(value) =>
                  update("minBooking", value === null ? "" : String(value))
                }
                placeholder="۰"
                className="mt-2 text-left tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="usage-limit" className="text-xs font-bold text-ink">
                سقف تعداد استفاده (اختیاری)
              </label>
              <PersianNumberInput
                id="usage-limit"
                min={1}
                value={
                  form.usageLimit.trim() === "" ? null : Number(form.usageLimit)
                }
                emptyValue={null}
                onValueChange={(value) =>
                  update("usageLimit", value === null ? "" : String(value))
                }
                placeholder="بدون سقف"
                className="mt-2 text-left tabular-nums"
              />
            </div>

            <div className="space-y-2">
              <JalaliDateField
                label="تاریخ شروع اعتبار"
                ariaLabel="تاریخ شروع اعتبار"
                boxed
                value={datePart(form.validFrom)}
                onChange={(isoDate) =>
                  update("validFrom", withDatePart(form.validFrom, isoDate))
                }
              />
              <label
                htmlFor="valid-from-time"
                className="flex items-center gap-2 text-[11px] font-bold text-ink-soft"
              >
                ساعت شروع
                <PersianTimeInput
                  id="valid-from-time"
                  aria-label="ساعت شروع اعتبار"
                  value={timePart(form.validFrom)}
                  onValueChange={(time) =>
                    update("validFrom", withTimePart(form.validFrom, time))
                  }
                  className="h-9 w-24 text-center tabular-nums"
                />
              </label>
            </div>

            <div className="space-y-2">
              <JalaliDateField
                label="تاریخ پایان اعتبار"
                ariaLabel="تاریخ پایان اعتبار"
                boxed
                value={datePart(form.validUntil)}
                min={datePart(form.validFrom)}
                onChange={(isoDate) =>
                  update("validUntil", withDatePart(form.validUntil, isoDate))
                }
              />
              <label
                htmlFor="valid-until-time"
                className="flex items-center gap-2 text-[11px] font-bold text-ink-soft"
              >
                ساعت پایان
                <PersianTimeInput
                  id="valid-until-time"
                  aria-label="ساعت پایان اعتبار"
                  value={timePart(form.validUntil)}
                  onValueChange={(time) =>
                    update("validUntil", withTimePart(form.validUntil, time))
                  }
                  className="h-9 w-24 text-center tabular-nums"
                />
              </label>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-paper px-3 py-3">
            <Checkbox
              checked={form.isActive}
              onCheckedChange={(checked) => update("isActive", checked === true)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-xs font-bold text-ink">کوپن فعال باشد</span>
              <span className="mt-0.5 block text-[11px] leading-5 text-ink-soft">
                کوپن غیرفعال در فهرست می‌ماند اما در پرداخت پذیرفته نمی‌شود.
              </span>
            </span>
          </label>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-xs leading-6">{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="gap-2 border-t border-line/70 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              انصراف
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {isSubmitting ? "در حال ساخت…" : "ساخت کوپن"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CouponsPanel({
  coupons,
  onCreated,
}: {
  coupons: AdminCoupon[]
  onCreated: (coupon: AdminCoupon) => void
}) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  // Snapshot the clock once when the panel mounts so expiry badges stay pure
  // during render; switching tabs remounts the panel and refreshes the value.
  const [now] = React.useState(() => Date.now())

  const handleCreated = (coupon: AdminCoupon) => {
    onCreated(coupon)
    setSuccessMessage(`کوپن «${coupon.code}» با موفقیت ساخته شد.`)
  }

  const activeCount = coupons.filter((coupon) => coupon.is_active).length

  return (
    <section aria-labelledby="admin-coupons-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="admin-coupons-title"
            className="text-lg font-black tracking-tight text-ink"
          >
            کوپن‌ها
          </h2>
          <p className="mt-1 text-xs leading-6 text-ink-soft">
            کدهای تخفیف، بازهٔ اعتبار و سقف استفاده را مدیریت کنید.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminStatusBadge tone="positive">
            <TicketPercent className="size-3.5" />
            {formatCount(activeCount)} فعال
          </AdminStatusBadge>
          <Button
            type="button"
            onClick={() => {
              setSuccessMessage(null)
              setIsCreateOpen(true)
            }}
            className="gap-2"
          >
            <Plus className="size-4" />
            کوپن جدید
          </Button>
        </div>
      </div>

      {successMessage ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-trust/25 bg-trust-soft/50 px-4 py-3 text-xs font-semibold text-trust">
          <CheckCircle2 className="size-4 shrink-0" />
          {successMessage}
        </div>
      ) : null}

      {coupons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong/70 bg-paper-card/60 px-4">
          <EmptyState
            icon={Tag}
            title="هنوز کوپنی ساخته نشده"
            description="اولین کد تخفیف را بسازید تا مهمانان بتوانند در پرداخت از آن استفاده کنند."
            action={
              <Button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="gap-2"
              >
                <Plus className="size-4" />
                ساخت کوپن
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-paper-card shadow-soft md:block">
            <table className="w-full text-right text-sm">
              <thead className="bg-paper-deep/55">
                <tr className="text-[11px] text-ink-soft">
                  <th scope="col" className="px-4 py-3 font-bold">
                    کد
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    تخفیف
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    حداقل رزرو
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    اعتبار
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    استفاده
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    وضعیت
                  </th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => {
                  const expired = new Date(coupon.valid_until).getTime() < now
                  return (
                    <tr
                      key={coupon.id}
                      className="border-t border-line/60 transition-colors hover:bg-paper-deep/25"
                    >
                      <td className="px-4 py-3.5">
                        <p dir="ltr" className="w-fit font-mono text-xs font-bold tracking-wider text-ink">
                          {coupon.code}
                        </p>
                        <p className="mt-1 text-[11px] text-ink-soft">
                          شناسهٔ {formatCount(coupon.id)}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs font-bold text-ink">
                          {couponDiscountLabel(coupon)}
                        </p>
                        {toAmount(coupon.max_discount_amount) > 0 ? (
                          <p className="mt-1 text-[11px] text-ink-soft">
                            سقف {formatToman(coupon.max_discount_amount)} تومان
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 text-xs tabular-nums text-ink-soft">
                        {toAmount(coupon.min_booking_amount) > 0
                          ? `${formatToman(coupon.min_booking_amount)} تومان`
                          : "بدون حداقل"}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-[11px] leading-6 text-ink-soft">
                          از {formatPersianDate(coupon.valid_from)}
                        </p>
                        <p className="text-[11px] leading-6 text-ink-soft">
                          تا {formatPersianDate(coupon.valid_until)}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs tabular-nums text-ink-soft">
                        {formatCount(coupon.used_count)}
                        {" / "}
                        {coupon.usage_limit
                          ? formatCount(coupon.usage_limit)
                          : "بدون سقف"}
                      </td>
                      <td className="px-4 py-3.5">
                        <AdminStatusBadge
                          tone={!coupon.is_active ? "neutral" : expired ? "danger" : "positive"}
                        >
                          {!coupon.is_active ? "غیرفعال" : expired ? "منقضی" : "فعال"}
                        </AdminStatusBadge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {coupons.map((coupon) => {
              const expired = new Date(coupon.valid_until).getTime() < now
              return (
                <div
                  key={coupon.id}
                  className="rounded-2xl border border-line bg-paper-card p-4 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p
                      dir="ltr"
                      className="w-fit font-mono text-sm font-black tracking-wider text-ink"
                    >
                      {coupon.code}
                    </p>
                    <AdminStatusBadge
                      tone={!coupon.is_active ? "neutral" : expired ? "danger" : "positive"}
                    >
                      {!coupon.is_active ? "غیرفعال" : expired ? "منقضی" : "فعال"}
                    </AdminStatusBadge>
                  </div>
                  <p className="mt-2 text-xs font-bold text-brick">
                    {couponDiscountLabel(coupon)}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line/60 pt-3 text-[11px]">
                    <div>
                      <p className="text-ink-soft">حداقل رزرو</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-ink">
                        {toAmount(coupon.min_booking_amount) > 0
                          ? `${formatToman(coupon.min_booking_amount)} تومان`
                          : "ندارد"}
                      </p>
                    </div>
                    <div>
                      <p className="text-ink-soft">استفاده</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-ink">
                        {formatCount(coupon.used_count)}
                        {" / "}
                        {coupon.usage_limit
                          ? formatCount(coupon.usage_limit)
                          : "بدون سقف"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-ink-soft">اعتبار</p>
                      <p className="mt-0.5 font-semibold text-ink">
                        {formatPersianDate(coupon.valid_from)} تا{" "}
                        {formatPersianDate(coupon.valid_until)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <CouponCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={handleCreated}
      />
    </section>
  )
}
