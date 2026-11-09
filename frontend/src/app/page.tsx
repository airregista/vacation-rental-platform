import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Compass, ShieldCheck, HeartHandshake, Sparkles, MapPin } from "lucide-react"

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24 px-4 sm:px-6 lg:px-8 border-b border-border bg-gradient-to-b from-muted/50 to-background">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge variant="accent" className="px-4 py-1 text-sm font-medium gap-1.5 shadow-sm">
            <Sparkles className="size-4" />
            مهمان‌نوازی اصیل ایرانی در سراسر کشور
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
            سامانه رزرو آنلاین اقامتگاه <span className="text-primary">آشیانک</span>
          </h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            تجربه سفری امن، آرام و خاطره‌انگیز با رزرو انواع ویلا، کلبه جنگلی، سوئیت و اقامتگاه‌های بوم‌گردی با تضمین پاکیزگی و اصالت
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Button size="lg" className="gap-2 text-base font-semibold shadow-md">
              <Compass className="size-5" />
              کاوش و جستجوی اقامتگاه‌ها
            </Button>
            <Button variant="outline" size="lg" className="text-base font-medium">
              ثبت اقامتگاه میزبان
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Value Props */}
      <section className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="gap-2">
              <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="size-6" />
              </div>
              <CardTitle className="text-lg">تضمین تحویل اقامتگاه</CardTitle>
              <CardDescription>
                تحویل صددرصدی کلید مطابق با اطلاعات و تصاویر ثبت‌شده در سایت، با پشتیبانی ۲۴ ساعته.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="gap-2">
              <div className="size-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                <HeartHandshake className="size-6" />
              </div>
              <CardTitle className="text-lg">پشتیبانی و اصالت میزبان</CardTitle>
              <CardDescription>
                تأیید هویت دقیق میزبانان محلی و امکان مکالمه مستقیم مهمان با میزبان قبل از سفر.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="gap-2">
              <div className="size-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <MapPin className="size-6" />
              </div>
              <CardTitle className="text-lg">تنوع مقاصد و بوم‌گردی</CardTitle>
              <CardDescription>
                از کلبه‌های چوبی در ماسال تا خانه‌های تاریخی یزد و کاشان با بهترین نرخ‌های تومانی.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
    </main>
  )
}
