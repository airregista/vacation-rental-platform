"use client"

import * as React from "react"
import { apiClient } from "@/lib/api-client"
import type { Category } from "@/types/accommodation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TreePine, Waves, Tent, Building, Home, LayoutGrid } from "lucide-react"

export interface CategoryBarProps {
  selectedCategoryId?: number
  onSelectCategory: (categoryId?: number) => void
}

function getCategoryIcon(slug: string) {
  const normalized = slug.toLowerCase()
  if (
    normalized.includes("cottage") ||
    normalized.includes("choobi") ||
    normalized.includes("kolbeh")
  ) {
    return TreePine
  }
  if (
    normalized.includes("villa") ||
    normalized.includes("pool") ||
    normalized.includes("estakhr")
  ) {
    return Waves
  }
  if (normalized.includes("eco") || normalized.includes("boom") || normalized.includes("tabiat")) {
    return Tent
  }
  if (normalized.includes("apartment") || normalized.includes("suite")) {
    return Building
  }
  return Home
}

export function CategoryBar({ selectedCategoryId, onSelectCategory }: CategoryBarProps) {
  const [categories, setCategories] = React.useState<Category[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let isMounted = true
    async function fetchCategories() {
      try {
        const data = await apiClient.get<Category[]>("/categories/")
        if (isMounted) {
          setCategories(data || [])
        }
      } catch (err) {
        console.error("Failed to load categories:", err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }
    fetchCategories()
    return () => {
      isMounted = false
    }
  }, [])

  if (isLoading) {
    return (
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-28 shrink-0 rounded-full bg-paper-deep" />
        ))}
      </div>
    )
  }

  const chipClass =
    "h-9 shrink-0 snap-start gap-2 px-4 text-xs font-semibold shadow-none transition-colors"

  return (
    <div role="region" aria-label="دسته‌بندی‌های اقامتگاه" className="relative w-full">
      <div className="no-scrollbar flex snap-x touch-pan-x items-center gap-2 overflow-x-auto py-1">
        <Button
          type="button"
          variant={selectedCategoryId === undefined ? "default" : "outline"}
          size="sm"
          shape="pill"
          onClick={() => onSelectCategory(undefined)}
          aria-pressed={selectedCategoryId === undefined}
          className={chipClass}
        >
          <LayoutGrid className="size-4" />
          <span>همه اقامتگاه‌ها</span>
        </Button>

        {categories.map((cat) => {
          const IconComponent = getCategoryIcon(cat.slug)
          const isSelected = selectedCategoryId === cat.id

          return (
            <Button
              key={cat.id}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              shape="pill"
              onClick={() => onSelectCategory(isSelected ? undefined : cat.id)}
              aria-pressed={isSelected}
              className={chipClass}
            >
              <IconComponent className="size-4" />
              <span>{cat.title}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
