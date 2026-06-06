# Pilot Runbook

Use this runbook for a dry-run MaintainerOps pilot on a repository you own, maintain, or are authorized to administer.

## Safety defaults

Keep the first pilot conservative:

```sh
GITHUB_WRITES_ENABLED=false
AI_PROVIDER=disabled
STORE_DRIVER=memory
QUEUE_DRIVER=memory
SEED_DEMO_DATA=false
```

Do not commit `.env`, `.env.*`, private keys, installation tokens, generated evidence, or raw webhook payloads from private repositories.

## 1. Preflight

From a clean checkout:

```sh
npm install
npm run check
docker compose config
```

Confirm the GitHub App follows `docs/GITHUB_APP_SETUP.md`, has a webhook secret configured, and is installed only on the pilot repository unless broader access is explicitly approved.

## 2. Local webhook dry run

Start the API with writes disabled:

```sh
PORT=3000 \
GITHUB_WEBHOOK_SECRET=<webhook-secret> \
GITHUB_WRITES_ENABLED=false \
AI_PROVIDER=disabled \
SEED_DEMO_DATA=false \
npm run dev
```

Forward the GitHub App webhook through the chosen tunnel or Smee channel:

```sh
npx --yes smee-client --url "$WEBHOOK_PROXY_URL" --target http://localhost:3000/webhooks/github
```

Generate safe pilot events in the target repository:

- open or update a test issue;
- open a draft pull request;
- publish or draft a test release only if the repository owner approves;
- use GitHub security test fixtures only in repositories where that is authorized.

Confirm the API returns HTTP 202 for webhook deliveries and the dashboard shows work items without enabling GitHub writes.

## 3. Persistent evidence run

Use PostgreSQL and Redis when the pilot needs restart-safe evidence:

```sh
docker compose up -d postgres redis

PORT=3000 \
STORE_DRIVER=postgres \
DATABASE_URL=postgres://maintainerops:maintainerops@localhost:5432/maintainerops \
QUEUE_DRIVER=bullmq \
REDIS_URL=redis://localhost:6379 \
QUEUE_INLINE_WORKER=true \
GITHUB_WEBHOOK_SECRET=<webhook-secret> \
GITHUB_WRITES_ENABLED=false \
AI_PROVIDER=disabled \
SEED_DEMO_DATA=false \
npm run dev
```

If Scorecard needs GitHub API access, create a short-lived token only in the shell:

```sh
export GITHUB_AUTH_TOKEN=$(npm run --silent github:token -- --installation-id "$GITHUB_INSTALLATION_ID")
```

Set `SCANNER_WORKSPACE_ROOT` when running OSV Scanner outside the repository root.

## 4. Evidence capture

Capture application evidence:

```sh
npm run evidence:export -- --url http://localhost:3000 --out evidence
```

Capture supporting maintainer evidence:

- screenshot of the installed GitHub App and selected repository access;
- screenshot of the queue, recommendations, scanner jobs, and audit log;
- output from `GET /api/pilot/metrics`;
- `npm run check` output;
- Scorecard, OSV, and npm audit summaries;
- links to reviewed pull requests used during the pilot.

Review generated files before sharing them. Evidence can include repository names, issue titles, labels, actor logins, timestamps, and other metadata.

## 5. Cleanup

After the pilot:

```sh
unset GITHUB_AUTH_TOKEN
docker compose stop postgres redis
```

If a temporary webhook tunnel was used, stop the tunnel and remove the temporary webhook URL from the GitHub App settings.

Do not delete persistent pilot data until evidence has been reviewed and any required exports are stored in an approved location.

## Escalation

Pause the pilot and keep writes disabled if any of these occur:

- webhook signature verification fails unexpectedly;
- GitHub write actions are requested with `dryRun:false` before approval;
- raw content AI assistance is requested without an explicit repository policy;
- scanner output reports unresolved critical vulnerabilities;
- evidence contains private repository content that was not approved for sharing.
