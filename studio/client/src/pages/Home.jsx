import { Link } from "react-router-dom";
import { LENGTH_RULE } from "@shared/model.js";

export function Home() {
  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Independent video studio</p>
          <h1>A finished film from a short brief.</h1>
          <p className="lede">
            Easy Agent Ad Pro asks for the business, the offer, the audience, the goal, and the tone.
            Then it cuts your stills into a motion-graphics MP4 you can actually play.
          </p>
          <div className="hero-actions">
            <Link to="/campaigns/new" className="button solid">Start a campaign</Link>
            <Link to="/library" className="button">Brand library</Link>
          </div>
          <p className="fine">{LENGTH_RULE} Exported at 1920×1080, 60 fps, H.264, with original music ducked under an ElevenLabs voice.</p>
        </div>
        <div className="hero-frames" aria-hidden="true">
          <figure>
            <img src="/media/brand/founder-headshot-orange.jpg" alt="" />
            <figcaption>Easy Agent AI · black and orange</figcaption>
          </figure>
          <figure className="offset">
            <img src="/media/brand/easy-agent-sports-hq.jpg" alt="" />
            <figcaption>Easy Agent Sports · black and red</figcaption>
          </figure>
        </div>
      </section>

      <section className="band">
        <ol className="steps">
          <li>
            <span>01</span>
            <h2>Brief</h2>
            <p>Five short screens. Plain language. The length sits between 4 seconds and 3 minutes.</p>
          </li>
          <li>
            <span>02</span>
            <h2>Studio</h2>
            <p>Read the script, scan the scenes, and preview the cut before you export.</p>
          </li>
          <li>
            <span>03</span>
            <h2>Film</h2>
            <p>A real MP4, built from your stills, type, and brand color, with original music ducked under a premade ElevenLabs voice.</p>
          </li>
        </ol>
      </section>

      <section className="split">
        <div>
          <p className="eyebrow">What this is</p>
          <h2>Motion graphics, cut from the photos you already have.</h2>
          <p>
            When the brand library has stills, the film uses them: portrait, logo, and b-roll.
            A few files stay full-frame stills so other companies’ marks are never redrawn.
            If the library were empty, the same renderer would fall back to type, color, and captions.
          </p>
          <p>
            Delivery in this version is simulated. Easy Agent Ad Pro does not connect to an ad network.
          </p>
        </div>
        <div className="spec">
          <div><b>1920×1080</b><span>Frame</span></div>
          <div><b>60 fps</b><span>H.264</span></div>
          <div><b>4s–3 min</b><span>Length</span></div>
          <div><b>Music + voice</b><span>ElevenLabs Brian</span></div>
        </div>
      </section>
    </main>
  );
}
