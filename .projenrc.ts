import { Project, TypeScriptConfig } from '@langri-sha/projen-project'

const project = new Project({
  name: 'screeps-modules',
  package: {
    authorEmail: 'filip.dupanovic@gmail.com',
    authorName: 'Filip Dupanović',
    authorOrganization: false,
    bugsUrl: 'https://github.com/langri-sha/screeps-modules/issues',
    copyrightYear: '2016',
    description: 'Commit and retrieve modules from Screeps servers',
    entrypoint: 'src/index.ts',
    type: 'module',
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
    minNodeVersion: '24.22.1',
    repository: 'git+https://github.com/langri-sha/screeps-modules.git',

    deps: ['debug@^4.0.0'],
    devDeps: [
      '@langri-sha/tsconfig@1.1.1',
      '@types/debug@4.1.13',
      '@types/node@24.19.2',
      '@langri-sha/vitest@0.2.3',
      '@vitest/coverage-v8@5.0.5',
      'vitest@5.0.5',
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
        '.projenrc.ts',
        'CODEOWNERS',
        'beachball.config.cjs',
        'dagger.lock',
        'dagger.toml',
        'eslint.config.js',
        'lint-staged.config.js',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'prettier.config.js',
        'renovate.json5',
        'scripts/**',
        'tsconfig.json',
      ],
    },
  },
  claude: {
    settings: {
      attribution: { commit: '', pr: '', sessionUrl: false },
    },
  },
  codeowners: {
    '*': '@langri-sha',
  },
  dagger: {
    engineVersion: 'v1.0.0-beta.21',
    workspace: {
      ignore: ['**/node_modules', '**/dist', '**/coverage', '**/*.tsbuildinfo'],
      modules: {
        ci: {
          source: 'github.com/langri-sha/dagger/ci@v1.10.1',
          generate: { skip: ['projen'] },
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
          source: 'github.com/langri-sha/dagger/vitest@v1.10.1',
        },
        typescript: {
          source: 'github.com/langri-sha/dagger/typescript@v1.10.1',
        },
        beachball: {
          source: 'github.com/langri-sha/dagger/beachball@v1.10.1',
        },
        projen: {
          source: 'github.com/langri-sha/dagger/projen@v1.10.1',
        },
      },
    },
  },
  editorConfig: {},
  eslint: {
    config: [],
  },
  githubTemplates: {},
  husky: {
    'pre-commit': 'lint-staged',
  },
  lintStaged: {},
  lintSynthesized: {},
  npmIgnore: {
    ignorePatterns: [
      '*.test.*',
      '/*.config.*',
      '/*.json5',
      '/*.yaml',
      '/CODEOWNERS',
      '/change/',
      '/coverage/',
      '/dagger.*',
      '/scripts/',
    ],
  },
  prettier: {
    ignorePatterns: ['CHANGELOG.md'],
  },
  pnpmWorkspace: {
    minimumReleaseAgeExclude: ['@langri-sha/*', ...Project.presetPackages],
  },
  renovate: {
    extends: ['github>langri-sha/renovate-config'],
  },
  typeScriptConfig: {
    config: {
      compilerOptions: {
        noEmit: true,
      },
      include: ['src'],
    },
  },
  worktrunk: {},
  skills: {
    ignore: false,
    skills: [
      {
        source: 'langri-sha/skills',
        ref: 'v1.0.0',
        skills: ['create-commit', 'create-pr'],
      },
    ],
  },
})

project.package?.addField('packageManager', 'pnpm@12.16.1')

project.package?.setScript('start', 'pnpm run -s lint; pnpm run -s test')
project.package?.setScript('debug', 'DEBUG=client vitest run')
project.package?.setScript('test', 'vitest run --coverage')
project.package?.setScript('lint', 'eslint .')

project.gitignore.addPatterns('coverage/')

project.package?.addField('publishConfig', {
  access: 'public',
  main: 'dist/index.js',
  types: 'dist/index.d.ts',
})

project.package?.setScript('smoke', 'node scripts/smoke.js')

project.package?.setScript(
  'prepublishOnly',
  'rm -rf dist; tsc --project tsconfig.build.json',
)

new TypeScriptConfig(project, {
  fileName: 'tsconfig.build.json',
  config: {
    extends: '@langri-sha/tsconfig/build',
    compilerOptions: {
      module: 'nodenext',
      moduleResolution: 'nodenext',
    },
    include: ['src'],
    exclude: ['**/*.test.*'],
  },
})

project.synth()
