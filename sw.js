// Service Worker para PWA - Plan de Mejora IES Virgen de Villadiego

const CACHE_NAME = 'plan-mejora-v2.3.1';

// Recursos estáticos a cachear en la instalación
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js'
];

// Instalación: cachear recursos estáticos
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cacheando recursos estáticos');
      return cache.addAll(URLS_TO_CACHE);
    }).catch(err => {
      console.warn('[SW] Error cacheando algunos recursos:', err);
    })
  );
  // Activar inmediatamente sin esperar a que se cierre la página anterior
  self.skipWaiting();
});

// Activación: limpiar cachés antiguas
self.addEventListener('activate', event => {
  console.log('[SW] Activando Service Worker...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Eliminando caché antigua:', key);
              return caches.delete(key);
            })
      );
    })
  );
  // Tomar control de todas las pestañas abiertas inmediatamente
  self.clients.claim();
});

// Estrategia de fetch: Network First con fallback a caché
// Ideal para apps con datos dinámicos (Firestore)
self.addEventListener('fetch', event => {
  // Ignorar peticiones no GET
  if (event.request.method !== 'GET') return;

  // Ignorar peticiones a Firebase (siempre van a red)
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        console.warn('[SW] Sin conexión para Firebase, usando caché si existe');
        return caches.match(event.request);
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clonar la respuesta y guardarla en caché
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si no hay red, intentar servir desde caché
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si no está en caché, devolver la página principal (para rutas desconocidas)
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Sin conexión', { status: 503, statusText: 'Sin conexión' });
        });
      })
  );
});
