// Service Worker Altar Fisio — Cache Estático & Offline Resilience
const CACHE_NAME = "altarfisio-cache-v1"
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/manifest.webmanifest"
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  // Ignora chamadas para o WebSocket / API do Convex
  if (event.request.url.includes("convex.cloud") || event.request.url.includes(":3210")) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("/index.html")
          }
        })
      )
    })
  )
})
