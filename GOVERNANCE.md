# Governance

MaintainerOps starts as a maintainer-led project with documented decision making.

## Roles

- Maintainers own releases, security response, roadmap decisions, and final review.
- Reviewers can approve code changes in areas where maintainers delegate authority.
- Contributors can propose changes through issues and pull requests.

Current maintainers and review areas are listed in [MAINTAINERS.md](MAINTAINERS.md).

## Decision process

Technical decisions should be recorded in issues or architecture decision records when they affect public APIs, security posture, data retention, or deployment compatibility.

## Release policy

Releases follow semantic versioning after `1.0.0`. Pre-1.0 releases may contain breaking changes, but migration notes are required for data schema and configuration changes.

Release candidates should be reviewed through pull requests before tagging. The release owner should confirm:

- `npm run check` passes;
- required GitHub Actions checks are green on the release branch or tag candidate;
- release preflight artifacts are available for inspection;
- schema, configuration, GitHub App permission, and data-retention changes are documented;
- generated evidence exports, local environment files, and credentials are not included.

Publishing GitHub Releases, npm packages, container images, signed provenance, or tags requires explicit maintainer approval. Release automation must remain dry-run or preflight-only until publishing credentials and ownership are documented.

## Review Gates

Maintainer review is required for changes that affect:

- GitHub App permissions or webhook verification;
- GitHub write actions or approval-gated automation;
- AI provider behavior, raw-content transfer, or data retention;
- database schema, audit-log semantics, or work item persistence;
- release, package, SBOM, checksum, or provenance workflows;
- branch protection, repository security settings, or dependency update policy.

Routine documentation, test-only, and low-risk UI changes may be reviewed with a lighter process, but they still need passing checks before merge.
