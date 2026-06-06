# Repository Settings

Use this checklist when creating or auditing the public MaintainerOps repository.

## Metadata

- Description: `Self-hosted maintainer operations assistant for open source GitHub organizations.`
- Topics:
  - `github-app`
  - `issue-triage`
  - `maintainer-tools`
  - `open-source`
  - `release-management`
  - `security-automation`
  - `typescript`
- License: Apache-2.0.
- Issues: enabled.

## Labels

The issue templates, repository policy, and triage rules expect these labels to exist:

- `bug`
- `documentation`
- `enhancement`
- `needs-reproduction`
- `security`

Default GitHub labels can remain enabled for general triage.

## Security Settings

Enable:

- private vulnerability reporting;
- Dependabot vulnerability alerts;
- Dependabot security updates;
- secret scanning;
- secret scanning push protection;
- CodeQL workflow on pull requests, pushes to `main`, and weekly schedule;
- Scorecard workflow on schedule and branch protection changes.

## Branch Protection

Protect `main` with:

- required pull request reviews;
- required code owner review;
- strict status checks before merging;
- required status checks named `check`, `Analyze`, and `Package`;
- admin enforcement for the pilot repository.

Do not bypass branch protection for normal feature, documentation, or release-preflight changes.
