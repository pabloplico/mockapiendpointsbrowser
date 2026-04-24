# MockGen

Browser-native mock API tool. Describe the data you want, Gemini generates it, you approve it, your app fetches it at a local URL. No server, no build step, no dependencies.

## Files

- **`mockgen.html`** — the UI. Open this to define and approve mocks.
- **`sw-mockgen.js`** — service worker. Intercepts `fetch` calls at this origin and returns your approved mocks.
- **`index.html`** — a small demo app with a fetch tester. Not required; delete it when integrating with your own app.
- **`start.bat`** — runs `python -m http.server 8000` in this folder.

## Quick start

1. Get a Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Double-click `start.bat`, or run in a terminal:
   ```
   python -m http.server 8000
   ```
3. Open `http://localhost:8000/mockgen.html` in your browser.
4. Paste your API key and click **Save**.
5. Click **+ New endpoint**, set method + path, describe the data, click **Generate**, then **Approve**.
6. Open `http://localhost:8000/` — the demo app — and fetch the same path. You'll see the mocked JSON with a green *"served by MockGen"* badge.

## How it works

Three pieces, all in the browser:

- The **UI** (`mockgen.html`) calls Gemini directly from the browser using your API key. Nothing goes through an intermediate server.
- Approved mocks are stored in **IndexedDB**, accessible from both the UI and the service worker.
- The **service worker** (`sw-mockgen.js`) registers at origin root and intercepts every `fetch` request. If URL + method match an approved mock, it returns the stored JSON. Otherwise it falls through to the network.

Because the service worker intercepts at the network layer, **the app being tested needs zero modification**. It just needs to be served from the same origin.

## Using it with your own app

The demo `index.html` is just for testing. To point MockGen at your real app:

- **Serve your app from the same origin** (e.g. `http://localhost:8000`) and drop `mockgen.html` + `sw-mockgen.js` into its static root.
- Open `/mockgen.html` to manage mocks. Open `/` (or whatever path your app lives at) to use your app.
- When using a framework dev server (Vite, Next, etc.), copy the two files into the static folder — `public/` for Vite/Next, `static/` for SvelteKit/Astro.

## Using it with a Replit app

Drop `mockgen.html` and `sw-mockgen.js` into your Replit's static file folder so they're served from the same origin as your app (`https://yourapp.username.repl.co`).

**Where that folder lives depends on your Replit template:**

- **Static HTML/JS Repl** — drop them next to `index.html` at the project root.
- **Vite / React / Svelte / Next.js** — `public/` (or `static/` for SvelteKit/Astro).
- **Express / Node** — put them in whatever folder is served by `express.static()`, usually `public/`. If you're not serving statics yet, add `app.use(express.static('public'))`.
- **Flask / Django** — serve from the framework's static folder. You may need a root-level route so the SW registers at scope `/` rather than `/static/`.

Then open `https://yourapp.username.repl.co/mockgen.html` to manage mocks, and use your app as normal — fetches will be intercepted.

**Notes:**

- Replit serves over HTTPS, which service workers require. No extra setup.
- The API key lives in your browser's localStorage, not in the Replit — it won't be committed or visible to collaborators.
- Put the SW file at the project root (`/sw-mockgen.js`) so its scope covers the whole app. If it's served from a subpath, its scope is limited to that subpath.
- Cross-origin setups won't work: if your frontend is on a different Replit (or on Netlify/Vercel) from your backend, MockGen can only intercept calls within its own origin.

## Workflow

- **Draft** — you've added the endpoint but haven't generated yet.
- **Generated** — Gemini returned JSON. Review it. If it's not right, click **Generate** again to retry.
- **Approved** — mock is live. Fetches from the app return this JSON.

Changing method, path, or description un-approves the mock automatically, so you never accidentally serve stale data.

## Works with

- Any web framework (React, Vue, Svelte, plain HTML)
- Any fetch-based HTTP client (`fetch`, `axios` with fetch adapter, `ofetch`, `wretch`)

## Does not work with

- Mobile apps or anything not running in a browser
- Apps on a different origin (different port counts as a different origin)
- XHR-only requests (rare today — most libraries use fetch)

## Limitations

- **Static responses.** `GET /api/users/1` and `GET /api/users/2` return the same data unless defined separately. Path parameters are backlog.
- **URL + method matching only.** No routing on request body or headers.
- **Browser-scoped state.** Clearing site data wipes mocks, endpoints, and the API key.
- **Gemini drift.** Generated data occasionally misses. Regenerate until it's right — cost is fractions of a cent per call.

## Troubleshooting

**"failed to register service worker"** — You're opening the file over `file://`. Service workers require HTTP. Use `start.bat` or `python -m http.server`.

**"Gemini returned invalid JSON"** — The error message includes a snippet of what Gemini actually returned. Usually a one-off; just click Generate again.

**Mock isn't being served** — Check the SW status indicator in the MockGen header (should say "active"). Confirm the endpoint's status badge is **approved**, not *generated*. Confirm your app is on the same origin as MockGen.

**Service worker seems stuck on an old version** — In Chrome DevTools → Application → Service Workers, click **Unregister**, then reload `mockgen.html`.

## Backlog

- Path params with dynamic responses (`/api/users/:id`)
- Scenarios — switch between happy path / empty / error
- Export to `db.json` for use with `json-server`
- Import OpenAPI spec to auto-generate endpoints
