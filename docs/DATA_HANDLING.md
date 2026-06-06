# Data Handling

This document describes how MaintainerOps handles repository data during local
demos and public OSS pilots. It is an operator guide, not a legal privacy
policy.

## Default Data Model

MaintainerOps stores normalized maintainer workflow metadata by default:

- repository owner, name, visibility, id, default branch, and installation id;
- work item kind, title, number, URL, labels, status, actor login, and delivery
  ids;
- analyzer findings, risk factors, recommendations, and job status;
- audit log entries for dry-run, local queue, AI assistance, and GitHub write
  requests.

Raw pull request diffs, issue bodies, and repository file contents are not
persisted by the default workflow.

## Raw Content

Raw content can cross a processing boundary only when all of these are true:

- the caller explicitly sets `includeRawContent=true`;
- the request includes `rawContent`;
- the request includes a repository policy source;
- that policy enables AI for a non-disabled provider;
- that policy enables raw-content retention for a positive number of days.

If any condition is missing, the API rejects the request and records the outcome
in the audit log.

## AI Providers

AI assistance is disabled by default. When enabled, MaintainerOps builds prompts
from normalized work item metadata unless raw content is explicitly requested
and allowed by policy.

Before sending raw content to an external provider:

- confirm the repository maintainer has opted in;
- redact secrets before sending content;
- use a provider/model approved for the pilot;
- record the request through the audit log;
- avoid sending private repository content unless the maintainer is authorized
  to share it with that provider.

## GitHub Credentials

GitHub App private keys, webhook secrets, installation tokens, and personal
tokens must stay out of git.

Operational rules:

- load secrets from environment variables or a local untracked file;
- prefer short-lived GitHub App installation tokens;
- do not write generated tokens to disk;
- keep `GITHUB_WRITES_ENABLED=false` until dry-run behavior is reviewed;
- keep release, npm, and container publishing credentials out of the demo
  environment unless the run is explicitly a release drill.

## Evidence Exports

`npm run evidence:export` writes queue, metrics, job, readiness, and audit data
to local JSON and Markdown files. These exports can contain repository names,
URLs, actor logins, findings, and pilot-specific operational notes.

Before sharing an export:

- confirm the repositories are public or authorized for disclosure;
- review repository names, URLs, actor logins, and audit metadata;
- remove generated files that are no longer needed;
- do not attach private pilot evidence to public issues or applications without
  maintainer approval.

Generated evidence files are ignored by git by default.

## Storage

Local demos use the in-memory store by default. Persistent pilots can use
PostgreSQL with the schema in `apps/server/db/schema.sql`.

Persistent operators should define their own retention process for:

- audit log entries;
- work item metadata;
- webhook delivery ids;
- scanner job results;
- exported evidence files.

Repository policy includes retention settings, but operators are responsible for
database backup, deletion, and access control outside the application process.

## Scanner Jobs

Scorecard and OSV Scanner run as local subprocesses when installed. Scorecard
may need `GITHUB_AUTH_TOKEN` to avoid anonymous API limits. OSV Scanner is
restricted to `SCANNER_WORKSPACE_ROOT`.

Treat scanner output as pilot evidence because it can include dependency names,
repository paths, and security findings.

## Public Pilot Checklist

- Use only repositories you own, maintain, or are authorized to administer.
- Keep demo credentials short-lived and uncommitted.
- Run in dry-run mode before enabling writes.
- Keep AI disabled until the repository policy opt-in is reviewed.
- Export evidence only after reviewing what will be shared.
- Document any pilot-specific retention or deletion commitments outside this
  repository.
