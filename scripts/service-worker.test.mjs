import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'

async function navigateOffline(entries) {
  const listeners = {}
  const context = {
    URL,
    Response,
    self: {
      location: { origin: 'https://fixture.invalid' },
      addEventListener: (name, handler) => { listeners[name] = handler },
    },
    fetch: async () => { throw new Error('offline') },
    caches: { match: async key => entries.get(typeof key === 'string' ? key : key.url) },
  }
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), context)
  let response
  listeners.fetch({
    request: { url: 'https://fixture.invalid/portal', mode: 'navigate' },
    respondWith: promise => { response = promise },
  })
  return await response
}

test('offline navigation falls back to cached index when root is missing', async () => {
  const cachedIndex = { status: 200, body: 'fixture-app-shell' }
  assert.equal(await navigateOffline(new Map([['/index.html', cachedIndex]])), cachedIndex)
})

test('offline navigation prefers its exact cached route', async () => {
  const cachedRoute = { status: 200, body: 'fixture-route' }
  assert.equal(await navigateOffline(new Map([
    ['https://fixture.invalid/portal', cachedRoute],
    ['/index.html', { status: 200 }],
  ])), cachedRoute)
})

test('offline navigation without cache returns an explicit unavailable response', async () => {
  const response = await navigateOffline(new Map())
  assert.equal(response.status, 503)
  assert.match(await response.text(), /Sem conexão/)
})
