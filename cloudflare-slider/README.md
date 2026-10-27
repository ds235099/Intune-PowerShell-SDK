# Slider button order

Cloudflare Worker that puts slider buttons back into normal working order.

Previous and Next start in `position: fixed`, pinned to the viewport outside the slider. On load, after resize, and whenever they are pinned again, the page measures the buttons and `POST /api/order` runs the same check on the Worker. Fixed buttons are switched into the dock under the slides: Previous, the slide count, then Next.

## Run

```sh
npm install
npm test
npm run dev
```

Open `http://127.0.0.1:8787`. Use Previous, Next, the arrow keys, or a horizontal swipe. **Pin buttons fixed** shows the broken pin, then the controls switch themselves back.

## Deploy

```sh
npx wrangler login
npm run check
npx wrangler deploy
```

`npm run check` bundles the Worker without publishing it.
