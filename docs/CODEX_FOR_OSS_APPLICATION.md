# Codex for Open Source Application Kit

This document prepares MaintainerOps for the Codex for Open Source application form.

Use it as a submission draft, not as a source of fabricated metrics. Replace every bracketed placeholder with facts from the public repository you actually maintain.

## Program Fit

The Codex for Open Source program is for core maintainers or maintainers of widely used public projects. It supports API credits, six months of ChatGPT Pro with Codex, and conditional Codex Security access for eligible repositories.

MaintainerOps is positioned as the workflow automation layer for the repository named in the application:

- PR review support through risk scoring, check-run summaries, sensitive-file detection, and review recommendations.
- Issue triage support through label suggestions, reproduction-detail detection, duplicate-review hooks, and maintainer queue prioritization.
- Release workflow support through release blocker detection, provenance checks, changelog checks, and security gate reporting.
- Security support through OpenSSF Scorecard, OSV Scanner, CODEOWNERS checks, GitHub ruleset checks, and audit logging.

## Readiness Checklist

Before submitting:

- [ ] Push this repository to a public GitHub URL.
- [ ] Replace `OWNER/REPOSITORY` placeholders in GitHub issue template contact links.
- [ ] Add accurate repository metrics: stars, forks, downloads, package registry stats, dependent projects, or ecosystem usage.
- [ ] Add evidence of active maintenance: recent releases, issue/PR activity, maintainer role, write access, or governance role.
- [ ] Confirm the GitHub profile is public.
- [ ] Confirm the repository in the form is public.
- [ ] Confirm the OpenAI organization ID from the API dashboard.
- [ ] If requesting Codex Security, confirm you own, maintain, or are authorized to administer the repository.
- [ ] Generate pilot evidence with `npm run evidence:export` after dry-run replay or real webhook traffic.
- [ ] Do not claim production usage until a real GitHub App installation and pilot have run.

## Form Field Drafts

### GitHub repository URL

```text
[PUBLIC_GITHUB_REPOSITORY_URL]
```

Recommended: use the public repository you actively maintain. If MaintainerOps itself is the submitted repo, disclose that it is an early-stage maintainer automation project and include why it matters.

### Role

```text
[주 책임자/핵심 기여자]
```

Suggested wording:

```text
I am the [primary maintainer/core contributor] responsible for [PR review, issue triage, release coordination, security policy, CI, dependency maintenance] in [repository/project].
```

### Why this repository fits the program

Korean draft, under 500 characters:

```text
[프로젝트명]은 [생태계/사용자군]에서 [핵심 역할]을 수행하는 공개 OSS입니다. 저는 [역할]로서 PR 검토, 이슈 분류, 릴리스 준비, 보안 정책 점검을 지속적으로 담당하고 있습니다. 현재 [stars/downloads/dependents/사용 사례]가 있으며, MaintainerOps를 통해 반복 유지관리 업무를 줄이고 보안·품질 신호를 일관되게 관리하려 합니다.
```

English draft, under 500 characters:

```text
[Project] is a public OSS project used by [ecosystem/users] for [core function]. As [role], I handle PR review, issue triage, release coordination, and security maintenance. The project has [stars/downloads/dependents/adoption evidence]. I plan to use MaintainerOps to reduce repetitive maintainer work and keep security and quality signals visible.
```

### Interested benefits

Recommended selections:

```text
Codex Security
API credits for the project
```

Select Codex Security only if you have authority to administer the submitted repository.

### How API credits will be used

Korean draft, under 500 characters:

```text
API 크레딧은 MaintainerOps의 선택형 AI 보조 기능에 사용합니다. PR diff 요약, 위험 파일 설명, 테스트 누락 제안, 이슈 라벨 추천 근거, 릴리스 차단 요인 요약을 생성하되 기본은 dry-run과 human approval입니다. 비공개 코드나 원문 diff 외부 전송은 저장소 정책에서 명시적으로 opt-in한 경우에만 허용합니다.
```

English draft, under 500 characters:

```text
API credits will power optional MaintainerOps AI assistance: PR diff summaries, sensitive-file explanations, missing-test suggestions, issue label rationale, and release blocker summaries. The default flow is dry-run plus human approval. Private code or raw diff transfer is disabled unless the repository explicitly opts in by policy.
```

### Additional information

Korean draft, under 500 characters:

```text
MaintainerOps는 자동 병합·자동 approve를 하지 않는 보수적 설계입니다. GitHub App 권한 최소화, webhook 서명 검증, delivery idempotency, audit log, raw content 비저장 기본값을 갖추었습니다. 목표는 메인테이너의 판단을 대체하는 것이 아니라 여러 저장소의 PR/이슈/릴리스/보안 신호를 한 큐에서 검토 가능하게 만드는 것입니다.
```

English draft, under 500 characters:

```text
MaintainerOps is deliberately conservative: no auto-merge or auto-approval. It uses least-privilege GitHub App permissions, webhook signature verification, delivery idempotency, audit logs, and metadata-only defaults. The goal is not to replace maintainers, but to make PR, issue, release, and security signals reviewable in one queue.
```

## Current Project Evidence

Implemented and verified locally:

- TypeScript monorepo with `@maintainerops/core`, Fastify API, and React dashboard.
- GitHub webhook normalization for PR, issue, release, and security events.
- Risk scoring, issue triage, release readiness, security posture, CODEOWNERS checks, and policy parsing.
- GitHub write adapter with `GITHUB_WRITES_ENABLED=false` by default.
- Memory/PostgreSQL store adapters.
- Memory/BullMQ job queues and worker process.
- Scorecard and OSV Scanner runner endpoints.
- Optional OpenAI maintainer assistant endpoint, disabled by default.
- Repository-policy gate for raw-content AI transfer, with failed attempts audit logged.
- Pilot metrics endpoint for work items, recommendations, audit logs, and scanner jobs.
- Webhook fixture replay and evidence export scripts for reproducible demos.
- Tests and build passing via `npm run check`.

Current limitation:

- No public adoption metrics exist until the repository is published and piloted against real maintained projects.
- Real GitHub writes require a GitHub App installation and maintainer approval.
- Codex/OpenAI API usage is planned as an opt-in AI assistant layer; raw content transfer remains disabled by default.
