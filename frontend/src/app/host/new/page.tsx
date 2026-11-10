"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Minus,
  Trash2,
  LogIn,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  ImagePlus,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import type { AccommodationCreateForm } from "@/types/host"
import type { Category, City, Amenity } from "@/types/accommodation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const WIZARD_STEPS = [
  { n: 1, label: "دسته‌بندی و مشخصات" },
  { n: 2, label: "تصاویر" },
  { n: 3, label: "ظرفیت و امکانات" },
  { n: 4, label: "قیمت‌گذاری" },
  { n: 5, label: "قوانین و تایید" },
]

const POLICY_OPTIONS = [
  { value: "flexible", label: "انعطاف‌پذیر" },
  { value: "moderate", label: "متوسط" },
  { value: "strict", label: "سخت‌گیرانه" },
] as const

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-input bg-background">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`کاهش ${label}`}
          className="size-8 rounded-full"
        >
          <Minus className="size-3.5" />
        </Button>
        <span className="w-6 text-center text-sm font-bold font-price">
          {new Intl.NumberFormat("fa-IR").format(value)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`افزایش ${label}`}
          className="size-8 rounded-full"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

export default function NewAccommodationPage() {
  const router = useRouter()
  const { token, isLoading, isHost, becomeHost, openOtpModal } = useAuth()

  const [form, setForm] = useState<AccommodationCreateForm>({
    title: "",
    description: "",
    address: "",
    city_id: 0,
    category_id: 0,
    base_price: 0,
    cleaning_fee: 0,
    capacity: 2,
    max_capacity: 4,
    extra_guest_fee: 0,
    rooms_count: 1,
    beds_count: 1,
    rules: "",
    cancellation_policy: "flexible",
    min_nights: 1,
    is_active: true,
    images: [],
    amenity_ids: [],
  })
  const [step, setStep] = useState(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [amenities, setAmenities] = useState<Amenity[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPromoting, setIsPromoting] = useState(false)
  const [promoteError, setPromoteError] = useState<string | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isSuccessOpen, setIsSuccessOpen] = useState(false)
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Load the option lists on mount (public endpoints).
  useEffect(() => {
    let isMounted = true
    async function loadOptions() {
      try {
        const [cats, cits, amens] = await Promise.all([
          apiClient.get<Category[]>("/categories/"),
          apiClient.get<City[]>("/geo/cities?limit=100"),
          apiClient.get<Amenity[]>("/amenities/"),
        ])
        if (isMounted) {
          setCategories(Array.isArray(cats) ? cats : [])
          setCities(Array.isArray(cits) ? cits : [])
          setAmenities(Array.isArray(amens) ? amens : [])
        }
      } catch (err: unknown) {
        if (isMounted) {
          if (err instanceof ApiError) {
            setLoadError(err.detail || err.message || "بارگذاری گزینه‌ها با خطا مواجه شد.")
          } else {
            setLoadError("بارگذاری گزینه‌ها با خطا مواجه شد.")
          }
        }
      }
    }
    void loadOptions()
    return () => {
      isMounted = false
    }
  }, [])

  const set = <K extends keyof AccommodationCreateForm>(
    key: K,
    value: AccommodationCreateForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const stepValid = (s: number): boolean => {
    switch (s) {
      case 1:
        return (
          form.category_id > 0 &&
          form.city_id > 0 &&
          form.title.trim().length >= 3 &&
          form.address.trim().length >= 5
        )
      case 2:
        return true
      case 3:
        return (
          form.capacity >= 1 &&
          form.max_capacity >= form.capacity &&
          form.rooms_count >= 0 &&
          form.beds_count >= 0
        )
      case 4:
        return (
          form.base_price >= 0 &&
          form.cleaning_fee >= 0 &&
          form.extra_guest_fee >= 0 &&
          (form.min_nights ?? 1) >= 1
        )
      case 5:
        return true
      default:
        return false
    }
  }

  const formValid = [1, 2, 3, 4, 5].every(stepValid)

  const coverIndex = form.images.findIndex((img) => img.is_cover)

  const addImage = () => {
    setForm((prev) => ({
      ...prev,
      images: [
        ...prev.images,
        {
          image_url: "",
          is_cover: prev.images.length === 0,
          sort_order: prev.images.length,
        },
      ],
    }))
  }

  const updateImageUrl = (index: number, url: string) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((img, i) => (i === index ? { ...img, image_url: url } : img)),
    }))
  }

  const removeImage = (index: number) => {
    setForm((prev) => {
      const rest = prev.images.filter((_, i) => i !== index)
      const reindexed = rest.map((img, i) => ({ ...img, sort_order: i }))
      if (reindexed.length > 0 && !reindexed.some((img) => img.is_cover)) {
        reindexed[0].is_cover = true
      }
      return { ...prev, images: reindexed }
    })
  }

  const setCover = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((img, i) => ({ ...img, is_cover: i === index })),
    }))
  }

  const toggleAmenity = (amenityId: number) => {
    setForm((prev) => ({
      ...prev,
      amenity_ids: prev.amenity_ids.includes(amenityId)
        ? prev.amenity_ids.filter((id) => id !== amenityId)
        : [...prev.amenity_ids, amenityId],
    }))
  }

  const handleSubmit = async () => {
    if (!formValid) return
    setIsSubmitting(true)
    setSubmitError(null)
    // Keep only filled image URLs, re-index, and guarantee exactly one cover.
    const images = form.images
      .filter((img) => img.image_url.trim() !== "")
      .map((img, idx) => ({
        image_url: img.image_url.trim(),
        is_cover: img.is_cover,
        sort_order: idx,
      }))
    if (images.length > 0 && !images.some((img) => img.is_cover)) {
      images[0].is_cover = true
    }
    try {
      const res = await apiClient.post<{ id: number }>("/accommodations/", {
        ...form,
        images,
        min_nights: form.min_nights ?? 1,
      })
      setCreatedId(res.id)
      setIsPreviewOpen(false)
      setIsSuccessOpen(true)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSubmitError(err.detail || err.message || "ثبت اقامتگاه با خطا مواجه شد.")
      } else {
        setSubmitError("ثبت اقامتگاه با خطا مواجه شد.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBecomeHost = async () => {
    setPromoteError(null)
    setIsPromoting(true)
    try {
      await becomeHost()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPromoteError(err.detail || err.message || "خطایی در ارتقای نقش کاربری رخ داد.")
      } else {
        setPromoteError("خطایی در ارتقای نقش کاربری رخ داد.")
      }
    } finally {
      setIsPromoting(false)
    }
  }

  const selectedCategory = categories.find((c) => c.id === form.category_id)
  const selectedCity = cities.find((c) => c.id === form.city_id)
  const selectedAmenities = amenities.filter((a) => form.amenity_ids.includes(a.id))
  const policyLabel =
    POLICY_OPTIONS.find((p) => p.value === form.cancellation_policy)?.label || "انعطاف‌پذیر"

  const formatToman = (n: number) => new Intl.NumberFormat("fa-IR").format(n)

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6" dir="rtl">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  if (!token) {
    return (
      <main className="container mx-auto px-4 py-16 text-right" dir="rtl">
        <Card className="max-w-md mx-auto text-center p-8 rounded-2xl border border-border shadow-sm">
          <CardContent className="space-y-6 pt-4">
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">ثبت اقامتگاه جدید</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                برای ثبت اقامتگاه، لطفاً وارد حساب کاربری خود شوید.
              </p>
            </div>
            <Button onClick={openOtpModal} className="w-full gap-2 font-bold py-5">
              <LogIn className="w-4 h-4" />
              <span>ورود یا ثبت‌نام</span>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!isHost) {
    return (
      <main className="container mx-auto px-4 py-16 text-right" dir="rtl">
        <Card className="max-w-md mx-auto text-center p-8 rounded-2xl border border-border shadow-sm">
          <CardContent className="space-y-6 pt-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">میزبان شوید</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                برای ثبت اقامتگاه، ابتدا حساب کاربری خود را به میزبان ارتقا دهید.
              </p>
            </div>
            {promoteError && (
              <Alert variant="destructive" className="text-right">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle>خطا</AlertTitle>
                <AlertDescription>{promoteError}</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={handleBecomeHost}
              disabled={isPromoting}
              className="w-full gap-2 font-bold py-5"
            >
              <Sparkles className="w-4 h-4" />
              <span>میزبان شوید (ارتقای حساب)</span>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 pb-28 text-right" dir="rtl">
      <header className="space-y-1 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
          ثبت اقامتگاه جدید
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
          در ۵ مرحله اقامتگاه خود را ثبت کنید.
        </p>
      </header>

      {/* Pinned top progress bar (sticks below the site header) */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur py-3 border-b border-border/60 mb-6">
        <ol className="flex items-center gap-1 sm:gap-2">
          {WIZARD_STEPS.map((s) => {
            const isActive = s.n === step
            const isDone = s.n < step
            return (
              <li key={s.n} className="flex-1 flex items-center gap-2 min-w-0">
                <span
                  className={`shrink-0 size-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {new Intl.NumberFormat("fa-IR").format(s.n)}
                </span>
                <span
                  className={`text-[11px] sm:text-xs font-medium truncate ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {loadError && (
        <Alert variant="destructive" className="text-right mb-4">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>خطا</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card className="rounded-2xl">
        <CardContent className="space-y-6 p-4 sm:p-6">
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <span className="text-xs font-bold text-foreground">دسته‌بندی</span>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Button
                      key={cat.id}
                      type="button"
                      variant={form.category_id === cat.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => set("category_id", cat.id)}
                      className="rounded-full"
                    >
                      {cat.title}
                    </Button>
                  ))}
                  {categories.length === 0 && (
                    <span className="text-xs text-muted-foreground">در حال بارگذاری…</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="wizard-city" className="text-xs font-bold text-foreground">
                  شهر
                </label>
                <select
                  id="wizard-city"
                  value={form.city_id || ""}
                  onChange={(e) => set("city_id", e.target.value ? Number(e.target.value) : 0)}
                  aria-label="انتخاب شهر"
                  className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="" className="text-foreground bg-background">
                    شهر را انتخاب کنید
                  </option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id} className="text-foreground bg-background">
                      {city.province?.name ? `${city.name} (${city.province.name})` : city.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="wizard-title" className="text-xs font-bold text-foreground">
                  عنوان اقامتگاه
                </label>
                <Input
                  id="wizard-title"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="مثلاً ویلای جنگلی چالوس"
                  className="h-11 rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">حداقل ۳ حرف</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="wizard-address" className="text-xs font-bold text-foreground">
                  آدرس
                </label>
                <Input
                  id="wizard-address"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="آدرس کامل اقامتگاه"
                  className="h-11 rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">حداقل ۵ حرف</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="wizard-description" className="text-xs font-bold text-foreground">
                  توضیحات
                </label>
                <Textarea
                  id="wizard-description"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="اقامتگاه خود را معرفی کنید…"
                  className="rounded-xl min-h-24"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                لینک تصاویر اقامتگاه را وارد کنید. یکی از تصاویر را به‌عنوان تصویر اصلی
                انتخاب کنید.
              </p>
              {form.images.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  هنوز تصویری اضافه نشده است — افزودن تصویر اختیاری است.
                </p>
              )}
              <RadioGroup
                value={coverIndex >= 0 ? String(coverIndex) : ""}
                onValueChange={(v) => setCover(Number(v))}
              >
                {form.images.map((img, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl border border-input bg-background"
                  >
                    {img.image_url.trim() !== "" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.image_url}
                        alt={`تصویر ${i + 1}`}
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = "none"
                        }}
                        className="size-16 shrink-0 rounded-lg object-cover bg-muted"
                      />
                    ) : (
                      <div className="size-16 shrink-0 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        <ImagePlus className="w-6 h-6 opacity-50" />
                      </div>
                    )}
                    <Input
                      value={img.image_url}
                      onChange={(e) => updateImageUrl(i, e.target.value)}
                      placeholder="https://…"
                      dir="ltr"
                      className="h-11 rounded-xl text-left flex-1 min-w-0"
                    />
                    <label className="flex items-center gap-1.5 text-xs font-medium shrink-0 cursor-pointer">
                      <RadioGroupItem value={String(i)} id={`cover-${i}`} />
                      <span>اصلی</span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeImage(i)}
                      aria-label="حذف تصویر"
                      className="size-8 rounded-full text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </RadioGroup>
              <Button
                type="button"
                variant="outline"
                onClick={addImage}
                className="gap-2 font-bold"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن تصویر</span>
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <Stepper
                  label="ظرفیت پایه (مهمان)"
                  value={form.capacity}
                  onChange={(v) => set("capacity", v)}
                  min={1}
                  max={30}
                />
                <Stepper
                  label="حداکثر ظرفیت (مهمان)"
                  value={form.max_capacity}
                  onChange={(v) => set("max_capacity", v)}
                  min={form.capacity}
                  max={30}
                />
                <Stepper
                  label="تعداد اتاق"
                  value={form.rooms_count}
                  onChange={(v) => set("rooms_count", v)}
                  min={0}
                  max={30}
                />
                <Stepper
                  label="تعداد تخت"
                  value={form.beds_count}
                  onChange={(v) => set("beds_count", v)}
                  min={0}
                  max={30}
                />
              </div>
              {form.max_capacity < form.capacity && (
                <p className="text-xs text-destructive font-medium">
                  حداکثر ظرفیت نمی‌تواند کمتر از ظرفیت پایه باشد.
                </p>
              )}

              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-foreground">امکانات</span>
                {amenities.length === 0 ? (
                  <p className="text-xs text-muted-foreground">در حال بارگذاری…</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {amenities.map((amenity) => (
                      <label
                        key={amenity.id}
                        className="flex items-center gap-2 p-3 rounded-xl border border-input bg-background cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={form.amenity_ids.includes(amenity.id)}
                          onCheckedChange={() => toggleAmenity(amenity.id)}
                        />
                        <span>{amenity.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="wizard-base-price" className="text-xs font-bold text-foreground">
                  نرخ پایه هر شب (تومان)
                </label>
                <Input
                  id="wizard-base-price"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.base_price}
                  onChange={(e) => set("base_price", Number(e.target.value) || 0)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="wizard-extra-fee" className="text-xs font-bold text-foreground">
                  هزینه مهمان اضافه (تومان)
                </label>
                <Input
                  id="wizard-extra-fee"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.extra_guest_fee}
                  onChange={(e) => set("extra_guest_fee", Number(e.target.value) || 0)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="wizard-cleaning-fee" className="text-xs font-bold text-foreground">
                  هزینه نظافت (تومان)
                </label>
                <Input
                  id="wizard-cleaning-fee"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.cleaning_fee}
                  onChange={(e) => set("cleaning_fee", Number(e.target.value) || 0)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="wizard-min-nights" className="text-xs font-bold text-foreground">
                  حداقل اقامت (شب)
                </label>
                <Input
                  id="wizard-min-nights"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={form.min_nights ?? 1}
                  onChange={(e) => set("min_nights", Number(e.target.value) || 1)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-input bg-muted/40 space-y-1">
                  <span className="text-xs text-muted-foreground">ساعت ورود</span>
                  <p className="text-sm font-bold font-price">۱۴:۰۰</p>
                </div>
                <div className="p-3 rounded-xl border border-input bg-muted/40 space-y-1">
                  <span className="text-xs text-muted-foreground">ساعت خروج</span>
                  <p className="text-sm font-bold font-price">۱۲:۰۰</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ساعت ورود و خروج پیش‌فرض سامانه است و در این نسخه قابل تغییر نیست.
              </p>

              <div className="space-y-2">
                <span className="text-xs font-bold text-foreground">سیاست لغو رزرو</span>
                <div className="flex flex-wrap gap-2">
                  {POLICY_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={form.cancellation_policy === opt.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => set("cancellation_policy", opt.value)}
                      className="rounded-full"
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="wizard-rules" className="text-xs font-bold text-foreground">
                  قوانین اقامتگاه
                </label>
                <Textarea
                  id="wizard-rules"
                  value={form.rules}
                  onChange={(e) => set("rules", e.target.value)}
                  placeholder="مثلاً ورود حیوان خانگی ممنوع است…"
                  className="rounded-xl min-h-24"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky wizard bottom bar — the only way to move between steps */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur safe-pb">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="h-11 px-6 font-bold"
          >
            مرحله قبل
          </Button>
          {step < 5 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(5, s + 1))}
              disabled={!stepValid(step)}
              className="h-11 px-6 font-bold"
            >
              مرحله بعد
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              disabled={!formValid}
              className="h-11 px-6 font-bold"
            >
              پیش‌نمایش و ثبت نهایی
            </Button>
          )}
        </div>
      </div>

      {/* Preview modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-lg text-right max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>پیش‌نمایش اقامتگاه</DialogTitle>
            <DialogDescription>
              اطلاعات را بررسی کنید؛ پس از ثبت، اقامتگاه شما منتشر می‌شود.
            </DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 text-sm py-2">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">عنوان</dt>
              <dd className="font-medium">{form.title || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">دسته‌بندی</dt>
              <dd className="font-medium">{selectedCategory?.title || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">شهر</dt>
              <dd className="font-medium">{selectedCity?.name || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">آدرس</dt>
              <dd className="font-medium text-left">{form.address || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">ظرفیت</dt>
              <dd className="font-medium font-price">
                {new Intl.NumberFormat("fa-IR").format(form.capacity)} تا{" "}
                {new Intl.NumberFormat("fa-IR").format(form.max_capacity)} مهمان
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">اتاق / تخت</dt>
              <dd className="font-medium font-price">
                {new Intl.NumberFormat("fa-IR").format(form.rooms_count)} اتاق /{" "}
                {new Intl.NumberFormat("fa-IR").format(form.beds_count)} تخت
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">امکانات</dt>
              <dd className="font-medium">
                {selectedAmenities.length > 0
                  ? selectedAmenities.map((a) => a.name).join("، ")
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">تصاویر</dt>
              <dd className="font-medium font-price">
                {new Intl.NumberFormat("fa-IR").format(
                  form.images.filter((img) => img.image_url.trim() !== "").length
                )}{" "}
                تصویر
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">نرخ پایه هر شب</dt>
              <dd className="font-medium font-price">{formatToman(form.base_price)} تومان</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">هزینه مهمان اضافه / نظافت</dt>
              <dd className="font-medium font-price">
                {formatToman(form.extra_guest_fee)} / {formatToman(form.cleaning_fee)} تومان
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">حداقل اقامت</dt>
              <dd className="font-medium font-price">
                {new Intl.NumberFormat("fa-IR").format(form.min_nights ?? 1)} شب
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">ورود / خروج</dt>
              <dd className="font-medium font-price">۱۴:۰۰ / ۱۲:۰۰</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">سیاست لغو</dt>
              <dd className="font-medium">{policyLabel}</dd>
            </div>
            {form.rules.trim() !== "" && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">قوانین</dt>
                <dd className="font-medium text-left">{form.rules}</dd>
              </div>
            )}
          </dl>
          {submitError && (
            <Alert variant="destructive" className="text-right">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>خطا</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPreviewOpen(false)}
              disabled={isSubmitting}
            >
              بازگشت به ویرایش
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !formValid}
              className="font-bold"
            >
              {isSubmitting ? "در حال ثبت…" : "ثبت نهایی اقامتگاه"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Congratulations modal */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent className="sm:max-w-md text-center" dir="rtl">
          <DialogHeader className="items-center">
            <CheckCircle2 className="w-14 h-14 text-primary" />
            <DialogTitle className="text-lg">اقامتگاه شما ثبت شد!</DialogTitle>
            <DialogDescription>
              تبریک! اقامتگاه شما با موفقیت ثبت و منتشر شد. مهمانان از همین حالا
              می‌توانند آن را مشاهده و رزرو کنند.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              type="button"
              onClick={() => {
                if (createdId !== null) router.push(`/accommodations/${createdId}`)
              }}
              disabled={createdId === null}
              className="w-full font-bold"
            >
              مشاهده اقامتگاه
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/host/dashboard")}
              className="w-full font-bold"
            >
              بازگشت به داشبورد میزبان
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
