import { cn } from "@/lib/utils"

/** The arch is the product's one brand shape: a doorway into a stay. */
export function ArchMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-b-lg rounded-t-full bg-brick text-on-brick shadow-sm",
        className
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M6 20V10.5a6 6 0 0 1 12 0V20"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M12 20v-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  )
}
