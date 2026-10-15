import { useEffect, useState } from "react";
import { BRANDS } from "@shared/catalog.js";
import { formatDuration } from "@shared/model.js";
import { mediaUrl } from "../api.js";

export function Stage({ campaign, mode }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const duration = campaign.brief.durationSec;
  const brand = BRANDS[campaign.brief.brandId] || BRANDS.ai;
  const scene = campaign.scenes.find((item) => time >= item.start && time < item.end) || campaign.scenes.at(-1);

  useEffect(() => {
    setTime(0);
    setPlaying(false);
  }, [campaign.id, campaign.updatedAt, mode]);

  useEffect(() => {
    if (!playing || mode === "film") return undefined;
    let frame = 0;
    let last = performance.now();
    const tick = (now) => {
      const delta = (now - last) / 1000;
      last = now;
      setTime((current) => {
        const next = current + delta;
        if (next >= duration) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, mode]);

  if (mode === "film" && campaign.export) {
    return (
      <div className="stage">
        <video
          key={campaign.export.createdAt}
          src={`/api/campaigns/${campaign.id}/video?v=${encodeURIComponent(campaign.export.createdAt)}`}
          controls
          playsInline
          poster=""
        />
      </div>
    );
  }

  return (
    <div className="stage">
      <div className="plate" style={{ "--accent": brand.accent }}>
        <SceneView scene={scene} />
      </div>
      <div className="transport">
        <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play preview"}</button>
        <input
          type="range"
          min="0"
          max={duration}
          step="0.01"
          value={Math.min(time, duration)}
          aria-label="Preview time"
          onChange={(event) => {
            setPlaying(false);
            setTime(Number(event.target.value));
          }}
        />
        <span>{formatDuration(Math.round(time))} / {formatDuration(duration)}</span>
      </div>
    </div>
  );
}

function SceneView({ scene }) {
  if (!scene) return null;
  if (scene.kind === "type" || scene.treatment === "type") {
    return (
      <div className="type-plate">
        <i />
        <small>{scene.kicker}</small>
        <strong>{scene.headline}</strong>
        <em>{scene.caption}</em>
      </div>
    );
  }
  if (!scene.assetId) return <div className="type-plate"><strong>{scene.headline || scene.kicker}</strong></div>;
  const fit = scene.treatment === "still" || scene.treatment === "logo" || scene.treatment === "circle" || scene.treatment === "video-still"
    ? "contain"
    : "cover";
  return (
    <div className={`photo-plate ${fit}`}>
      {scene.kind === "video" ? (
        <video src={mediaUrl(scene.assetId)} muted playsInline />
      ) : (
        <img src={mediaUrl(scene.assetId)} alt="" />
      )}
      {scene.kicker || scene.caption ? (
        <p><b>{scene.kicker}</b><span>{scene.caption || scene.headline}</span></p>
      ) : null}
    </div>
  );
}
