// ============================================================
// SERVICE WORKER — Estratégia Network First para JS/CSS/HTML
// Cache First apenas para imagens/ícones (raramente mudam)
// ============================================================

// Atualize este valor a cada deploy para limpar caches antigos
const CACHE_VERSION = 'kanban-v1.48-20260923';
const CACHE_STATIC  = CACHE_VERSION + '-static';

// Apenas assets que raramente mudam vão para cache permanente
const STATIC_ASSETS = [
  './assets/icon-192.png',
  './assets/icon-512.png',
  './manifest.json'
];

// ─── INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // Ativa imediatamente sem esperar fechar abas
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_STATIC) // Remove todos os caches antigos
          .map(name => {
            console.log('[SW] Removendo cache antigo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim()) // Assume controle imediato de todas as abas
  );
});

// ─── FETCH ───────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Ignora requisições externas (Supabase, CDN, Google Fonts, etc.)
  if (url.origin !== self.location.origin) {
    return; // Deixa o navegador tratar normalmente
  }

  // 2. Ignora requisições que não são GET
  if (event.request.method !== 'GET') {
    return;
  }

  const isStaticAsset =
    url.pathname.includes('/assets/') ||
    url.pathname.endsWith('.png')  ||
    url.pathname.endsWith('.ico')  ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.jpg');

  if (isStaticAsset) {
    // ── Cache First para imagens/ícones ──────────────────────
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  } else {
    // ── Network First para HTML, JS, CSS ─────────────────────
    // Sempre busca da rede primeiro — cache só como fallback offline
    event.respondWith(
      fetch(event.request)
        .then(response => response) // Retorna resposta fresca da rede
        .catch(() => {
          // Offline: tenta servir do cache como fallback
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            // Fallback final para navegação offline
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
        })
    );
  }
});
