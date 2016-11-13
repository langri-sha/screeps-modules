import test from 'ava'
import nock from 'nock'

import ScreepsCommit from './index'

const ok = [200, {ok: 1}]

test.before(() => {
  nock.disableNetConnect()
})

test('Test defaults', async t => {
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
  const res = await client.commit({
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

test('Test custom branch', async t => {
  t.plan(1)

  nock('https://screeps.com')
    .post('/api/user/code', {
      branch: 'borg'
    })
    .reply(() => {
      t.pass()

      return ok
    })

  await new ScreepsCommit({
    branch: 'borg'
  }).commit()
})
