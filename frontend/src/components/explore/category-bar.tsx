"use client"

import * as React from "react"
import { apiClient } from "@/lib/api-client"
import type { Category } from "@/types/accommodation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TreePine,
  Waves,
  Tent,
  Building,
  Home,
  LayoutGrid,
} from "lucide-react"

export interface CategoryBarProps {
  selectedCategoryId?: number
  onSelectCategory: (categoryId?: number) => void
}

function getCategoryIcon(slug: string) {
  const normalized = slug.toLowerCase()
  if (normalized.includes("cottage") || normalized.includes("choobi") || normalized.includes("kolbeh")) {
    return TreePine
  }
  if (normalized.includes("villa") || normalized.includes("pool") || normalized.includes("estakhr")) {
    return Waves
  }
  if (normalized.includes("ecotourism") || normalized.includes("boom") || normalized.includes("tabiat")) {
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
      <div className="flex items-center gap-3 overflow-x-auto py-3 scrollbar-none">
        <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
      </div>
    )
  }

  return (
    <div
      role="region"
      aria-label="دسته‌بندی‌های اقامتگاه"
      className="relative w-full border-b border-border/40 bg-background/80 backdrop-blur"
    >
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto py-3 px-1 scrollbar-none snap-x touch-pan-x">
        {/* "همه اقامتگاه‌ها" chip */}
        <Button
          type="button"
          variant={selectedCategoryId === undefined ? "default" : "outline"}
          size="sm"
          onClick={() => onSelectCategory(undefined)}
          aria-pressed={selectedCategoryId === undefined}
          className="shrink-0 snap-start rounded-full gap-2 px-4 h-9 font-medium shadow-xs transition-colors"
        >
          <LayoutGrid className="size-4" />
          <span>همه اقامتگاه‌ها</span>
        </Button>

        {/* Dynamic Categories */}
        {categories.map((cat) => {
          const IconComponent = getCategoryIcon(cat.slug)
          const isSelected = selectedCategoryId === cat.id

          return (
            <Button
              key={cat.id}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectCategory(cat.id)}
              aria-pressed={isSelected}
              className="shrink-0 snap-start rounded-full gap-2 px-4 h-9 font-medium shadow-xs transition-colors"
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
