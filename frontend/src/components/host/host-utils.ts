import { ApiError } from "@/lib/api-client"
import { formatFaNumber } from "@/lib/format-fa"
import { localTodayIso } from "@/lib/persian-calendar"
import type { HostImageRecord } from "./types"

/** Signature image first, then the host-defined order. */
export function sortHostImages(images: HostImageRecord[]): HostImageRecord[] {
  return [...images].sort((first, second) => {
    if (first.is_cover !== second.is_cover) return first.is_cover ? -1 : 1
    return first.sort_order - second.sort_order
  })
}

/** Persian digits with grouping, used for every price and count in the host area. */
export { formatFaNumber }

export function formatToman(value: number | string | null | undefined): string {
  return formatFaNumber(value)
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.detail || error.message || fallback
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export { fetchAllPages } from "@/lib/pagination"

/** Today as a local ISO date — delegates to the shared helper in lib/persian-calendar. */
export const toLocalIsoDate = localTodayIso

/** Convert API time values ("14:00:00") to the "HH:MM" expected by input[type=time]. */
export function toTimeInputValue(value: string | null | undefined): string {
  if (!value) return ""
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return ""
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

export function formatTimeFa(value: string | null | undefined): string {
  const input = toTimeInputValue(value)
  if (!input) return "—"
  const [hours, minutes] = input.split(":")
  const parts = new Intl.NumberFormat("fa-IR", {
    minimumIntegerDigits: 2,
    useGrouping: false,
  })
  return `${parts.format(Number(hours))}:${parts.format(Number(minutes))}`
}
