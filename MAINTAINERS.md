# Maintainers

MaintainerOps is currently maintainer-led by:

- `@poribank`: project owner, release owner, GitHub App setup, security response, and final review.

## Review Areas

- `packages/core`: policy parsing, scoring, webhook normalization, release readiness, and shared types.
- `apps/server`: API routes, webhook ingest, persistence, job queues, scanner integration, AI adapter, and GitHub write adapter.
- `apps/web`: maintainer dashboard UI and local demo experience.
- `.github` and `docs`: CI, security workflows, setup guides, evidence workflow, and governance.

## Maintainer Expectations

- Keep `npm run check` passing before merge.
- Require review for changes to GitHub App permissions, webhook handling, AI data transfer, release workflows, and persistence schema.
- Do not request or commit private keys, tokens, webhook secrets, or production evidence from private repositories.
- Route suspected vulnerabilities through `SECURITY.md` rather than public issues.

## Delegation

Review rights can be delegated in issues or pull requests for specific areas. Release ownership and security response remain with project maintainers until this file is updated.
