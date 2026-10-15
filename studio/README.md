# Easy Agent Ad Pro

A short campaign studio that cuts brand stills into a real H.264 MP4. Ads run from 4 seconds to 3 minutes. There is no ad-network connection. Video upload is ready; the starter library is stills only.

## Run

```bash
cd studio
npm install
npm run dev
```

Open http://127.0.0.1:5173

The API listens on http://127.0.0.1:8787. To serve the built app from that port:

```bash
npm run build
npm start
```

## Export

Films are 1920×1080, 60 fps, H.264. Every export carries an original instrumental bed generated in the pipeline. The voice is ElevenLabs’ premade voice Brian (`eleven_multilingual_v2`). It is not a clone of a real person, and the renderer does not fall back to espeak or any other computer voice. Set `ELEVENLABS_API_KEY` in the environment before export. If that key is missing, the picture and music bed are still written and the voice step stops. Ads of 45 seconds or longer speak the full Easy Agent read at a natural pace. Shorter ads use a shorter line. The music ducks under the voice when the read is present.

The built-in renderer uses your stills, type, and brand color. It is not a generative video model.

An external model can be connected later with `VIDEO_MODEL_API_KEY` and `VIDEO_MODEL_API_URL`. Nothing is called without a key, and no key is stored in the app.
