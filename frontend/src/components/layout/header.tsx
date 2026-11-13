"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  AlertCircle,
  Building2,
  Heart,
  LayoutDashboard,
  LogOut,
  Luggage,
  Menu,
  Phone,
  Search,
  Sparkles,
  User,
  X,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { ApiError } from "@/lib/api-client"
import { toPersianDigits } from "@/lib/format-fa"
import { AshianakLogo } from "@/components/brand/ashianak-logo"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { label: "اقامتگاه‌ها", href: "/#stays" },
  { label: "اقلیم‌ها", href: "/#climates" },
  { label: "راهنمای سفر", href: "/#guide" },
  { label: "میزبان شوید", href: "/host/new" },
]

const PHONE = "۰۲۱–۹۱۰۰۰۰۰۰"

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, isHost, openOtpModal, becomeHost, logout } = useAuth()
  const [scrolled, setScrolled] = React.useState(false)
  const [isPromoting, setIsPromoting] = React.useState(false)
  const [hostError, setHostError] = React.useState<string | null>(null)

  const isHome = pathname === "/"
  const overHero = isHome && !scrolled

  React.useEffect(() => {
    if (!isHome) return
    function onScroll() {
      setScrolled(window.scrollY > 20)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [isHome])

  const handleHostAction = async () => {
    setHostError(null)
    if (!isAuthenticated) {
      openOtpModal()
      return
    }
    if (isHost) {
      router.push("/host/dashboard")
      return
    }
    setIsPromoting(true)
    try {
      await becomeHost()
      router.push("/host/dashboard")
    } catch (err: unknown) {
      setHostError(
        err instanceof ApiError ? err.detail : "خطایی در ارتقای نقش کاربری رخ داد."
      )
    } finally {
      setIsPromoting(false)
    }
  }

  const userDisplayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "کاربر آشیانک"

  const userInitials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]} ${user.last_name[0]}`
      : user?.first_name
        ? user.first_name[0]
        : "آ"

  const iconTone = overHero
    ? "text-hero-ink hover:bg-hero-ink/10"
    : "text-ink hover:bg-ink/5"

  return (
    <header
      className={cn(
        "top-0 z-50 w-full border-b transition-[background-color,border-color,box-shadow] duration-300",
        isHome ? "fixed inset-x-0" : "sticky",
        isHome && !scrolled
          ? "border-transparent bg-transparent"
          : "border-line/80 bg-paper/90 shadow-soft backdrop-blur-xl"
      )}
    >
      {hostError ? (
        <div className="mx-auto max-w-[1360px] px-4 py-2 sm:px-6 lg:px-8">
          <Alert variant="destructive" className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <AlertDescription className="text-xs font-semibold">
                {hostError}
              </AlertDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setHostError(null)}
              aria-label="بستن پیام خطا"
              className="size-6 text-destructive hover:bg-destructive/10"
            >
              <X className="size-3.5" />
            </Button>
          </Alert>
        </div>
      ) : null}

      <div className="mx-auto flex h-16 w-full max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6 md:h-20 lg:px-8">
        <Link
          href="/"
          aria-label="آشیانک — خانه"
          className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <AshianakLogo tone={overHero ? "hero" : "default"} />
        </Link>

        <nav aria-label="ناوبری اصلی" className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                overHero
                  ? "text-hero-ink/75 hover:text-hero-clay"
                  : "text-ink/75 hover:text-brick"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <a
            href="tel:+982191000000"
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors lg:inline-flex",
              overHero
                ? "text-hero-ink/70 hover:text-hero-clay"
                : "text-ink-soft hover:text-brick"
            )}
          >
            <Phone className="size-3.5" />
            <span dir="ltr" className="tabular-nums">
              {PHONE}
            </span>
          </a>

          <Button
            asChild
            variant="ghost"
            size="icon"
            shape="pill"
            className={cn("hidden sm:inline-flex", iconTone)}
          >
            <Link href="/search" aria-label="جستجوی اقامتگاه">
              <Search className="size-4" />
            </Link>
          </Button>

          <Button
            asChild
            variant="ghost"
            size="icon"
            shape="pill"
            className={cn("hidden sm:inline-flex", iconTone)}
          >
            <Link href="/wishlists" aria-label="نشان‌شده‌ها">
              <Heart className="size-4" />
            </Link>
          </Button>

          <ThemeToggle className={iconTone} />

          {!isAuthenticated ? (
            <Button
              type="button"
              variant="outline"
              onClick={openOtpModal}
              className={cn(
                "px-3 text-xs shadow-none sm:px-5 sm:text-sm",
                overHero
                  ? "border-hero-ink/20 bg-hero-cream/70 text-hero-ink hover:bg-hero-cream"
                  : "border-line bg-paper-card/70 text-ink hover:bg-paper-card"
              )}
            >
              ورود / ثبت‌نام
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  aria-label="منوی حساب کاربری"
                  className={cn(
                    "size-9 rounded-full p-0 shadow-none",
                    overHero
                      ? "border-hero-ink/20 bg-hero-cream/70 hover:bg-hero-cream"
                      : "border-line bg-paper-card/70 hover:bg-paper-card"
                  )}
                >
                  <Avatar className="size-8">
                    {user?.avatar_url ? (
                      <AvatarImage src={user.avatar_url} alt={userDisplayName} />
                    ) : null}
                    <AvatarFallback className="bg-brick/10 text-xs font-bold text-brick">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="mt-2 w-60">
                <DropdownMenuLabel className="p-2.5 font-normal">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold leading-none text-foreground">
                      {userDisplayName}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {toPersianDigits(user?.phone ?? "")}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onSelect={() => router.push("/account")}
                  className="cursor-pointer gap-2"
                >
                  <User className="size-4 text-muted-foreground" />
                  <span>حساب کاربری</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => router.push("/trips")}
                  className="cursor-pointer gap-2"
                >
                  <Luggage className="size-4 text-muted-foreground" />
                  <span>سفرهای من</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => router.push("/wishlists")}
                  className="cursor-pointer gap-2"
                >
                  <Heart className="size-4 text-muted-foreground" />
                  <span>علاقه‌مندی‌ها</span>
                </DropdownMenuItem>

                {user?.role === "admin" ? (
                  <DropdownMenuItem
                    onSelect={() => router.push("/admin")}
                    className="cursor-pointer gap-2"
                  >
                    <LayoutDashboard className="size-4 text-accent" />
                    <span>پنل مدیریت</span>
                  </DropdownMenuItem>
                ) : null}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onSelect={handleHostAction}
                  disabled={isPromoting}
                  className="cursor-pointer gap-2"
                >
                  {isHost ? (
                    <Building2 className="size-4 text-brick" />
                  ) : (
                    <Sparkles className="size-4 text-brick" />
                  )}
                  <span>{isHost ? "داشبورد میزبانی" : "میزبان شوید"}</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={logout}
                  className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  <span>خروج از حساب</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                shape="pill"
                className={cn("md:hidden", iconTone)}
                aria-label="باز کردن منو"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-paper text-ink">
              <SheetHeader className="text-right">
                <SheetTitle className="flex items-center gap-2 text-right text-ink">
                  <AshianakLogo tone="default" />
                </SheetTitle>
                <SheetDescription className="text-right text-xs text-ink-soft">
                  اقامتگاه‌های بومی ایران
                </SheetDescription>
              </SheetHeader>

              <nav aria-label="ناوبری موبایل" className="mt-8 flex flex-col">
                <SheetClose asChild>
                  <Link
                    href="/search"
                    className="flex items-center gap-2 border-b border-line/70 py-4 text-base font-bold text-ink transition-colors hover:text-brick"
                  >
                    <Search className="size-4 text-brick" />
                    جستجوی اقامتگاه
                  </Link>
                </SheetClose>
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className="border-b border-line/70 py-4 text-base font-bold text-ink transition-colors hover:text-brick"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <Link
                    href="/wishlists"
                    className="border-b border-line/70 py-4 text-base font-bold text-ink transition-colors hover:text-brick"
                  >
                    نشان‌شده‌های من
                  </Link>
                </SheetClose>
              </nav>

              <div className="mt-8 flex flex-col gap-3">
                {!isAuthenticated ? (
                  <SheetClose asChild>
                    <Button
                      type="button"
                      onClick={openOtpModal}
                      className="w-full rounded-xl bg-brick text-on-brick hover:bg-brick-deep"
                    >
                      ورود / ثبت‌نام
                    </Button>
                  </SheetClose>
                ) : (
                  <SheetClose asChild>
                    <Button asChild className="w-full rounded-xl">
                      <Link href="/account">حساب کاربری من</Link>
                    </Button>
                  </SheetClose>
                )}
                <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
                  <span className="text-xs font-semibold text-ink-soft">حالت نمایش</span>
                  <ThemeToggle className="text-ink hover:bg-ink/5" />
                </div>
                <p className="pt-2 text-start text-[11px] text-ink-soft">
                  پشتیبانی ۲۴ ساعته:{" "}
                  <span dir="ltr" className="inline-block font-semibold tabular-nums">
                    {PHONE}
                  </span>
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
