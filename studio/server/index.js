import { createReadStream } from "node:fs";
import { mkdir, stat, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import express from "express";
import multer from "multer";
import { BRANDS } from "../shared/catalog.js";
import {
  GOALS,
  LENGTH_RULE,
  MAX_DURATION_SEC,
  MIN_DURATION_SEC,
  PRESETS,
  PRODUCT_NAME,
  TONES,
  buildFilm,
  normalizeBrief,
} from "../shared/model.js";
import { addUpload, dataDir, getAsset, isAllowedUpload, listAssets, loadLibrary, previewPath, removeUpload, uploadDir } from "./library.js";
import { renderFilm } from "./render.js";
import { getCampaign, listCampaigns, saveCampaign } from "./store.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exportDir = path.join(dataDir, "exports");
const port = Number(process.env.PORT || 8787);
const locks = new Map();

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedUpload(file.originalname)) cb(null, true);
    else cb(new Error("Upload a jpg, png, webp, gif, mp4, or mov."));
  },
});

function providers() {
  const key = process.env.VIDEO_MODEL_API_KEY || "";
  const url = process.env.VIDEO_MODEL_API_URL || "";
  return [
    {
      id: "builtin-motion",
      label: "Built-in motion graphics",
      available: true,
      detail: "Typography, brand color, captions, and your stills. This is not a generative video model.",
    },
    {
      id: "external-model",
      label: "External video model",
      available: false,
      detail: key && url
        ? "A key is present, but this version still exports with the built-in renderer and does not call the model."
        : "Not connected. Set VIDEO_MODEL_API_KEY and VIDEO_MODEL_API_URL when you have them. No key is built in.",
    },
  ];
}

function withLock(id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(id, run.then(() => {}, () => {}));
  return run;
}

async function assetsForFilm() {
  const library = await loadLibrary();
  return [...library.starters, ...library.uploads];
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/meta", (_req, res) => {
  res.json({
    product: PRODUCT_NAME,
    lengthRule: LENGTH_RULE,
    minDurationSec: MIN_DURATION_SEC,
    maxDurationSec: MAX_DURATION_SEC,
    width: 1920,
    height: 1080,
    fps: 60,
    brands: Object.values(BRANDS),
    goals: GOALS,
    tones: TONES,
    presets: PRESETS,
    providers: providers(),
    accepts: ["jpg", "jpeg", "png", "webp", "gif", "mp4", "mov"],
  });
});

app.get("/api/library", async (_req, res, next) => {
  try {
    res.json(await listAssets());
  } catch (error) {
    next(error);
  }
});

app.get("/api/library/:id/media", async (req, res, next) => {
  try {
    const asset = await getAsset(req.params.id);
    if (!asset) return res.status(404).json({ error: "That file is not in the library." });
    const file = asset.kind === "image" ? await previewPath(asset) : asset.path;
    const type = asset.kind === "video"
      ? (asset.file.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4")
      : "image/jpeg";
    res.setHeader("Content-Type", file.endsWith(".png") ? "image/png" : type);
    createReadStream(file).pipe(res);
  } catch (error) {
    next(error);
  }
});

app.post("/api/library", (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error) return res.status(400).json({ error: error.message || "Upload failed." });
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Choose a file to upload." });
    const brand = ["ai", "sports", "shared"].includes(req.body.brand) ? req.body.brand : "shared";
    const role = ["logo", "portrait", "broll", "still"].includes(req.body.role) ? req.body.role : "broll";
    const asset = await addUpload({
      storedName: req.file.filename,
      originalName: req.file.originalname,
      brand,
      role,
    });
    res.status(201).json({ asset });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/library/:id", async (req, res, next) => {
  try {
    const asset = await getAsset(req.params.id);
    if (!asset) return res.status(404).json({ error: "That file is not in the library." });
    if (asset.source !== "upload") {
      return res.status(400).json({ error: "Starter stills stay in the library." });
    }
    await removeUpload(asset.id);
    await unlink(asset.path).catch(() => {});
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/campaigns", async (_req, res, next) => {
  try {
    const campaigns = await listCampaigns();
    res.json({ campaigns: campaigns.map(summary) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/campaigns", async (req, res, next) => {
  try {
    const { errors, brief } = normalizeBrief(req.body.brief || req.body);
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    const film = buildFilm(brief, await assetsForFilm());
    const now = new Date().toISOString();
    const campaign = await saveCampaign({
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      status: "draft",
      brief,
      scenes: film.scenes,
      export: null,
      exportError: null,
      exportStale: false,
      startedAt: null,
    });
    res.status(201).json({ campaign: present(campaign) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/campaigns/:id", async (req, res, next) => {
  try {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });
    res.json({ campaign: present(campaign) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/campaigns/:id", async (req, res, next) => {
  try {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });
    if (req.body.brief) {
      const { errors, brief } = normalizeBrief(req.body.brief);
      if (errors.length) return res.status(400).json({ error: errors[0], errors });
      const changed = JSON.stringify(brief) !== JSON.stringify(campaign.brief);
      campaign.brief = brief;
      if (changed || req.body.rebuild) {
        campaign.scenes = buildFilm(brief, await assetsForFilm()).scenes;
        markStale(campaign);
      }
    }
    if (Array.isArray(req.body.scenes)) {
      campaign.scenes = campaign.scenes.map((scene) => {
        const next = req.body.scenes.find((item) => item.id === scene.id);
        if (!next) return scene;
        return {
          ...scene,
          kicker: String(next.kicker || "").slice(0, 80),
          headline: String(next.headline || "").slice(0, 180),
          caption: String(next.caption || "").slice(0, 180),
        };
      });
      markStale(campaign);
    }
    campaign.updatedAt = new Date().toISOString();
    await saveCampaign(campaign);
    res.json({ campaign: present(campaign) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/campaigns/:id/export", async (req, res, next) => {
  try {
    const result = await withLock(req.params.id, () => exportCampaign(req.params.id));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/campaigns/:id/video", async (req, res, next) => {
  try {
    const campaign = await getCampaign(req.params.id);
    const file = path.join(exportDir, `${req.params.id}.mp4`);
    if (!campaign?.export) return res.status(404).json({ error: "No film has been exported yet." });
    const info = await stat(file);
    const range = req.headers.range;
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    if (!range) {
      res.setHeader("Content-Length", info.size);
      createReadStream(file).pipe(res);
      return;
    }
    const [startRaw, endRaw] = range.replace(/bytes=/, "").split("-");
    const start = Number(startRaw);
    const end = endRaw ? Number(endRaw) : info.size - 1;
    if (!Number.isFinite(start) || start < 0 || end >= info.size || start > end) {
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${info.size}`);
    res.setHeader("Content-Length", end - start + 1);
    createReadStream(file, { start, end }).pipe(res);
  } catch (error) {
    next(error);
  }
});

app.post("/api/campaigns/:id/start", async (req, res, next) => {
  try {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });
    if (!campaign.export || campaign.exportStale || campaign.status === "draft") {
      return res.status(400).json({ error: "Export a current film before starting delivery." });
    }
    campaign.status = "running";
    campaign.startedAt = new Date().toISOString();
    campaign.updatedAt = campaign.startedAt;
    await saveCampaign(campaign);
    res.json({ campaign: present(campaign) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/campaigns/:id/stop", async (req, res, next) => {
  try {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });
    campaign.status = campaign.export && !campaign.exportStale ? "ready" : "draft";
    campaign.startedAt = null;
    campaign.updatedAt = new Date().toISOString();
    await saveCampaign(campaign);
    res.json({ campaign: present(campaign) });
  } catch (error) {
    next(error);
  }
});

app.use("/media/brand", express.static(path.join(root, "brand")));

const dist = path.join(root, "client", "dist");
app.use(express.static(dist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/media")) return next();
  res.sendFile(path.join(dist, "index.html"), (error) => {
    if (error) next();
  });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({ error: error.message || "Something went wrong." });
});

async function exportCampaign(id) {
  const campaign = await getCampaign(id);
  if (!campaign) {
    const error = new Error("Campaign not found.");
    error.status = 404;
    throw error;
  }
  const duration = campaign.brief.durationSec;
  const parsed = (await import("../shared/model.js")).parseDuration(duration);
  if (!parsed.ok) {
    const error = new Error(parsed.error);
    error.status = 400;
    throw error;
  }
  await mkdir(exportDir, { recursive: true });
  const finalPath = path.join(exportDir, `${id}.mp4`);
  const tempPath = path.join(exportDir, `${id}.tmp.mp4`);
  try {
    const probed = await renderFilm({
      campaign,
      assets: await assetsForFilm(),
      output: tempPath,
    });
    await rename(tempPath, finalPath);
    const info = await stat(finalPath);
    campaign.export = {
      width: probed.width,
      height: probed.height,
      fps: Math.round(probed.fps),
      durationSec: campaign.brief.durationSec,
      frames: probed.frames,
      bytes: info.size,
      createdAt: new Date().toISOString(),
    };
    campaign.exportError = null;
    campaign.exportStale = false;
    campaign.status = "ready";
    campaign.startedAt = null;
    campaign.updatedAt = campaign.export.createdAt;
    await saveCampaign(campaign);
    return { campaign: present(campaign) };
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    campaign.exportError = friendlyExportError(error.message);
    campaign.updatedAt = new Date().toISOString();
    await saveCampaign(campaign);
    const wrapped = new Error(campaign.exportError);
    wrapped.status = 500;
    throw wrapped;
  }
}

function friendlyExportError(message) {
  const text = String(message || "The MP4 was not written.");
  if (text.length > 500) return `${text.slice(0, 500)}…`;
  return text;
}

function markStale(campaign) {
  if (campaign.status === "running") campaign.startedAt = null;
  if (campaign.export) campaign.exportStale = true;
  campaign.status = "draft";
}

function summary(campaign) {
  return {
    id: campaign.id,
    status: campaign.status,
    businessName: campaign.brief.businessName,
    offer: campaign.brief.offer,
    brandId: campaign.brief.brandId,
    durationSec: campaign.brief.durationSec,
    updatedAt: campaign.updatedAt,
    exportStale: Boolean(campaign.exportStale),
  };
}

function present(campaign) {
  return { ...campaign, results: resultsFor(campaign) };
}

function resultsFor(campaign) {
  if (campaign.status !== "running" || !campaign.startedAt) return null;
  const elapsed = Math.max(0, (Date.now() - Date.parse(campaign.startedAt)) / 1000);
  let hash = 0;
  for (const char of campaign.id) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  const impressions = Math.floor(elapsed * (28 + (hash % 40)));
  const views = Math.floor(impressions * (0.4 + (hash % 20) / 100));
  const clicks = Math.floor(views * (0.03 + (hash % 6) / 100));
  return {
    impressions,
    views,
    clicks,
    elapsedSec: Math.floor(elapsed),
    simulated: true,
    note: "Simulated delivery. Easy Agent Ad Pro does not connect to an ad network.",
  };
}

await mkdir(exportDir, { recursive: true });
app.listen(port, "0.0.0.0", () => {
  console.log(`${PRODUCT_NAME} listening on http://127.0.0.1:${port}`);
});
