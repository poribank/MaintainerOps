# Architecture Decision Records

Use ADRs for decisions that materially affect MaintainerOps public APIs,
security posture, data handling, deployment compatibility, GitHub App
permissions, or release ownership.

ADRs should be short and reviewable. Prefer one decision per file.

## Naming

Use a zero-padded sequence number and a short slug:

```text
docs/adr/0001-use-postgres-for-persistent-pilots.md
```

Keep `0000-template.md` as the reusable template.

## Status Values

- `Proposed`: under discussion.
- `Accepted`: approved for implementation.
- `Superseded`: replaced by a newer ADR.
- `Rejected`: considered but not adopted.

## Review Triggers

Open or update an ADR when a change:

- adds or expands GitHub App permissions;
- changes raw-content or AI-provider behavior;
- changes persistent storage or retention expectations;
- changes external release, package, or container publishing ownership;
- introduces a public API or migration requirement;
- changes scanner execution boundaries.
