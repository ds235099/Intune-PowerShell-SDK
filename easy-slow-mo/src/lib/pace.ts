/** Local pace math. Each running hour releases 2% of the allowance. */

export const HOUR_MS = 60 * 60 * 1000;
export const RELEASE_RATE = 0.02;
export const FULL_ALLOWANCE_HOURS = 50;
export const HISTORY_LIMIT = 48;
export const SCHEDULE_PREVIEW = 8;
export const MAX_CATCHUP_HOURS = 24 * 14;
export const MAX_ALLOWANCE = 1_000_000_000_000;
export const MAX_TITLE = 140;

export type WorkItem = {
  id: string;
  title: string;
  cost: number;
  createdAt: number;
  doneAt: number | null;
};

export type ReleaseReason = "start" | "hourly" | "catchup";

export type ReleaseRecord = {
  id: string;
  at: number;
  amount: number;
  hours: number;
  allowance: number;
  reason: ReleaseReason;
};

export type PaceState = {
  allowance: number;
  pacing: boolean;
  nextReleaseAt: number | null;
  pausedRemainingMs: number | null;
  balance: number;
  thisHour: number;
  spentThisHour: number;
  items: WorkItem[];
  history: ReleaseRecord[];
};

export function initialState(): PaceState {
  return {
    allowance: 0,
    pacing: false,
    nextReleaseAt: null,
    pausedRemainingMs: null,
    balance: 0,
    thisHour: 0,
    spentThisHour: 0,
    items: [],
    history: [],
  };
}

export function roundUnits(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function sliceAmount(allowance: number): number {
  if (!Number.isFinite(allowance) || allowance <= 0) return 0;
  return roundUnits(allowance * RELEASE_RATE);
}

export function queuedPortion(allowance: number): number {
  if (!Number.isFinite(allowance) || allowance <= 0) return 0;
  return roundUnits(allowance - sliceAmount(allowance));
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function availableThisHour(state: PaceState): number {
  return roundUnits(Math.max(0, state.thisHour - state.spentThisHour));
}

export function bankedUnits(state: PaceState): number {
  return roundUnits(Math.max(0, state.balance - availableThisHour(state)));
}

export function remainingMs(state: PaceState, now: number): number {
  if (state.pacing && state.nextReleaseAt != null) {
    return Math.max(0, state.nextReleaseAt - now);
  }
  if (state.pausedRemainingMs != null) {
    return Math.max(0, state.pausedRemainingMs);
  }
  return HOUR_MS;
}

function withRelease(
  state: PaceState,
  at: number,
  hours: number,
  reason: ReleaseReason,
): PaceState {
  const slice = sliceAmount(state.allowance);
  const amount = roundUnits(slice * hours);
  const record: ReleaseRecord = {
    id: newId(),
    at,
    amount,
    hours,
    allowance: state.allowance,
    reason,
  };
  return {
    ...state,
    balance: roundUnits(state.balance + amount),
    thisHour: slice,
    spentThisHour: 0,
    history: [record, ...state.history].slice(0, HISTORY_LIMIT),
  };
}

export function setAllowance(state: PaceState, allowance: number): PaceState {
  const clean = roundUnits(
    Math.min(MAX_ALLOWANCE, Math.max(0, allowance)),
  );
  return { ...state, allowance: clean };
}

export function startOrResume(state: PaceState, now: number): PaceState {
  if (state.pacing) return state;
  if (state.nextReleaseAt == null) {
    const started = withRelease(state, now, 1, "start");
    return {
      ...started,
      pacing: true,
      pausedRemainingMs: null,
      nextReleaseAt: now + HOUR_MS,
    };
  }
  const remaining =
    state.pausedRemainingMs != null && state.pausedRemainingMs > 0
      ? state.pausedRemainingMs
      : HOUR_MS;
  return {
    ...state,
    pacing: true,
    pausedRemainingMs: null,
    nextReleaseAt: now + remaining,
  };
}

export function pause(state: PaceState, now: number): PaceState {
  const current = catchUp(state, now);
  if (!current.pacing || current.nextReleaseAt == null) return current;
  return {
    ...current,
    pacing: false,
    pausedRemainingMs: Math.max(0, current.nextReleaseAt - now),
  };
}

export function catchUp(state: PaceState, now: number): PaceState {
  if (!state.pacing || state.nextReleaseAt == null) return state;
  if (now < state.nextReleaseAt) return state;

  let next = state.nextReleaseAt;
  let hours = 0;
  while (next <= now && hours < MAX_CATCHUP_HOURS) {
    next += HOUR_MS;
    hours += 1;
  }
  if (hours === 0) return state;
  if (next <= now) next = now + HOUR_MS;

  const released = withRelease(
    state,
    now,
    hours,
    hours === 1 ? "hourly" : "catchup",
  );
  return { ...released, nextReleaseAt: next };
}

export function addItem(
  state: PaceState,
  title: string,
  cost: number,
  now: number,
): PaceState {
  const trimmed = title.trim().slice(0, MAX_TITLE);
  const costRounded = roundUnits(cost);
  if (!trimmed || costRounded <= 0) return state;
  const item: WorkItem = {
    id: newId(),
    title: trimmed,
    cost: costRounded,
    createdAt: now,
    doneAt: null,
  };
  return { ...state, items: [...state.items, item] };
}

export function removeItem(state: PaceState, id: string): PaceState {
  if (!state.items.some((item) => item.id === id)) return state;
  return { ...state, items: state.items.filter((item) => item.id !== id) };
}

export function completeItem(
  state: PaceState,
  id: string,
  now: number,
): PaceState {
  const item = state.items.find((entry) => entry.id === id);
  if (!item || item.doneAt != null) return state;
  if (item.cost > state.balance) return state;
  const fromThisHour = Math.min(availableThisHour(state), item.cost);
  return {
    ...state,
    balance: roundUnits(state.balance - item.cost),
    spentThisHour: roundUnits(state.spentThisHour + fromThisHour),
    items: state.items.map((entry) =>
      entry.id === id ? { ...entry, doneAt: now } : entry,
    ),
  };
}

export function restoreItem(state: PaceState, id: string): PaceState {
  const item = state.items.find((entry) => entry.id === id);
  if (!item || item.doneAt == null) return state;
  const backToHour = Math.min(state.spentThisHour, item.cost);
  return {
    ...state,
    balance: roundUnits(state.balance + item.cost),
    spentThisHour: roundUnits(state.spentThisHour - backToHour),
    items: state.items.map((entry) =>
      entry.id === id ? { ...entry, doneAt: null } : entry,
    ),
  };
}

export type ItemOutlook = {
  fitsNow: boolean;
  fitsOnStart: boolean;
  overBudget: boolean;
  exceedsAllowance: boolean;
  blockedByZero: boolean;
  shortfall: number;
  slicesNeeded: number;
  unlocksAt: number | null;
};

export function itemOutlook(state: PaceState, item: WorkItem): ItemOutlook {
  const slice = sliceAmount(state.allowance);
  const notStarted = state.nextReleaseAt == null;
  const shortfall = roundUnits(Math.max(0, item.cost - state.balance));
  const fitsNow = item.doneAt == null && item.cost <= state.balance;
  const fitsOnStart =
    item.doneAt == null &&
    !fitsNow &&
    notStarted &&
    slice > 0 &&
    item.cost <= slice;
  const overBudget = item.doneAt == null && !fitsNow && !fitsOnStart;
  const exceedsAllowance =
    state.allowance > 0 && item.cost > roundUnits(state.allowance);
  const blockedByZero = overBudget && slice <= 0;

  let slicesNeeded = 0;
  let unlocksAt: number | null = null;
  if ((overBudget || fitsOnStart) && slice > 0 && shortfall > 0) {
    slicesNeeded = Math.ceil(shortfall / slice - 1e-9);
    if (state.pacing && state.nextReleaseAt != null && overBudget) {
      unlocksAt = state.nextReleaseAt + (slicesNeeded - 1) * HOUR_MS;
    }
  }

  return {
    fitsNow,
    fitsOnStart,
    overBudget,
    exceedsAllowance,
    blockedByZero,
    shortfall,
    slicesNeeded,
    unlocksAt,
  };
}

export type SlicePreview = {
  index: number;
  at: number | null;
  amount: number;
  balanceAfter: number;
};

export function upcomingSlices(
  state: PaceState,
  count = SCHEDULE_PREVIEW,
): SlicePreview[] {
  const slice = sliceAmount(state.allowance);
  const previews: SlicePreview[] = [];
  let balance = state.balance;
  for (let index = 1; index <= count; index += 1) {
    balance = roundUnits(balance + slice);
    const at =
      state.pacing && state.nextReleaseAt != null
        ? state.nextReleaseAt + (index - 1) * HOUR_MS
        : null;
    previews.push({ index, at, amount: slice, balanceAfter: balance });
  }
  return previews;
}

export function hoursUntilAllowanceCovered(state: PaceState): number | null {
  const slice = sliceAmount(state.allowance);
  if (state.allowance <= 0 || slice <= 0) return null;
  if (state.balance >= state.allowance) return 0;
  const shortfall = roundUnits(state.allowance - state.balance);
  return Math.ceil(shortfall / slice - 1e-9);
}

export function queuedItems(state: PaceState): WorkItem[] {
  return state.items.filter((item) => item.doneAt == null);
}

export function doneItems(state: PaceState): WorkItem[] {
  return state.items
    .filter((item) => item.doneAt != null)
    .slice()
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
}

export function queuedCost(state: PaceState): number {
  return roundUnits(
    queuedItems(state).reduce((sum, item) => sum + item.cost, 0),
  );
}

export function releaseLabel(record: ReleaseRecord): string {
  if (record.reason === "start") return "Pace started";
  if (record.reason === "catchup") {
    const capped = record.hours >= MAX_CATCHUP_HOURS ? " (cap)" : "";
    return `Caught up ${record.hours} hours${capped}`;
  }
  return "Hourly release";
}

export function hasStarted(state: PaceState): boolean {
  return state.nextReleaseAt != null || state.history.length > 0;
}
