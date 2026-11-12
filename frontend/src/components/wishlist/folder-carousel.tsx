"use client"

import * as React from "react"
import { useState } from "react"
import { FolderOpen, Plus, FolderPlus, Pencil, Trash2 } from "lucide-react"
import type { WishlistFolder } from "@/types/wishlist"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface FolderCarouselProps {
  folders: WishlistFolder[]
  onFoldersChange: (folders: WishlistFolder[]) => void
  activeFolderId: string
  onSelectFolder: (folderId: string) => void
  totalItemsCount: number
}

export function FolderCarousel({
  folders,
  onFoldersChange,
  activeFolderId,
  onSelectFolder,
  totalItemsCount,
}: FolderCarouselProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [editingFolder, setEditingFolder] = useState<WishlistFolder | null>(null)

  const isCustomFolder = (folder: WishlistFolder) => folder.id.startsWith("folder_")

  const handleDeleteFolder = (folder: WishlistFolder) => {
    if (!window.confirm("پوشه حذف شود؟")) return
    onFoldersChange(folders.filter((f) => f.id !== folder.id))
    if (activeFolderId === folder.id) {
      onSelectFolder("all")
    }
  }

  const handleSubmitFolder = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newFolderName.trim()
    if (!trimmed) return

    if (editingFolder) {
      onFoldersChange(
        folders.map((f) => (f.id === editingFolder.id ? { ...f, name: trimmed } : f))
      )
      setEditingFolder(null)
      setNewFolderName("")
      setIsCreateOpen(false)
      return
    }

    const newFolder: WishlistFolder = {
      id: `folder_${Date.now()}`,
      name: trimmed,
      accommodation_ids: [],
      created_at: new Date().toISOString(),
    }

    onFoldersChange([...folders, newFolder])
    setNewFolderName("")
    setIsCreateOpen(false)
    onSelectFolder(newFolder.id)
  }

  const formatCount = (count: number) => {
    return new Intl.NumberFormat("fa-IR").format(count)
  }

  return (
    <section className="relative" aria-label="دسته‌بندی‌های نشان‌شده">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-brick">
            قفسه‌های سفر
          </p>
          <h2 className="mt-1 text-base font-black text-ink">پوشه‌ها و دسته‌ها</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="h-auto gap-1 p-0 text-xs font-semibold text-brick hover:bg-transparent hover:underline"
        >
          <FolderPlus className="size-3.5" />
          <span>پوشه جدید</span>
        </Button>
      </div>

      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-2">
        {folders.map((folder) => {
          const isActive = folder.id === activeFolderId
          const count =
            folder.id === "all"
              ? totalItemsCount
              : folder.accommodation_ids?.length || 0

          return (
            <div key={folder.id} className="flex flex-shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSelectFolder(folder.id)}
                className={cn(
                  "h-auto min-h-0 gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-all active:scale-95 sm:text-sm",
                  isActive
                    ? "border-transparent bg-brick text-on-brick shadow-soft hover:bg-brick-deep hover:text-on-brick"
                    : "border-line bg-paper-card text-ink-soft hover:border-line-strong hover:bg-paper-deep hover:text-ink"
                )}
              >
                <FolderOpen
                  className={cn("size-4", isActive ? "text-on-brick" : "text-brick")}
                />
                <span>{folder.name}</span>
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums",
                    isActive ? "text-on-brick/80" : "text-ink-soft"
                  )}
                >
                  ({formatCount(count)})
                </span>
              </Button>
              {isCustomFolder(folder) && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingFolder(folder)
                      setNewFolderName(folder.name)
                    }}
                    aria-label="تغییر نام پوشه"
                    className="size-7 min-h-7 min-w-7 rounded-full text-ink-soft hover:bg-paper-deep hover:text-brick"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteFolder(folder)}
                    aria-label="حذف پوشه"
                    className="size-7 min-h-7 min-w-7 rounded-full text-ink-soft hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </div>
          )
        })}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="h-auto min-h-0 flex-shrink-0 gap-1 rounded-full border border-dashed border-brick/45 bg-brick/5 px-3.5 py-2 text-xs font-semibold text-brick hover:bg-brick/10 hover:text-brick active:scale-95 sm:text-sm"
        >
          <Plus className="size-3.5" />
          <span>پوشه جدید</span>
        </Button>
      </div>

      <Dialog
        open={isCreateOpen || editingFolder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false)
            setEditingFolder(null)
            setNewFolderName("")
          }
        }}
      >
        <DialogContent className="text-right sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-black text-ink">
              {editingFolder ? "تغییر نام پوشه" : "ایجاد پوشه جدید"}
            </DialogTitle>
            <DialogDescription className="text-xs leading-6 text-ink-soft">
              {editingFolder
                ? "نام جدید پوشه را وارد فرمایید."
                : "نام پوشه را وارد فرمایید تا اقامتگاه‌های دلخواه در دسته‌های مجزا ذخیره شوند."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitFolder} className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="folder-name-input" className="text-xs font-semibold text-ink">
                عنوان پوشه
              </label>
              <Input
                id="folder-name-input"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="مثلاً: سفرهای پاییزه با دوستان"
                className="border-line bg-paper-card text-right"
                autoFocus
              />
            </div>

            <DialogFooter className="flex-row justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="border-line bg-transparent"
                onClick={() => {
                  setNewFolderName("")
                  setIsCreateOpen(false)
                  setEditingFolder(null)
                }}
              >
                انصراف
              </Button>
              <Button type="submit" disabled={!newFolderName.trim()}>
                {editingFolder ? "ذخیره" : "ایجاد پوشه"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
