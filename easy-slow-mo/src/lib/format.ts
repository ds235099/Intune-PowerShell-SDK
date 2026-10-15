import { HOUR_MS, roundUnits } from "./pace";

export function formatUnits(value: number): string {
  const rounded = roundUnits(value);
  const abs = Math.abs(rounded);
  const fraction = abs.toFixed(6).replace(/\.?0+$/, "");
  const decimals = fraction.includes(".")
    ? Math.min(6, fraction.split(".")[1]?.length ?? 0)
    : 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(rounded);
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatWait(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 48) {
    const hourLabel = hours === 1 ? "1 hour" : `${hours} hours`;
    return remainder === 0 ? hourLabel : `${hourLabel} ${remainder} min`;
  }
  const days = Math.floor(hours / 24);
  const extraHours = hours % 24;
  const dayLabel = days === 1 ? "1 day" : `${days} days`;
  return extraHours === 0 ? dayLabel : `${dayLabel} ${extraHours} hours`;
}

export function percentLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function isoTime(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function elapsedFraction(remainingMs: number): number {
  if (HOUR_MS <= 0) return 0;
  const clamped = Math.min(HOUR_MS, Math.max(0, remainingMs));
  return (HOUR_MS - clamped) / HOUR_MS;
}
