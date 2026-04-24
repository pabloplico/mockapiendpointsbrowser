const DB_NAME = 'mockgen';
const DB_VERSION = 1;
const STORE = 'mocks';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
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

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PING') {
    event.source.postMessage({ type: 'PONG' });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/mockgen.html') || url.pathname.endsWith('/sw-mockgen.js')) return;

  event.respondWith((async () => {
    try {
      const mock = await findMock(req.method, url.pathname);
      if (mock && mock.approved && mock.response !== undefined) {
        return new Response(JSON.stringify(mock.response), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-MockGen': 'hit',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch (err) {
      console.error('[MockGen SW]', err);
    }
    return fetch(req);
  })());
});
