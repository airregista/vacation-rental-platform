import Link from "next/link"
import { Mail, Phone } from "lucide-react"
import { AshianakLogo } from "@/components/brand/ashianak-logo"

const COLUMNS: {
  title: string
  links: { label: string; href: string }[]
}[] = [
  {
    title: "آشیانک",
    links: [
      { label: "دربارهٔ ما", href: "/info/about" },
      { label: "فرصت‌های شغلی", href: "/info/careers" },
      { label: "مجلهٔ سفر", href: "/info/journal" },
      { label: "تماس با ما", href: "/info/contact" },
    ],
  },
  {
    title: "مهمانان",
    links: [
      { label: "راهنمای رزرو", href: "/help" },
      { label: "شرایط لغو رزرو", href: "/info/cancellation" },
      { label: "پرداخت امن", href: "/info/payment" },
      { label: "پرسش‌های پرتکرار", href: "/help" },
    ],
  },
  {
    title: "میزبانان",
    links: [
      { label: "ثبت اقامتگاه", href: "/host/new" },
      { label: "استانداردهای میزبانی", href: "/info/hosting-standards" },
      { label: "تسویه مالی", href: "/info/payouts" },
      { label: "پشتیبانی میزبان", href: "/help" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="bg-night text-night-foreground">
      <div className="mx-auto w-full max-w-[1360px] px-4 pb-28 pt-14 sm:px-6 md:pb-8 lg:px-8 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-night-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-night"
            >
              <AshianakLogo size="lg" tone="night" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-7 text-night-foreground/60">
              اقامتگاه‌های بومی ایران؛ خانه‌هایی که میزبانشان مهمان را خانواده می‌داند و هر سفر را
              به یک خاطرهٔ ماندگار تبدیل می‌کند.
            </p>

            <div className="mt-6 space-y-3 text-xs">
              <a
                href="tel:+982191000000"
                className="flex items-center gap-2 text-night-foreground/60 transition-colors hover:text-night-foreground"
              >
                <Phone className="size-3.5 text-gold" />
                <span dir="ltr" className="tabular-nums">
                  ۰۲۱–۹۱۰۰۰۰۰۰
                </span>
              </a>
              <a
                href="mailto:hello@ashianak.ir"
                className="flex items-center gap-2 text-night-foreground/60 transition-colors hover:text-night-foreground"
              >
                <Mail className="size-3.5 text-gold" />
                hello@ashianak.ir
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h3 className="text-sm font-bold text-night-foreground">{column.title}</h3>
                <ul className="mt-4 space-y-3 text-xs">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-night-foreground/60 transition-colors hover:text-night-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-night-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-night"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-night-foreground/15 pt-6 text-[11px] leading-5 text-night-foreground/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© ۱۴۰۵ آشیانک · تمام حقوق محفوظ است.</p>
          <p>
            تصاویر نمونه از{" "}
            <a
              href="https://commons.wikimedia.org"
              target="_blank"
              rel="noreferrer"
              className="text-night-foreground/60 underline decoration-night-foreground/30 underline-offset-4 transition-colors hover:text-night-foreground"
            >
              ویکی‌مدیا کامانز
            </a>{" "}
            · CC BY / CC BY-SA
          </p>
        </div>
      </div>
    </footer>
  )
}
