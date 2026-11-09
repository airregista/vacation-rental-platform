"use client"

import { Button } from "@/components/ui/button"
import { AlertCircle, RotateCcw } from "lucide-react"

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen bg-background text-foreground antialiased flex items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center text-center max-w-md w-full p-8 rounded-2xl border border-border bg-card shadow-sm gap-4">
          <div className="size-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-xl font-extrabold text-foreground">خطای سیستمی رخ داده است</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            متأسفانه در اجرای برنامه خطایی رخ داده است. لطفاً مجدداً تلاش نمایید.
          </p>
          <Button
            type="button"
            onClick={() => reset()}
            className="gap-2 rounded-xl font-bold shadow-xs mt-2"
          >
            <RotateCcw className="size-4" />
            <span>تلاش مجدد</span>
          </Button>
        </div>
      </body>
    </html>
  )
}
