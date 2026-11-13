"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { BadgeCheck, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { safeNext } from "@/lib/safe-next"
import { OtpForm } from "@/components/auth/otp-form"
import { AshianakLogo } from "@/components/brand/ashianak-logo"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading } = useAuth()
  const next = safeNext(searchParams.get("next"))

  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(next)
    }
  }, [isLoading, isAuthenticated, next, router])

  if (isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        <Skeleton className="h-[420px] rounded-3xl bg-paper-deep" />
        <Skeleton className="h-[420px] rounded-3xl bg-paper-deep" />
      </div>
    )
  }

  return (
    <main className="relative overflow-hidden bg-paper">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-10 size-[26rem] rounded-full bg-brick/5 blur-3xl"
      />
      <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-start lg:gap-12 lg:px-8 lg:py-20">
        {/* Editorial welcome panel */}
        <section className="order-2 lg:order-1" aria-labelledby="login-welcome">
          <p className="flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick">
            <span aria-hidden="true" className="h-px w-8 bg-brick/45" />
            خوش آمدید
          </p>
          <h1
            id="login-welcome"
            className="mt-4 max-w-xl text-balance text-3xl font-black leading-[1.35] tracking-tight text-ink sm:text-4xl"
          >
            یک شماره، یک کد، و
            <br />
            درِ خانه‌های ایران باز می‌شود.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-8 text-ink-soft">
            با شماره همراه خود وارد شوید تا رزروها، نشان‌شده‌ها و گفتگوی میزبان‌هایتان همیشه
            همراهتان باشد. ثبت‌نام جداگانه‌ای لازم نیست.
          </p>

          <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-2">
            {[
              { Icon: ShieldCheck, title: "ورود امن", body: "کد یک‌بارمصرف پیامکی" },
              { Icon: HeartHandshake, title: "پشتیبانی انسانی", body: "همراه شما تا پایان سفر" },
              { Icon: BadgeCheck, title: "میزبانان تأییدشده", body: "هویت و کیفیت بررسی‌شده" },
              { Icon: Sparkles, title: "هدیهٔ ورود", body: "تخفیف رزرو نخست" },
            ].map(({ Icon, title, body }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-2xl border border-line/70 bg-paper-card/70 p-4"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-b-lg rounded-t-full bg-trust/10 text-trust">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink">{title}</p>
                  <p className="mt-0.5 text-[11px] leading-5 text-ink-soft">{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line/70 pt-6 text-xs text-ink-soft">
            <Link href="/" className="transition-colors hover:text-brick">
              بازگشت به صفحهٔ اصلی
            </Link>
            <Link href="/help" className="transition-colors hover:text-brick">
              راهنمای ورود و رزرو
            </Link>
            <a
              href="tel:+982191000000"
              className="font-semibold tabular-nums transition-colors hover:text-brick"
              dir="ltr"
            >
              ۰۲۱–۹۱۰۰۰۰۰۰
            </a>
          </div>
        </section>

        {/* Form card */}
        <section
          aria-label="ورود با شماره همراه"
          className="order-1 lg:order-2 lg:sticky lg:top-28"
        >
          <div className="rounded-3xl border border-line/80 bg-paper-card p-6 shadow-lift sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-line/70 pb-5">
              <AshianakLogo size="lg" withLatin={false} />
            </div>

            <OtpForm onSuccess={() => router.replace(next)} />

            <p className="mt-6 border-t border-line/70 pt-4 text-[10px] leading-5 text-ink-soft">
              با ورود،{" "}
              <Link href="/info/terms" className="text-brick underline underline-offset-4">
                شرایط استفاده
              </Link>{" "}
              و{" "}
              <Link href="/info/privacy" className="text-brick underline underline-offset-4">
                سیاست حفظ حریم خصوصی
              </Link>{" "}
              آشیانک را می‌پذیرید.
            </p>
          </div>

          <p className="mt-4 text-center text-[11px] leading-5 text-ink-soft">
            ورود به‌عنوان میزبان؟{" "}
            <Button asChild variant="link" className="h-auto p-0 text-xs font-bold text-brick">
              <Link href="/host/new">ثبت اقامتگاه</Link>
            </Button>
          </p>
        </section>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <Skeleton className="h-[420px] rounded-3xl bg-paper-deep" />
          <Skeleton className="h-[420px] rounded-3xl bg-paper-deep" />
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  )
}
