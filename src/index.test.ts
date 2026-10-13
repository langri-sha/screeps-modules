import { type IncomingHttpHeaders, type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gunzipSync, gzipSync } from 'node:zlib'

import { expect, onTestFinished, test } from '@langri-sha/vitest'

import ScreepsModules, { type CommitArguments } from './index.js'

interface RecordedRequest {
  method?: string
  url?: string
  headers: IncomingHttpHeaders
  body: Buffer
}

type Reply = [
  status: number,
  payload: string | Buffer,
  headers?: Record<string, string>,
]

async function serve(
  respond: (request: RecordedRequest, count: number) => Reply | Promise<Reply>,
) {
  const requests: RecordedRequest[] = []
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk)
    const request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: Buffer.concat(chunks),
    }
    requests.push(request)
    const [status, payload, headers = {}] = await respond(
      request,
      requests.length,
    )
    res.writeHead(status, headers)
    res.end(payload)
  })
  const port = await listen(server)
  onTestFinished(() => close(server))
  return { url: `http://127.0.0.1:${port}`, requests }
}

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return (server.address() as AddressInfo).port
}

function close(server: Server) {
  return new Promise<void>((resolve) => server.close(() => resolve()))
}

test('commit sends JSON and Basic auth over HTTP', async () => {
  const { url, requests } = await serve(() => [200, '{"ok":1}'])
  const client = new ScreepsModules({
    serverUrl: url,
    email: 'foo',
    password: 'bar',
  })
  expect(await client.commit('default', { main: 'code' })).toEqual({ ok: 1 })
  expect(requests[0].method).toBe('POST')
  expect(requests[0].url).toBe('/api/user/code')
  expect(requests[0].headers.authorization).toBe('Basic Zm9vOmJhcg==')
  expect(requests[0].headers['content-type']).toBe('application/json')
  expect(requests[0].headers.accept).toBe('application/json')
  expect(JSON.parse(requests[0].body.toString())).toEqual({
    branch: 'default',
    modules: { main: 'code' },
  })
})

test('commit omits branch when modules are first', async () => {
  const { url, requests } = await serve(() => [200, '{"ok":1}'])
  await new ScreepsModules({ serverUrl: url }).commit({ main: 'code' })
  expect(JSON.parse(requests[0].body.toString())).toEqual({
    modules: { main: 'code' },
  })
})

test('signin sends credentials in JSON without an auth header', async () => {
  const { url, requests } = await serve(() => [200, '{"ok":1,"token":"new"}'])
  const client = new ScreepsModules({
    serverUrl: url,
    email: 'foo',
    password: 'bar',
    token: 'old',
  })
  expect(await client.refreshToken()).toBe('new')
  expect(client.options.token).toBe('new')
  expect(requests[0].url).toBe('/api/auth/signin')
  expect(requests[0].headers.authorization).toBeFalsy()
  expect(requests[0].headers['x-token']).toBeFalsy()
  expect(JSON.parse(requests[0].body.toString())).toEqual({
    email: 'foo',
    password: 'bar',
  })
})

test('token and server password are sent without Basic auth', async () => {
  const { url, requests } = await serve(() => [200, 'ok'])
  const client = new ScreepsModules({
    serverUrl: url,
    token: 'abc',
    email: 'foo',
    password: 'bar',
    serverPassword: 'secret',
  })
  expect(await client.request('/test')).toBe('ok')
  expect(requests[0].headers['x-token']).toBe('abc')
  expect(requests[0].headers['x-username']).toBe('abc')
  expect(requests[0].headers['x-server-password']).toBe('secret')
  expect(requests[0].headers.authorization).toBeFalsy()
})

test('custom base path, branch query, and gzip accept header are preserved', async () => {
  const { url, requests } = await serve(() => [200, '{"ok":1}'])
  expect(
    await new ScreepsModules({ serverUrl: `${url}/foo/` }).retrieve('sim'),
  ).toEqual({ ok: 1 })
  expect(requests[0].url).toBe('/foo/api/user/code?branch=sim')
  expect(requests[0].headers['accept-encoding']?.includes('gzip')).toBe(true)
})

test('gzip commit uploads compressed JSON bytes', async () => {
  const { url, requests } = await serve(() => [200, 'ok'])
  await new ScreepsModules({ serverUrl: url, gzip: true }).commit({
    foo: 'bar',
  })
  expect(requests[0].headers['content-encoding']).toBe('gzip')
  expect(requests[0].headers['content-type']).toBe('application/json')
  expect(JSON.parse(gunzipSync(requests[0].body).toString())).toEqual({
    modules: { foo: 'bar' },
  })
})

test('retrieve decodes gzipped JSON', async () => {
  const payload = gzipSync(JSON.stringify({ main: 'code' }))
  const { url } = await serve(() => [
    200,
    payload,
    { 'Content-Encoding': 'gzip' },
  ])
  expect(await new ScreepsModules({ serverUrl: url }).retrieve()).toEqual({
    main: 'code',
  })
})

test('response token rotates and 401 clears it', async () => {
  const { url } = await serve((_, count) =>
    count === 1 ? [200, 'ok', { 'X-Token': 'new' }] : [401, 'Unauthorized'],
  )
  const client = new ScreepsModules({ serverUrl: url, token: 'old' })
  await client.request('/token')
  expect(client.options.token).toBe('new')
  await expect(client.request('/unauthorized')).rejects.toBe('Unauthorized')
  expect(client.options.token).toBe('')
})

test('401 response token replaces the cleared token', async () => {
  const { url } = await serve(() => [
    401,
    'Unauthorized',
    { 'X-Token': 'replacement' },
  ])
  const client = new ScreepsModules({ serverUrl: url, token: 'old' })
  await expect(client.request('/test')).rejects.toBe('Unauthorized')
  expect(client.options.token).toBe('replacement')
})

test('JSON error property rejects on success and failure statuses', async () => {
  const { url } = await serve((_, count) => [
    count === 1 ? 200 : 400,
    '{"error":"Bad response"}',
  ])
  const client = new ScreepsModules({ serverUrl: url })
  await expect(client.request('/first', { json: true })).rejects.toBe(
    'Bad response',
  )
  await expect(client.request('/second', { json: true })).rejects.toBe(
    'Bad response',
  )
})

test('HTTP failure rejects with its response body', async () => {
  const { url } = await serve(() => [500, 'Server failed'])
  await expect(
    new ScreepsModules({ serverUrl: url }).request('/test'),
  ).rejects.toBe('Server failed')
})

test('network failure rejects without an HTTP response', async () => {
  const server = createServer()
  const url = `http://127.0.0.1:${await listen(server)}`
  await close(server)
  await expect(
    new ScreepsModules({ serverUrl: url }).request('/test'),
  ).rejects.toBeInstanceOf(TypeError)
})

test('caller cancellation rejects with its original reason', async () => {
  let received: () => void = () => {}
  const started = new Promise<void>((resolve) => {
    received = resolve
  })
  const { url } = await serve(async () => {
    received()
    await new Promise((resolve) => setTimeout(resolve, 100))
    return [200, 'late']
  })
  const controller = new AbortController()
  const reason = new Error('Cancelled by caller')
  const pending = new ScreepsModules({ serverUrl: url }).request('/slow', {
    signal: controller.signal,
    timeout: 500,
  })
  await started
  controller.abort(reason)
  await expect(pending).rejects.toBe(reason)
})

test('timeout bounds the request and rejects with TimeoutError', async () => {
  const { url } = await serve(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return [200, 'late']
  })
  const client = new ScreepsModules({ serverUrl: url })
  await expect(client.request('/slow', { timeout: 20 })).rejects.toMatchObject({
    name: 'TimeoutError',
  })
})

test('zero disables the timeout and invalid values reject', async () => {
  const { url } = await serve(() => [200, 'ok'])
  const client = new ScreepsModules({ serverUrl: url })
  expect(await client.request('/test', { timeout: 0 })).toBe('ok')
  await expect(client.request('/test', { timeout: -1 })).rejects.toBeInstanceOf(
    RangeError,
  )
  await expect(
    client.request('/test', { timeout: 2147483648 }),
  ).rejects.toBeInstanceOf(RangeError)
})

test('same-origin redirect retains authentication', async () => {
  const { url, requests } = await serve((req) =>
    req.url === '/start' ? [307, '', { Location: '/next' }] : [200, 'ok'],
  )
  expect(
    await new ScreepsModules({ serverUrl: url, token: 'abc' }).request(
      '/start',
    ),
  ).toBe('ok')
  expect(requests.length).toBe(2)
  expect(requests[1].headers['x-token']).toBe('abc')
})

test('POST redirect switches to GET without forwarding the body', async () => {
  const { url, requests } = await serve((req) =>
    req.url === '/start' ? [303, '', { Location: '/next' }] : [200, 'ok'],
  )
  const client = new ScreepsModules({ serverUrl: url })
  expect(
    await client.request('/start', { method: 'POST', json: { value: 1 } }),
  ).toBe('ok')
  expect(requests[1].method).toBe('GET')
  expect(requests[1].body.length).toBe(0)
  expect(requests[1].headers['content-encoding']).toBeFalsy()
})

for (const status of [301, 302]) {
  test(`${status} rewrites POST to GET without forwarding the body`, async () => {
    const { url, requests } = await serve((req) =>
      req.url === '/start' ? [status, '', { Location: '/next' }] : [200, 'ok'],
    )
    const client = new ScreepsModules({ serverUrl: url })
    expect(
      await client.request('/start', { method: 'POST', json: { value: 1 } }),
    ).toBe('ok')
    expect(requests[1].method).toBe('GET')
    expect(requests[1].body.length).toBe(0)
    expect(requests[1].headers['content-type']).toBeFalsy()
  })
}

test('303 preserves HEAD', async () => {
  const { url, requests } = await serve((req) =>
    req.url === '/start' ? [303, '', { Location: '/next' }] : [200, 'ok'],
  )
  const client = new ScreepsModules({ serverUrl: url })
  expect(await client.request('/start', { method: 'HEAD' })).toBe('')
  expect(requests[1].method).toBe('HEAD')
})

test('308 preserves POST method and body', async () => {
  const { url, requests } = await serve((req) =>
    req.url === '/start' ? [308, '', { Location: '/next' }] : [200, 'ok'],
  )
  const client = new ScreepsModules({ serverUrl: url })
  expect(
    await client.request('/start', { method: 'POST', json: { value: 1 } }),
  ).toBe('ok')
  expect(requests[1].method).toBe('POST')
  expect(JSON.parse(requests[1].body.toString())).toEqual({ value: 1 })
  expect(requests[1].headers['content-type']).toBe('application/json')
})

test('cross-origin redirect does not send credentials', async () => {
  const destination = await serve(() => [200, 'leaked'])
  const source = await serve(() => [
    302,
    '',
    { Location: `${destination.url}/next` },
  ])
  const client = new ScreepsModules({
    serverUrl: source.url,
    token: 'abc',
    serverPassword: 'secret',
  })
  await expect(client.request('/start')).rejects.toMatchObject({
    message: 'Cross-origin redirect is not allowed',
  })
  expect(destination.requests.length).toBe(0)
})

test('cross-origin redirect also blocks Basic auth', async () => {
  const destination = await serve(() => [200, 'leaked'])
  const source = await serve(() => [301, '', { Location: destination.url }])
  const client = new ScreepsModules({
    serverUrl: source.url,
    email: 'foo',
    password: 'bar',
  })
  await expect(client.request('/start')).rejects.toMatchObject({
    message: 'Cross-origin redirect is not allowed',
  })
  expect(destination.requests.length).toBe(0)
})

test('too many redirects reject before another request', async () => {
  const { url, requests } = await serve(() => [307, '', { Location: '/again' }])
  await expect(
    new ScreepsModules({ serverUrl: url }).request('/start'),
  ).rejects.toMatchObject({ message: 'Too many redirects' })
  expect(requests.length).toBe(11)
})

test('HTTPS server URL is passed to fetch', async () => {
  const originalFetch = globalThis.fetch
  let target: URL | undefined
  globalThis.fetch = (async (url: URL) => {
    target = url
    return new Response('ok')
  }) as typeof fetch
  try {
    expect(
      await new ScreepsModules({
        serverUrl: 'https://screeps.example/path',
      }).request('/test'),
    ).toBe('ok')
    expect(target?.href).toBe('https://screeps.example/path/test')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('aliases call commit and retrieve', () => {
  const calls: unknown[][] = []
  class Client extends ScreepsModules {
    override async commit(...args: CommitArguments) {
      calls.push(['commit', ...args])
      return { ok: 1 }
    }
    override async retrieve(...args: [branch?: string]) {
      calls.push(['retrieve', ...args])
      return { ok: 1 }
    }
  }
  const client = new Client()
  client.fetch('sim')
  client.up('sim', {})
  client.down('sim')
  client.push('sim', {})
  client.pull('sim')
  expect(calls).toEqual([
    ['retrieve', 'sim'],
    ['commit', 'sim', {}],
    ['retrieve', 'sim'],
    ['commit', 'sim', {}],
    ['retrieve', 'sim'],
  ])
})
