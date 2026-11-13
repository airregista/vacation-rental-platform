"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/context/auth-context"
import { buildAccommodationQuery, parseAccommodationQuery } from "@/lib/search-utils"
import type { AccommodationListItem, AccommodationSearchParams } from "@/types/accommodation"
import { SearchPill } from "@/components/explore/search-pill"
import { CategoryBar } from "@/components/explore/category-bar"
import { FilterDialog } from "@/components/explore/filter-dialog"
import { AccommodationGrid } from "@/components/explore/accommodation-grid"
import { Button } from "@/components/ui/button"
import { AlertCircle, RotateCcw } from "lucide-react"

function SearchContent() {
  const searchParamsHook = useSearchParams()
  const { token, openOtpModal } = useAuth()

  const [searchParams, setSearchParams] = React.useState<AccommodationSearchParams>(() =>
    parseAccommodationQuery(searchParamsHook),
  )
  const [searchKey, setSearchKey] = React.useState<number>(0)
  const [accommodations, setAccommodations] = React.useState<AccommodationListItem[]>([])
  const [wishlistIds, setWishlistIds] = React.useState<Set<number>>(new Set())
  const [pendingWishlistIds, setPendingWishlistIds] = React.useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [isFilterOpen, setIsFilterOpen] = React.useState<boolean>(false)
  const [reloadTrigger, setReloadTrigger] = React.useState<number>(0)

  // Keep the address bar canonical and deep-linkable.
  const isFirstRender = React.useRef(true)
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      if (typeof window !== "undefined") {
        const canonicalQuery = buildAccommodationQuery(searchParams)
        if (canonicalQuery !== window.location.search) {
          window.history.replaceState(
            null,
            "",
            canonicalQuery ? `/search${canonicalQuery}` : "/search",
          )
        }
      }
      return
    }
    const queryString = buildAccommodationQuery(searchParams)
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", queryString ? `/search${queryString}` : "/search")
    }
  }, [searchParams])

  const activeWishlistIds = React.useMemo(
    () => (token ? wishlistIds : new Set<number>()),
    [token, wishlistIds],
  )

  const wishlistSeqRef = React.useRef(0)

  React.useEffect(() => {
    const seq = ++wishlistSeqRef.current
    let isMounted = true
    // Never show the previous account's favourites while the new set loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWishlistIds(new Set())
    if (!token) return

    apiClient
      .get<Array<{ accommodation_id: number }>>("/wishlists/?limit=100")
      .then((data) => {
        if (isMounted && seq === wishlistSeqRef.current && Array.isArray(data)) {
          setWishlistIds(new Set(data.map((w) => w.accommodation_id)))
        }
      })
      .catch((err) => {
        console.error("Failed to load wishlist items:", err)
        if (isMounted && seq === wishlistSeqRef.current) {
          setWishlistIds(new Set())
        }
      })

    return () => {
      isMounted = false
    }
  }, [token])

  const fetchSeqRef = React.useRef(0)

  React.useEffect(() => {
    let isMounted = true
    const seq = ++fetchSeqRef.current
    const isLatest = () => isMounted && seq === fetchSeqRef.current
    const queryString = buildAccommodationQuery(searchParams)

    // Trailing slash avoids FastAPI's 307 redirect.
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
          setFetchError(
            "خطا در بارگذاری اقامتگاه‌ها. لطفاً اتصال اینترنت را بررسی کرده و مجدداً تلاش کنید.",
          )
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [searchParams, reloadTrigger])

  const handleSelectCategory = (categoryId?: number) => {
    if (searchParams.category_id === categoryId) return
    setIsLoading(true)
    setSearchParams((prev) => ({ ...prev, category_id: categoryId, skip: 0 }))
  }

  const handleSearch = (newParams: Partial<AccommodationSearchParams>) => {
    setIsLoading(true)
    setSearchParams((prev) => ({ ...prev, ...newParams, skip: 0 }))
  }

  const handleApplyFilters = (filters: Partial<AccommodationSearchParams>) => {
    setIsLoading(true)
    setSearchParams((prev) => ({ ...prev, ...filters, skip: 0 }))
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
    if (pendingWishlistIds.has(id)) return

    setPendingWishlistIds((prev) => new Set(prev).add(id))

    setWishlistIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

    try {
      const res = await apiClient.post<{ accommodation_id: number; is_favorite: boolean }>(
        `/wishlists/${id}/toggle`,
      )
      if (res && typeof res.is_favorite === "boolean") {
        setWishlistIds((prev) => {
          const next = new Set(prev)
          if (res.is_favorite) next.add(id)
          else next.delete(id)
          return next
        })
      }
    } catch (err) {
      console.error("Failed to toggle wishlist:", err)
      setWishlistIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
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
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <section className="border-b border-line/70 bg-paper/95 py-4 backdrop-blur sm:py-5">
        <div className="mx-auto max-w-6xl space-y-3 px-4 sm:px-6 lg:px-8">
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

      <FilterDialog
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        currentParams={searchParams}
        onApplyFilters={handleApplyFilters}
      />

      <section aria-label="محتوای اقامتگاه‌ها" className="flex-1 py-6 sm:py-8">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-brick">کاوش</p>
              <h1 className="mt-2 text-balance text-2xl font-black tracking-tight text-ink sm:text-3xl">
                اقامتگاه‌های بومی ایران
              </h1>
            </div>
            {!isLoading && !fetchError ? (
              <p className="text-xs text-ink-soft">
                {new Intl.NumberFormat("fa-IR").format(accommodations.length)} اقامتگاه
              </p>
            ) : null}
          </div>

          {fetchError ? (
            <div className="mx-auto max-w-md space-y-4 py-16 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertCircle className="size-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">خطا در برقراری ارتباط</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{fetchError}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleRetry}
                className="gap-2 rounded-full border-line text-xs font-semibold"
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
        </div>
      </section>
    </div>
  )
}

export default function SearchPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-paper">
          <div className="h-32 border-b border-line/70" />
          <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
            <AccommodationGrid
              items={[]}
              isLoading={true}
              wishlistIds={new Set()}
              onToggleWishlist={() => {}}
            />
          </div>
        </div>
      }
    >
      <SearchContent />
    </React.Suspense>
  )
}
