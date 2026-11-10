"use client"

import * as React from "react"
import { ShieldCheck, Clock, CheckCircle2, LogIn, LogOut, FileText } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { UserResponse } from "@/types/auth"

export interface HostCardProps {
  host: UserResponse | null
  checkInTime: string
  checkOutTime: string
  cancellationPolicy: string
  rules: string | null
}

const POLICY_LABELS: Record<string, { label: string; desc: string }> = {
  flexible: {
    label: "انعطاف‌پذیر",
    desc: "لغو تا ۲۴ ساعت قبل از تحویل با بازگشت کامل مبلغ",
  },
  moderate: {
    label: "متوسط",
    desc: "لغو تا ۵ روز قبل از تحویل با بازگشت کامل مبلغ",
  },
  strict: {
    label: "سخت‌گیرانه",
    desc: "لغو ۱۴ روز یا بیشتر قبل از تحویل با بازگشت کامل مبلغ؛ ۷ تا ۱۴ روز قبل با بازگشت ۵۰٪ مبلغ؛ کمتر از ۷ روز قبل بدون بازگشت مبلغ",
  },
}

export function HostCard({
  host,
  checkInTime,
  checkOutTime,
  cancellationPolicy,
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
        year: "numeric",
        month: "long",
      }).format(d)
    } catch {
      return null
    }
  }, [host])

  const formatTime = (t: string) => {
    if (!t) return "--:--"
    const timePart = t.slice(0, 5) // "14:00"
    return timePart.replace(/\d/g, (d) =>
      new Intl.NumberFormat("fa-IR").format(parseInt(d, 10))
    )
  }

  const policyInfo =
    POLICY_LABELS[cancellationPolicy] || POLICY_LABELS.flexible

  return (
    <Card className="border border-border rounded-2xl bg-card overflow-hidden">
      <CardContent className="p-6 space-y-6">
        {/* Host Header */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            {host?.avatar_url && (
              <AvatarImage src={host.avatar_url} alt={hostFullName} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
              {hostInitials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg text-foreground">{hostFullName}</h3>
              <Badge variant="secondary" className="gap-1 text-xs px-2 py-0.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>میزبان تایید شده</span>
              </Badge>
            </div>

            {joinedDate && (
              <p className="text-xs text-muted-foreground">
                عضویت از {joinedDate}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>پاسخ‌گویی کمتر از ۱ ساعت</span>
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Check-in / Check-out & Cancellation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Check-in / Check-out times */}
          <div className="space-y-2 p-3.5 rounded-xl bg-muted/40 border border-border/60">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <LogIn className="h-4 w-4 text-primary" />
              <span>زمان‌بندی تحویل اقامتگاه</span>
            </span>
            <div className="text-xs text-muted-foreground space-y-1 pr-5">
              <div>ساعت ورود: {formatTime(checkInTime)}</div>
              <div>ساعت خروج: {formatTime(checkOutTime)}</div>
            </div>
          </div>

          {/* Cancellation Policy */}
          <div className="space-y-2 p-3.5 rounded-xl bg-muted/40 border border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <LogOut className="h-4 w-4 text-primary" />
                <span>سیاست لغو رزرو</span>
              </span>
              <Badge variant="outline" className="text-[11px] font-medium">
                {policyInfo.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground pr-5">
              {policyInfo.desc}
            </p>
          </div>
        </div>

        {/* Rules & Requirements */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary" />
            <span>مقررات و قوانین اقامتگاه</span>
          </h4>
          {rules ? (
            <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line bg-muted/30 p-3.5 rounded-xl border border-border/50">
              {rules}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/30 p-3.5 rounded-xl border border-border/50">
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span>مقررات خاصی ثبت نشده است. رعایت نظافت و قوانین عمومی الزامی است.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
