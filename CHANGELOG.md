<!-- markdownlint-disable MD024 -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Chores

- Lock file maintenance by @renovate[bot] in [#66](https://github.com/nicholas-fedor/actionlint-action/pull/66)
- Update dependency @types/node to v25.6.2 by @renovate[bot] in [#65](https://github.com/nicholas-fedor/actionlint-action/pull/65)
- Update dependency @types/node to v25.6.1 by @renovate[bot] in [#63](https://github.com/nicholas-fedor/actionlint-action/pull/63)

## [1.0.3] - 2026-05-09

### Added

- Add automated dist rebuild workflow by @nicholas-fedor in [#54](https://github.com/nicholas-fedor/actionlint-action/pull/54)

### Changed

- Change chore commit release value from true to patch by @nicholas-fedor in [#61](https://github.com/nicholas-fedor/actionlint-action/pull/61)
- Move releaseRules into plugin configuration by @nicholas-fedor in [#60](https://github.com/nicholas-fedor/actionlint-action/pull/60)
- Enable chore commits as release triggers by @nicholas-fedor in [#59](https://github.com/nicholas-fedor/actionlint-action/pull/59)

### Chores

- Rebuild dist/index.js by @github-actions[bot] in [#58](https://github.com/nicholas-fedor/actionlint-action/pull/58)

### Removed

- Remove redundant conditional and stale dist check by @nicholas-fedor in [#56](https://github.com/nicholas-fedor/actionlint-action/pull/56)

## [1.0.2] - 2026-05-08

### Fixed

- Correct platform naming to match actionlint release assets by @nicholas-fedor in [#52](https://github.com/nicholas-fedor/actionlint-action/pull/52)

## [1.0.1] - 2026-05-08

### Added

- Add Node.js setup and switch to bunx for semantic-release by @nicholas-fedor in [#50](https://github.com/nicholas-fedor/actionlint-action/pull/50)
- Add pinned ref validation and refine auto-merge logic by @nicholas-fedor in [#10](https://github.com/nicholas-fedor/actionlint-action/pull/10)
- Add CircleCI configuration for project by @nicholas-fedor in [#8](https://github.com/nicholas-fedor/actionlint-action/pull/8)
- Add Codecov coverage reporting to test workflow by @nicholas-fedor in [#5](https://github.com/nicholas-fedor/actionlint-action/pull/5)

### Changed

- Use bun run instead of bunx for semantic-release by @nicholas-fedor in [#47](https://github.com/nicholas-fedor/actionlint-action/pull/47)
- Migrate build and test tooling from Node.js/npm to Bun by @nicholas-fedor in [#41](https://github.com/nicholas-fedor/actionlint-action/pull/41)
- Update pinned action ref by @github-actions[bot] in [#18](https://github.com/nicholas-fedor/actionlint-action/pull/18)

### Chores

- Update dependency @types/node to v25 by @renovate[bot] in [#44](https://github.com/nicholas-fedor/actionlint-action/pull/44)
- Pin dependency @types/bun to 1.3.13 by @renovate[bot] in [#43](https://github.com/nicholas-fedor/actionlint-action/pull/43)
- Update dependency jest to v30.4.1 by @renovate[bot] in [#39](https://github.com/nicholas-fedor/actionlint-action/pull/39)
- Update dependency @types/node to v24.12.3 by @renovate[bot] in [#37](https://github.com/nicholas-fedor/actionlint-action/pull/37)
- Update github/codeql-action action to v4.35.4 by @renovate[bot] in [#35](https://github.com/nicholas-fedor/actionlint-action/pull/35)
- Lock file maintenance by @renovate[bot] in [#33](https://github.com/nicholas-fedor/actionlint-action/pull/33)
- Update step-security/harden-runner action to v2.19.1 by @renovate[bot] in [#31](https://github.com/nicholas-fedor/actionlint-action/pull/31)
- Update dependency @actions/tool-cache to v4 by @renovate[bot] in [#29](https://github.com/nicholas-fedor/actionlint-action/pull/29)
- Update dependency @actions/github to v9 by @renovate[bot] in [#26](https://github.com/nicholas-fedor/actionlint-action/pull/26)
- Update semantic-release monorepo by @renovate[bot] in [#22](https://github.com/nicholas-fedor/actionlint-action/pull/22)
- Update dependency @actions/exec to v3 by @renovate[bot] in [#25](https://github.com/nicholas-fedor/actionlint-action/pull/25)
- Update dependency @actions/core to v3 by @renovate[bot] in [#23](https://github.com/nicholas-fedor/actionlint-action/pull/23)
- Update dependency undici to v8 by @renovate[bot] in [#20](https://github.com/nicholas-fedor/actionlint-action/pull/20)
- Update github/codeql-action action to v4.35.3 by @renovate[bot] in [#19](https://github.com/nicholas-fedor/actionlint-action/pull/19)
- Exclude test files from TypeScript compilation by @nicholas-fedor in [#14](https://github.com/nicholas-fedor/actionlint-action/pull/14)
- Pin node.js to 0a67b6f by @renovate[bot] in [#11](https://github.com/nicholas-fedor/actionlint-action/pull/11)
- Update dependency typescript to v6 by @renovate[bot] in [#12](https://github.com/nicholas-fedor/actionlint-action/pull/12)
- Update dependency @types/node to v24 by @renovate[bot] in [#2](https://github.com/nicholas-fedor/actionlint-action/pull/2)
- Pin dependencies by @renovate[bot] in [#1](https://github.com/nicholas-fedor/actionlint-action/pull/1)

### Removed

- Remove unused coverage workspace persistence by @nicholas-fedor in [#48](https://github.com/nicholas-fedor/actionlint-action/pull/48)

### Tests

- Configure ts-jest with proper type definitions by @nicholas-fedor in [#16](https://github.com/nicholas-fedor/actionlint-action/pull/16)

### New Contributors

- @github-actions[bot] made their first contribution in [#49](https://github.com/nicholas-fedor/actionlint-action/pull/49)
- @renovate[bot] made their first contribution in [#44](https://github.com/nicholas-fedor/actionlint-action/pull/44)

## [1.0.0] - 2026-04-30

### Changed

- Initial commit by @nicholas-fedor

### New Contributors

- @nicholas-fedor made their first contribution

## Compare Releases

- [unreleased](https://github.com/nicholas-fedor/actionlint-action/compare/v1.0.3...HEAD)
- [1.0.3](https://github.com/nicholas-fedor/actionlint-action/compare/v1.0.2...v1.0.3)
- [1.0.2](https://github.com/nicholas-fedor/actionlint-action/compare/v1.0.1...v1.0.2)
- [1.0.1](https://github.com/nicholas-fedor/actionlint-action/compare/v1.0.0...v1.0.1)

<!-- generated by git-cliff -->
