# Observability

Use this guide to monitor a MaintainerOps demo or public OSS pilot. It focuses
on the built-in API surfaces that exist today, not on external telemetry
systems.

## Health and Readiness

Use `/healthz` for process liveness:

```sh
curl -fsS http://localhost:3000/healthz
```

Expected response:

```json
{"ok":true}
```

Use `/readyz` to confirm the configured store and queue drivers:

```sh
curl -fsS http://localhost:3000/readyz
```

Local demo readiness normally reports:

```json
{"ok":true,"store":"memory","queue":"memory"}
```

Persistent pilot readiness should report:

```json
{"ok":true,"store":"postgres","queue":"bullmq"}
```

Do not accept live webhooks for a persistent pilot until `/readyz` reports the
expected drivers.

## Queue View

Use `/api/queue` to inspect normalized work items:

```sh
curl -fsS http://localhost:3000/api/queue
```

Useful filters:

```sh
curl -fsS 'http://localhost:3000/api/queue?status=open'
curl -fsS 'http://localhost:3000/api/queue?kind=pull_request'
curl -fsS 'http://localhost:3000/api/queue?repository=owner/name'
```

During a representative pilot, the queue should include PR, issue, release, and
security or policy work items. Fixture-only queues are valid for reproducible
demos, but they should not be presented as real adoption evidence.

## Pilot Metrics

Use `/api/pilot/metrics` for compact evidence counters:

```sh
curl -fsS http://localhost:3000/api/pilot/metrics
```

The response includes:

- `repositories`: unique repositories represented in the queue;
- `workItems.total`, `open`, `triaged`, and `resolved`;
- `workItems.pullRequests`, `issues`, `releases`, and `securityOrPolicy`;
- `recommendations.total` and `approvalGated`;
- `audit.total`, `failed`, `applied`, `aiAssists`, and
  `aiRawContentTransfers`;
- `jobs.total`, `completed`, and `failed`.

For a dry-run public pilot:

- `audit.applied` should stay `0` unless a local queue status action was
  intentionally applied with `dryRun:false`;
- `aiRawContentTransfers` should stay `0` unless a repository policy explicitly
  opted in;
- `jobs.failed` should be explained in the pilot notes;
- `workItems.securityOrPolicy` should be reviewed before release claims are
  made.

## Audit Log

Use `/api/audit-log` to review actions:

```sh
curl -fsS http://localhost:3000/api/audit-log
```

Audit entries are evidence for:

- local queue status changes;
- dry-run or applied GitHub write actions;
- failed action attempts;
- AI assistance requests;
- failed raw-content AI requests.

For unexpected writes, preserve the audit entry and any GitHub request id before
making manual corrections.

## Jobs

Use `/api/jobs` to review scanner jobs:

```sh
curl -fsS http://localhost:3000/api/jobs
curl -fsS 'http://localhost:3000/api/jobs?limit=100'
```

Use `/api/jobs/:id` to inspect one job:

```sh
curl -fsS http://localhost:3000/api/jobs/<job-id>
```

Scanner jobs can finish as `completed`, `failed`, or `unavailable`. An
`unavailable` scanner result means the external scanner binary is not available
to that API or worker process. It is acceptable in local demos when documented,
but it should not be used as evidence that the scanner found no issues.

## Evidence Export

`npm run evidence:export` captures the same built-in observability surfaces:

- `/readyz`;
- `/api/queue`;
- `/api/pilot/metrics`;
- `/api/jobs`;
- `/api/audit-log`.

Run it after representative pilot activity:

```sh
npm run evidence:export -- --url http://localhost:3000 --out evidence
```

Review generated JSON and Markdown before sharing. Evidence can contain
repository names, actor logins, findings, job status, and audit metadata.

## Stop Signals

Pause the pilot and follow the incident response process when any of these are
observed:

- `/readyz` reports an unexpected store or queue driver;
- webhook deliveries stop returning HTTP 202;
- duplicate redeliveries create duplicate work items or applied actions;
- `audit.applied` increases during a dry-run session;
- `aiRawContentTransfers` increases without an explicit repository policy
  opt-in;
- scanner jobs read outside the intended workspace;
- evidence export contains private data that cannot be shared safely.

## What Not to Infer

Built-in metrics prove local system behavior. They do not prove public adoption,
ecosystem usage, maintainer satisfaction, or production reliability without
separate evidence from real pilots and maintainers.
