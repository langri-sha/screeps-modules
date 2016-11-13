import test from 'ava'
import nock from 'nock'

import ScreepsCommit from './index'

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

  const client = await new ScreepsCommit({
    email: 'foobar',
    password: 'barbaz'
  })
  const res = await client.commit('default', {
    main: 'module.exports = () => {}'
  })

  t.deepEqual(res, {ok: 1})
})

test('Test custom API URL', async t => {
  t.plan(1)

  nock('http://localhost:8888')
    .post('/foo/api/user/code')
    .reply(() => {
      t.pass()

      return ok
    })

  await new ScreepsCommit({
    apiUrl: 'http://localhost:8888/foo'
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

  await new ScreepsCommit().commit({
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

  await new ScreepsCommit({gzip: true})
    .commit({foo: 'bar'})
})

test('Test fetch modules', async t => {
  t.plan(2)

  nock('https://screeps.com')
    .get('/api/user/code')
    .reply(() => {
      t.pass()

      return {
        main: 'module.exports = () => {}'
      }
    })

  const client = await new ScreepsCommit()
  const res = await client.fetch()

  t.deepEqual(res, {main: 'module.exports = () => {}'})
})

test('Test fetch modules from branch', async t => {
  t.plan(1)

  nock('https://screeps.com')
    .matchHeader('accept-encoding', 'gzip, deflate')
    .get('/api/user/code')
    .query({branch: 'foobar'})
    .reply(() => {
      t.pass()

      return ok
    })

  const client = await new ScreepsCommit()
  await client.fetch('foobar')
})
