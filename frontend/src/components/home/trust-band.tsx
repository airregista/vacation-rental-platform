import {
  BadgeCheck,
  CreditCard,
  Headphones,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

const PILLARS: { title: string; description: string; Icon: LucideIcon }[] = [
  {
    title: "ضمانت تحویل اقامتگاه",
    description: "اگر خانه با آگهی نخواند، جایگزین یا بازگشت کامل وجه.",
    Icon: ShieldCheck,
  },
  {
    title: "میزبان تأییدشده",
    description: "هویت، سند و کیفیت هر اقامتگاه پیش از انتشار بررسی می‌شود.",
    Icon: BadgeCheck,
  },
  {
    title: "پشتیبانی ۲۴ ساعته",
    description: "از لحظهٔ رزرو تا پایان سفر، یک نفر پاسخگوی شماست.",
    Icon: Headphones,
  },
  {
    title: "پرداخت امن",
    description: "پرداخت درگاه بانکی و نگه‌داری وجه تا ورود شما به اقامتگاه.",
    Icon: CreditCard,
  },
]

const STATS = [
  { value: "۱٬۲۰۰+", label: "اقامتگاه دست‌چین‌شده" },
  { value: "۳۱", label: "استان" },
  { value: "۴٫۹", label: "امتیاز مهمانان" },
]

export function TrustBand() {
  return (
    <section
      aria-labelledby="trust-title"
      className="relative isolate overflow-hidden bg-trust-deep text-night-foreground"
    >
      <div
        aria-hidden="true"
        className="paper-grain pointer-events-none absolute inset-0 opacity-40"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 420 420"
        fill="none"
        className="pointer-events-none absolute -left-24 -top-16 h-[420px] w-[420px] text-night-foreground/10 sm:-left-10"
      >
        <path
          d="M20 420V190a95 95 0 0 1 190 0v230"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M70 420V200a70 70 0 0 1 140 0v220"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M120 420V215a45 45 0 0 1 90 0v205"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>

      <div className="relative mx-auto grid w-full max-w-[1360px] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-20">
        <div className="lg:col-span-5">
          <p className="flex items-center gap-3 text-xs font-bold tracking-[0.18em] text-night-foreground/60">
            <span aria-hidden="true" className="h-px w-8 bg-night-foreground/40" />
            اعتماد و امنیت
          </p>
          <h2
            id="trust-title"
            className="mt-4 text-balance text-3xl font-black tracking-tight sm:text-display"
          >
            با خیال راحت برسید؛
            <br />
            بقیه‌اش با ما.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-8 text-night-foreground/70">
            رزرو یک خانه فقط انتخاب عکس نیست؛ به معنای سپردن چند روز از زندگی به
            یک میزبان است. ما این اعتماد را با بررسی، ضمانت و پشتیبانی نگه
            می‌داریم.
          </p>

          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-night-foreground/15 pt-6">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="block text-2xl font-black text-night-foreground sm:text-3xl">
                    {stat.value}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-night-foreground/60">
                    {stat.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:col-span-7">
          {PILLARS.map(({ title, description, Icon }) => (
            <div key={title} className="border-t border-night-foreground/15 pt-5">
              <div className="flex items-center gap-2.5">
                <Icon className="size-4 shrink-0 text-gold" aria-hidden="true" />
                <h3 className="text-sm font-bold text-night-foreground">{title}</h3>
              </div>
              <p className="mt-2 text-xs leading-6 text-night-foreground/60">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
