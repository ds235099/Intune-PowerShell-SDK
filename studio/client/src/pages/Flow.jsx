import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BRANDS } from "@shared/catalog.js";
import { GOALS, PRESETS, TONES } from "@shared/model.js";
import { api } from "../api.js";
import { LengthPicker } from "../components/LengthPicker.jsx";

const STEPS = ["Business", "Offer", "Audience", "Goal", "Length"];

export function Flow() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState({ ...PRESETS.ai });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function patch(partial) {
    setBrief((current) => ({ ...current, ...partial }));
    setError("");
  }

  function next() {
    const message = validate(step, brief);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    if (step < STEPS.length - 1) setStep(step + 1);
    else submit();
  }

  async function submit() {
    setBusy(true);
    try {
      const data = await api("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      navigate(`/campaigns/${data.campaign.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const brand = BRANDS[brief.brandId] || BRANDS.ai;

  return (
    <main className="flow">
      <ol className="progress">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "on" : index < step ? "done" : ""}>
            <span>{index + 1}</span>{label}
          </li>
        ))}
      </ol>
      <section className="flow-card" style={{ "--accent": brand.accent }}>
        {step === 0 ? (
          <>
            <p className="eyebrow">Business</p>
            <h1>What is the business?</h1>
            <div className="preset-row">
              <button type="button" className={brief.brandId === "ai" ? "on" : ""} onClick={() => patch({ ...PRESETS.ai })}>Easy Agent AI brief</button>
              <button type="button" onClick={() => patch({ ...PRESETS.sports })}>Easy Agent Sports brief</button>
            </div>
            <label>Business name
              <input value={brief.businessName} onChange={(event) => patch({ businessName: event.target.value })} />
            </label>
            <label>What do you do?
              <input value={brief.product} onChange={(event) => patch({ product: event.target.value })} />
            </label>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <p className="eyebrow">Offer</p>
            <h1>What are you offering?</h1>
            <label>The line people should remember
              <textarea rows="3" value={brief.offer} onChange={(event) => patch({ offer: event.target.value })} />
            </label>
            <label>A supporting line, if you want one
              <input value={brief.offerDetail} onChange={(event) => patch({ offerDetail: event.target.value })} />
            </label>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <p className="eyebrow">Audience</p>
            <h1>Who is it for?</h1>
            <label>Describe them in a sentence
              <textarea rows="3" value={brief.audience} onChange={(event) => patch({ audience: event.target.value })} />
            </label>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <p className="eyebrow">Goal and tone</p>
            <h1>What should the film do?</h1>
            <div className="choice-grid">
              {GOALS.map((goal) => (
                <button type="button" key={goal.id} className={brief.goal === goal.id ? "on" : ""} onClick={() => patch({ goal: goal.id })}>
                  <b>{goal.label}</b>
                  <span>{goal.cta}</span>
                </button>
              ))}
            </div>
            <div className="choice-grid tones">
              {TONES.map((tone) => (
                <button type="button" key={tone.id} className={brief.tone === tone.id ? "on" : ""} onClick={() => patch({ tone: tone.id })}>
                  <b>{tone.label}</b>
                  <span>{tone.hint}</span>
                </button>
              ))}
            </div>
            <h2>Brand look</h2>
            <div className="choice-grid">
              {Object.values(BRANDS).map((item) => (
                <button type="button" key={item.id} className={brief.brandId === item.id ? "on" : ""} onClick={() => patch({ brandId: item.id })}>
                  <b><i style={{ background: item.accent }} />{item.label}</b>
                  <span>{item.hint}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        {step === 4 ? (
          <>
            <p className="eyebrow">Length</p>
            <h1>How long should it run?</h1>
            <LengthPicker value={brief.durationSec} onChange={(durationSec) => patch({ durationSec })} />
          </>
        ) : null}
        {error ? <p className="banner bad">{error}</p> : null}
        <div className="flow-nav">
          <button type="button" className="button" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>Back</button>
          <button type="button" className="button solid" disabled={busy} onClick={next}>
            {step === STEPS.length - 1 ? (busy ? "Opening studio…" : "Open the studio") : "Continue"}
          </button>
        </div>
      </section>
    </main>
  );
}

function validate(step, brief) {
  if (step === 0 && !brief.businessName.trim()) return "Add the business name.";
  if (step === 1 && !brief.offer.trim()) return "Add the offer.";
  if (step === 2 && !brief.audience.trim()) return "Add who the ad is for.";
  if (step === 3 && (!brief.goal || !brief.tone || !brief.brandId)) return "Choose a goal, a tone, and a brand look.";
  return "";
}
