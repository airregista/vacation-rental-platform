"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Luggage,
  Heart,
  LogOut,
  Building2,
  Sparkles,
  User,
  Home,
} from "lucide-react"
import { ApiError } from "@/lib/api-client"

export function Header() {
  const router = useRouter()
  const { user, isAuthenticated, isHost, openOtpModal, becomeHost, logout } = useAuth()
  const [isPromoting, setIsPromoting] = React.useState(false)

  const handleHostAction = async () => {
    if (!isAuthenticated) {
      openOtpModal()
      return
    }
    if (isHost) {
      router.push("/host")
      return
    }
    setIsPromoting(true)
    try {
      await becomeHost()
      router.push("/host")
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.detail : "خطایی در ارتقای نقش کاربری رخ داد."
      alert(message)
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Right side (RTL Start): Logo */}
        <Link href="/" className="flex items-center gap-2 group select-none">
          <div className="size-10 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-md transition-transform group-hover:scale-105 duration-200">
            <Home className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-extrabold tracking-tight text-primary font-sans leading-none">
              آشیانک
            </span>
            <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
              سامانه اقامتگاه و بوم‌گردی
            </span>
          </div>
        </Link>

        {/* Center: Condensed search pill */}
        <div className="hidden md:flex items-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/")}
            className="h-auto flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-card/70 hover:bg-card shadow-sm hover:shadow transition-all text-xs font-medium text-foreground cursor-pointer"
          >
            <span>هر کجا</span>
            <span className="text-muted-foreground/60">•</span>
            <span>هر زمان</span>
            <span className="text-muted-foreground/60">•</span>
            <span>مهمانان</span>
            <div className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
              <Search className="size-3.5" />
            </div>
          </Button>
        </div>

        {/* Left side (RTL End): Actions & User menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Host CTA */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleHostAction}
            disabled={isPromoting}
            className="text-xs font-semibold rounded-full hover:bg-muted text-foreground gap-1.5 hidden sm:inline-flex"
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>{isHost ? "پنل میزبانی" : "میزبان شوید"}</span>
          </Button>

          {/* User Profile / Login */}
          {!isAuthenticated ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={openOtpModal}
              className="rounded-full px-4 text-xs font-bold gap-1.5 shadow-sm"
            >
              <User className="size-3.5" />
              <span>ورود / ثبت‌نام</span>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full p-1.5 h-auto border-border hover:shadow-sm transition-all focus:ring-2 focus:ring-primary/30 cursor-pointer"
                  aria-label="منوی حساب کاربری"
                >
                  <Avatar className="size-8">
                    {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={userDisplayName} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-2">
                <DropdownMenuLabel className="font-normal p-2.5">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold text-foreground leading-none">
                      {userDisplayName}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                      {user?.phone}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {isHost && (
                  <DropdownMenuItem
                    onClick={() => router.push("/host")}
                    className="gap-2 cursor-pointer"
                  >
                    <Building2 className="size-4 text-primary" />
                    <span>داشبورد میزبان</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => router.push("/trips")}
                  className="gap-2 cursor-pointer"
                >
                  <Luggage className="size-4 text-muted-foreground" />
                  <span>سفرهای من</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => router.push("/wishlists")}
                  className="gap-2 cursor-pointer"
                >
                  <Heart className="size-4 text-muted-foreground" />
                  <span>علاقه‌مندی‌ها</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={logout}
                  className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                >
                  <LogOut className="size-4" />
                  <span>خروج از حساب</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
