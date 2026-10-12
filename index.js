const debug = require('debug')('screeps-modules')
const zlib = require('zlib')

module.exports = class ScreepsModules {
  constructor (options) {
    this.options = Object.assign({}, {
      email: '',
      password: '',
      token: '',
      serverUrl: 'https://screeps.com',
      serverPassword: '',
      gzip: false
    }, options)
  }

  refreshToken () {
    const { email, password } = this.options

    return this.request('/api/auth/signin', {
      method: 'POST',
      json: {
        email,
        password
      }
    })
      .then(({ ok, token }) => {
        if (ok) {
          this.options.token = token

          return token
        }
      })
  }

  commit (branch, modules) {
    if (!modules) {
      modules = branch
      branch = undefined
    }

    if (!this.options.gzip) {
      return this.request('/api/user/code', {
        method: 'POST',
        json: {
          branch,
          modules
        }
      })
    }

    const compressed = zlib.gzipSync(JSON.stringify({
      branch,
      modules
    }))

    return this.request('/api/user/code', {
      method: 'POST',
      headers: {
        'Content-Encoding': 'gzip',
        'Content-Type': 'application/json'
      },
      body: compressed
    })
  }

  retrieve (branch) {
    return this.request('/api/user/code', {
      method: 'GET',
      gzip: true,
      json: true,
      qs: {
        branch
      }
    })
  }

  fetch (...args) {
    return this.retrieve(...args)
  }

  up (...args) {
    return this.commit(...args)
  }

  down (...args) {
    return this.retrieve(...args)
  }

  push (...args) {
    return this.commit(...args)
  }

  pull (...args) {
    return this.retrieve(...args)
  }

  async request (url, options = {}) {
    const base = this.options.serverUrl.replace(/\/$/, '') + '/'
    let target = new URL(url.replace(/^\//, ''), base)
    const headers = new Headers(options.headers)
    const auth = { headers: Object.fromEntries(headers) }
    this.auth(url, auth)

    for (const [name, value] of Object.entries(auth.headers || {})) {
      headers.set(name, value)
    }

    if (auth.auth) {
      const { username, password } = auth.auth
      headers.set('Authorization', `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`)
    }

    let body = options.body
    if (options.json && options.json !== true) {
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.json)
    }
    if (options.json && !headers.has('Accept')) headers.set('Accept', 'application/json')

    let method = options.method || 'GET'
    const origin = new URL(base).origin
    if (options.timeout != null && (!Number.isInteger(options.timeout) || options.timeout < 0 || options.timeout > 2147483647)) {
      throw new RangeError('timeout must be an integer from 0 to 2147483647 milliseconds')
    }
    const timeoutSignal = options.timeout > 0 ? AbortSignal.timeout(options.timeout) : undefined
    const signals = [options.signal, timeoutSignal].filter(signal => signal != null)
    const signal = signals.length === 2 ? AbortSignal.any(signals) : signals[0]
    if (options.qs) {
      for (const [key, value] of Object.entries(options.qs)) {
        if (value !== undefined) target.searchParams.set(key, value)
      }
    }

    for (let redirects = 0; ; redirects++) {
      if (!['http:', 'https:'].includes(target.protocol)) {
        throw new Error(`Unsupported URL protocol: ${target.protocol}`)
      }
      if (target.origin !== origin) {
        throw new Error('Cross-origin request is not allowed')
      }
      debug(`Requesting ${method} ${target}`)
      const response = await fetch(target, {
        method,
        headers,
        body,
        signal,
        redirect: 'manual'
      })

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel()
        if (redirects >= 10) throw new Error('Too many redirects')
        const location = response.headers.get('location')
        if (!location) throw new Error('Redirect response has no location')
        const next = new URL(location, target)
        if (next.origin !== origin) throw new Error('Cross-origin redirect is not allowed')
        if ((response.status === 303 && method.toUpperCase() !== 'HEAD') || ((response.status === 301 || response.status === 302) && method.toUpperCase() === 'POST')) {
          method = 'GET'
          body = undefined
          headers.delete('Content-Type')
          headers.delete('Content-Encoding')
        }
        target = next
        continue
      }

      if (response.status === 401) this.options.token = ''
      const token = response.headers.get('x-token')
      if (token) this.options.token = token

      const text = await response.text()
      let result = text
      if (options.json && text) {
        try {
          result = JSON.parse(text)
        } catch (error) {
          debug(`Non-JSON response: ${error.message}`)
        }
      }
      if (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'error')) {
        throw result.error
      }
      if (response.status >= 400) throw result
      return result
    }
  }

  auth (url, options) {
    if (url === '/api/auth/signin') {
      return
    }

    const { email, password, token, serverPassword } = this.options

    if (token !== '') {
      options.headers = Object.assign({}, options.headers, {
        'X-Token': token,
        'X-Username': token
      })
    } else {
      options.auth = {
        username: email,
        password
      }
    }

    if (serverPassword !== '') {
      options.headers = Object.assign({}, options.headers, {
        'X-Server-Password': serverPassword
      })
    }
  }
}
