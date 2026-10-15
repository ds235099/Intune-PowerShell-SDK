import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { BRANDS } from "../shared/catalog.js";
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH, VOICE_NAME, buildTimeline, fitText, parseDuration } from "../shared/model.js";
import { MISSING_ELEVENLABS_KEY, renderSoundtrack } from "./audio.js";

const FONTS = [
  "/usr/share/fonts/truetype/noto/NotoSerif-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
];

const INK = "#0c0c0d";
const PAPER = "#f6f3ee";

export async function renderFilm({ campaign, assets, output }) {
  const duration = parseDuration(campaign.brief.durationSec);
  if (!duration.ok) {
    const error = new Error(duration.error);
    error.status = 400;
    throw error;
  }
  const scenes = campaign.scenes || [];
  if (!scenes.length) throw new Error("This campaign has no scenes to render.");
  const timeline = buildTimeline(duration.value, scenes.length);
  const work = path.join(path.dirname(output), "work", campaign.id);
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });

  const clips = [];
  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const asset = scene.assetId ? assets.find((item) => item.id === scene.assetId) : null;
    const clipPath = path.join(work, `clip-${i}.mp4`);
    if (scene.kind === "video" && asset?.kind === "video") {
      await renderVideoClip({ scene, asset, frames: timeline.clipFrames[i], clipPath, brand: campaign.brief.brandId });
    } else {
      const plate = path.join(work, `plate-${i}.png`);
      const svg = plateSvg({ scene, asset, brandId: campaign.brief.brandId });
      const png = new Resvg(svg, {
        fitTo: { mode: "width", value: VIDEO_WIDTH },
        font: {
          fontFiles: FONTS,
          loadSystemFonts: true,
          defaultFontFamily: "Noto Serif",
        },
      }).render().asPng();
      await writeFile(plate, png);
      await renderStillClip({
        plate,
        frames: timeline.clipFrames[i],
        clipPath,
        drift: scene.treatment !== "still" && scene.treatment !== "poster",
      });
    }
    clips.push(clipPath);
  }

  let soundtrack = path.join(work, "music.wav");
  let voiceName = VOICE_NAME;
  let elevenLabsCalled = false;
  try {
    const mixed = await renderSoundtrack({
      duration: duration.value,
      brandId: campaign.brief.brandId,
      workDir: work,
    });
    soundtrack = mixed.path;
    voiceName = mixed.voiceName;
    elevenLabsCalled = mixed.elevenLabsCalled;
  } catch (error) {
    if (error.code !== MISSING_ELEVENLABS_KEY) throw error;
  }
  await crossfade({
    clips,
    timeline,
    frames: duration.value * VIDEO_FPS,
    duration: duration.value,
    soundtrack,
    output,
  });
  const probed = await probeVideo(output);
  if (probed.width !== VIDEO_WIDTH || probed.height !== VIDEO_HEIGHT) {
    throw new Error(`Export was ${probed.width}×${probed.height}, expected ${VIDEO_WIDTH}×${VIDEO_HEIGHT}.`);
  }
  if (Math.abs(probed.fps - VIDEO_FPS) > 0.2) {
    throw new Error(`Export was ${probed.fps} fps, expected ${VIDEO_FPS}.`);
  }
  if (Math.abs(probed.duration - duration.value) > 0.08) {
    throw new Error(`Export was ${probed.duration.toFixed(2)}s, expected ${duration.value}s.`);
  }
  if (!probed.audioCodec) {
    throw new Error("Export has no audio stream.");
  }
  if (Math.abs(probed.audioDuration - duration.value) > 0.2) {
    throw new Error(`Audio was ${probed.audioDuration.toFixed(2)}s, expected ${duration.value}s.`);
  }
  return { ...probed, voiceName, elevenLabsCalled };
}

function plateSvg({ scene, asset, brandId }) {
  const brand = BRANDS[brandId] || BRANDS.ai;
  if (scene.treatment === "type" || !asset) return typeSvg(scene, brand);
  if (scene.treatment === "logo") return logoSvg(scene, asset, brand);
  if (scene.treatment === "circle") return circleSvg(scene, asset, brand);
  if (scene.treatment === "still" || scene.treatment === "poster") return stillSvg(asset);
  return photoSvg(scene, asset, brand);
}

function typeSvg(scene, brand) {
  const headline = fitText(scene.headline || scene.kicker || "Easy Agent", 1560, scene.role === "cta" ? 132 : 112, 64);
  const caption = fitText(scene.caption || "", 1500, 42, 28);
  const kicker = (scene.kicker || "").toUpperCase();
  const headlineY = 430;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="${INK}"/>
  <rect x="120" y="150" width="96" height="10" fill="${brand.accent}"/>
  <text x="120" y="230" fill="${brand.accent}" font-family="Noto Sans" font-size="34" font-weight="700" letter-spacing="5">${esc(kicker)}</text>
  ${textBlock(headline.lines, 120, headlineY, headline.size, PAPER, "Noto Serif", 700, "start")}
  ${textBlock(caption.lines, 120, 900, caption.size, PAPER, "Noto Sans", 500, "start")}
</svg>`;
}

function logoSvg(scene, asset, brand) {
  const placed = contain(asset, 980, 760);
  const x = (1920 - placed.dw) / 2;
  const y = 90;
  const caption = fitText(scene.caption || scene.kicker || "", 1400, 42, 28);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="${INK}"/>
  <image href="${esc(asset.path)}" xlink:href="${esc(asset.path)}" x="${x}" y="${y}" width="${placed.dw}" height="${placed.dh}" preserveAspectRatio="none"/>
  ${textBlock(caption.lines, 960, 960, caption.size, brand.accent, "Noto Sans", 700, "middle")}
</svg>`;
}

function circleSvg(scene, asset, brand) {
  const placed = contain(asset, 760, 980);
  const x = 180;
  const y = (1080 - placed.dh) / 2;
  const headline = fitText(scene.kicker || "", 760, 72, 40);
  const caption = fitText(scene.caption || "", 760, 36, 24);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="${INK}"/>
  <image href="${esc(asset.path)}" xlink:href="${esc(asset.path)}" x="${x}" y="${y}" width="${placed.dw}" height="${placed.dh}" preserveAspectRatio="none"/>
  ${textBlock(headline.lines, 1080, 500, headline.size, PAPER, "Noto Serif", 700, "start")}
  ${textBlock(caption.lines, 1080, 680, caption.size, brand.accent, "Noto Sans", 600, "start")}
</svg>`;
}

function stillSvg(asset) {
  const frame = coverOrContain(asset, true);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="${INK}"/>
  <image href="${esc(asset.path)}" xlink:href="${esc(asset.path)}" x="${frame.x}" y="${frame.y}" width="${frame.dw}" height="${frame.dh}" preserveAspectRatio="none"/>
</svg>`;
}

function photoSvg(scene, asset, brand) {
  const frame = coverOrContain(asset, false);
  const showText = Boolean(scene.kicker || scene.caption || scene.headline);
  const headline = fitText(scene.headline || scene.caption || "", 1500, scene.headline ? 72 : 48, 32);
  const kicker = (scene.kicker || "").toUpperCase();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <clipPath id="frame"><rect width="1920" height="1080"/></clipPath>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.52" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.82"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#frame)">
    <image href="${esc(asset.path)}" xlink:href="${esc(asset.path)}" x="${frame.x}" y="${frame.y}" width="${frame.dw}" height="${frame.dh}" preserveAspectRatio="none"/>
  </g>
  ${showText ? `<rect width="1920" height="1080" fill="url(#shade)"/>` : ""}
  ${showText ? `<rect x="96" y="900" width="72" height="8" fill="${brand.accent}"/>` : ""}
  ${showText ? `<text x="96" y="948" fill="${PAPER}" font-family="Noto Sans" font-size="26" font-weight="700" letter-spacing="3">${esc(kicker)}</text>` : ""}
  ${showText ? textBlock(headline.lines.slice(0, 2), 96, 1004, Math.min(headline.size, 40), PAPER, "Noto Sans", 600, "start") : ""}
</svg>`;
}

function coverOrContain(asset, containMode) {
  const crop = asset.crop || { x: 0, y: 0, w: asset.width || VIDEO_WIDTH, h: asset.height || VIDEO_HEIGHT };
  const scale = containMode
    ? Math.min(VIDEO_WIDTH / crop.w, VIDEO_HEIGHT / crop.h)
    : Math.max(VIDEO_WIDTH / crop.w, VIDEO_HEIGHT / crop.h);
  const dw = (asset.width || crop.w) * scale;
  const dh = (asset.height || crop.h) * scale;
  const cropW = crop.w * scale;
  const cropH = crop.h * scale;
  const x = (VIDEO_WIDTH - cropW) / 2 - crop.x * scale;
  const y = (VIDEO_HEIGHT - cropH) / 2 - crop.y * scale;
  return { x, y, dw, dh };
}

function contain(asset, maxW, maxH) {
  const w = asset.width || maxW;
  const h = asset.height || maxH;
  const scale = Math.min(maxW / w, maxH / h);
  return { dw: w * scale, dh: h * scale };
}

function textBlock(lines, x, y, size, fill, family, weight, anchor) {
  const safe = (lines || []).filter(Boolean);
  if (!safe.length) return "";
  const lh = size * 1.12;
  const spans = safe
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lh}">${esc(line)}</tspan>`)
    .join("");
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${spans}</text>`;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderStillClip({ plate, frames, clipPath, drift }) {
  const filter = drift
    ? "scale=2048:1152:flags=lanczos,crop=1920:1080:x='(in_w-out_w)/2+18*sin(2*PI*t/6)':y='(in_h-out_h)/2+10*sin(2*PI*t/8)',fps=60,format=yuv420p"
    : "scale=1920:1080:flags=lanczos,fps=60,format=yuv420p";
  return run("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-framerate",
    "60",
    "-i",
    plate,
    "-frames:v",
    String(frames),
    "-vf",
    filter,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "16",
    "-pix_fmt",
    "yuv420p",
    "-an",
    clipPath,
  ]);
}

async function renderVideoClip({ scene, asset, frames, clipPath, brand }) {
  const brandColor = (BRANDS[brand] || BRANDS.ai).accent;
  const args = ["-y", "-stream_loop", "-1", "-i", asset.path];
  const fit = scene.treatment === "video-still"
    ? "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=60,format=yuv420p"
    : "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=60,format=yuv420p";
  if (scene.kicker || scene.caption || scene.headline) {
    const text = path.join(path.dirname(clipPath), `text-${path.basename(clipPath, ".mp4")}.png`);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.8"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#shade)"/>
  <rect x="96" y="900" width="72" height="8" fill="${brandColor}"/>
  <text x="96" y="970" fill="#f6f3ee" font-family="Noto Sans" font-size="28" font-weight="700">${esc((scene.kicker || "").toUpperCase())}</text>
  <text x="96" y="1024" fill="#f6f3ee" font-family="Noto Sans" font-size="40" font-weight="600">${esc(scene.caption || scene.headline || "")}</text>
</svg>`;
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: 1920 },
      font: { fontFiles: FONTS, loadSystemFonts: true, defaultFontFamily: "Noto Sans" },
    }).render().asPng();
    await writeFile(text, png);
    args.push("-loop", "1", "-i", text, "-frames:v", String(frames), "-filter_complex", `[0:v]${fit}[base];[base][1:v]overlay=0:0:format=auto,format=yuv420p[v]`, "-map", "[v]");
  } else {
    args.push("-frames:v", String(frames), "-vf", fit);
  }
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "16", "-pix_fmt", "yuv420p", "-an", clipPath);
  return run("ffmpeg", args);
}

function crossfade({ clips, timeline, frames, duration, soundtrack, output }) {
  const args = ["-y"];
  for (const clip of clips) args.push("-i", clip);
  const audioIndex = clips.length;
  args.push("-i", soundtrack);
  const audioArgs = [
    "-map",
    `${audioIndex}:a:0`,
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
  ];
  if (clips.length === 1) {
    args.push(
      "-map",
      "0:v:0",
      "-frames:v",
      String(frames),
      "-r",
      "60",
      "-t",
      String(duration),
      ...audioArgs,
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      output,
    );
    return run("ffmpeg", args);
  }
  const filters = clips.map((_, index) => `[${index}:v]fps=60,format=yuv420p,settb=1/60,setpts=PTS-STARTPTS[v${index}]`);
  let current = "v0";
  for (let i = 1; i < clips.length; i += 1) {
    const out = i === clips.length - 1 ? "vout" : `x${i}`;
    filters.push(`[${current}][v${i}]xfade=transition=fade:duration=${timeline.fade}:offset=${timeline.offsets[i - 1].toFixed(3)}[${out}]`);
    current = out;
  }
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[vout]",
    "-frames:v",
    String(frames),
    "-r",
    "60",
    "-t",
    String(duration),
    ...audioArgs,
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    output,
  );
  return run("ffmpeg", args);
}

function probeVideo(file) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,width,height,avg_frame_rate,nb_frames,duration",
      "-of",
      "json",
      file,
    ]);
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err.slice(-400) || "Could not read the exported film."));
        return;
      }
      const streams = JSON.parse(out).streams || [];
      const stream = streams.find((item) => item.codec_type === "video") || {};
      const audio = streams.find((item) => item.codec_type === "audio") || {};
      const [num, den] = String(stream.avg_frame_rate || "0/1").split("/").map(Number);
      resolve({
        width: Number(stream.width) || 0,
        height: Number(stream.height) || 0,
        fps: den ? num / den : 0,
        duration: Number(stream.duration) || 0,
        frames: Number(stream.nb_frames) || 0,
        audioCodec: audio.codec_name || "",
        audioDuration: Number(audio.duration) || 0,
      });
    });
  });
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += chunk.toString();
      if (err.length > 24000) err = err.slice(-16000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} failed. ${err.slice(-1200)}`));
    });
  });
}
