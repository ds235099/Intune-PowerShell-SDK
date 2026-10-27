const COORD_LIMIT = 1_000_000;
const POSITIONS = new Set(["fixed", "static", "relative", "absolute", "sticky"]);

/**
 * Desired order for slider buttons.
 * Fixed positioning is never the working order: any fixed button must move
 * back into normal document flow. Geometry only explains why.
 */
export function decideSliderOrder(input) {
  const buttons = Array.isArray(input?.buttons) ? input.buttons : [];
  if (buttons.length === 0) {
    return { order: "normal", reason: "missing-buttons", offenders: [] };
  }

  const fixed = [];
  for (const button of buttons) {
    if (!button || typeof button !== "object") continue;
    if (String(button.position || "").toLowerCase() === "fixed") fixed.push(button);
  }

  if (fixed.length === 0) {
    return { order: "normal", reason: "already-normal", offenders: [] };
  }

  const frame = input?.frame;
  const frameOk = isRect(frame) && frame.right > frame.left && frame.bottom > frame.top;
  const outside = [];
  for (const button of fixed) {
    const id = buttonId(button);
    if (!frameOk || !isRect(button) || !centerInside(button, frame, 12)) {
      outside.push(id);
    }
  }

  const offenders = unique(outside.length > 0 ? outside : fixed.map(buttonId));
  return {
    order: "normal",
    reason: outside.length > 0 ? "fixed-outside-slider" : "fixed-is-not-working-order",
    offenders,
  };
}

/**
 * Strict reader for the edge API. Rejects shapes the browser should never send.
 */
export function readSliderReading(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid-body" };
  }
  if (!isRect(body.frame) || body.frame.right <= body.frame.left || body.frame.bottom <= body.frame.top) {
    return { ok: false, error: "invalid-frame" };
  }
  if (!Array.isArray(body.buttons) || body.buttons.length === 0 || body.buttons.length > 8) {
    return { ok: false, error: "invalid-buttons" };
  }

  const buttons = [];
  const seen = new Set();
  for (const button of body.buttons) {
    if (!button || typeof button !== "object" || Array.isArray(button)) {
      return { ok: false, error: "invalid-button" };
    }
    if (typeof button.id !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(button.id)) {
      return { ok: false, error: "invalid-button-id" };
    }
    if (seen.has(button.id)) return { ok: false, error: "duplicate-button-id" };
    seen.add(button.id);
    if (!isRect(button)) return { ok: false, error: "invalid-button-rect" };
    const position = String(button.position || "").toLowerCase();
    if (!POSITIONS.has(position)) return { ok: false, error: "invalid-position" };
    buttons.push({
      id: button.id,
      left: button.left,
      top: button.top,
      right: button.right,
      bottom: button.bottom,
      position,
    });
  }

  return {
    ok: true,
    reading: {
      frame: {
        left: body.frame.left,
        top: body.frame.top,
        right: body.frame.right,
        bottom: body.frame.bottom,
      },
      buttons,
    },
  };
}

function buttonId(button) {
  return typeof button.id === "string" && button.id ? button.id : "button";
}

function isRect(value) {
  if (!value || typeof value !== "object") return false;
  return ["left", "top", "right", "bottom"].every((key) => (
    typeof value[key] === "number"
    && Number.isFinite(value[key])
    && Math.abs(value[key]) <= COORD_LIMIT
  ));
}

function centerInside(button, frame, tolerance) {
  const cx = (button.left + button.right) / 2;
  const cy = (button.top + button.bottom) / 2;
  return cx >= frame.left - tolerance
    && cx <= frame.right + tolerance
    && cy >= frame.top - tolerance
    && cy <= frame.bottom + tolerance;
}

function unique(values) {
  return [...new Set(values)];
}
