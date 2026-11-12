"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  ExternalLink,
  Loader2,
  Save,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiClient } from "@/lib/api-client"
import { formatPersianDate } from "@/lib/format-fa"
import type { Amenity, Category, City } from "@/types/accommodation"
import type { HostAccommodationDetail, HostImageRecord } from "@/components/host/types"
import { HostAccessGate } from "@/components/host/host-access-gate"
import { HostPageLayout } from "@/components/host/host-page-layout"
import { FormSection } from "@/components/host/form-section"
import { NumberStepper } from "@/components/host/number-stepper"
import { AmenityPicker } from "@/components/host/amenity-picker"
import {
  ImageUploader,
  type ImageUploaderItem,
} from "@/components/host/image-uploader"
import {
  POLICY_OPTIONS,
  PolicySelector,
  type CancellationPolicy,
} from "@/components/host/policy-selector"
import { CityCombobox } from "@/components/shared/city-combobox"
import {
  fetchAllPages,
  formatFaNumber,
  getApiErrorMessage,
  sortHostImages,
  toTimeInputValue,
} from "@/components/host/host-utils"
import { EmptyState } from "@/components/shared/empty-state"
import { PersianNumberInput } from "@/components/shared/persian-number-input"
import { PersianTimeInput } from "@/components/shared/persian-time-input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

interface EditListingPageProps {
  params: Promise<{ id: string }>
}

interface EditFormState {
  title: string
  description: string
  address: string
  city_id: number
  category_id: number
  base_price: number
  cleaning_fee: number
  capacity: number
  max_capacity: number
  rooms_count: number
  beds_count: number
  min_nights: number
  check_in_time: string
  check_out_time: string
  rules: string
  cancellation_policy: CancellationPolicy
  cancellation_free_hours: number
  cancellation_penalty_percent: number
  amenity_ids: number[]
  custom_amenities: string[]
  is_active: boolean
  external_calendar_url: string
}

function buildFormState(data: HostAccommodationDetail): EditFormState {
  return {
    title: data.title,
    description: data.description ?? "",
    address: data.address,
    city_id: data.city_id,
    category_id: data.category_id,
    base_price: Number(data.base_price),
    cleaning_fee: Number(data.cleaning_fee),
    capacity: data.capacity,
    max_capacity: data.max_capacity,
    rooms_count: data.rooms_count,
    beds_count: data.beds_count,
    min_nights: data.min_nights,
    check_in_time: toTimeInputValue(data.check_in_time),
    check_out_time: toTimeInputValue(data.check_out_time),
    rules: data.rules ?? "",
    cancellation_policy: data.cancellation_policy,
    cancellation_free_hours: data.cancellation_free_hours ?? 24,
    cancellation_penalty_percent: Number(data.cancellation_penalty_percent ?? 50),
    amenity_ids: data.amenities.map((amenity) => amenity.id),
    custom_amenities: data.custom_amenities ?? [],
    is_active: data.is_active,
    external_calendar_url: data.external_calendar_url ?? "",
  }
}

function EditSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}

function EditListingContent({ listingId }: { listingId: number }) {
  const { user, isAdmin } = useAuth()

  const [data, setData] = React.useState<HostAccommodationDetail | null>(null)
  const [form, setForm] = React.useState<EditFormState | null>(null)
  const [images, setImages] = React.useState<HostImageRecord[]>([])
  const [categories, setCategories] = React.useState<Category[]>([])
  const [cities, setCities] = React.useState<City[]>([])
  const [amenities, setAmenities] = React.useState<Amenity[]>([])

  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [showErrors, setShowErrors] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [imageError, setImageError] = React.useState<string | null>(null)
  const [savedOpen, setSavedOpen] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let isCurrent = true

    const loadListing = async () => {
      try {
        const [detail, nextCategories, nextCities, nextAmenities] = await Promise.all([
          apiClient.get<HostAccommodationDetail>(`/accommodations/${listingId}`),
          apiClient.get<Category[]>("/categories/"),
          fetchAllPages<City>("/geo/cities"),
          apiClient.get<Amenity[]>("/amenities/"),
        ])
        if (!isCurrent) return
        setData(detail)
        setForm(buildFormState(detail))
        setImages(sortHostImages(detail.images))
        setCategories(Array.isArray(nextCategories) ? nextCategories : [])
        setCities(Array.isArray(nextCities) ? nextCities : [])
        setAmenities(Array.isArray(nextAmenities) ? nextAmenities : [])
        setLoadError(null)
      } catch (error: unknown) {
        if (!isCurrent) return
        setLoadError(
          getApiErrorMessage(error, "بارگذاری اطلاعات اقامتگاه با خطا مواجه شد.")
        )
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void loadListing()
    return () => {
      isCurrent = false
    }
  }, [listingId, reloadKey])

  const setField = <K extends keyof EditFormState>(
    key: K,
    value: EditFormState[K]
  ) => {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  const setPolicy = (value: CancellationPolicy) => {
    setForm((current) => {
      if (!current || current.cancellation_policy === value) return current
      return {
        ...current,
        cancellation_policy: value,
        ...(value === "custom"
          ? {}
          : { cancellation_free_hours: 24, cancellation_penalty_percent: 50 }),
      }
    })
  }

  const validationErrors = React.useMemo(() => {
    if (!form) return []
    const errors: string[] = []
    if (form.title.trim().length < 3) errors.push("عنوان باید حداقل ۳ حرف باشد.")
    if (form.address.trim().length < 5) errors.push("آدرس باید حداقل ۵ حرف باشد.")
    if (form.city_id <= 0) errors.push("شهر را انتخاب کنید.")
    if (form.category_id <= 0) errors.push("دسته‌بندی را انتخاب کنید.")
    if (form.base_price < 0) errors.push("نرخ پایه نمی‌تواند منفی باشد.")
    if (form.cleaning_fee < 0) errors.push("هزینه نظافت نمی‌تواند منفی باشد.")
    if (form.capacity < 1) errors.push("ظرفیت پایه باید حداقل ۱ مهمان باشد.")
    if (form.max_capacity < form.capacity)
      errors.push("حداکثر ظرفیت نمی‌تواند کمتر از ظرفیت پایه باشد.")
    if (form.rooms_count < 0 || form.beds_count < 0)
      errors.push("تعداد اتاق و تخت نمی‌تواند منفی باشد.")
    if (form.min_nights < 1 || !Number.isInteger(form.min_nights))
      errors.push("حداقل اقامت باید عدد صحیح و حداقل ۱ شب باشد.")
    if (!form.check_in_time || !form.check_out_time)
      errors.push("ساعت ورود و خروج را وارد کنید.")
    if (
      !Number.isInteger(form.cancellation_free_hours) ||
      form.cancellation_free_hours < 0
    )
      errors.push("ساعت لغو رایگان باید عدد صحیح و نامنفی باشد.")
    if (
      !Number.isFinite(form.cancellation_penalty_percent) ||
      form.cancellation_penalty_percent < 0 ||
      form.cancellation_penalty_percent > 100
    )
      errors.push("درصد جریمه باید بین ۰ تا ۱۰۰ باشد.")
    return errors
  }, [form])

  const isOwner = Boolean(data && (isAdmin || data.host_id === user?.id))
  const canSave = form !== null && validationErrors.length === 0

  const handleRetry = () => {
    setIsLoading(true)
    setLoadError(null)
    setReloadKey((key) => key + 1)
  }

  const handleSave = async () => {
    if (!form || !canSave) {
      setShowErrors(true)
      return
    }

    setIsSaving(true)
    setSaveError(null)
    try {
      const updated = await apiClient.put<HostAccommodationDetail>(
        `/accommodations/${listingId}`,
        {
          title: form.title.trim(),
          description: form.description.trim() || null,
          address: form.address.trim(),
          city_id: form.city_id,
          category_id: form.category_id,
          base_price: form.base_price,
          cleaning_fee: form.cleaning_fee,
          capacity: form.capacity,
          max_capacity: form.max_capacity,
          rooms_count: form.rooms_count,
          beds_count: form.beds_count,
          min_nights: form.min_nights,
          check_in_time: form.check_in_time,
          check_out_time: form.check_out_time,
          rules: form.rules.trim() || null,
          cancellation_policy: form.cancellation_policy,
          cancellation_free_hours: form.cancellation_free_hours,
          cancellation_penalty_percent: form.cancellation_penalty_percent,
          amenity_ids: form.amenity_ids,
          custom_amenities: form.custom_amenities,
          is_active: form.is_active,
          external_calendar_url: form.external_calendar_url.trim() || null,
        }
      )
      setData(updated)
      setForm(buildFormState(updated))
      setImages(sortHostImages(updated.images))
      setShowErrors(false)
      setSavedOpen(true)
    } catch (error: unknown) {
      setSaveError(getApiErrorMessage(error, "ذخیره تغییرات با خطا مواجه شد."))
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddImage = async (image: ImageUploaderItem) => {
    setImageError(null)
    try {
      const created = await apiClient.post<HostImageRecord>(
        `/accommodations/${listingId}/images`,
        {
          image_url: image.image_url,
          is_cover: image.is_cover,
          sort_order: image.sort_order,
        }
      )
      setImages((current) =>
        sortHostImages(
          image.is_cover
            ? [...current.map((item) => ({ ...item, is_cover: false })), created]
            : [...current, created]
        )
      )
    } catch (error: unknown) {
      setImageError(getApiErrorMessage(error, "افزودن تصویر با خطا مواجه شد."))
      throw error
    }
  }

  const handleDeleteImage = async (image: ImageUploaderItem) => {
    if (image.id === undefined) return
    setImageError(null)
    try {
      await apiClient.delete(`/accommodations/${listingId}/images/${image.id}`)
      setImages((current) => current.filter((item) => item.id !== image.id))
    } catch (error: unknown) {
      setImageError(getApiErrorMessage(error, "حذف تصویر با خطا مواجه شد."))
    }
  }

  const handleSetCover = async (image: ImageUploaderItem) => {
    if (image.id === undefined) return
    setImageError(null)
    try {
      const updated = await apiClient.post<HostImageRecord>(
        `/accommodations/${listingId}/images/${image.id}/cover`
      )
      setImages((current) =>
        sortHostImages(
          current.map((item) => ({
            ...item,
            is_cover: item.id === updated.id,
          }))
        )
      )
    } catch (error: unknown) {
      setImageError(getApiErrorMessage(error, "تعیین تصویر کاور با خطا مواجه شد."))
    }
  }

  if (isLoading) return <EditSkeleton />

  if (loadError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>بارگذاری انجام نشد</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{loadError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="border-line bg-transparent"
            >
              تلاش مجدد
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (data && !isOwner) {
    return (
      <EmptyState
        icon={Building2}
        title="این اقامتگاه متعلق به شما نیست"
        description="فقط میزبان اقامتگاه یا مدیر سامانه می‌تواند اطلاعات آن را ویرایش کند."
        action={
          <Button asChild variant="outline" className="border-line bg-transparent">
            <Link href="/host/listings">بازگشت به اقامتگاه‌های من</Link>
          </Button>
        }
      />
    )
  }

  if (!form || !data) return <EditSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-ink">{data.title}</h2>
            <Badge
              variant="outline"
              className={
                data.is_active
                  ? "border-trust/40 bg-trust/10 text-trust"
                  : "border-gold/40 bg-gold-soft/80 text-ink"
              }
            >
              {data.is_active ? "فعال و منتشرشده" : "غیرفعال"}
            </Badge>
          </div>
          <p className="text-xs text-ink-soft">
            شناسه اقامتگاه #{formatFaNumber(data.id)} · آخرین به‌روزرسانی از این صفحه
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5 border-line bg-paper-card">
            <Link href={`/host/listings/${listingId}/preview`}>
              <Eye className="size-4" aria-hidden="true" />
              <span>پیش‌نمایش میزبان</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5 border-line bg-paper-card">
            <Link href={`/accommodations/${listingId}`}>
              <ExternalLink className="size-4" aria-hidden="true" />
              <span>صفحه عمومی</span>
            </Link>
          </Button>
        </div>
      </div>

      {saveError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>ذخیره تغییرات انجام نشد</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}

      {imageError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>عملیات تصویر انجام نشد</AlertTitle>
          <AlertDescription>{imageError}</AlertDescription>
        </Alert>
      ) : null}

      {showErrors && validationErrors.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>چند مورد نیاز به اصلاح دارد</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc space-y-1">
              {validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <FormSection
        eyebrow="مشخصات"
        title="اطلاعات اصلی"
        description="عنوان، شهر، دسته‌بندی و توضیحاتی که مهمان در صفحه اقامتگاه می‌بیند."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="edit-title" className="text-xs font-bold text-ink">
              عنوان اقامتگاه
            </label>
            <Input
              id="edit-title"
              value={form.title}
              onChange={(event) => setField("title", event.target.value)}
              className="h-11 border-line bg-paper-card"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-city" className="text-xs font-bold text-ink">
              شهر
            </label>
            <CityCombobox
              id="edit-city"
              cities={cities}
              value={form.city_id}
              onChange={(cityId) => setField("city_id", cityId)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-category" className="text-xs font-bold text-ink">
              دسته‌بندی
            </label>
            <select
              id="edit-category"
              value={form.category_id || ""}
              onChange={(event) =>
                setField(
                  "category_id",
                  event.target.value ? Number(event.target.value) : 0
                )
              }
              className="h-11 w-full rounded-xl border border-line bg-paper-card px-3 text-sm text-ink outline-none transition-colors focus:border-brick focus:ring-2 focus:ring-brick/20"
            >
              <option value="">دسته‌بندی را انتخاب کنید</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="edit-address" className="text-xs font-bold text-ink">
              آدرس
            </label>
            <Input
              id="edit-address"
              value={form.address}
              onChange={(event) => setField("address", event.target.value)}
              className="h-11 border-line bg-paper-card"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="edit-description" className="text-xs font-bold text-ink">
              توضیحات
            </label>
            <Textarea
              id="edit-description"
              value={form.description}
              onChange={(event) => setField("description", event.target.value)}
              className="min-h-28 border-line bg-paper-card"
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        eyebrow="تصاویر"
        title="گالری اقامتگاه"
        description="تصاویر را اضافه یا حذف کنید و با دکمهٔ «تعیین به عنوان کاور» هر تصویر موجود را کاور کنید."
      >
        <ImageUploader
          images={images}
          onAdd={handleAddImage}
          onRemove={handleDeleteImage}
          onSetCover={handleSetCover}
          emptyText="هنوز تصویری برای این اقامتگاه ثبت نشده است."
        />
      </FormSection>

      <FormSection
        eyebrow="ظرفیت"
        title="ظرفیت و چیدمان"
        description="تعداد مهمان، اتاق و تخت را به‌روز نگه دارید."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberStepper
            label="ظرفیت پایه (مهمان)"
            value={form.capacity}
            onChange={(value) => setField("capacity", value)}
            min={1}
            max={200}
            hint="بدون هزینه مهمان اضافه"
          />
          <NumberStepper
            label="حداکثر ظرفیت (مهمان)"
            value={form.max_capacity}
            onChange={(value) => setField("max_capacity", value)}
            min={form.capacity}
            max={200}
            hint="با هزینه مهمان اضافه"
          />
          <NumberStepper
            label="تعداد اتاق"
            value={form.rooms_count}
            onChange={(value) => setField("rooms_count", value)}
            min={0}
            max={30}
          />
          <NumberStepper
            label="تعداد تخت"
            value={form.beds_count}
            onChange={(value) => setField("beds_count", value)}
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
        eyebrow="قیمت و زمان"
        title="نرخ پایه و ساعت تحویل"
        description="مبالغ به تومان است. نرخ پایه مبنای محاسبه شب‌های اقامت است؛ برای آخر هفته، تعطیلات یا هر روز دلخواه نرخ متفاوت بگذارید."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="edit-base-price" className="text-xs font-bold text-ink">
              نرخ پایه هر شب (تومان)
            </label>
            <PersianNumberInput
              id="edit-base-price"
              min={0}
              value={form.base_price}
              onValueChange={(value) => setField("base_price", value ?? 0)}
              className="h-11 border-line bg-paper-card tabular-nums"
            />
            <Link
              href={`/host/listings/${listingId}/calendar`}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-brick hover:underline"
            >
              <CalendarDays className="size-3.5" aria-hidden="true" />
              نرخ روزانه، آخر هفته و تعطیلات
            </Link>
          </div>
          <div className="space-y-2">
            <label htmlFor="edit-cleaning-fee" className="text-xs font-bold text-ink">
              هزینه نظافت (تومان)
            </label>
            <PersianNumberInput
              id="edit-cleaning-fee"
              min={0}
              value={form.cleaning_fee}
              onValueChange={(value) => setField("cleaning_fee", value ?? 0)}
              className="h-11 border-line bg-paper-card tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="edit-min-nights" className="text-xs font-bold text-ink">
              حداقل اقامت (شب)
            </label>
            <PersianNumberInput
              id="edit-min-nights"
              min={1}
              value={form.min_nights}
              emptyValue={1}
              onValueChange={(value) => setField("min_nights", value || 1)}
              className="h-11 border-line bg-paper-card tabular-nums"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="edit-check-in" className="text-xs font-bold text-ink">
                ساعت ورود
              </label>
              <PersianTimeInput
                id="edit-check-in"
                value={form.check_in_time}
                onValueChange={(value) => setField("check_in_time", value)}
                className="h-11 border-line bg-paper-card text-left tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-check-out" className="text-xs font-bold text-ink">
                ساعت خروج
              </label>
              <PersianTimeInput
                id="edit-check-out"
                value={form.check_out_time}
                onValueChange={(value) => setField("check_out_time", value)}
                className="h-11 border-line bg-paper-card text-left tabular-nums"
              />
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection
        eyebrow="امکانات"
        title="امکانات اقامتگاه"
        description="هر تغییری در این بخش پس از ذخیره روی صفحه عمومی اعمال می‌شود."
      >
        <AmenityPicker
          amenities={amenities}
          selectedIds={form.amenity_ids}
          onToggle={(amenityId) =>
            setField(
              "amenity_ids",
              form.amenity_ids.includes(amenityId)
                ? form.amenity_ids.filter((id) => id !== amenityId)
                : [...form.amenity_ids, amenityId]
            )
          }
          customAmenities={form.custom_amenities}
          onAddCustom={(name) =>
            setField("custom_amenities", [...form.custom_amenities, name])
          }
          onRemoveCustom={(name) =>
            setField(
              "custom_amenities",
              form.custom_amenities.filter((item) => item !== name)
            )
          }
        />
      </FormSection>

      <FormSection
        eyebrow="قوانین"
        title="سیاست لغو و مقررات"
        description="این متن‌ها در صفحه اقامتگاه و پیش از نهایی‌کردن رزرو به مهمان نشان داده می‌شوند."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-bold text-ink">سیاست لغو رزرو</span>
            <PolicySelector
              value={form.cancellation_policy}
              onChange={setPolicy}
              freeHours={form.cancellation_free_hours}
              penaltyPercent={form.cancellation_penalty_percent}
              onFreeHoursChange={(value) =>
                setField("cancellation_free_hours", value)
              }
              onPenaltyPercentChange={(value) =>
                setField("cancellation_penalty_percent", value)
              }
            />
            <p className="text-[11px] text-ink-soft">
              {POLICY_OPTIONS.find((option) => option.value === form.cancellation_policy)?.hint}
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="edit-rules" className="text-xs font-bold text-ink">
              قوانین اقامتگاه
            </label>
            <Textarea
              id="edit-rules"
              value={form.rules}
              onChange={(event) => setField("rules", event.target.value)}
              placeholder="مثلاً ورود حیوان خانگی ممنوع است…"
              className="min-h-28 border-line bg-paper-card"
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        eyebrow="انتشار و همگام‌سازی"
        title="وضعیت و تقویم خارجی"
        description="وضعیت انتشار را کنترل کنید و در صورت نیاز تقویم iCal بیرونی را وصل کنید."
      >
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-paper-card p-3.5">
            <Checkbox
              checked={form.is_active}
              onCheckedChange={(checked) => setField("is_active", checked === true)}
              className="mt-0.5"
            />
            <span className="space-y-1">
              <span className="block text-sm font-bold text-ink">
                اقامتگاه فعال و قابل رزرو باشد
              </span>
              <span className="block text-[11px] leading-5 text-ink-soft">
                با غیرفعال‌کردن، اقامتگاه از نتایج جستجو خارج می‌شود اما سابقه
                رزروها حفظ می‌شود.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <label htmlFor="edit-ical-url" className="text-xs font-bold text-ink">
              آدرس تقویم iCal بیرونی (اختیاری)
            </label>
            <Input
              id="edit-ical-url"
              value={form.external_calendar_url}
              onChange={(event) => setField("external_calendar_url", event.target.value)}
              placeholder="https://…/calendar.ics"
              dir="ltr"
              className="h-11 border-line bg-paper-card text-left"
            />
            <p className="text-[11px] leading-5 text-ink-soft">
              فقط آدرس‌های عمومی HTTP/HTTPS پشتیبانی می‌شوند. همگام‌سازی، روزهای
              مسدود در تقویم بیرونی را در تقویم اقامتگاه علامت می‌زند.
            </p>
            {data.last_calendar_sync_at ? (
              <p className="flex items-center gap-1.5 text-[11px] text-trust">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                آخرین همگام‌سازی: {formatPersianDate(data.last_calendar_sync_at)}
              </p>
            ) : null}
          </div>
        </div>
      </FormSection>

      <div className="sticky bottom-4 z-20 rounded-2xl border border-line bg-paper/95 p-3 shadow-dock backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] leading-5 text-ink-soft">
            {canSave
              ? "همه فیلدها معتبرند. تغییرات با ذخیره‌سازی روی سرور اعمال می‌شود."
              : "برای ذخیره، موارد مشخص‌شده را اصلاح کنید."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-line bg-transparent">
              <Link href="/host/listings">انصراف</Link>
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2 font-bold"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              <span>{isSaving ? "در حال ذخیره…" : "ذخیره تغییرات"}</span>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={savedOpen} onOpenChange={setSavedOpen}>
        <DialogContent dir="rtl" className="text-center sm:max-w-md">
          <DialogHeader className="items-center">
            <span className="grid size-16 place-items-center rounded-b-3xl rounded-t-full bg-trust/10 text-trust">
              <CheckCircle2 className="size-8" aria-hidden="true" />
            </span>
            <DialogTitle>تغییرات ذخیره شد</DialogTitle>
            <DialogDescription className="leading-7">
              اطلاعات اقامتگاه با موفقیت به‌روزرسانی شد. می‌توانید پیش‌نمایش میزبان را
              ببینید یا به فهرست اقامتگاه‌ها برگردید.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button asChild className="w-full gap-2">
              <Link href={`/host/listings/${listingId}/preview`}>
                <Eye className="size-4" aria-hidden="true" />
                <span>پیش‌نمایش میزبان</span>
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSavedOpen(false)}
              className="w-full border-line bg-transparent"
            >
              ادامه ویرایش
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/host/listings">بازگشت به اقامتگاه‌های من</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function EditListingPage({ params }: EditListingPageProps) {
  const resolvedParams = React.use(params)
  const listingId = Number(resolvedParams.id)
  const isInvalidId =
    !listingId || Number.isNaN(listingId) || !Number.isInteger(listingId) || listingId <= 0

  return (
    <HostPageLayout
      eyebrow="میزبانی"
      title="ویرایش اقامتگاه"
      description="مشخصات، تصاویر، ظرفیت، قیمت و وضعیت انتشار اقامتگاه را به‌روزرسانی کنید."
      backHref="/host/listings"
      backLabel="بازگشت به اقامتگاه‌های من"
      contentClassName="max-w-5xl"
    >
      {isInvalidId ? (
        <EmptyState
          icon={Building2}
          title="اقامتگاه مورد نظر پیدا نشد"
          description="شناسه اقامتگاه معتبر نیست. از فهرست اقامتگاه‌ها یک مورد را انتخاب کنید."
          action={
            <Button asChild>
              <Link href="/host/listings">فهرست اقامتگاه‌ها</Link>
            </Button>
          }
        />
      ) : (
        <HostAccessGate
          title="ویرایش اقامتگاه"
          description="برای ویرایش اقامتگاه، وارد حساب میزبان خود شوید."
        >
          <EditListingContent listingId={listingId} />
        </HostAccessGate>
      )}
    </HostPageLayout>
  )
}
