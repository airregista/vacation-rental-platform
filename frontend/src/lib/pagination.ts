import { apiClient } from "@/lib/api-client"
import type { PaymentResponse } from "@/types/checkout"

/**
 * The backend defaults list endpoints to limit=20, so the host views must walk
 * every page to show complete totals and lists.
 */
export async function fetchAllPages<T>(path: string): Promise<T[]> {
  const all: T[] = []
  let skip = 0
  for (;;) {
    const page = await apiClient.get<T[]>(`${path}?skip=${skip}&limit=100`)
    const batch = Array.isArray(page) ? page : []
    all.push(...batch)
    if (batch.length < 100) break
    skip += 100
  }
  return all
}

const PAGE_SIZE = 100
const MAX_PAYMENT_PAGES = 10

/**
 * `/payments/my` also defaults to limit=20 and is newest-first, so a frequent
 * guest may have more than one page of newer payments before the one we need.
 * The walk is capped at MAX_PAYMENT_PAGES to bound worst-case latency.
 */
export async function findLatestSuccessfulPayment(
  reservationId: number
): Promise<PaymentResponse | null> {
  let skip = 0

  for (let page = 0; page < MAX_PAYMENT_PAGES; page += 1) {
    const payments = await apiClient.get<PaymentResponse[]>(
      `/payments/my?limit=${PAGE_SIZE}&skip=${skip}`
    )
    const found = payments.find(
      (payment) =>
        payment.reservation_id === reservationId && payment.status === "success"
    )
    if (found) return found
    if (payments.length < PAGE_SIZE) return null
    skip += PAGE_SIZE
  }

  return null
}
