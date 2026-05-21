# Scheduler and Pipeline Implementation Plan

> 실제 코드 수정 전 실행 계획. 이 문서는 구현자가 그대로 따라갈 수 있게 작은 단계와 검증 기준을 정의한다. target: `ops-console`.

## 범위

- 매일 08:00 Asia/Seoul 자동 수집 워크플로우 설계.
- collector/dedupe/summarizer/card generator/verifier/persist 구성.
- Ops Console의 `Artifact`, `Event`, `Task`, `CommandQueue` 연결.
- 구현 가능한 단계와 테스트/검증 계획.

범위 밖:

- secret/DB URL 열람.
- public deploy.
- 외부 발송, 결제, 지갑/KYC, live trading, public disclosure 실제 실행.
- 코드 변경 없이 이 문서 작성 시점에서는 테스트 실행 강제 없음.

## 08:00 Asia/Seoul Daily Workflow

```text
07:59:50  scheduler wake/check
08:00:00  acquire lock daily-ops:{yyyy-mm-dd}:Asia/Seoul
08:00:01  create collection run event
08:00:05  collect status/docs/reports/git summaries
08:01:00  normalize + dedupe + secret scan
08:01:20  summarize each changed item
08:01:40  generate daily ops cards
08:02:00  verify cards and command safety
08:02:20  persist Artifact/Task/Event/CommandQueue in transaction
08:02:40  bridge/dashboard can read new cards
08:03:00  emit completion event and release lock
```

실패 시:

- source 단위 실패는 전체 실패로 올리지 말고 `partial` run으로 기록.
- DB/lock/persist 실패는 `collection.failed` critical event.
- verifier fail은 task `needs_changes` 또는 blocker로 남김.

## Scheduler 설계

### 실행 방식 선택

1차 권장: host cron 또는 Docker cron이 `pnpm worker:scheduler` 실행.

이유:

- Next.js app process에 long-running scheduler를 넣지 않아도 됨.
- private deploy에서 운영자가 cron/systemd/docker compose로 제어하기 쉬움.
- BullMQ repeatable job은 Redis 운영이 안정화된 뒤 2차로 도입.

### Cron 예시

서버 timezone이 KST가 아닐 수 있으니 cron 자체는 UTC 또는 명시 TZ 중 하나로 고정한다.

옵션 A — crontab TZ 지원:

```cron
TZ=Asia/Seoul
0 8 * * * cd /path/to/ops-console && pnpm worker:scheduler >> logs/scheduler.log 2>&1
```

옵션 B — UTC cron:

```cron
0 23 * * * cd /path/to/ops-console && OPS_SCHEDULER_TIMEZONE=Asia/Seoul pnpm worker:scheduler >> logs/scheduler.log 2>&1
```

### Run key

```ts
runKey = `daily-ops:${kstDate}:Asia/Seoul`;
```

- `kstDate`: Asia/Seoul 기준 `YYYY-MM-DD`.
- 같은 runKey는 하루 1번만 completed 가능.
- retry는 같은 runKey에 attempt metadata를 추가.

### Lock

우선순위:

1. DB unique `CollectionRun.runKey`.
2. Redis `SET key value NX EX 3600`.
3. Redis가 없으면 DB만으로 idempotency 보장.

락 이벤트:

- acquired: `collection.started`
- duplicate: `collection.skipped_duplicate`
- release: `collection.completed|failed`

## Pipeline 인터페이스

### Pipeline context

```ts
type PipelineContext = {
  runKey: string;
  date: string; // Asia/Seoul YYYY-MM-DD
  timezone: "Asia/Seoul";
  dryRun: boolean;
  startedAt: string;
  operator?: { email: string };
};
```

### Source item

```ts
type SourceItem = {
  sourceKey: string;
  sourceType: "status_json" | "report" | "decision_log" | "docs_index" | "git_summary" | "manual";
  title: string;
  content: string;
  contentHash: string;
  path?: string;
  repo?: string;
  commitSha?: string;
  observedAt: string;
  agentSlug?: string;
  projectSlug?: string;
  taskSlug?: string;
  riskHint?: "low" | "medium" | "high" | "critical";
};
```

### Card item

```ts
type CardItem = {
  cardKey: string;
  title: string;
  markdown: string;
  sourceHash: string;
  sourceArtifactId?: string;
  agentSlug?: string;
  projectSlug?: string;
  taskSlug: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  nextAction: string;
  commandCandidate?: {
    actionType: string;
    payload: Record<string, unknown>;
  };
};
```

### Verification result

```ts
type VerificationResult = {
  status: "pass" | "needs_changes" | "blocked";
  reasons: string[];
  restricted: boolean;
  manualHandoffRequired: boolean;
  queueCommand: boolean;
};
```

## Components

### Collector

책임:

- whitelist source만 읽기.
- `.env*`, credential/token, DB URL, private key 파일은 discover 대상 제외.
- source별 failure를 캡처하고 `collector.source_failed` event로 남김.

초기 collector:

1. `status-json-collector`
   - 입력: `ops/status/*.json`.
   - 기존 `parseStatusJson` 재사용.
2. `decision-log-collector`
   - 입력: `hq/decisions/Company-Decision-Log.md`.
3. `docs-index-collector`
   - 입력: `docs/INDEX.md`.
4. `report-collector`
   - 입력: 허용된 reports/ops-console-runs 디렉토리.
5. `git-summary-collector`
   - 입력: `git log --since`의 subject/hash만. diff 본문/secret 파일 내용 읽기 금지.

### Dedupe

책임:

- `contentHash(normalizedContent)` 계산.
- 기존 `Artifact.contentHash` 조회.
- 같은 source/action card 중복 방지.

정책:

- 원본 artifact 중복: skip + `artifact.deduped`.
- 카드 중복: task update만 필요하면 update, 아니면 skip.
- 중복이어도 restricted 재검사 결과가 달라지면 critical event.

### Summarizer

책임:

- SourceItem을 운영 요약으로 변환.
- LLM 없이 deterministic extraction 우선.
- 원문 전체를 카드에 붙이지 않음.

요약 규칙:

- status json: `summary`, `current_blocker`, `next_action`, `risk_level` 사용.
- markdown: `#`, `## 다음 액션`, `## 검증`, bullet 추출.
- git summary: commit subject를 최대 5개.

### Card Generator

책임:

- operator가 바로 판단할 카드 markdown 생성.
- card artifact 저장용 content 생성.
- task title/summary/nextAction 생성.

필수 섹션:

- `## 핵심 요약`
- `## 근거 Artifact`
- `## 다음 액션`
- `## 검증`

카드 completed 금지 조건:

- `## 검증` 없음.
- source artifact 링크 없음.
- secret-like content 노출.
- riskLevel high/critical인데 CommandQueue 자동 큐잉 시도.

### Verifier

책임:

- 카드 품질/안전 검증.
- CommandQueue 가능 여부 결정.
- 실패 사유를 task blocker/event metadata로 남김.

검증 규칙:

- 필수 섹션 체크.
- secret-like content scan.
- restricted source면 path/url/body snippet 마스킹 여부 체크.
- commandCandidate가 있으면 `canQueueCommand`/manual handoff policy와 동일한 기준 적용.
- 외부 발송/배포/public disclosure/paid/wallet/KYC/live trading 키워드는 manual handoff.

### Persist/Linker

책임:

- DB transaction으로 연결 일관성 보장.
- dryRun이면 DB write 없이 planned writes 반환.

쓰기 순서:

1. `Agent.upsert` by slug.
2. `Project.upsert` by slug.
3. source `Artifact.upsert` by contentHash.
4. card `Artifact.upsert` by card contentHash.
5. `Task.upsert` by deterministic slug.
6. source/card artifact에 `taskId/projectId/agentId` 연결.
7. `Event.createMany`.
8. safe command만 `CommandQueue.create`.

## Artifact/Event/Task/CommandQueue 연결 시나리오

### 정상 카드

1. Collector가 report를 발견.
2. source Artifact 생성.
3. 카드 Artifact 생성.
4. Task 생성: `queued`.
5. Event:
   - `artifact.ingested`
   - `summary.generated`
   - `card.generated`
   - `card.verified`
   - `task.card_created`
6. bridge `/api/bridge/tasks`에서 task 표시.

### 중복 카드

1. contentHash가 기존 Artifact와 일치.
2. Artifact 생성 없음.
3. Event `artifact.deduped`.
4. 카드/task 생성 없음 또는 updatedAt만 유지.
5. summary skipped 카운트 증가.

### restricted 카드

1. secret scan restricted.
2. Artifact `restricted=true`, reason 저장.
3. Card에는 원문/path/url 미노출.
4. Event `artifact.restricted` critical.
5. Task `needs_changes` 또는 `queued` + blocker depending on severity.
6. CommandQueue 생성 금지.

### safe command candidate

1. verifier pass.
2. risk low/medium.
3. internal action only.
4. CommandQueue `queued` 생성.
5. Event `command.card_queued`.

### high-risk command candidate

1. verifier가 manual handoff 판정.
2. CommandQueue 생성 안 함 또는 `waiting_manual_handoff`만 사용.
3. Approval/manual handoff 필요 이벤트 생성.
4. Task blocker에 “manual handoff required” 기록.

## 구현 Task Breakdown

### Task 1 — 테스트 fixture 추가

Files:

- Create: `src/server/pipeline/__fixtures__/status-ok.json`
- Create: `src/server/pipeline/__fixtures__/status-restricted.json`
- Create: `src/server/pipeline/__fixtures__/report-ok.md`
- Create: `src/server/pipeline/__fixtures__/report-deploy.md`

검증:

- fixture에 실제 secret/DB URL 넣지 말고 fake marker만 사용.
- restricted fixture는 scanner가 잡는 dummy pattern 사용.

### Task 2 — Pipeline 타입 정의

Files:

- Create: `src/server/pipeline/types.ts`
- Test: `src/server/pipeline/types.test.ts`는 불필요. typecheck로 검증.

검증:

- `pnpm typecheck` pass.

### Task 3 — Dedupe 유틸 TDD

Files:

- Create: `src/server/pipeline/dedupe.ts`
- Create: `src/server/pipeline/dedupe.test.ts`

테스트:

- normalize whitespace.
- same content -> same hash.
- different content -> different hash.
- deterministic cardKey 생성.

Run:

```bash
pnpm test -- src/server/pipeline/dedupe.test.ts
```

### Task 4 — Summarizer TDD

Files:

- Create: `src/server/pipeline/summarizer.ts`
- Create: `src/server/pipeline/summarizer.test.ts`

테스트:

- status json에서 blocker/nextAction 추출.
- markdown report에서 heading/bullet/다음 액션 추출.
- 긴 content는 max bullets 제한.

### Task 5 — Card generator TDD

Files:

- Create: `src/server/pipeline/card-generator.ts`
- Create: `src/server/pipeline/card-generator.test.ts`

테스트:

- 필수 섹션 4개 존재.
- restricted면 path/url/source snippet 미포함.
- task slug deterministic.

### Task 6 — Verifier TDD

Files:

- Create: `src/server/pipeline/verifier.ts`
- Create: `src/server/pipeline/verifier.test.ts`

테스트:

- 검증 섹션 없으면 `needs_changes`.
- dummy secret pattern이면 `blocked`.
- deploy/public disclosure면 `manualHandoffRequired=true`, `queueCommand=false`.
- low-risk internal action이면 `queueCommand=true`.

### Task 7 — Collector 인터페이스 분리

Files:

- Create: `src/server/pipeline/collectors/types.ts`
- Create: `src/server/pipeline/collectors/status-json.ts`
- Create: `src/server/pipeline/collectors/docs.ts`
- Modify: `src/server/ingest/index.ts`는 기능 보존하며 collector를 호출하게 변경.

검증:

- 기존 `src/server/ingest/status-json.test.ts` pass.
- 신규 collector test pass.

### Task 8 — Persist/linker 구현

Files:

- Create: `src/server/pipeline/persist.ts`
- Create: `tests/integration/pipeline-persist.test.ts`

테스트:

- Artifact/Task/Event 링크 생성.
- restricted artifact는 path/url bridge에서 null.
- transaction 중 command creation 실패 시 전체 rollback 또는 명시 partial event.

### Task 9 — Daily runner 구현

Files:

- Create: `src/server/pipeline/daily-runner.ts`
- Create: `src/server/pipeline/daily-runner.test.ts`

테스트:

- dryRun은 DB write 없음.
- changed/skipped/restricted count 정확.
- partial failure 처리.

### Task 10 — Scheduler 구현

Files:

- Create: `src/server/scheduler/daily-ops.ts`
- Create: `src/server/scheduler/daily-ops.test.ts`
- Create: `src/workers/scheduler.ts`
- Modify: `package.json`에 `worker:scheduler` script 추가.

테스트:

- Asia/Seoul date 계산.
- 08:00 target 판단.
- duplicate runKey skip.

### Task 11 — API 연결

Files:

- Create: `src/app/api/pipeline/daily/run/route.ts`
- Create: `tests/integration/api-pipeline-run.test.ts`

테스트:

- unauthenticated 401.
- authenticated dryRun 200 + no writes.
- authenticated real run 200 + cards count.

### Task 12 — Bridge/Dashboard projection 검증

Files:

- Modify: 필요 시 `src/server/console-bridge.ts` projection 최소 보강.
- Test: `src/server/console-bridge.test.ts`
- Test: `tests/smoke/dashboard.test.ts`

테스트:

- card task가 bridge tasks에 표시.
- manual handoff event가 bridge events에 표시.
- safe command가 bridge commands에 표시.

### Task 13 — Docs/control 업데이트

Files:

- Modify: `docs/control/TEST_PLAN.md`
- Modify: `docs/control/PROGRESS.md`
- Modify: `docs/control/SESSION_HANDOFF.md`
- 필요 시 `docs/control/DECISIONS.md`

내용:

- scheduler 방식 결정.
- migration 여부 결정.
- local/private only 주의사항.
- 실행/검증 결과.

## Test Plan

테스트 계획 없이는 completed 불가. 구현 PR/작업 완료 기준은 아래 전체 또는 blocker 기록이다.

### Required commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:generate
pnpm prisma:validate
pnpm build
pnpm docker:config
```

schema 변경이 있으면:

```bash
pnpm prisma:migrate
```

단, 실제 운영 DB URL 사용 금지. 로컬/테스트 DB만.

### Unit coverage

- timezone/runKey.
- lock duplicate handling.
- collectors path whitelist.
- dedupe hash/cardKey.
- summarizer extraction.
- card required sections.
- verifier risk/manual handoff.
- secret scanner integration.

### Integration coverage

- daily runner full flow with fixtures.
- dryRun no writes.
- repeated run idempotency.
- source failure partial run.
- Artifact/Event/Task/CommandQueue linking.
- bridge APIs read generated objects.

### Smoke coverage

- app health endpoint.
- dashboard auth gate: no operator header 401, valid private operator header 200.
- `/api/bridge/summary` includes new counts after seeded pipeline run.
- worker command exits 0 for no-op/duplicate run.

### Negative/security tests

- `.env` or DB URL-like source path is ignored.
- restricted source content never appears in card markdown, event message, bridge JSON path/url.
- high/critical action does not create executable queued command.
- public deploy action becomes manual handoff only.

## Acceptance Criteria

- 매일 08:00 Asia/Seoul runKey 생성과 idempotency가 테스트로 고정됨.
- collector/dedupe/summarizer/card generator/verifier가 각각 unit test 보유.
- Artifact/Event/Task/CommandQueue 연결 integration test가 있음.
- restricted artifact 마스킹이 API projection까지 검증됨.
- low/medium internal command만 CommandQueue에 들어감.
- high/critical/external/public action은 manual handoff로 남음.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm prisma:validate`, `pnpm build`, `pnpm docker:config` 통과 또는 명시 blocker 문서화.
- public deploy 없음. secret/DB URL 열람 없음.

## 운영 Runbook 초안

### 수동 dry-run

```bash
OPS_SCHEDULER_TIMEZONE=Asia/Seoul pnpm worker:scheduler -- --dry-run
```

예상:

- DB write 없음.
- planned sources/cards/commands summary 출력.
- secret 값 출력 없음.

### 수동 실행

```bash
OPS_SCHEDULER_TIMEZONE=Asia/Seoul pnpm worker:scheduler
```

예상:

- `collection.started` event.
- changed/skipped/restricted count.
- generated card tasks in `/api/bridge/tasks`.

### 문제 대응

- duplicate: 정상. `collection.skipped_duplicate` 확인.
- restricted 증가: artifact detail에서 reason 확인, path/url은 null이어야 함.
- partial: `collector.source_failed` event 확인, 해당 source만 재시도.
- command blocked: manual handoff event와 task blocker 확인.
