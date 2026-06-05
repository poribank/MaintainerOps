# Security Policy

## Supported versions

MaintainerOps is pre-1.0. Security fixes are applied to `main` until release branches are introduced.

## Reporting a vulnerability

Please do not open public issues for suspected vulnerabilities. Use GitHub private vulnerability reporting for this repository, or contact the maintainers listed in `GOVERNANCE.md` if private reporting is unavailable.

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

## Repository security settings

The public pilot repository is configured with:

- GitHub private vulnerability reporting enabled;
- Dependabot vulnerability alerts enabled;
- Dependabot security updates enabled;
- secret scanning enabled;
- secret scanning push protection enabled;
- CodeQL analysis on pushes, pull requests, and a weekly schedule.
