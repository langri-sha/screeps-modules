const request = require('request')

module.exports = class ScreepsCommit {
  constructor (options) {
    this.options = Object.assign({}, {
      email: '',
      password: '',
      apiUrl: 'https://screeps.com'
    }, options)
  }

  commit (branch, modules) {
    if (!modules) {
      modules = branch
      branch = undefined
    }

    return this.request('/api/user/code', {
      method: 'POST',
      json: {
        branch,
        modules
      }
    })
  }

  fetch (branch) {
    return this.request('/api/user/code', {
      method: 'GET',
      json: true,
      qs: {
        branch
      }
    })
  }

  request (url, options) {
    options.uri = url
    options.auth = this.auth
    options.baseUrl = this.options.apiUrl

    return new Promise((resolve, reject) => {
      request(options, (err, response, body) => {
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
