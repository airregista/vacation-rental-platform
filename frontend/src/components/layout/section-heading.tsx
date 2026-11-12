import type { ReactNode } from "react"

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
  tone = "paper",
}: {
  id?: string
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
  tone?: "paper" | "night"
}) {
  const dark = tone === "night"

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p
          className={
            dark
              ? "mb-3 flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-night-foreground/60"
              : "mb-3 flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick"
          }
        >
          <span
            aria-hidden="true"
            className={dark ? "h-px w-8 bg-night-foreground/40" : "h-px w-8 bg-brick/45"}
          />
          {eyebrow}
        </p>
        <h2
          id={id}
          className={
            dark
              ? "text-balance text-3xl font-black tracking-tight text-night-foreground sm:text-display"
              : "text-balance text-3xl font-black tracking-tight text-ink sm:text-display"
          }
        >
          {title}
        </h2>
        {description ? (
          <p
            className={
              dark
                ? "mt-3 max-w-xl text-sm leading-7 text-night-foreground/65"
                : "mt-3 max-w-xl text-sm leading-7 text-ink-soft"
            }
          >
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
