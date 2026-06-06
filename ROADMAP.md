# Roadmap

## Current Status

MaintainerOps is in early public pilot hardening. The main branch includes a working monorepo, GitHub App webhook ingest, dashboard, audit log, PostgreSQL/BullMQ pilot path, scanner jobs, evidence export, CI, CodeQL, package verification, release preflight, and Scorecard workflow.

## v0.1.0: Maintainer Queue MVP

- GitHub webhook ingest.
- Work item normalization for PRs, issues, releases, and security alerts.
- Rule-based scoring and recommendations.
- React dashboard.
- Memory store and memory job queue.
- Dry-run write actions and audit logging.

## v0.2.0: Pilot-Ready Operations

- PostgreSQL persistence.
- BullMQ/Redis worker.
- GitHub App setup guide.
- Scorecard and OSV Scanner job workflows.
- Repository policy validation UI.
- Pilot metrics endpoint.
- Optional AI maintainer preview endpoint.
- Release preflight with npm workspace tarballs, SBOM generation, and Docker build verification.
- Local queue status actions separated from GitHub write actions.

## v0.3.0: AI-Assisted Maintainer Workflows

- Real GitHub PR diff and issue thread retrieval through the installed GitHub App.
- PR summary generation with real GitHub diff retrieval.
- Issue triage rationale generation with thread summarization.
- Release blocker summary generation with release history context.
- Redaction and content transfer audit events.
- Evaluation harness for maintainer acceptance rate.

## v0.4.0: Security and Release Hardening

- GitHub rulesets and branch protection ingestion.
- CodeQL, Dependabot, secret scanning, and repository advisory synchronization.
- OpenSSF Scorecard remediation tracking in `docs/SCORECARD_REMEDIATION.md`.
- SLSA provenance checks.
- Release readiness reports.
- Security Insights validation.
- Signed release provenance once publishing credentials and release ownership are defined.

## v1.0.0: Multi-Repository Production Use

- Multi-org dashboard.
- Role-based admin controls.
- Helm chart.
- Backup and restore docs.
- Upgrade/migration guide.
- Public plugin interface for additional scanners and policy engines.
