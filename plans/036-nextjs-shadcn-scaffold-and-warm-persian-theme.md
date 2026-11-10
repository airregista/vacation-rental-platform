# Plan 036: Scaffold Next.js 14 App with TypeScript, Tailwind CSS, Shadcn UI, and Warm Persian Hospitality Theme

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 677a622..HEAD -- template/warm_persian_hospitality/DESIGN.md frontend/package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Status**: DONE
- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/035-backend-otp-and-host-role-extension.md
- **Category**: dx
- **Planned at**: commit `677a622`, 2026-11-09

## Why this matters

The Ashianak booking frontend must run on Next.js 14 (App Router), TypeScript, Tailwind CSS, and canonical Shadcn UI primitives. Rather than hardcoding hex colors or building fragile custom UI elements (custom `<div>` buttons, custom spans for badges, hand-rolled modals), the architecture strictly mandates using canonical Shadcn UI primitives (`@radix-ui` + `class-variance-authority`) and the Warm Persian Hospitality design system from `template/warm_persian_hospitality/DESIGN.md`. All colors are mapped to semantic CSS variables in `globals.css` (`--primary: #F05A28`, `--secondary: #D97706`, `--accent: #0D9488`, `--background: #FAFAF9`), completely prohibiting hardcoded hex codes, hand-rolled duplicate components, or unstandardized markup.

## Strict Component & Styling Governance (Zero Hand-Rolled UI Primitives)

To prevent code duplication, inconsistencies, and messy custom markup, the following rules are **strictly enforced without exception**:
1. **Never build arbitrary custom UI primitives**: Do NOT build custom buttons, hand-rolled modal overlays, custom `<span>` badges, custom `<div>` separators, or custom pulse skeletons.
2. **Canonical Shadcn/UI components only**: Every single visual primitive must be sourced directly from canonical Shadcn UI (`src/components/ui/`):
   - Actions: `Button` (variants: default, outline, ghost, secondary, destructive, link; default touch target min-h 44px)
   - Layout & Containers: `Card` (with full composition: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`), `Separator`
   - Navigation: `Tabs` (`TabsList`, `TabsTrigger`, `TabsContent`), `DropdownMenu`
   - Overlays: `Dialog` (for desktop modals), `Sheet` (for mobile slide-up sheets and slide drawers)
   - Form Controls: `Input` (16px base font size on mobile to prevent iOS auto-zoom)
   - Feedback & Badges: `Badge` (using semantic variants: default, secondary, accent, destructive, outline), `Skeleton` (for loading placeholders)
   - Media: `Avatar` (`AvatarImage`, `AvatarFallback`)
3. **Zero Hardcoded Colors**: Colors must NEVER be hardcoded as raw hex strings (`#F05A28`, `#D97706`, etc.) in component markup. All color styles must consume semantic tokens from `globals.css` (`bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-muted`, `border-border`, etc.).

## Current state

- `template/warm_persian_hospitality/DESIGN.md` contains the full design token specification:
  - Primary: `#F05A28` (Terracotta Coral)
  - Secondary: `#D97706` (Warm Amber)
  - Accent / Tertiary: `#0D9488` (Persian Teal)
  - Canvas Background: `#FAFAF9` (Warm Stone White)
  - Card Surface: `#FFFFFF` (Pure Crisp White)
  - Subdued / Input Background: `#F5F5F4` (Soft Alabaster)
  - Border: `#E7E5E4` (Muted Warm Gray)
  - Dark Neutral / Foreground: `#111C2D`
  - Radius: `rounded-2xl` for cards, `rounded-full` for search pills, `rounded-xl` for inputs/buttons
  - Typography: `Vazirmatn` font for Persian text, proportional weights and relaxed line-heights.
- `frontend/` directory is initialized with Next.js 14+ / 16+, TypeScript, and Tailwind CSS v4.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Install deps | `npm --prefix frontend install --legacy-peer-deps clsx tailwind-merge class-variance-authority lucide-react @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-avatar @radix-ui/react-dropdown-menu @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-checkbox` | exit 0, added packages |
| Typecheck & Build | `npm --prefix frontend run build` | exit 0, compiled successfully |
| Check lucide | `npm --prefix frontend list lucide-react` | exit 0 |

## Scope

**In scope**:
- Ensure `frontend/` dependencies include `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, and `@radix-ui` primitives using `--legacy-peer-deps` (required for React 19 compatibility).
- Implement `frontend/src/lib/utils.ts` (`cn` helper using `clsx` and `tailwind-merge`).
- Configure `frontend/src/app/globals.css` with semantic CSS variables mapped from `template/warm_persian_hospitality/DESIGN.md`, Tailwind v4 `@theme inline` binding, and mobile safe-area utility classes.
- Configure `frontend/src/app/layout.tsx` with:
  - `dir="rtl"`, `lang="fa"`, and resilient `Vazirmatn` font stack configured in CSS.
  - Next.js separate `Viewport` export (`width: "device-width"`, `initialScale: 1`, `maximumScale: 5`, `viewportFit: "cover"`).
  - Mobile bottom padding offset (`pb-20 md:pb-0`) to prevent fixed mobile bottom navigation from occluding page contents.
- Implement canonical Shadcn UI primitives in `frontend/src/components/ui/`:
  - `button.tsx` (>=44px touch targets)
  - `input.tsx` (>=16px font size on mobile to prevent iOS zoom)
  - `card.tsx` (full composite: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`)
  - `badge.tsx` (semantic variants: `default`, `secondary`, `accent`, `outline`, `destructive`)
  - `separator.tsx` (Radix separator)
  - `skeleton.tsx` (animated loading placeholder)
  - `dialog.tsx` (accessible Radix Dialog modal)
  - `sheet.tsx` (accessible Radix Sheet for mobile bottom drawer and slide panels)
  - `tabs.tsx` (accessible Radix Tabs)
  - `avatar.tsx` (accessible Radix Avatar with fallback)
- Configure `frontend/src/lib/api-client.ts` pointing to `http://localhost:8000/api/v1` with typed methods, token injection, and structured `ApiError`.

**Out of scope**:
- Feature pages and modals (handled in plans 037–044).
- Backend changes (Plan 035 is completed).

## Git workflow

- Branch: `advisor/036-nextjs-shadcn-scaffold-and-warm-persian-theme`
- Commit style: `feat(frontend): bootstrap Next.js app with Shadcn UI and Warm Persian theme`

---

## Steps

### Step 1: Verify / Scaffold Next.js Project

Check if `frontend/package.json` exists. If not, initialize with `create-next-app`. If it exists, verify its integrity:

```powershell
if (-not (Test-Path "frontend/package.json")) {
    npx --yes create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
}
```

**Verify**:
```powershell
Test-Path "frontend/package.json"
```
→ Expected: `True`

---

### Step 2: Install UI Foundations with Peer Dependency Flag

Install Radix UI primitives and utility packages. Because React 19 is installed, pass `--legacy-peer-deps` to ensure npm resolves without peer dependency conflicts:

```powershell
npm --prefix frontend install --legacy-peer-deps clsx tailwind-merge class-variance-authority lucide-react @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-avatar @radix-ui/react-dropdown-menu @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-checkbox
```

**Verify**:
```powershell
npm --prefix frontend list lucide-react clsx tailwind-merge class-variance-authority
```
→ Expected: exit 0, all packages listed.

---

### Step 3: Implement `frontend/src/lib/utils.ts`

Create the standard class merging utility:

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Verify**:
```powershell
Test-Path "frontend/src/lib/utils.ts"
```
→ Expected: `True`

---

### Step 4: Configure Warm Persian Theme and Font Stack in `frontend/src/app/globals.css`

Write `frontend/src/app/globals.css` with semantic color variables matching `template/warm_persian_hospitality/DESIGN.md`, Tailwind v4 `@theme inline` mappings, robust offline-safe Persian font fallbacks, and mobile safe-area utilities:

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: #FAFAF9; /* Warm Stone White */
    --foreground: #111C2D; /* Deep Slate */
    --card: #FFFFFF; /* Pure Crisp White */
    --card-foreground: #111C2D;
    --popover: #FFFFFF;
    --popover-foreground: #111C2D;
    --primary: #F05A28; /* Terracotta Coral */
    --primary-foreground: #FFFFFF;
    --secondary: #D97706; /* Warm Amber */
    --secondary-foreground: #FFFFFF;
    --muted: #F5F5F4; /* Soft Alabaster */
    --muted-foreground: #64748B; /* Secondary Slate */
    --accent: #0D9488; /* Persian Teal */
    --accent-foreground: #FFFFFF;
    --destructive: #DC2626;
    --destructive-foreground: #FFFFFF;
    --border: #E7E5E4; /* Muted Warm Gray */
    --input: #E7E5E4;
    --ring: #F05A28;
    --radius: 1rem;
    --font-vazirmatn: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  .dark {
    --background: #0F172A;
    --foreground: #F8FAFC;
    --card: #1E293B;
    --card-foreground: #F8FAFC;
    --popover: #1E293B;
    --popover-foreground: #F8FAFC;
    --primary: #F05A28;
    --primary-foreground: #FFFFFF;
    --secondary: #D97706;
    --secondary-foreground: #FFFFFF;
    --muted: #334155;
    --muted-foreground: #94A3B8;
    --accent: #0D9488;
    --accent-foreground: #FFFFFF;
    --destructive: #7F1D1D;
    --destructive-foreground: #F8FAFC;
    --border: #334155;
    --input: #334155;
    --ring: #F05A28;
  }
}

@theme inline {
  --font-sans: var(--font-vazirmatn);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

body {
  font-family: var(--font-vazirmatn);
}

/* Mobile Safe Area utilities */
.safe-pb {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.safe-pt {
  padding-top: env(safe-area-inset-top, 0px);
}
```

**Verify**:
```powershell
Get-Content "frontend/src/app/globals.css" | Select-String "#F05A28"
```
→ Expected: contains `--primary: #F05A28;`

---

### Step 5: Configure RTL Layout, Mobile Viewport, and Font in `frontend/src/app/layout.tsx`

Update `frontend/src/app/layout.tsx` to set `dir="rtl"`, `lang="fa"`, export separate `viewport`, and wrap children with mobile navigation offset. Note: Do NOT use online `next/font/google` fetch at build time (to prevent build failures in sandboxed/offline/proxy environments); the font is handled via CSS variables and system fallbacks in `globals.css`:

```tsx
import type { Metadata, Viewport } from "next"
import "./globals.css"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#FAFAF9",
}

export const metadata: Metadata = {
  title: "آشیانک | سامانه رزرو اقامتگاه و بوم‌گردی",
  description: "سامانه رزرو آنلاین ویلا، سوئیت، اقامتگاه بوم‌گردی و کلبه در سراسر ایران با ضمانت تحویل و مهمان‌نوازی اصیل ایرانی",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 pb-20 md:pb-0 safe-pb">
        {children}
      </body>
    </html>
  )
}
```

**Verify**:
```powershell
Get-Content "frontend/src/app/layout.tsx" | Select-String 'dir="rtl"'
```
→ Expected: contains `dir="rtl"`

---

### Step 6: Implement Canonical Shadcn Primitives

Create the canonical Shadcn UI components under `frontend/src/components/ui/`:

#### 1. `frontend/src/components/ui/button.tsx`
```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-border bg-background shadow-sm hover:bg-muted hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2 min-h-[44px]", // minimum 44px tap target
        sm: "h-9 rounded-lg px-3 text-xs min-h-[36px]",
        lg: "h-12 rounded-xl px-8 text-base min-h-[48px]",
        icon: "size-11 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

#### 2. `frontend/src/components/ui/input.tsx`
```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

#### 3. `frontend/src/components/ui/card.tsx`
```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-2xl border border-border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

#### 4. `frontend/src/components/ui/badge.tsx`
```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        accent: "border-transparent bg-accent text-accent-foreground hover:bg-accent/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
```

#### 5. `frontend/src/components/ui/separator.tsx`
```tsx
import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
```

#### 6. `frontend/src/components/ui/skeleton.tsx`
```tsx
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

#### 7. `frontend/src/components/ui/dialog.tsx`
```tsx
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-muted">
        <X className="size-5" />
        <span className="sr-only">بستن</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 text-center sm:text-right", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
```

#### 8. `frontend/src/components/ui/sheet.tsx`
```tsx
"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b border-border data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t border-border rounded-t-3xl data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom max-h-[90vh] overflow-y-auto safe-pb",
        left: "inset-y-0 left-0 h-full w-3/4 border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-muted">
        <X className="size-5" />
        <span className="sr-only">بستن</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col gap-2 text-center sm:text-right", className)}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2", className)}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
```

#### 9. `frontend/src/components/ui/tabs.tsx`
```tsx
"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-11 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm min-h-[36px]",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

#### 10. `frontend/src/components/ui/avatar.tsx`
```tsx
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex size-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square size-full object-cover", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex size-full items-center justify-center rounded-full bg-muted font-medium text-muted-foreground",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
```

**Verify**:
```powershell
Test-Path "frontend/src/components/ui/button.tsx", "frontend/src/components/ui/input.tsx", "frontend/src/components/ui/card.tsx", "frontend/src/components/ui/badge.tsx", "frontend/src/components/ui/separator.tsx", "frontend/src/components/ui/skeleton.tsx", "frontend/src/components/ui/dialog.tsx", "frontend/src/components/ui/sheet.tsx", "frontend/src/components/ui/tabs.tsx", "frontend/src/components/ui/avatar.tsx"
```
→ Expected: All return `True`

---

### Step 7: Setup Strongly-Typed API Client in `frontend/src/lib/api-client.ts`

Create `frontend/src/lib/api-client.ts` supporting standard HTTP methods with automated JWT Bearer authorization injection and typed error handling:

```typescript
export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(`API Error (${status}): ${detail}`)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"

function serializeBody(body?: unknown): BodyInit | null | undefined {
  if (body === undefined || body === null) return undefined
  if (typeof body === "string" || body instanceof FormData) return body
  return JSON.stringify(body)
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`

  const headers = new Headers(options.headers || {})
  if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  // Inject token if available in client environment
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token")
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`)
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let errorDetail = "خطای سرور رخ داده است"
    try {
      const errorJson = await response.json()
      if (typeof errorJson.detail === "string") {
        errorDetail = errorJson.detail
      } else if (Array.isArray(errorJson.detail) && errorJson.detail.length > 0) {
        errorDetail = errorJson.detail[0]?.msg || JSON.stringify(errorJson.detail)
      } else if (errorJson.message) {
        errorDetail = errorJson.message
      }
    } catch {
      errorDetail = response.statusText || errorDetail
    }
    throw new ApiError(response.status, errorDetail)
  }

  if (response.status === 204) {
    return {} as T
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : {}) as T
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: serializeBody(body),
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: serializeBody(body),
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: serializeBody(body),
    }),

  delete: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "DELETE",
      body: serializeBody(body),
    }),
}
```

**Verify**:
```powershell
Test-Path "frontend/src/lib/api-client.ts"
```
→ Expected: `True`

---

### Step 8: Build Verification

Execute full TypeScript compile and Next.js production build:

```powershell
npm --prefix frontend run build
```

**Verify**:
`npm --prefix frontend run build` exits 0 with message containing "Compiled successfully".

---

## Test plan

- **Build verification**: `npm --prefix frontend run build` completes with 0 errors and zero TypeScript issues.
- **Token consistency**: `globals.css` defines `--primary: #F05A28`, `--secondary: #D97706`, `--accent: #0D9488`, `--background: #FAFAF9`.
- **RTL root**: `frontend/src/app/layout.tsx` contains `dir="rtl"` and `lang="fa"`.
- **Primitive coverage**: All 10 canonical Shadcn components exist in `frontend/src/components/ui/`.
- **API client contract**: `frontend/src/lib/api-client.ts` exports `apiClient` and `ApiError`.

## Done criteria

- [x] `frontend/package.json` exists and includes dependencies (`lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/*`)
- [x] `frontend/src/lib/utils.ts` exists and exports `cn`
- [x] `frontend/src/app/globals.css` contains Warm Persian color tokens and Tailwind v4 `@theme inline` bindings
- [x] `frontend/src/app/layout.tsx` configures `dir="rtl"`, `lang="fa"`, `Vazirmatn`, and mobile viewport metadata
- [x] All 10 primitives (`button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `separator.tsx`, `skeleton.tsx`, `dialog.tsx`, `sheet.tsx`, `tabs.tsx`, `avatar.tsx`) exist in `frontend/src/components/ui/`
- [x] `frontend/src/lib/api-client.ts` exists and exports `apiClient` and `ApiError`
- [x] `npm --prefix frontend run build` exits 0 with zero errors
- [x] `plans/README.md` status row updated

## STOP conditions

- If `npm --prefix frontend run build` fails and cannot be resolved within the in-scope files.
- If npm install fails due to a network connection timeout or blocked registry.
- If Next.js version requires breaking changes to file structure.

## Maintenance notes

- Any new UI components must be built by composing existing Shadcn primitives in `src/components/ui/`.
- Never use inline hex color values in `.tsx` files; always reference semantic tokens (`bg-primary`, `text-secondary`, etc.).

## Second-pass review fixes (2026-11-10)

- **Status: APPROVED 2026-11-10.** Executor commit `c190a34` on `advisor/036-review-fixes` (6 files). Reviewer re-ran tsc/lint/build (all exit 0) and the full suite: **106 passed**; read the full diff. R1–R5 all done. Judgment accepted: the `.safe-pb` definition stays in `globals.css` because BottomNav and the host wizard bar still use it correctly (only the competing body/sheet usages were replaced).
- **Planned at:** `438fdc8` (main, post-043 merge). **Source:** the 035–040 code review (2026-11-10): a coordinator subagent reviewed the net effect of plans 035–040 on main; the advisor verified every finding below against the live code before writing this section. 1 Medium, 4 Low.
- **Scope:** `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx`, `frontend/src/components/ui/sheet.tsx`, `frontend/src/lib/api-client.ts`, `frontend/package.json` (+ lockfile). Nothing else. SKIP `plans/README.md` — the reviewer maintains it.

### R1 (Medium) — Unlayered `.safe-pb` silently overrides the `pb-20` bottom offset
- **File:** `frontend/src/app/globals.css:83-85` + `frontend/src/app/layout.tsx:31`. `.safe-pb` is declared at the top level of `globals.css` (unlayered) while Tailwind's `pb-20` lives in `@layer utilities`. Unlayered author CSS always beats layered CSS, so on `<body className="... pb-20 md:pb-0 safe-pb ...">` the effective `padding-bottom` is just `env(safe-area-inset-bottom, 0px)` — 0px on devices without a bottom inset — instead of the intended 80px. Same root cause in `sheet.tsx`'s bottom variant, where `p-6` combined with `safe-pb` is overridden to 0px bottom padding on non-notch devices.
- **Scenario:** on any phone (< `md`), scroll to the bottom of any page — the fixed `BottomNav` (64px tall) covers the bottom ~64px of content (footer, end-of-page buttons), which cannot be scrolled into view.
- **Fix:** remove `safe-pb` from `<body>` and use an additive utility instead, e.g. `pb-[calc(5rem+env(safe-area-inset-bottom,0px))]` (and the same for the sheet's bottom variant).
- **Done when:** the built CSS gives `<body>` an effective `padding-bottom` of 80px + safe-area inset on mobile, and the sheet's bottom variant keeps its `p-6` bottom padding; no other page's bottom offset regresses.

### R2 (Low) — All `animate-in` / `fade-*` / `zoom-*` / `slide-in-from-*` classes are dead
- **File:** `frontend/src/components/ui/dialog.tsx:20,37`, `frontend/src/components/ui/sheet.tsx:20,30`. The overlay/content classes rely on `tw-animate-css`, but that package is not in `package.json`, is not in `node_modules`, and `globals.css` never imports it. Tailwind v4 does not ship these utilities. The built CSS contains 0 occurrences of `animate-in`.
- **Scenario:** every dialog/sheet open/close — no fade, zoom, or slide runs; overlays just pop in/out instantly.
- **Fix:** `npm i tw-animate-css` and add `@import "tw-animate-css";` to `globals.css`.
- **Done when:** the built CSS contains `animate-in` (and the `fade-*`/`zoom-*` utilities the dialog/sheet use); dialogs/sheets animate on open/close.

### R3 (Low) — A trailing slash in `NEXT_PUBLIC_API_URL` produces double-slash paths
- **File:** `frontend/src/lib/api-client.ts:13,23`. The URL is built by raw concatenation (`${BASE_URL}${endpoint...}`) with no normalization, so `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1/` yields `.../api/v1//listings`, which FastAPI does not match (404). The default has no trailing slash, so this only bites on a differently-set env value.
- **Fix:** strip trailing slashes once, e.g. `.replace(/\/+$/, "")` on the base URL.
- **Done when:** a base URL with a trailing slash produces single-slash paths (assert in a unit test or by inspection of the built request URL).

### R4 (Low) — Error detail can be a non-string at runtime despite the `string` type
- **File:** `frontend/src/lib/api-client.ts:58-62`. `errorDetail = errorJson.message` is assigned with no type check, and `errorJson.detail[0]?.msg` is likewise unchecked. If a backend returns e.g. `{ "message": { ... } }`, `ApiError.detail` (typed `string`) holds an object.
- **Scenario:** any error response whose `message` (or first validation `msg`) is an object/number renders as `[object Object]` to the user instead of a readable message.
- **Fix:** guard with `typeof ... === "string" ? ... : JSON.stringify(...)` before assigning to `errorDetail`.
- **Done when:** a non-string `message`/`msg` in an error response surfaces as readable JSON text, never `[object Object]`.

### R5 (Low) — The `.dark` token block can never activate
- **File:** `frontend/src/app/globals.css:31-50`. The dark-theme tokens are scoped under a `.dark` class, but nothing in the repo ever adds that class, and Tailwind v4's default `dark:` variant is `prefers-color-scheme`-media-based, not class-based (no `@custom-variant dark` is defined).
- **Scenario:** on a dark-mode OS, components using `dark:` utilities get dark styling while all semantic tokens (`--background`, `--foreground`, etc.) stay light — a half-dark, inconsistent UI.
- **Judgment call (flagged):** delete the dead `.dark` block. Adding a theme toggle is a feature, not a fix; the minimal fix is removing tokens that can never apply.
- **Done when:** no `.dark` block remains in `globals.css`; `tsc`/`lint`/`build` still pass; no component references the removed tokens.

### Gates
- Frontend: `npx tsc --noEmit`, `npx eslint`, `npm run build` (from `frontend/`) — all exit 0.
- Full suite: `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u all_proxy -u no_proxy -u NO_PROXY ~/workspace/.test-venv/bin/python -m pytest -q` (from the repo root) — 106 passed. The sandbox Postgres runs on 127.0.0.1:5432 from `~/workspace/.pgdata-test`; if the server is down, restart it with `su postgres -c '/home/hatch/workspace/.pgsql18/bin/pg_ctl -D /home/hatch/workspace/.pgdata-test -l /home/hatch/workspace/.pgdata-test/logfile.log start'` — the `postgres` user may need recreating after a VM replacement (`useradd -u 999 postgres`).
- `git status --porcelain` shows only in-scope files.

### Git workflow
- Work in the isolated worktree on branch `advisor/036-review-fixes`, from main `438fdc8`. Commit as `fix(theme): second-pass review fixes R1-R5`.

## Third-pass review fixes (2026-11-11)

- **Planned at:** `f1cc407` (main, post-035–040 merge). **Source:** advisor review of plans 035–043 (2026-11-10): coordinator + 9 workers; advisor verified all High/Medium against live code and spot-checked the tricky Lows. This plan: 3 Low.
- **Scope:** `frontend/src/components/ui/button.tsx`, `frontend/src/app/globals.css`, `frontend/public/fonts/` (new). Nothing else. SKIP `plans/README.md` — the reviewer maintains it.
- **Gates:** `npx tsc --noEmit` (exit 0), `npx eslint src/` (exit 0), `npm run build` (exit 0) from `frontend/`; full suite `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u all_proxy -u no_proxy -u NO_PROXY ~/workspace/.test-venv/bin/python -m pytest -q` → 109 passed. Run pytest only when no other suite is running (shared test DB).
- **Branch:** `advisor/036-third-pass-fixes`. Commit style: `fix(frontend): third-pass review fixes T1-T3`.
- **Outcome (2026-11-11): APPROVED.** Executor commit `0e95148` — Button default `type="button"` (asChild exempt), Vazirmatn variable font bundled (`public/fonts/Vazirmatn-Variable.woff2`, 111,152 bytes) + `@font-face`, `.safe-pt` deleted. Reviewer re-ran tsc + eslint: exit 0; executor's build 0 (8/8 pages, @font-face verified in built CSS). Suite 108/109 under default env, single failure the known TZ flake (fix on 044 branch `2ea24a3`).

### T1 (Low) — `Button` has no default `type="button"`, so it submits enclosing forms
- **File:** `frontend/src/components/ui/button.tsx:41-48`. The component renders a bare `<button>` with no `type` prop, so HTML defaults it to `type="submit"`.
- **Scenario:** any non-submit `Button` (Cancel, Close, toggle) placed inside a `<form>` without an explicit `type` submits the form instead of doing its own action. No in-repo instance currently breaks — callers defensively pass `type="button"` everywhere, which is itself evidence the footgun is live. This is the plan-prescribed canonical shadcn code, so it is latent, not an active bug.
- **Fix:** default `type="button"` in the component, letting submit buttons opt in with `type="submit"`. Audit callers that rely on implicit submit; if any exist, add `type="submit"` to them explicitly.
- **Done when:** a `Button` without a `type` inside a form does not submit it; existing submit buttons still work; tsc/lint/build 0.

### T2 (Low) — `Vazirmatn` is named but never actually loaded
- **File:** `frontend/src/app/globals.css:26`. The font stack lists `'Vazirmatn'` first, but there is no `@font-face`, no font file under `frontend/public/`, and no `next/font` usage anywhere in `frontend/src` (verified by the advisor).
- **Scenario:** on any machine without Vazirmatn installed locally, all Persian text silently renders in the system fallback (Tahoma/Segoe UI), so the plan's "Vazirmatn font stack" done criterion is satisfied only as a name in a stack.
- **Fix:** bundle Vazirmatn woff2 files under `frontend/public/fonts/` with an `@font-face` rule (or `next/font/local`). Source: the Vazirmatn GitHub releases (`rastikerdar/vazirmatn`). Do NOT use `next/font/google` (the plan's ban on the build-time fetch was about offline builds, not local fonts).
- **Done when:** the built CSS contains an `@font-face` for Vazirmatn and the font files are bundled in the repo; tsc/lint/build 0.

### T3 (Low) — `.safe-pt` is defined but never used
- **File:** `frontend/src/app/globals.css:66-68`. A repo-wide grep finds zero usages (unlike `.safe-pb`, which has two legitimate users). Harmless dead CSS.
- **Fix:** delete the unused `.safe-pt` rule.
- **Done when:** no `.safe-pt` remains in `globals.css`; build passes.
