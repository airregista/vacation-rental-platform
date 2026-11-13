"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Heart,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Luggage,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { formatPersianDate, toPersianDigits } from "@/lib/format-fa"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { UserResponse } from "@/types/auth"

const ROLE_LABEL: Record<string, string> = {
  guest: "مهمان",
  host: "میزبان",
  admin: "مدیر سامانه",
}

export default function AccountPage() {
  const router = useRouter()
  const { user, token, isLoading, isHost, isAdmin, openOtpModal, logout } = useAuth()

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-64 rounded-lg bg-paper-deep" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Skeleton className="h-96 rounded-3xl bg-paper-deep" />
          <Skeleton className="h-72 rounded-3xl bg-paper-deep" />
        </div>
      </main>
    )
  }

  if (!token || !user) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-16 sm:py-20">
        <div className="rounded-3xl border border-line/80 bg-paper-card p-8 shadow-soft">
          <EmptyState
            icon={User}
            title="برای دیدن حساب کاربری وارد شوید"
            description="اطلاعات تماس، سفرها و نشان‌شده‌های شما پشت همین شماره همراه نگه‌داری می‌شوند."
            action={
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <Button onClick={openOtpModal} className="gap-2">
                  <LogIn className="size-4" />
                  <span>ورود با شماره همراه</span>
                </Button>
                <Button asChild variant="outline" className="border-line bg-transparent">
                  <Link href="/login?next=/account">صفحه ورود</Link>
                </Button>
              </div>
            }
          />
        </div>
      </main>
    )
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "کاربر آشیانک"
  const initials =
    user.first_name && user.last_name
      ? `${user.first_name[0]} ${user.last_name[0]}`
      : user.first_name
        ? user.first_name[0]
        : "آ"

  function handleLogout() {
    logout()
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-paper">
      <PageHeader
        eyebrow="حساب کاربری"
        title={`سلام، ${displayName}`}
        description="اطلاعات تماس و میان‌برهای حساب خود را اینجا مدیریت کنید."
        actions={
          <Badge
            variant="outline"
            className="gap-1.5 border-line bg-paper-card px-3 py-1.5 text-[11px] font-semibold text-ink"
          >
            <BadgeCheck className="size-3.5 text-trust" />
            {ROLE_LABEL[user.role] ?? user.role}
          </Badge>
        }
      />

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:px-8">
        <div className="space-y-6">
          {/* Identity card */}
          <Card className="overflow-hidden rounded-3xl border-line/80 bg-paper-card shadow-soft">
            <div className="flex flex-wrap items-center gap-4 border-b border-line/70 bg-paper-deep/35 p-5 sm:p-6">
              <Avatar className="size-16 border border-line shadow-soft">
                {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={displayName} /> : null}
                <AvatarFallback className="bg-brick/10 text-lg font-black text-brick">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-black text-ink">{displayName}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                  <Phone className="size-3.5 text-brick" />
                  <span className="tabular-nums">{toPersianDigits(user.phone)}</span>
                </p>
              </div>
              <span className="rounded-full border border-line bg-paper-card px-3 py-1.5 text-[11px] font-semibold text-ink-soft">
                عضو از {formatPersianDate(user.created_at)}
              </span>
            </div>

            <ProfileForm key={user.id} user={user} />
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <Card className="rounded-2xl border-line/80 bg-paper-card shadow-soft">
            <CardContent className="p-5">
              <p className="text-[11px] font-bold tracking-[0.18em] text-brick">میان‌برهای من</p>
              <div className="mt-3 space-y-1">
                <QuickLink href="/trips" icon={Luggage} label="سفرهای من" hint="رزروها و گفتگو" />
                <QuickLink
                  href="/wishlists"
                  icon={Heart}
                  label="نشان‌شده‌ها"
                  hint="اقامتگاه‌های ذخیره‌شده"
                />
                {isHost ? (
                  <QuickLink
                    href="/host/dashboard"
                    icon={Building2}
                    label="داشبورد میزبانی"
                    hint="اقامتگاه‌ها و درآمد"
                  />
                ) : (
                  <QuickLink
                    href="/host/new"
                    icon={Sparkles}
                    label="میزبان شوید"
                    hint="ثبت اقامتگاه"
                  />
                )}
                {isAdmin ? (
                  <QuickLink
                    href="/admin"
                    icon={LayoutDashboard}
                    label="پنل مدیریت"
                    hint="کاربران، کوپن‌ها، تسویه"
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-line/80 bg-paper-card shadow-soft">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-ink">حالت نمایش</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">روشن، تاریک یا همراه با سیستم</p>
                </div>
                <ThemeToggle className="border border-line bg-paper text-ink" />
              </div>
              <Separator className="my-4 bg-line/70" />
              <div className="flex items-start gap-2 text-[11px] leading-6 text-ink-soft">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-trust" />
                اطلاعات شما رمزنگاری‌شده نگه‌داری می‌شود و بدون اجازه در اختیار میزبان قرار
                نمی‌گیرد.
              </div>
            </CardContent>
          </Card>

          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            className="w-full gap-2 border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" />
            <span>خروج از حساب</span>
          </Button>
        </aside>
      </div>
    </div>
  )
}

function QuickLink({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string
  icon: React.ElementType
  label: string
  hint: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 transition-colors hover:border-line/70 hover:bg-paper-deep/40"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-b-lg rounded-t-full bg-brick/10 text-brick">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-ink">{label}</span>
        <span className="mt-0.5 block text-[11px] text-ink-soft">{hint}</span>
      </span>
      <ArrowLeft className="size-3.5 shrink-0 text-ink-soft transition-transform group-hover:-translate-x-0.5" />
    </Link>
  )
}

/* Keyed by user id so the fields reset from the server copy after login or a
   save, without a state-syncing effect. */
function ProfileForm({ user }: { user: UserResponse }) {
  const { updateUser } = useAuth()
  const [firstName, setFirstName] = React.useState(user.first_name ?? "")
  const [lastName, setLastName] = React.useState(user.last_name ?? "")
  const [email, setEmail] = React.useState(user.email ?? "")
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)

  const isDirty =
    firstName.trim() !== (user.first_name ?? "") ||
    lastName.trim() !== (user.last_name ?? "") ||
    email.trim() !== (user.email ?? "")

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (isSaving) return
    setError(null)
    setSaved(false)
    setIsSaving(true)
    try {
      const updated = await apiClient.put<UserResponse>("/auth/me", {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
      })
      updateUser(updated)
      setSaved(true)
    } catch (err: unknown) {
      setError(
        err instanceof ApiError ? err.detail : "ذخیرهٔ اطلاعات انجام نشد. لطفاً دوباره تلاش کنید.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <CardContent className="p-5 sm:p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-brick">اطلاعات شخصی</p>
          <h3 className="mt-1 text-lg font-black text-ink">مشخصات شما</h3>
          <p className="mt-1 text-xs leading-6 text-ink-soft">
            نامی که اینجا می‌نویسید روی قرارداد و فاکتور رزروها استفاده می‌شود.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="first-name" className="text-xs font-semibold text-ink">
              نام
            </label>
            <Input
              id="first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              maxLength={50}
              className="h-11 rounded-xl border-line bg-paper"
              placeholder="مثلاً مریم"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="last-name" className="text-xs font-semibold text-ink">
              نام خانوادگی
            </label>
            <Input
              id="last-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              maxLength={50}
              className="h-11 rounded-xl border-line bg-paper"
              placeholder="مثلاً رضایی"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-semibold text-ink">
            ایمیل <span className="font-normal text-ink-soft">(اختیاری)</span>
          </label>
          <Input
            id="email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="h-11 rounded-xl border-line bg-paper text-left"
            placeholder="name@example.com"
          />
          <p className="flex items-center gap-1 text-[11px] text-ink-soft">
            <Mail className="size-3" />
            برای دریافت فاکتور و یادآوری سفر استفاده می‌شود.
          </p>
        </div>

        <div className="rounded-xl border border-line/70 bg-paper-deep/35 p-3.5 text-[11px] leading-6 text-ink-soft">
          شماره همراه{" "}
          <span dir="ltr" className="font-semibold tabular-nums text-ink">
            {user.phone}
          </span>{" "}
          شناسهٔ ورود شماست و از این صفحه قابل تغییر نیست.
        </div>

        {error ? (
          <Alert variant="destructive" className="py-2.5">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}

        {saved ? (
          <Alert className="border-trust/30 bg-trust/10 py-2.5 text-trust">
            <CheckCircle2 className="size-4" />
            <AlertDescription className="text-xs font-semibold text-trust">
              اطلاعات حساب با موفقیت ذخیره شد.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-4">
          <Button type="submit" disabled={isSaving || !isDirty} className="gap-2 font-bold">
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>{isSaving ? "در حال ذخیره..." : "ذخیرهٔ تغییرات"}</span>
          </Button>
          <span className="text-[11px] text-ink-soft">
            {isDirty ? "تغییرات ذخیره‌نشده دارید." : "همهٔ اطلاعات به‌روز است."}
          </span>
        </div>
      </form>
    </CardContent>
  )
}
