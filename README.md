# screeps-commit-scripts

[![Build status][travis-ci-badge]](travis-ci) [![npm][npm-badge]](npm)  [![State][state-badge]]

Commit scripts to a Screeps server

# Install

```
npm install screeps-commit
```

## Usage

```
import ScreepsCommit from 'screeps-commit'

(async () => {
  const client = new ScreepsCommit({
    email: 'EMAIL',
    password: 'PASSWORD',
    apiUrl: 'https://screeps.com',
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

[travis-ci]: https://travis-ci.org/langri-sha/screeps-commit-scripts
[travis-ci-badge]: https://travis-ci.org/langri-sha/screeps-commit-scripts.svg?branch=master
[state-badge]: https://img.shields.io/badge/state-unstable-red.svg
