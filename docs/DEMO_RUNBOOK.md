# Demo Runbook

Use this runbook when presenting MaintainerOps from a fresh checkout or when
collecting repeatable public pilot evidence.

## Goals

- Show that the API starts from built artifacts.
- Ingest representative GitHub webhook events with signature verification.
- Review queue, metrics, jobs, and audit evidence without enabling writes.
- Export evidence files that can be reviewed before publication.

## Preconditions

- Node.js 24 or newer.
- Dependencies installed with `npm install`.
- No production tokens in the shell history or committed files.
- `GITHUB_WRITES_ENABLED` unset or set to `false`.
- `AI_PROVIDER` unset or set to `disabled` unless the demo explicitly covers
  policy-gated AI behavior.

Run the full local gate before the demo window:

```sh
npm run check
```

## Fixture Replay Demo

Build and start the API on a dedicated demo port:

```sh
npm run build
PORT=3001 GITHUB_WEBHOOK_SECRET=dev-secret npm run start --workspace @maintainerops/server
```

In another terminal, replay the bundled webhook fixtures:

```sh
npm run demo:replay -- --url http://localhost:3001/webhooks/github --secret dev-secret
```

Expected result:

- Each replay output returns `status: 202`.
- `GET http://localhost:3001/readyz` returns `ok: true`.
- `GET http://localhost:3001/api/queue` includes PR, issue, release, and
  security work items.
- `GET http://localhost:3001/api/pilot/metrics` reports non-zero work items and
  recommendations.

## Dashboard Demo

Start the dashboard against the demo API:

```sh
VITE_API_BASE=http://localhost:3001 npm run dev:web
```

Open the dashboard URL printed by Vite.
The API allows `WEB_ORIGIN`, which defaults to `http://localhost:5173`. If Vite
uses another port, restart the API with `WEB_ORIGIN` set to the printed dashboard
origin.

Show these views during the walkthrough:

- repository and work item counts;
- selected work item findings and recommendations;
- approval-gated actions in dry-run mode;
- scanner job status if scanner binaries are installed;
- audit log entries after any dry-run or local queue action.

Do not present a write action as applied unless the API response shows
`outcome: "applied"` and the action was intentionally run with `dryRun:false`.

## Live Webhook Pilot

For a live local pilot, keep the API running and forward a stable webhook proxy
to it:

```sh
WEBHOOK_PROXY_URL=https://smee.io/<channel>
npx --yes smee-client --url "$WEBHOOK_PROXY_URL" --target http://localhost:3001/webhooks/github
```

Set the GitHub App webhook URL to the Smee channel and use the same
`GITHUB_WEBHOOK_SECRET` value configured for the API.

Minimum validation:

- GitHub webhook deliveries show HTTP 202.
- The queue includes live repository metadata from the installed repository.
- Re-delivered events do not create duplicate work items.
- Dry-run recommendations are understandable to the maintainer reviewing them.

Keep these settings for the first live pilot:

```sh
GITHUB_WRITES_ENABLED=false
AI_PROVIDER=disabled
SEED_DEMO_DATA=false
```

## Evidence Export

Export local evidence after replaying fixtures or receiving live webhooks:

```sh
npm run evidence:export -- --url http://localhost:3001 --out evidence
```

Expected files:

- `evidence/maintainerops-evidence-<timestamp>.json`
- `evidence/maintainerops-evidence-<timestamp>.md`

Before sharing evidence, review both files for repository names, private
metadata, and any pilot-specific notes that should not be public.

## Optional Persistent Pilot

Use PostgreSQL and Redis when the demo needs restart-safe state:

```sh
docker compose up -d postgres redis

PORT=3001 \
STORE_DRIVER=postgres \
DATABASE_URL=postgres://maintainerops:maintainerops@localhost:5432/maintainerops \
QUEUE_DRIVER=bullmq \
REDIS_URL=redis://localhost:6379 \
QUEUE_INLINE_WORKER=true \
SEED_DEMO_DATA=false \
GITHUB_WEBHOOK_SECRET=dev-secret \
npm run start --workspace @maintainerops/server
```

Pass criteria:

- `readyz.store` is `postgres`.
- `readyz.queue` is `bullmq`.
- Work items and audit log entries remain after restarting the API.

## Cleanup

Stop the API, dashboard, and webhook proxy processes.

For local persistent demos, remove disposable containers and volumes only after
exporting evidence that needs to be kept:

```sh
docker compose down
```

Do not commit generated evidence files or local secret files.
