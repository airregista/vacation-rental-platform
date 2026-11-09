"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { Compass, Heart, Luggage, User, Building2, LogOut, Sparkles } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, isHost, openOtpModal, becomeHost, logout } = useAuth()
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = React.useState(false)
  const [isPromoting, setIsPromoting] = React.useState(false)

  const handleProfileClick = () => {
    if (!isAuthenticated) {
      openOtpModal()
    } else {
      setIsProfileDrawerOpen(true)
    }
  }

  const handleHostAction = async () => {
    if (isHost) {
      setIsProfileDrawerOpen(false)
      router.push("/host")
      return
    }
    setIsPromoting(true)
    try {
      await becomeHost()
      setIsProfileDrawerOpen(false)
      router.push("/host")
    } catch {
      // Handled by api client
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
    <>
      <nav
        aria-label="ناوبری اصلی موبایل"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden safe-pb"
      >
        <div className="grid grid-cols-4 h-16 max-w-md mx-auto items-center px-2">
          {/* Explore */}
          <Link
            href="/"
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-h-[48px] h-full text-xs font-medium transition-colors",
              pathname === "/"
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Compass className={cn("size-5", pathname === "/" && "stroke-[2.5px]")} />
            <span>کاوش</span>
          </Link>

          {/* Wishlists */}
          <Link
            href="/wishlists"
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-h-[48px] h-full text-xs font-medium transition-colors",
              pathname.startsWith("/wishlists")
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Heart className={cn("size-5", pathname.startsWith("/wishlists") && "stroke-[2.5px]")} />
            <span>علاقه‌مندی‌ها</span>
          </Link>

          {/* Trips */}
          <Link
            href="/trips"
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-h-[48px] h-full text-xs font-medium transition-colors",
              pathname.startsWith("/trips")
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Luggage className={cn("size-5", pathname.startsWith("/trips") && "stroke-[2.5px]")} />
            <span>سفرهای من</span>
          </Link>

          {/* Profile / Login */}
          <button
            type="button"
            onClick={handleProfileClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-h-[48px] h-full text-xs font-medium transition-colors cursor-pointer",
              isAuthenticated && isProfileDrawerOpen
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isAuthenticated ? (
              <Avatar className="size-5 border border-border">
                {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={userDisplayName} />}
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            ) : (
              <User className="size-5" />
            )}
            <span>{isAuthenticated ? "پروفایل" : "ورود"}</span>
          </button>
        </div>
      </nav>

      {/* Mobile Profile Bottom Sheet */}
      <Sheet open={isProfileDrawerOpen} onOpenChange={setIsProfileDrawerOpen}>
        <SheetContent side="bottom" className="p-6 pt-3 space-y-4">
          <SheetHeader className="sr-only">
            <SheetTitle>حساب کاربری</SheetTitle>
            <SheetDescription>مدیریت دسترسی‌ها و مشخصات کاربر در موبایل</SheetDescription>
          </SheetHeader>
          <div className="mx-auto h-1.5 w-12 rounded-full bg-muted-foreground/30 mb-2" />

          {/* User info card */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50 border border-border">
            <Avatar className="size-12">
              {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={userDisplayName} />}
              <AvatarFallback className="bg-primary/10 text-primary text-base font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm">{userDisplayName}</span>
                <Badge variant={isHost ? "default" : "secondary"} className="text-[10px] px-2 py-0">
                  {user?.role === "admin" ? "مدیر کل" : isHost ? "میزبان" : "مهمان"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                {user?.phone}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              type="button"
              variant={isHost ? "outline" : "default"}
              className="w-full justify-between h-12 text-sm font-semibold rounded-xl"
              onClick={handleHostAction}
              disabled={isPromoting}
            >
              <div className="flex items-center gap-2">
                {isHost ? (
                  <Building2 className="size-4 text-primary" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                <span>{isHost ? "ورود به پنل میزبانی" : "میزبان شوید (ارتقای حساب)"}</span>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-between h-12 text-sm font-semibold rounded-xl"
              onClick={() => {
                setIsProfileDrawerOpen(false)
                router.push("/trips")
              }}
            >
              <div className="flex items-center gap-2">
                <Luggage className="size-4 text-muted-foreground" />
                <span>سفرهای من</span>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-between h-12 text-sm font-semibold rounded-xl"
              onClick={() => {
                setIsProfileDrawerOpen(false)
                router.push("/wishlists")
              }}
            >
              <div className="flex items-center gap-2">
                <Heart className="size-4 text-muted-foreground" />
                <span>علاقه‌مندی‌ها</span>
              </div>
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full justify-center h-12 text-sm font-semibold rounded-xl text-destructive hover:bg-destructive/10"
              onClick={() => {
                setIsProfileDrawerOpen(false)
                logout()
              }}
            >
              <div className="flex items-center gap-2">
                <LogOut className="size-4" />
                <span>خروج از حساب کاربری</span>
              </div>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
