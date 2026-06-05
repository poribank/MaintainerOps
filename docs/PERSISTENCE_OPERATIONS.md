# Persistence Operations

This guide covers persistent MaintainerOps pilots that use PostgreSQL for the
application store and Redis/BullMQ for scanner jobs.

It is intended for local and small public OSS pilots. Production deployments
should add infrastructure-specific backup, restore, monitoring, and access
control procedures.

## Persistent Components

PostgreSQL stores the durable MaintainerOps state when `STORE_DRIVER=postgres`:

- `installations`: GitHub App installation account metadata;
- `repositories`: repository metadata for ingested work;
- `webhook_deliveries`: delivery ids used for replay and duplicate detection;
- `work_items`: normalized PR, issue, release, policy, and security queue
  items;
- `audit_log`: dry-run, local queue, AI assistance, and GitHub write attempts.

Redis stores BullMQ job state when `QUEUE_DRIVER=bullmq`. Treat Redis as
operational queue state, not as the source of truth for audit or work item
history.

## Pilot Startup

Start the persistent dependencies:

```sh
docker compose up -d postgres redis
```

Start the API with persistent storage:

```sh
STORE_DRIVER=postgres \
DATABASE_URL=postgres://maintainerops:maintainerops@localhost:5432/maintainerops \
QUEUE_DRIVER=bullmq \
REDIS_URL=redis://localhost:6379 \
QUEUE_INLINE_WORKER=true \
SEED_DEMO_DATA=false \
npm run dev
```

For a compiled demo server, use the same environment variables with
`npm run start --workspace @maintainerops/server`.

Verify readiness before accepting webhooks:

```sh
curl -fsS http://localhost:3000/readyz
```

Expected persistent readiness:

```json
{"ok":true,"store":"postgres","queue":"bullmq"}
```

## Backup

Back up PostgreSQL before destructive maintenance, schema changes, or pilot
handoff.

For Docker Compose pilots:

```sh
docker compose exec -T postgres pg_dump \
  -U maintainerops \
  -d maintainerops \
  --format=custom \
  --file=/tmp/maintainerops.dump

docker compose cp postgres:/tmp/maintainerops.dump ./maintainerops.dump
```

Store backup files outside the git repository. A backup can contain repository
names, actor logins, audit metadata, and security findings.

## Restore Drill

Run restore drills against a disposable database before relying on a backup.

```sh
docker compose exec -T postgres dropdb -U maintainerops --if-exists maintainerops_restore
docker compose exec -T postgres createdb -U maintainerops maintainerops_restore
docker compose cp ./maintainerops.dump postgres:/tmp/maintainerops.dump
docker compose exec -T postgres pg_restore \
  -U maintainerops \
  -d maintainerops_restore \
  --clean \
  --if-exists \
  /tmp/maintainerops.dump
```

Validate restored state with table counts:

```sh
docker compose exec -T postgres psql -U maintainerops -d maintainerops_restore -c \
  "select 'repositories' as table_name, count(*) from repositories union all
   select 'work_items', count(*) from work_items union all
   select 'webhook_deliveries', count(*) from webhook_deliveries union all
   select 'audit_log', count(*) from audit_log;"
```

Do not point a live API at a restored database until the operator confirms that
the restored data belongs to the intended pilot.

## Redis and BullMQ State

Redis queue data is useful for operational visibility, but completed scanner
jobs can be re-created from the API when needed. PostgreSQL audit and work item
records are the durable evidence source.

Before stopping Redis in a pilot:

- check `GET /api/jobs` for active jobs;
- pause new scan submissions;
- let active jobs complete when practical;
- record any failed or abandoned jobs in pilot notes.

If Redis is lost, restart the API and worker, then re-run scanner jobs that are
still needed for evidence.

## Retention

Repository policy defines intended retention settings, but the application does
not currently delete old PostgreSQL rows automatically.

Pilot operators should define retention for:

- `audit_log` rows;
- `work_items` and their embedded analyzer payloads;
- `webhook_deliveries` used for duplicate detection;
- exported evidence files;
- PostgreSQL backup files.

Do not delete `webhook_deliveries` during an active replay test unless duplicate
detection is intentionally being reset.

## Upgrade Checklist

Before changing schema, storage drivers, or queue drivers:

- export fresh evidence with `npm run evidence:export`;
- back up PostgreSQL;
- record the current commit SHA and package version;
- run `npm run check`;
- apply the change in a disposable environment first;
- verify `/readyz`, `/api/queue`, `/api/pilot/metrics`, `/api/jobs`, and
  `/api/audit-log`;
- keep `GITHUB_WRITES_ENABLED=false` until the restored or upgraded instance is
  verified.

## Failure Notes

If persistent startup fails:

- confirm `STORE_DRIVER=postgres` has a `DATABASE_URL`;
- confirm the schema in `apps/server/db/schema.sql` has been applied;
- confirm `QUEUE_DRIVER=bullmq` can reach `REDIS_URL`;
- restart the API after dependency recovery;
- avoid replaying live webhook deliveries until `/readyz` returns the expected
  persistent drivers.
