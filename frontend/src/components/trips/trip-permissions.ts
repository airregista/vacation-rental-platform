"use client"

import { useEffect, useMemo, useState } from "react"
import type { TripReservationItem } from "@/types/trips"

// Bare dates use the backend defaults (check-in 14:00, check-out 12:00
// Tehran time; cancellation_service.py falls back to time(14, 0)). The
// per-accommodation times are authoritative on the server.
const CHECK_IN_FALLBACK_TIME = "T10:30:00Z"
const CHECK_OUT_FALLBACK_TIME = "T08:30:00Z"

function parseTripDate(dateStr: string, fallbackTime: string): number {
  try {
    const isoStr = dateStr.includes("T") ? dateStr : `${dateStr}${fallbackTime}`
    return new Date(isoStr).getTime()
  } catch {
    return 0
  }
}

export interface TripPermissions {
  checkInTimestamp: number
  checkOutTimestamp: number
  canCancel: boolean
  canReview: boolean
  canChat: boolean
}

/**
 * Single source of truth for the guest action guards. Kept out of the card so
 * the reservation detail page cannot drift from the list.
 */
export function getTripPermissions(
  trip: TripReservationItem,
  now: number
): TripPermissions {
  const checkInTimestamp = parseTripDate(trip.check_in, CHECK_IN_FALLBACK_TIME)
  const checkOutTimestamp = parseTripDate(trip.check_out, CHECK_OUT_FALLBACK_TIME)

  return {
    checkInTimestamp,
    checkOutTimestamp,
    canCancel: trip.status === "confirmed" && checkInTimestamp > now,
    canReview:
      trip.status === "completed" ||
      (trip.status === "confirmed" && checkOutTimestamp <= now),
    canChat: trip.status === "confirmed" || trip.status === "completed",
  }
}

/** Refreshes "now" every 60 seconds so the guards do not go stale. */
export function useTripPermissions(trip: TripReservationItem): TripPermissions {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])

  return useMemo(() => getTripPermissions(trip, now), [trip, now])
}
