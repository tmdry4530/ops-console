# Ops Console 수집/카드 생성 연동 기술 계획

> 코드 수정 전 설계 문서. target은 `ops-console` 기본. public deploy, secret/DB URL 열람, 외부 발송은 범위 밖.

## 목표

매일 08:00 Asia/Seoul에 Company/로컬 작업 상태를 수집하고, 중복 제거/요약/카드 생성/검증을 거쳐 Ops Console의 `Artifact`, `Event`, `Task`, `CommandQueue`에 연결되는 운영 카드로 노출한다.

## 현재 코드 기준

- 스택: Next.js App Router, TypeScript, Prisma/PostgreSQL, Redis/BullMQ 의존성, Docker Compose.
- 기존 모델: `Agent`, `Project`, `Task`, `Approval`, `Artifact`, `CommandQueue`, `Event`.
- 기존 수집 골격: `src/server/ingest/index.ts`, `src/workers/ingest.ts`, `/api/ingest/run`.
- 기존 브릿지 API: `/api/bridge/tasks`, `/api/bridge/events`, `/api/bridge/commands`, `/api/bridge/summary`.
- 기존 워커: `worker:ingest`, `worker:commands`, `worker:agents`, `worker:reports`.
- 기존 안전장치: artifact secret-like scan, restricted artifact path/url 마스킹, manual handoff policy.

## 아키텍처

```text
08:00 Asia/Seoul Scheduler
  -> CollectionRun 생성/락
  -> Collectors
     - status json collector
     - docs/report collector
     - git summary collector
     - manual/local monitor collector
  -> Normalize SourceItem[]
  -> Dedupe(contentHash/sourceKey)
  -> Secret scan + restriction
  -> Summarizer
  -> Card Generator
  -> Verifier
  -> Prisma transaction
     - Artifact upsert
     - Task upsert/link
     - Event append
     - optional CommandQueue enqueue
  -> Ops Console APIs/SSE/dashboard projection
```

핵심 원칙:

- `Artifact`는 원본/증거의 저장 단위.
- `Task`는 운영자가 행동해야 하는 작업 단위.
- `Event`는 모든 상태 전이와 검증 결과의 감사 로그.
- `CommandQueue`는 승인 후 실행 가능한 안전 명령의 큐. 고위험/외부 발송/배포/public disclosure는 큐잉 대신 manual handoff.
- 요약/카드는 secret-like content를 직접 포함하지 않고 `restricted=true`면 경로/본문을 마스킹한다.

## 데이터 모델 설계

### 기존 모델에 매핑

#### Artifact

사용 목적: 수집된 원본, 보고서, cron output, 카드 본문, 검증 리포트.

필드 매핑:

- `type`: `status_file | report | decision_log | cron_output | other` 재사용. 카드 전용 타입은 1차 구현에서는 `report` 또는 `other`로 시작.
- `title`: `[Daily Ops Card] yyyy-mm-dd / source title`.
- `path`: 로컬 파일 경로 또는 repo-relative path. `restricted=true`면 API projection에서 null 처리 유지.
- `url`: 내부 URL만. public URL 금지.
- `contentHash`: normalized content hash. dedupe 기준.
- `restricted/restrictionReason`: secret-like scan 결과.
- `agentId/projectId/taskId`: collector가 추론한 연결 대상.

#### Task

사용 목적: 카드에서 도출된 follow-up 작업.

필드 매핑:

- `slug`: deterministic slug `daily-card:{date}:{sourceKey}:{actionKey}`.
- `title`: 카드 액션 제목.
- `status`: 기본 `queued`, blocker 있으면 `needs_changes`, 실행 중이면 `running`.
- `riskLevel`: verifier가 산정. 외부 발송/배포/결제/지갑/KYC/public disclosure는 `high|critical`.
- `summary`: 3~5줄 한국어 요약.
- `nextAction`: operator가 바로 할 다음 행동.
- `blocker`: 누락 데이터/승인 필요/수집 실패 사유.
- `agentId/projectId`: source metadata에서 매핑.

#### Event

사용 목적: 수집/중복/요약/카드/검증/큐잉 흐름의 감사 로그.

이벤트 타입 제안:

- `collection.started`
- `collection.completed`
- `collection.failed`
- `collector.source_discovered`
- `collector.source_failed`
- `artifact.deduped`
- `artifact.ingested`
- `artifact.restricted`
- `summary.generated`
- `card.generated`
- `card.verified`
- `card.rejected`
- `task.card_created`
- `command.card_queued`
- `command.manual_handoff_required`

`metadata`에는 sourceKey, contentHash prefix, collector name, verifier scores, run id만 넣고 secret 원문은 넣지 않는다.

#### CommandQueue

사용 목적: 카드가 제안한 안전한 내부 action만 큐잉.

허용 action 예:

- `internal_followup_create_task`
- `agent_control_retry`
- `ingest_refresh_source`
- `report_regenerate_card`

차단/manual handoff action 예:

- `deploy`
- `public_disclosure`
- `revenue_outreach` 실발송
- `wallet_kyc`
- `live_trading`
- `paid_action`

payload 표준:

```json
{
  "source": "daily_collection",
  "collectionRunId": "...",
  "cardArtifactId": "...",
  "projectId": "...",
  "taskId": "...",
  "action": "regenerate_card",
  "idempotencyKey": "daily-card:2026-05-21:source:action"
}
```

### 추가 모델 제안

1차 구현은 기존 모델로 가능하지만, 운영 안정성을 위해 migration 단계에서 아래 모델을 추가하는 게 좋다.

```prisma
model CollectionRun {
  id          String   @id @default(cuid())
  runKey      String   @unique
  scheduledAt DateTime
  startedAt   DateTime @default(now())
  finishedAt  DateTime?
  timezone    String   @default("Asia/Seoul")
  status      String   @default("running") // running|completed|failed|partial
  sourceCount Int      @default(0)
  changed     Int      @default(0)
  skipped     Int      @default(0)
  restricted  Int      @default(0)
  summary     Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model SourceCursor {
  id          String   @id @default(cuid())
  sourceKey   String   @unique
  sourceType  String
  cursor      Json     @default("{}")
  lastHash    String?
  lastSeenAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

대안: migration 부담을 줄이려면 `Event.metadata.collectionRunId`와 `Artifact.contentHash`만으로 1차 추적한다.

## 컴포넌트 설계

### 1. Scheduler

파일 후보:

- `src/server/scheduler/daily-ops.ts`
- `src/workers/scheduler.ts`
- Docker cron/host cron에서 `pnpm worker:scheduler` 호출

책임:

- Asia/Seoul 기준 매일 08:00 실행.
- `runKey = daily-ops:YYYY-MM-DD:Asia/Seoul` 생성.
- 중복 실행 방지: DB unique key 또는 Redis lock `ops:scheduler:daily:{date}`.
- 실패/부분 성공도 `Event`로 남김.

### 2. Collector

파일 후보:

- `src/server/pipeline/collectors/types.ts`
- `src/server/pipeline/collectors/status-json.ts`
- `src/server/pipeline/collectors/reports.ts`
- `src/server/pipeline/collectors/git-summary.ts`

공통 출력:

```ts
type SourceItem = {
  sourceKey: string;
  sourceType: "status_json" | "report" | "decision_log" | "git_summary" | "manual";
  title: string;
  content: string;
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

금지:

- `.env`, DB URL, token 파일 직접 수집 금지.
- secret-like content를 로그/이벤트 metadata에 쓰지 않기.

### 3. Dedupe

파일 후보:

- `src/server/pipeline/dedupe.ts`

규칙:

- `contentHash(normalize(content))`로 artifact dedupe.
- `sourceKey + observed date + actionKey`로 task/card dedupe.
- 기존 `Artifact.contentHash` unique를 재사용.
- dedupe hit이면 `artifact.deduped` Event만 남기고 카드 재생성 생략.

### 4. Summarizer

파일 후보:

- `src/server/pipeline/summarizer.ts`

1차는 LLM 없이 deterministic summarizer 권장:

- status json: `summary/current_blocker/next_action` 사용.
- markdown report: heading, first paragraph, TODO/Next Action 섹션 추출.
- git summary: commit subject 상위 N개.

출력:

```ts
type SourceSummary = {
  headline: string;
  bullets: string[];
  blockers: string[];
  nextActions: string[];
  riskLevel: RiskLevel;
  confidence: number;
};
```

### 5. Card Generator

파일 후보:

- `src/server/pipeline/card-generator.ts`

카드 형식:

```md
# Daily Ops Card — {title}

- 날짜: {Asia/Seoul date}
- Source: {sourceType}/{sourceKey}
- Risk: {riskLevel}
- Project: {projectSlug|none}
- Agent: {agentSlug|none}

## 핵심 요약
- ...

## 근거 Artifact
- artifactId: ...
- path: restricted면 표시 안 함

## 다음 액션
1. ...

## 검증
- dedupe: pass
- secret scan: pass|restricted
- command safety: pass|manual_handoff
```

카드는 `Artifact(type=report 또는 other)`로 저장하고 관련 `Task`와 연결한다.

### 6. Verifier

파일 후보:

- `src/server/pipeline/verifier.ts`

검증 항목:

- 필수 섹션 존재: 핵심 요약/근거 Artifact/다음 액션/검증.
- secret-like content 미노출.
- source artifact와 task/card 링크 존재.
- risk 정책: high/critical은 CommandQueue 자동 큐잉 금지.
- 외부 발송/배포/public disclosure 문구 있으면 manual handoff.
- 테스트 계획이 없으면 카드 completed 금지. 카드에는 `## 검증`이 반드시 있어야 함.

출력:

```ts
type VerificationResult = {
  status: "pass" | "needs_changes" | "blocked";
  riskLevel: RiskLevel;
  reasons: string[];
  commandAction?: string;
  manualHandoffRequired: boolean;
};
```

### 7. Persistence/Linker

파일 후보:

- `src/server/pipeline/persist.ts`

트랜잭션 순서:

1. `Agent`/`Project` upsert.
2. source `Artifact` upsert by `contentHash`.
3. card `Artifact` create/upsert.
4. `Task` upsert by deterministic slug.
5. artifact의 `taskId/projectId/agentId` 링크 갱신.
6. `Event` append.
7. verifier pass + low/medium 내부 action만 `CommandQueue` create.

## API 설계

### 내부 실행 API

`POST /api/pipeline/daily/run`

- 인증: `readOperatorIdentity` 또는 내부 worker token. token 값 로깅 금지.
- body:

```json
{
  "date": "2026-05-21",
  "timezone": "Asia/Seoul",
  "dryRun": false,
  "sourceTypes": ["status_json", "report", "git_summary"]
}
```

- response:

```json
{
  "runKey": "daily-ops:2026-05-21:Asia/Seoul",
  "status": "completed",
  "changed": 5,
  "skipped": 12,
  "restricted": 1,
  "cards": [{ "taskId": "...", "artifactId": "...", "status": "queued" }]
}
```

### 조회 API

기존 bridge를 우선 재사용:

- `GET /api/bridge/tasks?limit=...` 카드 Task 노출.
- `GET /api/bridge/events?limit=...` warning/critical event 노출.
- `GET /api/bridge/commands?limit=...` 큐 상태 노출.
- `GET /api/bridge/summary` 운영 summary 노출.

필요 시 추가:

- `GET /api/pipeline/daily/runs?limit=30`
- `GET /api/pipeline/cards?date=YYYY-MM-DD`

## UI/Ops Console 연동

- Dashboard: daily card task는 기존 `tasks` 섹션에 표시.
- Bridge summary: `blockedTasks`, `criticalEvents`, `queuedCommands` 카운트에 자연 반영.
- Artifact 상세: restricted면 path/url null 유지, restriction reason만 표시.
- Event stream: `card.generated`, `card.verified`, `command.manual_handoff_required`를 timeline에 표시.
- CommandQueue: low/medium 내부 command만 operator 승인/worker 실행 대상으로 노출.

## 구현 단계

### Phase 0 — 설계/테스트 고정

1. 이 문서와 `SCHEDULER_AND_PIPELINE_PLAN.md` 리뷰.
2. 테스트 케이스를 먼저 추가할 파일 목록 확정.
3. schema 변경 여부 결정: `CollectionRun/SourceCursor` 추가 vs 기존 모델만 사용.

### Phase 1 — Pipeline 타입과 deterministic summarizer

- `src/server/pipeline/types.ts` 생성.
- `summarizer.ts`, `dedupe.ts`, `verifier.ts` unit test 먼저 작성.
- LLM/API 의존 없이 fixture 기반 통과.

### Phase 2 — Collectors

- 기존 `src/server/ingest/index.ts` 후보 발견 로직을 collector 인터페이스로 분리.
- status json collector는 기존 `parseStatusJson` 재사용.
- report/docs collector는 whitelist path만 사용.
- secret scan test 추가.

### Phase 3 — Card generator + persistence

- markdown card generator 구현.
- Prisma transaction linker 구현.
- Artifact/Task/Event 연결 integration test 작성.

### Phase 4 — Scheduler/worker/API

- 08:00 Asia/Seoul runKey 계산 테스트.
- Redis/DB lock 또는 unique runKey idempotency 테스트.
- `worker:scheduler`와 `/api/pipeline/daily/run` 추가.

### Phase 5 — Ops Console projection

- 기존 bridge projection에 카드 task/event/command가 보이는지 테스트.
- dashboard smoke test fixture 갱신.

### Phase 6 — 운영 검증

- local Docker compose에서 postgres/redis/app/worker 실행.
- dry-run 후 real internal run.
- public deploy 없음. 외부 발송 없음.

## 테스트/검증 계획

완료 조건: 아래 테스트 계획이 없거나 실패하면 completed 처리 금지.

### Unit tests

- `src/server/pipeline/dedupe.test.ts`
  - 동일 contentHash는 skipped.
  - sourceKey가 달라도 content가 같으면 Artifact 중복 생성 안 함.
- `src/server/pipeline/summarizer.test.ts`
  - status json summary/blocker/next_action 추출.
  - markdown heading/Next Action 추출.
- `src/server/pipeline/card-generator.test.ts`
  - 필수 섹션 포함.
  - restricted artifact path 미노출.
- `src/server/pipeline/verifier.test.ts`
  - secret-like content 포함 시 blocked/restricted.
  - deploy/public disclosure는 manual handoff.
  - 검증 섹션 없는 카드는 fail.
- `src/server/scheduler/daily-ops.test.ts`
  - Asia/Seoul 08:00 runKey 생성.
  - 같은 날짜 중복 실행 방지.

### Integration tests

- `tests/integration/pipeline-daily-run.test.ts`
  - fixture source 3개 입력 -> Artifact 3개 + Card Artifact 3개 + Task 3개 + Event 생성.
  - 중복 재실행 -> changed 0, skipped 증가.
  - restricted source -> Artifact restricted + critical Event + path/url masked.
  - low/medium safe action -> CommandQueue queued.
  - high/critical action -> CommandQueue 미생성 + manual handoff Event.

### API tests

- `tests/integration/api-pipeline-run.test.ts`
  - unauthenticated POST 401.
  - authenticated dryRun은 DB write 없음.
  - authenticated run은 summary payload 반환.
- 기존 bridge tests 확장:
  - `/api/bridge/tasks`에 generated card task 표시.
  - `/api/bridge/events`에 card/manual handoff event 표시.
  - `/api/bridge/commands`에 safe queued command 표시.

### Smoke/E2E checks

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm prisma:validate`
- schema 변경 시 `pnpm prisma:generate`
- `pnpm build`
- `pnpm docker:config`
- Docker 로컬:
  - `docker compose up -d postgres redis`
  - migration/seed 후 worker dry-run
  - dashboard 401/200 auth gate 확인

## 리스크와 대응

- 타임존 오류: `Intl.DateTimeFormat` 또는 명시 timezone 유틸 테스트로 고정.
- 중복 카드 폭증: runKey/sourceKey/contentHash/actionKey 3중 dedupe.
- secret 노출: scanner를 artifact/card/event 전 단계에서 적용, restricted path/url 마스킹.
- scheduler 이중 실행: DB unique 또는 Redis lock 필수.
- public deploy 오해: 이 계획은 local/private network only.
- DB URL/secret 열람: `.env*`, process env 값 출력/수집 금지.
