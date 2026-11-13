"use client"

import * as React from "react"
import { Printer, ShieldCheck, Building, User } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatPersianDate, toPersianDigits } from "@/lib/format-fa"
import {
  type InvoiceModalProps,
  computeCheckoutBreakdown,
  formatFaPrice,
  getPersianYear,
} from "@/types/checkout"

function formatFaNumber(num: number | string | null | undefined): string {
  return formatFaPrice(num)
}

function formatPersianLongDate(dateStr?: string): string {
  if (!dateStr) return "-"
  try {
    const isoStr = dateStr.includes("T")
      ? dateStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateStr)
        ? dateStr
        : `${dateStr}Z`
      : `${dateStr}T00:00:00Z`
    const d = new Date(isoStr)
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(d)
  } catch {
    return dateStr
  }
}

export function InvoiceModal({ isOpen, onClose, data }: InvoiceModalProps) {
  const handlePrint = () => {
    window.print()
  }

  const reservation = data.reservation
  const accommodation = data.accommodation
  const payment = data.payment
  const guest = data.guest

  const { totalPayable, cleaningFee, baseTotal, discountAmount } = computeCheckoutBreakdown(
    reservation,
    accommodation,
    payment.amount,
  )

  const solarYear = getPersianYear(data.issuance_date || payment.paid_at)
  const invoiceNumber = toPersianDigits(
    data.invoice_number || `INV-${solarYear}-${reservation.id.toString().padStart(5, "0")}`,
  )
  const reservationCode = toPersianDigits(`MHM-${reservation.id.toString().padStart(5, "0")}`)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="printable-dialog-content max-h-[95vh] max-w-4xl overflow-y-auto rounded-3xl border-line bg-paper p-4 sm:p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>فاکتور رسمی الکترونیک آشیانک</DialogTitle>
          <DialogDescription>صورت‌حساب رسمی خدمات اقامتی و گردشگری</DialogDescription>
        </DialogHeader>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm 12mm;
              }
              body * {
                visibility: hidden;
              }
              html, body {
                overflow: visible !important;
                height: auto !important;
                background: white !important;
                color: black !important;
              }
              .printable-dialog-content,
              .printable-dialog-content * {
                visibility: visible;
              }
              .printable-dialog-content {
                position: absolute !important;
                inset: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                max-height: none !important;
                overflow: visible !important;
                transform: none !important;
                translate: none !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              [data-radix-portal] > div:first-child {
                display: none !important;
              }
              .print-hide {
                display: none !important;
              }
              .printable-dialog-content > button {
                display: none !important;
              }
              .printable-invoice-card {
                color-scheme: light !important;
                background-color: white !important;
                color: black !important;
                border: 1.5px solid var(--line) !important;
                padding: 16px !important;
                width: 100% !important;
                max-height: none !important;
                overflow: visible !important;
                box-shadow: none !important;
              }
            }
          `,
          }}
        />

        {/* Top Action Bar (hidden in print) */}
        <div className="print-hide flex items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handlePrint}
              className="h-10 gap-2 px-4 text-xs font-bold sm:text-sm"
            >
              <Printer className="size-4" />
              چاپ فاکتور رسمی (A4)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 border-line bg-paper-card px-4 text-xs text-ink shadow-none hover:bg-paper"
            >
              بستن
            </Button>
          </div>

          <Badge
            variant="outline"
            className="border-line bg-paper-card px-2.5 py-1 text-xs text-ink-soft"
          >
            فاکتور رسمی الکترونیک
          </Badge>
        </div>

        {/* Printable Invoice Container */}
        <div className="printable-invoice-card print-paper space-y-6 rounded-2xl border border-line bg-paper-card p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-col justify-between gap-4 border-b-2 border-brick/20 pb-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-brick text-xl font-black text-on-brick shadow-soft">
                آ
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-ink sm:text-xl">
                  سامانه رزرو اقامتگاه آشیانک
                </h1>
                <p className="mt-0.5 text-xs text-ink-soft">
                  صورت‌حساب رسمی الکترونیکی خدمات اقامتی و گردشگری
                </p>
              </div>
            </div>

            <div className="space-y-1 text-left text-xs font-medium text-ink-soft sm:self-end">
              <div>
                <span>شماره صورت‌حساب: </span>
                <span className="font-mono text-sm font-bold tabular-nums text-ink">
                  {invoiceNumber}
                </span>
              </div>
              <div>
                <span>تاریخ صدور: </span>
                <span className="tabular-nums text-ink">
                  {formatPersianLongDate(
                    data.issuance_date || payment.paid_at || new Date().toISOString(),
                  )}
                </span>
              </div>
              <div>
                <span>کد پیگیری شاپرک: </span>
                <span dir="ltr" className="font-mono font-bold tabular-nums text-ink">
                  {toPersianDigits(payment.tracking_code || "-")}
                </span>
              </div>
            </div>
          </div>

          {/* Traceability Metadata Bar */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line/60 bg-paper-deep/50 p-3 text-xs sm:grid-cols-4">
            <div className="space-y-0.5">
              <span className="block text-[11px] text-ink-soft">شماره رزرو آشیانک:</span>
              <span className="font-mono font-bold tabular-nums text-brick">{reservationCode}</span>
            </div>
            <div className="space-y-0.5">
              <span className="block text-[11px] text-ink-soft">شماره تراکنش پرداخت:</span>
              <span className="font-mono font-medium tabular-nums text-ink">
                {toPersianDigits(payment.id)}
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="block text-[11px] text-ink-soft">وضعیت پرداخت:</span>
              <span className="font-bold text-trust">موفق و تسویه‌شده</span>
            </div>
            <div className="space-y-0.5">
              <span className="block text-[11px] text-ink-soft">درگاه پرداخت:</span>
              <span className="font-medium text-ink">شاپرک (به‌پرداخت / سامان)</span>
            </div>
          </div>

          {/* Two-Column Contracting Parties Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Seller */}
            <div className="border border-border/80 rounded-xl p-3.5 space-y-2 text-xs bg-card">
              <div className="flex items-center gap-1.5 font-bold text-sm text-foreground border-b pb-2">
                <Building className="size-4 text-primary" />
                <span>مشخصات ارائه‌دهنده خدمت و کارمزد (فروشنده)</span>
              </div>
              <div className="space-y-1 text-muted-foreground">
                <p>
                  <strong className="text-foreground">نام شخص حقوقی: </strong>
                  شرکت توسعه فناوری گردشگری آشیانک (سهامی خاص)
                </p>
                <p>
                  <strong className="text-foreground">شناسه ملی: </strong>
                  <span className="font-mono">۱۰۱۰۳۸۵۹۲۳۱</span>
                </p>
                <p>
                  <strong className="text-foreground">شماره ثبت: </strong>
                  <span className="font-mono">۴۹۲۸۱۶</span>
                </p>
                <p>
                  <strong className="text-foreground">نشانی: </strong>
                  تهران، سعادت‌آباد، میدان کاج، بلوار سرو غربی، شماره ۳۵
                </p>
                <p>
                  <strong className="text-foreground">کد پستی: </strong>
                  <span className="font-mono">۱۹۹۷۶۱۴۸۲۱</span>
                </p>
              </div>
            </div>

            {/* Buyer */}
            <div className="border border-border/80 rounded-xl p-3.5 space-y-2 text-xs bg-card">
              <div className="flex items-center gap-1.5 font-bold text-sm text-foreground border-b pb-2">
                <User className="size-4 text-secondary-foreground" />
                <span>مشخصات دریافت‌کننده خدمت (خریدار / مهمان)</span>
              </div>
              <div className="space-y-1 text-muted-foreground">
                <p>
                  <strong className="text-foreground">نام و نام خانوادگی: </strong>
                  <span>{guest?.full_name || "-"}</span>
                </p>
                <p>
                  <strong className="text-foreground">شماره تماس: </strong>
                  <span className="font-mono">{toPersianDigits(guest?.phone || "-")}</span>
                </p>
                <p>
                  <strong className="text-foreground">کد ملی: </strong>
                  <span className="font-mono">{toPersianDigits(guest?.national_code || "-")}</span>
                </p>
                <p>
                  <strong className="text-foreground">پست الکترونیکی: </strong>
                  <span className="font-mono">{guest?.email || "-"}</span>
                </p>
                <p>
                  <strong className="text-foreground">تعداد مهمانان: </strong>
                  <span>{formatFaNumber(reservation.guests_count)} نفر</span>
                </p>
              </div>
            </div>
          </div>

          {/* Itemized Accounting Table */}
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full text-right text-xs">
              <thead className="bg-muted/70 text-foreground font-bold border-b border-border/80">
                <tr>
                  <th className="p-3 w-10 text-center">ردیف</th>
                  <th className="p-3">شرح کالا یا خدمت</th>
                  <th className="p-3 text-center">تعداد / مدت</th>
                  <th className="p-3 text-left">مبلغ واحد (تومان)</th>
                  <th className="p-3 text-left">مبلغ کل (تومان)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {/* Row 1: Stay */}
                <tr>
                  <td className="p-3 text-center font-mono">۱</td>
                  <td className="p-3">
                    <span className="font-bold text-foreground">
                      اقامت در{" "}
                      {accommodation?.title || reservation.accommodation_title || "اقامتگاه"}
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      از تاریخ {formatPersianDate(reservation.check_in)} لغایت{" "}
                      {formatPersianDate(reservation.check_out)}
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono font-medium">
                    {formatFaNumber(reservation.total_nights)} شب
                  </td>
                  <td className="p-3 text-left font-mono">
                    {accommodation?.base_price ? formatFaNumber(accommodation.base_price) : "-"}
                  </td>
                  <td className="p-3 text-left font-mono font-bold text-foreground">
                    {formatFaNumber(baseTotal)}
                  </td>
                </tr>

                {/* Row 2: Cleaning Fee */}
                {cleaningFee > 0 && (
                  <tr>
                    <td className="p-3 text-center font-mono">۲</td>
                    <td className="p-3">
                      <span className="font-medium text-foreground">
                        خدمات نظافت، ضدعفونی و پشتیبانی میزبانی
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono">۱ سرویس</td>
                    <td className="p-3 text-left font-mono">{formatFaNumber(cleaningFee)}</td>
                    <td className="p-3 text-left font-mono font-bold text-foreground">
                      {formatFaNumber(cleaningFee)}
                    </td>
                  </tr>
                )}

                {/* Row 3: Coupon Discount */}
                {reservation.coupon_code && discountAmount > 0 && (
                  <tr className="bg-trust/10 text-trust">
                    <td className="p-3 text-center font-mono">{cleaningFee > 0 ? "۳" : "۲"}</td>
                    <td className="p-3">
                      <span className="font-medium">
                        تخفیف ویژه کد تبلیغاتی ({reservation.coupon_code})
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono">۱</td>
                    <td className="p-3 text-left font-mono">-</td>
                    <td className="p-3 text-left font-mono font-bold">
                      - {formatFaNumber(discountAmount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Ledger Summary and Net Payable */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border/80">
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheck className="size-4 text-trust" />
                مالیات بر ارزش افزوده و کلیه عوارض قانونی خدمات پلتفرم در مبالغ فوق محاسبه شده است.
              </p>
              <p className="text-[11px]">
                این فاکتور دارای شناسه رهگیری یکتای مودیان مالیاتی و فاقد نیاز به مهر دستی می‌باشد.
              </p>
            </div>

            <div className="sm:text-left self-stretch sm:self-auto border-t sm:border-t-0 pt-2 sm:pt-0">
              <span className="text-xs text-muted-foreground block">مجموع پرداخت نهایی:</span>
              <div className="text-primary font-black font-mono text-xl sm:text-2xl mt-0.5">
                {formatFaNumber(totalPayable)} <span className="text-sm font-normal">تومان</span>
              </div>
            </div>
          </div>

          {/* Official Seals and Digital Signatures Footer */}
          <div className="pt-4 border-t-2 border-border/70 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="border border-border/70 rounded-xl p-3 text-center space-y-2 bg-card">
              <span className="font-bold block text-foreground">
                مهر و امضای دیجیتال سامانه مودیان و آشیانک
              </span>
              <div className="size-14 mx-auto rounded-full border-2 border-dashed border-trust/60 flex items-center justify-center text-trust font-bold text-[10px] leading-tight p-1">
                تایید مالیاتی سامانه
              </div>
              <span className="text-[10px] text-muted-foreground block font-mono">
                SIGN-SHA256 (نمونه): 4f8a...9c12
              </span>
            </div>

            <div className="border border-border/70 rounded-xl p-3 text-center space-y-2 bg-card">
              <span className="font-bold block text-foreground">رسید تحویل خدمات به مهمان</span>
              <div className="h-14 flex items-center justify-center text-muted-foreground/80 text-[11px]">
                تاییدیه الکترونیکی با ثبت ورود به اقامتگاه
              </div>
              <span className="text-[10px] text-muted-foreground block font-mono">
                AUTH: OK-{payment.tracking_code || "VERIFIED"}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
