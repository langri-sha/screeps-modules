const http = require('http')
const https = require('https')
const querystring = require('querystring')
const urlModule = require('url')
const zlib = require('zlib')

function requestUrl (serverUrl, uri, qs) {
  let target

  if (/^https?:\/\//i.test(uri)) {
    target = urlModule.parse(uri)
  } else {
    const base = urlModule.parse(serverUrl)
    const path = (base.pathname || '').replace(/\/$/, '') + '/' + String(uri || '').replace(/^\//, '')
    target = urlModule.parse(urlModule.format({
      protocol: base.protocol,
      hostname: base.hostname,
      port: base.port,
      auth: base.auth,
      pathname: path
    }))
  }

  if (qs) {
    const query = querystring.stringify(qs)
    if (query) target.search = (target.search ? target.search + '&' : '?') + query
  }

  return target
}

function decodeBody (body, encoding, callback) {
  if (encoding === 'gzip') return zlib.gunzip(body, callback)
  if (encoding === 'deflate') return zlib.inflate(body, callback)
  callback(null, body)
}

function origin (target) {
  const protocol = target.protocol.toLowerCase()
  const port = target.port || (protocol === 'https:' ? '443' : '80')
  return protocol + '//' + target.hostname.toLowerCase() + ':' + port
}

function withoutCredentials (headers) {
  const result = Object.assign({}, headers)
  ;['authorization', 'proxy-authorization', 'cookie', 'x-token', 'x-username', 'x-server-password', 'host'].forEach(name => {
    Object.keys(result).forEach(key => {
      if (key.toLowerCase() === name) delete result[key]
    })
  })
  return result
}

function removeBodyHeaders (headers) {
  const result = Object.assign({}, headers)
  ;['content-length', 'content-type', 'content-encoding', 'transfer-encoding'].forEach(name => {
    Object.keys(result).forEach(key => {
      if (key.toLowerCase() === name) delete result[key]
    })
  })
  return result
}

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
    const {email, password} = this.options

    return this.request('/api/auth/signin', {
      method: 'POST',
      json: {
        email,
        password
      }
    })
    .then(({ok, token}) => {
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

  request (url, options = {}) {
    options = Object.assign({}, options)
    options.uri = url
    options.auth = undefined
    this.auth(url, options)

    const target = requestUrl(options.baseUrl || this.options.serverUrl, options.uri, options.qs)
    const headers = Object.assign({}, options.headers)
    let body = options.body

    if (options.json) {
      headers.Accept = headers.Accept || 'application/json'
      if (options.json !== true) body = options.json
      if (body !== undefined && body !== null) {
        if (!Buffer.isBuffer(body)) body = Buffer.from(JSON.stringify(body))
        headers['Content-Type'] = headers['Content-Type'] || 'application/json'
      }
    }

    if (options.gzip) headers['Accept-Encoding'] = headers['Accept-Encoding'] || 'gzip, deflate'
    if (options.auth) {
      const credentials = options.auth.username + ':' + options.auth.password
      headers.Authorization = 'Basic ' + Buffer.from(credentials).toString('base64')
    }

    if (body !== undefined && body !== null) {
      if (!Buffer.isBuffer(body)) body = Buffer.from(String(body))
      headers['Content-Length'] = body.length
    }

    const maxRedirects = options.maxRedirects === undefined ? 10 : options.maxRedirects
    if (!Number.isInteger(maxRedirects) || maxRedirects < 0) {
      return Promise.reject(new TypeError('maxRedirects must be a non-negative integer'))
    }

    return new Promise((resolve, reject) => {
      const send = (currentTarget, method, requestBody, requestHeaders, redirects) => {
        const currentTransport = currentTarget.protocol === 'https:' ? https : http
        const requestOptions = {
          protocol: currentTarget.protocol,
          hostname: currentTarget.hostname,
          port: currentTarget.port,
          path: currentTarget.path,
          method,
          headers: Object.assign({}, requestHeaders)
        }

        const req = currentTransport.request(requestOptions, response => {
          response.on('error', reject)
          const location = response.headers.location
          const redirect = response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307
          const canFollow = method === 'GET' || method === 'HEAD' || options.followAllRedirects

          if (redirect && location && canFollow) {
            if (redirects >= maxRedirects) {
              response.resume()
              return reject(new Error('Exceeded max redirects'))
            }

            let nextTarget
            try {
              nextTarget = urlModule.parse(urlModule.resolve(urlModule.format(currentTarget), location))
              if (nextTarget.protocol !== 'http:' && nextTarget.protocol !== 'https:') {
                response.resume()
                return reject(new Error('Unsupported redirect protocol: ' + nextTarget.protocol))
              }
            } catch (err) {
              response.resume()
              return reject(err)
            }

            let nextMethod = method
            let nextBody = requestBody
            let nextHeaders = requestHeaders
            if ((response.statusCode === 303 && method !== 'HEAD') ||
              ((response.statusCode === 301 || response.statusCode === 302) && method === 'POST')) {
              nextMethod = 'GET'
              nextBody = undefined
              nextHeaders = removeBodyHeaders(nextHeaders)
            }
            if (origin(currentTarget) !== origin(nextTarget)) nextHeaders = withoutCredentials(nextHeaders)

            response.resume()
            return response.on('end', () => send(nextTarget, nextMethod, nextBody, nextHeaders, redirects + 1))
          }

          const chunks = []
          response.on('data', chunk => chunks.push(chunk))
          response.on('end', () => {
            let raw = Buffer.concat(chunks)
            const encoding = options.gzip && response.headers['content-encoding']

            decodeBody(raw, encoding, (decodeError, decoded) => {
              if (decodeError) return reject(decodeError)
              raw = decoded

              let responseBody = raw.toString(options.encoding || 'utf8')
              if (options.json) {
                try {
                  responseBody = responseBody.length ? JSON.parse(responseBody) : null
                } catch (err) {
                  return reject(err)
                }
              }

              if (response.statusCode === 401) this.options.token = ''
              if (response.headers['x-token']) this.options.token = response.headers['x-token']

              if (responseBody && typeof responseBody === 'object' && Object.prototype.hasOwnProperty.call(responseBody, 'error')) {
                return reject(responseBody.error)
              }

              if (response.statusCode % 400 < 200) return reject(responseBody)
              resolve(responseBody)
            })
          })
        })

        req.on('error', reject)
        if (requestBody !== undefined && requestBody !== null) req.write(requestBody)
        req.end()
      }

      send(target, options.method || 'GET', body, headers, 0)
    })
  }

  auth (url, options) {
    if (url === '/api/auth/signin') {
      return
    }

    const {email, password, token, serverPassword} = this.options

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
