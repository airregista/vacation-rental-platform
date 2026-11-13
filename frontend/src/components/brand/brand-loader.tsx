import { AshianakLogo } from "@/components/brand/ashianak-logo"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

/**
 * Brand-forward loading screen: the nest logomark breathes gently while the
 * page's data loads, with a standard Spinner beneath it. Pulse instead of
 * spin — the mark's geometry is designed to sit upright, and rotating it
 * would make the bird fly backwards.
 */
export function BrandLoader({
  label = "در حال آماده‌سازی...",
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[70vh] flex-col items-center justify-center gap-5 bg-paper p-4 text-ink",
        className
      )}
    >
      <span className="relative flex items-center justify-center">
        {/* Breathing halo echoes the nest weave behind the mark */}
        <span
          aria-hidden="true"
          className="absolute size-28 animate-pulse rounded-full bg-brick/10 [animation-duration:2.4s]"
        />
        <AshianakLogo
          variant="mark"
          className="relative size-16 animate-pulse [animation-duration:2.4s]"
        />
      </span>
      <span className="flex items-center gap-2 text-sm font-medium text-ink-soft">
        <Spinner className="size-4 text-brick" />
        {label}
      </span>
    </div>
  )
}
