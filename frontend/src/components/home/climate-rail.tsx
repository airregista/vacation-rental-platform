import Image from "next/image"
import Link from "next/link"
import { SectionHeading } from "@/components/layout/section-heading"

type Climate = {
  label: string
  climate: string
  count: string
  image: string
  alt: string
}

const CLIMATES: Climate[] = [
  {
    label: "خشک مرکزی",
    climate: "گرم و خشک",
    count: "۲۴۰",
    image: "/prototype/kashan-courtyard.jpg",
    alt: "حیاط ایرانی با حوض و بادگیر در کاشان",
  },
  {
    label: "جنگل",
    climate: "معتدل و مرطوب",
    count: "۱۹۶",
    image: "/prototype/forest.jpg",
    alt: "جنگل هیرکانی با مه صبحگاهی",
  },
  {
    label: "کویر",
    climate: "گرم و خشک",
    count: "۱۳۲",
    image: "/prototype/desert.jpg",
    alt: "بافت خشتی و بادگیرهای شهر یزد",
  },
  {
    label: "کوهستان",
    climate: "سرد و کوهستانی",
    count: "۱۱۴",
    image: "/prototype/mountain.jpg",
    alt: "خانه‌های سنگی روستای کندوان در دامنهٔ کوه",
  },
  {
    label: "زاگرس",
    climate: "نیمه‌خشک",
    count: "۸۸",
    image: "/prototype/zagros.jpg",
    alt: "سیاه‌چادر عشایری در دامنهٔ زاگرس",
  },
  {
    label: "ساحلی",
    climate: "گرم و مرطوب",
    count: "۱۵۲",
    image: "/prototype/coast.jpg",
    alt: "ساحل خلیج فارس با آب فیروزه‌ای",
  },
]

export function ClimateRail() {
  return (
    <section
      id="climates"
      aria-labelledby="climates-title"
      className="mx-auto w-full max-w-[1360px] scroll-mt-40 px-4 pb-16 pt-12 sm:px-6 md:scroll-mt-44 lg:px-8 lg:pb-24 lg:pt-16"
    >
      <SectionHeading
        id="climates-title"
        eyebrow="شش اقلیم"
        title="ایران را در شش حال‌وهوا ببینید"
        description="از حیاط‌های خشتی مرکز ایران تا مه جنگل هیرکانی و گرمای ساحل؛ اقامتگاه را هم‌قلیم خودتان انتخاب کنید."
      />

      <div className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-6">
        {CLIMATES.map((climate) => (
          <Link
            key={climate.label}
            href="/search"
            className="group relative block w-[68vw] max-w-[260px] shrink-0 snap-start overflow-hidden rounded-b-2xl rounded-t-full border border-line/80 bg-paper-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:w-auto sm:max-w-none sm:shrink"
          >
            <div className="relative aspect-[3/4] overflow-hidden">
              <Image
                src={climate.image}
                alt={climate.alt}
                fill
                unoptimized
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/25 to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-2 rounded-b-xl rounded-t-full border border-paper/25"
              />
              <div className="absolute inset-x-0 bottom-0 p-3.5 text-night-foreground sm:p-4">
                <p className="text-[11px] font-medium text-night-foreground/70">
                  {climate.climate}
                </p>
                <h3 className="mt-1 text-lg font-black sm:text-xl">{climate.label}</h3>
                <p className="mt-1 text-[11px] text-night-foreground/70">
                  {climate.count} اقامتگاه
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
