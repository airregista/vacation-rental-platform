"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { CalendarDays, MapPin, Search, Users } from "lucide-react"

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-medium leading-4 text-muted-foreground">
      {children}
    </span>
  )
}

const FIELD_CLASS =
  "h-auto min-h-[56px] w-full justify-start gap-3 whitespace-normal rounded-2xl px-3.5 py-2.5 text-right font-normal hover:bg-muted/70"

/**
 * Presentational version of the production search pill, restyled as a floating
 * dock. Kept independent from booking state so the prototype can be judged in
 * isolation. On mobile it collapses to a single trigger, mirroring the real
 * sheet-based SearchPill.
 */
export function HeroSearchDock() {
  return (
    <div className="hero-dock-shadow rounded-[1.5rem] border border-card/80 bg-card/90 p-1.5 backdrop-blur-xl md:rounded-[1.75rem] md:p-2">
      {/* Mobile: compact trigger */}
      <div className="flex items-center gap-1.5 md:hidden">
        <Button
          type="button"
          variant="ghost"
          className="h-14 flex-1 justify-start gap-2.5 whitespace-normal rounded-2xl px-3 text-right font-normal hover:bg-muted/70"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Search className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-medium leading-4 text-muted-foreground">
              کجا، چه زمانی؟
            </span>
            <span className="block truncate text-sm font-semibold text-foreground">
              هر کجای ایران · ۲ نفر
            </span>
          </span>
        </Button>
        <Button asChild size="lg" className="h-12 shrink-0 gap-1.5 rounded-2xl px-4">
          <a href="#results">
            <Search className="size-4" />
            <span>جستجو</span>
          </a>
        </Button>
      </div>

      {/* Desktop: full dock */}
      <div className="hidden md:flex md:items-center md:gap-1.5">
        <label className="flex min-h-[56px] min-w-0 flex-[1.6] items-center gap-3 rounded-2xl px-3.5 transition-colors focus-within:bg-muted/70">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <MapPin className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <FieldLabel>مقصد</FieldLabel>
            <Input
              aria-label="مقصد"
              placeholder="هر کجای ایران"
              className="h-7 border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
            />
          </span>
        </label>

        <Button
          type="button"
          variant="ghost"
          className={`${FIELD_CLASS} flex-1 border-s border-border/70`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary/10 text-secondary">
            <CalendarDays className="size-4" />
          </span>
          <span className="min-w-0">
            <FieldLabel>تاریخ ورود</FieldLabel>
            <span className="block truncate text-sm font-semibold text-foreground">
              انتخاب کنید
            </span>
          </span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          className={`${FIELD_CLASS} flex-1 border-s border-border/70`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary/10 text-secondary">
            <CalendarDays className="size-4" />
          </span>
          <span className="min-w-0">
            <FieldLabel>تاریخ خروج</FieldLabel>
            <span className="block truncate text-sm font-semibold text-foreground">
              انتخاب کنید
            </span>
          </span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          className={`${FIELD_CLASS} flex-1 border-s border-border/70`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <Users className="size-4" />
          </span>
          <span className="min-w-0">
            <FieldLabel>مهمان</FieldLabel>
            <span className="block truncate text-sm font-semibold text-foreground">۲ نفر</span>
          </span>
        </Button>

        <Separator className="h-9" orientation="vertical" />

        <Button asChild size="lg" className="ms-1 shrink-0 gap-2 rounded-2xl px-6">
          <a href="#results">
            <Search className="size-4" />
            <span>جستجو</span>
          </a>
        </Button>
      </div>
    </div>
  )
}
