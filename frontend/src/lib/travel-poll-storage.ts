import type { DatePollOption } from "@/types/wishlist"

// Storage keys for the device-local travel-date poll. The legacy `jabama_*`
// key is migrated (and removed) on load; do not rename these.
export const STORAGE_KEY = "ashianak_travel_date_poll"
export const LEGACY_STORAGE_KEY = "jabama_travel_date_poll"
// Roster + proxy votes live only on this device (no backend poll exists).
export const COMPANIONS_STORAGE_KEY = "ashianak_travel_poll_companions"
export const MAX_COMPANIONS = 8

export interface PollCompanion {
  id: string
  name: string
  // The option this companion is voting for, or null for no proxy vote.
  optionId: string | null
}

export function todayIsoDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// An option is offerable only while its check-in is still in the future.
export function isFutureCheckIn(checkIn: string): boolean {
  return checkIn > todayIsoDate()
}

export function isValidStoredPollOption(entry: unknown): entry is DatePollOption {
  if (typeof entry !== "object" || entry === null) return false
  const opt = entry as Record<string, unknown>
  return (
    typeof opt.id === "string" &&
    opt.id.length > 0 &&
    typeof opt.title === "string" &&
    opt.title.length > 0 &&
    typeof opt.votes === "number" &&
    Number.isFinite(opt.votes) &&
    opt.votes >= 0 &&
    typeof opt.voted === "boolean" &&
    (opt.voters === undefined ||
      (Array.isArray(opt.voters) && opt.voters.every((voter) => typeof voter === "string"))) &&
    typeof opt.check_in === "string" &&
    opt.check_in.length > 0 &&
    !isNaN(Date.parse(opt.check_in)) &&
    typeof opt.check_out === "string" &&
    opt.check_out.length > 0 &&
    !isNaN(Date.parse(opt.check_out)) &&
    opt.check_out > opt.check_in
  )
}

export function normalizeCompanionName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

// Deterministic id generation keeps render/handler code pure (no Date.now)
// while still avoiding collisions with ids loaded from storage.
export function uniqueId(prefix: string, existingIds: string[]): string {
  let index = existingIds.length + 1
  let id = `${prefix}_${index}`
  while (existingIds.includes(id)) {
    index += 1
    id = `${prefix}_${index}`
  }
  return id
}

// Old storage may contain arbitrary/invalid companion entries. Keep only
// usable names, enforce the limit, dedupe, and drop votes for removed options.
export function sanitizeCompanions(entries: unknown, optionIds: Set<string>): PollCompanion[] {
  if (!Array.isArray(entries)) return []

  const companions: PollCompanion[] = []
  const seenNames = new Set<string>()

  entries.forEach((entry) => {
    if (companions.length >= MAX_COMPANIONS) return
    if (typeof entry !== "object" || entry === null) return
    const raw = entry as Record<string, unknown>
    const name = typeof raw.name === "string" ? normalizeCompanionName(raw.name) : ""
    if (!name) return

    const nameKey = name.toLocaleLowerCase()
    if (seenNames.has(nameKey)) return
    seenNames.add(nameKey)

    const optionId =
      typeof raw.optionId === "string" && optionIds.has(raw.optionId) ? raw.optionId : null

    const baseId =
      typeof raw.id === "string" && raw.id.length > 0
        ? raw.id
        : uniqueId(
            "comp",
            companions.map((companion) => companion.id),
          )
    const id = companions.some((companion) => companion.id === baseId)
      ? uniqueId(
          "comp",
          companions.map((companion) => companion.id),
        )
      : baseId

    companions.push({ id, name, optionId })
  })

  return companions
}

// Persist derived vote totals so the stored shape stays backwards compatible.
export function serializeOptions(
  options: DatePollOption[],
  companions: PollCompanion[],
): DatePollOption[] {
  return options.map((option) => {
    const companionVoters = companions.filter((companion) => companion.optionId === option.id)
    return {
      ...option,
      votes: (option.voted ? 1 : 0) + companionVoters.length,
      voters: [
        ...(option.voted ? ["شما"] : []),
        ...companionVoters.map((companion) => companion.name),
      ],
    }
  })
}

export function writeStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage may be unavailable or full; the in-memory poll still works.
  }
}

// Load and migrate the persisted poll state, falling back to the seeded
// options when storage is empty, corrupt, or all dates have passed. Writing
// the loaded state back to storage is the caller's responsibility.
export function loadPollState(seedOptions: DatePollOption[]): {
  options: DatePollOption[]
  companions: PollCompanion[]
} {
  let loadedOptions: DatePollOption[] = seedOptions.filter((opt) => isFutureCheckIn(opt.check_in))
  let migratedFromLegacy = false

  try {
    const currentStored = localStorage.getItem(STORAGE_KEY)
    const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY)
    const stored = currentStored ?? legacyStored
    migratedFromLegacy = currentStored === null && legacyStored !== null

    if (stored) {
      const parsed = JSON.parse(stored) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        const upcoming = parsed
          .filter(isValidStoredPollOption)
          .filter((opt) => isFutureCheckIn(opt.check_in))

        if (upcoming.length > 0) {
          // Old stored `voters` names are intentionally ignored: the
          // hardcoded fake voters are replaced by the local roster.
          // Keep only the first user vote for single-vote semantics.
          const firstVotedIndex = upcoming.findIndex((opt) => opt.voted)
          loadedOptions = upcoming.map((opt, index) => ({
            ...opt,
            voted: index === firstVotedIndex,
            votes: 0,
            voters: [],
          }))
        }
      }
    }
  } catch {
    // Fall back to the initial options.
  }

  if (migratedFromLegacy) {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // Ignore storage failures.
    }
  }

  let loadedCompanions: PollCompanion[] = []
  try {
    const storedCompanions = localStorage.getItem(COMPANIONS_STORAGE_KEY)
    if (storedCompanions) {
      loadedCompanions = sanitizeCompanions(
        JSON.parse(storedCompanions),
        new Set(loadedOptions.map((option) => option.id)),
      )
    }
  } catch {
    // A corrupt roster is ignored rather than breaking the poll.
  }

  return { options: loadedOptions, companions: loadedCompanions }
}
