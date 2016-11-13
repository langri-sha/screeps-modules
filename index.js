const debug = require('debug')('client')
const request = require('request')
const zlib = require('zlib')

module.exports = class ScreepsModules {
  constructor (options) {
    this.options = Object.assign({}, {
      email: '',
      password: '',
      serverUrl: 'https://screeps.com',
      gzip: false
    }, options)
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

  request (url, options) {
    options.uri = url
    options.auth = this.auth
    options.baseUrl = this.options.serverUrl

    debug(`Requesting: ${JSON.stringify(options, null, 2)}`)

    return new Promise((resolve, reject) => {
      request(options, (err, response, body) => {
        debug(`Error: ${JSON.stringify(err)}`)
        debug(`Response: ${JSON.stringify(response)}`)
        debug(`Body: ${JSON.stringify(body)}`)

        if (err) {
          return reject(err)
        }

        resolve(body)
      })
    })
  }

  get auth () {
    const {email, password} = this.options

    return {
      username: email,
      password
    }
  }
}
