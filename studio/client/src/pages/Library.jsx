import { useEffect, useState } from "react";
import { BRANDS } from "@shared/catalog.js";
import { api, mediaUrl } from "../api.js";

export function Library() {
  const [library, setLibrary] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [brand, setBrand] = useState("shared");
  const [role, setRole] = useState("broll");

  async function refresh() {
    setLibrary(await api("/api/library"));
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    const file = event.target.file.files[0];
    if (!file) {
      setError("Choose a jpg, png, webp, gif, mp4, or mov.");
      return;
    }
    const body = new FormData();
    body.set("file", file);
    body.set("brand", brand);
    body.set("role", role);
    setError("");
    setNote("");
    try {
      await api("/api/library", { method: "POST", body });
      event.target.reset();
      setNote(`${file.name} is in the library. The next export will use it when that brand is selected.`);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    await api(`/api/library/${id}`, { method: "DELETE" });
    await refresh();
  }

  const assets = library?.assets || [];
  const videos = assets.filter((asset) => asset.kind === "video");

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Brand library</p>
          <h1>Stills for the cut. Video when you have it.</h1>
          <p className="lede">Easy Agent photos are used in the film. A few uploads stay full-frame stills, so marks that are not Easy Agent’s are never redrawn.</p>
        </div>
      </div>

      {error ? <p className="banner bad">{error}</p> : null}
      {note ? <p className="banner good">{note}</p> : null}

      <section className="upload-panel">
        <h2>Add a file</h2>
        <p>Jpg, png, webp, gif, mp4, or mov. No video clips are in the library yet, so current films are cut from stills.</p>
        <form onSubmit={onSubmit}>
          <label>File
            <input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,.mov,.mp4" />
          </label>
          <label>Look
            <select value={brand} onChange={(event) => setBrand(event.target.value)}>
              <option value="shared">Both brands</option>
              <option value="ai">{BRANDS.ai.label}</option>
              <option value="sports">{BRANDS.sports.label}</option>
            </select>
          </label>
          <label>Use
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="broll">B-roll</option>
              <option value="portrait">Portrait</option>
              <option value="logo">Logo</option>
              <option value="still">Uploaded still only</option>
            </select>
          </label>
          <button className="button solid" type="submit">Upload</button>
        </form>
      </section>

      {videos.length === 0 ? (
        <p className="empty slim">No video clips yet. Upload an mp4 or mov when you have one and the renderer will cut it into the film.</p>
      ) : null}

      <ul className="library-grid">
        {assets.map((asset) => (
          <li key={asset.id}>
            <div className={`thumb ${asset.treatment}`}>
              {asset.kind === "video" ? <video src={mediaUrl(asset.id)} muted /> : <img src={mediaUrl(asset.id)} alt="" />}
            </div>
            <h2>{asset.title}</h2>
            <p>{asset.note || roleLabel(asset)}</p>
            <small>{asset.brands.map((id) => BRANDS[id]?.label || id).join(" · ")} · {asset.kind}</small>
            {asset.source === "upload" ? (
              <button type="button" className="textish" onClick={() => remove(asset.id)}>Remove</button>
            ) : null}
          </li>
        ))}
      </ul>

      {library?.omitted?.length ? (
        <p className="fine">{library.omitted.map((item) => `${item.file}: ${item.reason}`).join(" ")}</p>
      ) : null}
    </main>
  );
}

function roleLabel(asset) {
  if (asset.treatment === "still") return "Uploaded still. Shown as the file itself.";
  if (asset.role === "logo") return "Logo treatment.";
  if (asset.role === "portrait") return "Portrait.";
  if (asset.kind === "video") return "Video clip. Used when this brand is rendered.";
  return "Used in the film for this brand.";
}
