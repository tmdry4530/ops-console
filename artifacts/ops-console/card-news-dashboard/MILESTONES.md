# Card News Dashboard Milestones

> projects-agent 계획. 구현 전 approval required. main branch 직접 수정 금지. 이 문서는 read-only/planning 산출물이고, 실행/코드 변경은 별도 승인 뒤 진행.

## 운영 원칙

- 현재 브랜치 확인 후 작업: `main`이면 구현 금지, feature branch 생성/전환 승인 필요.
- read-only/planning 가능: 코드/문서 조사, 요구사항 정리, dependency/risk/blocker 문서화, 테스트 계획 작성.
- approval required execution: 코드 수정, migration, package install/update, DB/Redis/Docker 실행 변경, scheduler/worker 실행, persistent data write.
- high/critical risk 작업 금지: public deploy, 외부 발송, 결제/지갑/KYC/live trading, secret/DB URL 열람, 운영 DB destructive change.
- 완료 판정: docs-agent verifier 통과 전 `completed` 금지. 각 milestone은 `ready_for_verification`까지만 표시.
- 보안: secret-like content는 카드/로그/Artifact 본문에 노출 금지. restricted source는 경로/본문 마스킹.

## 전체 작업 순서

1. M0 Approval/Scope Gate
2. M1 Current State Discovery
3. M2 Data Contract & Safety Policy
4. M3 Backend Pipeline Plan
5. M4 Dashboard UX/Projection Plan
6. M5 Implementation Prep & Test Matrix
7. M6 Approved Implementation
8. M7 Verification, Docs-Agent Review, Handoff

## Dependency Map

```text
M0 approval/scope
  -> M1 discovery
    -> M2 contracts/safety
      -> M3 backend pipeline
      -> M4 dashboard projection
        -> M5 test matrix
          -> M6 implementation after approval only
            -> M7 verification + docs-agent verifier
```

## Milestones

### M0 — Approval/Scope Gate

- Owner: projects-agent
- Reviewer: operator + docs-agent verifier
- Status target: `ready_for_verification`, not `completed`
- Risk: low
- Type: planning/read-only
- Dependencies: none
- Tasks:
  - 구현 범위, 금지 범위, approval gate 확정.
  - main branch 직접 수정 금지 확인.
  - high/critical risk action 배제 목록 고정.
- Exit criteria:
  - 승인 필요한 execution 목록과 read-only/planning 목록이 문서화됨.
  - 구현 시작 전 operator approval 필요 조건이 명시됨.
- Blockers:
  - operator가 구현 범위/승인 방식을 확정하지 않으면 M6 진입 금지.
- Approval gate:
  - `APPROVED_FOR_IMPLEMENTATION` 같은 명시 승인 없이는 코드 변경 금지.

### M1 — Current State Discovery

- Owner: engineering-agent
- Reviewer: projects-agent
- Status target: `ready_for_verification`
- Risk: low
- Type: read-only
- Dependencies: M0
- Tasks:
  - 기존 `Artifact`, `Task`, `Event`, `CommandQueue`, ingest/bridge/dashboard 코드 경로 조사.
  - 기존 문서 `TECHNICAL_PLAN.md`, `SCHEDULER_AND_PIPELINE_PLAN.md`와 충돌 여부 확인.
  - 현재 수정된 working tree와 타 agent 변경사항 침범 위험 기록.
- Exit criteria:
  - 재사용 가능한 컴포넌트/파일 후보 목록 작성.
  - 수정 금지/주의 파일 목록 작성.
- Blockers:
  - working tree에 소유자 불명 변경이 많으면 구현 전 merge/ownership 확인 필요.
  - repo branch가 `main`이면 feature branch 승인 전 execution 금지.
- Approval gate:
  - read-only 명령만 허용. 파일 수정은 이 milestone 범위 밖.

### M2 — Data Contract & Safety Policy

- Owner: backend-agent
- Reviewer: security-agent + docs-agent verifier
- Status target: `ready_for_verification`
- Risk: medium
- Type: planning, then approval-required schema/code execution
- Dependencies: M1
- Tasks:
  - `SourceItem`, `CardItem`, `VerificationResult` 계약 확정.
  - Artifact/Task/Event/CommandQueue 매핑 확정.
  - secret scan, restricted artifact, manual handoff, command allowlist/blocklist 정책 확정.
  - migration 필요 여부 결정: 1차는 기존 모델 사용 권장, `CollectionRun`/`SourceCursor`는 별도 승인 시만.
- Exit criteria:
  - 필드별 source of truth와 idempotency key 규칙이 문서화됨.
  - high/critical 후보는 큐잉하지 않고 manual handoff 처리로 고정됨.
- Blockers:
  - Prisma schema 변경이 필요하면 DB migration approval 필요.
  - command safety allowlist가 없으면 CommandQueue 연동 금지.
- Approval gate:
  - schema/migration/code 변경 전 operator approval 필수.

### M3 — Backend Pipeline Plan

- Owner: backend-agent
- Reviewer: qa-agent + projects-agent
- Status target: `ready_for_verification`
- Risk: medium
- Type: planning, then approval-required implementation
- Dependencies: M2
- Tasks:
  - Scheduler: Asia/Seoul 08:00, runKey, DB/Redis lock, duplicate skip 설계.
  - Collectors: status json, decision log, docs index, reports, git summary 설계.
  - Normalize/dedupe/secret scan/summarize/card generate/verify/persist 순서 확정.
  - partial failure 정책과 event taxonomy 확정.
- Exit criteria:
  - 파이프라인 단계별 input/output/error handling이 명시됨.
  - retry/idempotency/transaction boundary가 명시됨.
  - DB/Redis 미가용 시 degraded behavior가 명시됨.
- Blockers:
  - Redis/DB 연결 상태 확인 불가 시 scheduler 실행 금지.
  - collector whitelist 확정 전 repo-wide file scan 금지.
- Approval gate:
  - worker/scheduler 실행, DB write, Redis lock 테스트는 approval 필요.

### M4 — Dashboard UX/Projection Plan

- Owner: frontend-agent
- Reviewer: design-agent + docs-agent verifier
- Status target: `ready_for_verification`
- Risk: low
- Type: planning, then approval-required implementation
- Dependencies: M2, M3 interface draft
- Tasks:
  - 카드 뉴스 대시보드 정보 구조 정의: 오늘 카드, blocker, next action, risk, source link, verification status.
  - restricted artifact 표시 정책: 본문/경로 마스킹, reason만 노출.
  - loading/empty/error/partial 상태 정의.
  - 모바일/데스크톱 반응형 레이아웃 기준 정의.
- Exit criteria:
  - UI state matrix가 문서화됨.
  - 카드 컴포넌트 props와 API projection shape가 확정됨.
  - high/critical action CTA가 UI에 노출되지 않음.
- Blockers:
  - backend projection shape 미확정 시 UI 구현은 mock-only로 제한.
  - auth/audit logging 미검증 상태에서 public exposure 금지.
- Approval gate:
  - component/page 코드 변경 전 operator approval 필요.

### M5 — Implementation Prep & Test Matrix

- Owner: qa-agent
- Reviewer: projects-agent + docs-agent verifier
- Status target: `ready_for_verification`
- Risk: low
- Type: planning/read-only
- Dependencies: M3, M4
- Tasks:
  - 테스트 범위 정의: unit, integration, smoke, typecheck, lint, build, Prisma generate/migrate dry-run, docker compose validation.
  - fixture 설계: normal, duplicate, restricted, partial failure, verifier reject, command allowlist/manual handoff.
  - rollback/handoff 계획 작성.
- Exit criteria:
  - 각 테스트의 명령, 예상 결과, 실패 시 blocker가 문서화됨.
  - docs-agent verifier checklist가 준비됨.
- Blockers:
  - 패키지 설치/DB/Redis/Docker가 필요한 테스트는 approval 전 실행 금지.
  - flaky/incomplete test를 completed 근거로 사용 금지.
- Approval gate:
  - dependency install/update, DB migration, docker compose 실행은 approval 필요.

### M6 — Approved Implementation

- Owner: implementation-agent
- Reviewer: qa-agent + security-agent
- Status target: `ready_for_verification`
- Risk: medium only; high/critical 금지
- Type: execution, approval required
- Dependencies: M0 explicit approval, M1-M5 accepted
- Tasks:
  - feature branch에서만 구현.
  - 최소 diff로 backend pipeline, dashboard projection/UI, tests 구현.
  - Artifact/Task/Event/CommandQueue write는 idempotent transaction으로 제한.
  - high/critical 후보는 manual handoff로만 기록.
- Exit criteria:
  - 승인된 scope 안의 코드/테스트만 변경됨.
  - lint/typecheck/tests/build/Prisma/docker validation 결과가 기록됨.
  - secret scan/restricted behavior 테스트 통과.
- Blockers:
  - approval 미확보.
  - branch가 `main`.
  - verifier fail, high/critical action 필요, secret exposure 의심.
  - 타 agent 변경과 충돌.
- Approval gate:
  - 이 milestone 시작 전 operator의 명시 승인 필수.
  - DB migration 적용/worker 가동/운영 데이터 write는 별도 세부 승인 필수.

### M7 — Verification, Docs-Agent Review, Handoff

- Owner: docs-agent
- Reviewer: operator + projects-agent
- Status target: `verified`; verifier 통과 후에만 `completed`
- Risk: low
- Type: verification/documentation
- Dependencies: M6
- Tasks:
  - docs-agent verifier가 requirements, safety, tests, docs consistency 확인.
  - `docs/control/DECISIONS.md`, `docs/control/PROGRESS.md`, `docs/control/SESSION_HANDOFF.md` 업데이트 여부 확인.
  - 남은 blocker/risk/follow-up 정리.
- Exit criteria:
  - docs-agent verifier pass.
  - 검증 로그와 산출물 링크가 남음.
  - operator handoff 가능 상태.
- Blockers:
  - docs-agent verifier 미통과.
  - 필수 검증 중 하나라도 미실행/실패인데 completed 처리하려는 경우.
- Approval gate:
  - completed 선언은 verifier pass 후 operator 승인 필요.

## Approval Gates Summary

| Gate | 필요한 승인 | 승인 전 허용 | 승인 전 금지 |
|---|---|---|---|
| G0 Scope | 구현 범위/금지 범위 | 조사/계획 | 코드 변경 |
| G1 Branch | feature branch 사용 | branch/status 확인 | main 직접 수정 |
| G2 Schema | Prisma 변경 여부 | 모델 매핑 문서화 | migration 적용 |
| G3 Execution | 구현 시작 | test plan 작성 | 코드/패키지/DB/worker 변경 |
| G4 Runtime | scheduler/worker/DB/Redis 실행 | dry-run 설계 | 운영성 write/daemon 실행 |
| G5 Completion | docs-agent verifier pass | ready_for_verification | completed 선언 |

## Known Blockers / Risks

- 현재 working tree에 기존 변경이 많으면 ownership 충돌 가능.
- 데이터 모델 추가는 migration approval 없이는 진행 불가.
- Redis/DB/Docker 의존 검증은 로컬 환경/승인 상태에 따라 blocked 가능.
- secret-like source가 발견되면 카드 본문 생성 중단하고 restricted artifact/manual handoff 처리 필요.
- public deploy/auth/HTTPS/audit/backups/restore 검증 전 외부 노출 금지.

## Immediate Next Actions

1. operator가 이 milestone plan을 승인/수정.
2. engineering-agent가 M1 read-only discovery 수행.
3. M1-M5 문서가 docs-agent verifier를 통과하면 M6 구현 승인 요청.
4. 승인 전까지 구현/DB/worker execution은 진행하지 않음.
