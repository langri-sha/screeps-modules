# Change Log - screeps-modules

<!-- This log was last generated on Sat, 31 Oct 2026 17:00:47 GMT and should not be manually modified. -->

<!-- Start content -->

## 2.1.0

Sat, 31 Oct 2026 17:00:47 GMT

### Minor changes

- Require Node.js 24.22.1, which fixes CVE-2026-111497 (filip.dupanovic@gmail.com)

### Patches

- Update vitest monorepo to v5.0.4
- Update dependency @langri-sha/projen-project to v0.43.0
- Update dependency pnpm to v12.11.2
- Update dependency @types/node to v24.19.2
- Update dependency pnpm to v12.16.1
- Update langri-sha/skills digest to 76be751
- Update dependency @langri-sha/projen-project to v0.39.0
- Update dependency langri-sha/skills to v1.1.0
- Update langri-sha projen toolchain
- Update dependency @langri-sha/projen-project to v0.42.4
- Update dependency @langri-sha/eslint-config to v0.10.0
- Update dependency @langri-sha/projen-project to v0.38.2
- Update dependency @types/debug to v4.1.13
- Update dependency pnpm to v12.15.0
- Update dependency pnpm to v12.13.0
- Update vitest monorepo to v5.0.5
- Update dependency @langri-sha/projen-project to v0.40.0
- Update dependency @langri-sha/projen-project to v0.42.0
- Update dependency pnpm to v12.14.0
- Update dependency pnpm to v12.16.0

## 2.0.0

Tue, 13 Oct 2026 13:04:08 GMT

### Major changes

- Require Node.js 24, use the built-in fetch in place of request, and ship type declarations (filip.dupanovic@gmail.com)

## [1.2.0]
### Added
- `X-Server-Password` header with corresponding `serverPassword` field for protected private servers

### Changed
- Upgraded dependencies

## [1.1.2] - 2016-11-18
### Added
- Invalidate token on 401 responses
- Always set token found response headers
- Improved error handling

## [1.0.2] - 2016-11-13
### Added
- Coverage
- Token support
- Optional support for compressing commit sources
- Support for fetching modules
- Support for committing modules

[Unreleased]: https://github.com/langri-sha/screeps-modules/commits/master
[1.2.0]: https://github.com/langri-sha/screeps-scripts/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/langri-sha/screeps-scripts/compare/v1.0.2...v1.1.2
[1.0.2]: https://github.com/langri-sha/screeps-scripts/compare/283a050...v1.0.2
