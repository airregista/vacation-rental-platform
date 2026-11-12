"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { AlertCircle, Building2, LogIn, Sparkles } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { getApiErrorMessage } from "./host-utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export interface HostAccessGateProps {
  title: string
  description: string
  icon?: LucideIcon
  promoteTitle?: string
  promoteDescription?: string
  children: React.ReactNode
}

function GateCard({
  icon: Icon,
  title,
  description,
  action,
  error,
}: {
  icon: LucideIcon
  title: string
  description: string
  action: React.ReactNode
  error?: string | null
}) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-line/80 bg-paper-card p-7 text-center shadow-lift sm:p-9">
      <span className="mx-auto mb-5 grid size-16 place-items-center rounded-b-3xl rounded-t-full border border-brick/20 bg-brick/10 text-brick">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h2 className="text-xl font-black text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-ink-soft">{description}</p>
      {error ? (
        <Alert variant="destructive" className="mt-5 text-right">
          <AlertCircle className="size-4" />
          <AlertTitle>خطا</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="mt-6">{action}</div>
    </div>
  )
}

function HostGateSkeleton() {
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-3xl border border-line/70 bg-paper-card p-8" aria-busy="true">
      <Skeleton className="mx-auto size-16 rounded-b-3xl rounded-t-full" />
      <Skeleton className="mx-auto h-6 w-52" />
      <Skeleton className="mx-auto h-4 w-full max-w-sm" />
      <Skeleton className="mx-auto h-4 w-4/5 max-w-xs" />
      <Skeleton className="mx-auto mt-2 h-11 w-full max-w-xs rounded-xl" />
    </div>
  )
}

/**
 * Warm sign-in / host-upgrade prompt shared by every host route. Data fetching
 * in the pages is guarded separately so nothing host-only fires before the
 * gate passes.
 */
export function HostAccessGate({
  title,
  description,
  icon: Icon = Building2,
  promoteTitle = "میزبان شوید",
  promoteDescription = "برای مدیریت اقامتگاه‌ها، رزروها و تسویه‌ها ابتدا حساب کاربری خود را به میزبان ارتقا دهید.",
  children,
}: HostAccessGateProps) {
  const { token, isLoading, isHost, isAdmin, becomeHost, openOtpModal } = useAuth()
  const [isPromoting, setIsPromoting] = React.useState(false)
  const [promoteError, setPromoteError] = React.useState<string | null>(null)

  const handleBecomeHost = async () => {
    setPromoteError(null)
    setIsPromoting(true)
    try {
      await becomeHost()
    } catch (error: unknown) {
      setPromoteError(
        getApiErrorMessage(error, "خطایی در ارتقای نقش کاربری رخ داد.")
      )
    } finally {
      setIsPromoting(false)
    }
  }

  if (isLoading) return <HostGateSkeleton />

  if (!token) {
    return (
      <GateCard
        icon={Icon}
        title={title}
        description={description}
        action={
          <Button
            type="button"
            onClick={openOtpModal}
            className="w-full gap-2 bg-brick text-on-brick hover:bg-brick-deep sm:w-auto sm:px-8"
          >
            <LogIn className="size-4" />
            <span>ورود یا ثبت‌نام</span>
          </Button>
        }
      />
    )
  }

  // Admins can own and manage listings too; the seeded host account is admin.
  if (!isHost && !isAdmin) {
    return (
      <GateCard
        icon={Sparkles}
        title={promoteTitle}
        description={promoteDescription}
        error={promoteError}
        action={
          <Button
            type="button"
            onClick={handleBecomeHost}
            disabled={isPromoting}
            className="w-full gap-2 sm:w-auto sm:px-8"
          >
            <Sparkles className="size-4" />
            <span>{isPromoting ? "در حال ارتقای حساب…" : "میزبان شوید (ارتقای حساب)"}</span>
          </Button>
        }
      />
    )
  }

  return <>{children}</>
}
