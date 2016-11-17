const debug = require('debug')('screeps-modules')
const request = require('request')
const zlib = require('zlib')

module.exports = class ScreepsModules {
  constructor (options) {
    this.options = Object.assign({}, {
      email: '',
      password: '',
      token: '',
      serverUrl: 'https://screeps.com',
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
      body: compressed.toString('hex')
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
    options.uri = url
    options.auth = this.auth(url, options)
    options.baseUrl = this.options.serverUrl

    this.auth(url, options)

    debug(`Requesting: ${JSON.stringify(options, null, 2)}`)

    return new Promise((resolve, reject) => {
      request(options, (err, response, body) => {
        debug(`Error: ${JSON.stringify(err)}`)
        debug(`Response: ${JSON.stringify(response)}`)
        debug(`Body: ${JSON.stringify(body)}`)

        if (err) {
          return reject(err)
        }

        if (body.hasOwnProperty('error')) {
          return reject(body.error)
        }

        if (response.statusCode % 400 < 200) {
          return reject(body)
        }

        resolve(body)
      })
    })
  }

  auth (url, options) {
    if (url === '/api/auth/signin') {
      return
    }

    const {email, password, token} = this.options

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
  }
}
