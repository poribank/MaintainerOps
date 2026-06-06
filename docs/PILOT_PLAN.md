# Pilot Plan

This plan describes how to turn MaintainerOps from a local MVP into evidence for a Codex for Open Source application or follow-up review.

## Week 1: Public Repository Readiness

- Publish the repository publicly.
- Add accurate project metadata and screenshots.
- Enable GitHub Actions CI.
- Add `good first issue` tasks for policy checks, GitHub App setup, and AI assistant adapters.
- Create a GitHub release tag and run the release preflight workflow.

## Week 2: Maintainer Workflow Pilot

- Register a GitHub App with minimum permissions.
- Follow `docs/GITHUB_APP_SETUP.md`.
- Install it on one repository controlled by the maintainer.
- Run in dry-run mode with `GITHUB_WRITES_ENABLED=false`.
- Collect sample PR, issue, release, and security work items.
- Validate that every recommendation is understandable to a maintainer.
- Export evidence with `npm run evidence:export`.

## Week 3: Persistence and Job Queue Pilot

- Run with PostgreSQL and BullMQ/Redis.
- Confirm webhook idempotency under redelivery.
- Confirm scanner jobs complete or return `unavailable` safely.
- Confirm audit logs survive restart.
- Document p95 queue processing latency for the pilot repository.

## Week 4: Optional AI Assistance

- Enable the policy-gated AI assistant adapter only after the maintainer opts in.
- Test only on repositories where the maintainer has authorization.
- Keep raw content disabled until an explicit opt-in policy is reviewed.
- Verify audit-log entries and `/api/pilot/metrics` raw-content counts for every AI assistance run.
- Compare AI-generated summaries against maintainer-written notes.

## Evidence to Capture

- Repository URL and role proof.
- Stars, downloads, dependents, or ecosystem usage.
- Recent release and maintenance activity.
- Number of PRs/issues triaged during the pilot.
- Screenshots of queue, findings, recommendations, scanner jobs, and audit logs.
- Examples where the tool helped find release or security blockers.

## Release Preflight

Before publishing a pilot milestone, run the `Release Preflight` workflow on the intended tag. It verifies the full check suite, npm workspace tarball creation, runtime artifact contents, CycloneDX SBOM generation, Docker image construction, Docker image metadata capture, and SHA-256 checksum generation without publishing credentials.
