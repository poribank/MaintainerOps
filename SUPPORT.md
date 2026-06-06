# Support

MaintainerOps is in an early public OSS pilot stage. Support is best-effort and focused on reproducible maintainer workflows, demo reliability, and security-conscious setup.

## Where to Ask

- Bugs: open a bug report with the repository, queue mode, store mode, webhook event shape, and relevant logs.
- Feature ideas: open a feature request and describe the maintainer workflow it should improve.
- Security workflow gaps: use the security workflow issue template when the topic is about release gates, scanner coverage, policy checks, or GitHub App permissions.
- Vulnerabilities: do not open public issues. Follow [SECURITY.md](SECURITY.md).

## Supported Surfaces

The current pilot focuses on:

- local memory-mode demos;
- PostgreSQL and Redis-backed local pilot runs;
- GitHub App webhook ingest for repositories the operator owns or administers;
- fixture replay and evidence export;
- dry-run or approval-gated GitHub write actions.

## Not Yet Supported

- managed hosted support;
- service-level objectives or guaranteed response times;
- autonomous merge, approval, or release publishing;
- scanning repositories without maintainer authorization;
- support for private credentials, tokens, or raw repository content shared in public issues.

## Reproduction Checklist

When reporting a support issue, include:

- commit SHA or release version;
- Node.js and npm versions;
- `STORE_DRIVER`, `QUEUE_DRIVER`, and whether Docker Compose is used;
- the command that failed;
- expected behavior and actual behavior;
- sanitized logs or evidence export output.

Do not include secrets, GitHub App private keys, installation tokens, webhook secrets, private issue content, or private repository source.
