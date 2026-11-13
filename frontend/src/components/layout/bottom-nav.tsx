"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Compass, Heart, Luggage, User } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const ITEMS = [
  { label: "کاوش", href: "/search", icon: Compass },
  { label: "نشان‌شده‌ها", href: "/wishlists", icon: Heart },
  { label: "سفرهای من", href: "/trips", icon: Luggage },
]

export function BottomNav() {
  const pathname = usePathname()
  const { user, isAuthenticated, openOtpModal } = useAuth()

  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/host") ||
    pathname.startsWith("/checkout")
  ) {
    return null
  }

  const initials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]} ${user.last_name[0]}`
      : user?.first_name
        ? user.first_name[0]
        : "آ"

  const accountActive = pathname.startsWith("/account")
  const accountContent = (
    <>
      {isAuthenticated ? (
        <Avatar className="size-5 border border-border">
          {user?.avatar_url ? (
            <AvatarImage src={user.avatar_url} alt={user.first_name ?? "آشیانک"} />
          ) : null}
          <AvatarFallback className="bg-brick/10 text-[10px] font-bold text-brick">
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : (
        <User className="size-5" />
      )}
      <span>{isAuthenticated ? "حساب" : "ورود"}</span>
    </>
  )

  return (
    <nav
      aria-label="ناوبری اصلی موبایل"
      className="safe-pb fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-paper/95 backdrop-blur md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-4 items-center px-2">
        {ITEMS.map(({ label, href, icon: Icon }) => {
          const active =
            href === "/search" ? pathname === "/search" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex h-full min-h-[48px] flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                active ? "font-bold text-brick" : "text-ink-soft hover:text-ink"
              )}
            >
              <Icon className={cn("size-5", active && "stroke-[2.5px]")} />
              <span>{label}</span>
            </Link>
          )
        })}

        {isAuthenticated ? (
          <Link
            href="/account"
            className={cn(
              "flex h-full min-h-[48px] flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
              accountActive ? "font-bold text-brick" : "text-ink-soft hover:text-ink"
            )}
          >
            {accountContent}
          </Link>
        ) : (
          <button
            type="button"
            onClick={openOtpModal}
            className="flex h-full min-h-[48px] flex-col items-center justify-center gap-1 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
          >
            {accountContent}
          </button>
        )}
      </div>
    </nav>
  )
}
