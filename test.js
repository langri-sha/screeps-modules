import test from 'ava'
import { createServer } from 'node:http'
import { gunzipSync, gzipSync } from 'node:zlib'
import ScreepsModules from './index.js'

async function serve (t, respond) {
  const requests = []
  const server = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    requests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: Buffer.concat(chunks)
    })
    const [status, payload, headers = {}] = await respond(requests.at(-1), requests.length)
    res.writeHead(status, headers)
    res.end(payload)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.teardown(() => new Promise(resolve => server.close(resolve)))
  return { url: `http://127.0.0.1:${server.address().port}`, requests }
}

test('commit sends JSON and Basic auth over HTTP', async t => {
  const { url, requests } = await serve(t, () => [200, '{"ok":1}'])
  const client = new ScreepsModules({ serverUrl: url, email: 'foo', password: 'bar' })
  t.deepEqual(await client.commit('default', { main: 'code' }), { ok: 1 })
  t.is(requests[0].method, 'POST')
  t.is(requests[0].url, '/api/user/code')
  t.is(requests[0].headers.authorization, 'Basic Zm9vOmJhcg==')
  t.is(requests[0].headers['content-type'], 'application/json')
  t.is(requests[0].headers.accept, 'application/json')
  t.deepEqual(JSON.parse(requests[0].body), { branch: 'default', modules: { main: 'code' } })
})

test('commit omits branch when modules are first', async t => {
  const { url, requests } = await serve(t, () => [200, '{"ok":1}'])
  await new ScreepsModules({ serverUrl: url }).commit({ main: 'code' })
  t.deepEqual(JSON.parse(requests[0].body), { modules: { main: 'code' } })
})

test('signin sends credentials in JSON without an auth header', async t => {
  const { url, requests } = await serve(t, () => [200, '{"ok":1,"token":"new"}'])
  const client = new ScreepsModules({ serverUrl: url, email: 'foo', password: 'bar', token: 'old' })
  t.is(await client.refreshToken(), 'new')
  t.is(client.options.token, 'new')
  t.is(requests[0].url, '/api/auth/signin')
  t.falsy(requests[0].headers.authorization)
  t.falsy(requests[0].headers['x-token'])
  t.deepEqual(JSON.parse(requests[0].body), { email: 'foo', password: 'bar' })
})

test('token and server password are sent without Basic auth', async t => {
  const { url, requests } = await serve(t, () => [200, 'ok'])
  const client = new ScreepsModules({ serverUrl: url, token: 'abc', email: 'foo', password: 'bar', serverPassword: 'secret' })
  t.is(await client.request('/test'), 'ok')
  t.is(requests[0].headers['x-token'], 'abc')
  t.is(requests[0].headers['x-username'], 'abc')
  t.is(requests[0].headers['x-server-password'], 'secret')
  t.falsy(requests[0].headers.authorization)
})

test('custom base path, branch query, and gzip accept header are preserved', async t => {
  const { url, requests } = await serve(t, () => [200, '{"ok":1}'])
  t.deepEqual(await new ScreepsModules({ serverUrl: `${url}/foo/` }).retrieve('sim'), { ok: 1 })
  t.is(requests[0].url, '/foo/api/user/code?branch=sim')
  t.true(requests[0].headers['accept-encoding'].includes('gzip'))
})

test('gzip commit uploads compressed JSON bytes', async t => {
  const { url, requests } = await serve(t, () => [200, 'ok'])
  await new ScreepsModules({ serverUrl: url, gzip: true }).commit({ foo: 'bar' })
  t.is(requests[0].headers['content-encoding'], 'gzip')
  t.is(requests[0].headers['content-type'], 'application/json')
  t.deepEqual(JSON.parse(gunzipSync(requests[0].body)), { modules: { foo: 'bar' } })
})

test('retrieve decodes gzipped JSON', async t => {
  const payload = gzipSync(JSON.stringify({ main: 'code' }))
  const { url } = await serve(t, () => [200, payload, { 'Content-Encoding': 'gzip' }])
  t.deepEqual(await new ScreepsModules({ serverUrl: url }).retrieve(), { main: 'code' })
})

test('response token rotates and 401 clears it', async t => {
  const { url } = await serve(t, (_, count) => count === 1
    ? [200, 'ok', { 'X-Token': 'new' }]
    : [401, 'Unauthorized'])
  const client = new ScreepsModules({ serverUrl: url, token: 'old' })
  await client.request('/token')
  t.is(client.options.token, 'new')
  await client.request('/unauthorized').then(() => t.fail('Expected a 401 rejection'), error => t.is(error, 'Unauthorized'))
  t.is(client.options.token, '')
})

test('401 response token replaces the cleared token', async t => {
  const { url } = await serve(t, () => [401, 'Unauthorized', { 'X-Token': 'replacement' }])
  const client = new ScreepsModules({ serverUrl: url, token: 'old' })
  await client.request('/test').then(() => t.fail('Expected a 401 rejection'), error => t.is(error, 'Unauthorized'))
  t.is(client.options.token, 'replacement')
})

test('JSON error property rejects on success and failure statuses', async t => {
  const { url } = await serve(t, (_, count) => [count === 1 ? 200 : 400, '{"error":"Bad response"}'])
  const client = new ScreepsModules({ serverUrl: url })
  await client.request('/first', { json: true }).then(() => t.fail('Expected a body error'), error => t.is(error, 'Bad response'))
  await client.request('/second', { json: true }).then(() => t.fail('Expected an HTTP error'), error => t.is(error, 'Bad response'))
})

test('HTTP failure rejects with its response body', async t => {
  const { url } = await serve(t, () => [500, 'Server failed'])
  await new ScreepsModules({ serverUrl: url }).request('/test')
    .then(() => t.fail('Expected an HTTP error'), error => t.is(error, 'Server failed'))
})

test('network failure rejects without an HTTP response', async t => {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  await new Promise(resolve => server.close(resolve))
  await t.throwsAsync(new ScreepsModules({ serverUrl: url }).request('/test'), { instanceOf: TypeError })
})

test('caller cancellation rejects with its original reason', async t => {
  let received
  const started = new Promise(resolve => { received = resolve })
  const { url } = await serve(t, async () => {
    received()
    await new Promise(resolve => setTimeout(resolve, 100))
    return [200, 'late']
  })
  const controller = new AbortController()
  const reason = new Error('Cancelled by caller')
  const pending = new ScreepsModules({ serverUrl: url }).request('/slow', { signal: controller.signal, timeout: 500 })
  await started
  controller.abort(reason)
  await pending.then(() => t.fail('Expected cancellation'), error => t.is(error, reason))
})

test('timeout bounds the request and rejects with TimeoutError', async t => {
  const { url } = await serve(t, async () => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return [200, 'late']
  })
  const client = new ScreepsModules({ serverUrl: url })
  await t.throwsAsync(client.request('/slow', { timeout: 20 }), { name: 'TimeoutError' })
})

test('zero disables the timeout and invalid values reject', async t => {
  const { url } = await serve(t, () => [200, 'ok'])
  const client = new ScreepsModules({ serverUrl: url })
  t.is(await client.request('/test', { timeout: 0 }), 'ok')
  await t.throwsAsync(client.request('/test', { timeout: -1 }), { instanceOf: RangeError })
  await t.throwsAsync(client.request('/test', { timeout: 2147483648 }), { instanceOf: RangeError })
})

test('same-origin redirect retains authentication', async t => {
  const { url, requests } = await serve(t, req => req.url === '/start'
    ? [307, '', { Location: '/next' }]
    : [200, 'ok'])
  t.is(await new ScreepsModules({ serverUrl: url, token: 'abc' }).request('/start'), 'ok')
  t.is(requests.length, 2)
  t.is(requests[1].headers['x-token'], 'abc')
})

test('POST redirect switches to GET without forwarding the body', async t => {
  const { url, requests } = await serve(t, req => req.url === '/start'
    ? [303, '', { Location: '/next' }]
    : [200, 'ok'])
  const client = new ScreepsModules({ serverUrl: url })
  t.is(await client.request('/start', { method: 'POST', json: { value: 1 } }), 'ok')
  t.is(requests[1].method, 'GET')
  t.is(requests[1].body.length, 0)
  t.falsy(requests[1].headers['content-encoding'])
})

test('cross-origin redirect does not send credentials', async t => {
  const destination = await serve(t, () => [200, 'leaked'])
  const source = await serve(t, () => [302, '', { Location: `${destination.url}/next` }])
  const client = new ScreepsModules({ serverUrl: source.url, token: 'abc', serverPassword: 'secret' })
  await t.throwsAsync(client.request('/start'), { message: 'Cross-origin redirect is not allowed' })
  t.is(destination.requests.length, 0)
})

test('cross-origin redirect also blocks Basic auth', async t => {
  const destination = await serve(t, () => [200, 'leaked'])
  const source = await serve(t, () => [301, '', { Location: destination.url }])
  const client = new ScreepsModules({ serverUrl: source.url, email: 'foo', password: 'bar' })
  await t.throwsAsync(client.request('/start'), { message: 'Cross-origin redirect is not allowed' })
  t.is(destination.requests.length, 0)
})

test('too many redirects reject before another request', async t => {
  const { url, requests } = await serve(t, () => [307, '', { Location: '/again' }])
  await t.throwsAsync(new ScreepsModules({ serverUrl: url }).request('/start'), { message: 'Too many redirects' })
  t.is(requests.length, 11)
})

test.serial('HTTPS server URL is passed to fetch', async t => {
  const originalFetch = globalThis.fetch
  let target
  globalThis.fetch = async url => {
    target = url
    return new Response('ok')
  }
  try {
    t.is(await new ScreepsModules({ serverUrl: 'https://screeps.example/path' }).request('/test'), 'ok')
    t.is(target.href, 'https://screeps.example/path/test')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('aliases call commit and retrieve', t => {
  const calls = []
  class Client extends ScreepsModules {
    commit (...args) { calls.push(['commit', ...args]) }
    retrieve (...args) { calls.push(['retrieve', ...args]) }
  }
  const client = new Client()
  client.fetch('sim')
  client.up('sim', {})
  client.down('sim')
  client.push('sim', {})
  client.pull('sim')
  t.deepEqual(calls, [
    ['retrieve', 'sim'], ['commit', 'sim', {}], ['retrieve', 'sim'],
    ['commit', 'sim', {}], ['retrieve', 'sim']
  ])
})
