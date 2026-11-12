"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarDays,
  ChevronLeft,
  Moon,
  Users,
} from "lucide-react"
import { formatPersianDate } from "@/lib/format-fa"
import type { HostReservationRecord } from "./types"
import { formatFaNumber, formatToman } from "./host-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"

export type ReservationFilter =
  | "all"
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"

const FILTERS: { value: ReservationFilter; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "pending", label: "در انتظار" },
  { value: "confirmed", label: "تایید شده" },
  { value: "completed", label: "تکمیل شده" },
  { value: "cancelled", label: "لغو شده" },
]

const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "در انتظار",
    className: "border-gold/40 bg-gold-soft/80 text-ink",
  },
  confirmed: {
    label: "تایید شده",
    className: "border-trust/40 bg-trust/10 text-trust",
  },
  completed: {
    label: "تکمیل شده",
    className: "border-brick/30 bg-brick/10 text-brick",
  },
  cancelled: {
    label: "لغو شده",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
}

function ReservationStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    className: "border-line bg-paper-deep text-ink-soft",
  }

  return (
    <Badge
      variant="outline"
      className={cn("px-2.5 py-1 text-[10px] font-bold", meta.className)}
    >
      {meta.label}
    </Badge>
  )
}

function ReservationThumb({ reservation }: { reservation: HostReservationRecord }) {
  const [imageFailed, setImageFailed] = React.useState(false)

  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-line/70 bg-paper-deep">
      {reservation.accommodation_image && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={reservation.accommodation_image}
          alt={reservation.accommodation_title ?? "اقامتگاه"}
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-ink-soft/60">
          <CalendarDays className="size-5" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}

function stayLabel(reservation: HostReservationRecord): string {
  return `${formatPersianDate(reservation.check_in)} تا ${formatPersianDate(reservation.check_out)}`
}

export interface HostReservationsViewProps {
  reservations: HostReservationRecord[]
  isLoading?: boolean
  enableFilters?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
}

/**
 * Shared host reservations table/cards. The dashboard renders it unfiltered;
 * `/host/reservations` turns on the status tabs.
 */
export function HostReservationsView({
  reservations,
  isLoading = false,
  enableFilters = false,
  emptyTitle = "هنوز رزروی دریافت نکرده‌اید",
  emptyDescription = "به‌محض ثبت اولین رزرو، مهمان، تاریخ اقامت و مبلغ آن در این بخش نمایش داده می‌شود.",
  emptyAction,
}: HostReservationsViewProps) {
  const [filter, setFilter] = React.useState<ReservationFilter>("all")

  const counts = React.useMemo(() => {
    const result: Record<ReservationFilter, number> = {
      all: reservations.length,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    }
    for (const reservation of reservations) {
      if (reservation.status in result) {
        result[reservation.status as ReservationFilter] += 1
      }
    }
    return result
  }, [reservations])

  const visibleReservations = React.useMemo(
    () =>
      filter === "all"
        ? reservations
        : reservations.filter((reservation) => reservation.status === filter),
    [filter, reservations]
  )

  const isEmpty = visibleReservations.length === 0
  const isFilteredEmpty = isEmpty && reservations.length > 0

  return (
    <div className="space-y-4">
      {enableFilters ? (
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as ReservationFilter)}
        >
          <TabsList className="no-scrollbar flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-line/70 bg-paper-card p-1.5">
            {FILTERS.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="min-h-9 shrink-0 gap-1.5 rounded-xl px-3 text-xs font-bold text-ink-soft hover:text-ink data-[state=active]:bg-brick data-[state=active]:text-on-brick data-[state=active]:shadow-soft"
              >
                <span>{item.label}</span>
                <span className="rounded-full bg-paper-deep/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-ink-soft">
                  {formatFaNumber(counts[item.value])}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-24 w-full rounded-2xl border border-line/60 bg-paper-deep/70"
            />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={CalendarDays}
          title={isFilteredEmpty ? "رزروی با این وضعیت نیست" : emptyTitle}
          description={
            isFilteredEmpty
              ? "برای دیدن رزروهای دیگر، وضعیت دیگری را از نوار فیلتر انتخاب کنید."
              : emptyDescription
          }
          action={isFilteredEmpty ? undefined : emptyAction}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden rounded-2xl border-line/80 bg-paper-card shadow-soft md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-line/70 bg-paper-deep/35 text-[11px] font-bold text-ink-soft">
                    <th scope="col" className="px-4 py-3 font-bold">
                      اقامتگاه و مهمان
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      زمان اقامت
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      مبلغ کل
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      وضعیت
                    </th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">جزئیات</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReservations.map((reservation) => (
                    <tr
                      key={reservation.id}
                      className="border-b border-line/60 transition-colors last:border-0 hover:bg-paper-deep/25"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ReservationThumb reservation={reservation} />
                          <div className="min-w-0 space-y-1">
                            <Link
                              href={`/accommodations/${reservation.accommodation_id}`}
                              className="block max-w-[220px] truncate font-bold text-ink transition-colors hover:text-brick"
                            >
                              {reservation.accommodation_title ||
                                `اقامتگاه #${formatFaNumber(reservation.accommodation_id)}`}
                            </Link>
                            <p className="flex items-center gap-2 text-[11px] text-ink-soft">
                              <span className="flex items-center gap-1">
                                <Users className="size-3" aria-hidden="true" />
                                {formatFaNumber(reservation.guests_count)} مهمان
                              </span>
                              {reservation.city ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{reservation.city}</span>
                                </>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-ink">{stayLabel(reservation)}</p>
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-soft">
                          <Moon className="size-3" aria-hidden="true" />
                          {formatFaNumber(reservation.total_nights)} شب
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold tabular-nums text-ink">
                          {formatToman(reservation.total_price)}
                          <span className="mr-1 text-[10px] font-medium text-ink-soft">
                            تومان
                          </span>
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <ReservationStatusBadge status={reservation.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs text-ink-soft hover:text-brick"
                        >
                          <Link href={`/trips/${reservation.id}`}>
                            جزئیات
                            <ChevronLeft className="size-3.5" aria-hidden="true" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {visibleReservations.map((reservation) => (
              <Card
                key={reservation.id}
                className="rounded-2xl border-line/80 bg-paper-card p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ReservationThumb reservation={reservation} />
                    <div className="min-w-0 space-y-1">
                      <Link
                        href={`/accommodations/${reservation.accommodation_id}`}
                        className="block truncate text-sm font-black text-ink"
                      >
                        {reservation.accommodation_title ||
                          `اقامتگاه #${formatFaNumber(reservation.accommodation_id)}`}
                      </Link>
                      <p className="flex items-center gap-1 text-[11px] text-ink-soft">
                        <Users className="size-3" aria-hidden="true" />
                        {formatFaNumber(reservation.guests_count)} مهمان
                        {reservation.city ? ` · ${reservation.city}` : ""}
                      </p>
                    </div>
                  </div>
                  <ReservationStatusBadge status={reservation.status} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-paper-deep/45 p-3 text-xs">
                  <div className="space-y-1">
                    <p className="text-[10px] text-ink-soft">زمان اقامت</p>
                    <p className="text-ink">{stayLabel(reservation)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-ink-soft">مدت / مبلغ</p>
                    <p className="text-ink">
                      {formatFaNumber(reservation.total_nights)} شب ·{" "}
                      <span className="font-bold tabular-nums">
                        {formatToman(reservation.total_price)}
                      </span>{" "}
                      تومان
                    </p>
                  </div>
                </div>

                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full gap-1 border-line bg-paper text-ink hover:bg-paper-deep"
                >
                  <Link href={`/trips/${reservation.id}`}>
                    مشاهده جزئیات رزرو
                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
