# API Credits Plan

MaintainerOps will use API credits only for opt-in maintainer assistance. The rule-based queue works without AI.

## Primary Workflows

1. Pull request review support
   - Summarize large diffs.
   - Explain why files are security-sensitive.
   - Suggest missing tests.
   - Draft check-run text for maintainer review.

2. Issue triage support
   - Summarize long issue threads.
   - Explain label recommendations.
   - Identify missing reproduction details.
   - Suggest maintainer follow-up questions.

3. Release workflow support
   - Summarize release blockers.
   - Explain unresolved security advisories.
   - Highlight breaking-change candidates.
   - Draft release readiness reports.

4. Security maintenance support
   - Explain OpenSSF Scorecard and OSV findings.
   - Summarize CodeQL, Dependabot, and secret scanning alerts.
   - Help maintainers update threat models and SECURITY.md.

## Safety Defaults

- AI is disabled by default.
- BYOK is required for non-program deployments.
- Raw PR diffs, issue bodies, and private repository content are not persisted by default.
- Sending raw content to an external model requires explicit repository policy opt-in.
- AI output never auto-merges, auto-approves, or directly publishes releases.
- All write actions require explicit approval or repository policy opt-in and are audit logged.

## Implemented API Integration

The initial integration adds an `AiMaintainerAssistant` service behind configuration gates:

- input: normalized `WorkItem`, sanitized findings, repository policy, optional redacted text;
- output: summary, rationale, suggested maintainer actions, and safety notes;
- storage: audit metadata only in the current endpoint; generated assistance is returned to the caller and raw content is not persisted;
- observability: audit-log records for every AI assistance request, failed raw-content attempts, and pilot metrics for request counts and raw-content transfer counts.

Planned pilot observability includes token estimates, latency, provider failure rate, and redaction-event counts.

Current endpoint:

```text
POST /api/work-items/:id/ai-assist
```

Current defaults:

- `AI_PROVIDER=disabled`
- `OPENAI_MODEL=chat-latest`
- `includeRawContent=false`
- no raw diff or issue body transfer in the dashboard flow

Use an OpenAI Responses API model available to the configured account. `chat-latest` is a demo default; production pilots should pin a model after evaluating output quality, cost, and availability.

Raw content requests are rejected unless the request includes a repository policy source that satisfies:

- `ai.enabled=true`
- `ai.provider` matches the server provider
- `dataRetention.rawContent=true`
- `dataRetention.rawContentDays > 0`

Every AI assistance request is recorded in the audit log. Failed raw-content requests are also recorded with `outcome=failed`.

## Evaluation Plan

Measure whether AI assistance actually reduces maintainer load:

- time-to-triage for issues;
- percentage of PRs with actionable review summary;
- false-positive label recommendation rate;
- release blocker detection accuracy;
- maintainer acceptance rate for generated recommendations;
- number of cases where AI output is rejected or edited before use.

## Non-Goals

- No autonomous merge decisions.
- No autonomous request-changes reviews.
- No vulnerability scanning of repositories without owner or maintainer authorization.
- No cross-repository training data collection.
