"use client"

import * as React from "react"
import { useState } from "react"
import { CheckCircle2, ChevronDown, Plus, Trash2, Users } from "lucide-react"
import {
  MAX_COMPANIONS,
  normalizeCompanionName,
  type PollCompanion,
} from "@/lib/travel-poll-storage"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CompanionRosterProps {
  companions: PollCompanion[]
  // Only id/title are consumed, for the proxy-vote dropdown.
  options: Array<{ id: string; title: string }>
  // Enforces the limit/dedupe rules and persists at the parent boundary.
  // Returns the error message to display, or null once the companion is
  // added (the roster clears the input only on success).
  onAdd: (name: string) => string | null
  onRemove: (companionId: string) => void
  onAssign: (companionId: string, optionId: string | null) => void
}

const formatPersianNumber = (num: number) => {
  return new Intl.NumberFormat("fa-IR").format(num)
}

export function CompanionRoster({
  companions,
  options,
  onAdd,
  onRemove,
  onAssign,
}: CompanionRosterProps) {
  // Keystroke state lives here so typing no longer re-renders the whole
  // travel-poll modal on every character.
  const [newCompanionName, setNewCompanionName] = useState("")
  const [companionError, setCompanionError] = useState<string | null>(null)

  const handleAddCompanion = (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = onAdd(normalizeCompanionName(newCompanionName))
    if (validationError) {
      setCompanionError(validationError)
      return
    }
    setNewCompanionName("")
    setCompanionError(null)
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line/80 bg-paper-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h4 className="flex items-center gap-1.5 text-sm font-black text-ink">
            <Users className="size-4 text-brick" />
            همراهان روی این دستگاه
          </h4>
          <p className="text-[11px] leading-5 text-ink-soft">
            با افزودن نام همراهان، می‌توانید رأی آن‌ها را هم به‌صورت نیابتی روی همین دستگاه ثبت
            کنید.
          </p>
        </div>
        <Badge variant="outline" className="border-line bg-paper-deep/50 text-[11px] text-ink-soft">
          {formatPersianNumber(companions.length)} از {formatPersianNumber(MAX_COMPANIONS)} همراه
        </Badge>
      </div>

      <form onSubmit={handleAddCompanion} className="flex flex-col gap-2 sm:flex-row">
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
          disabled={!newCompanionName.trim() || companions.length >= MAX_COMPANIONS}
          className="shrink-0 gap-1.5"
        >
          <Plus className="size-4" />
          <span>افزودن همراه</span>
        </Button>
      </form>

      {companionError && <p className="text-xs text-destructive">{companionError}</p>}

      {companions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-paper-deep/30 px-3 py-2 text-xs leading-6 text-ink-soft">
          هنوز همراهی اضافه نکرده‌اید. رأی شما به‌تنهایی ثبت می‌شود.
        </p>
      ) : (
        <ul className="space-y-2">
          {companions.map((companion) => {
            const assignedOption =
              options.find((option) => option.id === companion.optionId) ?? null

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
                      onClick={() => onAssign(companion.id, null)}
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
                        onClick={() => onAssign(companion.id, option.id)}
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
                  onClick={() => onRemove(companion.id)}
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
  )
}
