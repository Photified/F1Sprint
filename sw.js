const CACHE_NAME = 'f1-sprint-v1';

// List of local files we want to cache for offline play
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './js/game.js'
];

// 1. Install Event: Opens the cache and adds our assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Opened cache');
            return cache.addAll(ASSETS_TO_CACHE);
        })
        .then(() => self.skipWaiting())
    );
});

// 2. Activate Event: Cleans up any old versions of the cache if we update the app
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Clearing old cache');
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 3. Fetch Event: Intercepts network requests and serves from cache first
self.addEventListener('fetch', event => {
    // We only want to handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
        .then(response => {
            // Return the cached version if we have it, otherwise fetch from the network
            return response || fetch(event.request);
        })
        .catch(() => {
            console.log('Offline and asset not cached:', event.request.url);
        })
    );
});