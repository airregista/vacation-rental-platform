"use client"

import * as React from "react"
import { ShieldCheck, Clock, CheckCircle2, LogIn, LogOut, FileText } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  describeCancellationPolicy,
  getCancellationPolicyLabel,
} from "@/lib/cancellation-policy"
import { toPersianDigits } from "@/lib/format-fa"
import type { PublicHost } from "@/types/auth"

export interface HostCardProps {
  host: PublicHost | null
  checkInTime: string
  checkOutTime: string
  cancellationPolicy: string
  cancellationFreeHours?: number | null
  cancellationPenaltyPercent?: number | string | null
  rules: string | null
}

export function HostCard({
  host,
  checkInTime,
  checkOutTime,
  cancellationPolicy,
  cancellationFreeHours,
  cancellationPenaltyPercent,
  rules,
}: HostCardProps) {
  const hostFullName = React.useMemo(() => {
    if (!host) return "میزبان مهمان‌شو"
    const name = `${host.first_name || ""} ${host.last_name || ""}`.trim()
    return name || "میزبان مهمان‌شو"
  }, [host])

  const hostInitials = React.useMemo(() => {
    if (!host) return "م"
    const first = host.first_name?.[0] || ""
    const last = host.last_name?.[0] || ""
    return (first + last).trim() || "م"
  }, [host])

  const joinedDate = React.useMemo(() => {
    if (!host?.created_at) return null
    try {
      const d = new Date(host.created_at)
      return new Intl.DateTimeFormat("fa-IR", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "long",
      }).format(d)
    } catch {
      return null
    }
  }, [host])

  const formatTime = (t: string) => {
    if (!t) return "--:--"
    return toPersianDigits(t.slice(0, 5)) // "14:00"
  }

  const policyLabel = getCancellationPolicyLabel(cancellationPolicy)
  const policyDescription = describeCancellationPolicy(cancellationPolicy, {
    freeHours: cancellationFreeHours,
    penaltyPercent: cancellationPenaltyPercent,
  })

  return (
    <Card className="overflow-hidden rounded-3xl border-line bg-paper-card shadow-soft">
      <CardContent className="space-y-6 p-6">
        <p className="flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick">
          <span aria-hidden="true" className="h-px w-8 bg-brick/45" />
          میزبان شما
        </p>

        {/* Host Header */}
        <div className="flex items-center gap-4">
          <Avatar className="size-16 border-2 border-line">
            {host?.avatar_url && (
              <AvatarImage src={host.avatar_url} alt={hostFullName} />
            )}
            <AvatarFallback className="bg-brick-soft/70 text-lg font-black text-brick-deep">
              {hostInitials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black tracking-tight text-ink">{hostFullName}</h3>
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-trust/25 bg-trust-soft/60 px-2.5 py-0.5 text-[11px] font-semibold text-trust"
              >
                <ShieldCheck className="size-3.5" />
                <span>میزبان تایید شده</span>
              </Badge>
            </div>

            {joinedDate && (
              <p className="text-xs text-ink-soft">
                عضویت از {joinedDate}
              </p>
            )}

            <div className="flex items-center gap-2 pt-0.5">
              <span className="flex items-center gap-1 text-xs text-ink-soft">
                <Clock className="size-3.5 text-brick" />
                <span>پاسخ‌گویی کمتر از ۱ ساعت</span>
              </span>
            </div>
          </div>
        </div>

        <Separator className="bg-line" />

        {/* Check-in / Check-out & Cancellation */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Check-in / Check-out times */}
          <div className="space-y-2 rounded-2xl border border-line/70 bg-paper p-3.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <LogIn className="size-4 text-brick" />
              <span>زمان‌بندی تحویل اقامتگاه</span>
            </span>
            <div className="space-y-1 pr-5 text-xs tabular-nums text-ink-soft">
              <div>ساعت ورود: {formatTime(checkInTime)}</div>
              <div>ساعت خروج: {formatTime(checkOutTime)}</div>
            </div>
          </div>

          {/* Cancellation Policy */}
          <div className="space-y-2 rounded-2xl border border-line/70 bg-paper p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                <LogOut className="size-4 text-gold" />
                <span>سیاست لغو رزرو</span>
              </span>
              <Badge
                variant="outline"
                className="border-line bg-paper-card text-[11px] font-semibold text-ink-soft"
              >
                {policyLabel}
              </Badge>
            </div>
            <p className="pr-5 text-xs leading-6 text-ink-soft">
              {policyDescription}
            </p>
          </div>
        </div>

        {/* Rules & Requirements */}
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <FileText className="size-4 text-brick" />
            <span>مقررات و قوانین اقامتگاه</span>
          </h4>
          {rules ? (
            <div className="whitespace-pre-line rounded-2xl border border-line/60 bg-paper-deep/40 p-3.5 text-xs leading-6 text-ink-soft">
              {rules}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-2xl border border-line/60 bg-paper-deep/40 p-3.5 text-xs text-ink-soft">
              <CheckCircle2 className="size-4 flex-shrink-0 text-trust" />
              <span>مقررات خاصی ثبت نشده است. رعایت نظافت و قوانین عمومی الزامی است.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
