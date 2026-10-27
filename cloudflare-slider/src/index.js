import { decideSliderOrder, readSliderReading } from "../public/slider-order.js";

const MAX_BODY = 10_000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const started = Date.now();
    let status = 500;
    try {
      const response = await route(request, env, url);
      status = response.status;
      return response;
    } catch (error) {
      status = 500;
      console.error(JSON.stringify({
        message: "request failed",
        method: request.method,
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return Response.json({ error: "internal" }, { status: 500 });
    } finally {
      console.log(JSON.stringify({
        message: "request",
        method: request.method,
        path: url.pathname,
        status,
        ms: Date.now() - started,
      }));
    }
  },
};

async function route(request, env, url) {
  if (url.pathname === "/api/health") {
    if (request.method !== "GET") {
      return Response.json({ error: "method-not-allowed" }, { status: 405, headers: { allow: "GET" } });
    }
    return Response.json({ ok: true, service: "slider-order" }, { headers: { "cache-control": "no-store" } });
  }

  if (url.pathname === "/api/order") {
    return handleOrder(request);
  }

  if (!env?.ASSETS || typeof env.ASSETS.fetch !== "function") {
    console.error(JSON.stringify({ message: "assets binding missing", path: url.pathname }));
    return Response.json({ error: "assets-unavailable" }, { status: 500 });
  }

  return env.ASSETS.fetch(request);
}

async function handleOrder(request) {
  if (request.method !== "POST") {
    return Response.json(
      { error: "method-not-allowed" },
      { status: 405, headers: { allow: "POST", "cache-control": "no-store" } },
    );
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return Response.json({ error: "unsupported-media-type" }, { status: 415, headers: { "cache-control": "no-store" } });
  }

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) {
      return Response.json({ error: "body-too-large" }, { status: 413, headers: { "cache-control": "no-store" } });
    }
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const parsed = readSliderReading(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const decision = decideSliderOrder(parsed.reading);
  console.log(JSON.stringify({
    message: "order decision",
    order: decision.order,
    reason: decision.reason,
    offenders: decision.offenders,
  }));
  return Response.json(decision, { headers: { "cache-control": "no-store" } });
}
