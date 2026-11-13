"use client"

import * as React from "react"
import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { AlertCircle, FolderOpen, Heart, LogIn, RefreshCw, Users, Zap } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { toPersianDigits } from "@/lib/format-fa"
import type { WishlistItemResponse, WishlistToggleResponse, WishlistFolder } from "@/types/wishlist"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { FolderCarousel } from "@/components/wishlist/folder-carousel"
import { WishlistGrid } from "@/components/wishlist/wishlist-grid"
import { TravelPollModal } from "@/components/wishlist/travel-poll-modal"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const FOLDERS_STORAGE_KEY = "ashianak_wishlist_folders"
const LEGACY_FOLDERS_STORAGE_KEY = "jabama_wishlist_folders"

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
    <div className="min-h-screen bg-paper">
      <div className="border-b border-line/70 bg-paper-deep/35">
        <div className="mx-auto w-full max-w-[1360px] space-y-3 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-9 w-64 max-w-full rounded-xl" />
          <Skeleton className="h-4 w-96 max-w-full rounded-md" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-36 rounded-full" />
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-line/80 bg-paper-card p-3">
              <Skeleton className="aspect-[16/10] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-6 w-1/3" />
            </div>
          ))}
        </div>
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
        const legacyStored = localStorage.getItem(LEGACY_FOLDERS_STORAGE_KEY)
        const stored = localStorage.getItem(FOLDERS_STORAGE_KEY) ?? legacyStored
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
          if (legacyStored) localStorage.removeItem(LEGACY_FOLDERS_STORAGE_KEY)
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
            setActiveFolderId((current) => (valid.some((f) => f.id === current) ? current : "all"))
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
          `/wishlists/?skip=${skip}&limit=100`,
        )
        const batch = Array.isArray(page) ? page : []
        allItems.push(...batch)
        if (batch.length < 100) break
        skip += 100
      }
      setItems(allItems)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setFetchError(toPersianApiError(err.detail, "بارگذاری نشان‌شده‌ها با خطا مواجه شد."))
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
        `/wishlists/${accommodationId}/toggle`,
      )
      if (response.is_favorite) {
        // The toggle re-added the item (it was already removed
        // elsewhere): roll back and tell the user the removal failed.
        setItems(previousItems)
        setActionError(
          "حذف انجام نشد؛ این اقامتگاه دوباره به علاقه‌مندی‌ها اضافه شد. لطفاً دوباره تلاش کنید.",
        )
        return
      }
      // Successful removal: drop the item from every folder as well.
      setFolders((prev) =>
        prev.map((folder) => ({
          ...folder,
          accommodation_ids: (folder.accommodation_ids || []).filter(
            (id) => id !== accommodationId,
          ),
        })),
      )
    } catch (err: unknown) {
      // Rollback state on failure
      setItems(previousItems)
      if (err instanceof ApiError) {
        setActionError(
          toPersianApiError(err.detail, "حذف اقامتگاه با خطا مواجه شد. لطفاً دوباره تلاش کنید."),
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
      }),
    )
  }

  // Filtered items based on active folder
  const currentFolder = folders.find((f) => f.id === activeFolderId)
  const filteredItems = useMemo(() => {
    if (activeFolderId === "all") return items
    if (!currentFolder) return items
    return items.filter((item) => currentFolder.accommodation_ids?.includes(item.accommodation_id))
  }, [items, activeFolderId, currentFolder])

  // Summary Metrics
  const totalCount = items.length
  const activeCount = useMemo(() => {
    return items.filter((i) => i.accommodation.is_active).length
  }, [items])
  const customFoldersCount = folders.filter((f) => f.id.startsWith("folder_")).length

  // 1. Auth Loading State Guard
  if (isLoading) {
    return <WishlistPageSkeleton />
  }

  // 2. Unauthenticated State Guard
  if (!token) {
    return (
      <main className="min-h-screen bg-paper">
        <div className="mx-auto w-full max-w-lg px-4 py-16 sm:py-20">
          <div className="rounded-3xl border border-line/80 bg-paper-card p-8 shadow-soft">
            <EmptyState
              icon={Heart}
              title="اول سلیقه‌تان را ثبت کنیم"
              description="برای دیدن اقامتگاه‌های نشان‌شده، ساختن پوشه‌های سفر و هماهنگی تاریخ با همسفران، وارد حساب مهمانی خود شوید."
              showBrandMark
              action={
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button onClick={openOtpModal} className="gap-2">
                    <LogIn className="size-4" />
                    <span>ورود با شماره همراه</span>
                  </Button>
                  <Button asChild variant="outline" className="border-line bg-transparent">
                    <Link href="/login?next=/wishlists">صفحه ورود</Link>
                  </Button>
                </div>
              }
            />
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      <PageHeader
        eyebrow="نشان‌شده‌ها"
        title="قفسه سفرهای شما"
        description="اقامتگاه‌های رویایی‌تان را در پوشه‌های مجزا بچینید، با همسفران هماهنگ کنید و برای سفر بعدی برگزینید."
        actions={
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-line/80 bg-paper-card px-4 py-2.5 shadow-soft">
              <span className="grid size-9 place-items-center rounded-b-xl rounded-t-full bg-brick/10 text-brick">
                <Heart className="size-4" />
              </span>
              <div>
                <span className="block text-[11px] text-ink-soft">کل نشان‌شده‌ها</span>
                <span className="text-sm font-black tabular-nums text-ink">
                  {toPersianDigits(totalCount)} اقامتگاه
                </span>
              </div>
            </div>

            <Button
              onClick={() => setIsPollModalOpen(true)}
              className="h-auto gap-2 rounded-2xl px-4 py-3 text-xs font-bold shadow-soft"
            >
              <Users className="size-4" />
              <span>هماهنگی تاریخ با همسفران</span>
            </Button>
          </>
        }
      />

      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 pb-20 sm:px-6 lg:px-8">
        {actionError && (
          <Alert variant="destructive" className="text-right">
            <AlertCircle className="size-4" />
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {/* Summary Metrics Strip */}
        <section
          className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
          aria-label="خلاصه آمار نشان‌شده‌ها"
        >
          <div className="flex items-center justify-between rounded-2xl border border-line/80 bg-paper-card p-4 shadow-soft">
            <div className="space-y-1">
              <span className="text-xs font-medium text-ink-soft">کل اقامتگاه‌های ذخیره</span>
              <div className="text-2xl font-black tabular-nums text-ink">
                {toPersianDigits(totalCount)}
              </div>
            </div>
            <div className="grid size-11 place-items-center rounded-b-xl rounded-t-full bg-brick/10 text-brick">
              <Heart className="size-5" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-line/80 bg-paper-card p-4 shadow-soft">
            <div className="space-y-1">
              <span className="text-xs font-medium text-ink-soft">اقامتگاه‌های فعال</span>
              <div className="text-2xl font-black tabular-nums text-ink">
                {toPersianDigits(activeCount)}
              </div>
            </div>
            <div className="grid size-11 place-items-center rounded-b-xl rounded-t-full bg-gold/15 text-gold">
              <Zap className="size-5" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-line/80 bg-paper-card p-4 shadow-soft">
            <div className="space-y-1">
              <span className="text-xs font-medium text-ink-soft">پوشه‌های فعال سفر</span>
              <div className="text-2xl font-black tabular-nums text-ink">
                {toPersianDigits(customFoldersCount)}
              </div>
            </div>
            <div className="grid size-11 place-items-center rounded-b-xl rounded-t-full bg-trust/10 text-trust">
              <FolderOpen className="size-5" />
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
          <div className="rounded-2xl border border-line/80 bg-paper-card px-4 py-12">
            <EmptyState
              icon={AlertCircle}
              title="بارگذاری نشان‌شده‌ها ناتمام ماند"
              description={fetchError}
              action={
                <Button
                  variant="outline"
                  onClick={fetchAllWishlists}
                  disabled={isFetching}
                  className="gap-1.5 border-line bg-transparent"
                >
                  <RefreshCw className="size-3.5" />
                  {isFetching ? "در حال دریافت…" : "تلاش مجدد"}
                </Button>
              }
            />
          </div>
        ) : isFetching ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="space-y-3 rounded-2xl border border-line/80 bg-paper-card p-3"
              >
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
      </div>

      {/* Travel Poll Modal */}
      <TravelPollModal
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        folderName={currentFolder?.name || "سفرهای تابستانه شمال"}
      />
    </div>
  )
}
