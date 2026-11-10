import type { AccommodationListItem } from "./accommodation"

export interface WishlistItemResponse {
  user_id: number
  accommodation_id: number
  created_at: string
  accommodation: AccommodationListItem
}

export interface WishlistToggleResponse {
  accommodation_id: number
  is_favorite: boolean
  message: string
}

export interface WishlistFolder {
  id: string
  name: string
  icon?: string
  accommodation_ids: number[]
  created_at?: string
}

export interface DatePollOption {
  id: string
  title: string
  date_range: string
  nights_count: number
  votes: number
  voted: boolean
  holiday_tag?: string
  is_holiday?: boolean
  is_budget?: boolean
  voters?: string[]
}
