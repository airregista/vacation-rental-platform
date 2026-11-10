export type ReservationStatus = "pending" | "confirmed" | "completed" | "cancelled"

export interface TripReservationItem {
  id: number
  user_id: number
  accommodation_id: number
  accommodation_title?: string | null
  accommodation_image?: string | null
  city?: string | null
  province?: string | null
  check_in: string
  check_out: string
  guests_count: number
  total_nights: number
  total_price: number | string
  coupon_code?: string | null
  status: ReservationStatus
  cancelled_at?: string | null
  cancellation_reason?: string | null
  refund_amount?: number | string | null
  penalty_amount?: number | string | null
  created_at: string
  updated_at: string
}

export interface CancellationPreviewData {
  reservation_id: number
  cancellation_policy: string
  hours_to_checkin: number
  total_price: number | string
  refundable_amount: number | string
  penalty_amount: number | string
}

export interface CancellationResponseData {
  reservation_id: number
  status: string
  refund_amount: number | string
  penalty_amount: number | string
  message: string
}

export interface ChatMessageItem {
  id: number
  reservation_id: number
  sender_id: number
  sender_name?: string | null
  message: string
  read_at?: string | null
  created_at: string
}

export interface ReviewSubmissionPayload {
  reservation_id: number
  rating: number
  cleanliness_rating?: number | null
  accuracy_rating?: number | null
  comment: string
}
