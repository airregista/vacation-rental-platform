"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  Bed,
  Building2,
  CalendarDays,
  CheckCircle2,
  DoorClosed,
  Eye,
  ExternalLink,
  ImagePlus,
  MapPin,
  Pencil,
  Star,
  Users,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import type { HostAccommodationDetail, HostImageRecord } from "@/components/host/types"
import { HostAccessGate } from "@/components/host/host-access-gate"
import { HostPageLayout } from "@/components/host/host-page-layout"
import {
  formatFaNumber,
  formatTimeFa,
  formatToman,
  getApiErrorMessage,
  sortHostImages,
} from "@/components/host/host-utils"
import { AmenitiesList } from "@/components/accommodation/amenities-list"
import { HostCard } from "@/components/accommodation/host-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface PreviewListingPageProps {
  params: Promise<{ id: string }>
}

function PreviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-10 w-2/3 max-w-md rounded-xl" />
      <Skeleton className="h-[320px] w-full rounded-2xl sm:h-[420px]" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <div className="lg:col-span-5">
          <Skeleton className="h-80 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  )
}

function ListingGallery({
  images,
  title,
}: {
  images: HostImageRecord[]
  title: string
}) {
  const [brokenIds, setBrokenIds] = React.useState<Set<number>>(new Set())

  const ordered = sortHostImages(images)
  const visible = ordered.filter((image) => !brokenIds.has(image.id))

  if (visible.length === 0) {
    return (
      <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-paper-deep/35 text-ink-soft">
        <ImagePlus className="size-8" aria-hidden="true" />
        <span className="text-xs font-medium">
          هنوز تصویری برای این اقامتگاه ثبت نشده است
        </span>
      </div>
    )
  }

  const [cover, ...rest] = visible
  const thumbnails = rest.slice(0, 4)

  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-line/80 bg-paper-deep shadow-soft">
        {/* Hosts can paste arbitrary external image URLs; next/image needs a
            per-domain allowlist, so the preview uses plain img elements. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover.image_url}
          alt={title}
          onError={() =>
            setBrokenIds((current) => new Set(current).add(cover.id))
          }
          className="h-full w-full object-cover"
        />
        {cover.is_cover ? (
          <Badge
            variant="outline"
            className="absolute right-3 top-3 border-gold/40 bg-gold-soft/90 text-[10px] font-bold text-ink backdrop-blur"
          >
            تصویر اصلی
          </Badge>
        ) : null}
      </div>

      {thumbnails.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {thumbnails.map((image) => (
            <div
              key={image.id}
              className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line/70 bg-paper-deep"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.image_url}
                alt={`${title} — تصویر ${formatFaNumber(image.sort_order + 1)}`}
                onError={() =>
                  setBrokenIds((current) => new Set(current).add(image.id))
                }
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function PreviewListingContent({ listingId }: { listingId: number }) {
  const { user, isAdmin } = useAuth()

  const [data, setData] = React.useState<HostAccommodationDetail | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let isCurrent = true

    const loadListing = async () => {
      try {
        const detail = await apiClient.get<HostAccommodationDetail>(
          `/accommodations/${listingId}`
        )
        if (!isCurrent) return
        setData(detail)
        setLoadError(null)
        setIsNotFound(false)
      } catch (error: unknown) {
        if (!isCurrent) return
        if (error instanceof ApiError && error.status === 404) {
          setIsNotFound(true)
        } else {
          setLoadError(
            getApiErrorMessage(error, "بارگذاری پیش‌نمایش اقامتگاه با خطا مواجه شد.")
          )
        }
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void loadListing()
    return () => {
      isCurrent = false
    }
  }, [listingId, reloadKey])

  const isOwner = Boolean(data && (isAdmin || data.host_id === user?.id))

  const handleRetry = () => {
    setIsLoading(true)
    setLoadError(null)
    setIsNotFound(false)
    setReloadKey((key) => key + 1)
  }

  if (isLoading) return <PreviewSkeleton />

  if (isNotFound) {
    return (
      <EmptyState
        icon={Building2}
        title="اقامتگاه مورد نظر پیدا نشد"
        description="این اقامتگاه حذف شده یا شناسه آن معتبر نیست."
        action={
          <Button asChild>
            <Link href="/host/listings">بازگشت به اقامتگاه‌های من</Link>
          </Button>
        }
      />
    )
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>بارگذاری انجام نشد</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{loadError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="border-line bg-transparent"
          >
            تلاش مجدد
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (data && !isOwner) {
    return (
      <EmptyState
        icon={Building2}
        title="این اقامتگاه متعلق به شما نیست"
        description="پیش‌نمایش میزبان فقط برای صاحب اقامتگاه یا مدیر سامانه در دسترس است."
        action={
          <Button asChild variant="outline" className="border-line bg-transparent">
            <Link href="/host/listings">بازگشت به اقامتگاه‌های من</Link>
          </Button>
        }
      />
    )
  }

  if (!data) return <PreviewSkeleton />

  const cityLabel = data.city?.name
    ? `${data.city.name}${data.city.province?.name ? `، ${data.city.province.name}` : ""}`
    : "شهر ثبت نشده"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-gold/40 bg-gold-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold">
            <Eye className="size-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-black text-ink">
              پیش‌نمایش میزبان
              <Badge
                variant="outline"
                className={
                  data.is_active
                    ? "border-trust/40 bg-trust/10 text-trust"
                    : "border-gold/40 bg-gold-soft/90 text-ink"
                }
              >
                {data.is_active ? "فعال و منتشرشده" : "غیرفعال"}
              </Badge>
            </div>
            <p className="text-[11px] leading-5 text-ink-soft">
              این صفحه فقط برای شماست و همان چیزی را نشان می‌دهد که مهمان در صفحه
              عمومی اقامتگاه می‌بیند.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5 border-line bg-paper-card">
            <Link href={`/host/listings/${listingId}/edit`}>
              <Pencil className="size-4" aria-hidden="true" />
              <span>ویرایش</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link href={`/accommodations/${listingId}`}>
              <ExternalLink className="size-4" aria-hidden="true" />
              <span>صفحه عمومی</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick">
          <span aria-hidden="true" className="h-px w-8 bg-brick/45" />
          {data.category?.title ?? "اقامتگاه بومی"}
        </p>
        <h2 className="text-balance text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {data.title}
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-soft">
          <span className="flex items-center gap-1">
            <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />
            {data.average_rating !== null ? (
              <>
                <span className="font-semibold tabular-nums text-ink">
                  {new Intl.NumberFormat("fa-IR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }).format(data.average_rating)}
                </span>
                <span>({formatFaNumber(data.reviews_count)} نظر)</span>
              </>
            ) : (
              <span>بدون امتیاز</span>
            )}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5 text-brick" aria-hidden="true" />
            {data.address} · {cityLabel}
          </span>
        </div>
      </div>

      <ListingGallery key={data.id} images={data.images} title={data.title} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-6 lg:col-span-7">
          {data.description ? (
            <section className="space-y-3 rounded-2xl border border-line/80 bg-paper-card p-5 shadow-soft">
              <p className="flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick">
                <span aria-hidden="true" className="h-px w-8 bg-brick/45" />
                درباره اقامتگاه
              </p>
              <h3 className="text-lg font-black text-ink">خانه را بشناسید</h3>
              <p className="whitespace-pre-line text-sm leading-8 text-ink-soft">
                {data.description}
              </p>
            </section>
          ) : null}

          <section className="grid grid-cols-3 gap-3 rounded-2xl border border-line bg-paper-card p-4 text-center shadow-soft">
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-line/60 bg-paper p-3">
              <DoorClosed className="size-5 text-brick" aria-hidden="true" />
              <span className="text-xs font-bold tabular-nums text-ink">
                {formatFaNumber(data.rooms_count)} اتاق
              </span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-line/60 bg-paper p-3">
              <Bed className="size-5 text-brick" aria-hidden="true" />
              <span className="text-xs font-bold tabular-nums text-ink">
                {formatFaNumber(data.beds_count)} تخت
              </span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-line/60 bg-paper p-3">
              <Users className="size-5 text-brick" aria-hidden="true" />
              <span className="text-xs font-bold tabular-nums text-ink">
                تا {formatFaNumber(data.max_capacity)} مهمان
              </span>
            </div>
          </section>

          <AmenitiesList
            amenities={data.amenities}
            customAmenities={data.custom_amenities ?? []}
          />

          <HostCard
            host={data.host}
            checkInTime={data.check_in_time}
            checkOutTime={data.check_out_time}
            cancellationPolicy={data.cancellation_policy}
            cancellationFreeHours={data.cancellation_free_hours}
            cancellationPenaltyPercent={data.cancellation_penalty_percent}
            rules={data.rules}
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-5">
          <div className="rounded-3xl border border-line/80 bg-paper-card p-5 shadow-lift">
            <p className="text-xs font-bold tracking-wide text-ink-soft">
              نرخ اقامت
            </p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-black tabular-nums text-brick">
                {formatToman(data.base_price)}
              </span>
              <span className="text-xs font-medium text-ink-soft">تومان / شب</span>
            </p>

            <dl className="mt-4 space-y-2 border-t border-line/70 pt-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-soft">هزینه نظافت</dt>
                <dd className="font-bold tabular-nums text-ink">
                  {formatToman(data.cleaning_fee)} تومان
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-soft">حداقل اقامت</dt>
                <dd className="font-bold tabular-nums text-ink">
                  {formatFaNumber(data.min_nights)} شب
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-soft">ظرفیت پایه</dt>
                <dd className="font-bold tabular-nums text-ink">
                  {formatFaNumber(data.capacity)} مهمان
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-soft">ساعت ورود / خروج</dt>
                <dd className="font-bold tabular-nums text-ink">
                  {formatTimeFa(data.check_in_time)} / {formatTimeFa(data.check_out_time)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 space-y-2 border-t border-line/70 pt-4">
              <Button asChild className="w-full gap-2">
                <Link href={`/accommodations/${listingId}`}>
                  <ExternalLink className="size-4" aria-hidden="true" />
                  <span>مشاهده صفحه عمومی</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full gap-2 border-line bg-transparent"
              >
                <Link href={`/host/listings/${listingId}/calendar`}>
                  <CalendarDays className="size-4" aria-hidden="true" />
                  <span>مدیریت تقویم و قیمت</span>
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-trust/30 bg-trust/10 p-4">
            <p className="flex items-center gap-2 text-xs font-bold text-trust">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              پیش‌نمایش فقط برای میزبان
            </p>
            <p className="mt-1.5 text-[11px] leading-6 text-ink-soft">
              مهمان‌ها این صفحه را نمی‌بینند. برای انتشار تغییرات، از صفحه ویرایش
              اقامتگاه استفاده کنید. در صورت غیرفعال بودن اقامتگاه، صفحه عمومی برای
              مهمان‌ها در دسترس نیست.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default function PreviewListingPage({ params }: PreviewListingPageProps) {
  const resolvedParams = React.use(params)
  const listingId = Number(resolvedParams.id)
  const isInvalidId =
    !listingId || Number.isNaN(listingId) || !Number.isInteger(listingId) || listingId <= 0

  return (
    <HostPageLayout
      eyebrow="میزبانی"
      title="پیش‌نمایش اقامتگاه"
      description="نمای مهمان را ببینید و پیش از انتشار، اطلاعات و تصاویر را بررسی کنید."
      backHref="/host/listings"
      backLabel="بازگشت به اقامتگاه‌های من"
      contentClassName="max-w-6xl"
    >
      {isInvalidId ? (
        <EmptyState
          icon={Building2}
          title="اقامتگاه مورد نظر پیدا نشد"
          description="شناسه اقامتگاه معتبر نیست. از فهرست اقامتگاه‌ها یک مورد را انتخاب کنید."
          action={
            <Button asChild>
              <Link href="/host/listings">فهرست اقامتگاه‌ها</Link>
            </Button>
          }
        />
      ) : (
        <HostAccessGate
          title="پیش‌نمایش اقامتگاه"
          description="برای دیدن پیش‌نمایش اقامتگاه، وارد حساب میزبان خود شوید."
        >
          <PreviewListingContent listingId={listingId} />
        </HostAccessGate>
      )}
    </HostPageLayout>
  )
}
