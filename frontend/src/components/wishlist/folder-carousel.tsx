"use client"

import * as React from "react"
import { useState, useEffect } from "react"
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

const STORAGE_KEY = "jabama_wishlist_folders"

const DEFAULT_FOLDERS: WishlistFolder[] = [
  { id: "all", name: "همه نشان‌شده‌ها", accommodation_ids: [] },
  { id: "summer-north", name: "سفرهای تابستانه شمال", accommodation_ids: [] },
  { id: "masal-cabins", name: "کلبه‌های جنگلی ماسال", accommodation_ids: [] },
  { id: "yazd-traditional", name: "خانه‌های سنتی یزد", accommodation_ids: [] },
]

export interface FolderCarouselProps {
  activeFolderId: string
  onSelectFolder: (folderId: string) => void
  totalItemsCount: number
  folders?: WishlistFolder[]
  onFoldersChange?: (folders: WishlistFolder[]) => void
}

export function FolderCarousel({
  activeFolderId,
  onSelectFolder,
  totalItemsCount,
  folders: controlledFolders,
  onFoldersChange,
}: FolderCarouselProps) {
  const [internalFolders, setInternalFolders] = useState<WishlistFolder[]>(DEFAULT_FOLDERS)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

  const folders = controlledFolders || internalFolders

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as WishlistFolder[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            setInternalFolders(parsed)
            onFoldersChange?.(parsed)
            return
          }
        }
      } catch {
        // Fallback to default folders on JSON parse failure
      }
      onFoldersChange?.(DEFAULT_FOLDERS)
    }, 0)

    return () => clearTimeout(timer)
  }, [onFoldersChange])

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

    const updated = [...folders, newFolder]
    setInternalFolders(updated)
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // Handle localStorage quota error safely
      }
    }
    onFoldersChange?.(updated)
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
            <button
              key={folder.id}
              type="button"
              onClick={() => onSelectFolder(folder.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm flex items-center gap-1.5 transition-all active:scale-95 ${
                isActive
                  ? "bg-foreground text-background font-bold shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <FolderOpen className={`w-4 h-4 ${isActive ? "text-background" : "text-muted-foreground"}`} />
              <span>{folder.name}</span>
              <span className={`text-[11px] font-medium opacity-80 ${isActive ? "text-background" : "text-muted-foreground"}`}>
                ({formatCount(count)})
              </span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex-shrink-0 px-3.5 py-2 rounded-full border border-dashed border-primary text-primary bg-primary/5 hover:bg-primary/10 text-xs sm:text-sm font-medium flex items-center gap-1 transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>پوشه جدید</span>
        </button>
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
