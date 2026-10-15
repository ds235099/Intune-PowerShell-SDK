import { useEffect, useState } from "react";
import { LENGTH_RULE, MAX_DURATION_SEC, MIN_DURATION_SEC, clampDuration, formatDuration } from "@shared/model.js";

const PRESETS = [6, 15, 30, 60, 90, 180];

export function LengthPicker({ value, onChange }) {
  const [text, setText] = useState(String(value));
  const [note, setNote] = useState("");

  useEffect(() => {
    setText(String(value));
  }, [value]);

  function commit(raw) {
    const result = clampDuration(raw);
    setText(String(result.value));
    setNote(result.clamped ? result.note : "");
    if (result.value !== value) onChange(result.value);
  }

  return (
    <div className="length">
      <p className="rule">{LENGTH_RULE}</p>
      <div className="length-readout">
        <strong>{formatDuration(value)}</strong>
        <span>{MIN_DURATION_SEC}–{MAX_DURATION_SEC} seconds</span>
      </div>
      <input
        type="range"
        min={MIN_DURATION_SEC}
        max={MAX_DURATION_SEC}
        value={value}
        aria-label="Ad length in seconds"
        onChange={(event) => {
          setNote("");
          onChange(Number(event.target.value));
        }}
      />
      <label className="seconds">
        Seconds
        <input
          type="number"
          min={MIN_DURATION_SEC}
          max={MAX_DURATION_SEC}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => commit(text)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </label>
      <div className="presets">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={preset === value ? "on" : ""}
            onClick={() => {
              setNote("");
              onChange(preset);
            }}
          >
            {formatDuration(preset)}
          </button>
        ))}
      </div>
      {note ? <p className="note">{note}</p> : null}
    </div>
  );
}
