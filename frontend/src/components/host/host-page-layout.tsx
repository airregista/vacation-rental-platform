"use client"

import type { ReactNode } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { cn } from "@/lib/utils"
import { HostSectionNav } from "./host-section-nav"

export interface HostPageLayoutProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  backHref?: string
  backLabel?: string
  showNav?: boolean
  children: ReactNode
  contentClassName?: string
}

/**
 * The one frame for every host screen: editorial header, host navigation and
 * the paper content field. The wizard opts out of the nav to keep its step
 * flow focused.
 */
export function HostPageLayout({
  eyebrow = "میزبانی",
  title,
  description,
  actions,
  backHref,
  backLabel,
  showNav = true,
  children,
  contentClassName,
}: HostPageLayoutProps) {
  return (
    <div className="text-ink">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
        backHref={backHref}
        backLabel={backLabel}
      />
      <div
        className={cn(
          "mx-auto w-full max-w-[1360px] px-4 pb-24 pt-6 sm:px-6 lg:px-8",
          contentClassName,
        )}
      >
        {showNav ? <HostSectionNav /> : null}
        <div className={showNav ? "mt-6" : undefined}>{children}</div>
      </div>
    </div>
  )
}
