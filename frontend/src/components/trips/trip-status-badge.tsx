import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TripReservationItem } from "@/types/trips"

/**
 * One status language for every trip surface (list card, detail, invoice).
 * Colors are semantic so the same chip reads correctly in light and dark.
 */
export function TripStatusBadge({
  trip,
  className,
}: {
  trip: Pick<TripReservationItem, "status" | "cancellation_reason">
  className?: string
}) {
  switch (trip.status) {
    case "confirmed":
      return (
        <Badge
          variant="outline"
          className={cn("border-transparent bg-trust text-trust-deep", className)}
        >
          تأیید شده
        </Badge>
      )
    case "completed":
      return (
        <Badge
          variant="outline"
          className={cn("border-line bg-paper-deep text-ink-soft", className)}
        >
          پایان‌یافته
        </Badge>
      )
    case "cancelled": {
      const isExpired = trip.cancellation_reason?.toLowerCase().includes("expired")
      return (
        <Badge
          variant="outline"
          className={cn(
            isExpired
              ? "border-line bg-paper-deep text-ink-soft"
              : "border-destructive/30 bg-destructive/10 text-destructive",
            className
          )}
        >
          {isExpired ? "منقضی شده" : "لغو شده"}
        </Badge>
      )
    }
    case "pending":
    default:
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-transparent bg-gold text-secondary-foreground",
            className
          )}
        >
          در انتظار پرداخت
        </Badge>
      )
  }
}
