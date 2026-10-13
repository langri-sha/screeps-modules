import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' })

const workdir = mkdtempSync(join(tmpdir(), 'screeps-modules-smoke-'))

try {
  run('pnpm', ['run', 'prepublishOnly'])
  run('pnpm', ['pack', '--pack-destination', workdir])

  const [tarball] = readdirSync(workdir).filter((name) => name.endsWith('.tgz'))
  const project = join(workdir, 'project')

  run('mkdir', [project])
  writeFileSync(
    join(project, 'package.json'),
    JSON.stringify({ name: 'smoke', private: true, type: 'module' }),
  )
  run(
    'npm',
    ['install', '--no-audit', '--no-fund', join(workdir, tarball)],
    project,
  )

  const check = `
    if (typeof Client !== 'function') throw new Error('not a class')
    if (new Client().options.serverUrl !== 'https://screeps.com') {
      throw new Error('unexpected defaults')
    }
  `

  run(
    'node',
    [
      '--input-type=module',
      '-e',
      `import Client from 'screeps-modules'; ${check}`,
    ],
    project,
  )
  run(
    'node',
    ['-e', `const Client = require('screeps-modules'); ${check}`],
    project,
  )

  console.log('The packed tarball loads through import and require().')
} finally {
  rmSync(workdir, { force: true, recursive: true })
}
