import { Mail, Users } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/shared/empty-state"
import type { AdminUser } from "@/components/admin/types"
import { AdminStatusBadge } from "@/components/admin/status-badge"
import {
  ROLE_LABELS,
  formatCount,
  roleTone,
  userDisplayName,
  userInitials,
} from "@/components/admin/admin-utils"
import { formatPersianDate, toPersianDigits } from "@/lib/format-fa"

export function UsersPanel({ users }: { users: AdminUser[] }) {
  return (
    <section aria-labelledby="admin-users-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="admin-users-title" className="text-lg font-black tracking-tight text-ink">
            کاربران
          </h2>
          <p className="mt-1 text-xs leading-6 text-ink-soft">
            فهرست حساب‌های ثبت‌شده؛ نقش، راه تماس و تاریخ عضویت.
          </p>
        </div>
        <AdminStatusBadge tone="neutral">
          <Users className="size-3.5" />
          {formatCount(users.length)} کاربر
        </AdminStatusBadge>
      </div>

      {users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong/70 bg-paper-card/60 px-4">
          <EmptyState
            icon={Users}
            title="هنوز کاربری ثبت نشده"
            description="با اولین ورود مهمان یا میزبان، حساب او در این فهرست نمایش داده می‌شود."
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-paper-card shadow-soft md:block">
            <table className="w-full text-right text-sm">
              <thead className="bg-paper-deep/55">
                <tr className="text-[11px] text-ink-soft">
                  <th scope="col" className="px-4 py-3 font-bold">
                    کاربر
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    راه تماس
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    نقش
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    عضویت
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-line/60 transition-colors hover:bg-paper-deep/25"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 border border-line">
                          {user.avatar_url ? (
                            <AvatarImage src={user.avatar_url} alt={userDisplayName(user)} />
                          ) : null}
                          <AvatarFallback className="bg-brick/10 text-[11px] font-bold text-brick">
                            {userInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-ink">{userDisplayName(user)}</p>
                          <p className="mt-0.5 text-[11px] text-ink-soft">
                            شناسهٔ {formatCount(user.id)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="w-fit text-xs font-semibold tabular-nums text-ink">
                        {toPersianDigits(user.phone)}
                      </p>
                      {user.email ? (
                        <p
                          dir="ltr"
                          className="mt-1 flex w-fit items-center gap-1 text-[11px] text-ink-soft"
                        >
                          <Mail className="size-3" />
                          {user.email}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <AdminStatusBadge tone={roleTone(user.role)}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </AdminStatusBadge>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">
                      {formatPersianDate(user.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {users.map((user) => (
              <div
                key={user.id}
                className="rounded-2xl border border-line bg-paper-card p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10 border border-line">
                      {user.avatar_url ? (
                        <AvatarImage src={user.avatar_url} alt={userDisplayName(user)} />
                      ) : null}
                      <AvatarFallback className="bg-brick/10 text-xs font-bold text-brick">
                        {userInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold text-ink">{userDisplayName(user)}</p>
                      <p className="mt-0.5 text-[11px] text-ink-soft">
                        عضویت: {formatPersianDate(user.created_at)}
                      </p>
                    </div>
                  </div>
                  <AdminStatusBadge tone={roleTone(user.role)}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </AdminStatusBadge>
                </div>
                <div className="mt-3 space-y-1 border-t border-line/60 pt-3 text-xs">
                  <p className="w-fit font-semibold tabular-nums text-ink">
                    {toPersianDigits(user.phone)}
                  </p>
                  {user.email ? (
                    <p dir="ltr" className="w-fit text-ink-soft">
                      {user.email}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
