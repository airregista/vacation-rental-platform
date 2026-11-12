import Link from "next/link"
import { ArrowLeft, Check, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"

const POINTS = ["ثبت اقامتگاه رایگان", "بازدید و راهنمای عکاسی", "تسویهٔ شفاف و به‌موقع"]

export function HostCta() {
  return (
    <section
      id="host"
      className="scroll-mt-24 px-4 pb-16 pt-6 sm:px-6 lg:scroll-mt-28 lg:px-8 lg:pb-24 lg:pt-10"
    >
      <div className="relative isolate mx-auto w-full max-w-[1360px] overflow-hidden rounded-[2rem] bg-brick px-6 py-12 text-on-brick sm:px-10 lg:px-14 lg:py-16">
        <div
          aria-hidden="true"
          className="paper-grain pointer-events-none absolute inset-0 opacity-30"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 320 520"
          fill="none"
          className="pointer-events-none absolute -left-10 bottom-0 hidden h-[86%] w-auto text-on-brick/10 lg:block"
        >
          <path d="M10 520V170a150 150 0 0 1 300 0v350" stroke="currentColor" strokeWidth="1.5" />
          <path d="M70 520V190a90 90 0 0 1 180 0v330" stroke="currentColor" strokeWidth="1.5" />
          <path d="M130 520V215a30 30 0 0 1 60 0v305" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <div className="relative grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="lg:col-span-7">
            <p className="flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-on-brick/70">
              <span aria-hidden="true" className="h-px w-8 bg-on-brick/40" />
              میزبانی با آشیانک
            </p>
            <h2 className="mt-4 text-balance text-3xl font-black tracking-tight sm:text-display">
              خانه‌تان را به یک تجربه تبدیل کنید.
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-8 text-on-brick/80">
              اگر خانه، باغ یا اتاقی دارید که قصه‌ای برای گفتن دارد، ما در
              عکاسی، معرفی و پذیرش مهمان کنارتان هستیم. شما میزبان باشید؛ بقیه
              کارها با آشیانک.
            </p>

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {POINTS.map((point) => (
                <li key={point} className="flex items-center gap-1.5 text-xs text-on-brick/80">
                  <Check className="size-3.5 text-gold" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:mx-auto lg:w-full lg:max-w-xs lg:flex-col">
            <Button
              asChild
              size="lg"
              className="bg-paper text-ink shadow-none hover:bg-paper/90"
            >
              <Link href="/host/new">
                شروع میزبانی
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-on-brick/40 bg-transparent text-on-brick shadow-none hover:bg-on-brick/10 hover:text-on-brick"
            >
              <a href="tel:+982191000000">
                پشتیبانی میزبان
                <Phone className="size-4" />
              </a>
            </Button>
            <p className="text-pretty text-center text-[11px] leading-5 text-on-brick/60 lg:text-right">
              ثبت اقامتگاه رایگان است؛ کمیسیون فقط پس از رزرو موفق محاسبه
              می‌شود.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
