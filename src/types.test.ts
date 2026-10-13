import { expectTypeOf, test } from '@langri-sha/vitest'

import ScreepsModules from './index.js'

test('the client accepts the documented options', () => {
  const client = new ScreepsModules({
    email: 'EMAIL',
    password: 'PASSWORD',
    token: 'TOKEN',
    serverUrl: 'https://screeps.com',
    serverPassword: 'SERVER_PASS',
    gzip: false,
  })

  expectTypeOf(client.options.serverUrl).toBeString()
})

test('commit takes an optional branch before the modules', () => {
  const client = new ScreepsModules()

  expectTypeOf(client.commit({ main: 'code' })).resolves.toHaveProperty('ok')
  expectTypeOf(client.commit('sim', { main: 'code' })).resolves.toHaveProperty(
    'ok',
  )
})

test('retrieve takes an optional branch', () => {
  const client = new ScreepsModules()

  expectTypeOf(client.retrieve()).resolves.toHaveProperty('ok')
  expectTypeOf(client.retrieve('sim')).resolves.toHaveProperty('ok')
})

test('refreshToken resolves the token', () => {
  expectTypeOf(new ScreepsModules().refreshToken()).resolves.toEqualTypeOf<
    string | undefined
  >()
})
