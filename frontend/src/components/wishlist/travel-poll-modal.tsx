"use client"

import * as React from "react"
import { useState, useEffect, useMemo, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  Share2,
  Check,
  CheckCircle2,
  Calendar,
  Sparkles,
  Plus,
  Zap,
} from "lucide-react"
import type { DatePollOption } from "@/types/wishlist"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

const STORAGE_KEY = "jabama_travel_date_poll"

const INITIAL_POLL_OPTIONS: DatePollOption[] = [
  {
    id: "opt-1",
    title: "۲۶ تا ۲۹ آذر ۱۴۰۵ • ۳ شب",
    date_range: "۱۴۰۵/۰۹/۲۶ تا ۱۴۰۵/۰۹/۲۹",
    check_in: "2026-12-17",
    check_out: "2026-12-20",
    nights_count: 3,
    votes: 3,
    voted: true,
    holiday_tag: "شامل ۲ روز تعطیل رسمی (پنجشنبه و جمعه)",
    is_holiday: true,
    voters: ["شما", "سارا", "علی"],
  },
  {
    id: "opt-2",
    title: "۱۰ تا ۱۳ دی ۱۴۰۵ • ۳ شب",
    date_range: "۱۴۰۵/۱۰/۱۰ تا ۱۴۰۵/۱۰/۱۳",
    check_in: "2026-12-31",
    check_out: "2027-01-03",
    nights_count: 3,
    votes: 2,
    voted: false,
    holiday_tag: "شامل ۱ روز تعطیل آخر هفته (جمعه)",
    is_holiday: true,
    voters: ["علی", "آرش"],
  },
  {
    id: "opt-3",
    title: "۲۷ اسفند ۱۴۰۵ تا ۲ فروردین ۱۴۰۶ • ۴ شب",
    date_range: "۱۴۰۵/۱۲/۲۷ تا ۱۴۰۶/۰۱/۰۲",
    check_in: "2027-03-18",
    check_out: "2027-03-22",
    nights_count: 4,
    votes: 1,
    voted: false,
    holiday_tag: "۳۰٪ صرفه‌جویی اقتصادی (وسط هفته)",
    is_budget: true,
    voters: ["مهسا"],
  },
]

function subscribeResize(callback: () => void) {
  window.addEventListener("resize", callback)
  return () => window.removeEventListener("resize", callback)
}

function getMobileSnapshot() {
  return window.innerWidth < 640
}

function getServerMobileSnapshot() {
  return false
}

const emptySubscribe = () => () => {}
const getClientSnapshot = () => true
const getServerClientSnapshot = () => false

export interface TravelPollModalProps {
  isOpen: boolean
  onClose: () => void
  folderName?: string
}

export function TravelPollModal({
  isOpen,
  onClose,
  folderName = "سفرهای تابستانه شمال",
}: TravelPollModalProps) {
  const router = useRouter()
  const isMounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerClientSnapshot)
  const isMobile = useSyncExternalStore(subscribeResize, getMobileSnapshot, getServerMobileSnapshot)

  const [options, setOptions] = useState<DatePollOption[]>(INITIAL_POLL_OPTIONS)
  const [isCopied, setIsCopied] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [isProposing, setIsProposing] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newCheckIn, setNewCheckIn] = useState("")
  const [newCheckOut, setNewCheckOut] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as DatePollOption[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Stored options from before the date fields existed cannot
            // be navigated to — discard them and keep the seeded ones.
            const valid = parsed.filter(
              (opt) =>
                typeof opt.check_in === "string" &&
                typeof opt.check_out === "string" &&
                opt.check_in.length > 0 &&
                opt.check_out.length > 0
            )
            if (valid.length > 0) {
              setOptions(valid)
            }
          }
        }
      } catch {
        // Fallback to initial options
      }
    }, 0)

    return () => clearTimeout(timer)
  }, [])

  const saveOptions = (newOptions: DatePollOption[]) => {
    setOptions(newOptions)
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newOptions))
      } catch {
        // Handle storage quota issues safely
      }
    }
  }

  const totalVotes = useMemo(() => {
    return options.reduce((sum, opt) => sum + opt.votes, 0)
  }, [options])

  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => b.votes - a.votes)
  }, [options])

  const topOption = sortedOptions[0]

  const handleToggleVote = (optionId: string) => {
    const updated = options.map((opt) => {
      if (opt.id === optionId) {
        const nextVoted = !opt.voted
        const nextVotes = nextVoted ? opt.votes + 1 : Math.max(0, opt.votes - 1)
        const voters = opt.voters ? [...opt.voters] : []
        const updatedVoters = nextVoted
          ? [...voters, "شما"]
          : voters.filter((name) => name !== "شما")

        return {
          ...opt,
          voted: nextVoted,
          votes: nextVotes,
          voters: updatedVoters,
        }
      }
      // Single vote: voting for one option un-votes any other voted option.
      if (opt.voted) {
        return {
          ...opt,
          voted: false,
          votes: Math.max(0, opt.votes - 1),
          voters: (opt.voters || []).filter((name) => name !== "شما"),
        }
      }
      return opt
    })
    saveOptions(updated)
  }

  const handleAddCandidate = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newTitle.trim()
    if (!trimmed || !newCheckIn || !newCheckOut || newCheckOut <= newCheckIn) return

    const nights = Math.round(
      (new Date(newCheckOut).getTime() - new Date(newCheckIn).getTime()) / 86400000
    )

    const newOption: DatePollOption = {
      id: `opt_${Date.now()}`,
      title: trimmed,
      date_range: `${newCheckIn} تا ${newCheckOut}`,
      check_in: newCheckIn,
      check_out: newCheckOut,
      nights_count: nights,
      votes: 1,
      voted: true,
      voters: ["شما"],
    }

    // Single vote: the new candidate takes the user's vote, so any
    // previously voted option is un-voted.
    const updated = [
      ...options.map((opt) =>
        opt.voted
          ? {
              ...opt,
              voted: false,
              votes: Math.max(0, opt.votes - 1),
              voters: (opt.voters || []).filter((name) => name !== "شما"),
            }
          : opt
      ),
      newOption,
    ]
    saveOptions(updated)
    setNewTitle("")
    setNewCheckIn("")
    setNewCheckOut("")
    setIsProposing(false)
  }

  const handleShare = async () => {
    setShareError(null)
    const url = typeof window !== "undefined" ? window.location.href : ""
    try {
      if (typeof window !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
        return
      }
      throw new Error("clipboard unavailable")
    } catch {
      // Fallback: temporary textarea + execCommand("copy").
      try {
        const textarea = document.createElement("textarea")
        textarea.value = url
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        try {
          textarea.select()
          const ok = document.execCommand("copy")
          if (!ok) throw new Error("execCommand copy failed")
          setIsCopied(true)
          setTimeout(() => setIsCopied(false), 2000)
        } finally {
          document.body.removeChild(textarea)
        }
      } catch {
        setShareError("کپی لینک انجام نشد؛ لطفاً لینک را به‌صورت دستی کپی کنید.")
      }
    }
  }

  const handleFinalizeDates = () => {
    if (options.length === 0) return
    const votedOptions = options.filter((opt) => opt.voted)
    const chosen =
      votedOptions.length === 1 ? votedOptions[0] : topOption
    if (!chosen) return
    onClose()
    router.push(`/?check_in=${chosen.check_in}&check_out=${chosen.check_out}`)
  }

  const formatPersianNumber = (num: number) => {
    return new Intl.NumberFormat("fa-IR").format(num)
  }

  const modalBody = (
    <div className="space-y-6 pt-2 pb-4 text-right" dir="rtl">
      {/* Subheader info & status */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-muted/50 border border-border/60">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="gap-1.5 py-1 px-3">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>{folderName} (۴ همسفر فعال)</span>
          </Badge>
          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>نظرسنجی باز است</span>
          </div>
        </div>
        <div className="text-xs font-medium text-muted-foreground">
          <span>مجموع آرا: </span>
          <span className="font-bold text-foreground font-price">
            {formatPersianNumber(totalVotes)}
          </span>
          <span> رای</span>
        </div>
      </div>

      {/* Candidate date cards */}
      <div className="space-y-3">
        {options.map((option) => {
          const isTop = topOption && topOption.id === option.id && topOption.votes > 0
          const consensusPercentage =
            totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0

          return (
            <div
              key={option.id}
              className={`relative rounded-xl p-4 transition-all duration-200 ${
                isTop
                  ? "bg-card border-2 border-primary/50 shadow-sm"
                  : "bg-card border border-border hover:border-border/80"
              }`}
            >
              {isTop && (
                <div className="absolute -top-3 left-4 bg-primary text-primary-foreground text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                  <Sparkles className="w-3 h-3" />
                  <span>محبوب‌ترین بازه (برنده فعلی)</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-base text-foreground font-price">
                      {option.title}
                    </span>

                    {option.holiday_tag && (
                      <Badge
                        variant="secondary"
                        className={
                          option.is_budget
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[11px]"
                            : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-[11px]"
                        }
                      >
                        {option.holiday_tag}
                      </Badge>
                    )}

                    <span className="text-xs font-bold text-primary font-price">
                      {formatPersianNumber(consensusPercentage)}٪ توافق همسفران
                    </span>
                  </div>

                  {/* Voters avatar cluster */}
                  <div className="flex items-center gap-3 pt-1">
                    {option.voters && option.voters.length > 0 && (
                      <div className="flex -space-x-1.5 space-x-reverse overflow-hidden">
                        {option.voters.map((voter, idx) => (
                          <div
                            key={idx}
                            className={`w-6 h-6 rounded-full border border-background flex items-center justify-center text-[10px] font-bold ${
                              idx % 3 === 0
                                ? "bg-primary text-primary-foreground"
                                : idx % 3 === 1
                                ? "bg-secondary text-secondary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                            title={voter}
                          >
                            {voter.charAt(0)}
                          </div>
                        ))}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatPersianNumber(option.votes)} رای
                      {option.voters && option.voters.length > 0
                        ? `: ${option.voters.join("، ")}`
                        : ""}
                    </span>
                  </div>
                </div>

                {/* Vote button */}
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant={option.voted ? "secondary" : "outline"}
                    onClick={() => handleToggleVote(option.id)}
                    className="gap-1.5 text-xs font-bold w-full sm:w-auto"
                  >
                    {option.voted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span>رای شما ثبت شده (لغو رای)</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>افزودن رای من</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${consensusPercentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Propose new candidate date */}
      {isProposing ? (
        <form
          onSubmit={handleAddCandidate}
          className="p-4 rounded-xl border border-dashed border-primary/50 bg-primary/5 space-y-3"
        >
          <h4 className="text-xs font-bold text-foreground">
            پیشنهاد بازه زمانی جدید
          </h4>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="مثلاً: ۲۲ تا ۲۵ مهر • ۳ شب"
            className="text-right"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="new-check-in" className="text-xs font-semibold text-foreground">
                تاریخ ورود
              </label>
              <Input
                id="new-check-in"
                type="date"
                value={newCheckIn}
                onChange={(e) => setNewCheckIn(e.target.value)}
                className="text-right"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-check-out" className="text-xs font-semibold text-foreground">
                تاریخ خروج
              </label>
              <Input
                id="new-check-out"
                type="date"
                value={newCheckOut}
                onChange={(e) => setNewCheckOut(e.target.value)}
                className="text-right"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setNewTitle("")
                setNewCheckIn("")
                setNewCheckOut("")
                setIsProposing(false)
              }}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                !newTitle.trim() || !newCheckIn || !newCheckOut || newCheckOut <= newCheckIn
              }
            >
              ثبت تاریخ پیشنهادی
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsProposing(true)}
          className="w-full border-dashed gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Calendar className="w-4 h-4" />
          <span>پیشنهاد بازه زمانی جدید برای همسفران</span>
        </Button>
      )}

      {/* Modal footer CTAs */}
      <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col items-start gap-1 w-full sm:w-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full sm:w-auto"
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-600 font-bold">لینک کپی شد!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>اشتراک‌گذاری با همسفران</span>
              </>
            )}
          </Button>
          {shareError && (
            <p className="text-xs text-destructive">{shareError}</p>
          )}
        </div>

        <Button
          type="button"
          onClick={handleFinalizeDates}
          disabled={options.length === 0}
          className="gap-2 font-bold w-full sm:w-auto"
        >
          <Zap className="w-4 h-4" />
          <span>تثبیت تاریخ و جستجوی اقامتگاه‌ها</span>
        </Button>
      </div>
    </div>
  )

  if (!isMounted || !isOpen) return null

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto" dir="rtl">
          <SheetHeader className="text-right">
            <SheetTitle>نظرسنجی تاریخ سفر و هماهنگی همسفران</SheetTitle>
            <SheetDescription>
              تاریخ‌های پیشنهادی خود را انتخاب کرده یا به گزینه‌های دوستانتان رای دهید تا بهترین بازه زمانی مشخص شود.
            </SheetDescription>
          </SheetHeader>
          {modalBody}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>نظرسنجی تاریخ سفر و هماهنگی همسفران</DialogTitle>
          <DialogDescription>
            تاریخ‌های پیشنهادی خود را انتخاب کرده یا به گزینه‌های دوستانتان رای دهید تا بهترین بازه زمانی مشخص شود.
          </DialogDescription>
        </DialogHeader>
        {modalBody}
      </DialogContent>
    </Dialog>
  )
}
