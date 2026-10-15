import { useEffect, useId, useState, type FormEvent } from "react";
import { elapsedFraction, formatClock, formatCountdown, formatUnits, formatWait, isoTime } from "./lib/format";
import {
  FULL_ALLOWANCE_HOURS,
  RELEASE_RATE,
  availableThisHour,
  bankedUnits,
  doneItems,
  hasStarted,
  hoursUntilAllowanceCovered,
  itemOutlook,
  queuedCost,
  queuedItems,
  queuedPortion,
  releaseLabel,
  remainingMs,
  sliceAmount,
  upcomingSlices,
  type ItemOutlook,
  type PaceState,
  type WorkItem,
} from "./lib/pace";
import { parseUnits } from "./lib/parse";
import { usePace } from "./usePace";

type Notice = { tone: "fit" | "wait" | "over" | "zero"; chip: string; detail: string };

function noticeFor(state: PaceState, item: WorkItem, now: number): Notice {
  const outlook: ItemOutlook = itemOutlook(state, item);
  const slice = sliceAmount(state.allowance);
  if (outlook.blockedByZero) {
    return {
      tone: "zero",
      chip: "Over budget",
      detail:
        "The allowance is zero, so this item never unlocks. Raise the allowance, or remove the item.",
    };
  }
  if (outlook.fitsNow) {
    return {
      tone: "fit",
      chip: "Fits now",
      detail: "This hour can cover it. Mark it done to spend the units.",
    };
  }
  if (outlook.fitsOnStart) {
    return {
      tone: "wait",
      chip: "Fits in the first hour",
      detail: `Start the pace to release ${formatUnits(slice)} units, enough to cover this item.`,
    };
  }
  const exceeds = outlook.exceedsAllowance
    ? ` It also costs more than your full allowance of ${formatUnits(state.allowance)} units.`
    : "";
  if (outlook.unlocksAt != null) {
    return {
      tone: "over",
      chip: "Over budget",
      detail: `Short ${formatUnits(outlook.shortfall)} units. Unlocks ${formatClock(outlook.unlocksAt)} (in ${formatWait(outlook.unlocksAt - now)}).${exceeds}`,
    };
  }
  if (!state.pacing && state.nextReleaseAt != null) {
    return {
      tone: "over",
      chip: "Over budget",
      detail: `Short ${formatUnits(outlook.shortfall)} units. Resume the pace and later slices will unlock it.${exceeds}`,
    };
  }
  const hoursAfterStart = Math.max(0, outlook.slicesNeeded - 1);
  const when =
    hoursAfterStart === 0
      ? "The first release would cover it."
      : `After you start, it needs ${hoursAfterStart} more hour${hoursAfterStart === 1 ? "" : "s"}.`;
  return {
    tone: "over",
    chip: "Over budget",
    detail: `Short ${formatUnits(outlook.shortfall)} units. ${when}${exceeds}`,
  };
}

function paceStatus(state: PaceState): string {
  if (state.pacing) return "Running";
  if (hasStarted(state)) return "Paused";
  return "Not started";
}

function paceButtonLabel(state: PaceState): string {
  if (state.pacing) return "Pause pace";
  if (hasStarted(state)) return "Resume pace";
  return "Start pace";
}

export function App() {
  const {
    state,
    now,
    updateAllowance,
    togglePace,
    createItem,
    deleteItem,
    finishItem,
    reopenItem,
    clear,
  } = usePace();
  const [allowanceDraft, setAllowanceDraft] = useState(String(state.allowance));
  const [itemEpoch, setItemEpoch] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    setAllowanceDraft(String(state.allowance));
  }, [state.allowance]);

  const slice = sliceAmount(state.allowance);
  const available = availableThisHour(state);
  const banked = bankedUnits(state);
  const queued = queuedPortion(state.allowance);
  const remaining = remainingMs(state, now);
  const active = queuedItems(state);
  const finished = doneItems(state);
  const overCount = active.filter((item) => itemOutlook(state, item).overBudget).length;
  const hoursLeft = hoursUntilAllowanceCovered(state);
  const started = hasStarted(state);
  const zeroAllowance = state.allowance <= 0;

  function saveAllowance(event: FormEvent) {
    event.preventDefault();
    const parsed = parseUnits(allowanceDraft);
    if (!parsed.ok) {
      const message =
        parsed.reason === "huge"
          ? "That allowance is too large."
          : "Enter a number of units, or 0.";
      setAnnouncement(message);
      return message;
    }
    updateAllowance(parsed.value);
    setAnnouncement(
      parsed.value === 0
        ? "Hourly allowance set to zero. Later hours will release nothing."
        : `Hourly allowance saved. Each hour releases ${formatUnits(sliceAmount(parsed.value))} units, 2% of ${formatUnits(parsed.value)}.`,
    );
    return null;
  }

  return (
    <div className="page">
      <a className="skip" href="#queue">
        Skip to queue
      </a>
      <div className="wrap">
        <header className="top">
          <div className="brand">
            <p className="kicker">Personal pace</p>
            <h1 className="name" data-testid="app-title">
              <ClockMark />
              Easy <em>Slow-Mo</em>
            </h1>
            <p className="lede">
              Set an hourly allowance. Each hour, only 2% is released. The other 98% stays
              queued until a later hour. This browser keeps the settings, queue, schedule, and
              history — nothing is sent anywhere.
            </p>
          </div>
          <button
            type="button"
            className="pace-button"
            data-testid="pace-toggle"
            aria-pressed={state.pacing}
            onClick={() => {
              const running = state.pacing;
              togglePace();
              setAnnouncement(running ? "Pace paused." : "Pace running. This hour’s slice is released.");
            }}
          >
            <span className={`dot ${state.pacing ? "run" : "idle"}`} aria-hidden="true" />
            {paceButtonLabel(state)}
          </button>
        </header>

        {zeroAllowance ? (
          <div className="banner" role="status" data-testid="zero-allowance">
            <strong>Allowance is zero.</strong>
            <span>
              Each hour releases 0 units, so queued work stays over budget until you set an
              allowance above zero.
            </span>
          </div>
        ) : null}

        <div className="layout">
          <section className="deck" aria-label="Pace">
            <article className="timer">
              <div className="timer-top">
                <p className="timer-label">Next release</p>
                <p className="timer-status" data-testid="pace-status">
                  {paceStatus(state)}
                </p>
              </div>
              <p className="digits" data-testid="countdown">
                {formatCountdown(remaining)}
              </p>
              <p className="timer-note">
                {state.pacing
                  ? `Running. The next hour adds ${formatUnits(slice)} units.`
                  : started
                    ? "Paused. The countdown is frozen and nothing new unlocks."
                    : "Not started. The first hour begins when you press Start pace."}
              </p>
              <div className="track" aria-hidden="true">
                <span style={{ width: `${elapsedFraction(remaining) * 100}%` }} />
              </div>
            </article>

            <article className="card hour-card">
              <p className="stat-label">Available this hour</p>
              <p className="stat-value" data-testid="available-this-hour">
                {formatUnits(available)}
                <span> units</span>
              </p>
              <p className="rule" data-testid="release-rule">
                {zeroAllowance
                  ? "Only 2% would be released each hour, and 2% of zero is nothing."
                  : started
                    ? state.thisHour === slice
                      ? `Only 2% is available this hour: ${formatUnits(state.thisHour)} released from ${formatUnits(state.allowance)}.`
                      : `This hour already released ${formatUnits(state.thisHour)} units. Next hour releases ${formatUnits(slice)}, 2% of ${formatUnits(state.allowance)}.`
                    : `Start the pace to release ${formatUnits(slice)} units — 2% of ${formatUnits(state.allowance)}.`}
              </p>
              <dl className="stat-grid">
                <div>
                  <dt>Spendable now</dt>
                  <dd data-testid="spendable">{formatUnits(state.balance)}</dd>
                </div>
                <div>
                  <dt>Queued for later</dt>
                  <dd data-testid="queued-later">{formatUnits(queued)}</dd>
                </div>
                <div>
                  <dt>Banked earlier</dt>
                  <dd>{formatUnits(banked)}</dd>
                </div>
                <div>
                  <dt>Full allowance</dt>
                  <dd>{formatUnits(state.allowance)}</dd>
                </div>
              </dl>
              {!zeroAllowance && state.thisHour !== slice && started ? (
                <p className="hint">
                  The next release uses the saved allowance: {formatUnits(slice)} units.
                </p>
              ) : null}
            </article>

            <AllowanceForm
              draft={allowanceDraft}
              onDraft={setAllowanceDraft}
              onSubmit={saveAllowance}
            />
          </section>

          <section className="bench">
            <ItemForm
              key={itemEpoch}
              onAdd={(title, cost) => {
                createItem(title, cost);
                setAnnouncement(`Queued “${title}” for ${formatUnits(cost)} units.`);
              }}
            />

            <section className="card" id="queue" aria-labelledby="queue-heading">
              <div className="card-head">
                <h2 id="queue-heading">Queue</h2>
                <p>
                  {active.length === 0
                    ? "Nothing waiting"
                    : `${formatUnits(queuedCost(state))} units across ${active.length} item${active.length === 1 ? "" : "s"}`}
                </p>
              </div>
              {overCount > 0 ? (
                <p className="queue-flag" data-testid="over-budget-summary">
                  {overCount} item{overCount === 1 ? "" : "s"} over budget for this hour.
                </p>
              ) : null}
              {active.length === 0 ? (
                <div className="empty" data-testid="queue-empty">
                  <h3>Queue is empty</h3>
                  <p>
                    Add a title and a cost in units. Work stays here until the released slice
                    can cover it.
                  </p>
                </div>
              ) : (
                <ul className="tickets">
                  {active.map((item) => {
                    const outlook = itemOutlook(state, item);
                    const notice = noticeFor(state, item, now);
                    return (
                      <li key={item.id}>
                        <article
                          className={`ticket tone-${notice.tone}`}
                          data-testid="work-item"
                          data-state={notice.tone}
                        >
                          <div className="ticket-top">
                            <h3>{item.title}</h3>
                            <p className="cost">
                              {formatUnits(item.cost)} <span>units</span>
                            </p>
                          </div>
                          <p className={`chip chip-${notice.tone}`} data-testid="item-status">
                            {notice.chip}
                          </p>
                          <p className="detail">{notice.detail}</p>
                          <div className="ticket-actions">
                            <button
                              type="button"
                              className="solid"
                              disabled={!outlook.fitsNow}
                              onClick={() => {
                                finishItem(item.id);
                                setAnnouncement(`Marked “${item.title}” done. Spent ${formatUnits(item.cost)} units.`);
                              }}
                            >
                              Mark done
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => {
                                deleteItem(item.id);
                                setAnnouncement(`Removed “${item.title}” from the queue.`);
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <Schedule state={state} hoursLeft={hoursLeft} />
            <History state={state} />

            {finished.length > 0 ? (
              <section className="card" aria-labelledby="done-heading">
                <div className="card-head">
                  <h2 id="done-heading">Finished</h2>
                  <p>{finished.length} marked done</p>
                </div>
                <ul className="finished">
                  {finished.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>
                          {formatUnits(item.cost)} units
                          {item.doneAt != null ? ` · ${formatClock(item.doneAt)}` : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          reopenItem(item.id);
                          setAnnouncement(`Returned “${item.title}” to the queue and refunded its units.`);
                        }}
                      >
                        Put back
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>
        </div>

        <footer className="foot">
          <p>
            A full allowance takes {FULL_ALLOWANCE_HOURS} hours because each hour releases{" "}
            {Math.round(RELEASE_RATE * 100)}%. Stored locally in this browser.
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              if (
                window.confirm(
                  "Clear the allowance, queue, and history stored in this browser?",
                )
              ) {
                clear();
                setItemEpoch((value) => value + 1);
                setAnnouncement("Cleared saved data on this browser.");
              }
            }}
          >
            Clear saved data
          </button>
        </footer>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>
    </div>
  );
}

function AllowanceForm({
  draft,
  onDraft,
  onSubmit,
}: {
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: (event: FormEvent) => string | null;
}) {
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const preview = parseUnits(draft);
  const previewText = preview.ok
    ? `2% of ${formatUnits(preview.value)} is ${formatUnits(sliceAmount(preview.value))} units each hour. ${formatUnits(queuedPortion(preview.value))} stays queued.`
    : "Enter 0 or a positive number of units.";

  return (
    <form
      className="card form"
      onSubmit={(event) => {
        const message = onSubmit(event);
        setError(message);
      }}
    >
      <div className="card-head">
        <h2>Hourly allowance</h2>
        <p>The number you choose. The pace only hands out 2%.</p>
      </div>
      <label htmlFor="allowance">Units per hour</label>
      <div className="fields">
        <input
          id="allowance"
          data-testid="allowance-input"
          inputMode="decimal"
          value={draft}
          onChange={(event) => {
            onDraft(event.target.value);
            setError(null);
          }}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
        />
        <button type="submit" className="solid" data-testid="save-allowance">
          Save allowance
        </button>
      </div>
      {error ? (
        <p className="error" id={errorId} role="alert">
          {error}
        </p>
      ) : (
        <p className="hint" data-testid="allowance-preview">
          {previewText}
        </p>
      )}
    </form>
  );
}

function ItemForm({ onAdd }: { onAdd: (title: string, cost: number) => void }) {
  const titleId = useId();
  const costId = useId();
  const errorId = useId();
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="card form"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = title.trim();
        const parsed = parseUnits(cost);
        if (!trimmed) {
          setError("Give the item a title.");
          return;
        }
        if (!parsed.ok || parsed.value <= 0) {
          setError("Enter a cost above 0.");
          return;
        }
        onAdd(trimmed, parsed.value);
        setTitle("");
        setCost("");
        setError(null);
      }}
    >
      <div className="card-head">
        <h2>Add work</h2>
        <p>A title, and what it costs in units.</p>
      </div>
      <div className="item-fields">
        <div className="field">
          <label htmlFor={titleId}>Title</label>
          <input
            id={titleId}
            data-testid="item-title"
            value={title}
            maxLength={140}
            placeholder="Draft the outline"
            onChange={(event) => {
              setTitle(event.target.value);
              setError(null);
            }}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor={costId}>Cost</label>
          <input
            id={costId}
            data-testid="item-cost"
            inputMode="decimal"
            placeholder="10"
            value={cost}
            onChange={(event) => {
              setCost(event.target.value);
              setError(null);
            }}
          />
        </div>
        <button type="submit" className="solid" data-testid="add-item">
          Add to queue
        </button>
      </div>
      {error ? (
        <p className="error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function Schedule({
  state,
  hoursLeft,
}: {
  state: PaceState;
  hoursLeft: number | null;
}) {
  const rows = upcomingSlices(state);
  const notStarted = state.nextReleaseAt == null;
  return (
    <section className="card" aria-labelledby="schedule-heading">
      <div className="card-head">
        <h2 id="schedule-heading">Later slices</h2>
        <p>When the queued part of the allowance unlocks</p>
      </div>
      {state.allowance <= 0 ? (
        <p className="hint">These hours unlock nothing while the allowance is zero.</p>
      ) : (
        <p className="hint">
          {hoursLeft == null
            ? "Set an allowance to build a schedule."
            : hoursLeft === 0
              ? "Spendable units already cover one full allowance. The pace still releases 2% each hour."
              : `${hoursLeft} more hour${hoursLeft === 1 ? "" : "s"} until released units add up to one full allowance, if you don’t spend them. A full allowance always takes ${FULL_ALLOWANCE_HOURS} hours.`}
        </p>
      )}
      <ol className="slices" data-testid="schedule">
        {rows.map((row) => {
          const label = row.at != null
            ? formatClock(row.at)
            : notStarted
              ? row.index === 1
                ? "When you start"
                : `${row.index - 1} hour${row.index - 1 === 1 ? "" : "s"} after you start`
              : row.index === 1
                ? "When this hour ends"
                : `${row.index - 1} hour${row.index - 1 === 1 ? "" : "s"} after that`;
          return (
            <li key={row.index} className={row.index === 1 ? "next" : undefined}>
              <span>{label}</span>
              {row.at != null ? (
                <time dateTime={isoTime(row.at)}>+{formatUnits(row.amount)}</time>
              ) : (
                <strong>+{formatUnits(row.amount)}</strong>
              )}
              <em>balance {formatUnits(row.balanceAfter)}</em>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function History({ state }: { state: PaceState }) {
  return (
    <section className="card" aria-labelledby="history-heading">
      <div className="card-head">
        <h2 id="history-heading">Release history</h2>
        <p>{state.history.length === 0 ? "No releases yet" : "Newest first"}</p>
      </div>
      {state.history.length === 0 ? (
        <div className="empty compact" data-testid="history-empty">
          <h3>No releases yet</h3>
          <p>Start the pace and the first 2% is recorded here immediately.</p>
        </div>
      ) : (
        <ol className="history" data-testid="history">
          {state.history.map((record) => (
            <li key={record.id}>
              <time dateTime={isoTime(record.at)}>{formatClock(record.at)}</time>
              <strong>+{formatUnits(record.amount)}</strong>
              <span>
                {releaseLabel(record)} · allowance {formatUnits(record.allowance)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ClockMark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 16V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 16l5.2 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
