# Security Policy

## Supported versions

MaintainerOps is pre-1.0. Security fixes are applied to `main` until release branches are introduced.

## Reporting a vulnerability

Please do not open public issues for suspected vulnerabilities. Send a private report to the project maintainers listed in `GOVERNANCE.md` or use GitHub private vulnerability reporting when enabled.

Reports should include:

- affected version or commit SHA;
- deployment model;
- reproduction steps;
- expected impact;
- whether repository content, secrets, or GitHub installation tokens may be exposed.

## Security defaults

- AI features are disabled by default.
- Raw PR diffs and issue bodies are not persisted by default.
- GitHub write actions require explicit approval or repository opt-in policy.
- Webhook signatures are verified when `GITHUB_WEBHOOK_SECRET` is configured.
- All write actions are audit logged.
