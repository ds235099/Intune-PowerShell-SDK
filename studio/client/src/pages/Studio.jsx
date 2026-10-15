import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BRANDS } from "@shared/catalog.js";
import { LENGTH_RULE, formatDuration } from "@shared/model.js";
import { api, mediaUrl } from "../api.js";
import { LengthPicker } from "../components/LengthPicker.jsx";
import { Stage } from "../components/Stage.jsx";
import { Status } from "./Campaigns.jsx";

export function Studio() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState("preview");
  const briefRef = useRef(null);
  const lengthTimer = useRef(null);

  async function refresh() {
    const data = await api(`/api/campaigns/${id}`);
    setCampaign(data.campaign);
    briefRef.current = data.campaign.brief;
    if (data.campaign.export && !data.campaign.exportStale) setMode("film");
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
    api("/api/meta").then((meta) => setProviders(meta.providers)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (campaign?.status !== "running") return undefined;
    const timer = setInterval(() => {
      refresh().catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [campaign?.status, id]);

  async function saveScenes(scenes) {
    const data = await api(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenes }),
    });
    setCampaign(data.campaign);
    setMode("preview");
  }

  async function saveBrief(brief) {
    const data = await api(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief, rebuild: true }),
    });
    setCampaign(data.campaign);
    setMode("preview");
  }

  async function exportFilm() {
    setExporting(true);
    setError("");
    try {
      const data = await api(`/api/campaigns/${id}/export`, { method: "POST" });
      setCampaign(data.campaign);
      setMode("film");
    } catch (err) {
      setError(err.message);
      await refresh().catch(() => {});
    } finally {
      setExporting(false);
    }
  }

  async function start() {
    setError("");
    try {
      const data = await api(`/api/campaigns/${id}/start`, { method: "POST" });
      setCampaign(data.campaign);
    } catch (err) {
      setError(err.message);
    }
  }

  async function stop() {
    const data = await api(`/api/campaigns/${id}/stop`, { method: "POST" });
    setCampaign(data.campaign);
  }

  if (!campaign) {
    return <main className="page">{error ? <p className="banner bad">{error}</p> : <p className="fine">Loading the studio…</p>}</main>;
  }

  const brand = BRANDS[campaign.brief.brandId] || BRANDS.ai;

  return (
    <main className="studio">
      <div className="studio-bar">
        <div>
          <Link to="/campaigns" className="back">Campaigns</Link>
          <h1>{campaign.brief.businessName}</h1>
          <p>{brand.label} · {formatDuration(campaign.brief.durationSec)} · <Status status={campaign.status} /></p>
        </div>
        <div className="studio-actions">
          <button type="button" className="button solid" disabled={exporting} onClick={exportFilm}>
            {exporting ? "Rendering the MP4…" : "Export MP4"}
          </button>
          {campaign.status === "running" ? (
            <button type="button" className="button" onClick={stop}>Stop</button>
          ) : (
            <button type="button" className="button" disabled={!campaign.export || campaign.exportStale} onClick={start}>
              Start campaign
            </button>
          )}
        </div>
      </div>

      {campaign.exportError ? (
        <div className="banner bad" role="alert">
          <strong>Export failed.</strong>
          <p>The MP4 was not written. {campaign.exportError}</p>
          <button type="button" className="button" onClick={exportFilm} disabled={exporting}>Try export again</button>
        </div>
      ) : null}
      {campaign.exportStale ? (
        <p className="banner warn">The cut is out of date. Export again to match the script and length.</p>
      ) : null}
      {error && !campaign.exportError ? <p className="banner bad">{error}</p> : null}

      <div className="studio-grid">
        <section>
          <div className="mode-switch">
            <button type="button" className={mode === "preview" ? "on" : ""} onClick={() => setMode("preview")}>Storyboard</button>
            <button type="button" className={mode === "film" ? "on" : ""} disabled={!campaign.export} onClick={() => setMode("film")}>MP4</button>
          </div>
          {mode === "film" && !campaign.export ? (
            <div className="empty slim">
              <h2>No film exported yet.</h2>
              <p>Export an MP4 to play the finished file. The storyboard is the cut you will render.</p>
            </div>
          ) : (
            <Stage campaign={campaign} mode={mode} />
          )}
          {campaign.export ? (
            <p className="fine spec-line">
              Exported {campaign.export.width}×{campaign.export.height} at {campaign.export.fps} fps · {formatDuration(campaign.export.durationSec)} · H.264
            </p>
          ) : (
            <p className="fine spec-line">Export target: 1920×1080 at 60 fps · {formatDuration(campaign.brief.durationSec)} · H.264</p>
          )}
        </section>
        <section className="script">
          <h2>Script</h2>
          {campaign.scenes.map((scene, index) => (
            <fieldset key={scene.id}>
              <legend>{labelFor(scene)} · {formatDuration(Math.max(1, Math.round(scene.end - scene.start)))}</legend>
              <label>Kicker
                <input value={scene.kicker} onChange={(event) => edit(index, "kicker", event.target.value)} />
              </label>
              <label>Headline
                <textarea rows="2" value={scene.headline} onChange={(event) => edit(index, "headline", event.target.value)} />
              </label>
              <label>Caption
                <input value={scene.caption} onChange={(event) => edit(index, "caption", event.target.value)} />
              </label>
            </fieldset>
          ))}
          <button type="button" className="button" onClick={() => saveScenes(campaign.scenes)}>Save script</button>
        </section>
      </div>

      <section>
        <h2>Scenes</h2>
        <ol className="scene-list">
          {campaign.scenes.map((scene) => (
            <li key={scene.id}>
              <div className="thumb">
                {scene.assetId ? <img src={mediaUrl(scene.assetId)} alt="" /> : <span>{scene.headline}</span>}
              </div>
              <b>{labelFor(scene)}</b>
              <small>{scene.headline || scene.caption || scene.kicker || "Still"}</small>
            </li>
          ))}
        </ol>
      </section>

      <section className="length-panel">
        <h2>Length</h2>
        <p className="fine">{LENGTH_RULE} Changing it rebuilds the scenes for the new time.</p>
        <LengthPicker value={campaign.brief.durationSec} onChange={(durationSec) => {
          setCampaign((current) => ({ ...current, brief: { ...current.brief, durationSec } }));
          clearTimeout(lengthTimer.current);
          lengthTimer.current = setTimeout(() => {
            saveBrief({ ...briefRef.current, durationSec });
          }, 400);
        }} />
      </section>

      <section className="meta-grid">
        <div>
          <h2>Renderer</h2>
          <ul className="providers">
            {providers.map((provider) => (
              <li key={provider.id}>
                <b>{provider.label}</b>
                <span>{provider.available ? "In use" : "Not connected"}</span>
                <p>{provider.detail}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Delivery</h2>
          {campaign.results ? (
            <>
              <div className="stats">
                <div><b>{campaign.results.impressions}</b><span>Impressions</span></div>
                <div><b>{campaign.results.views}</b><span>Views</span></div>
                <div><b>{campaign.results.clicks}</b><span>Clicks</span></div>
              </div>
              <p className="fine">{campaign.results.note}</p>
            </>
          ) : (
            <p>Start the campaign after a current export. Results here are simulated, and nothing is sent to an ad network.</p>
          )}
        </div>
      </section>
    </main>
  );

  function edit(index, field, value) {
    setCampaign((current) => ({
      ...current,
      scenes: current.scenes.map((scene, sceneIndex) => (sceneIndex === index ? { ...scene, [field]: value } : scene)),
    }));
  }
}

function labelFor(scene) {
  if (scene.role === "hook") return "Hook";
  if (scene.role === "cta") return "Call to action";
  if (scene.role === "logo") return "Logo";
  if (scene.role === "portrait") return "Portrait";
  if (scene.role === "still") return "Uploaded still";
  if (scene.role === "audience") return "Audience";
  if (scene.role === "offer") return "Offer";
  if (scene.kind === "video") return "Video clip";
  return "Scene";
}
