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

## Quality gates

Every pull request should keep `npm run check` passing. Broaden tests when changing shared behavior, webhook normalization, policy parsing, scoring, GitHub write actions, persistence, or release automation.

Security-sensitive changes need explicit maintainer review before merge. This includes:

- GitHub App permission changes;
- webhook signature handling;
- repository content retention or AI transfer behavior;
- write actions against GitHub;
- release, packaging, or provenance workflows;
- database schema changes that affect stored audit or work item data.

Do not commit secrets, private keys, generated evidence exports, or local `.env` files. Use `.env.example` and documentation updates for configuration changes.
