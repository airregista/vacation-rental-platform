export interface HostAccommodationItem {
  id: number
  title: string
  city: {
    id: number
    province_id: number
    name: string
    province: { id: number; name: string } | null
  } | null
  base_price: number
  is_active: boolean
  average_rating: number | null
  reviews_count: number
  cover_image: string | null
}

export interface HostReservationItem {
  id: number
  accommodation_id: number
  accommodation_title: string | null
  check_in: string
  check_out: string
  guests_count: number
  total_nights: number
  total_price: number
  status: string
  created_at: string
}

export interface HostPayoutItem {
  id: number
  reservation_id: number
  total_booking_amount: number
  commission_amount: number
  payout_amount: number
  status: "pending" | "completed" | "cancelled"
  paid_at: string | null
  created_at: string
}

export interface AccommodationCreateForm {
  title: string
  description: string
  address: string
  city_id: number
  category_id: number
  base_price: number
  cleaning_fee: number
  capacity: number
  max_capacity: number
  extra_guest_fee: number
  rooms_count: number
  beds_count: number
  rules: string
  cancellation_policy: "flexible" | "moderate" | "strict" | "custom"
  cancellation_free_hours?: number
  cancellation_penalty_percent?: number
  min_nights?: number
  is_active: boolean
  images: { image_url: string; is_cover: boolean; sort_order: number }[]
  amenity_ids: number[]
}
