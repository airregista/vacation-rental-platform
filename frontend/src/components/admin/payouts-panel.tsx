"use client"

import * as React from "react"
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Landmark,
  Loader2,
  Wallet,
} from "lucide-react"

import { apiClient, ApiError } from "@/lib/api-client"
import { formatPersianDate } from "@/lib/format-fa"
import type { AdminPayout } from "@/components/admin/types"
import { AdminStatusBadge } from "@/components/admin/status-badge"
import {
  PAYOUT_STATUS_LABELS,
  formatCount,
  formatToman,
  payoutStatusTone,
  payoutSummary,
  toAmount,
} from "@/components/admin/admin-utils"
import { EmptyState } from "@/components/shared/empty-state"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function settleErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (/shaba/i.test(error.detail)) {
      return "شمارهٔ شبای این میزبان ثبت نشده است. تا تکمیل اطلاعات بانکی، تسویه امکان‌پذیر نیست."
    }
    if (/check-in/i.test(error.detail)) {
      return "تاریخ ورود این رزرو هنوز فرا نرسیده است. تسویه پس از تاریخ ورود انجام می‌شود."
    }
    if (/already been completed/i.test(error.detail)) {
      return "این تسویه قبلاً انجام شده است."
    }
    if (/cancelled/i.test(error.detail)) {
      return "رزرو مرتبط لغو شده و مبلغی برای تسویه وجود ندارد."
    }
    return error.detail || "تسویه با خطا مواجه شد."
  }
  return "تسویه با خطا مواجه شد. اتصال شبکه را بررسی کنید."
}

export function PayoutsPanel({
  payouts,
  onSettled,
}: {
  payouts: AdminPayout[]
  onSettled: (payout: AdminPayout) => void
}) {
  const [selected, setSelected] = React.useState<AdminPayout | null>(null)
  const [isOpen, setIsOpen] = React.useState(false)
  const [isSettling, setIsSettling] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const totals = payoutSummary(payouts)

  const openSettle = (payout: AdminPayout) => {
    setSelected(payout)
    setError(null)
    setIsOpen(true)
  }

  const handleSettle = async () => {
    if (!selected) return
    setError(null)
    setIsSettling(true)
    try {
      const updated = await apiClient.post<AdminPayout>(
        `/payments/host/payouts/${selected.id}/settle`
      )
      onSettled(updated)
      setIsOpen(false)
      setSelected(null)
    } catch (err: unknown) {
      setError(settleErrorMessage(err))
    } finally {
      setIsSettling(false)
    }
  }

  return (
    <section aria-labelledby="admin-payouts-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="admin-payouts-title"
            className="text-lg font-black tracking-tight text-ink"
          >
            تسویه میزبانان
          </h2>
          <p className="mt-1 text-xs leading-6 text-ink-soft">
            ردیف‌های تسویه را بررسی کنید؛ پرداخت فقط پس از رسیدن تاریخ ورود و
            ثبت شبا انجام می‌شود.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminStatusBadge tone="warning">
            <Wallet className="size-3.5" />
            {formatCount(totals.pendingCount)} در انتظار
          </AdminStatusBadge>
          <AdminStatusBadge tone="positive">
            <Landmark className="size-3.5" />
            {formatToman(totals.pendingAmount)} تومان
          </AdminStatusBadge>
        </div>
      </div>

      {payouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong/70 bg-paper-card/60 px-4">
          <EmptyState
            icon={Banknote}
            title="هنوز تسویه‌ای ثبت نشده"
            description="پس از اولین پرداخت موفق مهمان، ردیف تسویهٔ میزبان در این فهرست ساخته می‌شود."
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-paper-card shadow-soft lg:block">
            <table className="w-full text-right text-sm">
              <thead className="bg-paper-deep/55">
                <tr className="text-[11px] text-ink-soft">
                  <th scope="col" className="px-4 py-3 font-bold">
                    تسویه
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    مبلغ رزرو
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    کارمزد
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    خالص قابل پرداخت
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    وضعیت
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    تاریخ
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    اقدام
                  </th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr
                    key={payout.id}
                    className="border-t border-line/60 transition-colors hover:bg-paper-deep/25"
                  >
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-bold text-ink">
                        تسویهٔ {formatCount(payout.id)}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-soft">
                        رزرو {formatCount(payout.reservation_id)} · میزبان{" "}
                        {formatCount(payout.host_id)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-xs tabular-nums text-ink-soft">
                      {formatToman(payout.total_booking_amount)}
                    </td>
                    <td className="px-4 py-3.5 text-xs tabular-nums text-ink-soft">
                      {formatToman(payout.commission_amount)}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-black tabular-nums text-ink">
                      {formatToman(payout.payout_amount)} تومان
                    </td>
                    <td className="px-4 py-3.5">
                      <AdminStatusBadge tone={payoutStatusTone(payout.status)}>
                        {PAYOUT_STATUS_LABELS[payout.status] ?? payout.status}
                      </AdminStatusBadge>
                    </td>
                    <td className="px-4 py-3.5 text-[11px] leading-6 text-ink-soft">
                      <p>ثبت: {formatPersianDate(payout.created_at)}</p>
                      {payout.paid_at ? (
                        <p className="text-trust">
                          پرداخت: {formatPersianDate(payout.paid_at)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      {payout.status === "pending" ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openSettle(payout)}
                          className="gap-1.5"
                        >
                          <CheckCircle2 className="size-3.5" />
                          تسویه
                        </Button>
                      ) : (
                        <span className="text-[11px] text-ink-soft">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {payouts.map((payout) => (
              <div
                key={payout.id}
                className="rounded-2xl border border-line bg-paper-card p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink">
                      تسویهٔ {formatCount(payout.id)}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      رزرو {formatCount(payout.reservation_id)} · میزبان{" "}
                      {formatCount(payout.host_id)}
                    </p>
                  </div>
                  <AdminStatusBadge tone={payoutStatusTone(payout.status)}>
                    {PAYOUT_STATUS_LABELS[payout.status] ?? payout.status}
                  </AdminStatusBadge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line/60 pt-3 text-[11px]">
                  <div>
                    <p className="text-ink-soft">مبلغ رزرو</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-ink">
                      {formatToman(payout.total_booking_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-soft">کارمزد</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-ink">
                      {formatToman(payout.commission_amount)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-ink-soft">خالص قابل پرداخت</p>
                    <p className="mt-0.5 text-sm font-black tabular-nums text-ink">
                      {formatToman(payout.payout_amount)} تومان
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-ink-soft">
                      ثبت: {formatPersianDate(payout.created_at)}
                    </p>
                    {payout.paid_at ? (
                      <p className="text-trust">
                        پرداخت: {formatPersianDate(payout.paid_at)}
                      </p>
                    ) : null}
                  </div>
                </div>

                {payout.status === "pending" ? (
                  <Button
                    type="button"
                    onClick={() => openSettle(payout)}
                    className="mt-3 w-full gap-2"
                  >
                    <CheckCircle2 className="size-4" />
                    تسویهٔ این ردیف
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog
        open={isOpen}
        onOpenChange={(next) => {
          if (!isSettling) setIsOpen(next)
        }}
      >
        <DialogContent className="border-line bg-paper-card text-ink">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">تأیید تسویهٔ میزبان</DialogTitle>
            <DialogDescription className="text-xs leading-6 text-ink-soft">
              این اقدام مبلغ خالص را به‌عنوان پرداخت‌شده ثبت می‌کند. پیش از تأیید،
              شمارهٔ شبا و تاریخ ورود رزرو را بررسی کنید.
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="rounded-xl border border-line bg-paper p-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-soft">میزبان</span>
                <span className="font-bold tabular-nums text-ink">
                  #{formatCount(selected.host_id)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-ink-soft">رزرو</span>
                <span className="font-bold tabular-nums text-ink">
                  #{formatCount(selected.reservation_id)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line/70 pt-3">
                <span className="font-bold text-ink">مبلغ خالص</span>
                <span className="text-sm font-black tabular-nums text-brick">
                  {formatToman(toAmount(selected.payout_amount))} تومان
                </span>
              </div>
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-xs leading-6">{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSettling}
            >
              انصراف
            </Button>
            <Button
              type="button"
              onClick={handleSettle}
              disabled={isSettling}
              className="gap-2"
            >
              {isSettling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {isSettling ? "در حال ثبت…" : "تأیید تسویه"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
