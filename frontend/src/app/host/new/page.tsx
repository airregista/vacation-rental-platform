"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { describeCancellationPolicy, getCancellationPolicyLabel } from "@/lib/cancellation-policy"
import type { AccommodationCreateForm } from "@/types/host"
import type { Category, City, Amenity } from "@/types/accommodation"
import { HostAccessGate } from "@/components/host/host-access-gate"
import { HostPageLayout } from "@/components/host/host-page-layout"
import { FormSection } from "@/components/host/form-section"
import { NumberStepper } from "@/components/host/number-stepper"
import { AmenityPicker } from "@/components/host/amenity-picker"
import { ImageUploader } from "@/components/host/image-uploader"
import { PolicySelector } from "@/components/host/policy-selector"
import { CityCombobox } from "@/components/shared/city-combobox"
import { PersianNumberInput } from "@/components/shared/persian-number-input"
import {
  fetchAllPages,
  formatFaNumber,
  formatToman,
  getApiErrorMessage,
} from "@/components/host/host-utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const WIZARD_STEPS = [
  { n: 1, label: "دسته‌بندی و مشخصات" },
  { n: 2, label: "تصاویر" },
  { n: 3, label: "ظرفیت و امکانات" },
  { n: 4, label: "قیمت‌گذاری" },
  { n: 5, label: "قوانین و تایید" },
] as const

type CreateFormState = AccommodationCreateForm & {
  custom_amenities: string[]
}

const initialForm: CreateFormState = {
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
  cancellation_free_hours: 24,
  cancellation_penalty_percent: 50,
  min_nights: 1,
  is_active: true,
  images: [],
  amenity_ids: [],
  custom_amenities: [],
}

function NewAccommodationContent() {
  const router = useRouter()

  const [form, setForm] = useState<CreateFormState>(initialForm)
  const [step, setStep] = useState(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [amenities, setAmenities] = useState<Amenity[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isSuccessOpen, setIsSuccessOpen] = useState(false)
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadOptions = async () => {
      try {
        const [cats, cits, amens] = await Promise.all([
          apiClient.get<Category[]>("/categories/"),
          fetchAllPages<City>("/geo/cities"),
          apiClient.get<Amenity[]>("/amenities/"),
        ])
        if (!isMounted) return
        setCategories(Array.isArray(cats) ? cats : [])
        setCities(Array.isArray(cits) ? cits : [])
        setAmenities(Array.isArray(amens) ? amens : [])
        setLoadError(null)
      } catch (error: unknown) {
        if (!isMounted) return
        setLoadError(
          getApiErrorMessage(error, "بارگذاری گزینه‌های دسته‌بندی و شهر با خطا مواجه شد."),
        )
      } finally {
        if (isMounted) setIsLoadingOptions(false)
      }
    }

    void loadOptions()
    return () => {
      isMounted = false
    }
  }, [])

  const set = <K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const stepValid = (currentStep: number): boolean => {
    switch (currentStep) {
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
          (form.min_nights ?? 1) >= 1 &&
          Number.isInteger(form.min_nights ?? 1)
        )
      case 5:
        return (
          Number.isInteger(form.cancellation_free_hours ?? 24) &&
          (form.cancellation_free_hours ?? 24) >= 0 &&
          Number.isFinite(form.cancellation_penalty_percent ?? 50) &&
          (form.cancellation_penalty_percent ?? 50) >= 0 &&
          (form.cancellation_penalty_percent ?? 50) <= 100
        )
      default:
        return false
    }
  }

  const formValid = [1, 2, 3, 4, 5].every(stepValid)

  const goToStep = (nextStep: number) => {
    setStep(nextStep)
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const addImage = (image: AccommodationCreateForm["images"][number]) => {
    setForm((prev) => ({
      ...prev,
      images: image.is_cover
        ? [...prev.images.map((item) => ({ ...item, is_cover: false })), image]
        : [...prev.images, image],
    }))
  }

  const removeImage = (target: AccommodationCreateForm["images"][number]) => {
    setForm((prev) => {
      const rest = prev.images.filter((image) => image.sort_order !== target.sort_order)
      const reindexed = rest.map((image, imageIndex) => ({
        ...image,
        sort_order: imageIndex,
      }))
      if (reindexed.length > 0 && !reindexed.some((image) => image.is_cover)) {
        reindexed[0] = { ...reindexed[0], is_cover: true }
      }
      return { ...prev, images: reindexed }
    })
  }

  const setImageCover = (target: AccommodationCreateForm["images"][number]) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((image) => ({
        ...image,
        is_cover: image.sort_order === target.sort_order,
      })),
    }))
  }

  const setPolicy = (value: AccommodationCreateForm["cancellation_policy"]) => {
    setForm((prev) => {
      if (prev.cancellation_policy === value) return prev
      return {
        ...prev,
        cancellation_policy: value,
        ...(value === "custom"
          ? {}
          : { cancellation_free_hours: 24, cancellation_penalty_percent: 50 }),
      }
    })
  }

  const toggleAmenity = (amenityId: number) => {
    setForm((prev) => ({
      ...prev,
      amenity_ids: prev.amenity_ids.includes(amenityId)
        ? prev.amenity_ids.filter((id) => id !== amenityId)
        : [...prev.amenity_ids, amenityId],
    }))
  }

  const addCustomAmenity = (name: string) => {
    setForm((prev) => ({
      ...prev,
      custom_amenities: [...prev.custom_amenities, name],
    }))
  }

  const removeCustomAmenity = (name: string) => {
    setForm((prev) => ({
      ...prev,
      custom_amenities: prev.custom_amenities.filter((item) => item !== name),
    }))
  }

  const handleSubmit = async () => {
    if (!formValid) return
    setIsSubmitting(true)
    setSubmitError(null)

    const images = form.images.map((image, index) => ({
      image_url: image.image_url,
      is_cover: image.is_cover,
      sort_order: index,
    }))
    if (images.length > 0 && !images.some((image) => image.is_cover)) {
      images[0].is_cover = true
    }

    try {
      const response = await apiClient.post<{ id: number }>("/accommodations/", {
        ...form,
        images,
        min_nights: form.min_nights ?? 1,
        cancellation_free_hours: form.cancellation_free_hours ?? 24,
        cancellation_penalty_percent: form.cancellation_penalty_percent ?? 50,
      })
      setCreatedId(response.id)
      setIsPreviewOpen(false)
      setIsSuccessOpen(true)
    } catch (error: unknown) {
      setSubmitError(getApiErrorMessage(error, "ثبت اقامتگاه با خطا مواجه شد."))
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCategory = categories.find((item) => item.id === form.category_id)
  const selectedCity = cities.find((item) => item.id === form.city_id)
  const selectedAmenities = amenities.filter((item) => form.amenity_ids.includes(item.id))
  const policyLabel = getCancellationPolicyLabel(form.cancellation_policy)
  const policySummary = describeCancellationPolicy(form.cancellation_policy, {
    freeHours: form.cancellation_free_hours ?? 24,
    penaltyPercent: form.cancellation_penalty_percent ?? 50,
  })

  return (
    <div className="pb-28">
      {loadError ? (
        <Alert variant="destructive" className="mb-5">
          <AlertCircle className="size-4" />
          <AlertTitle>بارگذاری گزینه‌ها انجام نشد</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="sticky top-16 z-30 -mx-4 mb-5 border-b border-line/60 bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        {/* One line on every size: number circles + active label on phones,
            all labels from sm: up. flex-nowrap + whitespace-nowrap keep the
            label beside its circle instead of wrapping underneath. */}
        <ol className="flex flex-nowrap items-center gap-1 whitespace-nowrap sm:gap-2">
          {WIZARD_STEPS.map((item) => {
            const isActive = item.n === step
            const isDone = item.n < step
            return (
              <li
                key={item.n}
                className="flex shrink-0 items-center gap-1.5"
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={
                    isActive
                      ? "grid size-7 shrink-0 place-items-center rounded-full bg-brick text-[11px] font-black text-on-brick"
                      : isDone
                        ? "grid size-7 shrink-0 place-items-center rounded-full bg-brick/15 text-[11px] font-black text-brick"
                        : "grid size-7 shrink-0 place-items-center rounded-full bg-paper-deep text-[11px] font-black text-ink-soft"
                  }
                >
                  {formatFaNumber(item.n)}
                </span>
                <span
                  className={
                    isActive
                      ? "block text-[11px] font-bold text-ink sm:block sm:text-xs"
                      : "hidden text-[11px] font-medium text-ink-soft sm:block sm:text-xs"
                  }
                >
                  {item.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {step === 1 ? (
        <FormSection
          eyebrow="گام یک"
          title="دسته‌بندی و مشخصات اقامتگاه"
          description="مهمان‌ها اول با عنوان، شهر و نوع اقامتگاه شما روبه‌رو می‌شوند؛ این بخش را دقیق تکمیل کنید."
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <span className="text-xs font-bold text-ink">دسته‌بندی</span>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    type="button"
                    variant={form.category_id === category.id ? "default" : "outline"}
                    size="sm"
                    shape="pill"
                    onClick={() => set("category_id", category.id)}
                    aria-pressed={form.category_id === category.id}
                  >
                    {category.title}
                  </Button>
                ))}
                {isLoadingOptions ? (
                  <span className="text-xs text-ink-soft">در حال بارگذاری…</span>
                ) : null}
                {!isLoadingOptions && categories.length === 0 ? (
                  <span className="text-xs text-ink-soft">دسته‌بندی‌ای ثبت نشده است.</span>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="wizard-city" className="text-xs font-bold text-ink">
                شهر
              </label>
              <CityCombobox
                id="wizard-city"
                cities={cities}
                value={form.city_id}
                onChange={(cityId) => set("city_id", cityId)}
                isLoading={isLoadingOptions}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="wizard-title" className="text-xs font-bold text-ink">
                عنوان اقامتگاه
              </label>
              <Input
                id="wizard-title"
                value={form.title}
                onChange={(event) => set("title", event.target.value)}
                placeholder="مثلاً ویلای جنگلی چالوس"
                className="h-11 border-line bg-paper-card"
              />
              <p className="text-[11px] text-ink-soft">حداقل ۳ حرف</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="wizard-address" className="text-xs font-bold text-ink">
                آدرس
              </label>
              <Input
                id="wizard-address"
                value={form.address}
                onChange={(event) => set("address", event.target.value)}
                placeholder="آدرس کامل اقامتگاه"
                className="h-11 border-line bg-paper-card"
              />
              <p className="text-[11px] text-ink-soft">حداقل ۵ حرف</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="wizard-description" className="text-xs font-bold text-ink">
                توضیحات
              </label>
              <Textarea
                id="wizard-description"
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
                placeholder="اقامتگاه خود را معرفی کنید؛ فضا، منظره و تجربه اقامت را بنویسید…"
                className="min-h-28 border-line bg-paper-card"
              />
            </div>
          </div>
        </FormSection>
      ) : null}

      {step === 2 ? (
        <FormSection
          eyebrow="گام دو"
          title="تصاویر اقامتگاه"
          description="تصاویر را از دستگاه خود بارگذاری کنید و یکی از آن‌ها را به‌عنوان تصویر کاور انتخاب کنید."
        >
          <ImageUploader
            images={form.images}
            onAdd={addImage}
            onRemove={removeImage}
            onSetCover={setImageCover}
            emptyText="هنوز تصویری اضافه نشده است — افزودن تصویر اختیاری است، اما اقامتگاه‌های دارای عکس بیشتر دیده می‌شوند."
          />
        </FormSection>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <FormSection
            eyebrow="گام سه"
            title="ظرفیت و چیدمان"
            description="ظرفیت پایه، حداکثر مهمان و تعداد اتاق و تخت را مشخص کنید."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberStepper
                label="ظرفیت پایه (مهمان)"
                value={form.capacity}
                onChange={(value) => set("capacity", value)}
                min={1}
                max={200}
                hint="تعداد مهمان بدون هزینه اضافه"
              />
              <NumberStepper
                label="حداکثر ظرفیت (مهمان)"
                value={form.max_capacity}
                onChange={(value) => set("max_capacity", value)}
                min={form.capacity}
                max={200}
                hint="با هزینه مهمان اضافه"
              />
              <NumberStepper
                label="تعداد اتاق"
                value={form.rooms_count}
                onChange={(value) => set("rooms_count", value)}
                min={0}
                max={30}
              />
              <NumberStepper
                label="تعداد تخت"
                value={form.beds_count}
                onChange={(value) => set("beds_count", value)}
                min={0}
                max={30}
              />
            </div>
            {form.max_capacity < form.capacity ? (
              <p className="mt-3 text-xs font-medium text-destructive">
                حداکثر ظرفیت نمی‌تواند کمتر از ظرفیت پایه باشد.
              </p>
            ) : null}
          </FormSection>

          <FormSection
            title="امکانات"
            description="امکاناتی را که در اختیار مهمان قرار می‌دهید انتخاب کنید."
          >
            <AmenityPicker
              amenities={amenities}
              selectedIds={form.amenity_ids}
              onToggle={toggleAmenity}
              isLoading={isLoadingOptions}
              customAmenities={form.custom_amenities}
              onAddCustom={addCustomAmenity}
              onRemoveCustom={removeCustomAmenity}
            />
          </FormSection>
        </div>
      ) : null}

      {step === 4 ? (
        <FormSection
          eyebrow="گام چهار"
          title="قیمت‌گذاری"
          description="نرخ پایه هر شب و هزینه‌های جانبی را وارد کنید. همه مبالغ به تومان است."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="wizard-base-price" className="text-xs font-bold text-ink">
                نرخ پایه هر شب (تومان)
              </label>
              <PersianNumberInput
                id="wizard-base-price"
                min={0}
                value={form.base_price}
                onValueChange={(value) => set("base_price", value ?? 0)}
                className="h-11 border-line bg-paper-card tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="wizard-extra-fee" className="text-xs font-bold text-ink">
                هزینه مهمان اضافه (تومان)
              </label>
              <PersianNumberInput
                id="wizard-extra-fee"
                min={0}
                value={form.extra_guest_fee}
                onValueChange={(value) => set("extra_guest_fee", value ?? 0)}
                className="h-11 border-line bg-paper-card tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="wizard-cleaning-fee" className="text-xs font-bold text-ink">
                هزینه نظافت (تومان)
              </label>
              <PersianNumberInput
                id="wizard-cleaning-fee"
                min={0}
                value={form.cleaning_fee}
                onValueChange={(value) => set("cleaning_fee", value ?? 0)}
                className="h-11 border-line bg-paper-card tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="wizard-min-nights" className="text-xs font-bold text-ink">
                حداقل اقامت (شب)
              </label>
              <PersianNumberInput
                id="wizard-min-nights"
                min={1}
                value={form.min_nights ?? 1}
                emptyValue={1}
                onValueChange={(value) => set("min_nights", value || 1)}
                className="h-11 border-line bg-paper-card tabular-nums"
              />
              {!Number.isInteger(form.min_nights ?? 1) ? (
                <p className="text-xs font-medium text-destructive">
                  حداقل اقامت باید عدد صحیح باشد.
                </p>
              ) : null}
            </div>
          </div>
        </FormSection>
      ) : null}

      {step === 5 ? (
        <div className="space-y-4">
          <FormSection
            eyebrow="گام پنج"
            title="قوانین و تایید نهایی"
            description="سیاست لغو رزرو و مقررات اقامتگاه را مشخص کنید؛ سپس پیش‌نمایش را بررسی کنید."
          >
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 rounded-xl border border-line/70 bg-paper-deep/40 p-3">
                  <span className="text-[11px] text-ink-soft">ساعت ورود</span>
                  <p className="text-sm font-black tabular-nums text-ink">۱۴:۰۰</p>
                </div>
                <div className="space-y-1 rounded-xl border border-line/70 bg-paper-deep/40 p-3">
                  <span className="text-[11px] text-ink-soft">ساعت خروج</span>
                  <p className="text-sm font-black tabular-nums text-ink">۱۲:۰۰</p>
                </div>
              </div>
              <p className="text-[11px] leading-6 text-ink-soft">
                ساعت ورود و خروج پیش‌فرض سامانه است و در این مرحله قابل تغییر نیست؛ پس از ثبت
                می‌توانید از صفحه ویرایش آن را تنظیم کنید.
              </p>

              <div className="space-y-2">
                <span className="text-xs font-bold text-ink">سیاست لغو رزرو</span>
                <PolicySelector
                  value={form.cancellation_policy}
                  onChange={setPolicy}
                  freeHours={form.cancellation_free_hours ?? 24}
                  penaltyPercent={form.cancellation_penalty_percent ?? 50}
                  onFreeHoursChange={(value) => set("cancellation_free_hours", value)}
                  onPenaltyPercentChange={(value) => set("cancellation_penalty_percent", value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="wizard-rules" className="text-xs font-bold text-ink">
                  قوانین اقامتگاه
                </label>
                <Textarea
                  id="wizard-rules"
                  value={form.rules}
                  onChange={(event) => set("rules", event.target.value)}
                  placeholder="مثلاً ورود حیوان خانگی ممنوع است، ساعت سکوت بعد از ۲۳ است…"
                  className="min-h-28 border-line bg-paper-card"
                />
              </div>
            </div>
          </FormSection>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur safe-pb">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => goToStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="h-11 border-line bg-transparent px-5 font-bold"
          >
            مرحله قبل
          </Button>
          <p className="hidden text-xs text-ink-soft sm:block">
            مرحله {formatFaNumber(step)} از {formatFaNumber(WIZARD_STEPS.length)}
          </p>
          {step < 5 ? (
            <Button
              type="button"
              onClick={() => goToStep(Math.min(5, step + 1))}
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

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto text-right sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>پیش‌نمایش اقامتگاه</DialogTitle>
            <DialogDescription>
              اطلاعات را بررسی کنید؛ پس از ثبت، اقامتگاه شما منتشر می‌شود.
            </DialogDescription>
          </DialogHeader>

          <dl className="space-y-2 py-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-line/50 pb-2">
              <dt className="text-ink-soft">عنوان</dt>
              <dd className="font-bold text-ink">{form.title || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">دسته‌بندی</dt>
              <dd className="font-medium text-ink">{selectedCategory?.title || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">شهر</dt>
              <dd className="font-medium text-ink">{selectedCity?.name || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-ink-soft">آدرس</dt>
              <dd className="text-left font-medium text-ink">{form.address || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">ظرفیت</dt>
              <dd className="font-medium tabular-nums text-ink">
                {formatFaNumber(form.capacity)} تا {formatFaNumber(form.max_capacity)} مهمان
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">اتاق / تخت</dt>
              <dd className="font-medium tabular-nums text-ink">
                {formatFaNumber(form.rooms_count)} اتاق / {formatFaNumber(form.beds_count)} تخت
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">امکانات</dt>
              <dd className="font-medium text-ink">
                {selectedAmenities.length > 0 || form.custom_amenities.length > 0
                  ? [
                      ...selectedAmenities.map((amenity) => amenity.name),
                      ...form.custom_amenities,
                    ].join("، ")
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">تصاویر</dt>
              <dd className="font-medium tabular-nums text-ink">
                {formatFaNumber(form.images.length)} تصویر
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">نرخ پایه هر شب</dt>
              <dd className="font-bold tabular-nums text-brick">
                {formatToman(form.base_price)} تومان
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">هزینه مهمان اضافه / نظافت</dt>
              <dd className="font-medium tabular-nums text-ink">
                {formatToman(form.extra_guest_fee)} / {formatToman(form.cleaning_fee)} تومان
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">حداقل اقامت</dt>
              <dd className="font-medium tabular-nums text-ink">
                {formatFaNumber(form.min_nights ?? 1)} شب
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">ورود / خروج</dt>
              <dd className="font-medium tabular-nums text-ink">۱۴:۰۰ / ۱۲:۰۰</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-ink-soft">سیاست لغو</dt>
              <dd className="space-y-1 text-right font-medium text-ink">
                <span className="block">{policyLabel}</span>
                <span className="block text-[11px] leading-6 text-ink-soft">{policySummary}</span>
              </dd>
            </div>
            {form.rules.trim() !== "" ? (
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-soft">قوانین</dt>
                <dd className="text-left font-medium text-ink">{form.rules}</dd>
              </div>
            ) : null}
          </dl>

          {submitError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>ثبت انجام نشد</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPreviewOpen(false)}
              disabled={isSubmitting}
              className="border-line bg-transparent"
            >
              بازگشت به ویرایش
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !formValid}
              className="gap-2 font-bold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>در حال ثبت…</span>
                </>
              ) : (
                <span>ثبت نهایی اقامتگاه</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent dir="rtl" className="text-center sm:max-w-md">
          <DialogHeader className="items-center">
            <span className="grid size-16 place-items-center rounded-b-3xl rounded-t-full bg-trust/10 text-trust">
              <CheckCircle2 className="size-8" aria-hidden="true" />
            </span>
            <DialogTitle className="text-lg">اقامتگاه شما ثبت شد!</DialogTitle>
            <DialogDescription className="leading-7">
              تبریک! اقامتگاه شما با موفقیت ثبت و منتشر شد. مهمانان از همین حالا می‌توانند آن را
              ببینند و رزرو کنند.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
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
              className="w-full border-line bg-transparent font-bold"
            >
              بازگشت به داشبورد میزبان
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function NewAccommodationPage() {
  return (
    <HostPageLayout
      showNav={false}
      eyebrow="اقامتگاه جدید"
      title="ثبت اقامتگاه جدید"
      description="در پنج گام اقامتگاه خود را معرفی کنید؛ اطلاعات هر گام ذخیره می‌شود تا در پایان یک اقامتگاه کامل ثبت شود."
      backHref="/host/dashboard"
      backLabel="بازگشت به داشبورد میزبان"
      contentClassName="max-w-5xl"
    >
      <HostAccessGate
        title="ثبت اقامتگاه جدید"
        description="برای ثبت اقامتگاه، ابتدا وارد حساب کاربری خود شوید و حساب را به میزبان ارتقا دهید."
      >
        <NewAccommodationContent />
      </HostAccessGate>
    </HostPageLayout>
  )
}
