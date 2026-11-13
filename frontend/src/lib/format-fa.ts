export function toPersianDigits(n: number | string): string {
  // Convert character-by-character so leading zeros survive: IDs such as
  // "0042", OTPs, card numbers and timers must not be re-parsed as numbers.
  return String(n).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])
}

/** Normalise a bare date/timestamp to a UTC-parsable ISO string. */
function toUtcIso(dateStr: string): string {
  return dateStr.includes("T")
    ? dateStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateStr)
      ? dateStr
      : `${dateStr}Z`
    : `${dateStr}T00:00:00Z`
}

// Date-only inputs ("YYYY-MM-DD") stay UTC-anchored so the calendar day never
// shifts; real timestamps (containing "T") must render in Asia/Tehran, or
// records created 00:00–03:30 Tehran display as the previous day.
const persianDateOnly = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
})
const persianInstant = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Tehran",
})
const persianLongDateOnly = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "long",
  timeZone: "UTC",
})
const persianLongInstant = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "long",
  timeZone: "Asia/Tehran",
})

export function formatPersianDate(dateStr: string): string {
  if (!dateStr) return ""
  try {
    const d = new Date(toUtcIso(dateStr))
    return (dateStr.includes("T") ? persianInstant : persianDateOnly).format(d)
  } catch {
    return dateStr
  }
}

/** Long-form Persian date for invoices — own format options, shared ISO normalisation. */
export function formatPersianLongDate(dateStr?: string): string {
  if (!dateStr) return "-"
  try {
    const d = new Date(toUtcIso(dateStr))
    return (dateStr.includes("T") ? persianLongInstant : persianLongDateOnly).format(d)
  } catch {
    return dateStr
  }
}

/** Numeric "month/day" Persian date for compact date boxes (booking widget). */
export function formatPersianShortDate(isoStr: string): string {
  try {
    const d = new Date(isoStr + "T00:00:00Z")
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      timeZone: "UTC",
      month: "numeric",
      day: "numeric",
    }).format(d)
  } catch {
    return isoStr
  }
}

const faNumberFormatter = new Intl.NumberFormat("fa-IR")

/** Persian digits with grouping, canonical implementation for every price and count display. */
export function formatFaNumber(value: number | string | null | undefined): string {
  const parsed = typeof value === "number" ? value : Number(value ?? 0)
  return faNumberFormatter.format(Number.isFinite(parsed) ? parsed : 0)
}

export function formatMessageTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    return new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Tehran",
    }).format(d)
  } catch {
    return ""
  }
}
