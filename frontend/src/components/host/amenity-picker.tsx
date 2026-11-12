"use client"

import { useId, useState } from "react"
import { Plus, X } from "lucide-react"
import type { Amenity } from "@/types/accommodation"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

const MAX_CUSTOM_AMENITIES = 15
const CUSTOM_NAME_MIN_LENGTH = 2
const CUSTOM_NAME_MAX_LENGTH = 50

const normalizeName = (value: string) => value.trim().toLowerCase()

export function AmenityPicker({
  amenities,
  selectedIds,
  onToggle,
  isLoading = false,
  customAmenities,
  onAddCustom,
  onRemoveCustom,
}: {
  amenities: Amenity[]
  selectedIds: number[]
  onToggle: (amenityId: number) => void
  isLoading?: boolean
  customAmenities: string[]
  onAddCustom: (name: string) => void
  onRemoveCustom: (name: string) => void
}) {
  const customInputId = useId()
  const [customName, setCustomName] = useState("")
  const [customError, setCustomError] = useState<string | null>(null)

  const handleAddCustom = () => {
    const name = customName.trim()
    if (
      name.length < CUSTOM_NAME_MIN_LENGTH ||
      name.length > CUSTOM_NAME_MAX_LENGTH
    ) {
      setCustomError("نام امکان باید بین ۲ تا ۵۰ حرف باشد.")
      return
    }
    if (customAmenities.length >= MAX_CUSTOM_AMENITIES) {
      setCustomError("حداکثر ۱۵ امکان دستی قابل افزودن است.")
      return
    }
    const normalized = normalizeName(name)
    const isDuplicate =
      amenities.some((amenity) => normalizeName(amenity.name) === normalized) ||
      customAmenities.some((amenity) => normalizeName(amenity) === normalized)
    if (isDuplicate) {
      setCustomError("این امکان قبلاً اضافه شده است.")
      return
    }
    onAddCustom(name)
    setCustomName("")
    setCustomError(null)
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-xs text-ink-soft">در حال بارگذاری امکانات…</p>
      ) : amenities.length === 0 ? (
        <p className="text-xs text-ink-soft">امکاناتی برای انتخاب ثبت نشده است.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {amenities.map((amenity) => {
            const isSelected = selectedIds.includes(amenity.id)
            return (
              <label
                key={amenity.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm font-medium transition-colors",
                  isSelected
                    ? "border-brick/40 bg-brick/5 text-ink"
                    : "border-line bg-paper-card text-ink-soft hover:border-line-strong hover:text-ink"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggle(amenity.id)}
                  aria-label={amenity.name}
                />
                <span className="min-w-0 leading-5">{amenity.name}</span>
              </label>
            )
          })}
        </div>
      )}

      <div className="space-y-2.5 rounded-xl border border-line/70 bg-paper-deep/30 p-3.5">
        <div className="space-y-1">
          <label htmlFor={customInputId} className="block text-xs font-bold text-ink">
            امکانات دیگر (دستی)
          </label>
          <p className="text-[11px] leading-5 text-ink-soft">
            اگر امکانی در فهرست بالا نیست، نام آن را بنویسید؛ این موارد فقط برای
            همین اقامتگاه نمایش داده می‌شوند.
          </p>
        </div>

        <div className="flex items-start gap-2">
          <Input
            id={customInputId}
            value={customName}
            onChange={(event) => {
              setCustomName(event.target.value)
              if (customError) setCustomError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                handleAddCustom()
              }
            }}
            maxLength={CUSTOM_NAME_MAX_LENGTH}
            placeholder="مثلاً استخر سرپوشیده"
            aria-invalid={customError !== null}
            className="h-11 border-line bg-paper-card"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddCustom}
            disabled={customAmenities.length >= MAX_CUSTOM_AMENITIES}
            className="h-11 shrink-0 gap-1.5 border-line bg-paper-card font-bold"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>افزودن</span>
          </Button>
        </div>

        {customError ? (
          <p className="text-xs font-medium text-destructive" role="alert">
            {customError}
          </p>
        ) : null}

        {customAmenities.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {customAmenities.map((name) => (
              <li key={name}>
                <Badge
                  variant="outline"
                  className="gap-1 border-brick/30 bg-brick/5 py-1 pe-1 ps-2.5 text-xs font-medium text-ink"
                >
                  <span>{name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveCustom(name)}
                    aria-label={`حذف امکان ${name}`}
                    className="grid size-5 place-items-center rounded-full text-ink-soft transition-colors hover:bg-brick/10 hover:text-brick focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
