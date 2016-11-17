import test from 'ava'
import nock from 'nock'

import ScreepsModules from './index'

const ok = [200, {ok: 1}]

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
      t.deepEqual(body, {
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
