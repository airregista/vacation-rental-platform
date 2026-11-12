import type { HostAccommodationItem, HostReservationItem } from "@/types/host"
import type { AccommodationDetailData } from "@/types/detail"

/**
 * `/accommodations/my` returns the full list-item projection; `types/host`
 * only models the subset the old dashboard happened to use.
 */
export interface HostListingRecord extends HostAccommodationItem {
  category?: { id: number; title: string } | null
  capacity: number
  max_capacity: number
  rooms_count: number
  beds_count: number
  min_nights: number
  cancellation_policy: string
}

/** `/reservations/host` includes the guest and accommodation snapshot fields. */
export interface HostReservationRecord extends HostReservationItem {
  user_id?: number
  accommodation_image?: string | null
  city?: string | null
  province?: string | null
}

/** `/accommodations/{id}` exposes calendar-owner fields not present in `types/detail`. */
export interface HostAccommodationDetail extends AccommodationDetailData {
  external_calendar_url?: string | null
  last_calendar_sync_at?: string | null
  calendar_ics_token?: string | null
}

export interface HostImageRecord {
  id: number
  image_url: string
  is_cover: boolean
  sort_order: number
}
