# Architecture

MaintainerOps is split into three workspaces:

- `packages/core`: policy parsing, scoring, triage, release readiness, security checks, and shared types.
- `apps/server`: Fastify API, GitHub webhook ingest, action approval surface, GitHub write adapter, scanner runner, memory/BullMQ job queues, and memory/PostgreSQL stores.
- `apps/web`: React dashboard for maintainers.

## Event flow

1. GitHub sends a webhook to `POST /webhooks/github`.
2. The server verifies the HMAC signature when configured.
3. The event is normalized into one or more `WorkItem` records.
4. Core analyzers compute findings, recommendations, and priority.
5. The dashboard shows the work item and exposes approved actions.
6. PostgreSQL can persist work items, repositories, deliveries, and audit logs when `STORE_DRIVER=postgres`.
7. Scanner jobs can run through the in-memory queue for local development or BullMQ/Redis for pilot deployments.

## Write model

The API exposes write actions through `POST /api/work-items/:id/actions`. Requests are dry-run unless the caller sends `dryRun:false`, GitHub App credentials are configured, the work item has an installation id, and `GITHUB_WRITES_ENABLED=true`.

Every write action is tied to an actor and audit log entry. Failed writes are also audit logged with `outcome=failed`.

## Scanner flow

Scorecard uses `scorecard --repo=github.com/owner/name --format=json` and inherits `GITHUB_AUTH_TOKEN` from the server or worker environment when present. OSV Scanner uses `osv-scanner scan source --format json -r <path>`, limited to paths inside `SCANNER_WORKSPACE_ROOT`. The root defaults to the npm invocation directory so workspace commands still scan the repository root instead of only `apps/server`.

For long-running scans, callers enqueue work through `POST /api/jobs/scans/scorecard` or `POST /api/jobs/scans/osv` and poll `GET /api/jobs/:id`. `QUEUE_DRIVER=memory` processes jobs in the API process. `QUEUE_DRIVER=bullmq` stores jobs in Redis and can process them inline or in the dedicated `npm run worker` process.
