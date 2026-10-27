import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";
import { decideSliderOrder, readSliderReading } from "../public/slider-order.js";

const frame = { left: 100, top: 180, right: 700, bottom: 460 };

function button(id, rect, position) {
  return { id, ...rect, position };
}

test("fixed buttons outside the slider switch to normal order", () => {
  const decision = decideSliderOrder({
    frame,
    buttons: [
      button("prev", { left: 10, top: 10, right: 118, bottom: 50 }, "fixed"),
      button("next", { left: 126, top: 10, right: 234, bottom: 50 }, "fixed"),
    ],
  });
  assert.deepEqual(decision, {
    order: "normal",
    reason: "fixed-outside-slider",
    offenders: ["prev", "next"],
  });
});

test("fixed buttons inside the frame are still not the working order", () => {
  const decision = decideSliderOrder({
    frame,
    buttons: [
      button("prev", { left: 110, top: 280, right: 230, bottom: 330 }, "fixed"),
      button("next", { left: 540, top: 280, right: 680, bottom: 330 }, "fixed"),
    ],
  });
  assert.equal(decision.order, "normal");
  assert.equal(decision.reason, "fixed-is-not-working-order");
  assert.deepEqual(decision.offenders, ["prev", "next"]);
});

test("static docked buttons stay in normal order", () => {
  const decision = decideSliderOrder({
    frame,
    buttons: [
      button("prev", { left: 118, top: 480, right: 250, bottom: 528 }, "static"),
      button("next", { left: 540, top: 480, right: 680, bottom: 528 }, "static"),
    ],
  });
  assert.deepEqual(decision, {
    order: "normal",
    reason: "already-normal",
    offenders: [],
  });
});

test("one fixed button is enough to leave fixed order", () => {
  const decision = decideSliderOrder({
    frame,
    buttons: [
      button("prev", { left: 10, top: 10, right: 80, bottom: 40 }, "fixed"),
      button("next", { left: 540, top: 480, right: 680, bottom: 528 }, "static"),
    ],
  });
  assert.equal(decision.order, "normal");
  assert.deepEqual(decision.offenders, ["prev"]);
});

test("missing buttons ask for normal order without throwing", () => {
  assert.deepEqual(decideSliderOrder(undefined), {
    order: "normal",
    reason: "missing-buttons",
    offenders: [],
  });
  assert.equal(decideSliderOrder({ frame, buttons: [] }).reason, "missing-buttons");
});

test("readSliderReading accepts a browser snapshot and rejects garbage", () => {
  const parsed = readSliderReading({
    frame,
    buttons: [
      button("prev", { left: 10, top: 10, right: 80, bottom: 40 }, "FIXED"),
    ],
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.reading.buttons[0].position, "fixed");

  assert.equal(readSliderReading(null).error, "invalid-body");
  assert.equal(readSliderReading({ frame, buttons: [] }).error, "invalid-buttons");
  assert.equal(readSliderReading({
    frame,
    buttons: [button("prev", { left: 10, top: 10, right: 80, bottom: Number.NaN }, "fixed")],
  }).error, "invalid-button-rect");
  assert.equal(readSliderReading({
    frame,
    buttons: [button("Prev button", { left: 10, top: 10, right: 80, bottom: 40 }, "fixed")],
  }).error, "invalid-button-id");
  assert.equal(readSliderReading({
    frame: { left: 0, top: 0, right: 0, bottom: 10 },
    buttons: [button("prev", { left: 10, top: 10, right: 80, bottom: 40 }, "fixed")],
  }).error, "invalid-frame");
});

function assetsEnv() {
  return {
    ASSETS: {
      async fetch(request) {
        return new Response(`asset ${new URL(request.url).pathname}`, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  };
}

test("worker order endpoint switches fixed buttons to normal", async () => {
  const response = await worker.fetch(new Request("https://slider.example/api/order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      frame,
      buttons: [
        button("prev", { left: 10, top: 10, right: 118, bottom: 50 }, "fixed"),
        button("next", { left: 126, top: 10, right: 234, bottom: 50 }, "fixed"),
      ],
    }),
  }), assetsEnv());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    order: "normal",
    reason: "fixed-outside-slider",
    offenders: ["prev", "next"],
  });
});

test("worker rejects bad order requests and serves assets", async () => {
  const env = assetsEnv();
  const health = await worker.fetch(new Request("https://slider.example/api/health"), env);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, service: "slider-order" });

  const method = await worker.fetch(new Request("https://slider.example/api/order"), env);
  assert.equal(method.status, 405);

  const media = await worker.fetch(new Request("https://slider.example/api/order", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  }), env);
  assert.equal(media.status, 415);

  const json = await worker.fetch(new Request("https://slider.example/api/order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  }), env);
  assert.equal(json.status, 400);

  const page = await worker.fetch(new Request("https://slider.example/"), env);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "asset /");
});

test("worker reports a missing asset binding", async () => {
  const response = await worker.fetch(new Request("https://slider.example/"));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "assets-unavailable" });
});
