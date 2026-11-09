"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChevronDown,
  Phone,
  ShieldCheck,
  Headphones,
  Award,
  Home,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface FooterSection {
  title: string
  links: { label: string; href: string }[]
}

const FOOTER_SECTIONS: FooterSection[] = [
  {
    title: "درباره آشیانک",
    links: [
      { label: "معرفی آشیانک", href: "#about" },
      { label: "فرصت‌های شغلی", href: "#careers" },
      { label: "تماس با ما", href: "#contact" },
      { label: "مجله گردشگری و بوم‌گردی", href: "#blog" },
    ],
  },
  {
    title: "راهنمای مهمانان",
    links: [
      { label: "راهنمای رزرو اقامتگاه", href: "#guide-booking" },
      { label: "شیوه‌های پرداخت و درگاه بانکی", href: "#payment-methods" },
      { label: "شرایط و قوانین لغو رزرو", href: "#cancellation-rules" },
      { label: "پوشش بیمه و ایمنی سفر", href: "#insurance" },
    ],
  },
  {
    title: "خدمات میزبانان",
    links: [
      { label: "ثبت اقامتگاه در آشیانک", href: "#become-host" },
      { label: "استانداردها و اصول میزبانی", href: "#host-standards" },
      { label: "روش و زمان‌بندی تسویه مالی", href: "#host-payout" },
      { label: "پرسش‌های پرتکرار میزبانان", href: "#host-faq" },
    ],
  },
  {
    title: "اعتماد و امنیت",
    links: [
      { label: "ضمانت تحویل قطعی اقامتگاه", href: "#delivery-guarantee" },
      { label: "قوانین و مقررات سامانه", href: "#terms" },
      { label: "حفظ حریم خصوصی کاربران", href: "#privacy" },
      { label: "رسیدگی به شکایات", href: "#complaints" },
    ],
  },
]

export function Footer() {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({})

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }))
  }

  return (
    <footer className="border-t border-border bg-card text-card-foreground py-10 pb-28 md:pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Top Feature Highlights Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-8 border-b border-border/80">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-background/50 border border-border/50">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">ضمانت تحویل اقامتگاه</p>
              <p className="text-[11px] text-muted-foreground">تطابق کامل مشخصات و پشتیبانی فوری</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-background/50 border border-border/50">
            <div className="size-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
              <Headphones className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">پشتیبانی شبانه‌روزی ۲۴/۷</p>
              <p className="text-[11px] text-muted-foreground">پاسخگویی در تمامی روزهای سال</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-background/50 border border-border/50">
            <div className="size-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Award className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">اقامتگاه‌های تاییدشده</p>
              <p className="text-[11px] text-muted-foreground">بررسی دوره‌ای پاکیزگی و استانداردهای کیفی</p>
            </div>
          </div>
        </div>

        {/* Desktop Columns Grid / Mobile Accordion */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
          {FOOTER_SECTIONS.map((section) => {
            const isOpen = !!openSections[section.title]
            return (
              <div key={section.title} className="border-b md:border-b-0 border-border/50 pb-4 md:pb-0">
                {/* Mobile Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="flex items-center justify-between w-full md:cursor-default py-2 md:py-0 text-right font-bold text-sm text-foreground focus:outline-none"
                >
                  <span>{section.title}</span>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform duration-200 md:hidden",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>

                {/* Links list */}
                <ul
                  className={cn(
                    "space-y-2.5 mt-3 text-xs text-muted-foreground",
                    !isOpen && "hidden md:block"
                  )}
                >
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="hover:text-primary transition-colors inline-block py-0.5"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Support Hotline & Brand Summary */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
              <Home className="size-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-primary">آشیانک</p>
              <p className="text-xs text-muted-foreground">
                سامانه هوشمند رزرو ویلا، سوئیت و بوم‌گردی ایران
              </p>
            </div>
          </div>

          {/* Hotline */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-muted/60 border border-border">
            <Phone className="size-4 text-primary" />
            <div className="text-xs">
              <span className="text-muted-foreground ml-1">مرکز پشتیبانی تلفنی:</span>
              <a
                href="tel:02191000000"
                className="font-bold text-foreground font-mono tracking-wider hover:text-primary transition-colors"
                dir="ltr"
              >
                ۰۲۱-۹۱۰۰۰۰۰۰
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/40">
          <p>© ۲۰۲۶ آشیانک. کلیه حقوق محفوظ است.</p>
        </div>
      </div>
    </footer>
  )
}
