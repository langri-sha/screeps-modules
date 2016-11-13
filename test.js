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

  const client = await new ScreepsModules()
  await client.retrieve('foobar')
})
