# Contributing

Thanks for contributing to MaintainerOps.

## Development

```sh
npm install
npm run check
```

Keep changes small and include tests for policy logic, scoring, webhook handling, or API behavior.

Optional PostgreSQL store integration tests require a running database with `apps/server/db/schema.sql` applied:

```sh
docker compose up -d postgres
TEST_DATABASE_URL=postgres://maintainerops:maintainerops@localhost:5432/maintainerops npm run test:postgres
```

## Pull requests

- Explain user-visible behavior changes.
- Include migration notes for schema or configuration changes.
- Avoid adding GitHub App permissions unless the feature cannot work without them.
- Keep AI features optional and disabled by default.
