import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-b-2xl rounded-t-full bg-brick/10 text-brick">
        <Icon className="size-6" />
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
