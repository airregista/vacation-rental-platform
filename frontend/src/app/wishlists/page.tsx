"use client"

import * as React from "react"
import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Heart,
  Zap,
  FolderOpen,
  Users,
  LogIn,
  AlertCircle,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import type {
  WishlistItemResponse,
  WishlistToggleResponse,
  WishlistFolder,
} from "@/types/wishlist"
import { FolderCarousel } from "@/components/wishlist/folder-carousel"
import { WishlistGrid } from "@/components/wishlist/wishlist-grid"
import { TravelPollModal } from "@/components/wishlist/travel-poll-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const FOLDERS_STORAGE_KEY = "ashianak_wishlist_folders"

const DEFAULT_FOLDERS: WishlistFolder[] = [
  { id: "all", name: "همه نشان‌شده‌ها", accommodation_ids: [] },
  { id: "summer-north", name: "سفرهای تابستانه شمال", accommodation_ids: [] },
  { id: "masal-cabins", name: "کلبه‌های جنگلی ماسال", accommodation_ids: [] },
  { id: "yazd-traditional", name: "خانه‌های سنتی یزد", accommodation_ids: [] },
]

function isValidStoredFolder(entry: unknown): entry is WishlistFolder {
  if (typeof entry !== "object" || entry === null) return false
  const folder = entry as Record<string, unknown>
  return (
    typeof folder.id === "string" &&
    folder.id.length > 0 &&
    typeof folder.name === "string" &&
    folder.name.trim().length > 0 &&
    Array.isArray(folder.accommodation_ids) &&
    folder.accommodation_ids.every((id) => typeof id === "number")
  )
}

function toPersianApiError(detail: string, fallback: string): string {
  if (detail.includes("Invalid or expired authentication token")) {
    return "نشست شما منقضی شده است؛ لطفاً دوباره وارد شوید."
  }
  return fallback
}

function WishlistPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8" dir="rtl">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-96 max-w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-48 rounded-xl" />
      </div>

      {/* Metrics strip skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>

      {/* Folders skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="h-10 w-36 rounded-full" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border p-3">
            <Skeleton className="aspect-[16/10] w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function WishlistsPage() {
  const { token, isLoading, openOtpModal } = useAuth()

  const [items, setItems] = useState<WishlistItemResponse[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const [activeFolderId, setActiveFolderId] = useState<string>("all")
  const [folders, setFolders] = useState<WishlistFolder[]>(DEFAULT_FOLDERS)
  const [foldersHydrated, setFoldersHydrated] = useState(false)
  const [isPollModalOpen, setIsPollModalOpen] = useState(false)

  // Load folders from localStorage once on mount (validated; invalid
  // entries are discarded, and the default "all" folder is restored
  // when missing). Deferred via setTimeout so the state updates happen
  // after mount (see react-hooks/set-state-in-effect).
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(FOLDERS_STORAGE_KEY)
        if (stored) {
          const parsed: unknown = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            const valid = parsed.filter(isValidStoredFolder)
            if (valid.length > 0) {
              if (!valid.some((f) => f.id === "all")) {
                valid.unshift(DEFAULT_FOLDERS[0])
              }
              setFolders(valid)
            }
          }
        }
      } catch {
        // Fall back to the default folders on JSON parse failure
      } finally {
        setFoldersHydrated(true)
      }
    }, 0)

    return () => clearTimeout(timer)
  }, [])

  // Persist folders on change (only after the initial load, so the
  // mount-time defaults never overwrite stored folders).
  useEffect(() => {
    if (!foldersHydrated) return
    try {
      localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders))
    } catch {
      // Handle localStorage quota errors safely
    }
  }, [folders, foldersHydrated])

  // Re-sync folders when another tab changes them. The storage event
  // only fires in other tabs, so this cannot loop with the persist
  // effect above.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== FOLDERS_STORAGE_KEY || !e.newValue) return
      try {
        const parsed: unknown = JSON.parse(e.newValue)
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(isValidStoredFolder)
          if (valid.length > 0) {
            if (!valid.some((f) => f.id === "all")) {
              valid.unshift(DEFAULT_FOLDERS[0])
            }
            setFolders(valid)
            // The active folder may have been deleted in the other
            // tab: fall back to "all" instead of pointing at a
            // deleted folder.
            setActiveFolderId((current) =>
              valid.some((f) => f.id === current) ? current : "all"
            )
          }
        }
      } catch {
        // Ignore malformed values written by other tabs
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const fetchAllWishlists = useCallback(async () => {
    setIsFetching(true)
    setFetchError(null)
    try {
      const allItems: WishlistItemResponse[] = []
      let skip = 0
      for (;;) {
        const page = await apiClient.get<WishlistItemResponse[]>(
          `/wishlists/?skip=${skip}&limit=100`
        )
        const batch = Array.isArray(page) ? page : []
        allItems.push(...batch)
        if (batch.length < 100) break
        skip += 100
      }
      setItems(allItems)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setFetchError(
          toPersianApiError(err.detail, "بارگذاری نشان‌شده‌ها با خطا مواجه شد.")
        )
      } else {
        setFetchError("بارگذاری نشان‌شده‌ها با خطا مواجه شد.")
      }
    } finally {
      setIsFetching(false)
    }
  }, [])

  useEffect(() => {
    if (!token) {
      return
    }
    // Deferred via setTimeout so the fetch's state updates happen after
    // mount (see react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      void fetchAllWishlists()
    }, 0)

    return () => clearTimeout(timer)
  }, [token, fetchAllWishlists])

  const handleRemove = async (accommodationId: number) => {
    setRemovingId(accommodationId)
    setActionError(null)
    const previousItems = items

    // Optimistic removal
    setItems((prev) => prev.filter((item) => item.accommodation_id !== accommodationId))

    try {
      const response = await apiClient.post<WishlistToggleResponse>(
        `/wishlists/${accommodationId}/toggle`
      )
      if (response.is_favorite) {
        // The toggle re-added the item (it was already removed
        // elsewhere): roll back and tell the user the removal failed.
        setItems(previousItems)
        setActionError(
          "حذف انجام نشد؛ این اقامتگاه دوباره به علاقه‌مندی‌ها اضافه شد. لطفاً دوباره تلاش کنید."
        )
        return
      }
      // Successful removal: drop the item from every folder as well.
      setFolders((prev) =>
        prev.map((folder) => ({
          ...folder,
          accommodation_ids: (folder.accommodation_ids || []).filter(
            (id) => id !== accommodationId
          ),
        }))
      )
    } catch (err: unknown) {
      // Rollback state on failure
      setItems(previousItems)
      if (err instanceof ApiError) {
        setActionError(
          toPersianApiError(
            err.detail,
            "حذف اقامتگاه با خطا مواجه شد. لطفاً دوباره تلاش کنید."
          )
        )
      } else {
        setActionError("حذف اقامتگاه با خطا مواجه شد. لطفاً دوباره تلاش کنید.")
      }
    } finally {
      setRemovingId(null)
    }
  }

  const handleToggleFolder = (folderId: string, accommodationId: number) => {
    setFolders((prev) =>
      prev.map((folder) => {
        if (folder.id !== folderId) return folder
        const ids = folder.accommodation_ids || []
        return {
          ...folder,
          accommodation_ids: ids.includes(accommodationId)
            ? ids.filter((id) => id !== accommodationId)
            : [...ids, accommodationId],
        }
      })
    )
  }

  // Filtered items based on active folder
  const currentFolder = folders.find((f) => f.id === activeFolderId)
  const filteredItems = useMemo(() => {
    if (activeFolderId === "all") return items
    if (!currentFolder) return items
    return items.filter((item) =>
      currentFolder.accommodation_ids?.includes(item.accommodation_id)
    )
  }, [items, activeFolderId, currentFolder])

  // Summary Metrics
  const totalCount = items.length
  const activeCount = useMemo(() => {
    return items.filter((i) => i.accommodation.is_active).length
  }, [items])
  const customFoldersCount = folders.filter((f) =>
    f.id.startsWith("folder_")
  ).length

  const formatPersianNumber = (num: number) => {
    return new Intl.NumberFormat("fa-IR").format(num)
  }

  // 1. Auth Loading State Guard
  if (isLoading) {
    return <WishlistPageSkeleton />
  }

  // 2. Unauthenticated State Guard
  if (!token) {
    return (
      <main className="container mx-auto px-4 py-16 text-right" dir="rtl">
        <Card className="max-w-md mx-auto text-center p-8 rounded-2xl border border-border shadow-sm">
          <CardContent className="space-y-6 pt-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto">
              <Heart className="w-8 h-8 fill-primary/30 text-primary" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">
                علاقه‌مندی‌ها و سفرنامه‌ها
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                برای مشاهده و دسته‌بندی اقامتگاه‌های نشان‌شده، لطفاً وارد حساب کاربری خود شوید.
              </p>
            </div>

            <Button onClick={openOtpModal} className="w-full gap-2 font-bold py-5">
              <LogIn className="w-4 h-4" />
              <span>ورود یا ثبت‌نام در جاباما</span>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 space-y-6 text-right" dir="rtl">
      {/* Header & Main Actions */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            علاقه‌مندی‌ها و سفرنامه‌های من
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            اقامتگاه‌های رویایی خود را در پوشه‌های مجزا دسته‌بندی کنید و در زمان مناسب رزرو نمایید.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            onClick={() => setIsPollModalOpen(true)}
            className="gap-2 font-bold shadow-sm"
          >
            <Users className="w-4 h-4" />
            <span>هماهنگی تاریخ با همسفران</span>
          </Button>
        </div>
      </header>

      {/* Action Error Alert */}
      {actionError && (
        <Alert variant="destructive" className="text-right">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>خطا</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Bento Summary Metrics Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4" aria-label="خلاصه آمار نشان‌شده‌ها">
        {/* Metric 1 */}
        <div className="bg-card p-4 rounded-2xl border border-border/70 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              کل اقامتگاه‌های ذخیره
            </span>
            <div className="text-2xl font-black text-foreground font-price">
              {formatPersianNumber(totalCount)}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Heart className="w-5 h-5 fill-primary text-primary" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-card p-4 rounded-2xl border border-border/70 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              اقامتگاه‌های فعال
            </span>
            <div className="text-2xl font-black text-foreground font-price">
              {formatPersianNumber(activeCount)}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Zap className="w-5 h-5 fill-amber-500 text-amber-500" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-card p-4 rounded-2xl border border-border/70 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              پوشه‌های فعال سفر
            </span>
            <div className="text-2xl font-black text-foreground font-price">
              {formatPersianNumber(customFoldersCount)}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary-foreground">
            <FolderOpen className="w-5 h-5 text-primary" />
          </div>
        </div>
      </section>

      {/* Folders Carousel */}
      <FolderCarousel
        folders={folders}
        onFoldersChange={setFolders}
        activeFolderId={activeFolderId}
        onSelectFolder={setActiveFolderId}
        totalItemsCount={totalCount}
      />

      {/* Fetch Error or Wishlist Grid */}
      {fetchError ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-sm text-destructive">{fetchError}</p>
          <Button variant="outline" onClick={fetchAllWishlists} disabled={isFetching}>
            تلاش مجدد
          </Button>
        </div>
      ) : isFetching ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 my-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-border p-3">
              <Skeleton className="aspect-[16/10] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-6 w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <WishlistGrid
          items={filteredItems}
          onRemove={handleRemove}
          isRemoving={removingId}
          folders={folders}
          onToggleFolder={handleToggleFolder}
          emptyTitle={
            activeFolderId !== "all" && currentFolder
              ? `هیچ اقامتگاهی در پوشه «${currentFolder.name}» ذخیره نشده است`
              : "هنوز هیچ اقامتگاهی را نشان نکرده‌اید"
          }
          emptyDescription={
            activeFolderId !== "all"
              ? "می‌توانید اقامتگاه‌های دلخواه خود را در این پوشه دسته‌بندی نمایید."
              : "با کلیک بر روی آیکون قلب در کارت هر اقامتگاه، آن را برای سفرهای آتی در این بخش نگه دارید."
          }
        />
      )}

      {/* Travel Poll Modal */}
      <TravelPollModal
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        folderName={currentFolder?.name || "سفرهای تابستانه شمال"}
      />
    </main>
  )
}
