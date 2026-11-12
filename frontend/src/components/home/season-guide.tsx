import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SectionHeading } from "@/components/layout/section-heading"
import { Button } from "@/components/ui/button"

const SEASONS = [
  {
    season: "بهار",
    months: "فروردین — خرداد",
    title: "کویر، باغ و شهرهای تاریخی",
    description: "خنکای فروردین و باغ‌های گل‌سرخ، بهترین وقت برای شهرهای مرکزی است.",
    tags: ["کاشان", "یزد", "طبس"],
    image: "/prototype/kashan-courtyard.jpg",
    alt: "حیاط باغی کاشان در نور بهار",
  },
  {
    season: "تابستان",
    months: "تیر — شهریور",
    title: "ساحل و جنگل‌های شمال",
    description: "وقتی فلات ایران گرم می‌شود، ساحل و جنگل شمال پناه می‌گیرند.",
    tags: ["ماسوله", "رامسر", "لاهیجان"],
    image: "/prototype/forest.jpg",
    alt: "جنگل هیرکانی در تابستان",
  },
  {
    season: "پاییز",
    months: "مهر — آذر",
    title: "روستاهای رنگین و جنگل هیرکانی",
    description: "رنگ جنگل هیرکانی و کوچه‌های پلکانی ابیانه در اوج خود است.",
    tags: ["ابیانه", "فومن", "ماسوله"],
    image: "/prototype/abyaneh.jpg",
    alt: "روستای پلکانی ابیانه در پاییز",
  },
  {
    season: "زمستان",
    months: "دی — اسفند",
    title: "گرمای جنوب و جزیره‌ها",
    description: "آفتاب ملایم جنوب و جزیره‌ها، جای فرار از سرمای فلات است.",
    tags: ["قشم", "کیش", "هرمز"],
    image: "/prototype/coast.jpg",
    alt: "ساحل خلیج فارس در زمستان",
  },
]

export function SeasonGuide() {
  return (
    <section
      id="guide"
      aria-labelledby="guide-title"
      className="scroll-mt-24 border-y border-line/70 bg-paper-deep/45 lg:scroll-mt-28"
    >
      <div className="mx-auto w-full max-w-[1360px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <SectionHeading
          id="guide-title"
          eyebrow="کجا و کِی"
          title="ایران را در فصل درستش ببینید"
          description="راهنمای کوتاه ما برای انتخاب مقصد در هر فصل؛ از باغ‌های بهاری کاشان تا ساحل گرم جنوب در زمستان."
          action={
            <Button
              asChild
              variant="outline"
              className="border-line bg-paper-card text-ink shadow-none hover:bg-paper"
            >
              <Link href="/info/journal">
                راهنمای کامل سفر
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
          }
        />

        <div className="mt-10 divide-y divide-line/80 overflow-hidden rounded-3xl border border-line/80 bg-paper-card">
          {SEASONS.map((item, index) => (
            <Link
              key={item.season}
              href="/search"
              className="group grid gap-4 p-6 transition-colors hover:bg-paper/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:gap-6 lg:p-7"
            >
              <div className="flex items-baseline gap-3 sm:block">
                <span className="text-[11px] font-semibold tabular-nums text-ink-soft/70">
                  {`۰${index + 1}`}
                </span>
                <h3 className="text-2xl font-black text-ink transition-colors group-hover:text-brick sm:mt-1">
                  {item.season}
                </h3>
              </div>

              <div>
                <p className="text-[15px] font-bold text-ink">{item.title}</p>
                <p className="mt-1 max-w-md text-xs leading-6 text-ink-soft">
                  {item.description}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] text-ink-soft"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 sm:gap-4">
                <span className="text-xs text-ink-soft">{item.months}</span>
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-b-lg rounded-t-full bg-paper-deep sm:h-28 sm:w-24">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    unoptimized
                    sizes="64px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
