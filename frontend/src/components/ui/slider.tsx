"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, defaultValue, ...props }, ref) => {
  // `??` (not `||`) so a controlled value of 0 stays controlled instead of
  // falling through to defaultValue; an empty array still renders one thumb.
  const normalize = (v: number | number[] | undefined): number[] | undefined => {
    if (v === undefined) return undefined
    if (Array.isArray(v)) return v.length > 0 ? v : [0]
    return [v]
  }
  const normalizedValue = normalize(value)
  const normalizedDefaultValue = normalize(defaultValue)
  const thumbs = normalizedValue ?? normalizedDefaultValue ?? [0]

  return (
    <SliderPrimitive.Root
      ref={ref}
      dir="rtl"
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      {...props}
      value={normalizedValue}
      defaultValue={normalizedDefaultValue}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {thumbs.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block size-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
