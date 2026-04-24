const DB_NAME = 'mockgen';
const DB_VERSION = 2;
const STORE = 'mocks';
const LOGS = 'logs';
const SETTINGS = 'settings';
const LOG_CAP = 500;
const CHANNEL = 'mockgen-log';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(LOGS)) db.createObjectStore(LOGS, { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function findMock(method, pathname) {
  const db = await openDB();
  const key = `${method} ${pathname}`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

let persistLog = false;
let pauseAll = false;
async function loadSettings() {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction(SETTINGS, 'readonly');
      const store = tx.objectStore(SETTINGS);
      const r1 = store.get('persist-log');
      const r2 = store.get('pause-all');
      r1.onsuccess = () => { persistLog = !!(r1.result && r1.result.value); };
      r2.onsuccess = () => { pauseAll = !!(r2.result && r2.result.value); };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function writeLog(entry) {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction(LOGS, 'readwrite');
      const store = tx.objectStore(LOGS);
      store.put(entry);
      const countReq = store.count();
      countReq.onsuccess = () => {
        const excess = countReq.result - LOG_CAP;
        if (excess <= 0) return;
        const cur = store.openCursor();
        let removed = 0;
        cur.onsuccess = (e) => {
          const c = e.target.result;
          if (!c || removed >= excess) return;
          c.delete();
          removed++;
          c.continue();
        };
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) { console.warn('[MockGen SW] log write failed', err); }
}

let channel;
try { channel = new BroadcastChannel(CHANNEL); } catch {}
function broadcast(entry) { if (channel) { try { channel.postMessage(entry); } catch {} } }

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  await self.clients.claim();
  await loadSettings();
})()));

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PING') {
    event.source.postMessage({ type: 'PONG' });
  }
  if (event.data && event.data.type === 'SETTINGS_CHANGED') {
    loadSettings();
  }
});

function toEmpty(v) {
  if (Array.isArray(v)) return [];
  if (v && typeof v === 'object') {
    for (const k of ['data', 'items', 'results', 'records', 'list']) {
      if (Array.isArray(v[k])) return { ...v, [k]: [] };
    }
    const arrayKeys = Object.keys(v).filter(k => Array.isArray(v[k]));
    if (arrayKeys.length === 1) return { ...v, [arrayKeys[0]]: [] };
    return {};
  }
  return null;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'X-MockGen': 'hit',
  'Access-Control-Allow-Origin': '*',
};

function buildResponse(mock) {
  const scenario = mock.scenario || 'normal';
  if (scenario === 'error') {
    return new Response(
      JSON.stringify({ error: { code: 500, message: 'Internal Server Error (MockGen error scenario)' } }),
      { status: 500, headers: { ...JSON_HEADERS, 'X-MockGen-Scenario': 'error' } }
    );
  }
  if (scenario === 'empty') {
    return new Response(
      JSON.stringify(toEmpty(mock.response)),
      { status: 200, headers: { ...JSON_HEADERS, 'X-MockGen-Scenario': 'empty' } }
    );
  }
  return new Response(
    JSON.stringify(mock.response),
    { status: 200, headers: { ...JSON_HEADERS, 'X-MockGen-Scenario': 'normal' } }
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/mockgen.html') || url.pathname.endsWith('/sw-mockgen.js')) return;

  event.respondWith((async () => {
    let entry = { t: Date.now(), method: req.method, path: url.pathname, hit: false, scenario: null, status: null };
    try {
      const mock = await findMock(req.method, url.pathname);
      if (mock && mock.approved && mock.enabled !== false && !pauseAll && mock.response !== undefined) {
        const scenario = mock.scenario || 'normal';
        if (scenario === 'loading') {
          await new Promise(r => setTimeout(r, 5 * 60 * 1000));
        }
        const res = buildResponse(mock);
        entry.hit = true;
        entry.scenario = scenario;
        entry.status = res.status;
        broadcast(entry);
        if (persistLog) writeLog(entry);
        return res;
      }
    } catch (err) {
      console.error('[MockGen SW]', err);
    }
    broadcast(entry);
    if (persistLog) writeLog(entry);
    return fetch(req);
  })());
});
