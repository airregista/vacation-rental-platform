import { apiClient, ApiError } from "@/lib/api-client"
import type { HostImageRecord } from "./types"

/** Signature image first, then the host-defined order. */
export function sortHostImages(images: HostImageRecord[]): HostImageRecord[] {
  return [...images].sort((first, second) => {
    if (first.is_cover !== second.is_cover) return first.is_cover ? -1 : 1
    return first.sort_order - second.sort_order
  })
}

/** Persian digits with grouping, used for every price and count in the host area. */
export function formatFaNumber(value: number | string | null | undefined): string {
  const parsed = typeof value === "number" ? value : Number(value ?? 0)
  return new Intl.NumberFormat("fa-IR").format(Number.isFinite(parsed) ? parsed : 0)
}

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

/**
 * The backend defaults list endpoints to limit=20, so the host views must walk
 * every page to show complete totals and lists.
 */
export async function fetchAllPages<T>(path: string): Promise<T[]> {
  const all: T[] = []
  let skip = 0
  for (;;) {
    const page = await apiClient.get<T[]>(`${path}?skip=${skip}&limit=100`)
    const batch = Array.isArray(page) ? page : []
    all.push(...batch)
    if (batch.length < 100) break
    skip += 100
  }
  return all
}

export function toLocalIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

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
