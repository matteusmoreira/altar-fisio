// Service Worker Altar Fisio — Cache Estático & Offline Resilience
const CACHE_NAME = "altarfisio-cache-v2"
const STATIC_ASSETS = [
  "/favicon.svg",
  "/manifest.webmanifest"
]

// Instalação do Service Worker e pré-cache de ativos essenciais
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Ativação e limpeza compulsória de versões antigas de cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[ServiceWorker] Expurgando cache obsoleto:", key)
            return caches.delete(key)
          }
        })
      )
    })
  )
  return self.clients.claim()
})

// Recebimento de mensagens do cliente (ex: forçar ativação imediata)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

// Interceptação inteligente de tráfego de rede
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Ignora chamadas para o WebSocket / API do Convex ou origens externas
  if (
    url.origin !== self.location.origin ||
    url.pathname.includes("convex.cloud") ||
    url.port === "3210"
  ) {
    return
  }

  // 1. REQUISIÇÕES DE NAVEGAÇÃO / DOCUMENTO HTML (ex: "/", "/index.html", rotas SPA)
  // Estratégia: NETWORK-FIRST.
  // Garante que o navegador receba sempre o index.html mais recente com os hashes de build atualizados.
  // Caso esteja offline ou a rede falhe, recorre ao cache local de segurança.
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || caches.match("/") || caches.match("/index.html")
          })
        })
    )
    return
  }

  // 2. DEMAIS ASSETS ESTÁTICOS (JS, CSS, imagens, fontes)
  // Estratégia: Cache-First para arquivos com hash de build, com salvaguarda contra HTML de 404
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached
      }
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          // Salvaguarda: se um .js ou .css retornar text/html (erro de rewrite de 404), não cachear!
          const contentType = response.headers.get("content-type") || ""
          if (
            (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) &&
            contentType.includes("text/html")
          ) {
            return response
          }
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})
