/** Calendar columns start on Saturday, matching the Persian week. */
export const WEEK_DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const

const persianNumberFormatter = new Intl.DateTimeFormat("en-u-ca-persian", {
  timeZone: "UTC",
  year: "numeric",
  month: "numeric",
  day: "numeric",
})

const persianMonthNameFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "UTC",
  month: "long",
})

const persianYearFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "UTC",
  year: "numeric",
})

export interface PersianDateParts {
  year: number
  month: number
  day: number
  monthName: string
  yearLabel: string
  key: string
  title: string
}

export function toISODate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return toISODate(date)
}

export function getPersianParts(isoDate: string): PersianDateParts {
  const date = new Date(`${isoDate}T00:00:00Z`)
  const parts = persianNumberFormatter.formatToParts(date)
  let year = 0
  let month = 0
  let day = 0

  for (const part of parts) {
    if (part.type === "year") year = Number(part.value)
    if (part.type === "month") month = Number(part.value)
    if (part.type === "day") day = Number(part.value)
  }

  const monthName = persianMonthNameFormatter.format(date)
  const yearLabel = persianYearFormatter.format(date)

  return {
    year,
    month,
    day,
    monthName,
    yearLabel,
    key: `${year}-${month}`,
    title: `${monthName} ${yearLabel}`,
  }
}

/** First Gregorian day of the Persian month containing `isoDate`. */
export function persianMonthStart(isoDate: string): string {
  return addDays(isoDate, -(getPersianParts(isoDate).day - 1))
}

export function previousPersianMonthStart(isoDate: string): string {
  return persianMonthStart(addDays(persianMonthStart(isoDate), -1))
}

export function nextPersianMonthStart(isoDate: string): string {
  const start = persianMonthStart(isoDate)
  const currentKey = getPersianParts(start).key
  let cursor = start

  for (let i = 0; i < 32; i += 1) {
    cursor = addDays(cursor, 1)
    if (getPersianParts(cursor).key !== currentKey) return cursor
  }

  return addDays(start, 31)
}

/** Today as a local ISO date, so the picker matches the visitor's calendar. */
export function localTodayIso(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
