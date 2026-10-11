import test from 'ava'
import http from 'http'
import nock from 'nock'
import zlib from 'zlib'

import ScreepsModules from './index'

const ok = [200, {ok: 1}]

function listen (server) {
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port))
  })
}

function close (server) {
  return new Promise(resolve => server.close(resolve))
}

test.before(() => {
  nock.disableNetConnect()
})

test('Test commit with defaults', async t => {
  t.plan(2)

  nock('https://screeps.com')
    .matchHeader('content-type', 'application/json')
    .matchHeader('accept', 'application/json')
    .post('/api/user/code', {
      branch: 'default',
      modules: {
        main: 'module.exports = () => {}'
      }
    })
    .basicAuth({
      user: 'foobar',
      pass: 'barbaz'
    })
    .reply(() => {
      t.pass()

      return ok
    })

  const client = await new ScreepsModules({
    email: 'foobar',
    password: 'barbaz'
  })
  const res = await client.commit('default', {
    main: 'module.exports = () => {}'
  })

  t.deepEqual(res, {ok: 1})
})

test('Test refresh token', async t => {
  t.plan(3)

  nock('https://screeps.com')
    .matchHeader('content-type', 'application/json')
    .matchHeader('accept', 'application/json')
    .post('/api/auth/signin', {
      email: 'foobar',
      password: 'barbaz'
    })
    .reply(() => {
      t.pass()

      return [200, {
        ok: 1,
        token: 'quuxnorf'
      }]
    })

  const client = await new ScreepsModules({
    email: 'foobar',
    password: 'barbaz'
  })

  const token = await client.refreshToken('/test')
  t.is(token, 'quuxnorf')
  t.is(client.options.token, token)
})

test('Test token in request', async t => {
  t.plan(1)

  nock('https://screeps.com')
    .matchHeader('x-token', 'foobar')
    .matchHeader('x-username', 'foobar')
    .get('/test')
    .reply(() => {
      t.pass()

      return ok
    })

  const client = await new ScreepsModules({
    token: 'foobar'
  })

  await client.request('/test')
})

test('Test always consumes token from response', async t => {
  const client = new ScreepsModules()

  nock('https://screeps.com')
    .get('/token-response')
    .reply(200, 'Foobar', {'X-Token': 'foobar'})

  await client.request('/token-response')
  t.is(client.options.token, 'foobar')
})

test('Test removes token on 401 responses', async t => {
  const client = new ScreepsModules({
    token: 'foobar'
  })

  nock('https://screeps.com')
    .get('/unauthorized')
    .reply(401, 'Unauthorized')

  try {
    await client.request('/unauthorized')

    t.fail()
  } catch (e) {
    t.is(client.options.token, '')
  }
})

test('Test custom server URL', async t => {
  t.plan(1)

  nock('http://localhost:8888')
    .post('/foo/api/user/code')
    .reply(() => {
      t.pass()

      return ok
    })

  await new ScreepsModules({
    serverUrl: 'http://localhost:8888/foo'
  }).commit()
})

test('Test custom server password', async t => {
  t.plan(1)

  nock('http://localhost:8888')
    .matchHeader('X-Server-Password', 'foobar')
    .post('/api/user/code')
    .reply(() => {
      t.pass()

      return ok
    })

  await new ScreepsModules({
    serverUrl: 'http://localhost:8888/',
    serverPassword: 'foobar'
  }).commit()
})

test('Test commit without branch', async t => {
  t.plan(1)

  nock('https://screeps.com')
    .post('/api/user/code', {
      modules: {foo: 'bar'}
    })
    .reply(() => {
      t.pass()

      return ok
    })

  await new ScreepsModules().commit({
    foo: 'bar'
  })
})

test('Test commit gzip', async t => {
  t.plan(2)

  nock('https://screeps.com')
    .matchHeader('content-encoding', 'gzip')
    .matchHeader('content-type', 'application/json')
    .post('/api/user/code')
    .reply((req, body) => {
      t.deepEqual(JSON.parse(zlib.gunzipSync(body).toString()), {
        modules: {
          foo: 'bar'
        }
      })
      t.pass()

      return ok
    })

  await new ScreepsModules({gzip: true})
    .commit({foo: 'bar'})
})

test('Test retrieve decompresses gzip responses', async t => {
  const payload = {main: 'module.exports = () => {}'}

  nock('https://screeps.com')
    .matchHeader('accept-encoding', 'gzip, deflate')
    .get('/api/user/code')
    .reply(200, zlib.gzipSync(JSON.stringify(payload)), {
      'Content-Encoding': 'gzip',
      'Content-Type': 'application/json'
    })

  const result = await new ScreepsModules().retrieve()
  t.deepEqual(result, payload)
})

test.serial('Test redirects preserve methods and strip cross-origin credentials', async t => {
  const received = []
  const sameOrigin = []
  const target = http.createServer((req, res) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      received.push({
        method: req.method,
        path: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString()
      })
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ok: 1}))
    })
  })
  const destination = await listen(target)
  const source = http.createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      if (req.url === '/loop') {
        res.statusCode = 302
        res.setHeader('location', '/loop')
      } else if (req.url === '/same-origin' || req.url === '/same-origin-basic') {
        res.statusCode = 302
        res.setHeader('location', req.url + '-target')
      } else if (req.url === '/same-origin-target' || req.url === '/same-origin-basic-target') {
        sameOrigin.push({path: req.url, headers: req.headers})
        res.setHeader('content-type', 'application/json')
        return res.end(JSON.stringify({ok: 1}))
      } else {
        if (req.url === '/post-301') res.statusCode = 301
        else if (req.url === '/post-303') res.statusCode = 303
        else if (req.url === '/post-307') res.statusCode = 307
        else res.statusCode = 302
        res.setHeader('location', destination + req.url + '-target')
      }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({redirect: 1}))
    })
  })
  const sourceUrl = await listen(source)
  nock.enableNetConnect('127.0.0.1')
  t.teardown(async () => {
    nock.disableNetConnect()
    await Promise.all([close(source), close(target)])
  })

  const tokenClient = new ScreepsModules({
    serverUrl: sourceUrl,
    token: 'token-secret',
    serverPassword: 'server-secret'
  })
  const defaultPost = await tokenClient.request('/post-default', {method: 'POST', json: {value: 0}})
  t.deepEqual(defaultPost, {redirect: 1})
  await tokenClient.request('/post-301', {method: 'POST', json: {value: 1}, followAllRedirects: true})
  await tokenClient.request('/post-302', {method: 'POST', json: {value: 2}, followAllRedirects: true})
  await tokenClient.request('/post-303', {method: 'POST', json: {value: 3}, followAllRedirects: true})
  await tokenClient.request('/post-307', {method: 'POST', json: {value: 4}, followAllRedirects: true})
  await tokenClient.request('/same-origin', {
    headers: {Cookie: 'session=secret', 'Proxy-Authorization': 'Basic proxy-secret'}
  })

  const basicClient = new ScreepsModules({
    serverUrl: sourceUrl,
    email: 'email-secret',
    password: 'password-secret',
    serverPassword: 'server-secret'
  })
  await basicClient.request('/same-origin-basic', {
    headers: {Cookie: 'session=secret', 'Proxy-Authorization': 'Basic proxy-secret'}
  })
  await basicClient.request('/basic', {
    method: 'GET',
    headers: {Cookie: 'session=secret', 'Proxy-Authorization': 'Basic proxy-secret'}
  })

  t.deepEqual(received.map(({method, path, body}) => ({method, path, body})), [
    {method: 'GET', path: '/post-301-target', body: ''},
    {method: 'GET', path: '/post-302-target', body: ''},
    {method: 'GET', path: '/post-303-target', body: ''},
    {method: 'POST', path: '/post-307-target', body: '{"value":4}'},
    {method: 'GET', path: '/basic-target', body: ''}
  ])
  received.forEach(({headers}) => {
    t.is(headers.authorization, undefined)
    t.is(headers['x-token'], undefined)
    t.is(headers['x-username'], undefined)
    t.is(headers['x-server-password'], undefined)
    t.is(headers.cookie, undefined)
    t.is(headers['proxy-authorization'], undefined)
  })
  t.is(sameOrigin[0].path, '/same-origin-target')
  t.is(sameOrigin[0].headers.authorization, undefined)
  t.is(sameOrigin[0].headers['x-token'], 'token-secret')
  t.is(sameOrigin[0].headers['x-username'], 'token-secret')
  t.is(sameOrigin[0].headers['x-server-password'], 'server-secret')
  t.is(sameOrigin[0].headers.cookie, 'session=secret')
  t.is(sameOrigin[0].headers['proxy-authorization'], 'Basic proxy-secret')
  t.is(sameOrigin[1].path, '/same-origin-basic-target')
  t.is(sameOrigin[1].headers.authorization, 'Basic ' + Buffer.from('email-secret:password-secret').toString('base64'))
  t.is(sameOrigin[1].headers.cookie, 'session=secret')

  await t.throwsAsync(tokenClient.request('/loop', {maxRedirects: 1}), {
    message: 'Exceeded max redirects'
  })
  await t.throwsAsync(tokenClient.request('/unused', {maxRedirects: -1}), {
    message: 'maxRedirects must be a non-negative integer'
  })
})

test('Test retrieve modules', async t => {
  t.plan(2)

  nock('https://screeps.com')
    .get('/api/user/code')
    .reply(() => {
      t.pass()

      return {
        main: 'module.exports = () => {}'
      }
    })

  const client = await new ScreepsModules()
  const res = await client.retrieve()

  t.deepEqual(res, {main: 'module.exports = () => {}'})
})

test('Test retrieve modules from branch', async t => {
  t.plan(1)

  nock('https://screeps.com')
    .matchHeader('accept-encoding', 'gzip, deflate')
    .get('/api/user/code')
    .query({branch: 'foobar'})
    .reply(() => {
      t.pass()

      return ok
    })

  const client = new ScreepsModules()
  await client.retrieve('foobar')
})

test('Test bad response', async t => {
  t.plan(2)

  nock('https://screeps.com')
    .get('/foo')
    .reply(() => {
      t.pass()

      return [400, 'Bad request']
    })

  const client = new ScreepsModules()

  try {
    await client.request('/foo')

    t.fail()
  } catch (e) {
    t.truthy(e.toString().match(/Bad request/))
  }
})

test('Test error in response', async t => {
  const client = new ScreepsModules()

  nock('https://screeps.com')
    .matchHeader('accept', 'application/json')
    .get('/bar')
    .reply(() => {
      t.pass()

      return [400, {error: 'Bad response'}]
    })

  try {
    await client.request('/bar', {method: 'GET', json: true})

    t.fail()
  } catch (e) {
    t.is(e.toString(), 'Bad response')
  }

  nock('https://screeps.com')
    .matchHeader('accept', 'application/json')
    .get('/baz')
    .reply(() => {
      t.pass()

      return [200, {error: 'Bad response'}]
    })

  try {
    await client.request('/baz', {method: 'GET', json: true})

    t.fail()
  } catch (e) {
    t.is(e.toString(), 'Bad response')
  }
})

test('Test aliases', t => {
  t.plan(5)

  class TestClient extends ScreepsModules {
    commit (...args) {
      t.deepEqual(args, ['foo', 'bar'])
    }

    retrieve (...args) {
      t.deepEqual(args, ['bar', 'baz'])
    }
  }

  const client = Object.create(TestClient.prototype)

  client.fetch('bar', 'baz')

  client.up('foo', 'bar')
  client.down('bar', 'baz')

  client.push('foo', 'bar')
  client.pull('bar', 'baz')
})
