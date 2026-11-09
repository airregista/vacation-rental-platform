export interface Province {
  id: number
  name: string
}

export interface City {
  id: number
  province_id: number
  name: string
  province?: Province | null
}

export interface Category {
  id: number
  title: string
  slug: string
  icon_url?: string | null
}

export interface Amenity {
  id: number
  name: string
  icon?: string | null
}

export interface AccommodationListItem {
  id: number
  title: string
  city: City | null
  category: Category | null
  base_price: number
  capacity: number
  max_capacity: number
  rooms_count: number
  beds_count: number
  min_nights: number
  cover_image: string | null
  cancellation_policy: string
  average_rating: number | null
  reviews_count: number
  is_active: boolean
}

export interface AccommodationSearchParams {
  city_id?: number
  province_id?: number
  category_id?: number
  guests_count?: number
  min_rooms?: number
  min_beds?: number
  min_price?: number
  max_price?: number
  check_in?: string
  check_out?: string
  amenity_ids?: number[]
  sort_by?: "newest" | "price_asc" | "price_desc"
  skip?: number
  limit?: number
}
