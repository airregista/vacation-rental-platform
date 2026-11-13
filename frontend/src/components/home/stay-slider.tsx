"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, MapPin, Star } from "lucide-react"
import { SectionHeading } from "@/components/layout/section-heading"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api-client"
import type { AccommodationListItem } from "@/types/accommodation"

const FALLBACK_IMAGES = [
  "/prototype/kashan-interior.jpg",
  "/prototype/masouleh.jpg",
  "/prototype/desert.jpg",
  "/prototype/coast.jpg",
  "/prototype/courtyard.jpg",
]

type Stay = {
  id: number
  title: string
  location: string
  price: string
  rating: string | null
  meta: string
  tag: string
  image: string
  fallback: string
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("fa-IR").format(Number(value) || 0)
}

function toStay(item: AccommodationListItem, index: number): Stay {
  const rating =
    item.average_rating && item.average_rating > 0
      ? new Intl.NumberFormat("fa-IR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(item.average_rating)
      : null

  const meta = [
    `${new Intl.NumberFormat("fa-IR").format(item.max_capacity || item.capacity || 1)} مهمان`,
    item.rooms_count > 0 ? `${new Intl.NumberFormat("fa-IR").format(item.rooms_count)} خواب` : null,
    item.beds_count > 0 ? `${new Intl.NumberFormat("fa-IR").format(item.beds_count)} تخت` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return {
    id: item.id,
    title: item.title,
    location: [item.city?.name, item.city?.province?.name].filter(Boolean).join(" · "),
    price: formatPrice(item.base_price),
    rating,
    meta,
    tag: item.category?.title || "اقامتگاه بومی",
    image: item.cover_image || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    fallback: FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
  }
}

/**
 * Cover images come from the API (relative /uploads URLs after upload) or a
 * static /prototype fallback; both are same-origin, so next/image optimizes
 * them by default. Seed/demo cover URLs can rot; keep the editorial
 * composition intact.
 */
function StayImage({
  stay,
  className,
  sizes,
  priority,
}: {
  stay: Stay
  className?: string
  sizes: string
  priority?: boolean
}) {
  const [src, setSrc] = React.useState(stay.image)
  const [failed, setFailed] = React.useState(false)

  return (
    <Image
      src={src}
      alt={stay.title}
      fill
      priority={priority}
      sizes={sizes}
      onError={() => {
        if (!failed && src !== stay.fallback) {
          setFailed(true)
          setSrc(stay.fallback)
        }
      }}
      className={className}
    />
  )
}

function Rating({ value }: { value: string | null }) {
  if (!value) {
    return <span className="shrink-0 text-xs font-bold text-ink-soft">تازه</span>
  }

  return (
    <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-ink">
      <Star className="size-3.5 fill-gold text-gold" />
      {value}
    </span>
  )
}

function FeaturedStay({ stay }: { stay: Stay }) {
  return (
    <Link
      href={`/accommodations/${stay.id}`}
      className="group relative isolate flex min-h-[420px] flex-col justify-end overflow-hidden rounded-3xl border border-line/80 bg-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper lg:h-full lg:min-h-[560px]"
    >
      <StayImage
        stay={stay}
        priority
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-night via-night/55 to-night/10"
      />

      <div className="relative z-10 p-5 text-night-foreground sm:p-7">
        <span className="inline-flex items-center rounded-full border border-night-foreground/30 bg-night/30 px-3 py-1 text-[11px] font-semibold backdrop-blur">
          پیشنهاد سردبیر · {stay.tag}
        </span>
        <h3 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{stay.title}</h3>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-night-foreground/75">
          <MapPin className="size-3.5 shrink-0" />
          {stay.location}
        </p>
        <p className="mt-1 text-xs text-night-foreground/65">{stay.meta}</p>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-night-foreground/20 pt-4">
          <p className="text-xs text-night-foreground/70">
            <span className="text-xl font-black text-night-foreground">{stay.price}</span> تومان /
            شب
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-night-foreground">
            مشاهدهٔ اقامتگاه
            <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-1 motion-reduce:transition-none" />
          </span>
        </div>
      </div>

      <span className="absolute left-5 top-5 z-10 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-bold text-ink backdrop-blur sm:left-7 sm:top-7">
        <Rating value={stay.rating} />
      </span>
    </Link>
  )
}

function StayCard({ stay }: { stay: Stay }) {
  return (
    <Link
      href={`/accommodations/${stay.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper-card transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-paper-deep">
        <StayImage
          stay={stay}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span className="absolute right-3 top-3 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-semibold text-ink backdrop-blur">
          {stay.tag}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-bold leading-6 text-ink">{stay.title}</h3>
          <Rating value={stay.rating} />
        </div>
        <p className="flex items-center gap-1 text-xs text-ink-soft">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{stay.location}</span>
        </p>
        <p className="text-xs text-ink-soft">{stay.meta}</p>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-line/70 pt-3">
          <p className="text-xs text-ink-soft">
            <span className="text-[15px] font-black text-brick">{stay.price}</span> تومان / شب
          </p>
          <ArrowLeft className="size-4 text-ink-soft transition-[transform,color] duration-300 group-hover:-translate-x-1 group-hover:text-brick motion-reduce:transition-none" />
        </div>
      </div>
    </Link>
  )
}

function StaySkeleton() {
  return (
    <section
      aria-label="در حال بارگذاری اقامتگاه‌ها"
      className="border-y border-line/70 bg-paper-deep/45"
    >
      <div className="mx-auto w-full max-w-[1360px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <Skeleton className="h-9 w-72 rounded-xl bg-paper-deep" />
        <div className="mt-10 grid gap-4 lg:grid-cols-12 lg:gap-5">
          <Skeleton className="min-h-[420px] rounded-3xl bg-paper-deep lg:col-span-6" />
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-2xl bg-paper-deep" />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function StaySlider() {
  const [stays, setStays] = React.useState<Stay[] | null>(null)

  React.useEffect(() => {
    let active = true
    apiClient
      .get<AccommodationListItem[]>("/accommodations/?limit=5")
      .then((data) => {
        if (!active) return
        setStays(Array.isArray(data) ? data.map(toStay) : [])
      })
      .catch((error) => {
        console.error("Failed to load featured stays:", error)
        if (active) setStays([])
      })

    return () => {
      active = false
    }
  }, [])

  if (stays === null) return <StaySkeleton />
  if (stays.length === 0) return null

  const [featured, ...rest] = stays

  return (
    <section
      id="stays"
      aria-labelledby="stays-title"
      className="scroll-mt-40 border-y border-line/70 bg-paper-deep/45 md:scroll-mt-44"
    >
      <div className="mx-auto w-full max-w-[1360px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <SectionHeading
          id="stays-title"
          eyebrow="دست‌چین‌شده"
          title="اقامتگاه‌هایی که خاطره می‌سازند"
          description="هر خانه پیش از انتشار بازدید شده؛ از حیاط‌های کاشان تا ایوان‌های جنگل و بام‌های کویر."
          action={
            <Button
              asChild
              variant="outline"
              className="border-line bg-paper-card text-ink shadow-none hover:bg-paper"
            >
              <Link href="/search">
                مشاهدهٔ همه
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
          }
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-12 lg:gap-5">
          <div className="lg:col-span-6">
            <FeaturedStay stay={featured} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6">
            {rest.slice(0, 4).map((stay) => (
              <StayCard key={stay.id} stay={stay} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
