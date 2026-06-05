# Evidence Export

MaintainerOps includes a local evidence workflow for Codex for Open Source applications and maintainer pilot reviews.

The generated evidence can show:

- webhook ingest works;
- PR, issue, release, and security work items are created;
- pilot metrics are available;
- AI raw-content transfer remains disabled unless policy allows it;
- scanner jobs and audit logs are visible.

## 1. Start the API

For a one-command local smoke flow, run:

```sh
npm run demo:smoke
```

The smoke flow builds the workspaces, starts a temporary local API, replays the bundled fixtures, records a dry-run write action, requests metadata-only AI assistance, enqueues an OSV job, and exports evidence under `evidence/demo-smoke-<timestamp>/`.

Build once from a fresh clone so `npm run start` can load compiled server files:

```sh
npm run build
```

Then start the API on a dedicated demo port:

```sh
PORT=3001 GITHUB_WEBHOOK_SECRET=dev-secret npm run start --workspace @maintainerops/server
```

For restart-safe pilot evidence, start PostgreSQL and Redis first, then run the compiled API with persistent drivers:

```sh
docker compose up -d postgres redis

PORT=3001 \
STORE_DRIVER=postgres \
DATABASE_URL=postgres://maintainerops:maintainerops@localhost:5432/maintainerops \
QUEUE_DRIVER=bullmq \
REDIS_URL=redis://localhost:6379 \
QUEUE_INLINE_WORKER=true \
SEED_DEMO_DATA=false \
npm run start --workspace @maintainerops/server
```

## 2. Replay Demo Webhooks

Replay all bundled fixtures:

```sh
npm run demo:replay -- --url http://localhost:3001/webhooks/github --secret dev-secret
```

Replay one fixture:

```sh
npm run demo:replay -- \
  --url http://localhost:3001/webhooks/github \
  --secret dev-secret \
  --fixture pull_request.opened.json \
  --event pull_request
```

Fixtures live in `apps/server/fixtures/github`.

To run the same smoke checks against an API that is already running:

```sh
npm run demo:smoke -- --url http://localhost:3001 --secret dev-secret
```

## 3. Export Evidence

```sh
npm run evidence:export -- --url http://localhost:3001 --out evidence
```

This writes:

- `evidence/maintainerops-evidence-<timestamp>.json`
- `evidence/maintainerops-evidence-<timestamp>.md`

Generated evidence files are gitignored by default. Review them before attaching to an application or issue.

## 4. Real Pilot Guidance

For a real Codex for Open Source application, prefer evidence from a repository you own, maintain, or are authorized to administer. Demo fixtures are useful for reproducibility, but they do not prove real ecosystem usage.

Capture real pilot evidence after following `docs/GITHUB_APP_SETUP.md`.
When using Scorecard in a live pilot, start the API with `GITHUB_AUTH_TOKEN` set to a token that can read the pilot repository metadata:

```sh
export GITHUB_AUTH_TOKEN=$(npm run --silent github:token -- --installation-id "$GITHUB_INSTALLATION_ID")
```

OSV Scanner resolves scan requests from `SCANNER_WORKSPACE_ROOT`, so set it explicitly when the server process starts outside the repository root.
