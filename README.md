# MaintainerOps

[![CI](https://github.com/poribank/MaintainerOps/actions/workflows/ci.yml/badge.svg)](https://github.com/poribank/MaintainerOps/actions/workflows/ci.yml)
[![CodeQL](https://github.com/poribank/MaintainerOps/actions/workflows/codeql.yml/badge.svg)](https://github.com/poribank/MaintainerOps/actions/workflows/codeql.yml)
[![Package](https://github.com/poribank/MaintainerOps/actions/workflows/package.yml/badge.svg)](https://github.com/poribank/MaintainerOps/actions/workflows/package.yml)
[![Release Preflight](https://github.com/poribank/MaintainerOps/actions/workflows/release-preflight.yml/badge.svg)](https://github.com/poribank/MaintainerOps/actions/workflows/release-preflight.yml)
[![Scorecard](https://github.com/poribank/MaintainerOps/actions/workflows/scorecard.yml/badge.svg)](https://github.com/poribank/MaintainerOps/actions/workflows/scorecard.yml)

MaintainerOps is a self-hosted GitHub App for open source maintainers who run many critical repositories. It centralizes pull request review support, issue triage, release readiness, and security policy compliance into one maintainer queue.

The project is intentionally conservative: it recommends and reports by default. It does not auto-merge, auto-approve, or send private repository content to external AI providers unless a repository explicitly opts in.

## Codex for Open Source fit

MaintainerOps is built around the same maintainer workloads targeted by the Codex for Open Source program: pull request review, issue triage, release workflow support, maintainer automation, and security review. The rule-based core works without AI, while API credits can power optional summaries and recommendation rationales after a repository explicitly opts in.

Application materials:

- [Codex for Open Source application kit](docs/CODEX_FOR_OSS_APPLICATION.md)
- [API credits plan](docs/API_CREDITS_PLAN.md)
- [Pilot plan](docs/PILOT_PLAN.md)
- [GitHub App setup](docs/GITHUB_APP_SETUP.md)
- [Evidence export](docs/EVIDENCE_EXPORT.md)
- [Roadmap](ROADMAP.md)

## MVP capabilities

- GitHub App webhook ingest with signature verification and idempotency.
- Unified work queue for pull requests, issues, releases, policy findings, and security signals.
- Rule-based risk scoring, issue label recommendation, release blocker detection, and policy validation.
- Check-run first output model with dry-run by default, explicit GitHub write adapter support, and audit logging for write actions.
- Optional PostgreSQL persistence using the schema in `apps/server/db/schema.sql`.
- Optional background jobs using in-memory queue by default or BullMQ/Redis for pilots.
- Optional Scorecard and OSV Scanner runner endpoints when the scanner binaries are installed.
- Optional BYOK AI adapter surface, disabled by default.
- React dashboard for repository health, work items, recommendations, and approved actions.

## Quick start

Use Node.js 24 or newer. The repository includes `.nvmrc` for nvm users.

```sh
npm install
npm run check
npm run dev
```

The API server listens on `http://localhost:3000`. Start the dashboard in another terminal:

```sh
npm run dev:web
```

The dashboard listens on `http://localhost:5173`.

## Runtime modes

MaintainerOps defaults to a safe local mode:

- `STORE_DRIVER=memory`
- `QUEUE_DRIVER=memory`
- `GITHUB_WRITES_ENABLED=false`
- `SEED_DEMO_DATA=true`

For a persistent pilot, create the PostgreSQL schema from `apps/server/db/schema.sql` and use:

```sh
docker compose up -d postgres redis

STORE_DRIVER=postgres \
DATABASE_URL=postgres://maintainerops:maintainerops@localhost:5432/maintainerops \
SEED_DEMO_DATA=false \
npm run dev
```

For Redis-backed jobs:

```sh
QUEUE_DRIVER=bullmq \
REDIS_URL=redis://localhost:6379 \
QUEUE_INLINE_WORKER=true \
npm run dev
```

To run a dedicated worker process instead of the API inline worker:

```sh
QUEUE_DRIVER=bullmq QUEUE_INLINE_WORKER=false npm run dev
npm run worker
```

GitHub writes require all of the following:

- a GitHub App id and private key;
- installation ids from real webhook events;
- `GITHUB_WRITES_ENABLED=true`;
- an API action request with `dryRun:false`.

Supported write actions are `write_check`, `add_label`, `write_issue_comment`, `write_pr_comment`, and `create_release_draft`.

Local queue status actions are separate from GitHub writes. `triage` and `resolve` update only MaintainerOps state, require `dryRun:false` to apply, and are always audit logged.

For a live local webhook pilot, point the GitHub App webhook URL at a stable proxy such as Smee and forward it to the local API:

```sh
WEBHOOK_PROXY_URL=https://smee.io/<channel>
npx --yes smee-client --url "$WEBHOOK_PROXY_URL" --target http://localhost:3000/webhooks/github
```

## Configuration

Copy `.env.example` to `.env` and fill the GitHub App values for a real installation. Repository policy lives in `.github/maintainerops.yml`.

```yaml
version: 1
automation:
  applyLabels: false
  writePrComments: false
ai:
  enabled: false
  provider: disabled
dataRetention:
  rawContent: false
  rawContentDays: 0
```

## Security posture

MaintainerOps uses least-privilege GitHub App permissions, stores only metadata by default, and records every write action in an audit log. See [SECURITY.md](SECURITY.md) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Optional AI assistance

AI assistance is disabled unless configured:

```sh
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=chat-latest
```

Use an API model that is available to the configured OpenAI account. `chat-latest` is the local default for experiments; pin and evaluate a production model before using AI assistance in a real maintainer workflow.

The current assistant uses normalized work item metadata by default. Raw content is not sent unless a caller explicitly requests it and the repository policy allows that workflow.
If `includeRawContent=true`, the API requires a repository policy source that enables AI and raw-content retention for the configured provider. Otherwise the request is rejected and audit logged.

```sh
curl -X POST http://localhost:3000/api/work-items/<encoded-id>/ai-assist \
  -H 'content-type: application/json' \
  -d '{"includeRawContent":false}'
```

Raw-content opt-in example:

```sh
curl -X POST http://localhost:3000/api/work-items/<encoded-id>/ai-assist \
  -H 'content-type: application/json' \
  -d '{
    "includeRawContent": true,
    "rawContent": "<redacted diff or issue body>",
    "policySource": "version: 1\nai:\n  enabled: true\n  provider: openai\ndataRetention:\n  rawContent: true\n  rawContentDays: 7\n"
  }'
```

The dashboard does not send raw content.

## Scanner endpoints

Scorecard and OSV Scanner are optional external binaries. The server returns `unavailable` when they are not on `PATH`.
OSV Scanner paths are restricted to `SCANNER_WORKSPACE_ROOT`, which defaults to the npm invocation directory.
Set `GITHUB_AUTH_TOKEN` in the server environment when running Scorecard against GitHub repositories to avoid unauthenticated API limits.
For an installed GitHub App, generate a short-lived installation token without saving it to disk:

```sh
export GITHUB_AUTH_TOKEN=$(npm run --silent github:token -- --installation-id "$GITHUB_INSTALLATION_ID")
```

```sh
curl -X POST http://localhost:3000/api/scans/scorecard \
  -H 'content-type: application/json' \
  -d '{"repository":"ossf/scorecard"}'

curl -X POST http://localhost:3000/api/scans/osv \
  -H 'content-type: application/json' \
  -d '{"path":"."}'
```

Long-running scans should use the job API:

```sh
curl -X POST http://localhost:3000/api/jobs/scans/scorecard \
  -H 'content-type: application/json' \
  -d '{"repository":"ossf/scorecard"}'

curl http://localhost:3000/api/jobs
```

## Demo and evidence export

Build and start the API on a dedicated demo port:

```sh
npm run build
PORT=3001 GITHUB_WEBHOOK_SECRET=dev-secret npm run start --workspace @maintainerops/server
```

Replay bundled GitHub webhook fixtures into that local API:

```sh
npm run demo:replay -- --url http://localhost:3001/webhooks/github --secret dev-secret
```

Export application evidence:

```sh
npm run evidence:export -- --url http://localhost:3001 --out evidence
```

Generated evidence files are ignored by git. See [docs/EVIDENCE_EXPORT.md](docs/EVIDENCE_EXPORT.md).

## Release preflight

Release tags and manual release preflight runs verify the same checks expected before a public pilot handoff:

- `npm run check`
- npm workspace tarball generation
- CycloneDX SBOM generation with `npm sbom`
- Docker image build

The workflow uploads preflight artifacts for inspection: npm workspace tarballs, a CycloneDX SBOM, Docker image metadata, and `SHA256SUMS.txt`. Publishing GitHub Releases, npm packages, or container images still requires an explicitly configured release credential and is not enabled by default.
