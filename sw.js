self.addEventListener('install', (e) => {
  console.log('PWA Service Worker installed');
});

self.addEventListener('fetch', (e) => {
  // Це мінімальний код, щоб Chrome вважав сайт за PWA
  e.respondWith(fetch(e.request));
});
