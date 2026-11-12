"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Plus,
  Power,
  PowerOff,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import type { HostAccommodationDetail, HostListingRecord } from "@/components/host/types"
import { HostAccessGate } from "@/components/host/host-access-gate"
import { HostPageLayout } from "@/components/host/host-page-layout"
import { HostStatCard } from "@/components/host/host-stat-card"
import { HostListingCard } from "@/components/host/listing-card"
import { EmptyState } from "@/components/shared/empty-state"
import {
  fetchAllPages,
  formatFaNumber,
  getApiErrorMessage,
} from "@/components/host/host-utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

function ListingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-80 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

function HostListingsContent() {
  const [listings, setListings] = React.useState<HostListingRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<HostListingRecord | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let isCurrent = true

    const loadListings = async () => {
      try {
        const nextListings = await fetchAllPages<HostListingRecord>("/accommodations/my")
        if (!isCurrent) return
        setListings(nextListings)
        setFetchError(null)
      } catch (error: unknown) {
        if (!isCurrent) return
        setFetchError(
          getApiErrorMessage(error, "بارگذاری اقامتگاه‌های شما با خطا مواجه شد.")
        )
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void loadListings()
    return () => {
      isCurrent = false
    }
  }, [reloadKey])

  const activeCount = React.useMemo(
    () => listings.filter((listing) => listing.is_active).length,
    [listings]
  )

  const handleRetry = () => {
    setIsLoading(true)
    setFetchError(null)
    setReloadKey((key) => key + 1)
  }

  const handleToggleActive = async (listing: HostListingRecord) => {
    setBusyId(listing.id)
    setActionError(null)
    setNotice(null)
    try {
      const updated = await apiClient.put<HostAccommodationDetail>(
        `/accommodations/${listing.id}`,
        { is_active: !listing.is_active }
      )
      setListings((current) =>
        current.map((item) =>
          item.id === listing.id ? { ...item, is_active: updated.is_active } : item
        )
      )
      setNotice(
        updated.is_active
          ? `«${listing.title}» منتشر شد و از این پس قابل رزرو است.`
          : `«${listing.title}» غیرفعال شد و از نتایج جستجو خارج شد.`
      )
    } catch (error: unknown) {
      setActionError(
        getApiErrorMessage(error, "تغییر وضعیت انتشار اقامتگاه با خطا مواجه شد.")
      )
    } finally {
      setBusyId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setActionError(null)
    setNotice(null)
    try {
      await apiClient.delete(`/accommodations/${deleteTarget.id}`)
      setListings((current) =>
        current.map((item) =>
          item.id === deleteTarget.id ? { ...item, is_active: false } : item
        )
      )
      setNotice(
        `«${deleteTarget.title}» از فهرست فعال حذف شد. پرونده اقامتگاه برای سابقه حفظ می‌شود.`
      )
      setDeleteTarget(null)
    } catch (error: unknown) {
      setActionError(getApiErrorMessage(error, "حذف اقامتگاه با خطا مواجه شد."))
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) return <ListingsSkeleton />

  return (
    <div className="space-y-6">
      {fetchError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>خطا در دریافت اطلاعات</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{fetchError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="border-line bg-transparent"
            >
              تلاش مجدد
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>عملیات انجام نشد</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {notice ? (
        <Alert className="border-trust/30 bg-trust/10 text-trust">
          <CheckCircle2 className="size-4" />
          <AlertTitle>انجام شد</AlertTitle>
          <AlertDescription className="text-trust">{notice}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="خلاصه اقامتگاه‌ها">
        <HostStatCard
          icon={Building2}
          label="کل اقامتگاه‌ها"
          value={formatFaNumber(listings.length)}
          hint="ثبت‌شده با حساب شما"
          tone="brick"
        />
        <HostStatCard
          icon={Power}
          label="فعال و قابل رزرو"
          value={formatFaNumber(activeCount)}
          hint="منتشرشده در نتایج جستجو"
          tone="trust"
        />
        <HostStatCard
          icon={PowerOff}
          label="غیرفعال"
          value={formatFaNumber(listings.length - activeCount)}
          hint="در انتظار تکمیل یا انتشار"
          tone="gold"
        />
      </section>

      {listings.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="هنوز اقامتگاهی ثبت نکرده‌اید"
          description="اولین اقامتگاه خود را ثبت کنید؛ پس از تایید اطلاعات، مهمان‌ها می‌توانند آن را ببینند و رزرو کنند."
          action={
            <Button asChild className="gap-2">
              <Link href="/host/new">
                <Plus className="size-4" aria-hidden="true" />
                <span>ثبت اقامتگاه جدید</span>
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <HostListingCard
              key={listing.id}
              listing={listing}
              isBusy={busyId === listing.id}
              onToggleActive={handleToggleActive}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null)
        }}
      >
        <DialogContent dir="rtl" className="text-right sm:max-w-md">
          <DialogHeader>
            <DialogTitle>حذف اقامتگاه</DialogTitle>
            <DialogDescription>
              آیا از حذف «{deleteTarget?.title}» مطمئن هستید؟ این اقامتگاه از فهرست
              فعال و نتایج جستجو خارج می‌شود، اما سابقه رزروها و اطلاعات مالی آن
              حفظ می‌شود.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="border-line bg-transparent"
            >
              انصراف
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="gap-2"
            >
              {isDeleting ? "در حال حذف…" : "حذف اقامتگاه"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function HostListingsPage() {
  return (
    <HostPageLayout
      eyebrow="میزبانی"
      title="اقامتگاه‌های من"
      description="وضعیت انتشار، تصاویر، تقویم و قیمت هر اقامتگاه را از یک‌جا مدیریت کنید."
      actions={
        <Button asChild className="gap-2">
          <Link href="/host/new">
            <Plus className="size-4" aria-hidden="true" />
            <span>ثبت اقامتگاه جدید</span>
          </Link>
        </Button>
      }
    >
      <HostAccessGate
        title="اقامتگاه‌های من"
        description="برای دیدن و مدیریت اقامتگاه‌های خود، وارد حساب میزبان شوید."
      >
        <HostListingsContent />
      </HostAccessGate>
    </HostPageLayout>
  )
}
