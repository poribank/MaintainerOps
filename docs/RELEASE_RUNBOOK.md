# Release Runbook

Use this runbook for MaintainerOps public pilot milestones and pre-1.0 release
candidates.

MaintainerOps release automation is deliberately conservative. The current
repository workflows verify release readiness and upload inspection artifacts,
but they do not publish npm packages, container images, or GitHub Release assets
by default.

## Release Roles

- Maintainer: approves the release candidate, changelog, and public notes.
- Operator: runs local checks, creates tags, watches workflows, and collects
  evidence.
- Reviewer: checks artifacts, permissions, and pilot notes before public
  announcement.

One person may hold multiple roles in a small pilot, but the role decisions
should still be recorded in the release notes or pilot log.

## Pre-Tag Checklist

Before creating a tag:

- confirm the working tree is clean;
- confirm the target commit is on `main`;
- run `npm run check`;
- review open security advisories and Dependabot alerts;
- confirm release blockers are either resolved or documented;
- confirm GitHub App permissions did not expand unexpectedly;
- confirm no local secret or evidence files are staged;
- update release notes or changelog material for user-visible changes;
- export pilot evidence if the release is tied to a demo or application review.

Do not create a public tag from a branch with failing checks.

## Local Verification

Run the same high-level checks expected by CI:

```sh
npm run check
mkdir -p artifacts
npm pack --workspaces --pack-destination artifacts
npm sbom --workspaces --sbom-format cyclonedx --json > artifacts/maintainerops.cdx.json
docker build --pull -t maintainerops:local-release .
```

Review generated artifacts locally, then remove disposable artifacts before
committing other work:

```sh
rm -rf artifacts
```

Generated artifacts can include dependency and package metadata. Do not attach
them publicly until they have been reviewed.

## Tagging

Use semantic version tags such as `v0.2.3`. Pre-1.0 releases may contain
breaking changes, but data schema or configuration changes need migration notes.

Example:

```sh
git tag -a v0.2.4 -m "MaintainerOps v0.2.4"
git push origin v0.2.4
```

Pushing a `v*` tag starts the `Release Preflight` workflow.

## Release Preflight

The `Release Preflight` workflow verifies:

- `npm run check`;
- npm workspace tarball generation;
- CycloneDX SBOM generation with `npm sbom`;
- Docker image build;
- artifact upload for inspection.

The workflow uses `contents: read`. It should not create releases, publish npm
packages, push container images, or upload release assets.

Pass criteria:

- workflow conclusion is success;
- uploaded artifacts are present;
- tarballs correspond to the intended workspace versions;
- SBOM generation completed;
- Docker build completed without using publishing credentials.

## GitHub Release Drafts

The application can create release drafts only when GitHub writes are
intentionally enabled and the installed GitHub App has the required Contents
write permission.

Do not create release drafts during ordinary preflight checks. If a draft drill
is required:

- set `GITHUB_WRITES_ENABLED=true` only for the drill window;
- use `dryRun:false` only on the intended action request;
- confirm the audit log entry;
- delete test drafts after verification;
- set `GITHUB_WRITES_ENABLED=false` again.

## Publishing Boundary

Publishing is out of scope for the current default workflows.

Before adding npm, container, or release-asset publishing:

- document the publishing owner;
- document required credentials and storage location;
- add an ADR for the publishing boundary;
- confirm branch protection and required reviewer expectations;
- run a dry-run publishing drill without public side effects.

## Failed Preflight

If release preflight fails:

- do not reuse the failed tag as evidence of a successful release;
- inspect the failed workflow logs;
- fix the underlying issue through a pull request;
- create a new tag only after `main` is healthy again;
- record whether any public release notes need correction.

If a tag must be removed, document the reason before deleting it locally and
remotely.

## Post-Release Evidence

After a successful release or pilot milestone, record:

- tag name and commit SHA;
- workflow run URL and conclusion;
- release preflight artifact names;
- local `npm run check` result;
- known limitations and unresolved risks;
- whether GitHub Release, npm, or container publishing was intentionally skipped.

Keep evidence files outside git unless they are explicitly reviewed and intended
for public documentation.
