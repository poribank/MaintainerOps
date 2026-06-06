# ADR 0002: Require Explicit Opt-In for AI Raw Content

- Status: Accepted
- Date: 2026-06-06
- Owners: MaintainerOps maintainers

## Context

MaintainerOps can optionally use AI assistance to summarize maintainer work
items and explain recommendations. Repository diffs, issue bodies, logs, and
security reports can contain secrets, private vulnerability details, personal
data, or embargoed release information.

The public pilot must demonstrate that AI assistance is a maintainer-controlled
workflow, not an implicit data export path.

## Decision

AI assistance uses normalized work item metadata by default. Raw repository
content is not sent to an AI provider unless every condition below is satisfied:

- the API request sets `includeRawContent=true`;
- the API request includes a non-empty `rawContent` field;
- the API request includes a repository policy source;
- the repository policy enables AI for a non-disabled provider;
- the repository policy enables raw-content retention for a positive number of
  days;
- the request outcome is recorded in the audit log.

If any condition is missing, MaintainerOps rejects the request before invoking
the AI provider.

## Consequences

Operators can demo AI assistance without exposing raw repository content. Public
pilot evidence can show that raw-content transfer counts remain zero until a
repository policy explicitly opts in.

The API is more verbose for raw-content flows because callers must provide the
policy source with the request. This is intentional: raw-content transfer should
be visible in the request, reviewable in the policy, and traceable in the audit
log.

The AI adapter must continue to redact recognized secrets and enforce configured
input-size limits before provider calls.

## Alternatives Considered

### Enable raw content whenever AI is configured

Rejected. Provider configuration proves the operator has an API key; it does not
prove that a specific repository opted into raw-content transfer.

### Use a global raw-content environment flag

Rejected. Repository-level policy is clearer for multi-repository pilots and
avoids one global setting silently changing the data boundary for every
repository.

### Persist raw content for replayable AI evaluations

Rejected for the public pilot. Evaluation harnesses can be introduced later with
separate retention, deletion, and access-control decisions.

## Review Plan

Revisit this decision before adding multi-repository AI evaluation, private
repository pilots, or long-lived raw-content storage.
