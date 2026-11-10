"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/context/auth-context"
import { buildAccommodationQuery, parseAccommodationQuery } from "@/lib/search-utils"
import type {
  AccommodationListItem,
  AccommodationSearchParams,
} from "@/types/accommodation"
import { SearchPill } from "@/components/explore/search-pill"
import { CategoryBar } from "@/components/explore/category-bar"
import { FilterDialog } from "@/components/explore/filter-dialog"
import { AccommodationGrid } from "@/components/explore/accommodation-grid"
import { Button } from "@/components/ui/button"
import { AlertCircle, RotateCcw } from "lucide-react"

function HomeContent() {
  const searchParamsHook = useSearchParams()
  const { token, openOtpModal } = useAuth()

  // State initialized from URL query parameters
  const [searchParams, setSearchParams] = React.useState<AccommodationSearchParams>(() =>
    parseAccommodationQuery(searchParamsHook)
  )
  const [searchKey, setSearchKey] = React.useState<number>(0)
  const [accommodations, setAccommodations] = React.useState<AccommodationListItem[]>([])
  const [wishlistIds, setWishlistIds] = React.useState<Set<number>>(new Set())
  const [pendingWishlistIds, setPendingWishlistIds] = React.useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [isFilterOpen, setIsFilterOpen] = React.useState<boolean>(false)
  const [reloadTrigger, setReloadTrigger] = React.useState<number>(0)

  // Synchronize state changes to browser URL query string for deep-linking
  const isFirstRender = React.useRef(true)
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const queryString = buildAccommodationQuery(searchParams)
    const newUrl = queryString ? `/${queryString}` : "/"
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", newUrl)
    }
  }, [searchParams])

  // Derive active wishlist IDs ensuring logged-out sessions immediately clear cached favorites
  const activeWishlistIds = React.useMemo(
    () => (token ? wishlistIds : new Set<number>()),
    [token, wishlistIds]
  )

  // Load wishlists if user is logged in
  React.useEffect(() => {
    let isMounted = true
    if (!token) {
      // Clear stale IDs from a previous user so their favourites never
      // leak into a logged-out session or a different user's session.
      // Syncing this state to the external auth state on logout is the
      // effect's job; the derived activeWishlistIds memo only hides the
      // stale set while logged out, it does not clear the source of truth.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWishlistIds(new Set())
      return
    }

    apiClient
      .get<Array<{ accommodation_id: number }>>("/wishlists/?limit=100")
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setWishlistIds(new Set(data.map((w) => w.accommodation_id)))
        }
      })
      .catch((err) => {
        console.error("Failed to load wishlist items:", err)
        // A failed refetch (e.g. after a user switch) must not leave the
        // previous user's favourites displayed as the new user's.
        if (isMounted) {
          setWishlistIds(new Set())
        }
      })

    return () => {
      isMounted = false
    }
  }, [token])

  // Sequence number so a stale (superseded) fetch response can never
  // overwrite newer results when filters change in quick succession.
  const fetchSeqRef = React.useRef(0)

  // Fetch accommodations whenever searchParams or reloadTrigger change
  React.useEffect(() => {
    let isMounted = true
    const seq = ++fetchSeqRef.current
    const isLatest = () => isMounted && seq === fetchSeqRef.current
    const queryString = buildAccommodationQuery(searchParams)

    // Note the mandatory trailing slash to prevent FastAPI 307 temporary redirects
    apiClient
      .get<AccommodationListItem[]>(`/accommodations/${queryString}`)
      .then((data) => {
        if (isLatest()) {
          setAccommodations(data || [])
          setFetchError(null)
          setIsLoading(false)
        }
      })
      .catch((err: unknown) => {
        console.error("Error fetching accommodations:", err)
        if (isLatest()) {
          setFetchError("خطا در بارگذاری اقامتگاه‌ها. لطفاً اتصال اینترنت را بررسی کرده و مجدداً تلاش کنید.")
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [searchParams, reloadTrigger])

  // Handlers
  const handleSelectCategory = (categoryId?: number) => {
    setIsLoading(true)
    setSearchParams((prev) => ({
      ...prev,
      category_id: categoryId,
      skip: 0,
    }))
  }

  const handleSearch = (newParams: Partial<AccommodationSearchParams>) => {
    setIsLoading(true)
    setSearchParams((prev) => ({
      ...prev,
      ...newParams,
      skip: 0,
    }))
  }

  const handleApplyFilters = (filters: Partial<AccommodationSearchParams>) => {
    setIsLoading(true)
    setSearchParams((prev) => ({
      ...prev,
      ...filters,
      skip: 0,
    }))
  }

  const handleClearFilters = () => {
    setIsLoading(true)
    setSearchParams({})
    setSearchKey((k) => k + 1)
  }

  const handleRetry = () => {
    setIsLoading(true)
    setFetchError(null)
    setReloadTrigger((r) => r + 1)
  }

  const handleToggleWishlist = async (id: number) => {
    if (!token) {
      openOtpModal()
      return
    }

    // Prevent duplicate in-flight requests for the same accommodation
    if (pendingWishlistIds.has(id)) {
      return
    }

    setPendingWishlistIds((prev) => new Set(prev).add(id))

    // Optimistic toggle
    setWishlistIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

    try {
      const res = await apiClient.post<{ accommodation_id: number; is_favorite: boolean }>(
        `/wishlists/${id}/toggle`
      )
      // Reconcile with authoritative server state
      if (res && typeof res.is_favorite === "boolean") {
        setWishlistIds((prev) => {
          const next = new Set(prev)
          if (res.is_favorite) {
            next.add(id)
          } else {
            next.delete(id)
          }
          return next
        })
      }
    } catch (err) {
      console.error("Failed to toggle wishlist:", err)
      // Rollback on failure
      setWishlistIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    } finally {
      setPendingWishlistIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Search & Filter Bar */}
      <section className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-3">
          <SearchPill
            key={searchKey}
            currentParams={searchParams}
            onSearch={handleSearch}
            onOpenFilters={() => setIsFilterOpen(true)}
          />

          <CategoryBar
            selectedCategoryId={searchParams.category_id}
            onSelectCategory={handleSelectCategory}
          />
        </div>
      </section>

      {/* Advanced Filter Modal */}
      <FilterDialog
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        currentParams={searchParams}
        onApplyFilters={handleApplyFilters}
      />

      {/* Main Accommodations Content */}
      <section aria-label="محتوای اقامتگاه‌ها" className="flex-1 py-4">
        {fetchError ? (
          <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
            <div className="size-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertCircle className="size-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">خطا در برقراری ارتباط</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{fetchError}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleRetry}
              className="gap-2 rounded-full text-xs font-semibold"
            >
              <RotateCcw className="size-3.5" />
              <span>تلاش مجدد</span>
            </Button>
          </div>
        ) : (
          <AccommodationGrid
            items={accommodations}
            isLoading={isLoading}
            wishlistIds={activeWishlistIds}
            pendingWishlistIds={pendingWishlistIds}
            onToggleWishlist={handleToggleWishlist}
            onClearFilters={handleClearFilters}
          />
        )}
      </section>
    </div>
  )
}

export default function Home() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col min-h-screen bg-background">
          <section className="border-b border-border/60 bg-background/95 py-4 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto h-24" />
          </section>
          <section aria-label="محتوای اقامتگاه‌ها" className="flex-1 py-4">
            <AccommodationGrid
              items={[]}
              isLoading={true}
              wishlistIds={new Set()}
              onToggleWishlist={() => {}}
            />
          </section>
        </div>
      }
    >
      <HomeContent />
    </React.Suspense>
  )
}
