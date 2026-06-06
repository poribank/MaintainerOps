# ADR 0001: Default to Report-Only Automation

- Status: Accepted
- Date: 2026-06-06
- Owners: MaintainerOps maintainers

## Context

MaintainerOps is designed for maintainers who operate critical open source
repositories. The product can identify review risk, security findings, release
blockers, and recommended actions. Some recommendations can map to GitHub write
operations, such as labels, comments, check runs, and release drafts.

For a public OSS pilot, incorrect writes can damage maintainer trust faster than
missing a recommendation. The safe default must make findings visible without
changing the upstream repository unless the operator has deliberately enabled
that behavior.

## Decision

MaintainerOps defaults to report-only automation.

- `GITHUB_WRITES_ENABLED=false` is the default runtime posture.
- GitHub write actions require `dryRun:false`, a configured GitHub App
  installation, and `GITHUB_WRITES_ENABLED=true`.
- Local queue status actions can update MaintainerOps state, but they still
  require `dryRun:false` and are audit logged.
- MaintainerOps does not auto-merge, auto-approve, or auto-request changes.
- AI assistance remains optional and disabled by default.
- Repository policies can opt into more automation, but policy opt-in does not
  bypass audit logging.

## Consequences

Public demos and pilots can show recommendations without granting unnecessary
write authority.

Operators must explicitly enable and test writes before presenting them as
applied behavior. Documentation, PR templates, and runbooks should continue to
distinguish dry-run recommendations from applied changes.

The product may feel more conservative than bot-first automation tools, but this
matches the maintainer-assistance role and keeps accountability with human
maintainers.

## Alternatives Considered

### Enable safe writes by default

Rejected. Even labels and comments can create noise or expose premature security
analysis in public repositories.

### Auto-merge low-risk pull requests

Rejected. Auto-merge changes repository ownership and release risk. MaintainerOps
may report readiness, but merge decisions stay outside the default product.

### Require no GitHub write adapter until v1.0

Rejected. A write adapter is useful for explicit pilot drills and check-run
reporting, as long as it is gated by configuration, request intent, and audit
logging.

## Review Plan

Revisit this decision before `v1.0.0`, after any live pilot that enables GitHub
writes, or after a security incident involving automated actions.
