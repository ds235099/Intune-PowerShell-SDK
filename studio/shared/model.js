import { BRANDS } from "./catalog.js";

export const PRODUCT_NAME = "Easy Agent Ad Pro";
export const MIN_DURATION_SEC = 4;
export const MAX_DURATION_SEC = 180;
export const DEFAULT_DURATION_SEC = 15;
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const VIDEO_FPS = 60;
export const LENGTH_RULE = "Every ad is at least 4 seconds and at most 3 minutes.";
export const VOICE_SHORT = "Easy Agent. Built with belief. Made to do more.";
export const VOICE_LONG_EXTRA = "AI software solutions for a bigger tomorrow. Adelaide, Australia.";
export const VOICE_NAME = "Brian";
export const VOICE_ID = "nPczCjzI2devNBz1zQrb";
export const VOICE_MODEL = "eleven_multilingual_v2";
export const VOICE_SCRIPT =
  "Easy Agent. Built with belief. Made to do more. We build AI software for a bigger tomorrow. Automate the work. Innovate the product. Scale it globally. From Adelaide, Australia, Easy Agent brings people, ideas, and technology together. Bigger. Smarter. Stronger. Together. Your ad can run from four seconds to three minutes. Easy Agent puts your brand on screen. Meet Darren Smith, founder. Built with belief. Made to do more.";

export function voiceoverScript(durationSec) {
  if (durationSec >= 45) return VOICE_SCRIPT;
  if (durationSec <= 20) return VOICE_SHORT;
  return `${VOICE_SHORT} ${VOICE_LONG_EXTRA}`;
}

export { BRANDS };

export const GOALS = [
  { id: "visits", label: "Get visits", cta: "Visit us" },
  { id: "calls", label: "Get calls", cta: "Call today" },
  { id: "signups", label: "Get signups", cta: "Sign up" },
  { id: "awareness", label: "Get the word out", cta: "See more" },
];

export const TONES = [
  { id: "warm", label: "Warm", hint: "Neighborly and direct" },
  { id: "bold", label: "Bold", hint: "Short lines, strong claim" },
  { id: "calm", label: "Calm", hint: "Quiet and sure" },
  { id: "playful", label: "Playful", hint: "Light, still clear" },
];

export const PRESETS = {
  ai: {
    businessName: "Easy Agent AI",
    product: "AI software from Adelaide",
    offer: "Built with belief. Made to do more.",
    offerDetail: "People, ideas, and technology.",
    audience: "Teams that want software that does more",
    goal: "awareness",
    tone: "bold",
    durationSec: 15,
    brandId: "ai",
  },
  sports: {
    businessName: "Easy Agent Sports",
    product: "Sports organisation",
    offer: "Bigger Faster Smarter Together",
    offerDetail: "Adelaide",
    audience: "Clubs, athletes, and partners",
    goal: "awareness",
    tone: "bold",
    durationSec: 15,
    brandId: "sports",
  },
};

const RANK = {
  ai: [
    "founder-headshot",
    "mascot-logo",
    "defeat-ai",
    "founder-studio",
    "vscode-sign",
    "portrait-bw",
    "mascot-night",
    "openai-codex-poster",
  ],
  sports: [
    "sports-hq",
    "mascot-logo",
    "big-boys",
    "headquarters",
    "hockey",
    "codex-expert",
    "portrait-bw",
    "mascot-night",
    "yankee-stadium",
    "racing-site",
  ],
};

const BANNED_COPY = [/openai/i, /yankee/i, /formula\s*1/i, /\bf1\b/i, /visual studio/i];

export function formatDuration(seconds) {
  const s = Math.round(Number(seconds) || 0);
  if (s < 60) return s === 1 ? "1 second" : `${s} seconds`;
  const minutes = Math.floor(s / 60);
  const rest = s % 60;
  const minuteLabel = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  if (!rest) return minuteLabel;
  return `${minuteLabel} ${rest} ${rest === 1 ? "second" : "seconds"}`;
}

export function parseDuration(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return { ok: false, error: "Enter a length in seconds." };
  }
  const rounded = Math.round(n);
  if (rounded < MIN_DURATION_SEC || rounded > MAX_DURATION_SEC) {
    return {
      ok: false,
      error: `Every ad must be between ${MIN_DURATION_SEC} seconds and 3 minutes (${MAX_DURATION_SEC} seconds).`,
    };
  }
  return { ok: true, value: rounded };
}

export function clampDuration(value) {
  const parsed = parseDuration(value);
  if (parsed.ok) return { value: parsed.value, clamped: false, note: "" };
  const n = Number(value);
  const fallback = Number.isFinite(n) ? n : DEFAULT_DURATION_SEC;
  const valueClamped = Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, Math.round(fallback)));
  const note =
    !Number.isFinite(n) || n < MIN_DURATION_SEC
      ? `Adjusted to ${formatDuration(valueClamped)}. ${LENGTH_RULE}`
      : `Adjusted to ${formatDuration(valueClamped)}. ${LENGTH_RULE}`;
  return { value: valueClamped, clamped: true, note };
}

export function sceneBudget(durationSec) {
  if (durationSec <= 5) return 3;
  if (durationSec <= 10) return 4;
  if (durationSec <= 18) return 5;
  if (durationSec <= 30) return 6;
  if (durationSec <= 60) return 8;
  if (durationSec <= 120) return 10;
  return 12;
}

export function buildTimeline(durationSec, count) {
  const totalFrames = durationSec * VIDEO_FPS;
  if (count <= 1) {
    return {
      fade: 0,
      fadeFrames: 0,
      clips: [durationSec],
      clipFrames: [totalFrames],
      offsets: [],
      windows: [{ start: 0, end: durationSec }],
    };
  }

  const avg = durationSec / count;
  let fadeFrames = Math.round(Math.min(0.4, Math.max(0.1, avg * 0.18)) * VIDEO_FPS);
  const maxFade = Math.max(4, Math.floor((totalFrames / count) * 0.28));
  fadeFrames = Math.max(4, Math.min(fadeFrames, maxFade));

  const contentFrames = totalFrames + (count - 1) * fadeFrames;
  const weights = Array.from({ length: count }, (_, i) => (i === 0 || i === count - 1 ? 1.12 : 1));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const clipFrames = weights.map((weight) => Math.max(fadeFrames + 3, Math.round((contentFrames * weight) / weightSum)));
  let drift = contentFrames - clipFrames.reduce((sum, frames) => sum + frames, 0);
  clipFrames[clipFrames.length - 1] += drift;
  if (clipFrames[clipFrames.length - 1] <= fadeFrames + 2) {
    throw new Error("That length is too short for this number of scenes.");
  }

  const offsets = [];
  let acc = 0;
  for (let i = 0; i < count - 1; i += 1) {
    acc += clipFrames[i];
    offsets.push((acc - (i + 1) * fadeFrames) / VIDEO_FPS);
  }

  const windows = [];
  let start = 0;
  for (let i = 0; i < count; i += 1) {
    const end = i === count - 1 ? durationSec : offsets[i] + fadeFrames / (VIDEO_FPS * 2);
    windows.push({ start, end });
    start = end;
  }
  windows[windows.length - 1].end = durationSec;

  return {
    fade: fadeFrames / VIDEO_FPS,
    fadeFrames,
    clips: clipFrames.map((frames) => frames / VIDEO_FPS),
    clipFrames,
    offsets,
    windows,
  };
}

function rankValue(asset, brandId) {
  const order = RANK[brandId] || RANK.ai;
  const index = order.indexOf(asset.id);
  if (index >= 0) return index;
  if (asset.treatment === "still" || asset.role === "still") return 1000;
  if (asset.kind === "video") return 420;
  return 500;
}

function poolFor(assets, brandId) {
  return assets
    .filter((asset) => asset.brands?.includes(brandId) || asset.brands?.includes("shared"))
    .sort((a, b) => rankValue(a, brandId) - rankValue(b, brandId));
}

function wordsFor(brief, asset) {
  if (asset.overlay === "none" || asset.treatment === "still" || asset.treatment === "poster" || asset.treatment === "video-still") {
    return { kicker: "", headline: "", caption: "" };
  }
  if (asset.caption) {
    return { kicker: asset.caption, headline: "", caption: asset.subcaption || brief.businessName };
  }
  return { kicker: brief.businessName, headline: "", caption: brief.offer };
}

function assetScene(brief, asset) {
  const words = wordsFor(brief, asset);
  return {
    kind: asset.kind === "video" ? "video" : "plate",
    treatment: asset.treatment || "cover",
    role: asset.role || "broll",
    assetId: asset.id,
    ...words,
  };
}

function fillerScenes(brief) {
  return [
    {
      kind: "type",
      treatment: "type",
      role: "audience",
      assetId: null,
      kicker: "For",
      headline: brief.audience,
      caption: brief.product || brief.businessName,
    },
    {
      kind: "type",
      treatment: "type",
      role: "offer",
      assetId: null,
      kicker: "The offer",
      headline: brief.offerDetail || brief.offer,
      caption: brief.businessName,
    },
  ];
}

function middleItems(brief, assets) {
  const slots = Math.max(1, sceneBudget(brief.durationSec) - 2);
  const ranked = poolFor(assets, brief.brandId);
  const stills = ranked.filter((asset) => asset.treatment === "still" || asset.role === "still");
  const rest = ranked.filter((asset) => asset.treatment !== "still" && asset.role !== "still");
  const stillReserve = slots >= 8 ? Math.min(2, stills.length) : slots >= 5 ? Math.min(1, stills.length) : 0;
  const items = [];
  for (const asset of rest) {
    if (items.length >= slots - stillReserve) break;
    items.push(assetScene(brief, asset));
  }
  const fillers = fillerScenes(brief);
  let fillerIndex = 0;
  while (items.length < slots - stillReserve && fillerIndex < fillers.length) {
    items.push(fillers[fillerIndex]);
    fillerIndex += 1;
  }
  for (let i = 0; i < stillReserve; i += 1) items.push(assetScene(brief, stills[i]));
  return items;
}

function ctaFor(goal) {
  return GOALS.find((item) => item.id === goal)?.cta || "See more";
}

export function buildFilm(brief, assets = []) {
  const duration = parseDuration(brief.durationSec);
  if (!duration.ok) {
    const error = new Error(duration.error);
    error.status = 400;
    throw error;
  }
  const safeBrief = { ...brief, durationSec: duration.value };
  const items = [
    {
      kind: "type",
      treatment: "type",
      role: "hook",
      assetId: null,
      kicker: safeBrief.businessName,
      headline: safeBrief.offer,
      caption: safeBrief.audience ? `For ${safeBrief.audience}` : safeBrief.product || "",
    },
    ...middleItems(safeBrief, assets),
    {
      kind: "type",
      treatment: "type",
      role: "cta",
      assetId: null,
      kicker: safeBrief.businessName,
      headline: ctaFor(safeBrief.goal),
      caption: safeBrief.offer,
    },
  ];
  const timeline = buildTimeline(duration.value, items.length);
  const scenes = items.map((item, index) => ({
    ...item,
    id: `scene-${index + 1}`,
    index,
    start: round3(timeline.windows[index].start),
    end: round3(timeline.windows[index].end),
    clip: timeline.clips[index],
  }));
  assertCleanCopy(scenes);
  return { durationSec: duration.value, fade: timeline.fade, scenes };
}

function assertCleanCopy(scenes) {
  const blob = scenes.map((scene) => `${scene.kicker} ${scene.headline} ${scene.caption}`).join("\n");
  for (const pattern of BANNED_COPY) {
    if (pattern.test(blob)) {
      throw new Error("Generated copy included a third-party mark. The still can be shown as itself, without redrawing that mark.");
    }
  }
}

export function normalizeBrief(input = {}) {
  const errors = [];
  const businessName = clean(input.businessName, 80);
  const product = clean(input.product, 120);
  const offer = clean(input.offer, 160);
  const offerDetail = clean(input.offerDetail, 180);
  const audience = clean(input.audience, 160);
  if (!businessName) errors.push("Add the business name.");
  if (!offer) errors.push("Add the offer.");
  if (!audience) errors.push("Add who the ad is for.");
  const goal = GOALS.some((item) => item.id === input.goal) ? input.goal : "";
  const tone = TONES.some((item) => item.id === input.tone) ? input.tone : "";
  const brandId = BRANDS[input.brandId] ? input.brandId : "";
  if (!goal) errors.push("Choose a goal.");
  if (!tone) errors.push("Choose a tone.");
  if (!brandId) errors.push("Choose a brand look.");
  const duration = parseDuration(input.durationSec);
  if (!duration.ok) errors.push(duration.error);
  return {
    errors,
    brief: {
      businessName,
      product,
      offer,
      offerDetail,
      audience,
      goal: goal || "awareness",
      tone: tone || "bold",
      brandId: brandId || "ai",
      durationSec: duration.ok ? duration.value : DEFAULT_DURATION_SEC,
    },
  };
}

export function wrapText(text, maxChars) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function fitText(text, maxWidth, startSize, minSize) {
  let size = startSize;
  let maxChars = Math.max(8, Math.floor(maxWidth / (size * 0.52)));
  let lines = wrapText(text, maxChars).slice(0, 4);
  while (size > minSize && (lines.length > 3 || lines.some((line) => line.length * size * 0.56 > maxWidth))) {
    size -= 4;
    maxChars = Math.max(8, Math.floor(maxWidth / (size * 0.52)));
    lines = wrapText(text, maxChars).slice(0, 4);
  }
  return { size, lines: lines.length ? lines : [""] };
}

function clean(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}
