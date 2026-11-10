export interface ReservationDetail {
  id: number
  user_id: number
  accommodation_id: number
  check_in: string // YYYY-MM-DD
  check_out: string // YYYY-MM-DD
  guests_count: number
  total_nights: number
  total_price: number | string
  coupon_code: string | null
  status: "pending" | "confirmed" | "cancelled" | "completed"
  cancelled_at: string | null
  cancellation_reason: string | null
  refund_amount: number | string | null
  penalty_amount: number | string | null
  created_at: string
  updated_at: string
  accommodation_title: string | null
}

export interface CheckoutAccommodationInfo {
  id: number
  title: string
  city?: {
    id: number
    name: string
    province?: { id: number; name: string } | null
  } | null
  address?: string | null
  base_price?: number
  cleaning_fee?: number
  cancellation_policy?: "flexible" | "moderate" | "strict" | string
  images?: Array<{
    id: number
    image_url: string
    is_cover?: boolean
  }>
  host?: {
    id: number
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    phone?: string
  } | null
}

export interface PaymentInitiateRequest {
  reservation_id: number
}

export interface PaymentInitiateResponse {
  payment_id: number
  reservation_id: number
  amount: number
  tracking_code: string
  gateway_url: string
}

export interface PaymentVerifyRequest {
  payment_id: number
  tracking_code: string
  simulate_success?: boolean
}

export interface PaymentResponse {
  id: number
  reservation_id: number
  amount: number
  tracking_code: string | null
  status: "pending" | "success" | "failed" | string
  paid_at: string | null
  created_at: string
}

export interface InvoiceGuestInfo {
  full_name?: string
  phone?: string
  national_code?: string
  email?: string
}

export interface InvoiceData {
  invoice_number: string
  issuance_date: string
  reservation: ReservationDetail
  accommodation?: CheckoutAccommodationInfo | null
  payment: PaymentResponse
  guest?: InvoiceGuestInfo | null
}

export interface PaymentGatewayModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: ReservationDetail
  onSuccess: (payment: PaymentResponse) => void
  initialGateway?: string
  onStatusChange?: (status: "cancelled", reason: string) => void
}

export interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  data: InvoiceData
}

export interface CheckoutPriceBreakdown {
  totalPayable: number
  cleaningFee: number
  basePrice: number
  baseTotal: number
  discountAmount: number
}

export function computeCheckoutBreakdown(
  reservation: { total_price?: number | string | null; total_nights: number; coupon_code?: string | null },
  accommodation?: { cleaning_fee?: number | null; base_price?: number | null } | null,
  overrideAmount?: number | string | null
): CheckoutPriceBreakdown {
  const rawTotal = overrideAmount !== undefined && overrideAmount !== null
    ? overrideAmount
    : reservation.total_price
  const totalPayable = Math.max(0, typeof rawTotal === "string" ? Number(rawTotal.replace(/,/g, "")) || 0 : Number(rawTotal) || 0)
  // Display-level clamp (T10): fees are read from the live accommodation, not
  // a booking snapshot, so a host edit after booking could otherwise show a
  // cleaning fee larger than the total payable. A reservation fee snapshot is
  // a future schema change, not this round.
  const cleaningFee = Math.min(
    totalPayable,
    Math.max(0, Number(accommodation?.cleaning_fee) || 0)
  )
  const basePrice = Math.max(0, Number(accommodation?.base_price) || 0)

  const baseTotal = !reservation.coupon_code
    ? Math.max(0, totalPayable - cleaningFee)
    : Math.max(
        basePrice > 0 ? basePrice * reservation.total_nights : 0,
        Math.max(0, totalPayable - cleaningFee)
      )

  const discountAmount = reservation.coupon_code
    ? Math.max(0, baseTotal + cleaningFee - totalPayable)
    : 0

  return { totalPayable, cleaningFee, basePrice, baseTotal, discountAmount }
}

export function formatFaPrice(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "-"
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v)
  if (!Number.isFinite(n) || n < 0) return "-"
  return new Intl.NumberFormat("fa-IR").format(Math.round(n))
}

function formatPersianYear(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

export function getPersianYear(dateStr?: string | null): string {
  // Fallback is the current Persian year, derived from now — never hardcoded (R5).
  const fallbackYear = () => formatPersianYear(new Date())
  try {
    if (!dateStr) return fallbackYear()
    // Same naive-timestamp normalisation as countdown-timer / invoice-modal:
    // a bare timestamp is UTC, so append "Z" before parsing — otherwise a
    // timestamp near the Nowruz boundary can yield the wrong Persian year (R5).
    const isoStr = dateStr.includes("T")
      ? dateStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateStr)
        ? dateStr
        : `${dateStr}Z`
      : `${dateStr}T00:00:00Z`
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return fallbackYear()
    return formatPersianYear(d)
  } catch {
    return fallbackYear()
  }
}


