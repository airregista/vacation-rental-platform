import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

/**
 * Shared editorial page header. One eyebrow treatment across guest, host and
 * admin screens keeps the product feeling like one publication.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = "بازگشت",
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="border-b border-line/70 bg-paper-deep/35">
      <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-brick"
          >
            <ArrowRight className="size-3.5" />
            {backLabel}
          </Link>
        ) : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            {eyebrow ? (
              <p className="mb-2 flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick">
                <span aria-hidden="true" className="h-px w-8 bg-brick/45" />
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-balance text-2xl font-black tracking-tight text-ink sm:text-3xl lg:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-xl text-sm leading-7 text-ink-soft">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  )
}
