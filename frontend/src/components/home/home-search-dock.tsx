"use client"

import { useRouter } from "next/navigation"
import { SearchPill } from "@/components/explore/search-pill"
import { buildAccommodationQuery } from "@/lib/search-utils"
import type { AccommodationSearchParams } from "@/types/accommodation"

/** Landing-page entry point into the full search experience. */
export function HomeSearchDock() {
  const router = useRouter()

  function handleSearch(params: Partial<AccommodationSearchParams>) {
    const query = buildAccommodationQuery(params)
    router.push(`/search${query}`)
  }

  return <SearchPill currentParams={{}} onSearch={handleSearch} variant="dock" />
}
