export interface LocalDateTimeParts {
  dateKey: string;
  hour: number;
  minute: number;
  totalMinutes: number;
}

export interface EmailScheduleClock {
  timezone?: string;
  tzOffset?: number;
  reason: "iana_timezone" | "tz_offset_fallback" | "timezone_missing_default_applied";
}

const DEFAULT_TZ_OFFSET_MINUTES = 300; // America/New_York standard offset fallback.

export function normalizeTimezone(timezone: unknown): string | undefined {
  if (typeof timezone !== "string") return undefined;
  const trimmed = timezone.trim();
  if (!trimmed || /^[A-Z]{2,4}$/.test(trimmed)) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return undefined;
  }
}

/** Normalize to Date.getTimezoneOffset()-style minutes (positive west of UTC). */
export function normalizeTzOffsetMinutes(offset: unknown): number {
  if (typeof offset !== "number" || !Number.isFinite(offset)) return DEFAULT_TZ_OFFSET_MINUTES;
  // Older US backups accidentally stored ISO-style negatives (e.g. -480 for Pacific).
  if (offset < 0) return -offset;
  return offset;
}

export function resolveEmailScheduleClock(input: {
  timezone?: unknown;
  tzOffset?: unknown;
}): EmailScheduleClock {
  const timezone = normalizeTimezone(input.timezone);
  if (timezone) return { timezone, reason: "iana_timezone" };
  if (typeof input.tzOffset === "number" && Number.isFinite(input.tzOffset)) {
    return { tzOffset: normalizeTzOffsetMinutes(input.tzOffset), reason: "tz_offset_fallback" };
  }
  return { tzOffset: DEFAULT_TZ_OFFSET_MINUTES, reason: "timezone_missing_default_applied" };
}

export function localDateTimeForTimezone(timezone: string, nowMs = Date.now()): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(nowMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return {
    dateKey: `${year}-${month}-${day}`,
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
  };
}

export function localDateTimeForTzOffset(tzOffset: number, nowMs = Date.now()): LocalDateTimeParts {
  const offset = normalizeTzOffsetMinutes(tzOffset);
  const local = new Date(nowMs - offset * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();
  const hour = local.getUTCHours();
  const minute = local.getUTCMinutes();
  return {
    dateKey: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
  };
}

export function localDateTimeForScheduleClock(
  clock: EmailScheduleClock,
  nowMs = Date.now(),
): LocalDateTimeParts {
  if (clock.timezone) return localDateTimeForTimezone(clock.timezone, nowMs);
  return localDateTimeForTzOffset(clock.tzOffset ?? DEFAULT_TZ_OFFSET_MINUTES, nowMs);
}

