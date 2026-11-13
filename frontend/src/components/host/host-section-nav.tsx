"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, CalendarDays, LayoutDashboard, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/host/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/host/listings", label: "اقامتگاه‌های من", icon: Building2 },
  { href: "/host/reservations", label: "رزروهای دریافتی", icon: CalendarDays },
  { href: "/host/payouts", label: "گزارش مالی", icon: Wallet },
] as const

export function HostSectionNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="ناوبری پنل میزبان"
      className="no-scrollbar overflow-x-auto rounded-2xl border border-line/80 bg-paper-card/80 p-1.5 shadow-soft"
    >
      <div className="flex min-w-max items-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/host/dashboard"
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors sm:text-sm",
                isActive
                  ? "bg-brick text-on-brick shadow-soft"
                  : "text-ink-soft hover:bg-paper-deep hover:text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
