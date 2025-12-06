// UPDATED: Version v8 (Bumped to support Shortcuts Offline)
const CACHE_NAME = 'kashif-pro-v8';

// LIST OF ALL FILES TO SAVE OFFLINE
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './bmi-calculator.html',
  './contact.html',
  './exponent.html',
  './fraction.html',
  './log-calculator.html',
  './mortgage-calculator.html',
  './percentage.html',
  './privacy.html',
  './standard-deviation.html',
  './terms.html',
  './manifest.json',
  './icon.png'
];

// 1. Install Event: Downloads all files
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching all assets...');
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Activate Event: Deletes OLD cache versions
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('Removing old cache:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// 3. Fetch Event
self.addEventListener('fetch', (e) => {
  
  // A. IGNORE Google Ads/Analytics (Don't cache these)
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // B. STRATEGY: Network First for HTML (Navigations)
  // This ensures users get updates, and fixes the "?mode=sci" shortcut offline issue
  if (e.request.mode === 'navigate' || e.request.headers.get('accept').includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // We cache the actual request (e.g., index.html?mode=sci)
            cache.put(e.request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          // OFFLINE FALLBACK LOGIC
          // If the exact URL isn't found (like index.html?mode=sci), 
          // allow it to fall back to the main 'index.html'
          return caches.match(e.request).then((match) => {
            return match || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // C. STRATEGY: Cache First for CSS/JS/Images (Speed)
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
