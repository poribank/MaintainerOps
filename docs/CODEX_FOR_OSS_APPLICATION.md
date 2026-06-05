# Codex for Open Source Application Notes

This document keeps MaintainerOps application material grounded in facts from the public repository. Do not add inferred adoption, usage, or security claims without evidence from the repository, package registries, or a real pilot.

## Repository Snapshot

Verified on 2026-06-05:

- Repository: `https://github.com/poribank/MaintainerOps`
- Visibility: public
- Default branch: `main`
- Stars: 0
- Forks: 0
- Open issues: 0
- License: Apache-2.0, recognized by the GitHub license endpoint
- Current stage: early public OSS pilot, not production adoption

The repo already includes CI, CodeQL, package verification, release preflight, Scorecard workflow, security policy, governance notes, contribution guide, GitHub App setup docs, pilot plan, threat model, and evidence export docs.

## Program Fit

MaintainerOps targets the maintainer workloads covered by Codex for Open Source:

- PR review support through risk scoring, check-run previews, sensitive-file detection, and review recommendations.
- Issue triage support through label suggestions, reproduction-detail detection, duplicate-review hooks, and maintainer queue prioritization.
- Release workflow support through release blocker detection, provenance checks, changelog checks, and security gate reporting.
- Security support through OpenSSF Scorecard, OSV Scanner, CODEOWNERS checks, GitHub ruleset checks, and audit logging.

The project is intentionally conservative. It does not auto-merge, auto-approve, or send raw repository content to AI providers by default.

## Submission Checklist

Before submitting an application:

- [x] Public GitHub repository exists at `https://github.com/poribank/MaintainerOps`.
- [x] GitHub App setup guide exists.
- [x] Evidence export workflow exists.
- [x] Security policy and private vulnerability reporting guidance exist.
- [x] Local checks pass with `npm run check`.
- [x] Real GitHub App installation has been validated on `poribank/MaintainerOps`.
- [x] Live webhook forwarding has returned HTTP 202 from `POST /webhooks/github`.
- [x] Confirm the GitHub license endpoint recognizes Apache-2.0.
- [ ] Record current stars, forks, open issues, releases, and workflow status on the submission date.
- [ ] Export fresh pilot evidence with `npm run evidence:export` after live webhook or fixture replay.
- [ ] Add screenshots of the installed GitHub App, maintainer queue, scanner jobs, and audit log.
- [ ] Confirm the OpenAI organization ID from the API dashboard. Do not commit it.
- [ ] Confirm the submitting account owns, maintains, or is authorized to administer the repository.

## Form Field Drafts

### GitHub Repository URL

```text
https://github.com/poribank/MaintainerOps
```

### Role

Korean:

```text
MaintainerOps 프로젝트의 소유자이자 주 메인테이너입니다.
```

English:

```text
I am the owner and primary maintainer of the MaintainerOps project.
```

### Why This Repository Fits

Korean, under 500 characters:

```text
MaintainerOps는 공개 OSS 메인테이너의 PR 검토, 이슈 분류, 릴리스 준비, 보안 정책 점검을 한 큐에서 관리하기 위한 GitHub App입니다. 현재 초기 공개 파일럿 단계이며, 자동 병합이나 자동 approve 없이 dry-run, audit log, 최소 권한, 명시적 승인 흐름을 기본값으로 둡니다.
```

English, under 500 characters:

```text
MaintainerOps is a public OSS GitHub App for maintainer workflows: PR review, issue triage, release readiness, and security policy checks in one queue. It is in early public pilot stage and is deliberately conservative: no auto-merge or auto-approval, with dry-run defaults, audit logs, least-privilege permissions, and explicit approval.
```

### Interested Benefits

Recommended selections:

```text
Codex Security
API credits for the project
```

Select Codex Security only if the submitting account is authorized to administer the repository being evaluated.

### How API Credits Will Be Used

Korean, under 500 characters:

```text
API 크레딧은 MaintainerOps의 선택형 AI 보조 기능에 사용합니다. PR diff 요약, 위험 파일 설명, 테스트 누락 제안, 이슈 라벨 추천 근거, 릴리스 차단 요인 요약을 생성하되 기본은 dry-run과 human approval입니다. 비공개 코드나 원문 diff 외부 전송은 저장소 정책에서 명시적으로 opt-in한 경우에만 허용합니다.
```

English, under 500 characters:

```text
API credits will power optional MaintainerOps AI assistance: PR diff summaries, sensitive-file explanations, missing-test suggestions, issue label rationale, and release blocker summaries. The default flow is dry-run plus human approval. Private code or raw diff transfer is disabled unless the repository explicitly opts in by policy.
```

### Additional Information

Korean, under 500 characters:

```text
MaintainerOps는 메인테이너의 판단을 대체하지 않는 보조 도구입니다. GitHub App 권한 최소화, webhook 서명 검증, delivery idempotency, audit log, raw content 비저장 기본값을 갖추고 있습니다. 목표는 여러 저장소의 PR/이슈/릴리스/보안 신호를 반복 가능하고 검토 가능한 운영 흐름으로 만드는 것입니다.
```

English, under 500 characters:

```text
MaintainerOps is a maintainer-assistance tool, not a replacement for maintainer judgment. It uses least-privilege GitHub App permissions, webhook signature verification, delivery idempotency, audit logs, and metadata-only defaults. The goal is to make PR, issue, release, and security signals repeatable and reviewable across repositories.
```

## Evidence Already Available

Implemented and verified locally:

- TypeScript monorepo with `@maintainerops/core`, Fastify API, and React dashboard.
- GitHub webhook normalization for PR, issue, release, and security events.
- Risk scoring, issue triage, release readiness, security posture, CODEOWNERS checks, and policy parsing.
- GitHub write adapter with `GITHUB_WRITES_ENABLED=false` by default.
- Local queue status actions separated from GitHub writes and audit logged.
- Memory/PostgreSQL store adapters.
- Memory/BullMQ job queues and worker process.
- Scorecard and OSV Scanner runner endpoints.
- Optional OpenAI maintainer assistant endpoint, disabled by default.
- Repository-policy gate for raw-content AI transfer, with failed attempts audit logged.
- Pilot metrics endpoint for work items, recommendations, audit logs, and scanner jobs.
- Webhook fixture replay and evidence export scripts for reproducible demos.
- CI, CodeQL, Package, Scorecard, and Release Preflight workflows.

## Current Limitations

- No public adoption metrics exist yet; stars, forks, and open issues were all 0 on 2026-06-05.
- No production usage should be claimed until maintainers complete a real pilot and attach evidence.
- Real GitHub writes require a GitHub App installation, `GITHUB_WRITES_ENABLED=true`, and explicit maintainer approval.
- Raw-content AI assistance remains opt-in by repository policy and should not be enabled for private or sensitive content without authorization.
