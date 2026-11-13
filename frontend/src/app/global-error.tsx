"use client"

import * as React from "react"
import "./globals.css"
import Link from "next/link"
import { Home, RotateCcw } from "lucide-react"
import { ThemeScript } from "@/components/theme/theme-script"
import { AshianakLogo } from "@/components/brand/ashianak-logo"
import { Button } from "@/components/ui/button"
import { applyTheme, isTheme, THEME_KEY } from "@/lib/theme"

export default function GlobalError({
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_KEY)
      applyTheme(isTheme(stored) ? stored : "system")
    } catch {
      // A storage or matchMedia failure must never break the error screen.
    }
  }, [])

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <title>خطای سیستمی | آشیانک</title>
      </head>
      <body className="flex min-h-screen items-center justify-center bg-paper p-4 font-sans text-ink antialiased">
        <main className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-paper-card p-7 text-center shadow-dock sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 right-1/2 size-80 translate-x-1/2 rounded-full bg-brick/5 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -left-16 -top-20 size-44 rounded-full border border-line/60"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-24 -right-10 size-52 rounded-full border border-line/50"
          />

          <span className="relative mx-auto grid size-20 place-items-center">
            <AshianakLogo variant="mark" className="size-20" />
          </span>

          <p className="relative mt-6 text-xs font-black tracking-[0.22em] text-brick">
            خطای غیرمنتظره
          </p>
          <h1 className="relative mt-3 text-balance text-2xl font-black leading-tight tracking-tight text-ink sm:text-3xl">
            در اجرای این صفحه مشکلی پیش آمد
          </h1>
          <p className="relative mx-auto mt-3 max-w-sm text-sm leading-8 text-ink-soft">
            ممکن است یک اختلال موقت شبکه یا خطای پیش‌بینی‌نشده رخ داده باشد.
            یک‌بار دیگر تلاش کنید؛ اگر مشکل ادامه داشت به خانه برگردید و بعداً
            دوباره سر بزنید.
          </p>

          <div className="relative mt-7 flex flex-col justify-center gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => retry()}
              className="gap-2"
            >
              <RotateCcw className="size-4" />
              تلاش دوباره
            </Button>
            <Button
              asChild
              variant="outline"
              className="gap-2 bg-paper-card shadow-none"
            >
              <Link href="/">
                <Home className="size-4" />
                بازگشت به خانه
              </Link>
            </Button>
          </div>

          <p className="relative mt-8 border-t border-line/70 pt-5 text-[11px] leading-6 text-ink-soft">
            اگر این خطا تکرار شد، با نشانی{" "}
            <a
              href="mailto:hello@ashianak.ir"
              dir="ltr"
              className="inline-block font-semibold tabular-nums text-brick transition-colors hover:text-brick-deep"
            >
              hello@ashianak.ir
            </a>{" "}
            با پشتیبانی در تماس باشید.
          </p>
        </main>
      </body>
    </html>
  )
}
