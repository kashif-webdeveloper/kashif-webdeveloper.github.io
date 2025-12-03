const CACHE_NAME = 'kashif-calc-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './privacy.html',
    './terms.html',
    './contact.html',
    './manifest.json',
    './Kashi calculator.png',
    './scientific calculator.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.hostname.includes('google') || 
        url.hostname.includes('gstatic') || 
        url.hostname.includes('doubleclick') || 
        url.hostname.includes('analytics')) {
        return; 
    }
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
    );
});
