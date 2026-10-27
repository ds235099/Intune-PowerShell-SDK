import { decideSliderOrder } from "./slider-order.js";

const stage = document.querySelector("#stage");
const slider = document.querySelector("#slider");
const track = document.querySelector("#track");
const buttons = [...document.querySelectorAll("[data-slider-button]")];
const slides = [...document.querySelectorAll(".slide")];
const orderLabel = document.querySelector("#order-label");
const reasonNode = document.querySelector("#reason");
const live = document.querySelector("#order-live");
const logList = document.querySelector("#log");
const countNode = document.querySelector("#slide-count");

const REASONS = {
  "missing-buttons": "No slider buttons were measured.",
  "already-normal": "Buttons are already in normal working order.",
  "fixed-outside-slider": "Fixed buttons sat outside the slider, so they were switched to normal order.",
  "fixed-is-not-working-order": "Fixed positioning is not the working order, so the buttons were switched to normal.",
};

let index = 0;
let generation = 0;
let holdFixed = false;
let restorePending = false;
let queue = Promise.resolve();

function rectOf(element) {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

function snapshot() {
  return {
    frame: rectOf(stage),
    buttons: buttons.map((button) => ({
      id: button.id,
      ...rectOf(button),
      position: getComputedStyle(button).position,
    })),
  };
}

function showSlide(nextIndex) {
  index = (nextIndex + slides.length) % slides.length;
  track.style.transform = `translateX(-${index * 100}%)`;
  const title = slides[index].dataset.title;
  countNode.textContent = `${index + 1} / ${slides.length}`;
  slides.forEach((slide, slideIndex) => {
    slide.toggleAttribute("aria-hidden", slideIndex !== index);
  });
  countNode.dataset.title = title;
}

function writeLog(message) {
  const item = document.createElement("li");
  item.textContent = message;
  logList.prepend(item);
  while (logList.children.length > 6) logList.lastElementChild.remove();
  live.textContent = message;
}

function sentence(reason) {
  return REASONS[reason] || reason;
}

async function confirmWithWorker(reading) {
  const response = await fetch("/api/order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(reading),
  });
  if (!response.ok) throw new Error(`order api ${response.status}`);
  const payload = await response.json();
  if (payload.order !== "normal" && payload.order !== "fixed") {
    throw new Error("order api payload");
  }
  return payload;
}

function enqueue(source) {
  queue = queue
    .then(() => heal(source))
    .catch((error) => {
      reasonNode.textContent = "The order check failed. The buttons stay in the last safe placement.";
      writeLog(`Could not switch order (${source}): ${error instanceof Error ? error.message : String(error)}`);
    });
  return queue;
}

async function heal(source) {
  if (holdFixed) return;
  if (source === "automatic") restorePending = false;
  else if (restorePending) return;
  const ticket = generation;
  const reading = snapshot();
  const local = decideSliderOrder(reading);
  let decision = local;
  let decidedBy = "local";
  try {
    decision = await confirmWithWorker(reading);
    decidedBy = "worker";
  } catch (error) {
    decision = local;
    decidedBy = "local";
    writeLog(`Worker check unavailable (${error instanceof Error ? error.message : String(error)}). Used the local order check.`);
  }
  if (ticket !== generation || holdFixed) return;

  const wasFixed = buttons.some((button) => getComputedStyle(button).position === "fixed" || button.dataset.placement === "fixed");
  orderLabel.dataset.order = "normal";
  orderLabel.dataset.reason = wasFixed ? decision.reason : "already-normal";
  orderLabel.dataset.source = decidedBy;
  orderLabel.textContent = "Normal";
  reasonNode.textContent = sentence(orderLabel.dataset.reason);

  if (!wasFixed) return;

  for (const button of buttons) {
    button.style.position = "";
    button.dataset.placement = "normal";
  }
  orderLabel.dataset.lastSwitch = decision.reason;
  const message = `${source}: switched slider buttons from fixed to normal working order.`;
  writeLog(message);
}

function pinFixed() {
  generation += 1;
  const ticket = generation;
  holdFixed = true;
  restorePending = true;
  for (const button of buttons) {
    button.style.position = "";
    button.dataset.placement = "fixed";
  }
  orderLabel.dataset.order = "fixed";
  orderLabel.dataset.reason = "pinned-fixed";
  orderLabel.textContent = "Fixed";
  reasonNode.textContent = "Buttons are pinned fixed. They will switch back to normal working order.";
  writeLog("Replay: buttons pinned fixed. Automatic switch will restore normal order.");
  window.setTimeout(() => {
    if (ticket !== generation) {
      restorePending = false;
      return;
    }
    holdFixed = false;
    enqueue("automatic");
  }, 800);
}

document.querySelector("#prev").addEventListener("click", () => showSlide(index - 1));
document.querySelector("#next").addEventListener("click", () => showSlide(index + 1));
document.querySelector("#replay").addEventListener("click", pinFixed);

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    showSlide(index + 1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    showSlide(index - 1);
  }
});

let pointer = null;
slider.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  pointer = { x: event.clientX, y: event.clientY };
});
slider.addEventListener("pointerup", (event) => {
  if (!pointer) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  pointer = null;
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
  showSlide(index + (dx < 0 ? 1 : -1));
});
slider.addEventListener("pointercancel", () => {
  pointer = null;
});

window.addEventListener("resize", () => enqueue("resize"));
if (typeof ResizeObserver === "function") {
  const observer = new ResizeObserver(() => enqueue("resize"));
  observer.observe(stage);
}

window.setInterval(() => {
  if (holdFixed) return;
  const pinned = buttons.some((button) => getComputedStyle(button).position === "fixed" || button.dataset.placement === "fixed");
  if (pinned) enqueue("watch");
}, 200);

showSlide(0);
enqueue("startup");
