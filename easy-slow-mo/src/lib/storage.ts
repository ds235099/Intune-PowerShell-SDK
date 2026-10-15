import {
  HISTORY_LIMIT,
  MAX_ALLOWANCE,
  MAX_TITLE,
  type PaceState,
  type ReleaseReason,
  type ReleaseRecord,
  type WorkItem,
  catchUp,
  initialState,
  roundUnits,
} from "./pace";

const KEY = "easy-slow-mo.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function nonNegative(value: unknown, max = Number.POSITIVE_INFINITY): number {
  const number = finiteNumber(value);
  if (number == null) return 0;
  return roundUnits(Math.min(max, Math.max(0, number)));
}

function timestamp(value: unknown): number | null {
  const number = finiteNumber(value);
  if (number == null || number <= 0) return null;
  return number;
}

function sanitizeItem(value: unknown): WorkItem | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.title !== "string") return null;
  const title = value.title.trim().slice(0, MAX_TITLE);
  const cost = nonNegative(value.cost);
  const createdAt = timestamp(value.createdAt);
  if (!title || cost <= 0 || createdAt == null) return null;
  const doneAt = value.doneAt == null ? null : timestamp(value.doneAt);
  return { id: value.id, title, cost, createdAt, doneAt };
}

function sanitizeRelease(value: unknown): ReleaseRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id) return null;
  const at = timestamp(value.at);
  const hours = finiteNumber(value.hours);
  if (at == null || hours == null || hours <= 0) return null;
  const reason: ReleaseReason =
    value.reason === "start" ||
    value.reason === "hourly" ||
    value.reason === "catchup"
      ? value.reason
      : "hourly";
  return {
    id: value.id,
    at,
    amount: nonNegative(value.amount),
    hours: Math.min(MAX_ALLOWANCE, Math.round(hours)),
    allowance: nonNegative(value.allowance, MAX_ALLOWANCE),
    reason,
  };
}

export function sanitize(value: unknown): PaceState {
  const base = initialState();
  if (!isRecord(value)) return base;

  const thisHour = nonNegative(value.thisHour);
  let spentThisHour = nonNegative(value.spentThisHour);
  if (spentThisHour > thisHour) spentThisHour = thisHour;

  const nextReleaseAt = timestamp(value.nextReleaseAt);
  const pacing = value.pacing === true && nextReleaseAt != null;

  const items = Array.isArray(value.items)
    ? value.items.flatMap((item) => {
        const clean = sanitizeItem(item);
        return clean ? [clean] : [];
      })
    : [];
  const history = Array.isArray(value.history)
    ? value.history.flatMap((record) => {
        const clean = sanitizeRelease(record);
        return clean ? [clean] : [];
      })
    : [];

  return {
    allowance: nonNegative(value.allowance, MAX_ALLOWANCE),
    pacing,
    nextReleaseAt,
    pausedRemainingMs: pacing
      ? null
      : timestamp(value.pausedRemainingMs) ??
        (finiteNumber(value.pausedRemainingMs) === 0 ? 0 : null),
    balance: nonNegative(value.balance),
    thisHour,
    spentThisHour,
    items,
    history: history.slice(0, HISTORY_LIMIT),
  };
}

export function loadState(now = Date.now()): PaceState {
  try {
    if (typeof localStorage === "undefined") return initialState();
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    return catchUp(sanitize(JSON.parse(raw) as unknown), now);
  } catch {
    return initialState();
  }
}

export function saveState(state: PaceState): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // A full or blocked store should not take the pace UI down.
  }
}

export function clearState(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(KEY);
  } catch {
    // Ignore storage failures; the in-memory state is still reset.
  }
}
