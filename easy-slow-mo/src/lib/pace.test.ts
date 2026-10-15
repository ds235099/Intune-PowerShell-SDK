import { describe, expect, it } from "vitest";
import { formatCountdown, formatUnits } from "./format";
import {
  HOUR_MS,
  RELEASE_RATE,
  addItem,
  availableThisHour,
  bankedUnits,
  catchUp,
  completeItem,
  hoursUntilAllowanceCovered,
  initialState,
  itemOutlook,
  pause,
  queuedPortion,
  releaseLabel,
  removeItem,
  restoreItem,
  setAllowance,
  sliceAmount,
  startOrResume,
  upcomingSlices,
} from "./pace";
import { parseUnits } from "./parse";
import { sanitize } from "./storage";

function ready(allowance = 1000, now = 0) {
  return startOrResume(setAllowance(initialState(), allowance), now);
}

describe("slice math", () => {
  it("releases exactly 2% of the allowance", () => {
    expect(RELEASE_RATE).toBe(0.02);
    expect(sliceAmount(1000)).toBe(20);
    expect(sliceAmount(1000) / 1000).toBe(0.02);
    expect(queuedPortion(1000)).toBe(980);
    expect(sliceAmount(0)).toBe(0);
    expect(sliceAmount(-5)).toBe(0);
  });

  it("keeps fractional allowances precise", () => {
    expect(sliceAmount(1)).toBe(0.02);
    expect(formatUnits(sliceAmount(1))).toBe("0.02");
    expect(formatUnits(1000)).toBe("1,000");
    expect(formatUnits(20)).toBe("20");
  });
});

describe("pace lifecycle", () => {
  it("makes only the 2% slice available when the pace starts", () => {
    const state = ready(1000, 5_000);
    expect(state.pacing).toBe(true);
    expect(state.thisHour).toBe(20);
    expect(state.balance).toBe(20);
    expect(availableThisHour(state)).toBe(20);
    expect(bankedUnits(state)).toBe(0);
    expect(state.nextReleaseAt).toBe(5_000 + HOUR_MS);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]?.reason).toBe("start");
    expect(state.history[0]?.amount).toBe(20);
    expect(releaseLabel(state.history[0]!)).toBe("Pace started");
  });

  it("does not release another slice on resume", () => {
    let state = ready(1000, 0);
    state = pause(state, 15 * 60 * 1000);
    expect(state.pacing).toBe(false);
    expect(state.balance).toBe(20);
    expect(state.pausedRemainingMs).toBe(HOUR_MS - 15 * 60 * 1000);
    state = startOrResume(state, 20 * 60 * 1000);
    expect(state.balance).toBe(20);
    expect(state.thisHour).toBe(20);
    expect(state.nextReleaseAt).toBe(
      20 * 60 * 1000 + (HOUR_MS - 15 * 60 * 1000),
    );
    expect(state.history).toHaveLength(1);
  });

  it("releases one additional slice per elapsed hour", () => {
    let state = ready(1000, 0);
    state = catchUp(state, HOUR_MS);
    expect(state.balance).toBe(40);
    expect(state.thisHour).toBe(20);
    expect(availableThisHour(state)).toBe(20);
    expect(bankedUnits(state)).toBe(20);
    expect(state.nextReleaseAt).toBe(2 * HOUR_MS);
    expect(state.history[0]?.reason).toBe("hourly");

    state = catchUp(state, 3 * HOUR_MS);
    expect(state.balance).toBe(80);
    expect(availableThisHour(state)).toBe(20);
    expect(bankedUnits(state)).toBe(60);
    expect(state.history[0]?.reason).toBe("catchup");
    expect(state.history[0]?.hours).toBe(2);
    expect(state.nextReleaseAt).toBe(4 * HOUR_MS);
  });

  it("is a no-op when the next release is still ahead", () => {
    const state = ready(1000, 0);
    expect(catchUp(state, HOUR_MS - 1)).toBe(state);
  });
});

describe("queue", () => {
  it("fits an item inside this hour and refuses one that is over budget", () => {
    let state = ready(1000, 0);
    state = addItem(state, "Write the note", 10, 0);
    state = addItem(state, "  ", 10, 0);
    state = addItem(state, "Huge pass", 500, 0);
    expect(state.items).toHaveLength(2);

    const [small, large] = state.items;
    expect(itemOutlook(state, small!).fitsNow).toBe(true);
    expect(itemOutlook(state, small!).overBudget).toBe(false);

    const largeOutlook = itemOutlook(state, large!);
    expect(largeOutlook.overBudget).toBe(true);
    expect(largeOutlook.fitsNow).toBe(false);
    expect(largeOutlook.exceedsAllowance).toBe(false);
    expect(largeOutlook.shortfall).toBe(480);
    expect(largeOutlook.slicesNeeded).toBe(24);
    expect(largeOutlook.unlocksAt).toBe(HOUR_MS + 23 * HOUR_MS);

    const skipped = completeItem(state, large!.id, 1);
    expect(skipped).toBe(state);

    state = completeItem(state, small!.id, 1);
    expect(state.balance).toBe(10);
    expect(availableThisHour(state)).toBe(10);
    expect(state.items[0]?.doneAt).toBe(1);

    state = restoreItem(state, small!.id);
    expect(state.balance).toBe(20);
    expect(availableThisHour(state)).toBe(20);
    expect(state.items[0]?.doneAt).toBeNull();
  });

  it("flags an item that costs more than the full allowance", () => {
    const state = addItem(ready(1000, 0), "Too big", 5000, 0);
    const outlook = itemOutlook(state, state.items[0]!);
    expect(outlook.overBudget).toBe(true);
    expect(outlook.exceedsAllowance).toBe(true);
    expect(outlook.slicesNeeded).toBe(249);
  });

  it("shows a zero allowance as blocked, with an empty queue distinct from that", () => {
    const started = startOrResume(initialState(), 0);
    expect(started.thisHour).toBe(0);
    expect(started.balance).toBe(0);
    expect(availableThisHour(started)).toBe(0);
    expect(hoursUntilAllowanceCovered(started)).toBeNull();

    const queued = addItem(started, "Anything", 1, 0);
    const outlook = itemOutlook(queued, queued.items[0]!);
    expect(outlook.overBudget).toBe(true);
    expect(outlook.blockedByZero).toBe(true);
    expect(outlook.unlocksAt).toBeNull();
    expect(upcomingSlices(started)[0]?.amount).toBe(0);
  });

  it("treats a small item as ready for the first hour before the pace starts", () => {
    const state = addItem(setAllowance(initialState(), 1000), "Small", 10, 0);
    const outlook = itemOutlook(state, state.items[0]!);
    expect(outlook.fitsNow).toBe(false);
    expect(outlook.fitsOnStart).toBe(true);
    expect(outlook.overBudget).toBe(false);
    expect(removeItem(state, state.items[0]!.id).items).toHaveLength(0);
  });
});

describe("countdown and storage", () => {
  it("formats a one-hour countdown", () => {
    expect(formatCountdown(HOUR_MS)).toBe("01:00:00");
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(59_001)).toBe("00:01:00");
  });

  it("parses allowance input and drops corrupt saves", () => {
    expect(parseUnits("1,000")).toEqual({ ok: true, value: 1000 });
    expect(parseUnits("0")).toEqual({ ok: true, value: 0 });
    expect(parseUnits("-4").ok).toBe(false);
    expect(parseUnits("nope").ok).toBe(false);
    expect(parseUnits("").ok).toBe(false);

    const clean = sanitize({
      allowance: 1000,
      pacing: true,
      nextReleaseAt: 50,
      balance: 20,
      thisHour: 20,
      spentThisHour: 80,
      items: [
        { id: "a", title: "Keep", cost: 5, createdAt: 10, doneAt: null },
        { id: "", title: "Drop", cost: 5, createdAt: 10, doneAt: null },
        { title: "Missing id" },
      ],
      history: "nope",
    });
    expect(clean.allowance).toBe(1000);
    expect(clean.pacing).toBe(true);
    expect(clean.spentThisHour).toBe(20);
    expect(clean.items).toHaveLength(1);
    expect(clean.items[0]?.title).toBe("Keep");
    expect(clean.history).toEqual([]);
    expect(sanitize(null)).toEqual(initialState());
  });
});
