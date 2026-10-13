import { Project } from '@langri-sha/projen-project'

const project = new Project({
  name: 'screeps-modules',
  package: {
    authorEmail: 'filip.dupanovic@gmail.com',
    authorName: 'Filip Dupanović',
    authorOrganization: false,
    bugsUrl: 'https://github.com/langri-sha/screeps-modules/issues',
    copyrightYear: '2016',
    description: 'Commit and retrieve modules from Screeps servers',
    entrypoint: 'index.js',
    homepage: 'https://github.com/langri-sha/screeps-modules#readme',
    keywords: [
      'screeps',
      'modules',
      'request',
      'scripts',
      'commit',
      'fetch',
      'retrieve',
    ],
    license: 'MIT',
    licensed: true,
    minNodeVersion: '24.0.0',
    repository: 'git+https://github.com/langri-sha/screeps-modules.git',

    deps: ['debug@^4.0.0'],
    devDeps: [
      '@langri-sha/eslint-config@0.9.19',
      '@langri-sha/prettier@0.4.11',
      'ava@^8.0.0',
      'nyc@^18.0.0',
    ],
  },
  codeowners: {
    '*': '@langri-sha',
  },
  editorConfig: {},
  eslint: {
    config: [
      { rules: { 'prettier/prettier': 'off' } },
      {
        files: ['index.js'],
        rules: { '@typescript-eslint/no-require-imports': 'off' },
      },
    ],
  },
  npmIgnore: {
    ignorePatterns: ['/*.yaml', '/CODEOWNERS', '/test.js'],
  },
  prettier: {
    ignorePatterns: ['CHANGELOG.md'],
  },
  pnpmWorkspace: {
    minimumReleaseAgeExclude: ['@langri-sha/*', ...Project.presetPackages],
  },
  worktrunk: {},
})

project.package?.addField('packageManager', 'pnpm@12.10.1')

project.package?.setScript('start', 'pnpm run -s lint; pnpm run -s test')
project.package?.setScript('debug', 'DEBUG=client ava --serial')
project.package?.setScript('test', 'nyc ava --verbose')
project.package?.setScript('lint', 'eslint .')

project.synth()
