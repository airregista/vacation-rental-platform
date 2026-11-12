export interface AdminUser {
  id: number
  phone: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: "guest" | "host" | "admin" | string
  avatar_url: string | null
  shaba_number: string | null
  created_at: string
}

export interface AdminCoupon {
  id: number
  code: string
  discount_type: "percentage" | "fixed" | string
  discount_value: number | string
  max_discount_amount: number | string | null
  min_booking_amount: number | string
  valid_from: string
  valid_until: string
  usage_limit: number | null
  used_count: number
  is_active: boolean
  created_at: string
}

export type PayoutStatus = "pending" | "completed" | "cancelled"

export interface AdminPayout {
  id: number
  reservation_id: number
  host_id: number
  total_booking_amount: number | string
  commission_amount: number | string
  payout_amount: number | string
  status: PayoutStatus | string
  paid_at: string | null
  created_at: string
}

export interface AdminReservation {
  id: number
  user_id: number
  accommodation_id: number
  accommodation_title: string | null
  accommodation_image: string | null
  city: string | null
  province: string | null
  check_in: string
  check_out: string
  guests_count: number
  total_nights: number
  total_price: number | string
  coupon_code: string | null
  status: string
  created_at: string
}
