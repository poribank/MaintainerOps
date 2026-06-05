# OpenSSF Scorecard Remediation

This document tracks the public-pilot security posture work that cannot be fully solved by code changes alone.

## Current pilot baseline

Local maintainer-run checks on 2026-06-05:

- OpenSSF Scorecard: `7.2/10`
- OSV Scanner against `package-lock.json`: `0` known vulnerabilities
- npm audit: `0` known vulnerabilities

Re-run these before every public pilot handoff or release candidate. Do not commit generated tokens or raw scanner outputs that contain private repository metadata.

## Re-run commands

Generate a short-lived GitHub App installation token in the shell only:

```sh
export GITHUB_AUTH_TOKEN=$(npm run --silent github:token -- --installation-id "$GITHUB_INSTALLATION_ID")
```

Run Scorecard:

```sh
scorecard --repo=github.com/poribank/MaintainerOps --format=json
```

Run OSV Scanner:

```sh
osv-scanner scan source --format json -r .
```

Run npm audit:

```sh
npm audit
npm audit --omit=dev
```

## Remediation plan

### Code-Review

Status: process-gated.

The repository uses branch protection and CODEOWNERS review. Maintainers should merge through reviewed pull requests instead of direct `main` pushes. For security-sensitive changes, keep the review evidence in the PR conversation and ensure the PR template safety checks are filled.

### Signed-Releases

Status: release-process-gated.

Release preflight should produce inspectable package artifacts, SBOM output, Docker build evidence, and checksums before publishing. The next release hardening step is signed provenance or release attestations for published assets after release ownership and credentials are finalized.

### Fuzzing

Status: future code hardening.

The highest-value targets are webhook payload normalization, policy parsing, CODEOWNERS parsing, and CLI/documentation parsing. Start with deterministic property-style tests in the existing Vitest suite before adding external fuzzing infrastructure.

### CII Best Practices

Status: external registration.

Complete the OpenSSF Best Practices project entry after the public repository metadata, support policy, security policy, governance, release process, and reviewed contribution flow are stable.

### Contributors

Status: ecosystem-dependent.

The current pilot can document contribution paths and `good first issue` work, but the Scorecard contributor signal improves only after independent contributors participate.

## Acceptance before public demo

- All open release-blocking PRs have passing checks.
- Required maintainer review is complete for security-sensitive changes.
- `npm run check` passes locally.
- npm audit and OSV Scanner report no unresolved actionable vulnerabilities.
- Latest Scorecard run and known low-score items are recorded in pilot notes.
