"use client"

import * as React from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  AlertCircle,
  CalendarDays,
  Home,
  LogIn,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TicketPercent,
  Users,
  Wallet,
} from "lucide-react"

import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import type {
  AdminCoupon,
  AdminPayout,
  AdminReservation,
  AdminUser,
} from "@/components/admin/types"
import { AdminSummary } from "@/components/admin/admin-summary"
import { CouponsPanel } from "@/components/admin/coupons-panel"
import { PayoutsPanel } from "@/components/admin/payouts-panel"
import { ReservationsPanel } from "@/components/admin/reservations-panel"
import { UsersPanel } from "@/components/admin/users-panel"
import { PageHeader } from "@/components/layout/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface AdminData {
  users: AdminUser[]
  coupons: AdminCoupon[]
  reservations: AdminReservation[]
  payouts: AdminPayout[]
}

const EMPTY_DATA: AdminData = {
  users: [],
  coupons: [],
  reservations: [],
  payouts: [],
}

// Admin list endpoints default to limit=20 with a hard cap of 100, so walk
// pages explicitly instead of showing a silently truncated console.
async function fetchAllPages<T>(path: string): Promise<T[]> {
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

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) {
    return "دسترسی این حساب برای مشاهدهٔ اطلاعات مدیریت کافی نیست."
  }
  return "بارگذاری اطلاعات کنسول مدیریت با خطا مواجه شد. اتصال شبکه را بررسی کنید و دوباره تلاش کنید."
}

function AdminFrame({
  actions,
  children,
}: {
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="min-h-[70vh] bg-paper text-ink">
      <PageHeader
        eyebrow="مدیریت آشیانک"
        title="کنسول مدیریت"
        description="کاربران، کوپن‌ها، رزروها و تسویهٔ میزبانان را در یک نگاه بررسی کنید."
        actions={actions}
      />
      <div className="mx-auto w-full max-w-[1360px] px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  )
}

function AdminGate({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-line/80 bg-paper-card p-7 text-center shadow-lift sm:p-9">
      <span className="mx-auto mb-5 grid size-16 place-items-center rounded-b-3xl rounded-t-full border border-brick/20 bg-brick/10 text-brick">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h2 className="text-xl font-black text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-ink-soft">
        {description}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {action}
      </div>
    </div>
  )
}

function AdminGateSkeleton() {
  return (
    <div
      className="mx-auto max-w-xl space-y-4 rounded-3xl border border-line/70 bg-paper-card p-8"
      aria-busy="true"
      aria-label="در حال بررسی دسترسی"
    >
      <Skeleton className="mx-auto size-16 rounded-b-3xl rounded-t-full" />
      <Skeleton className="mx-auto h-6 w-52" />
      <Skeleton className="mx-auto h-4 w-full max-w-sm" />
      <Skeleton className="mx-auto h-4 w-4/5 max-w-xs" />
      <Skeleton className="mx-auto mt-2 h-11 w-full max-w-xs rounded-xl" />
    </div>
  )
}

function AdminConsoleSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="در حال بارگذاری کنسول مدیریت">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-line bg-paper-card p-4 shadow-soft sm:p-5"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
            <Skeleton className="mt-2 h-3 w-40" />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-11 w-full max-w-2xl rounded-xl" />
        <div className="rounded-2xl border border-line bg-paper-card p-5 shadow-soft">
          <Skeleton className="h-5 w-36" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminLoadError({
  message,
  onRetry,
  isRetrying,
}: {
  message: string
  onRetry: () => void
  isRetrying: boolean
}) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-line/80 bg-paper-card p-7 text-center shadow-lift sm:p-9">
      <span className="mx-auto mb-5 grid size-16 place-items-center rounded-b-3xl rounded-t-full border border-brick/20 bg-brick/10 text-brick">
        <AlertCircle className="size-7" aria-hidden="true" />
      </span>
      <h2 className="text-xl font-black text-ink">بارگذاری اطلاعات انجام نشد</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-ink-soft">{message}</p>
      <Button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="mt-6 w-full gap-2 sm:w-auto sm:px-8"
      >
        <RefreshCw className={cn("size-4", isRetrying && "animate-spin")} />
        {isRetrying ? "در حال تلاش…" : "تلاش دوباره"}
      </Button>
    </div>
  )
}

export default function AdminPage() {
  const { user, token, isLoading: isAuthLoading, openOtpModal } = useAuth()

  const [data, setData] = React.useState<AdminData>(EMPTY_DATA)
  const [isLoading, setIsLoading] = React.useState(true)
  const [hasLoaded, setHasLoaded] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadAll = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [users, coupons, reservations, payouts] = await Promise.all([
        fetchAllPages<AdminUser>("/users/"),
        fetchAllPages<AdminCoupon>("/coupons/"),
        fetchAllPages<AdminReservation>("/reservations/"),
        fetchAllPages<AdminPayout>("/payments/host/payouts"),
      ])
      setData({ users, coupons, reservations, payouts })
      setHasLoaded(true)
    } catch (err: unknown) {
      setError(loadErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (isAuthLoading || !token || user?.role !== "admin") return
    // Deferred so the fetch state updates happen outside the effect body
    // (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      void loadAll()
    }, 0)

    return () => clearTimeout(timer)
  }, [isAuthLoading, token, user?.role, loadAll])

  const handleCouponCreated = React.useCallback((coupon: AdminCoupon) => {
    setData((current) => ({
      ...current,
      coupons: [coupon, ...current.coupons],
    }))
  }, [])

  const handlePayoutSettled = React.useCallback((payout: AdminPayout) => {
    setData((current) => ({
      ...current,
      payouts: current.payouts.map((item) =>
        item.id === payout.id ? payout : item
      ),
    }))
  }, [])

  if (isAuthLoading) {
    return (
      <AdminFrame>
        <AdminGateSkeleton />
      </AdminFrame>
    )
  }

  if (!user) {
    return (
      <AdminFrame>
        <AdminGate
          icon={LogIn}
          title="ورود به کنسول مدیریت"
          description="برای دسترسی به اطلاعات مدیریت، ابتدا با حساب کاربری مدیر وارد شوید."
          action={
            <>
              <Button
                type="button"
                onClick={openOtpModal}
                className="w-full gap-2 sm:w-auto sm:px-8"
              >
                <LogIn className="size-4" />
                ورود یا ثبت‌نام
              </Button>
              <Button asChild variant="outline" className="w-full gap-2 sm:w-auto">
                <Link href="/">
                  <Home className="size-4" />
                  بازگشت به خانه
                </Link>
              </Button>
            </>
          }
        />
      </AdminFrame>
    )
  }

  if (user.role !== "admin") {
    return (
      <AdminFrame>
        <AdminGate
          icon={ShieldAlert}
          title="دسترسی محدود"
          description="این بخش فقط برای مدیران سامانه در دسترس است. اگر تصور می‌کنید دسترسی شما باید فعال باشد، با پشتیبانی آشیانک تماس بگیرید."
          action={
            <Button asChild className="w-full gap-2 sm:w-auto sm:px-8">
              <Link href="/">
                <Home className="size-4" />
                بازگشت به خانه
              </Link>
            </Button>
          }
        />
      </AdminFrame>
    )
  }

  return (
    <AdminFrame
      actions={
        <>
          <Badge
            variant="outline"
            className="gap-1.5 border-trust/25 bg-trust-soft/60 px-3 py-1 text-[11px] font-bold text-trust"
          >
            <ShieldCheck className="size-3.5" />
            دسترسی مدیر
          </Badge>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadAll()}
            disabled={isLoading}
            className="gap-2 bg-paper-card"
          >
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
            {isLoading ? "در حال به‌روزرسانی…" : "به‌روزرسانی"}
          </Button>
        </>
      }
    >
      {isLoading && !hasLoaded ? (
        <AdminConsoleSkeleton />
      ) : !hasLoaded ? (
        <AdminLoadError
          message={
            error ??
            "اطلاعات کنسول مدیریت در دسترس نیست. لطفاً دوباره تلاش کنید."
          }
          onRetry={() => void loadAll()}
          isRetrying={isLoading}
        />
      ) : (
        <div className="space-y-8">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>به‌روزرسانی انجام نشد</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <AdminSummary
            users={data.users}
            coupons={data.coupons}
            reservations={data.reservations}
            payouts={data.payouts}
          />

          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="grid h-auto w-full max-w-2xl grid-cols-2 gap-1 p-1 sm:grid-cols-4">
              <TabsTrigger value="users" className="gap-1.5">
                <Users className="size-4" />
                کاربران
              </TabsTrigger>
              <TabsTrigger value="coupons" className="gap-1.5">
                <TicketPercent className="size-4" />
                کوپن‌ها
              </TabsTrigger>
              <TabsTrigger value="reservations" className="gap-1.5">
                <CalendarDays className="size-4" />
                رزروها
              </TabsTrigger>
              <TabsTrigger value="payouts" className="gap-1.5">
                <Wallet className="size-4" />
                تسویه میزبانان
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="mt-6">
              <UsersPanel users={data.users} />
            </TabsContent>
            <TabsContent value="coupons" className="mt-6">
              <CouponsPanel
                coupons={data.coupons}
                onCreated={handleCouponCreated}
              />
            </TabsContent>
            <TabsContent value="reservations" className="mt-6">
              <ReservationsPanel reservations={data.reservations} />
            </TabsContent>
            <TabsContent value="payouts" className="mt-6">
              <PayoutsPanel
                payouts={data.payouts}
                onSettled={handlePayoutSettled}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AdminFrame>
  )
}
