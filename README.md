# MockGen

Browser-native mock API. Describe data → Gemini generates it → you approve it → your app's `fetch()` calls return it. No server, no build step.

## Files

- `mockgen.html` — UI
- `sw-mockgen.js` — service worker
- `index.html` — demo app (delete when integrating)
- `start.bat` — runs `python -m http.server 8000`

## Quick start

1. Get a Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Run `start.bat` (or `python -m http.server 8000`).
3. Open `http://localhost:8000/mockgen.html`, paste the key, save.
4. **New endpoint** → set method + path → describe → **Generate** → **Approve**.
5. Open `http://localhost:8000/` — `fetch()` to the same path now returns your mock.

## Integrating with your app

Drop `mockgen.html` and `sw-mockgen.js` into your app's static folder at the project root so they're served from the **same origin** as the app — different port = different origin.

- **Vite / Next.js / CRA / Express** → `public/`
- **SvelteKit / Astro** → `static/`
- **Plain HTML** → next to `index.html`
- **Flask / Django** → static folder; add a root-level route so the SW scopes to `/`
- **Replit** → whichever of the above matches your template

Open `/mockgen.html` to manage mocks and use your app as normal.

## How it works

The UI calls Gemini from the browser with your API key (stored in `localStorage`, never proxied). Approved mocks land in IndexedDB. The service worker reads IDB on every fetch — if URL + method match an approved mock, it returns the stored JSON; otherwise it falls through to the network. Your app needs zero modification.

## Features

- **Generate / Refine / Edit** — generate with Gemini, refine with natural-language feedback, or edit the JSON directly.
- **Scenarios** — flip each endpoint between Normal (200), Empty, Error (500), and Loading (5-min hang). Served with an `X-MockGen-Scenario` header.
- **Raw / Table preview** — table auto-detects arrays, `{data: [...]}` wrappers, and plain objects.
- **Enable / disable** — per-endpoint switch and a master pause. Disabled = pass through.
- **Import / Export** — JSON file, merges by `method + path`.
- **Copy fetch** — ready-to-paste snippet per HTTP method.
- **Request log** — live panel; optional persistence while closed.
- **Basic / Advanced** — header toggle gates heavier features.

## Limits

- **Same-origin only.** Browser-only; no mobile/native.
- **URL + method matching.** No routing on body or headers.
- **Static responses.** `/api/users/1` and `/api/users/2` are separate mocks.
- **No write-through.** `POST /api/users` doesn't show up in `GET /api/users`.
- **Browser-scoped state.** Clearing site data wipes mocks and key.

## Troubleshooting

- **"Failed to register service worker"** — you're on `file://`. SWs need HTTP. Use `start.bat`.
- **Mock not firing** — header status should say "active"; endpoint must be **approved** and its switch on.
- **Stale SW** — DevTools → Application → Service Workers → Unregister, reload.
