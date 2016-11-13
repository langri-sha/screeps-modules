# screeps-scripts

[![Build status][travis-ci-badge]](travis-ci) [![npm][npm-badge]](npm)

A thin client for committing/fetching sources from Screeps servers.

# Install

```
npm install screeps-commit
```

## Usage

```
import ScreepsScripts from 'screeps-scripts'

(async () => {
  const client = new ScreepsScripts({
    email: 'EMAIL',
    password: 'PASSWORD',
    serverUrl: 'https://screeps.com',
    // Compress commit sources
    gzip: false
  })

  try {
    // {ok: 1}
    await client.commit('sim', {
      'main': 'module.exports = () => {console.log(Game.time)}'
    })

    // {main: 'module.exports = () => {console.log(Game.time)}'}
    await client.fetch('sim')
  } catch (e) {
    console.error(e)
  }
})
```

[travis-ci]: https://travis-ci.org/langri-sha/screeps-scripts
[travis-ci-badge]: https://travis-ci.org/langri-sha/screeps-scripts.svg?branch=master
