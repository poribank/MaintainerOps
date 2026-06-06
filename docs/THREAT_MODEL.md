# Threat Model

## Assets

- GitHub App private key and installation tokens.
- GitHub webhook secret.
- Repository metadata, pull request metadata, issue metadata, and optional raw content.
- BYOK AI provider credentials.
- Audit logs.

## Trust boundaries

- GitHub webhook boundary: every webhook must be signature verified when a secret is configured.
- GitHub API boundary: all outbound API calls must use least-privilege installation tokens.
- AI provider boundary: repository content must not cross this boundary unless explicitly enabled by repository policy.
- Admin UI boundary: write actions must be attributable to a human actor.
- Admin API boundary: deployments should restrict MaintainerOps API access to trusted maintainers.

## Main risks

- Forged webhook events create false work items.
- Overbroad GitHub App permissions allow unnecessary writes.
- AI integrations leak private repository content.
- Raw PR diffs or issue bodies are sent to an AI provider without repository-level opt-in.
- Duplicate webhook delivery creates repeated labels, comments, or checks.
- Rate limit retries amplify outages or secondary rate limits.
- Scanner endpoints read unintended server filesystem paths.
- An exposed API lets unauthenticated users trigger dry-run actions, scanner jobs, or AI-assist requests.

## Controls

- HMAC SHA-256 webhook verification.
- Idempotent delivery processing.
- Report-only policy compliance by default.
- Data minimization defaults.
- Explicit approval for GitHub write actions.
- Explicit non-dry-run requests for local queue status changes.
- Structured audit logs for every write.
- `GITHUB_WRITES_ENABLED=false` by default.
- Optional `ADMIN_TOKEN` Bearer authentication for MaintainerOps API routes.
- OSV Scanner paths are constrained to the MaintainerOps workspace.
- AI raw-content transfer requires explicit repository policy opt-in and is audit logged.
