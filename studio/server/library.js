import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, access, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OMITTED_FILES, STARTER_ASSETS } from "../shared/catalog.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const brandDir = path.join(root, "brand");
export const dataDir = path.join(root, "data");
export const uploadDir = path.join(dataDir, "uploads");
export const cacheDir = path.join(dataDir, "cache");
const libraryPath = path.join(dataDir, "library.json");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const VIDEO_EXT = new Set([".mp4", ".mov"]);

export function isAllowedUpload(filename = "") {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext);
}

export function mediaKind(filename = "") {
  return VIDEO_EXT.has(path.extname(filename).toLowerCase()) ? "video" : "image";
}

let cache = null;

export async function loadLibrary() {
  if (cache) return cache;
  await mkdir(uploadDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  const uploads = await readUploads();
  const starters = [];
  for (const asset of STARTER_ASSETS) {
    const full = path.join(brandDir, asset.file);
    try {
      await access(full);
    } catch {
      continue;
    }
    const probed = await probe(full);
    starters.push({ ...asset, ...probed, path: full });
  }
  cache = { starters, uploads };
  return cache;
}

export async function listAssets() {
  const library = await loadLibrary();
  const assets = [...library.starters, ...library.uploads];
  return {
    assets: assets.map(publicAsset),
    omitted: OMITTED_FILES,
    videoCount: assets.filter((asset) => asset.kind === "video").length,
  };
}

export async function getAsset(id) {
  const library = await loadLibrary();
  return [...library.starters, ...library.uploads].find((asset) => asset.id === id) || null;
}

export async function addUpload({ storedName, originalName, brand, role }) {
  const kind = mediaKind(originalName);
  const id = `upload-${storedName.replace(/\.[^.]+$/, "")}`;
  const treatment = treatmentFor(kind, role);
  const brands = brand === "shared" ? ["ai", "sports"] : [brand];
  const full = path.join(uploadDir, storedName);
  const probed = await probe(full);
  const asset = {
    id,
    file: originalName,
    storedName,
    title: path.basename(originalName, path.extname(originalName)).replace(/[-_]+/g, " "),
    role: kind === "video" ? "broll" : role,
    brands,
    treatment,
    overlay: treatment === "still" || treatment === "video-still" || treatment === "poster" ? "none" : "bottom",
    kind,
    source: "upload",
    path: full,
    ...probed,
  };
  const library = await loadLibrary();
  library.uploads.push(asset);
  await writeFile(libraryPath, JSON.stringify(library.uploads.map(serializeUpload), null, 2));
  return publicAsset(asset);
}

export async function removeUpload(id) {
  const library = await loadLibrary();
  const asset = library.uploads.find((item) => item.id === id);
  if (!asset) return false;
  library.uploads = library.uploads.filter((item) => item.id !== id);
  await writeFile(libraryPath, JSON.stringify(library.uploads.map(serializeUpload), null, 2));
  return true;
}

export function publicAsset(asset) {
  return {
    id: asset.id,
    file: asset.file,
    title: asset.title,
    role: asset.role,
    brands: asset.brands,
    treatment: asset.treatment,
    overlay: asset.overlay,
    kind: asset.kind,
    source: asset.source,
    note: asset.note || "",
    width: asset.width || 0,
    height: asset.height || 0,
    caption: asset.caption || "",
    subcaption: asset.subcaption || "",
  };
}

function treatmentFor(kind, role) {
  if (kind === "video") return role === "still" ? "video-still" : "video";
  if (role === "logo") return "logo";
  if (role === "still") return "still";
  if (role === "portrait") return "cover";
  return "cover";
}

function serializeUpload(asset) {
  return {
    id: asset.id,
    file: asset.file,
    storedName: asset.storedName,
    title: asset.title,
    role: asset.role,
    brands: asset.brands,
    treatment: asset.treatment,
    overlay: asset.overlay,
    kind: asset.kind,
    source: "upload",
    note: asset.note || "",
  };
}

async function readUploads() {
  try {
    const raw = await readFile(libraryPath, "utf8");
    const rows = JSON.parse(raw);
    const assets = [];
    for (const row of rows) {
      const full = path.join(uploadDir, row.storedName);
      try {
        await access(full);
      } catch {
        continue;
      }
      const probed = await probe(full);
      assets.push({ ...row, path: full, source: "upload", ...probed });
    }
    return assets;
  } catch {
    return [];
  }
}

function probe(file) {
  return new Promise((resolve) => {
    const child = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,duration",
      "-of",
      "json",
      file,
    ]);
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.on("close", () => {
      try {
        const stream = JSON.parse(out).streams?.[0] || {};
        resolve({
          width: Number(stream.width) || 0,
          height: Number(stream.height) || 0,
          mediaDuration: Number(stream.duration) || 0,
        });
      } catch {
        resolve({ width: 0, height: 0, mediaDuration: 0 });
      }
    });
    child.on("error", () => resolve({ width: 0, height: 0, mediaDuration: 0 }));
  });
}

export async function previewPath(asset) {
  if (!asset.crop) return asset.path;
  const dest = path.join(cacheDir, `${asset.id}.jpg`);
  try {
    await access(dest);
    return dest;
  } catch {
    /* render it */
  }
  const { x, y, w, h } = asset.crop;
  await run("ffmpeg", ["-y", "-i", asset.path, "-vf", `crop=${w}:${h}:${x}:${y}`, dest]);
  return dest;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.slice(-500) || `${cmd} failed`));
    });
  });
}

export { copyFile };
