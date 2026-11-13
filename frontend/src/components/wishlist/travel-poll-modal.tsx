"use client"

import * as React from "react"
import { useState, useEffect, useMemo, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  Plus,
  Zap,
  ChevronDown,
  Trash2,
} from "lucide-react"
import type { DatePollOption } from "@/types/wishlist"
import {
  COMPANIONS_STORAGE_KEY,
  MAX_COMPANIONS,
  STORAGE_KEY,
  isFutureCheckIn,
  loadPollState,
  normalizeCompanionName,
  serializeOptions,
  uniqueId,
  writeStorage,
  type PollCompanion,
} from "@/lib/travel-poll-storage"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { JalaliDateField } from "@/components/shared/date-field"

const INITIAL_POLL_OPTIONS: DatePollOption[] = [
  {
    id: "opt-1",
    title: "۲۶ تا ۲۹ آذر ۱۴۰۵ • ۳ شب",
    date_range: "۱۴۰۵/۰۹/۲۶ تا ۱۴۰۵/۰۹/۲۹",
    check_in: "2026-12-17",
    check_out: "2026-12-20",
    nights_count: 3,
    votes: 1,
    voted: true,
    holiday_tag: "شامل ۲ روز تعطیل رسمی (پنجشنبه و جمعه)",
    is_holiday: true,
  },
  {
    id: "opt-2",
    title: "۱۰ تا ۱۳ دی ۱۴۰۵ • ۳ شب",
    date_range: "۱۴۰۵/۱۰/۱۰ تا ۱۴۰۵/۱۰/۱۳",
    check_in: "2026-12-31",
    check_out: "2027-01-03",
    nights_count: 3,
    votes: 0,
    voted: false,
    holiday_tag: "شامل ۱ روز تعطیل آخر هفته (جمعه)",
    is_holiday: true,
  },
  {
    id: "opt-3",
    title: "۲۷ اسفند ۱۴۰۵ تا ۲ فروردین ۱۴۰۶ • ۴ شب",
    date_range: "۱۴۰۵/۱۲/۲۷ تا ۱۴۰۶/۰۱/۰۲",
    check_in: "2027-03-18",
    check_out: "2027-03-22",
    nights_count: 4,
    votes: 0,
    voted: false,
    holiday_tag: "۳۰٪ صرفه‌جویی اقتصادی (وسط هفته)",
    is_budget: true,
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
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerClientSnapshot
  )
  const isMobile = useSyncExternalStore(
    subscribeResize,
    getMobileSnapshot,
    getServerMobileSnapshot
  )

  // Seeds whose check-in has passed are never offered.
  const [options, setOptions] = useState<DatePollOption[]>(() =>
    INITIAL_POLL_OPTIONS.filter((opt) => isFutureCheckIn(opt.check_in))
  )
  const [companions, setCompanions] = useState<PollCompanion[]>([])
  const [newCompanionName, setNewCompanionName] = useState("")
  const [companionError, setCompanionError] = useState<string | null>(null)
  const [isProposing, setIsProposing] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newCheckIn, setNewCheckIn] = useState("")
  const [newCheckOut, setNewCheckOut] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      const { options: loadedOptions, companions: loadedCompanions } =
        loadPollState(INITIAL_POLL_OPTIONS)

      setOptions(loadedOptions)
      setCompanions(loadedCompanions)
      writeStorage(
        STORAGE_KEY,
        serializeOptions(loadedOptions, loadedCompanions)
      )
      writeStorage(COMPANIONS_STORAGE_KEY, loadedCompanions)
    }, 0)

    return () => clearTimeout(timer)
  }, [])

  const saveOptions = (
    nextOptions: DatePollOption[],
    nextCompanions: PollCompanion[] = companions
  ) => {
    setOptions(nextOptions)
    writeStorage(STORAGE_KEY, serializeOptions(nextOptions, nextCompanions))
  }

  const saveCompanions = (
    nextCompanions: PollCompanion[],
    nextOptions: DatePollOption[] = options
  ) => {
    setCompanions(nextCompanions)
    writeStorage(COMPANIONS_STORAGE_KEY, nextCompanions)
    writeStorage(STORAGE_KEY, serializeOptions(nextOptions, nextCompanions))
  }

  // Votes are derived from the user's own vote plus local proxy votes.
  const voteCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const option of options) {
      counts[option.id] = option.voted ? 1 : 0
    }
    for (const companion of companions) {
      if (
        companion.optionId !== null &&
        counts[companion.optionId] !== undefined
      ) {
        counts[companion.optionId] += 1
      }
    }
    return counts
  }, [options, companions])

  const companionsByOption = useMemo(() => {
    const grouped = new Map<string, PollCompanion[]>()
    for (const companion of companions) {
      if (companion.optionId === null) continue
      const current = grouped.get(companion.optionId) ?? []
      current.push(companion)
      grouped.set(companion.optionId, current)
    }
    return grouped
  }, [companions])

  const totalVotes = useMemo(
    () => Object.values(voteCounts).reduce((sum, count) => sum + count, 0),
    [voteCounts]
  )

  const sortedOptions = useMemo(() => {
    return [...options].sort(
      (a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0)
    )
  }, [options, voteCounts])

  const topOption = sortedOptions[0]

  const formatPersianNumber = (num: number) => {
    return new Intl.NumberFormat("fa-IR").format(num)
  }

  const handleToggleVote = (optionId: string) => {
    const target = options.find((option) => option.id === optionId)
    if (!target) return

    const nextVoted = !target.voted
    const updated = options.map((option) => {
      if (option.id === optionId) {
        return { ...option, voted: nextVoted }
      }
      // Single vote: voting for one option un-votes any other option.
      if (nextVoted && option.voted) {
        return { ...option, voted: false }
      }
      return option
    })
    saveOptions(updated)
  }

  const handleAddCompanion = (e: React.FormEvent) => {
    e.preventDefault()
    const name = normalizeCompanionName(newCompanionName)
    if (!name) {
      setCompanionError("نام همراه را وارد کنید.")
      return
    }
    if (companions.length >= MAX_COMPANIONS) {
      setCompanionError(
        `حداکثر ${formatPersianNumber(MAX_COMPANIONS)} همراه قابل افزودن است.`
      )
      return
    }
    if (
      companions.some(
        (companion) =>
          companion.name.toLocaleLowerCase() === name.toLocaleLowerCase()
      )
    ) {
      setCompanionError("این نام قبلاً در فهرست همراهان وجود دارد.")
      return
    }

    saveCompanions([
      ...companions,
      {
        id: uniqueId(
          "comp",
          companions.map((companion) => companion.id)
        ),
        name,
        optionId: null,
      },
    ])
    setNewCompanionName("")
    setCompanionError(null)
  }

  const handleRemoveCompanion = (companionId: string) => {
    saveCompanions(
      companions.filter((companion) => companion.id !== companionId)
    )
  }

  const handleAssignCompanionVote = (
    companionId: string,
    optionId: string | null
  ) => {
    saveCompanions(
      companions.map((companion) =>
        companion.id === companionId ? { ...companion, optionId } : companion
      )
    )
  }

  const handleRemoveOption = (optionId: string) => {
    const nextOptions = options.filter((option) => option.id !== optionId)
    const nextCompanions = companions.map((companion) =>
      companion.optionId === optionId
        ? { ...companion, optionId: null }
        : companion
    )
    setOptions(nextOptions)
    saveCompanions(nextCompanions, nextOptions)
  }

  const handleAddCandidate = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newTitle.trim()
    if (
      !trimmed ||
      !newCheckIn ||
      !newCheckOut ||
      newCheckOut <= newCheckIn ||
      !isFutureCheckIn(newCheckIn)
    )
      return

    const nights = Math.round(
      (new Date(newCheckOut).getTime() - new Date(newCheckIn).getTime()) /
        86400000
    )

    const newOption: DatePollOption = {
      id: uniqueId(
        "opt",
        options.map((option) => option.id)
      ),
      title: trimmed,
      date_range: `${newCheckIn} تا ${newCheckOut}`,
      check_in: newCheckIn,
      check_out: newCheckOut,
      nights_count: nights,
      votes: 0,
      voted: true,
      voters: [],
    }

    // Single vote: the new candidate takes the user's vote, so any
    // previously voted option is un-voted.
    const updated = [
      ...options.map((opt) => (opt.voted ? { ...opt, voted: false } : opt)),
      newOption,
    ]
    saveOptions(updated)
    setNewTitle("")
    setNewCheckIn("")
    setNewCheckOut("")
    setIsProposing(false)
  }

  const handleFinalizeDates = () => {
    if (options.length === 0) return
    const votedOptions = options.filter((opt) => opt.voted)
    const chosen = votedOptions.length === 1 ? votedOptions[0] : topOption
    // Never finalize a past date range.
    if (!chosen || !isFutureCheckIn(chosen.check_in)) return
    onClose()
    router.push(`/search?check_in=${chosen.check_in}&check_out=${chosen.check_out}`)
  }

  const modalBody = (
    <div className="space-y-6 pb-4 pt-2 text-right" dir="rtl">
      {/* Subheader info & status */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/70 bg-paper-deep/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 border-brick/30 bg-brick/5 px-3 py-1 text-brick"
          >
            <Users className="size-3.5" />
            <span>
              {folderName} •{" "}
              {companions.length > 0
                ? `شما و ${formatPersianNumber(companions.length)} همراه`
                : "فقط شما"}
            </span>
          </Badge>
          <div className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="size-2 animate-pulse rounded-full bg-trust" />
            <span>نظرسنجی باز است</span>
          </div>
        </div>
        <div className="text-xs font-medium text-ink-soft">
          <span>مجموع آرا: </span>
          <span className="font-bold tabular-nums text-ink">
            {formatPersianNumber(totalVotes)}
          </span>
          <span> رای</span>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-[11px] leading-5 text-ink-soft">
        <Users className="mt-0.5 size-3.5 shrink-0 text-brick" />
        رأی شما و همراهانتان روی این دستگاه ذخیره می‌شود؛ این نظرسنجی بین چند
        دستگاه همگام‌سازی نمی‌شود.
      </p>

      {/* Candidate date cards */}
      <div className="space-y-4">
        {options.length === 0 && (
          <p className="rounded-xl border border-dashed border-line bg-paper-deep/30 px-3 py-4 text-center text-xs leading-6 text-ink-soft">
            هنوز بازه زمانی پیشنهادی وجود ندارد. یک بازه جدید اضافه کنید.
          </p>
        )}

        {options.map((option) => {
          const optionVotes = voteCounts[option.id] ?? 0
          const isTop = topOption?.id === option.id && optionVotes > 0
          const consensusPercentage =
            totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0
          const companionVoters = companionsByOption.get(option.id) ?? []

          return (
            <div
              key={option.id}
              className={`relative rounded-xl p-4 transition-all duration-200 ${
                isTop
                  ? "border-2 border-brick/45 bg-paper-card shadow-soft"
                  : "border border-line/80 bg-paper-card hover:border-line-strong"
              }`}
            >
              {isTop && (
                <div className="absolute -top-3 left-4 flex items-center gap-1 rounded-full bg-brick px-2.5 py-0.5 text-[11px] font-bold text-on-brick shadow-soft">
                  <Sparkles className="size-3" />
                  <span>محبوب‌ترین بازه (برنده فعلی)</span>
                </div>
              )}

              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-ink">
                      {option.title}
                    </span>

                    {option.holiday_tag && (
                      <Badge
                        variant="outline"
                        className={
                          option.is_budget
                            ? "border-trust/30 bg-trust/10 text-[11px] text-trust"
                            : "border-brick/25 bg-brick/10 text-[11px] text-brick"
                        }
                      >
                        {option.holiday_tag}
                      </Badge>
                    )}

                    <span className="text-xs font-bold tabular-nums text-brick">
                      {formatPersianNumber(consensusPercentage)}٪ توافق
                      همسفران
                    </span>
                  </div>

                  {/* Local votes: own vote + proxy votes from the roster */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge
                      variant="outline"
                      className="gap-1 border-line bg-paper-deep/50 text-[11px] font-semibold text-ink-soft"
                    >
                      <Users className="size-3" />
                      {formatPersianNumber(optionVotes)} رای
                    </Badge>

                    {option.voted && (
                      <Badge className="gap-1 border-transparent bg-brick text-on-brick">
                        <CheckCircle2 className="size-3" />
                        رأی شما
                      </Badge>
                    )}

                    {companionVoters.map((companion) => (
                      <Badge
                        key={companion.id}
                        variant="outline"
                        className="border-line bg-paper-deep/40 text-[11px] font-medium text-ink-soft"
                      >
                        {companion.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Vote button */}
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={option.voted ? "secondary" : "outline"}
                    onClick={() => handleToggleVote(option.id)}
                    className="w-full gap-1.5 text-xs font-bold sm:w-auto"
                  >
                    {option.voted ? (
                      <>
                        <CheckCircle2 className="size-4 text-trust" />
                        <span>رأی شما ثبت شده (لغو رأی)</span>
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" />
                        <span>افزودن رأی من</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOption(option.id)}
                    aria-label={`حذف ${option.title}`}
                    className="shrink-0 text-ink-soft hover:text-brick"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-deep">
                <div
                  className="h-full rounded-full bg-brick transition-all duration-300"
                  style={{ width: `${consensusPercentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Local companion roster + proxy votes */}
      <div className="space-y-3 rounded-2xl border border-line/80 bg-paper-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-0.5">
            <h4 className="flex items-center gap-1.5 text-sm font-black text-ink">
              <Users className="size-4 text-brick" />
              همراهان روی این دستگاه
            </h4>
            <p className="text-[11px] leading-5 text-ink-soft">
              با افزودن نام همراهان، می‌توانید رأی آن‌ها را هم به‌صورت نیابتی
              روی همین دستگاه ثبت کنید.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-line bg-paper-deep/50 text-[11px] text-ink-soft"
          >
            {formatPersianNumber(companions.length)} از{" "}
            {formatPersianNumber(MAX_COMPANIONS)} همراه
          </Badge>
        </div>

        <form
          onSubmit={handleAddCompanion}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <Input
            value={newCompanionName}
            onChange={(e) => {
              setNewCompanionName(e.target.value)
              if (companionError) setCompanionError(null)
            }}
            placeholder="نام همراه (مثلاً سارا)"
            maxLength={30}
            disabled={companions.length >= MAX_COMPANIONS}
            className="border-line bg-paper text-right"
            aria-label="نام همراه"
          />
          <Button
            type="submit"
            size="sm"
            disabled={
              !newCompanionName.trim() ||
              companions.length >= MAX_COMPANIONS
            }
            className="shrink-0 gap-1.5"
          >
            <Plus className="size-4" />
            <span>افزودن همراه</span>
          </Button>
        </form>

        {companionError && (
          <p className="text-xs text-destructive">{companionError}</p>
        )}

        {companions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-paper-deep/30 px-3 py-2 text-xs leading-6 text-ink-soft">
            هنوز همراهی اضافه نکرده‌اید. رأی شما به‌تنهایی ثبت می‌شود.
          </p>
        ) : (
          <ul className="space-y-2">
            {companions.map((companion) => {
              const assignedOption =
                options.find((option) => option.id === companion.optionId) ??
                null

              return (
                <li
                  key={companion.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-line/70 bg-paper-deep/30 p-2"
                >
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink">
                    {companion.name}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`رأی نیابتی ${companion.name}`}
                        className="max-w-[220px] gap-1.5 border-line bg-paper-card text-[11px] font-semibold text-ink shadow-none"
                      >
                        <span className="truncate">
                          {assignedOption ? assignedOption.title : "بدون رأی"}
                        </span>
                        <ChevronDown className="size-3.5 shrink-0 text-ink-soft" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="max-w-[280px] border-line bg-paper-card"
                    >
                      <DropdownMenuLabel className="text-[11px] text-ink-soft">
                        رأی نیابتی {companion.name}
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() =>
                          handleAssignCompanionVote(companion.id, null)
                        }
                        className="gap-2 text-xs"
                      >
                        {companion.optionId === null ? (
                          <CheckCircle2 className="size-3.5 shrink-0 text-trust" />
                        ) : (
                          <span className="size-3.5 shrink-0" />
                        )}
                        <span>بدون رأی</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-line" />
                      {options.map((option) => (
                        <DropdownMenuItem
                          key={option.id}
                          onClick={() =>
                            handleAssignCompanionVote(companion.id, option.id)
                          }
                          className="gap-2 text-xs"
                        >
                          {companion.optionId === option.id ? (
                            <CheckCircle2 className="size-3.5 shrink-0 text-trust" />
                          ) : (
                            <span className="size-3.5 shrink-0" />
                          )}
                          <span className="truncate">{option.title}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCompanion(companion.id)}
                    aria-label={`حذف ${companion.name}`}
                    className="shrink-0 text-ink-soft hover:text-brick"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Propose new candidate date */}
      {isProposing ? (
        <form
          onSubmit={handleAddCandidate}
          className="space-y-3 rounded-xl border border-dashed border-brick/40 bg-brick/5 p-4"
        >
          <h4 className="text-xs font-bold text-ink">پیشنهاد بازه زمانی جدید</h4>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="مثلاً: ۲۲ تا ۲۵ مهر • ۳ شب"
            className="border-line bg-paper-card text-right"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <JalaliDateField
              boxed
              label="تاریخ ورود"
              value={newCheckIn}
              onChange={setNewCheckIn}
            />
            <JalaliDateField
              boxed
              label="تاریخ خروج"
              value={newCheckOut}
              min={newCheckIn}
              onChange={setNewCheckOut}
            />
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
                !newTitle.trim() ||
                !newCheckIn ||
                !newCheckOut ||
                newCheckOut <= newCheckIn ||
                !isFutureCheckIn(newCheckIn)
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
          className="w-full gap-1.5 border-dashed border-line-strong/70 bg-transparent text-xs text-ink-soft hover:text-ink"
        >
          <Calendar className="size-4" />
          <span>پیشنهاد بازه زمانی جدید برای همسفران</span>
        </Button>
      )}

      {/* Modal footer CTAs */}
      <div className="flex items-center justify-end gap-3 border-t border-line/70 pt-4">
        <Button
          type="button"
          onClick={handleFinalizeDates}
          disabled={options.length === 0}
          className="w-full gap-2 font-bold sm:w-auto"
        >
          <Zap className="size-4" />
          <span>تثبیت تاریخ و جستجوی اقامتگاه‌ها</span>
        </Button>
      </div>
    </div>
  )

  if (!isMounted || !isOpen) return null

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent
          side="bottom"
          className="max-h-[90vh] overflow-y-auto border-line bg-paper"
          dir="rtl"
        >
          <SheetHeader className="text-right">
            <SheetTitle className="font-black text-ink">
              نظرسنجی تاریخ سفر و هماهنگی همسفران
            </SheetTitle>
            <SheetDescription className="text-xs leading-6 text-ink-soft">
              تاریخ‌های پیشنهادی خود را انتخاب کرده یا به گزینه‌های دوستانتان رای
              دهید تا بهترین بازه زمانی مشخص شود.
            </SheetDescription>
          </SheetHeader>
          {modalBody}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto border-line bg-paper"
        dir="rtl"
      >
        <DialogHeader className="text-right">
          <DialogTitle className="font-black text-ink">
            نظرسنجی تاریخ سفر و هماهنگی همسفران
          </DialogTitle>
          <DialogDescription className="text-xs leading-6 text-ink-soft">
            تاریخ‌های پیشنهادی خود را انتخاب کرده یا به گزینه‌های دوستانتان رای
            دهید تا بهترین بازه زمانی مشخص شود.
          </DialogDescription>
        </DialogHeader>
        {modalBody}
      </DialogContent>
    </Dialog>
  )
}
