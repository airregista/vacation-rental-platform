"use client"

import * as React from "react"
import { useState } from "react"
import { FolderOpen, Plus, FolderPlus } from "lucide-react"
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

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newFolderName.trim()
    if (!trimmed) return

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
            <Button
              key={folder.id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelectFolder(folder.id)}
              className={`flex-shrink-0 h-auto min-h-0 px-4 py-2 rounded-full text-xs sm:text-sm gap-1.5 active:scale-95 ${
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>ایجاد پوشه جدید</DialogTitle>
            <DialogDescription>
              نام پوشه را وارد فرمایید تا اقامتگاه‌های دلخواه در دسته‌های مجزا ذخیره شوند.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateFolder} className="space-y-4 py-2">
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
                }}
              >
                انصراف
              </Button>
              <Button type="submit" disabled={!newFolderName.trim()}>
                ایجاد پوشه
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
