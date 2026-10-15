import test from "node:test";
import assert from "node:assert/strict";
import { STARTER_ASSETS, OMITTED_FILES } from "./catalog.js";
import {
  MAX_DURATION_SEC,
  MIN_DURATION_SEC,
  VIDEO_FPS,
  buildFilm,
  buildTimeline,
  parseDuration,
  sceneBudget,
} from "./model.js";

test("duration rejects anything outside 4 seconds to 3 minutes", () => {
  assert.equal(parseDuration(3).ok, false);
  assert.equal(parseDuration(181).ok, false);
  assert.equal(parseDuration("nope").ok, false);
  assert.equal(parseDuration(4).value, 4);
  assert.equal(parseDuration(180).value, 180);
  assert.equal(parseDuration(15.2).value, 15);
  assert.equal(MIN_DURATION_SEC, 4);
  assert.equal(MAX_DURATION_SEC, 180);
});

test("timeline frame count matches the chosen length", () => {
  for (const duration of [4, 15, 30, 180]) {
    const count = sceneBudget(duration);
    const timeline = buildTimeline(duration, count);
    const frames = timeline.clipFrames.reduce((sum, n) => sum + n, 0) - (count - 1) * timeline.fadeFrames;
    assert.equal(frames, duration * VIDEO_FPS);
    assert.ok(timeline.clipFrames.every((n) => n > timeline.fadeFrames));
  }
});

test("starter library keeps one VS Code photo and no video", () => {
  const files = STARTER_ASSETS.map((asset) => asset.file);
  assert.equal(files.includes("vscode-sign.jpg"), true);
  assert.equal(files.includes("vscode-sign-2.jpg"), false);
  assert.equal(OMITTED_FILES[0].file, "vscode-sign-2.jpg");
  assert.equal(STARTER_ASSETS.some((asset) => asset.kind === "video"), false);
  assert.equal(STARTER_ASSETS.length, 15);
});

test("Easy Agent AI film uses stills and keeps third-party marks off the type", () => {
  const film = buildFilm(
    {
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
    STARTER_ASSETS,
  );
  assert.equal(film.durationSec, 15);
  assert.equal(film.scenes.length, 5);
  const ids = film.scenes.map((scene) => scene.assetId).filter(Boolean);
  assert.ok(ids.includes("founder-headshot"));
  assert.ok(ids.includes("mascot-logo"));
  assert.equal(ids.includes("yankee-stadium"), false);
  assert.equal(ids.includes("racing-site"), false);
  const copy = JSON.stringify(film.scenes);
  assert.equal(/openai/i.test(copy), false);
  assert.equal(/yankee/i.test(copy), false);
});

test("a long sports film can include uploaded stills without redrawing them", () => {
  const film = buildFilm(
    {
      businessName: "Easy Agent Sports",
      product: "Sports organisation",
      offer: "Bigger Faster Smarter Together",
      offerDetail: "Adelaide",
      audience: "Clubs and athletes",
      goal: "visits",
      tone: "bold",
      durationSec: 180,
      brandId: "sports",
    },
    STARTER_ASSETS,
  );
  assert.equal(film.durationSec, 180);
  assert.equal(film.scenes.length, 12);
  const stills = film.scenes.filter((scene) => scene.treatment === "still");
  assert.ok(stills.length >= 1);
  assert.equal(stills.every((scene) => scene.headline === "" && scene.kicker === ""), true);
});

test("four second film still has a hook and a call to action", () => {
  const film = buildFilm(
    {
      businessName: "Easy Agent AI",
      product: "Software",
      offer: "Made to do more.",
      offerDetail: "",
      audience: "Founders",
      goal: "calls",
      tone: "calm",
      durationSec: 4,
      brandId: "ai",
    },
    STARTER_ASSETS,
  );
  assert.equal(film.scenes.length, 3);
  assert.equal(film.scenes[0].role, "hook");
  assert.equal(film.scenes.at(-1).role, "cta");
  assert.equal(film.scenes.at(-1).headline, "Call today");
});
