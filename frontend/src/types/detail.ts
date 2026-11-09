import type { City, Category, Amenity } from "@/types/accommodation"
import type { UserResponse } from "@/types/auth"

export interface AccommodationImage {
  id: number
  image_url: string
  is_cover: boolean
  sort_order: number
}

export interface AccommodationDetailData {
  id: number
  host_id: number
  category_id: number
  city_id: number
  title: string
  description: string | null
  address: string
  latitude: number | null
  longitude: number | null
  base_price: number
  cleaning_fee: number
  capacity: number
  max_capacity: number
  extra_guest_fee: number
  rooms_count: number
  beds_count: number
  min_nights: number
  check_in_time: string
  check_out_time: string
  rules: string | null
  cancellation_policy: "flexible" | "moderate" | "strict"
  is_active: boolean
  created_at: string
  host: UserResponse | null
  category: Category | null
  city: City | null
  images: AccommodationImage[]
  amenities: Amenity[]
  average_rating: number | null
  reviews_count: number
}

export interface CalendarDayInfo {
  date: string
  price: number
  is_available: boolean
  is_exception: boolean
  min_nights?: number | null
}

export interface PriceBreakdownItem {
  date: string
  price: number
  is_exception: boolean
}

export interface PriceCalculationRequest {
  accommodation_id: number
  check_in: string
  check_out: string
  guests_count: number
  coupon_code?: string | null
}

export interface PriceCalculationResponse {
  total_nights: number
  nights_total: number
  extra_guests_count: number
  extra_guest_fee_per_night: number
  extra_guest_total: number
  cleaning_fee: number
  discount_amount: number
  coupon_code: string | null
  total_price: number
  cancellation_policy: string
  breakdown: PriceBreakdownItem[]
}

export interface ReviewAuthor {
  id: number
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

export interface ReviewItem {
  id: number
  reservation_id: number
  user_id: number
  accommodation_id: number
  rating: number
  cleanliness_rating: number | null
  accuracy_rating: number | null
  comment: string
  created_at: string
  user: ReviewAuthor | null
}

export interface ReservationCreateRequest {
  accommodation_id: number
  check_in: string
  check_out: string
  guests_count: number
  coupon_code?: string | null
}

export interface ReservationResponse {
  id: number
  user_id: number
  accommodation_id: number
  check_in: string
  check_out: string
  guests_count: number
  total_nights: number
  total_price: number
  coupon_code: string | null
  status: "pending" | "confirmed" | "cancelled" | "completed"
  created_at: string
  updated_at: string
  accommodation_title?: string | null
}
