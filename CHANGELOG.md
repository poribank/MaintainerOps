# Changelog

MaintainerOps is still pre-1.0. This changelog records shipped changes that affect
public OSS pilot users, demo operators, and maintainers evaluating release
readiness.

The format follows the spirit of Keep a Changelog, with dates based on the
project's published tags.

## [Unreleased]

### Added

- Started tracking public release notes in this changelog.

## [0.2.3] - 2026-06-05

### Added

- Workflow status badges for public CI visibility.
- Security reporting guidance links.
- Test coverage for AI assistant adapter behavior, action metadata validation,
  and scanner execution edge cases.

### Changed

- Normalized job list limits.
- Set a CI job timeout for safer hosted-runner behavior.
- Improved dashboard API error detail rendering.

### Fixed

- Validated scanner job inputs before enqueueing work.

## [0.2.2] - 2026-06-05

### Changed

- Pinned the Docker base image by digest.
- Bumped workspace packages to version 0.2.2.

## [0.2.1] - 2026-06-05

### Added

- Release preflight and OpenSSF Scorecard workflows.
- Tests for webhook validation.

### Changed

- Recorded recognized license status.
- Replaced placeholder licensing with standard Apache-2.0 license text.
- Clarified local queue action execution docs.
- Grounded public OSS application notes.

### Fixed

- Improved security webhook normalization.
- Persisted Postgres queue status actions.

## [0.2.0] - 2026-06-05

### Added

- GitHub App token helper for local operator workflows.
- Dashboard helper tests.
- Package verification workflow.
- CodeQL analysis.

### Changed

- Pinned GitHub Actions by SHA.
- Refreshed dependencies and CI actions.
- Documented repository security settings.

## [0.1.1] - 2026-06-05

### Fixed

- Preserved work item status across live webhook ingestion.

## [0.1.0] - 2026-06-05

### Added

- Initial public pilot demo baseline.
- Persistent live pilot setup documentation.

[Unreleased]: https://github.com/poribank/MaintainerOps/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/poribank/MaintainerOps/releases/tag/v0.2.3
[0.2.2]: https://github.com/poribank/MaintainerOps/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/poribank/MaintainerOps/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/poribank/MaintainerOps/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/poribank/MaintainerOps/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/poribank/MaintainerOps/releases/tag/v0.1.0
