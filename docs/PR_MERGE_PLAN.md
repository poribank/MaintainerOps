# Pull Request Merge Plan

This plan keeps the public pilot hardening queue reviewable while branch protection requires code owner approval.

## Current rule

Do not bypass branch protection. Merge only pull requests that have:

- all required checks passing;
- no unresolved merge conflicts;
- code owner approval;
- a clear verification section in the pull request body.

If two pull requests touch the same file and solve the same issue, keep the broader or newer pull request and close the superseded one with a short comment that links to the replacement.

## Recommended order

1. Documentation-only pull requests
   - Merge low-conflict docs first when they do not change setup commands or security claims.
   - Re-run `npm run check` locally after any docs that change scripts, package metadata, or examples.

2. Packaging and release-preflight pull requests
   - Merge package metadata and Docker/release workflow changes before creating new tags.
   - Verify `npm pack --workspaces`, `npm sbom --workspaces --sbom-format cyclonedx --json`, and Docker build output before release candidates.

3. Demo and evidence workflow pull requests
   - Merge one smoke workflow implementation at a time.
   - If multiple pull requests create or modify the same script, combine the useful behavior into one branch before merge.
   - After merge, run fixture replay and evidence export against a local API.

4. Core policy, scoring, and event normalization pull requests
   - Merge narrow tests before behavior changes when possible.
   - After each behavior change, run the affected workspace tests and then `npm run check`.

5. Server API, store, scanner, and action executor pull requests
   - Merge by file group to avoid hidden regressions: request parsing, store persistence, scanner boundaries, GitHub writes, then action execution.
   - Re-run demo smoke and evidence export after changes to webhook ingest, audit logs, or action metadata.

6. Dashboard pull requests
   - Merge state and API handling changes before visual polish.
   - Confirm queue refresh, item selection, scanner results, AI preview, and audit panels still reflect the selected work item.

## Conflict handling

- Prefer rebasing the newer branch on `main` after the older overlapping pull request merges.
- Preserve tests from both branches when they cover different failure modes.
- Do not squash together unrelated security, docs, and UI changes solely to reduce pull request count.
- Close obsolete pull requests only when the replacement demonstrably includes the same behavior or test coverage.

## Post-merge verification

After each batch of merges:

```sh
npm run check
npm audit
npm audit --omit=dev
```

For demo readiness batches, also run:

```sh
npm run build
PORT=3001 GITHUB_WEBHOOK_SECRET=dev-secret SEED_DEMO_DATA=false npm run start --workspace @maintainerops/server
npm run demo:replay -- --url http://localhost:3001/webhooks/github --secret dev-secret
npm run evidence:export -- --url http://localhost:3001 --out evidence
```

Generated evidence files are ignored by git. Review them before publishing or attaching them to an application.
