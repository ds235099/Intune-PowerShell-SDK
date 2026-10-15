import { spawn } from "node:child_process";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { voiceoverScript } from "../shared/model.js";

const VOICE = "en-us";

export async function renderSoundtrack({ duration, brandId, workDir }) {
  const musicPath = path.join(workDir, "music.wav");
  const voicePath = path.join(workDir, "voice.wav");
  const fittedPath = path.join(workDir, "voice-fit.wav");
  const mixPath = path.join(workDir, "soundtrack.wav");
  const { fadeIn, fadeOut } = bedFades(duration);
  await synthBed({ duration, brandId, fadeIn, fadeOut, output: musicPath });
  await speak(voiceoverScript(duration), voicePath);
  const slot = Math.max(0.8, duration - fadeIn - fadeOut - 0.12);
  await fitVoice(voicePath, slot, fittedPath);
  const lead = Math.min(fadeIn + 0.08, Math.max(0.12, duration * 0.04));
  await mixBedAndVoice({ musicPath, voicePath: fittedPath, duration, lead, output: mixPath });
  await unlink(voicePath).catch(() => {});
  return mixPath;
}

export function bedFades(duration) {
  const cap = duration * 0.18;
  return {
    fadeIn: Math.min(0.45, Math.max(0.12, duration * 0.045), cap),
    fadeOut: Math.min(1.4, Math.max(0.28, duration * 0.08), cap),
  };
}

function synthBed({ duration, brandId, fadeIn, fadeOut, output }) {
  const pulse = brandId === "sports" ? 2.35 : 2;
  const fadeOutStart = Math.max(0, duration - fadeOut).toFixed(3);
  const filter = [
    `[0:a]tremolo=f=${pulse}:d=0.78,lowpass=f=150,volume=0.62[bass]`,
    "[1:a]tremolo=f=0.22:d=0.3,volume=0.09[p1]",
    "[2:a]tremolo=f=0.18:d=0.28,volume=0.07[p2]",
    "[3:a]tremolo=f=0.16:d=0.24,volume=0.055[p3]",
    "[4:a]highpass=f=500,volume=0.85[arp]",
    "[5:a]highpass=f=2500,volume=0.55[hat]",
    `[bass][p1][p2][p3][arp][hat]amix=inputs=6:normalize=0,alimiter=limit=0.9,afade=t=in:st=0:d=${fadeIn.toFixed(3)},afade=t=out:st=${fadeOutStart}:d=${fadeOut.toFixed(3)},atrim=0:${duration},asetpts=PTS-STARTPTS[a]`,
  ].join(";");
  const arp = `aevalsrc=exprs='0.2*sin(2*PI*if(lt(mod(t\\,2)\\,0.5)\\,440\\,if(lt(mod(t\\,2)\\,1)\\,523.25\\,if(lt(mod(t\\,2)\\,1.5)\\,659.25\\,880)))*t)*pow(max(0.001\\,1-mod(t*${pulse * 2}\\,1))\\,2)':sample_rate=48000:duration=${duration}`;
  const hat = `aevalsrc=exprs='0.07*(random(1)*2-1)*lt(mod(t\\,${(1 / pulse).toFixed(4)})\\,0.012)':sample_rate=48000:duration=${duration}`;
  return run("ffmpeg", [
    "-y",
    "-f", "lavfi", "-i", `sine=frequency=55:sample_rate=48000:duration=${duration}`,
    "-f", "lavfi", "-i", `sine=frequency=220:sample_rate=48000:duration=${duration}`,
    "-f", "lavfi", "-i", `sine=frequency=261.63:sample_rate=48000:duration=${duration}`,
    "-f", "lavfi", "-i", `sine=frequency=329.63:sample_rate=48000:duration=${duration}`,
    "-f", "lavfi", "-i", arp,
    "-f", "lavfi", "-i", hat,
    "-filter_complex", filter,
    "-map", "[a]",
    "-c:a", "pcm_s16le",
    output,
  ]);
}

function speak(text, output) {
  return run("espeak-ng", ["-v", VOICE, "-s", "148", "-p", "38", "-a", "170", "-w", output, text]).catch((error) => {
    const wrapped = new Error(`Local voice failed. espeak-ng is required and no paid voice API is called. ${error.message}`);
    wrapped.status = 500;
    throw wrapped;
  });
}

async function fitVoice(input, slotSec, output) {
  const duration = await probeDuration(input);
  const filters = ["aresample=48000"];
  if (duration > slotSec + 0.05) {
    let remain = duration / slotSec;
    while (remain > 2) {
      filters.push("atempo=2");
      remain /= 2;
    }
    filters.push(`atempo=${Math.max(1, remain).toFixed(4)}`);
  }
  filters.push("aformat=sample_fmts=fltp:channel_layouts=mono");
  await run("ffmpeg", ["-y", "-i", input, "-af", filters.join(","), output]);
}

function mixBedAndVoice({ musicPath, voicePath, duration, lead, output }) {
  const delay = Math.round(lead * 1000);
  const filter = [
    `[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${duration},asetpts=PTS-STARTPTS[music]`,
    `[1:a]aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${delay}:all=1,apad=whole_dur=${duration},atrim=0:${duration},asetpts=PTS-STARTPTS,volume=1.7,asplit=2[voxsc][vox]`,
    "[music][voxsc]sidechaincompress=threshold=0.02:ratio=8:attack=12:release=280:makeup=1.2:level_sc=1[bed]",
    `[bed][vox]amix=inputs=2:duration=first:normalize=0:weights=1 1.15,alimiter=limit=0.95,atrim=0:${duration},asetpts=PTS-STARTPTS[a]`,
  ].join(";");
  return run("ffmpeg", [
    "-y",
    "-i", musicPath,
    "-i", voicePath,
    "-filter_complex", filter,
    "-map", "[a]",
    "-c:a", "pcm_s16le",
    output,
  ]);
}

function probeDuration(file) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1",
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
      if (code !== 0) reject(new Error(err.slice(-300) || "Could not time the voice."));
      else resolve(Number(out.trim()) || 0);
    });
  });
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += chunk.toString();
      if (err.length > 20000) err = err.slice(-12000);
    });
    child.on("error", (error) => {
      if (error.code === "ENOENT") reject(new Error(`${cmd} is not installed.`));
      else reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} failed. ${err.slice(-800)}`));
    });
  });
}
