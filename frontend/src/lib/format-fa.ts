export function toPersianDigits(n: number | string): string {
  return new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(Number(n) || 0)
}

export function formatPersianDate(dateStr: string): string {
  if (!dateStr) return ""
  try {
    const isoStr = dateStr.includes("T")
      ? (dateStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateStr) ? dateStr : `${dateStr}Z`)
      : `${dateStr}T00:00:00Z`
    const d = new Date(isoStr)
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(d)
  } catch {
    return dateStr
  }
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
