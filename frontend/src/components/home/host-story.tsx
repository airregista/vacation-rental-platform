import Image from "next/image"
import { ArrowLeft, BadgeCheck, Star } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function HostStory() {
  return (
    <section
      id="story"
      aria-labelledby="story-title"
      className="mx-auto w-full max-w-[1360px] scroll-mt-24 px-4 py-16 sm:px-6 lg:scroll-mt-28 lg:px-8 lg:py-24"
    >
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <div className="relative mx-auto max-w-sm lg:max-w-none">
            <div
              aria-hidden="true"
              className="absolute -inset-4 rounded-b-[2.5rem] rounded-t-full border border-brick/25"
            />
            <div className="relative aspect-[4/5] overflow-hidden rounded-b-[2rem] rounded-t-full bg-paper-deep">
              <Image
                src="/prototype/story.jpg"
                alt="حیاط خانهٔ بروجردی در کاشان با حوض و آبنما"
                fill
                unoptimized
                sizes="(max-width: 1024px) 90vw, 38vw"
                className="object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-night/25 to-transparent"
              />
            </div>

            <div className="absolute -bottom-5 right-4 rounded-2xl border border-line bg-paper-card px-4 py-3 shadow-lift">
              <p className="flex items-center gap-1.5 text-lg font-black text-ink">
                <Star className="size-4 fill-gold text-gold" />
                ۴٫۹
              </p>
              <p className="mt-0.5 text-[11px] text-ink-soft">امتیاز ۳۸۰ مهمان</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <p className="flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick">
            <span aria-hidden="true" className="h-px w-8 bg-brick/45" />
            پشت هر خانه، یک آدم
          </p>
          <h2
            id="story-title"
            className="mt-4 text-balance text-3xl font-black tracking-tight text-ink sm:text-display"
          >
            خانه‌ای که با خاطره گرم می‌شود
          </h2>

          <blockquote className="relative mt-6 border-r-2 border-brick/40 pr-5">
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-8 font-serif text-6xl leading-none text-brick/25"
            >
              ”
            </span>
            <p className="text-balance text-xl font-medium leading-10 text-ink sm:text-2xl">
              مهمان که می‌آید، در خانه را باز می‌کنم؛ نه فقط اتاق را. دوست دارم صبح با بوی نان محلی
              بیدار شود و شب با قصهٔ باغ بخوابد.
            </p>
          </blockquote>

          <p className="mt-5 max-w-xl text-[15px] leading-8 text-ink-soft">
            مریم رضایی، میزبان خانهٔ باغی زیر سرو در برزک کاشان است. او خانهٔ پدربزرگش را با همان
            حیاط، حوض و سروهای قدیمی نگه داشته و حالا بعد از دوازده سال، مهمان‌هایش را مثل خانوادهٔ
            خودش می‌شناسد.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line/70 pt-5">
            <div>
              <p className="flex items-center gap-1.5 text-base font-black text-ink">
                مریم رضایی
                <BadgeCheck className="size-4 text-trust" aria-label="میزبان تأییدشده" />
              </p>
              <p className="mt-1 text-xs text-ink-soft">میزبان آشیانک در کاشان · ۱۲ سال میزبانی</p>
            </div>
            <Button
              asChild
              variant="outline"
              className="border-line bg-transparent text-ink shadow-none hover:bg-paper-card"
            >
              <Link href="/host/new">
                با میزبانان آشنا شوید
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
