"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarDays,
  Compass,
  Eye,
  MapPin,
  Pencil,
  Power,
  PowerOff,
  Star,
  Trash2,
  Users,
} from "lucide-react"
import type { HostListingRecord } from "./types"
import { formatFaNumber, formatToman } from "./host-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function ListingStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 px-2.5 py-1 text-[10px] font-bold shadow-soft backdrop-blur",
        isActive
          ? "border-trust/40 bg-trust/10 text-trust"
          : "border-gold/40 bg-gold-soft/90 text-ink"
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", isActive ? "bg-trust" : "bg-gold")}
      />
      {isActive ? "فعال و منتشرشده" : "غیرفعال — در انتظار انتشار"}
    </Badge>
  )
}

export interface HostListingCardProps {
  listing: HostListingRecord
  mode?: "manage" | "compact"
  isBusy?: boolean
  onQuickCalendar?: (listing: HostListingRecord) => void
  onToggleActive?: (listing: HostListingRecord) => void
  onDelete?: (listing: HostListingRecord) => void
}

export function HostListingCard({
  listing,
  mode = "manage",
  isBusy = false,
  onQuickCalendar,
  onToggleActive,
  onDelete,
}: HostListingCardProps) {
  const [imageFailed, setImageFailed] = React.useState(false)
  const showImage = Boolean(listing.cover_image) && !imageFailed

  const cityLabel = listing.city?.name
    ? `${listing.city.name}${listing.city.province?.name ? `، ${listing.city.province.name}` : ""}`
    : "شهر ثبت نشده"

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper-card shadow-soft transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-lift">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-paper-deep">
        {showImage ? (
          // Hosts can paste arbitrary external image URLs; next/image needs a
          // per-domain allowlist, so this card uses a plain img like the
          // previous host dashboard did.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.cover_image ?? ""}
            alt={listing.title}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-soft/70">
            <Compass className="size-8" aria-hidden="true" />
            <span className="text-xs font-medium">بدون تصویر</span>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <ListingStatusBadge isActive={listing.is_active} />
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-paper/90 px-2 py-1 text-[10px] font-bold text-ink shadow-soft backdrop-blur">
            <Star className="size-3 fill-gold text-gold" aria-hidden="true" />
            {listing.average_rating !== null
              ? new Intl.NumberFormat("fa-IR", {
                  maximumFractionDigits: 1,
                }).format(listing.average_rating)
              : "بدون امتیاز"}
          </span>
        </div>

        {listing.category?.title ? (
          <span className="absolute bottom-3 right-3 rounded-full border border-line/80 bg-paper/90 px-2.5 py-1 text-[10px] font-semibold text-ink backdrop-blur">
            {listing.category.title}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1.5">
          <h3 className="truncate text-base font-black text-ink transition-colors group-hover:text-brick">
            {listing.title}
          </h3>
          <p className="flex items-center gap-1 text-xs text-ink-soft">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{cityLabel}</span>
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl bg-paper-deep/55 px-3 py-2">
          <p className="text-xs text-ink-soft">
            <span className="text-base font-black tabular-nums text-brick">
              {formatToman(listing.base_price)}
            </span>{" "}
            تومان / شب
          </p>
          <span className="flex items-center gap-1 text-[11px] text-ink-soft">
            <Users className="size-3.5" aria-hidden="true" />
            تا {formatFaNumber(listing.max_capacity)} مهمان
          </span>
        </div>

        {mode === "manage" ? (
          <div className="mt-auto space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="gap-1.5 border-line bg-paper text-ink hover:bg-paper-deep"
              >
                <Link href={`/host/listings/${listing.id}/edit`}>
                  <Pencil className="size-3.5" aria-hidden="true" />
                  ویرایش
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="gap-1.5 border-line bg-paper text-ink hover:bg-paper-deep"
              >
                <Link href={`/host/listings/${listing.id}/calendar`}>
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  تقویم
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="gap-1.5 border-line bg-paper text-ink hover:bg-paper-deep"
              >
                <Link href={`/host/listings/${listing.id}/preview`}>
                  <Eye className="size-3.5" aria-hidden="true" />
                  پیش‌نمایش
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={() => onToggleActive?.(listing)}
                className={cn(
                  "gap-1.5 border-line bg-paper hover:bg-paper-deep",
                  listing.is_active ? "text-ink" : "text-trust"
                )}
              >
                {listing.is_active ? (
                  <PowerOff className="size-3.5" aria-hidden="true" />
                ) : (
                  <Power className="size-3.5" aria-hidden="true" />
                )}
                {listing.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isBusy}
                onClick={() => onDelete?.(listing)}
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                حذف
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-auto flex gap-2">
            {onQuickCalendar ? (
              <Button
                type="button"
                size="sm"
                onClick={() => onQuickCalendar(listing)}
                className="flex-1 gap-1.5"
              >
                <CalendarDays className="size-3.5" aria-hidden="true" />
                تقویم سریع
              </Button>
            ) : null}
            <Button
              asChild
              size="sm"
              variant="outline"
              className="flex-1 border-line bg-paper text-ink hover:bg-paper-deep"
            >
              <Link href="/host/listings">مدیریت</Link>
            </Button>
          </div>
        )}
      </div>
    </article>
  )
}
