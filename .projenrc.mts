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
      '@langri-sha/lint-staged@0.9.10',
      '@langri-sha/prettier@0.4.11',
      '@langri-sha/tsconfig@1.1.1',
      '@langri-sha/vitest@0.2.3',
      '@vitest/coverage-v8@5.0.3',
      'vitest@5.0.3',
    ],
  },
  beachball: {
    config: {
      branch: 'origin/main',
      ignorePatterns: [
        '.editorconfig',
        '.gitattributes',
        '.gitignore',
        '.prettierignore',
        '.projenrc.mts',
        'CODEOWNERS',
        'beachball.config.js',
        'dagger.lock',
        'dagger.toml',
        'eslint.config.mjs',
        'lint-staged.config.mjs',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'prettier.config.mjs',
        'renovate.json5',
        'tsconfig.json',
        'types.test.ts',
      ],
    },
  },
  codeowners: {
    '*': '@langri-sha',
  },
  dagger: {
    engineVersion: 'v1.0.0-beta.15',
    workspace: {
      ignore: ['**/node_modules', '**/dist', '**/coverage', '**/*.tsbuildinfo'],
      modules: {
        ci: {
          source: 'github.com/langri-sha/dagger/ci@ci/v0.1.0',
        },
        eslint: {
          source: 'dagger.io/js/eslint',
          settings: {
            baseImageAddress: 'node:24-slim',
            packageManager: 'pnpm',
          },
        },
        prettier: {
          source: 'dagger.io/js/prettier',
          settings: {
            baseImageAddress: 'node:24-slim',
            packageManager: 'pnpm',
          },
        },
        vitest: {
          source: 'dagger.io/js/vitest',
          settings: {
            baseImageAddress: 'node:24-slim',
            packageManager: 'pnpm',
          },
        },
      },
    },
  },
  editorConfig: {},
  eslint: {
    config: [
      {
        files: ['index.js'],
        rules: { '@typescript-eslint/no-require-imports': 'off' },
      },
    ],
  },
  husky: {
    'pre-commit': 'lint-staged',
  },
  lintStaged: {},
  lintSynthesized: {},
  npmIgnore: {
    ignorePatterns: ['*.test.*', '/*.yaml', '/CODEOWNERS'],
  },
  prettier: {
    ignorePatterns: ['CHANGELOG.md'],
  },
  pnpmWorkspace: {
    minimumReleaseAgeExclude: ['@langri-sha/*', ...Project.presetPackages],
  },
  renovate: {
    packageRules: [
      {
        description: 'Update our own packages together',
        groupName: 'langri-sha projen toolchain',
        groupSlug: 'langri-sha-projen',
        matchPackageNames: ['@langri-sha/**'],
      },
      {
        description: 'Install our own packages without waiting them out',
        matchPackageNames: ['@langri-sha/**'],
        minimumReleaseAge: null,
      },
      {
        description:
          'Install our own GitHub Actions and Terraform modules without waiting them out',
        matchPackageNames: ['langri-sha/**'],
        minimumReleaseAge: null,
      },
    ],
  },
  typeScriptConfig: {
    config: {
      compilerOptions: {
        noEmit: true,
      },
      include: ['index.d.ts', 'types.test.ts'],
    },
  },
  worktrunk: {},
})

project.package?.addField('packageManager', 'pnpm@12.10.1')
project.package?.addField('types', 'index.d.ts')

project.package?.setScript('start', 'pnpm run -s lint; pnpm run -s test')
project.package?.setScript('debug', 'DEBUG=client vitest run')
project.package?.setScript('test', 'vitest run --coverage')
project.package?.setScript('lint', 'eslint .')

project.gitignore.addPatterns('coverage/')

project.synth()
