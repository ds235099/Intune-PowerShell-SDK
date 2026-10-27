import assert from "node:assert/strict";
import test from "node:test";
import puppeteer from "puppeteer-core";

const base = process.env.SLIDER_BASE_URL || "http://127.0.0.1:8787";
const chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome-stable";
const shots = "/opt/cursor/artifacts/screenshots";

async function waitForNormal(page) {
  await page.waitForSelector('#order-label[data-order="normal"][data-source="worker"]', { timeout: 15000 });
  await page.waitForFunction(() => (
    [...document.querySelectorAll("[data-slider-button]")].every((button) => button.dataset.placement === "normal")
  ));
}

async function slideTitle(page) {
  return page.$eval("#slide-count", (node) => node.dataset.title);
}

async function assertButtonsFit(page) {
  const fit = await page.evaluate(() => {
    const read = (selector) => document.querySelector(selector).getBoundingClientRect();
    const prev = read("#prev");
    const next = read("#next");
    const slide = read("#slide-1");
    const slider = read("#slider");
    const width = window.innerWidth;
    return {
      prevInside: prev.left >= -1 && prev.right <= width + 1 && prev.width > 40,
      nextInside: next.left >= -1 && next.right <= width + 1 && next.width > 40,
      oneSlide: Math.abs(slide.width - slider.width) <= 1,
      noHorizontalScroll: document.documentElement.scrollWidth <= width + 1,
    };
  });
  assert.deepEqual(fit, {
    prevInside: true,
    nextInside: true,
    oneSlide: true,
    noHorizontalScroll: true,
  });
}

async function runFlow(browser, viewport, suffix) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(base, { waitUntil: "networkidle0", timeout: 20000 });
  await waitForNormal(page);

  const lastSwitch = await page.$eval("#order-label", (node) => node.dataset.lastSwitch);
  assert.match(lastSwitch, /fixed-outside-slider|fixed-is-not-working-order/);
  const logText = await page.$eval("#log", (node) => node.textContent);
  assert.match(logText, /startup: switched slider buttons from fixed to normal working order/);

  const first = await slideTitle(page);
  assert.equal(first, "Buttons start fixed");
  await page.click("#next");
  assert.equal(await slideTitle(page), "The edge checks geometry");
  await page.click("#next");
  assert.equal(await slideTitle(page), "Normal order sits in the dock");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await slideTitle(page), "The edge checks geometry");
  await page.click("#prev");
  assert.equal(await slideTitle(page), "Buttons start fixed");
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#track")).transform === "matrix(1, 0, 0, 1, 0, 0)");
  await assertButtonsFit(page);

  await page.screenshot({ path: `${shots}/slider-normal-${suffix}.png` });

  await page.click("#replay");
  await page.waitForSelector('#order-label[data-order="fixed"]');
  await page.waitForFunction(() => (
    document.querySelector("#prev").dataset.placement === "fixed"
    && document.querySelector("#next").dataset.placement === "fixed"
  ));
  await page.screenshot({ path: `${shots}/slider-fixed-${suffix}.png` });
  await waitForNormal(page);
  await assertButtonsFit(page);
  const restored = await page.$eval("#log", (node) => node.textContent);
  assert.match(restored, /automatic: switched slider buttons from fixed to normal working order/);
  await page.screenshot({ path: `${shots}/slider-restored-${suffix}.png` });

  await page.click("#next");
  assert.equal(await slideTitle(page), "The edge checks geometry");
  await page.close();
}

test("slider buttons work on desktop and mobile", async () => {
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    await runFlow(browser, { width: 1280, height: 800 }, "desktop");
    await runFlow(browser, { width: 390, height: 844, isMobile: true, hasTouch: true }, "mobile");
  } finally {
    await browser.close();
  }
});
