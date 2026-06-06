# Security Policy

## Supported versions

MaintainerOps is pre-1.0. Security fixes are applied to `main` until release branches are introduced.

## Reporting a vulnerability

Please do not open public issues for suspected vulnerabilities. Use GitHub private vulnerability reporting for this repository:

https://github.com/poribank/MaintainerOps/security/advisories/new

If private reporting is unavailable, contact the maintainers listed in [GOVERNANCE.md](GOVERNANCE.md).

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
- API routes can be protected with `ADMIN_TOKEN` Bearer authentication.
- All write actions are audit logged.

Related security documentation:

- [Threat model](docs/THREAT_MODEL.md)
- [GitHub App setup](docs/GITHUB_APP_SETUP.md)
- [API credits and AI data handling plan](docs/API_CREDITS_PLAN.md)

## Repository security settings

The public pilot repository is configured with:

- GitHub private vulnerability reporting enabled;
- Dependabot vulnerability alerts enabled;
- Dependabot security updates enabled;
- secret scanning enabled;
- secret scanning push protection enabled;
- CodeQL analysis on pushes, pull requests, and a weekly schedule.
