import { CalendarDays, MapPin, Users } from "lucide-react"

import { formatPersianDate } from "@/lib/format-fa"
import type { AdminReservation } from "@/components/admin/types"
import { AdminStatusBadge } from "@/components/admin/status-badge"
import {
  RESERVATION_STATUS_LABELS,
  formatCount,
  formatToman,
  reservationStatusTone,
} from "@/components/admin/admin-utils"
import { EmptyState } from "@/components/shared/empty-state"

function accommodationLabel(reservation: AdminReservation): string {
  return reservation.accommodation_title || `اقامتگاه ${formatCount(reservation.accommodation_id)}`
}

function locationLabel(reservation: AdminReservation): string | null {
  return [reservation.city, reservation.province].filter(Boolean).join("، ") || null
}

export function ReservationsPanel({ reservations }: { reservations: AdminReservation[] }) {
  return (
    <section aria-labelledby="admin-reservations-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="admin-reservations-title" className="text-lg font-black tracking-tight text-ink">
            رزروها
          </h2>
          <p className="mt-1 text-xs leading-6 text-ink-soft">
            همهٔ رزروهای ثبت‌شده؛ اقامتگاه، بازهٔ اقامت، مبلغ و وضعیت پرداخت.
          </p>
        </div>
        <AdminStatusBadge tone="neutral">
          <CalendarDays className="size-3.5" />
          {formatCount(reservations.length)} رزرو
        </AdminStatusBadge>
      </div>

      {reservations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong/70 bg-paper-card/60 px-4">
          <EmptyState
            icon={CalendarDays}
            title="هنوز رزروی ثبت نشده"
            description="با اولین رزرو مهمان، جزئیات اقامت و وضعیت پرداخت در این فهرست نمایش داده می‌شود."
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-paper-card shadow-soft md:block">
            <table className="w-full text-right text-sm">
              <thead className="bg-paper-deep/55">
                <tr className="text-[11px] text-ink-soft">
                  <th scope="col" className="px-4 py-3 font-bold">
                    اقامتگاه
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    مهمان
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    بازهٔ اقامت
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    مبلغ
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    وضعیت
                  </th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => {
                  const location = locationLabel(reservation)
                  return (
                    <tr
                      key={reservation.id}
                      className="border-t border-line/60 transition-colors hover:bg-paper-deep/25"
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-ink">{accommodationLabel(reservation)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-soft">
                          <span>رزرو {formatCount(reservation.id)}</span>
                          {location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              {location}
                            </span>
                          ) : null}
                          {reservation.coupon_code ? (
                            <span
                              dir="ltr"
                              className="rounded-full border border-line bg-paper px-2 py-0.5 font-mono font-semibold tracking-wider text-ink-soft"
                            >
                              {reservation.coupon_code}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs font-semibold tabular-nums text-ink">
                          کاربر #{formatCount(reservation.user_id)}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-soft">
                          <Users className="size-3" />
                          {formatCount(reservation.guests_count)} مهمان ·{" "}
                          {formatCount(reservation.total_nights)} شب
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-[11px] leading-6 text-ink-soft">
                        <p>ورود: {formatPersianDate(reservation.check_in)}</p>
                        <p>خروج: {formatPersianDate(reservation.check_out)}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs font-black tabular-nums text-ink">
                          {formatToman(reservation.total_price)} تومان
                        </p>
                        <p className="mt-1 text-[11px] text-ink-soft">
                          ثبت: {formatPersianDate(reservation.created_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <AdminStatusBadge tone={reservationStatusTone(reservation.status)}>
                          {RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status}
                        </AdminStatusBadge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {reservations.map((reservation) => {
              const location = locationLabel(reservation)
              return (
                <div
                  key={reservation.id}
                  className="rounded-2xl border border-line bg-paper-card p-4 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-ink">
                        {accommodationLabel(reservation)}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-soft">
                        رزرو {formatCount(reservation.id)}
                        {location ? ` · ${location}` : ""}
                      </p>
                    </div>
                    <AdminStatusBadge tone={reservationStatusTone(reservation.status)}>
                      {RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status}
                    </AdminStatusBadge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line/60 pt-3 text-[11px]">
                    <div>
                      <p className="text-ink-soft">مهمان</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-ink">
                        کاربر #{formatCount(reservation.user_id)}
                      </p>
                      <p className="mt-0.5 text-ink-soft">
                        {formatCount(reservation.guests_count)} نفر ·{" "}
                        {formatCount(reservation.total_nights)} شب
                      </p>
                    </div>
                    <div>
                      <p className="text-ink-soft">مبلغ کل</p>
                      <p className="mt-0.5 font-black tabular-nums text-ink">
                        {formatToman(reservation.total_price)} تومان
                      </p>
                    </div>
                    <div className="col-span-2 border-t border-line/50 pt-2">
                      <p className="text-ink-soft">
                        ورود: {formatPersianDate(reservation.check_in)}
                      </p>
                      <p className="text-ink-soft">
                        خروج: {formatPersianDate(reservation.check_out)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
