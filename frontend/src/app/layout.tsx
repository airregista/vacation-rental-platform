import type { Metadata, Viewport } from "next"
import "./globals.css"
import { AuthProvider } from "@/context/auth-context"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Footer } from "@/components/layout/footer"
import { OtpModal } from "@/components/auth/otp-modal"

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
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0 flex flex-col">
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <BottomNav />
          <OtpModal />
        </AuthProvider>
      </body>
    </html>
  )
}
