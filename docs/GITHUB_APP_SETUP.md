# GitHub App Setup

Use this guide to run a dry-run pilot on a repository you own, maintain, or are authorized to administer.

## 1. Register the App

Create a new GitHub App in the organization or account that owns the pilot repository.

Recommended basic settings:

- Webhook URL: `https://<your-host>/webhooks/github`
- Webhook secret: generate a long random value and set `GITHUB_WEBHOOK_SECRET`.
- Expire user authorization tokens: enabled.
- Request user authorization during installation: disabled for the MVP.

## 2. Minimum Permissions

Start with the least-privilege set:

- Metadata: read
- Contents: read
- Issues: read/write
- Pull requests: read/write
- Checks: write

Optional modules may require additional permissions:

- Contents write: release draft creation
- Code scanning alerts read: CodeQL/security queue
- Secret scanning alerts read: secret alert queue
- Security events read: repository advisory queue
- Rulesets read: branch/ruleset policy checks

After changing App permissions in GitHub, approve the updated installation permissions and verify the installed App from the command line:

```sh
npm run github:doctor -- \
  --installation-id "$GITHUB_INSTALLATION_ID" \
  --repository owner/name
```

For pilots that exercise release draft creation, require `Contents: read and write`:

```sh
npm run github:doctor -- \
  --installation-id "$GITHUB_INSTALLATION_ID" \
  --repository owner/name \
  --require-release-drafts
```

For pilots that inspect or modify repository administration settings, require `Administration: read and write`:

```sh
npm run github:doctor -- \
  --installation-id "$GITHUB_INSTALLATION_ID" \
  --repository owner/name \
  --require-administration
```

The doctor command only reads installation and repository metadata. It does not create releases, tags, comments, labels, checks, or other repository changes.

## 3. Webhook Events

Subscribe manually to:

- `issues`
- `issue_comment`
- `pull_request`
- `pull_request_review`
- `pull_request_review_comment`
- `check_suite`
- `workflow_run`
- `release`

GitHub delivers these installation lifecycle events to GitHub Apps by default, and they cannot be manually subscribed to:

- `installation`
- `installation_repositories`

Optional security events:

- `dependabot_alert`
- `code_scanning_alert`
- `secret_scanning_alert`
- `repository_advisory`

When using the GitHub App manifest flow, do not include `installation` or `installation_repositories` in `default_events`. GitHub rejects manifests that list default-only installation events.

## 4. Local Dry-Run

```sh
cp .env.example .env
npm install
npm run check
PORT=3000 npm run start --workspace @maintainerops/server
```

For local webhook testing, expose the API with a trusted tunnel and set the GitHub App webhook URL to the tunnel URL.
For a stable no-account local pilot, a Smee channel is enough:

```sh
WEBHOOK_PROXY_URL=https://smee.io/<channel>
npx --yes smee-client --url "$WEBHOOK_PROXY_URL" --target http://localhost:3000/webhooks/github
```

Keep these defaults for the first pilot:

```sh
GITHUB_WRITES_ENABLED=false
AI_PROVIDER=disabled
STORE_DRIVER=memory
QUEUE_DRIVER=memory
```

## 5. Persistent Pilot

Use PostgreSQL and Redis/BullMQ when you need restart-safe evidence:

```sh
docker compose up -d postgres redis

STORE_DRIVER=postgres \
DATABASE_URL=postgres://maintainerops:maintainerops@localhost:5432/maintainerops \
QUEUE_DRIVER=bullmq \
REDIS_URL=redis://localhost:6379 \
QUEUE_INLINE_WORKER=true \
SEED_DEMO_DATA=false \
npm run dev
```

Run Scorecard with a GitHub App installation token or a least-privilege user token in `GITHUB_AUTH_TOKEN` so the scanner can read repository metadata without hitting anonymous API limits:

```sh
export GITHUB_AUTH_TOKEN=$(npm run --silent github:token -- --installation-id "$GITHUB_INSTALLATION_ID")
```

OSV Scanner uses `SCANNER_WORKSPACE_ROOT` as its allowed root and rejects paths outside that directory.

Validated pilot shape:

- GitHub App installed on `poribank/MaintainerOps`.
- Webhook proxy forwarding to the local API returned HTTP 202 from `POST /webhooks/github`.
- PostgreSQL stored repository, work item, webhook delivery, and audit-log records.
- BullMQ completed Scorecard and OSV Scanner jobs.
- Evidence was exported with `npm run evidence:export`.

## 6. Enabling Writes

Only enable writes after dry-run behavior is reviewed:

```sh
GITHUB_WRITES_ENABLED=true
```

Write actions still require:

- a real GitHub App installation id from webhook events;
- explicit API request with `dryRun:false`;
- action-specific metadata such as `headSha`, `labels`, or `body`;
- audit log recording.

MaintainerOps does not auto-merge, auto-approve, or auto-request changes.

## 7. Evidence to Capture

For the Codex for Open Source application or follow-up:

- screenshot of the installed GitHub App;
- screenshot of the maintainer queue with real PR/issue/release work items;
- output of `GET /api/pilot/metrics`;
- examples of dry-run recommendations accepted or rejected by maintainers;
- audit log entries showing approval-gated behavior;
- screenshots of Scorecard/OSV jobs.
