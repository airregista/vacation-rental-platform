import type { ReactNode } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AshianakLogo } from "@/components/brand/ashianak-logo"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

export type PaymentResultVariant = "success" | "failed" | "neutral"

const VARIANT_STYLES: Record<
  PaymentResultVariant,
  {
    card: string
    hero: string
    icon: string
    eyebrow: string
    decor: string
    defaultIcon: LucideIcon
  }
> = {
  success: {
    card: "border-trust/25",
    hero: "bg-trust-soft/55",
    icon: "bg-trust text-on-brick ring-trust/15",
    eyebrow: "text-trust",
    decor: "border-trust/15 bg-trust/5",
    defaultIcon: CheckCircle2,
  },
  failed: {
    card: "border-destructive/25",
    hero: "bg-destructive/5",
    icon: "bg-destructive/10 text-destructive ring-destructive/10",
    eyebrow: "text-destructive",
    decor: "border-destructive/15 bg-destructive/5",
    defaultIcon: XCircle,
  },
  neutral: {
    card: "border-line",
    hero: "bg-paper-deep/45",
    icon: "bg-gold-soft/60 text-gold ring-gold/10",
    eyebrow: "text-gold",
    decor: "border-line/60 bg-paper-card/40",
    defaultIcon: Info,
  },
}

export interface PaymentResultViewProps {
  variant: PaymentResultVariant
  title: string
  description?: ReactNode
  eyebrow?: string
  icon?: LucideIcon
  code?: string
  codeLabel?: string
  children?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  /** Show the brand logomark under the reservation code (success moments). */
  brandMark?: boolean
}

/**
 * Shared shell for the payment success/failure screens: one hero treatment,
 * one action dock and the same Paper & Brick surface for both outcomes.
 */
export function PaymentResultView({
  variant,
  title,
  description,
  eyebrow,
  icon,
  code,
  codeLabel = "شماره رزرو",
  children,
  actions,
  footer,
  brandMark = false,
}: PaymentResultViewProps) {
  const styles = VARIANT_STYLES[variant]
  const Icon = icon ?? styles.defaultIcon

  return (
    <main className="min-h-screen bg-paper pb-16 pt-6 text-ink sm:pb-20 sm:pt-10">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <Card
          className={cn(
            "overflow-hidden rounded-3xl border bg-paper-card shadow-soft",
            styles.card
          )}
        >
          <div
            className={cn(
              "relative overflow-hidden px-5 py-8 text-center sm:px-8 sm:py-10",
              styles.hero
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute -top-20 left-1/2 size-48 -translate-x-1/2 rounded-full border",
                styles.decor
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute -left-10 top-1/3 size-24 rounded-full border",
                styles.decor
              )}
            />

            <div className="relative mx-auto flex max-w-xl flex-col items-center gap-3">
              <span
                className={cn(
                  "flex size-16 items-center justify-center rounded-3xl ring-8",
                  styles.icon
                )}
              >
                <Icon className="size-8" strokeWidth={2.2} />
              </span>

              {eyebrow ? (
                <p
                  className={cn(
                    "text-[11px] font-bold tracking-[0.18em]",
                    styles.eyebrow
                  )}
                >
                  {eyebrow}
                </p>
              ) : null}

              <h1 className="text-balance text-xl font-black tracking-tight text-ink sm:text-2xl">
                {title}
              </h1>

              {description ? (
                <p className="max-w-lg text-sm leading-7 text-ink-soft">
                  {description}
                </p>
              ) : null}

              {code ? (
                <span className="mt-1 inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-line bg-paper-card/85 px-3 py-1 text-xs font-semibold text-ink-soft shadow-sm">
                  <span>{codeLabel}:</span>
                  <bdi dir="ltr" className="tabular-nums text-ink">
                    {code}
                  </bdi>
                </span>
              ) : null}

              {brandMark ? (
                <AshianakLogo
                  variant="mark"
                  className="mt-2 size-12 opacity-90"
                />
              ) : null}
            </div>
          </div>

          {children ? <div className="space-y-4 p-5 sm:p-7">{children}</div> : null}

          {actions ? (
            <>
              <Separator className="bg-line/70" />
              <div className="bg-paper-deep/30 p-5 sm:p-7">{actions}</div>
            </>
          ) : null}
        </Card>

        {footer ? (
          <div className="mt-5 text-center text-xs leading-6 text-ink-soft">
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  )
}

export function PaymentResultFooterLinks() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold">
      <Link href="/trips" className="transition-colors hover:text-brick">
        سفرهای من
      </Link>
      <span aria-hidden="true" className="size-1 rounded-full bg-line-strong" />
      <Link href="/" className="transition-colors hover:text-brick">
        صفحه اصلی
      </Link>
    </div>
  )
}

export function PaymentResultSkeleton() {
  return (
    <main
      aria-busy="true"
      className="min-h-screen bg-paper pb-16 pt-6 text-ink sm:pb-20 sm:pt-10"
    >
      <span className="sr-only">در حال بارگذاری نتیجه پرداخت...</span>
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="rounded-3xl border border-line/80 bg-paper-card p-5 shadow-soft sm:p-7">
          <div className="flex flex-col items-center gap-3 py-6">
            <AshianakLogo
              variant="mark"
              className="size-16 animate-pulse [animation-duration:2.4s]"
            />
            <Skeleton className="h-7 w-64 max-w-full rounded-lg" />
            <Skeleton className="h-4 w-80 max-w-full rounded-md" />
            <Skeleton className="h-8 w-48 max-w-full rounded-full" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 flex-1 rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  )
}
