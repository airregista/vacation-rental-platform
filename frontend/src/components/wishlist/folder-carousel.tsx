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
    <section className="relative my-4" aria-label="دسته‌بندی‌های نشان‌شده">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">پوشه‌ها و دسته‌ها</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="text-xs text-primary font-semibold hover:underline gap-1 p-0 h-auto"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>مدیریت پوشه‌ها</span>
        </Button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
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
                className={`h-auto min-h-0 px-4 py-2 rounded-full text-xs sm:text-sm gap-1.5 active:scale-95 ${
                  isActive
                    ? "bg-foreground text-background font-bold shadow-sm hover:bg-foreground hover:text-background"
                    : "bg-card border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <FolderOpen className={`w-4 h-4 ${isActive ? "text-background" : "text-muted-foreground"}`} />
                <span>{folder.name}</span>
                <span className={`text-[11px] font-medium opacity-80 ${isActive ? "text-background" : "text-muted-foreground"}`}>
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
                    className="size-7 min-h-7 min-w-7 rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteFolder(folder)}
                    aria-label="حذف پوشه"
                    className="size-7 min-h-7 min-w-7 rounded-full text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
          className="flex-shrink-0 h-auto min-h-0 px-3.5 py-2 rounded-full border border-dashed border-primary text-primary bg-primary/5 hover:bg-primary/10 hover:text-primary text-xs sm:text-sm font-medium gap-1 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
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
        <DialogContent className="sm:max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingFolder ? "تغییر نام پوشه" : "ایجاد پوشه جدید"}
            </DialogTitle>
            <DialogDescription>
              {editingFolder
                ? "نام جدید پوشه را وارد فرمایید."
                : "نام پوشه را وارد فرمایید تا اقامتگاه‌های دلخواه در دسته‌های مجزا ذخیره شوند."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitFolder} className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="folder-name-input" className="text-xs font-semibold text-foreground">
                عنوان پوشه
              </label>
              <Input
                id="folder-name-input"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="مثلاً: سفرهای پاییزه با دوستان"
                className="text-right"
                autoFocus
              />
            </div>

            <DialogFooter className="flex-row justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
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
