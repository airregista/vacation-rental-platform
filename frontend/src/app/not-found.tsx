import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Compass, Home, LifeBuoy, MapPinOff } from "lucide-react"

import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "نشانی پیدا نشد | آشیانک",
  description:
    "صفحه‌ای که به دنبال آن بودید پیدا نشد. از خانه یا جستجوی اقامتگاه مسیر را دوباره انتخاب کنید.",
}

export default function NotFound() {
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-paper px-4 py-16 text-ink sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-1/2 size-96 translate-x-1/2 rounded-full bg-brick/5 blur-3xl"
      />

      <div className="paper-grain relative w-full max-w-2xl overflow-hidden rounded-3xl border border-line bg-paper-card p-7 text-center shadow-lift sm:p-10">
        <div
          aria-hidden="true"
          className="absolute -left-16 -top-20 size-48 rounded-full border border-line/60"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 -right-10 size-56 rounded-full border border-line/50"
        />

        <span className="mx-auto grid size-20 place-items-center rounded-b-3xl rounded-t-full border border-brick/20 bg-brick/10 text-brick shadow-soft">
          <MapPinOff className="size-9" />
        </span>

        <p className="mt-6 text-xs font-black tracking-[0.22em] text-brick">
          خطای ۴۰۴
        </p>
        <h1 className="mt-3 text-balance text-2xl font-black leading-tight tracking-tight text-ink sm:text-3xl">
          این نشانی به هیچ آشیانه‌ای نمی‌رسد
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-8 text-ink-soft">
          ممکن است صفحه جابه‌جا شده باشد، نشانی دستی تغییر کرده باشد یا این خانه
          دیگر برای اقامت باز نباشد. نگران نباشید؛ از همین‌جا مسیر را دوباره
          انتخاب کنید.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild className="gap-2">
            <Link href="/">
              <Home className="size-4" />
              بازگشت به خانه
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="gap-2 bg-paper-card shadow-none"
          >
            <Link href="/search">
              <Compass className="size-4" />
              جستجوی اقامتگاه
            </Link>
          </Button>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-line/70 pt-5 text-xs sm:flex-row">
          <p className="flex items-center gap-1.5 text-ink-soft">
            <LifeBuoy className="size-3.5 text-trust" />
            دنبال راهنما یا پاسخ سؤال‌تان هستید؟
          </p>
          <Link
            href="/help"
            className="inline-flex items-center gap-1.5 font-bold text-brick transition-colors hover:text-brick-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            مرکز راهنمایی آشیانک
            <ArrowLeft className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
