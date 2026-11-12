import type { Metadata, Viewport } from "next"
import "./globals.css"
import { AuthProvider } from "@/context/auth-context"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Footer } from "@/components/layout/footer"
import { ThemeScript } from "@/components/theme/theme-script"
import { DirectionProvider } from "@/components/providers/direction-provider"
import { OtpModal } from "@/components/auth/otp-modal"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#121316" },
  ],
}

export const metadata: Metadata = {
  title: "آشیانک | سامانه رزرو اقامتگاه و بوم‌گردی",
  description:
    "سامانه رزرو آنلاین ویلا، سوئیت، اقامتگاه بوم‌گردی و کلبه در سراسر ایران با ضمانت تحویل و مهمان‌نوازی اصیل ایرانی",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-background font-sans text-foreground antialiased selection:bg-primary/20">
        <ThemeScript />
        <DirectionProvider>
          <AuthProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <BottomNav />
            <OtpModal />
          </AuthProvider>
        </DirectionProvider>
      </body>
    </html>
  )
}
