"use client"

import * as React from "react"
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react"
import { ApiError, apiClient } from "@/lib/api-client"
import { toPersianDigits } from "@/lib/format-fa"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]
const ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp"

export interface ImageUploaderItem {
  id?: number
  image_url: string
  is_cover: boolean
  sort_order: number
}

export interface ImageUploaderProps {
  images: ImageUploaderItem[]
  onAdd: (image: ImageUploaderItem) => Promise<void> | void
  onRemove: (image: ImageUploaderItem) => Promise<void> | void
  onSetCover?: (image: ImageUploaderItem) => Promise<void> | void
  emptyText?: string
  disabled?: boolean
  className?: string
}

function imageKey(image: ImageUploaderItem, index: number): string {
  return image.id !== undefined
    ? `id-${image.id}`
    : `url-${image.sort_order}-${index}-${image.image_url}`
}

function getUploadErrorMessage(error: unknown, fileName: string): string {
  if (error instanceof ApiError) {
    if (error.status === 413) {
      return `حجم «${fileName}» بیش از حد مجاز است.`
    }
    if (error.status === 400) {
      return `«${fileName}» تصویر معتبری نیست؛ فقط JPEG، PNG یا WebP مجاز است.`
    }
  }
  return `بارگذاری «${fileName}» با خطا مواجه شد. دوباره تلاش کنید.`
}

/**
 * Shared host image manager: validates and uploads files to `/uploads/image`,
 * then hands the resulting relative URL to the parent so create/edit can
 * persist it with their own API shape. Thumbnails use plain <img> because
 * uploaded files are served from the same origin through the `/uploads` proxy.
 */
export function ImageUploader({
  images,
  onAdd,
  onRemove,
  onSetCover,
  emptyText = "هنوز تصویری اضافه نشده است.",
  disabled = false,
  className,
}: ImageUploaderProps) {
  const generatedId = React.useId()
  const fileInputId = `${generatedId}-file`
  const coverCheckboxId = `${generatedId}-cover`
  const hintId = `${generatedId}-hint`

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [makeCover, setMakeCover] = React.useState(false)
  const [removingKey, setRemovingKey] = React.useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = React.useState<string[]>([])
  const [brokenKeys, setBrokenKeys] = React.useState<Set<string>>(new Set())

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (files.length === 0) return

    const validationErrors: string[] = []
    const validFiles = files.filter((file) => {
      if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        validationErrors.push(
          `«${file.name}» فقط در قالب JPEG، PNG یا WebP قابل بارگذاری است.`
        )
        return false
      }
      if (file.size > MAX_FILE_SIZE) {
        validationErrors.push(`حجم «${file.name}» بیش از ۵ مگابایت است.`)
        return false
      }
      return true
    })

    setUploadErrors(validationErrors)
    if (validFiles.length === 0) return

    setIsUploading(true)
    const uploadErrors: string[] = []
    let nextSortOrder =
      images.reduce((max, image) => Math.max(max, image.sort_order), -1) + 1
    let needsCover = makeCover || !images.some((image) => image.is_cover)
    let uploadedCount = 0

    try {
      for (const file of validFiles) {
        const formData = new FormData()
        formData.append("file", file)

        let uploadedUrl: string
        try {
          const result = await apiClient.post<{ url: string }>(
            "/uploads/image",
            formData
          )
          if (!result.url) {
            throw new Error("missing-upload-url")
          }
          uploadedUrl = result.url
        } catch (error: unknown) {
          uploadErrors.push(getUploadErrorMessage(error, file.name))
          continue
        }

        const isCover = needsCover
        try {
          await onAdd({
            image_url: uploadedUrl,
            is_cover: isCover,
            sort_order: nextSortOrder,
          })
        } catch {
          uploadErrors.push(
            `افزودن «${file.name}» به گالری با خطا مواجه شد.`
          )
          continue
        }

        if (isCover) needsCover = false
        nextSortOrder += 1
        uploadedCount += 1
      }
    } finally {
      setIsUploading(false)
      setUploadErrors([...validationErrors, ...uploadErrors])
      if (uploadedCount > 0) setMakeCover(false)
    }
  }

  const handleRemove = async (image: ImageUploaderItem, key: string) => {
    setRemovingKey(key)
    try {
      await onRemove(image)
    } catch {
      // The parent owns the server error message shown above the gallery.
    } finally {
      setRemovingKey(null)
    }
  }

  const handleSetCover = async (image: ImageUploaderItem) => {
    if (!onSetCover) return
    try {
      await onSetCover(image)
    } catch {
      // The parent owns the server error message shown above the gallery.
    }
  }

  const isBusy = isUploading || removingKey !== null

  return (
    <div className={cn("space-y-4", className)} aria-busy={isBusy}>
      {images.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-paper-deep/35 p-4 text-xs leading-6 text-ink-soft">
          {emptyText}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="list">
          {images.map((image, index) => {
            const key = imageKey(image, index)
            const isRemoving = removingKey === key
            return (
              <li
                key={key}
                className="min-w-0 overflow-hidden rounded-xl border border-line bg-paper-card"
              >
                <div className="relative aspect-[16/10] bg-paper-deep">
                  {brokenKeys.has(key) ? (
                    <div className="grid h-full place-items-center text-ink-soft">
                      <ImagePlus className="size-7" aria-hidden="true" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.image_url}
                      alt={`تصویر ${toPersianDigits(index + 1)} اقامتگاه`}
                      onError={() =>
                        setBrokenKeys((current) => new Set(current).add(key))
                      }
                      className="h-full w-full object-cover"
                    />
                  )}
                  {image.is_cover ? (
                    <Badge
                      variant="outline"
                      className="absolute right-2 top-2 border-gold/40 bg-gold-soft/90 text-[10px] font-bold text-ink backdrop-blur"
                    >
                      کاور
                    </Badge>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 p-1.5">
                  {onSetCover && !image.is_cover ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleSetCover(image)}
                      disabled={isBusy}
                      className="h-auto min-h-8 min-w-0 flex-1 basis-full justify-start gap-1 whitespace-normal px-1.5 py-1 text-right text-[10px] font-bold leading-4 text-ink-soft hover:text-brick sm:basis-auto"
                    >
                      <Star className="size-3 shrink-0" aria-hidden="true" />
                      <span>تعیین به عنوان کاور</span>
                    </Button>
                  ) : (
                    <span className="px-1.5 text-[10px] font-bold text-ink-soft">
                      {image.is_cover ? "تصویر کاور" : ""}
                    </span>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleRemove(image, key)}
                    disabled={isBusy}
                    aria-busy={isRemoving}
                    aria-label={`حذف تصویر ${toPersianDigits(index + 1)}`}
                    className="size-8 min-h-8 min-w-8 shrink-0 rounded-full text-ink-soft hover:bg-destructive/10 hover:text-destructive"
                  >
                    {isRemoving ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="rounded-xl border border-dashed border-line bg-paper-deep/35 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-bold text-ink">افزودن تصویر از دستگاه</p>
            <p id={hintId} className="text-[11px] leading-5 text-ink-soft">
              JPEG، PNG یا WebP؛ حداکثر ۵ مگابایت برای هر تصویر.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {images.length > 0 ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={coverCheckboxId}
                  checked={makeCover}
                  onCheckedChange={(checked) => setMakeCover(checked === true)}
                  disabled={isBusy || disabled}
                />
                <label
                  htmlFor={coverCheckboxId}
                  className="cursor-pointer text-[11px] font-bold text-ink"
                >
                  تصویر جدید کاور شود
                </label>
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              multiple
              tabIndex={-1}
              onChange={(event) => void handleFiles(event)}
              aria-label="انتخاب تصاویر اقامتگاه"
              aria-describedby={hintId}
              className="sr-only"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy || disabled}
              aria-busy={isUploading}
              className="gap-2 border-line bg-paper-card"
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ImagePlus className="size-4" aria-hidden="true" />
              )}
              <span>{isUploading ? "در حال بارگذاری…" : "انتخاب تصویر"}</span>
            </Button>
          </div>
        </div>

        {uploadErrors.length > 0 ? (
          <ul
            role="alert"
            className="mt-3 space-y-1 text-[11px] font-medium leading-5 text-destructive"
          >
            {uploadErrors.map((error, index) => (
              <li key={`${error}-${index}`}>{error}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
