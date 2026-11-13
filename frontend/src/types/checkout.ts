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
  cancellation_policy?: "flexible" | "moderate" | "strict" | "custom" | string
  cancellation_free_hours?: number
  cancellation_penalty_percent?: number
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
  onFailure?: (reason: string) => void
}

export interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  data: InvoiceData
}
