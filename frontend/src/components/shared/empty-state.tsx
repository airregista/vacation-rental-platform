import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { AshianakLogo } from "@/components/brand/ashianak-logo"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  showBrandMark = false,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  /** Render a soft logomark watermark behind the arch icon. */
  showBrandMark?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-4 py-14 text-center",
        className
      )}
    >
      <span className="relative grid size-14 place-items-center">
        {showBrandMark ? (
          <AshianakLogo
            variant="mark"
            aria-hidden="true"
            className="pointer-events-none absolute -top-8 size-24 opacity-20"
          />
        ) : null}
        <span className="grid size-14 place-items-center rounded-b-2xl rounded-t-full bg-brick/10 text-brick">
          <Icon className="size-6" />
        </span>
      </span>
      <div className="space-y-1.5">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {description ? (
          <p className="text-xs leading-6 text-ink-soft">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
