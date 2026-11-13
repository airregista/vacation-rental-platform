import { apiClient } from "@/lib/api-client"
import { addDays, getPersianParts, persianMonthStart, toISODate } from "@/lib/persian-calendar"

export {
  WEEK_DAYS,
  addDays,
  getPersianParts,
  nextPersianMonthStart,
  persianMonthStart,
  previousPersianMonthStart,
  toISODate,
} from "@/lib/persian-calendar"
export type { PersianDateParts } from "@/lib/persian-calendar"

/** One batch call may cover at most 90 days (backend CALENDAR_MAX_BLOCK_DAYS). */
export const MAX_CALENDAR_BATCH_DAYS = 90

export interface PersianMonthGroup<T> {
  key: string
  title: string
  leadingBlanks: number
  days: T[]
}

export function groupByPersianMonth<T extends { date: string }>(days: T[]): PersianMonthGroup<T>[] {
  const groups = new Map<string, PersianMonthGroup<T>>()

  for (const item of days) {
    const parts = getPersianParts(item.date)
    if (!groups.has(parts.key)) {
      const monthStart = persianMonthStart(item.date)
      const firstWeekday = (new Date(`${monthStart}T00:00:00Z`).getUTCDay() + 1) % 7
      groups.set(parts.key, {
        key: parts.key,
        title: parts.title,
        leadingBlanks: firstWeekday,
        days: [],
      })
    }
    groups.get(parts.key)?.days.push(item)
  }

  return Array.from(groups.values())
}

export interface DateRange {
  start_date: string
  end_date: string
}

/** Split a range into inclusive chunks accepted by the batch endpoint. */
export function splitRange(
  start: string,
  end: string,
  maxDays: number = MAX_CALENDAR_BATCH_DAYS,
): DateRange[] {
  const chunks: DateRange[] = []
  let cursor = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)

  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return chunks

  while (cursor <= last) {
    const chunkEnd = new Date(cursor)
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + maxDays - 1)
    if (chunkEnd > last) chunkEnd.setTime(last.getTime())
    chunks.push({ start_date: toISODate(cursor), end_date: toISODate(chunkEnd) })
    cursor = new Date(chunkEnd)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return chunks
}

/** Turn an arbitrary set of selected days into consecutive ranges. */
export function toDateRanges(dates: string[]): DateRange[] {
  const sorted = Array.from(new Set(dates)).sort()
  const ranges: DateRange[] = []

  for (const date of sorted) {
    const last = ranges[ranges.length - 1]
    if (last && addDays(last.end_date, 1) === date) {
      last.end_date = date
    } else {
      ranges.push({ start_date: date, end_date: date })
    }
  }

  return ranges
}

export interface PricingBatchBody {
  price?: number | null
  is_blocked?: boolean
  min_nights?: number | null
}

export class PartialBatchError extends Error {
  appliedChunks: number

  constructor(appliedChunks: number) {
    super("Only part of the requested range was applied.")
    this.name = "PartialBatchError"
    this.appliedChunks = appliedChunks
  }
}

/**
 * Apply a pricing/blocking action to a date range, splitting it into chunks the
 * backend accepts. Throws PartialBatchError if earlier chunks committed before
 * a later chunk failed, so the host knows part of the range was applied.
 */
export async function postPricingBatch(
  accommodationId: number,
  startDate: string,
  endDate: string,
  body: PricingBatchBody,
): Promise<number> {
  const chunks = splitRange(startDate, endDate)
  let applied = 0

  try {
    for (const chunk of chunks) {
      await apiClient.post(`/accommodations/${accommodationId}/pricing-exceptions/batch`, {
        ...chunk,
        ...body,
      })
      applied += 1
    }
  } catch (error) {
    if (applied > 0) throw new PartialBatchError(applied)
    throw error
  }

  return applied
}
