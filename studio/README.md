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

Films are 1920×1080, 60 fps, H.264. The built-in renderer uses your stills, type, and brand color. It is not a generative video model.

An external model can be connected later with `VIDEO_MODEL_API_KEY` and `VIDEO_MODEL_API_URL`. Nothing is called without a key, and no key is stored in the app.
