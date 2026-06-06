# Pilot Acceptance Criteria

Use these criteria to decide whether a MaintainerOps public OSS pilot is ready
to start, safe to continue, and complete enough to share as evidence.

## Scope

A pilot is limited to repositories the operator owns, maintains, or is
authorized to administer. Demo fixture replay can prove the workflow is
reproducible, but it does not prove real maintainer adoption.

## Entry Criteria

Start a public pilot only when all entry criteria are true:

- `npm run check` passes from a clean checkout.
- The GitHub App is installed only on intended pilot repositories.
- GitHub App permissions match the documented minimum or a documented optional
  module.
- `GITHUB_WRITES_ENABLED=false` for the first dry-run session.
- `AI_PROVIDER=disabled` unless the pilot explicitly includes policy-gated AI.
- `GITHUB_WEBHOOK_SECRET` is configured for live webhook ingestion.
- The operator can access `/readyz`, `/api/queue`, `/api/pilot/metrics`,
  `/api/jobs`, and `/api/audit-log`.
- Evidence export has been tested with fixture replay.
- The operator knows where generated evidence files will be reviewed and stored.

## Dry-Run Pass Criteria

A dry-run pilot passes when:

- GitHub webhook deliveries return HTTP 202.
- Re-delivered webhook events do not create duplicate work items.
- The queue includes representative PR, issue, release, and security or policy
  work items.
- Recommendations are understandable to the maintainer reviewing them.
- No GitHub labels, comments, check runs, releases, approvals, or merge actions
  are applied by MaintainerOps.
- `/api/pilot/metrics` reports work items, recommendations, and audit counts
  consistent with the pilot activity.
- Failed raw-content AI attempts are audit logged when raw content is requested
  without policy opt-in.
- Evidence export completes and the generated JSON and Markdown are reviewed
  before sharing.

## Persistent Pilot Pass Criteria

A PostgreSQL and BullMQ/Redis pilot passes when:

- `/readyz` reports `store=postgres` and `queue=bullmq`.
- Work items, repositories, webhook deliveries, and audit logs survive an API
  restart.
- Scanner jobs either complete or return `unavailable` with clear status.
- Redis job loss does not remove durable PostgreSQL audit or work item history.
- A PostgreSQL backup and disposable restore drill have been run or explicitly
  deferred with a reason.

## Optional AI Pass Criteria

An AI pilot passes only when:

- AI is enabled by explicit operator configuration.
- Raw content is not sent unless the request includes `includeRawContent=true`
  and a repository policy source that allows it.
- `/api/pilot/metrics` raw-content transfer counts match the reviewed audit log.
- AI output is reviewed by a maintainer before being used.
- No private or sensitive repository content is shared without authorization.

## Write-Enabled Drill Criteria

Do not enable writes in the first dry-run session. A later write-enabled drill
passes only when:

- `GITHUB_WRITES_ENABLED=true` was intentionally set for the drill window.
- The specific action request used `dryRun:false`.
- The work item had a real installation id.
- The action result appears in `/api/audit-log`.
- The GitHub-side object is reviewed after the action.
- The drill is stopped by setting `GITHUB_WRITES_ENABLED=false` again.

MaintainerOps should not auto-merge, auto-approve, or auto-request changes in
any pilot phase.

## Exit Criteria

A pilot is complete enough to share when:

- entry, dry-run, and any optional module criteria are satisfied;
- fresh evidence was exported after the representative pilot activity;
- generated evidence was reviewed for repository names, actor logins, security
  findings, and private metadata;
- screenshots or notes exist for queue, recommendations, metrics, jobs, and
  audit logs;
- unresolved failures and operator decisions are documented;
- no production adoption or ecosystem usage is claimed without supporting
  evidence.

## Stop Criteria

Pause the pilot and follow the incident response process if any of these occur:

- unexpected GitHub writes;
- exposed GitHub App private key, webhook secret, installation token, or AI key;
- raw content sent to AI without policy opt-in;
- scanner job reads outside the intended workspace;
- webhook delivery replay creates duplicate applied actions;
- evidence export includes private data that cannot be shared safely.
