"use client"

import * as React from "react"
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Stay = {
  title: string
  location: string
  price: number
  rating: string
  meta: string
  tag: string
  thumb: string
  pool: string
}

const STAYS: Stay[] = [
  {
    title: "خانهٔ باغی زیر سرو",
    location: "کاشان · برزک",
    price: 2400000,
    rating: "۴٫۹",
    meta: "۴ مهمان · ۲ خواب",
    tag: "حیاط مرکزی",
    thumb: "stay-thumb-sand",
    pool: "bg-hero-teal/75",
  },
  {
    title: "کلبهٔ چوبی کنار رود",
    location: "ماسوله · فومن",
    price: 1850000,
    rating: "۴٫۸",
    meta: "۲ مهمان · ۱ خواب",
    tag: "جنگل و رود",
    thumb: "stay-thumb-green",
    pool: "bg-hero-green/70",
  },
  {
    title: "سوئیت فیروزه‌ای بازار",
    location: "اصفهان · جلفا",
    price: 1320000,
    rating: "۴٫۷",
    meta: "۲ مهمان · ۱ خواب",
    tag: "نزدیک بازار",
    thumb: "stay-thumb-teal",
    pool: "bg-hero-clay/60",
  },
  {
    title: "عمارت خشتی کویر",
    location: "یزد · فهادان",
    price: 2100000,
    rating: "۴٫۹",
    meta: "۶ مهمان · ۳ خواب",
    tag: "بام کویر",
    thumb: "stay-thumb-clay",
    pool: "bg-hero-teal/60",
  },
  {
    title: "خانهٔ آینه‌ای شیراز",
    location: "شیراز · سنگ سیاه",
    price: 1640000,
    rating: "۴٫۶",
    meta: "۴ مهمان · ۲ خواب",
    tag: "بافت تاریخی",
    thumb: "stay-thumb-dusk",
    pool: "bg-hero-teal/70",
  },
  {
    title: "باغ انار و سایه",
    location: "طبس · کریت",
    price: 1280000,
    rating: "۴٫۸",
    meta: "۵ مهمان · ۲ خواب",
    tag: "باغ انار",
    thumb: "stay-thumb-mist",
    pool: "bg-hero-green/65",
  },
  {
    title: "ویلای سرو و مه",
    location: "رامسر · جواهرده",
    price: 1990000,
    rating: "۴٫۷",
    meta: "۶ مهمان · ۳ خواب",
    tag: "منظرهٔ جنگل",
    thumb: "stay-thumb-green",
    pool: "bg-hero-teal/65",
  },
  {
    title: "خانهٔ قاجاری تجریش",
    location: "تهران · تجریش",
    price: 2350000,
    rating: "۴٫۵",
    meta: "۴ مهمان · ۲ خواب",
    tag: "خانهٔ تاریخی",
    thumb: "stay-thumb-clay",
    pool: "bg-hero-clay/55",
  },
]

function fa(value: number) {
  return value.toLocaleString("fa-IR")
}

function StayCard({ stay }: { stay: Stay }) {
  return (
    <Card className="h-full overflow-hidden border-border/70 shadow-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div aria-hidden="true" className={cn("relative h-40 overflow-hidden sm:h-44", stay.thumb)}>
        <div className="absolute inset-x-10 bottom-0 h-28 rounded-t-[999px] bg-card/45" />
        <div className="absolute inset-x-16 bottom-0 h-20 rounded-t-[999px] bg-card/35" />
        <div
          className={cn(
            "absolute -bottom-8 left-1/2 size-24 -translate-x-1/2 rounded-full",
            stay.pool
          )}
        />
        <div className="absolute bottom-6 left-5 h-24 w-2.5 rounded-full bg-hero-green/70" />
        <div className="absolute bottom-6 left-2 h-16 w-1.5 rounded-full bg-hero-green/50" />
        <Badge className="absolute right-3 top-3 border-card/70 bg-card/85 text-[10px] text-hero-ink backdrop-blur">
          {stay.tag}
        </Badge>
      </div>

      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-foreground">{stay.title}</h3>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{stay.location}</span>
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-foreground">
            <Star className="size-3.5 fill-secondary text-secondary" />
            {stay.rating}
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground">{stay.meta}</p>

        <p className="mt-auto border-t border-border/60 pt-2 text-xs text-muted-foreground">
          <span className="text-sm font-extrabold text-foreground">{fa(stay.price)}</span> تومان / شب
        </p>
      </CardContent>
    </Card>
  )
}

export function StaySlider() {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = React.useState(0)
  const [atStart, setAtStart] = React.useState(true)
  const [atEnd, setAtEnd] = React.useState(false)

  function syncFromScroll() {
    const track = trackRef.current
    if (!track) return

    const trackRect = track.getBoundingClientRect()
    const rtl = getComputedStyle(track).direction === "rtl"
    let next = 0
    let closest = Number.POSITIVE_INFINITY

    cardRefs.current.forEach((card, index) => {
      if (!card) return
      const rect = card.getBoundingClientRect()
      const distance = rtl
        ? Math.abs(trackRect.right - rect.right)
        : Math.abs(rect.left - trackRect.left)
      if (distance < closest) {
        closest = distance
        next = index
      }
    })

    setActive(next)
    const position = Math.abs(track.scrollLeft)
    setAtStart(position <= 2)
    setAtEnd(position >= track.scrollWidth - track.clientWidth - 2)
  }

  function scrollByCard(direction: 1 | -1) {
    const track = trackRef.current
    const firstCard = cardRefs.current[0]
    if (!track || !firstCard) return

    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0
    const step = firstCard.getBoundingClientRect().width + gap
    const rtl = getComputedStyle(track).direction === "rtl"
    track.scrollBy({ left: (rtl ? -1 : 1) * direction * step, behavior: "smooth" })
  }

  const total = fa(STAYS.length)
  const current = fa(active + 1)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Badge variant="secondary" className="rounded-full text-[10px]">
            نمونهٔ نمایشی
          </Badge>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            اقامتگاه‌های منتخب
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            هشت نمونه برای سنجش اسلایدر، فاصلهٔ هیرو تا محتوا و رفتار داک چسبان.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hidden shrink-0 gap-1.5 lg:inline-flex">
            <span>مشاهدهٔ همه</span>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card/80 p-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => scrollByCard(-1)}
              disabled={atStart}
              aria-label="اقامتگاه‌های قبلی"
            >
              <ChevronRight className="size-4" />
            </Button>
            <span
              className="min-w-12 text-center text-[11px] font-semibold tabular-nums text-muted-foreground"
              aria-live="polite"
            >
              {current} / {total}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => scrollByCard(1)}
              disabled={atEnd}
              aria-label="اقامتگاه‌های بعدی"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={syncFromScroll}
        role="group"
        aria-roledescription="اسلایدر"
        aria-label="اقامتگاه‌های منتخب"
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {STAYS.map((stay, index) => (
          <div
            key={stay.title}
            ref={(node) => {
              cardRefs.current[index] = node
            }}
            className="shrink-0 basis-full snap-start sm:basis-[calc(50%_-_0.625rem)] lg:basis-[calc(33.333%_-_0.8333rem)]"
          >
            <StayCard stay={stay} />
          </div>
        ))}
      </div>
    </div>
  )
}
