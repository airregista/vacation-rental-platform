"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Clock3,
  CreditCard,
  Home,
  LifeBuoy,
  Mail,
  Phone,
  Search,
  SearchX,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const PHONE = "۰۲۱–۹۱۰۰۰۰۰۰"
const EMAIL = "hello@ashianak.ir"

interface FaqItem {
  question: string
  answer: string
}

interface FaqCategory {
  id: string
  title: string
  description: string
  icon: LucideIcon
  faqs: FaqItem[]
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "booking",
    title: "رزرو و اقامت",
    description: "از پیدا کردن خانه تا لحظهٔ تحویل کلید",
    icon: CalendarDays,
    faqs: [
      {
        question: "چگونه اقامتگاه مناسب را پیدا کنم؟",
        answer:
          "در صفحهٔ جستجو می‌توانید مقصد، تاریخ‌ها و تعداد مهمانان را وارد کنید. نتیجه‌ها را می‌توانید بر اساس نوع اقامتگاه، قیمت و امکانات محدود کنید. هر اقامتگاه صفحهٔ اختصاصی خودش را دارد؛ عکس‌ها، امکانات، قوانین، موقعیت تقریبی و نظر مهمانان قبلی را همان‌جا ببینید تا انتخاب آگاهانه‌تری داشته باشید.",
      },
      {
        question: "رزرو یک اقامت چطور انجام می‌شود؟",
        answer:
          "تاریخ‌های اقامت و تعداد مهمان را انتخاب می‌کنید، قیمت نهایی را می‌بینید و رزرو را ثبت می‌کنید. پس از ثبت، برای تکمیل رزرو به درگاه پرداخت هدایت می‌شوید. رزروی که پرداختش کامل نشود در وضعیت «در انتظار» می‌ماند و پس از پایان مهلت پرداخت، به‌صورت خودکار آزاد می‌شود.",
      },
      {
        question: "حداقل مدت اقامت چقدر است؟",
        answer:
          "مدت اقامت را میزبان تعیین می‌کند و در صفحهٔ هر اقامتگاه نوشته شده است. برخی خانه‌ها برای آخر هفته حداقل دو شب و برخی دیگر برای فصل‌های شلوغ حداقل چند شب در نظر می‌گیرند. سقف رزرو نیز تا ۱۸ ماه آینده است تا برنامه‌ریزی سفرهای دورتر ممکن باشد.",
      },
      {
        question: "آیا می‌توانم برای تعداد بیشتری مهمان رزرو کنم؟",
        answer:
          "ظرفیت استاندارد و حداکثر ظرفیت هر خانه در صفحهٔ اقامتگاه مشخص است. اگر تعداد مهمانان از ظرفیت استاندارد بیشتر باشد، ممکن است هزینهٔ مهمان اضافه به ازای هر شب به مبلغ رزرو اضافه شود. پیش از نهایی کردن رزرو، تفکیک قیمت را در صفحهٔ پرداخت ببینید.",
      },
      {
        question: "اگر تاریخ‌های مورد نظرم در دسترس نباشد چه کنم؟",
        answer:
          "تقویم اقامتگاه روزهای آزاد و پُر را نشان می‌دهد. می‌توانید تاریخ‌ها را کمی جابه‌جا کنید یا از فیلترهای جستجو برای دیدن خانه‌های مشابه در همان مقصد استفاده کنید. اگر برای بازهٔ خاصی برنامه دارید، رزرو زودتر همیشه شانس انتخاب بیشتری می‌دهد.",
      },
    ],
  },
  {
    id: "payment",
    title: "پرداخت و فاکتور",
    description: "درگاه امن، کد رهگیری و کدهای تخفیف",
    icon: CreditCard,
    faqs: [
      {
        question: "پرداخت از چه طریقی انجام می‌شود؟",
        answer:
          "پرداخت رزرو از طریق درگاه پرداخت آنلاین انجام می‌شود. پس از موفقیت پرداخت، رزرو شما نهایی می‌شود و کد رهگیری پرداخت در حساب کاربری و در جزئیات سفر قابل مشاهده است. اطلاعات کارت بانکی شما در آشیانک ذخیره نمی‌شود و در اختیار میزبان قرار نمی‌گیرد.",
      },
      {
        question: "اگر پرداخت ناموفق باشد، رزرو من چه می‌شود؟",
        answer:
          "اگر پرداخت انجام نشود یا درگاه تراکنش را ناموفق اعلام کند، رزرو در وضعیت «در انتظار» باقی می‌ماند. می‌توانید از صفحهٔ سفرهای من دوباره پرداخت را امتحان کنید. پیش از پایان مهلت پرداخت این کار را انجام دهید؛ در غیر این صورت تاریخ‌ها آزاد می‌شوند و برای رزرو دوباره باید از ابتدا اقدام کنید.",
      },
      {
        question: "کد تخفیف را کجا وارد کنم؟",
        answer:
          "کد تخفیف را در مرحلهٔ نهایی‌سازی رزرو، پیش از پرداخت وارد می‌کنید. اگر کد معتبر باشد، مبلغ تخفیف در تفکیک قیمت نمایش داده می‌شود. هر کد شرایط خودش را دارد؛ ممکن است حداقل مبلغ رزرو، بازهٔ اعتبار یا سقف استفاده داشته باشد.",
      },
      {
        question: "آیا امکان دریافت فاکتور وجود دارد؟",
        answer:
          "جزئیات هر رزرو، شامل مبلغ اقامت، هزینهٔ نظافت، تخفیف و کد رهگیری پرداخت، در حساب کاربری شما ثبت می‌شود. برای دریافت نسخهٔ رسمی فاکتور یا رفع ابهام در صورتحساب، با پشتیبانی تماس بگیرید و شمارهٔ رزرو را اعلام کنید.",
      },
      {
        question: "چرا مبلغ نهایی با قیمت شبانهٔ اقامتگاه تفاوت دارد؟",
        answer:
          "قیمت نهایی از حاصل‌ضرب شب‌های اقامت در نرخ هر شب، به‌علاوهٔ هزینهٔ نظافت و در صورت نیاز هزینهٔ مهمان اضافه، منهای تخفیف ساخته می‌شود. نرخ برخی شب‌ها، مثل تعطیلات و آخر هفته‌ها، ممکن است متفاوت باشد. تفکیک کامل را پیش از پرداخت می‌بینید.",
      },
    ],
  },
  {
    id: "cancellation",
    title: "لغو و بازگشت وجه",
    description: "سیاست‌های انعطاف‌پذیر، متوسط، سخت‌گیرانه و قانون میزبان",
    icon: XCircle,
    faqs: [
      {
        question: "چطور رزرو خود را لغو کنم؟",
        answer:
          "به صفحهٔ «سفرهای من» بروید، سفر مورد نظر را باز کنید و گزینهٔ لغو رزرو را انتخاب کنید. پیش از تأیید، مبلغ بازگشتی و جریمهٔ احتمالی بر اساس سیاست لغو همان اقامتگاه به شما نشان داده می‌شود. تا زمانی که تأیید نکنید، رزرو تغییری نمی‌کند.",
      },
      {
        question: "سیاست لغو انعطاف‌پذیر چگونه است؟",
        answer:
          "در سیاست انعطاف‌پذیر، اگر بیش از ۲۴ ساعت تا زمان ورود فاصله داشته باشید، کل مبلغ پرداختی بازگردانده می‌شود. اگر کمتر از ۲۴ ساعت باقی مانده باشد، معادل یک شب اقامت به‌همراه هزینهٔ نظافت به‌عنوان جریمه کسر می‌شود و باقی مبلغ برمی‌گردد.",
      },
      {
        question: "سیاست لغو متوسط چگونه است؟",
        answer:
          "در سیاست متوسط، تا ۵ روز پیش از زمان ورود کل مبلغ بازگردانده می‌شود. اگر کمتر از ۵ روز باقی مانده باشد، ۵۰٪ مبلغ رزرو به‌عنوان جریمه کسر و ۵۰٪ دیگر بازگردانده می‌شود.",
      },
      {
        question: "سیاست لغو سخت‌گیرانه چگونه است؟",
        answer:
          "در سیاست سخت‌گیرانه، تا ۱۴ روز پیش از ورود کل مبلغ برمی‌گردد. بین ۷ تا ۱۴ روز مانده به ورود، ۵۰٪ مبلغ بازگردانده می‌شود و اگر کمتر از ۷ روز باقی مانده باشد، مبلغ اقامت قابل بازگشت نیست. زمان دقیق ورود بر اساس ساعت اعلام‌شدهٔ اقامتگاه محاسبه می‌شود.",
      },
      {
        question: "«قانون میزبان» یعنی چه؟",
        answer:
          "در برخی اقامتگاه‌ها، میزبان پنجرهٔ لغو رایگان و درصد جریمهٔ پس از آن را خودش تعیین می‌کند. این شرایط روی صفحهٔ اقامتگاه و در پیش‌نمایش لغو رزرو نمایش داده می‌شود؛ پیش از پرداخت یا تأیید لغو، عدد دقیق جریمه را می‌بینید.",
      },
      {
        question: "بازگشت وجه چقدر طول می‌کشد؟",
        answer:
          "پس از تأیید لغو، مبلغ بازگشتی در سامانه ثبت می‌شود و به همان روشی که پرداخت کرده‌اید بازگردانده می‌شود. زمان نشستن مبلغ در حساب به شبکهٔ بانکی و درگاه پرداخت بستگی دارد و آشیانک روی آن کنترل مستقیم ندارد. کد رهگیری و مبلغ بازگشتی را از جزئیات سفر پیگیری کنید.",
      },
    ],
  },
  {
    id: "hosting",
    title: "میزبانی و تسویه",
    description: "از ثبت اقامتگاه تا واریز درآمد",
    icon: Home,
    faqs: [
      {
        question: "چطور میزبان شوم؟",
        answer:
          "از دکمهٔ «میزبان شوید» در بالای سایت یا صفحهٔ ثبت اقامتگاه شروع کنید. پس از ورود به حساب، اطلاعات خانه، عکس‌ها، امکانات، قوانین و قیمت‌گذاری را در چند مرحله ثبت می‌کنید. می‌توانید تعیین کنید اقامتگاه چه زمانی برای مهمانان نمایش داده شود.",
      },
      {
        question: "کارمزد آشیانک چقدر است؟",
        answer:
          "کارمزد سامانه ۱۰٪ از مبلغ هر رزرو است. این مبلغ در تسویهٔ هر رزرو به‌صورت شفاف از مبلغ ناخالص کسر می‌شود و خالص قابل پرداخت به میزبان در کنار آن نمایش داده می‌شود. هیچ هزینهٔ پنهانی به مبلغ رزرو اضافه نمی‌شود.",
      },
      {
        question: "تسویهٔ درآمد میزبان چه زمانی انجام می‌شود؟",
        answer:
          "پس از پرداخت موفق مهمان، برای هر رزرو یک ردیف تسویه با مبلغ ناخالص، کارمزد و مبلغ خالص ساخته می‌شود. تسویه پس از رسیدن تاریخ ورود و با ثبت شمارهٔ شبای معتبر انجام می‌شود. وضعیت هر تسویه در داشبورد میزبان قابل پیگیری است.",
      },
      {
        question: "چرا تسویهٔ من در وضعیت «در انتظار» است؟",
        answer:
          "تا زمانی که تاریخ ورود مهمان فرا نرسیده باشد، تسویه در انتظار می‌ماند. همچنین برای انجام تسویه باید شمارهٔ شبای معتبر در حساب کاربری ثبت شده باشد. اگر رزرو لغو شود، ردیف تسویهٔ مرتبط با آن نیز به‌روزرسانی می‌شود.",
      },
      {
        question: "شمارهٔ شبا را کجا ثبت کنم؟",
        answer:
          "شمارهٔ شبا را در بخش حساب کاربری وارد کنید. قالب صحیح آن با IR شروع می‌شود و ۲۴ رقم بعد از آن قرار می‌گیرد. پیش از ثبت نهایی، شماره را با اطلاعات حساب بانکی خود مقایسه کنید تا واریز به مشکل نخورد.",
      },
    ],
  },
  {
    id: "safety",
    title: "ایمنی و اعتماد",
    description: "ورود امن، پرداخت مطمئن و اقامتی بی‌دغدغه",
    icon: ShieldCheck,
    faqs: [
      {
        question: "ورود به حساب چگونه انجام می‌شود؟",
        answer:
          "ورود با شمارهٔ موبایل و کد یکبار مصرف انجام می‌شود؛ نیازی به حفظ رمز عبور نیست. کد تأیید فقط برای همان ورود معتبر است و برای دیگران قابل استفاده نیست. هرگز کد یکبار مصرف را با کسی، حتی فردی که خود را پشتیبان معرفی می‌کند، به اشتراک نگذارید.",
      },
      {
        question: "پرداخت من چطور محافظت می‌شود؟",
        answer:
          "پرداخت‌ها از طریق درگاه بانکی انجام می‌شوند و آشیانک اطلاعات کارت شما را ذخیره نمی‌کند. مبلغ رزرو تا تکمیل فرایند پرداخت در سامانه ثبت و پیگیری می‌شود. برای هر تراکنش کد رهگیری اختصاصی صادر می‌شود.",
      },
      {
        question: "قوانین خانه را از کجا بدانم؟",
        answer:
          "قوانین هر اقامتگاه، از ساعت ورود و خروج تا محدودیت‌های مهمان و حیوان خانگی، در صفحهٔ همان اقامتگاه آمده است. لطفاً پیش از رزرو آن‌ها را بخوانید. اگر نکته‌ای مبهم است، پیش از پرداخت از میزبان بپرسید.",
      },
      {
        question: "اگر در محل اقامت مشکلی پیش بیاید چه کنم؟",
        answer:
          "ابتدا موضوع را با میزبان در میان بگذارید؛ بیشتر مسائل مربوط به تحویل کلید، گرمایش یا تجهیزات همان‌جا حل می‌شوند. اگر مسئله حل نشد، با پشتیبانی آشیانک تماس بگیرید و شمارهٔ رزرو، توضیح مشکل و در صورت امکان عکس یا مستندات را ارائه دهید تا پرونده سریع‌تر بررسی شود.",
      },
    ],
  },
  {
    id: "account",
    title: "حساب کاربری",
    description: "اطلاعات شخصی، نقش کاربری و سفرهای من",
    icon: UserRound,
    faqs: [
      {
        question: "با چه شماره‌ای می‌توانم وارد شوم؟",
        answer:
          "ورود با شمارهٔ موبایل ایرانی و کد یکبار مصرف انجام می‌شود. اگر شمارهٔ خود را تغییر داده‌اید، با شمارهٔ جدید وارد شوید یا برای انتقال سابقهٔ رزروها با پشتیبانی تماس بگیرید.",
      },
      {
        question: "اطلاعات حساب خود را چطور ویرایش کنم؟",
        answer:
          "در بخش حساب کاربری می‌توانید نام، نام خانوادگی، ایمیل و تصویر پروفایل را به‌روزرسانی کنید. میزبانان می‌توانند شمارهٔ شبای خود را هم همان‌جا ثبت کنند. اطلاعات تماس شما فقط برای هماهنگی رزرو و پشتیبانی استفاده می‌شود.",
      },
      {
        question: "چطور نقش میزبان را فعال کنم؟",
        answer:
          "پس از ورود، از منوی حساب کاربری گزینهٔ «میزبان شوید» را انتخاب کنید. با این کار نقش حساب به میزبان تغییر می‌کند و دسترسی به داشبورد میزبانی و ثبت اقامتگاه باز می‌شود. اگر قبلاً میزبان بوده‌اید، همان داشبورد در دسترس است.",
      },
      {
        question: "رزروهایم را کجا ببینم؟",
        answer:
          "همهٔ سفرها در صفحهٔ «سفرهای من» جمع شده‌اند: سفرهای پیش‌رو، سفرهای انجام‌شده و سفرهای لغوشده. از همان‌جا می‌توانید جزئیات رزرو، وضعیت پرداخت، گفت‌وگو با میزبان و در صورت نیاز درخواست لغو را مدیریت کنید.",
      },
      {
        question: "اگر حسابم را بخواهم حذف کنم چه کنم؟",
        answer:
          "برای حذف حساب و اطلاعات مرتبط، از طریق ایمیل یا تلفن با پشتیبانی تماس بگیرید. پیش از حذف، بهتر است سفرهای فعال و تسویه‌های مالی باز شما تعیین تکلیف شده باشند تا دسترسی به سابقه از دست نرود.",
      },
    ],
  },
]

const CONTACT_CHANNELS = [
  {
    icon: Phone,
    title: "تماس تلفنی",
    value: PHONE,
    hint: "برای پیگیری سریع رزروهای در جریان",
    href: "tel:+982191000000",
    ltr: true,
  },
  {
    icon: Mail,
    title: "ایمیل پشتیبانی",
    value: EMAIL,
    hint: "برای ارسال مستندات و درخواست‌های تفصیلی",
    href: `mailto:${EMAIL}`,
    ltr: true,
  },
  {
    icon: Clock3,
    title: "ساعت پاسخ‌گویی",
    value: "۲۴ ساعته، هفت روز هفته",
    hint: "تیم پشتیبانی در تمام روزهای سال همراه شماست",
    href: null,
    ltr: false,
  },
] as const

function normalizeText(value: string): string {
  return value
    .replace(/[ىي]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .toLocaleLowerCase("fa")
    .trim()
}

function matchesQuery(faq: FaqItem, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const haystack = normalizeText(`${faq.question} ${faq.answer}`)
  return tokens.every((token) => haystack.includes(token))
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value)
}

export default function HelpPage() {
  const [query, setQuery] = React.useState("")
  const [activeCategory, setActiveCategory] = React.useState<string>("all")

  const tokens = React.useMemo(
    () => normalizeText(query).split(/\s+/).filter(Boolean),
    [query]
  )

  const visibleCategories = React.useMemo(() => {
    return FAQ_CATEGORIES.flatMap((category) => {
      if (activeCategory !== "all" && category.id !== activeCategory) return []
      const faqs = category.faqs.filter((faq) => matchesQuery(faq, tokens))
      if (tokens.length > 0 && faqs.length === 0) return []
      return [{ ...category, faqs }]
    })
  }, [activeCategory, tokens])

  const resultCount = visibleCategories.reduce(
    (total, category) => total + category.faqs.length,
    0
  )

  const clearFilters = () => {
    setQuery("")
    setActiveCategory("all")
  }

  return (
    <div className="bg-paper text-ink">
      <PageHeader
        eyebrow="مرکز راهنمایی آشیانک"
        title="پاسخ‌ها، همان‌قدر نزدیک که به یک خانه لازم است"
        description="از انتخاب اقامتگاه و پرداخت امن تا میزبانی و تسویه؛ پرسش‌های پرتکرار را دسته‌بندی کرده‌ایم تا سریع‌تر به جواب برسید. اگر پاسخ‌تان اینجا نبود، تیم پشتیبانی آمادهٔ کمک است."
        actions={
          <>
            <Button asChild variant="outline" className="gap-2 bg-paper-card/60">
              <Link href="/trips">
                <CalendarDays className="size-4" />
                سفرهای من
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/host/new">
                <Home className="size-4" />
                میزبان شوید
              </Link>
            </Button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section aria-labelledby="help-search-title" className="relative">
          <div className="paper-grain overflow-hidden rounded-3xl border border-line bg-paper-card p-5 shadow-soft sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-xl">
                <h2
                  id="help-search-title"
                  className="text-xl font-black tracking-tight text-ink sm:text-2xl"
                >
                  دنبال چه پاسخی هستید؟
                </h2>
                <p className="mt-2 text-sm leading-7 text-ink-soft">
                  کلمه‌ای مثل «لغو»، «شبا» یا «کد تخفیف» را بنویسید. میان همهٔ
                  بخش‌ها جستجو می‌کنیم.
                </p>
              </div>
              <Badge
                variant="outline"
                className="w-fit border-line bg-paper px-3 py-1 text-[11px] font-bold text-ink-soft"
              >
                {formatCount(resultCount)} پاسخ در دسترس
              </Badge>
            </div>

            <div className="relative mt-6">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="جستجو در پرسش‌های پرتکرار…"
                aria-label="جستجو در پرسش‌های پرتکرار"
                className="h-12 rounded-xl border-line bg-paper pr-11 pl-11 text-sm shadow-none placeholder:text-ink-soft/70"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="پاک کردن جستجو"
                  className="absolute left-2.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="دسته‌بندی پرسش‌ها">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                aria-pressed={activeCategory === "all"}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeCategory === "all"
                    ? "border-brick bg-brick text-on-brick"
                    : "border-line bg-paper text-ink-soft hover:border-line-strong hover:text-ink"
                )}
              >
                همهٔ موضوع‌ها
              </button>
              {FAQ_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  aria-pressed={activeCategory === category.id}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeCategory === category.id
                      ? "border-brick bg-brick text-on-brick"
                      : "border-line bg-paper text-ink-soft hover:border-line-strong hover:text-ink"
                  )}
                >
                  {category.title}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-10 space-y-10">
          {visibleCategories.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line-strong/70 bg-paper-card/60 px-4">
              <EmptyState
                icon={SearchX}
                title="پاسخی با این عبارت پیدا نشد"
                description="عبارت کوتاه‌تری امتحان کنید یا دسته‌بندی را تغییر دهید. همچنین می‌توانید مستقیماً با پشتیبانی تماس بگیرید."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" variant="outline" onClick={clearFilters}>
                      پاک کردن فیلترها
                    </Button>
                    <Button asChild>
                      <a href={`mailto:${EMAIL}`}>نوشتن به پشتیبانی</a>
                    </Button>
                  </div>
                }
              />
            </div>
          ) : (
            visibleCategories.map((category) => {
              const CategoryIcon = category.icon
              return (
                <section
                  key={category.id}
                  id={`faq-${category.id}`}
                  aria-labelledby={`faq-${category.id}-title`}
                  className="scroll-mt-28"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-b-xl rounded-t-full bg-brick/10 text-brick">
                      <CategoryIcon className="size-5" />
                    </span>
                    <div className="pt-0.5">
                      <h2
                        id={`faq-${category.id}-title`}
                        className="text-lg font-black tracking-tight text-ink sm:text-xl"
                      >
                        {category.title}
                      </h2>
                      <p className="mt-1 text-xs leading-6 text-ink-soft">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-line bg-paper-card shadow-soft">
                    {category.faqs.map((faq, index) => (
                      <details
                        key={faq.question}
                        className={cn(
                          "group border-line/70",
                          index !== 0 && "border-t"
                        )}
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-right transition-colors hover:bg-paper-deep/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 [&::-webkit-details-marker]:hidden">
                          <span className="text-sm font-bold leading-7 text-ink">
                            {faq.question}
                          </span>
                          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-paper text-ink-soft transition-transform group-open:rotate-180 group-open:border-brick/30 group-open:text-brick">
                            <ChevronDown className="size-3.5" aria-hidden="true" />
                          </span>
                        </summary>
                        <div className="px-4 pb-5 pr-4 sm:px-5">
                          <p className="max-w-3xl border-r-2 border-brick/25 pr-4 text-sm leading-8 text-ink-soft">
                            {faq.answer}
                          </p>
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              )
            })
          )}
        </div>

        <section aria-labelledby="contact-title" className="mt-14">
          <div className="rounded-3xl border border-line bg-paper-deep/45 p-5 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-brick">
                  <span aria-hidden="true" className="h-px w-8 bg-brick/45" />
                  گفت‌وگو با آدم‌ها
                </p>
                <h2 id="contact-title" className="text-2xl font-black tracking-tight text-ink">
                  وقتی پاسخ‌ها کافی نیست
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-soft">
                  شمارهٔ رزرو یا نام کاربری‌تان را آماده داشته باشید؛ این‌طور
                  سریع‌تر می‌توانیم پروندهٔ شما را پیدا کنیم و دقیق راهنمایی‌تان
                  کنیم.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-trust/25 bg-trust-soft/60 px-3 py-1 text-[11px] font-bold text-trust">
                <LifeBuoy className="size-3.5" />
                پشتیبانی انسانی
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {CONTACT_CHANNELS.map((channel) => {
                const ChannelIcon = channel.icon
                const body = (
                  <Card className="h-full rounded-2xl border-line bg-paper-card shadow-none transition-colors group-hover:border-line-strong">
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <span className="grid size-10 place-items-center rounded-b-lg rounded-t-full bg-trust/10 text-trust">
                        <ChannelIcon className="size-4.5" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-ink-soft">{channel.title}</p>
                        <p
                          className="mt-1 text-sm font-black text-ink"
                          dir={channel.ltr ? "ltr" : undefined}
                          style={channel.ltr ? { textAlign: "right" } : undefined}
                        >
                          <span className={channel.ltr ? "tabular-nums" : undefined}>
                            {channel.value}
                          </span>
                        </p>
                      </div>
                      <p className="mt-auto text-[11px] leading-5 text-ink-soft">
                        {channel.hint}
                      </p>
                    </CardContent>
                  </Card>
                )

                return channel.href ? (
                  <a
                    key={channel.title}
                    href={channel.href}
                    className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {body}
                  </a>
                ) : (
                  <div key={channel.title} className="group">
                    {body}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-night p-6 text-night-foreground shadow-lift sm:p-8">
            <div
              aria-hidden="true"
              className="absolute -left-10 -top-14 size-48 rounded-full border border-night-foreground/10"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-20 -right-8 size-56 rounded-full border border-night-foreground/10"
            />
            <p className="text-xs font-bold tracking-[0.18em] text-gold">میزبان شوید</p>
            <h2 className="mt-3 max-w-md text-2xl font-black leading-tight">
              خانه‌تان را به یک مقصد ماندگار تبدیل کنید
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-7 text-night-foreground/65">
              اقامتگاه‌تان را ثبت کنید، تقویم و قیمت را خودتان مدیریت کنید و
              درآمدتان را با گزارش شفاف تسویه بگیرید. تیم میزبانی از اولین قدم
              تا اولین مهمان کنار شماست.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild className="gap-2">
                <Link href="/host/new">
                  ثبت اقامتگاه
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="gap-2 border-night-foreground/20 bg-transparent text-night-foreground hover:bg-night-foreground/10 hover:text-night-foreground"
              >
                <Link href="/info/hosting-standards">استانداردهای میزبانی</Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-line bg-paper-card p-6 shadow-soft sm:p-8">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-trust">مهمانان</p>
              <h2 className="mt-3 text-xl font-black leading-tight text-ink">
                سفر بعدی‌تان را از همین‌جا شروع کنید
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink-soft">
                همهٔ رزروها، پرداخت‌ها و گفت‌وگو با میزبان در صفحهٔ سفرهای من
                جمع شده است. یک قدم تا خانهٔ بعدی فاصله دارید.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild variant="outline" className="gap-2">
                <Link href="/trips">
                  <CalendarDays className="size-4" />
                  سفرهای من
                </Link>
              </Button>
              <Button asChild variant="ghost" className="gap-2 text-brick hover:text-brick">
                <Link href="/search">
                  <Search className="size-4" />
                  جستجوی اقامتگاه
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
