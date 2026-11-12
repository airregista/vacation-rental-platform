import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function FormSection({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-line/80 bg-paper-card p-5 shadow-soft sm:p-6",
        className
      )}
    >
      {eyebrow ? (
        <p className="mb-1.5 text-xs font-bold tracking-[0.18em] text-brick">{eyebrow}</p>
      ) : null}
      <h2 className="text-lg font-black text-ink">{title}</h2>
      {description ? (
        <p className="mt-1 text-xs leading-6 text-ink-soft">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  )
}
