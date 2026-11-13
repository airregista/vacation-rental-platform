import { toPersianDigits } from "@/lib/format-fa"

/**
 * Guest-facing reservation code, identical on every surface (trips, checkout,
 * invoice) so support can match what the guest quotes.
 */
export function getReservationCode(id: number): string {
  return `ASH-${toPersianDigits(String(id).padStart(5, "0"))}`
}
