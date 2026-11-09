import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 px-4 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          صفحه مورد نظر یافت نشد
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          متأسفانه صفحه‌ای که به دنبال آن بودید یافت نشد یا ممکن است آدرس آن تغییر کرده باشد.
        </p>
      </div>
      <Button asChild variant="outline" className="gap-2 rounded-xl text-sm font-semibold">
        <Link href="/">
          <Home className="size-4" />
          <span>بازگشت به صفحه اصلی</span>
        </Link>
      </Button>
    </div>
  )
}
