// LUCI PWA — Service Worker
const CACHE = 'luci-v1';
const ASSETS = [
  '/',
  '/styles.css',
  '/js/tasks.css',
  '/js/app-core.js',
  '/js/app-playbook.js',
  '/js/app-projects.js',
  '/js/app-tasks.js',
  '/js/app-prep.js',
  '/js/app-daily-manager.js',
  '/js/app-dova.js',
  '/js/app-luna.js',
  '/manifest.json',
  '/assets/LUCI_icon_tile.png',
  '/assets/luci-home-icon.jpg',
  '/assets/level-up-app-icon.svg',
  '/assets/level-up-logo.png',
  '/assets/LUCI_lockup_ink.svg',
  '/assets/lockup-black.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // API calls — network only
  if (e.request.url.includes('/api/')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});