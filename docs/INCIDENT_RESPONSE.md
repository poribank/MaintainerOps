# Incident Response

Use this runbook for MaintainerOps public pilots when a credential, webhook,
AI data boundary, GitHub write action, scanner job, or persistent store may have
behaved unexpectedly.

## First 15 Minutes

1. Stop new automation.
   - Set `GITHUB_WRITES_ENABLED=false`.
   - Stop the worker if queued scanner or write-related jobs are still running.
   - Keep the API online only if it is needed to preserve evidence or receive
     expected webhook redeliveries.

2. Preserve evidence.
   - Export `GET /api/pilot/metrics`.
   - Export `GET /api/audit-log`.
   - Record the current commit SHA, package version, deployment mode, and
     affected repository names.
   - Preserve relevant GitHub webhook delivery ids and GitHub request ids.

3. Limit exposure.
   - Disable the affected GitHub App installation or narrow its repository
     access if repository access is in question.
   - Disable AI by setting `AI_PROVIDER=disabled` if any raw-content boundary is
     in question.
   - Pause public evidence sharing until the exported files are reviewed.

## Credential Exposure

Treat these as sensitive credentials:

- `GITHUB_PRIVATE_KEY`;
- `GITHUB_WEBHOOK_SECRET`;
- GitHub App installation tokens;
- `GITHUB_AUTH_TOKEN`;
- `AI_API_KEY` or `OPENAI_API_KEY`;
- database and Redis credentials.

Response checklist:

- revoke or rotate the exposed credential at the provider;
- remove the credential from local shells, untracked files, logs, and shared
  evidence exports;
- confirm no credential was committed with `git status`, `git diff`, and the
  GitHub secret scanning alert view;
- restart affected processes with the replacement credential;
- add an audit note to the pilot record describing what was rotated and when.

Do not paste replacement credentials into issues, pull requests, chat, or
evidence files.

## GitHub App Private Key

If the GitHub App private key may be exposed:

- generate a new private key in the GitHub App settings;
- update only the local secret source used by the pilot;
- restart API and worker processes that create installation tokens;
- delete the old private key from local machines and secret stores after the new
  key is verified;
- check recent GitHub App activity for unexpected installation token use.

## Webhook Secret

If `GITHUB_WEBHOOK_SECRET` may be exposed:

- set a new webhook secret in the GitHub App settings;
- restart the API with the same new value;
- redeliver one recent webhook from GitHub and confirm HTTP 202;
- expect old signed deliveries to fail signature verification after rotation.

Keep `webhook_deliveries` rows when investigating duplicate or replay behavior.
Those rows are evidence for delivery idempotency.

## Unexpected GitHub Writes

MaintainerOps should not write to GitHub unless all of these were true:

- `GITHUB_WRITES_ENABLED=true`;
- the work item had a GitHub App installation id;
- the API request used `dryRun:false`;
- action metadata was valid;
- the action was recorded in the audit log.

If a write was unexpected:

- immediately set `GITHUB_WRITES_ENABLED=false`;
- capture the audit entry from `/api/audit-log`;
- capture the GitHub request id when present;
- inspect the affected issue, pull request, check run, or release draft;
- manually revert labels, comments, check runs, or draft releases when needed;
- keep the original audit entry and add a pilot note for the manual correction.

MaintainerOps does not auto-merge, auto-approve, or auto-request changes. If one
of those happened, investigate repository settings or another integration.

## AI Raw-Content Boundary

If raw repository content may have crossed the AI boundary unexpectedly:

- set `AI_PROVIDER=disabled`;
- stop sharing generated AI output until reviewed;
- capture `/api/pilot/metrics` and confirm `audit.aiRawContentTransfers`;
- inspect `ai_assist` audit entries for `requestedRawContent`,
  `usedRawContent`, `provider`, and `redacted` metadata;
- confirm the request included an explicit repository policy source;
- rotate AI provider credentials if logs or request bodies may have exposed
  secrets.

Raw content requests without explicit policy opt-in should be rejected and audit
logged with `outcome=failed`.

## Scanner or Filesystem Boundary

If a scanner job may have read the wrong path or repository:

- stop the worker;
- confirm `SCANNER_WORKSPACE_ROOT`;
- inspect `/api/jobs` for the affected job id and status;
- preserve scanner output before deleting local files;
- rerun the scanner only after confirming the path is inside the intended
  workspace.

OSV Scanner requests should stay inside `SCANNER_WORKSPACE_ROOT`. Scorecard
requests should target repositories the operator is authorized to inspect.

## Persistent Store

For PostgreSQL pilots:

- back up the database before cleanup;
- preserve `audit_log`, `work_items`, and `webhook_deliveries` rows for the
  investigation window;
- do not truncate tables until evidence is exported and reviewed;
- record any manual row edits in the pilot notes.

Redis/BullMQ state can usually be rebuilt by rerunning scanner jobs, but active
jobs should be allowed to finish or be documented as abandoned.

## Closure Criteria

Close an incident only after:

- affected credentials are rotated or explicitly judged not exposed;
- unexpected writes are reverted or documented;
- evidence exports are reviewed for sensitive data before sharing;
- the root cause and corrective action are recorded;
- `npm run check` passes on any code or documentation fix;
- the pilot operator confirms whether GitHub App permissions still match the
  intended least-privilege setup.
