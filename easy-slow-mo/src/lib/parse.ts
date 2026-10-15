import { MAX_ALLOWANCE, roundUnits } from "./pace";

export type ParsedUnits =
  | { ok: true; value: number }
  | { ok: false; reason: "empty" | "invalid" | "huge" };

export function parseUnits(raw: string): ParsedUnits {
  const cleaned = raw.trim().replace(/,/g, "");
  if (!cleaned) return { ok: false, reason: "empty" };
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return { ok: false, reason: "invalid" };
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return { ok: false, reason: "invalid" };
  if (value > MAX_ALLOWANCE) return { ok: false, reason: "huge" };
  return { ok: true, value: roundUnits(value) };
}
