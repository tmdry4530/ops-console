# Frontend UI Guide — Company Ops Console

이 문서는 Company Ops Console의 프론트엔드 화면 구성, 컴포넌트 책임, 백엔드/API 연결 방식, 그리고 앞으로 UI를 확장할 때 따라야 할 기준을 정의한다. 목표는 “운영자가 지금 무엇을 봐야 하고, 무엇을 승인해야 하며, 어떤 액션이 위험한지”를 빠르게 판단하게 하는 것이다.

## 1. UI 원칙

- **State-first:** 로그보다 현재 상태, 다음 액션, blocker, approval 상태를 먼저 보여준다.
- **Artifact-first:** 긴 보고서/PoC/CSV/로그 본문은 붙여 넣지 않고 artifact path, repo, commit SHA, URL로 연결한다.
- **Approval-before-risk:** bounty submission, outreach, deploy, payment, wallet/KYC, public disclosure, live trading은 승인/수동 handoff 상태를 UI에서 명확히 분리한다.
- **Audit-visible:** 승인, 거절, 변경 요청, manual submit, command queue 생성, restricted artifact 감지는 timeline/event로 보여준다.
- **Private ops UI:** 공개 SaaS 느낌보다 “사설 운영 터미널 + 의사결정 보드” 느낌을 유지한다.

## 2. 화면 구성

### `/dashboard` — Overview Dashboard

목적: 운영자가 가장 먼저 보는 global command center.

필수 영역:

- Global health card
- Pending approvals count/list
- Active tasks count
- Failed jobs count
- Agent status grid
- Project board 요약
- Recent artifacts
- Recent events / critical events
- Highest-priority next action

데이터 연결:

- Server component에서 `getDashboardSummary()` 호출
- 내부적으로 Prisma `Agent`, `Project`, `Task`, `Approval`, `Artifact`, `Event`를 조회
- 변경 후 `router.refresh()`로 최신 서버 상태 재조회

주요 파일:

- `src/app/(app)/dashboard/page.tsx`
- `src/server/dashboard.ts`
- `src/components/metric-card.tsx`
- `src/components/agent-status-grid.tsx`
- `src/components/project-board.tsx`
- `src/components/event-timeline.tsx`
- `src/components/artifact-link.tsx`

### `/approvals` — Approval Queue

목적: 운영자가 승인해야 할 위험 액션을 한눈에 확인한다.

필수 영역:

- Approval cards
- Type: `bounty_submission`, `revenue_outreach`, `deploy`, etc.
- Status: pending / manual_handoff / completed / rejected / needs_changes
- Risk badge
- 연결 project/task

데이터 연결:

- Prisma `Approval.findMany({ include: { project, task } })`
- 각 카드에서 `/approvals/[id]`로 이동

주요 파일:

- `src/app/(app)/approvals/page.tsx`
- `src/components/risk-badge.tsx`
- `src/components/status-badge.tsx`

### `/approvals/[id]` — Approval Detail / Decision Surface

목적: 실제 의사결정 화면. Bounty Submission Approval의 핵심 화면이다.

필수 영역:

- Approval title/type/status/risk
- Project/task context
- Report path, PoC path, commit SHA
- Decision buttons:
  - Approve / queue safe action
  - Reject
  - Request changes
  - Mark manually submitted
- Manual submission report ID input
- Command queue / manual handoff records
- Timeline events

데이터 연결:

- Server component에서 approval, project, task, artifacts, events, commandQueues 조회
- `ApprovalActions` client component가 API route 호출
- API 성공 후 `router.refresh()`로 server component 재조회

API 연결:

- `POST /api/approvals/[id]/approve`
- `POST /api/approvals/[id]/reject`
- `POST /api/approvals/[id]/request-changes`
- `POST /api/approvals/[id]/manual-submit`

주요 파일:

- `src/app/(app)/approvals/[id]/page.tsx`
- `src/components/approval-actions.tsx`
- `src/server/approvals.ts`
- `src/app/api/approvals/[id]/*/route.ts`

### `/agents` and `/agents/[id]` — Agent Operations

목적: agent별 health, heartbeat, 현재 task, artifacts, timeline을 확인한다.

List 화면:

- Agent status grid
- health/status/current task

Detail 화면:

- Agent status/health
- heartbeat
- current task
- permissions placeholder
- tasks
- artifacts
- logs placeholder
- timeline

데이터 연결:

- `Agent.findMany()` / `Agent.findUnique({ include: { tasks, artifacts, events } })`

주요 파일:

- `src/app/(app)/agents/page.tsx`
- `src/app/(app)/agents/[id]/page.tsx`
- `src/components/agent-status-grid.tsx`

### `/projects` and `/projects/[id]` — Project Boards

목적: revenue, bounty, crypto signal, blockers, next actions를 project 단위로 관리한다.

List 화면:

- Project board cards
- status, blocker, next action

Detail 화면:

- Revenue board summary
- Bounty board summary
- Crypto signal board summary
- Approvals and blockers
- Tasks
- Artifacts
- Timeline

데이터 연결:

- `Project.findMany()` / `Project.findUnique({ include: { tasks, approvals, artifacts, events } })`

주요 파일:

- `src/app/(app)/projects/page.tsx`
- `src/app/(app)/projects/[id]/page.tsx`
- `src/components/project-board.tsx`

### `/artifacts` — Artifact Registry

목적: report, PoC, CSV, decision log, cron output, screenshot 등 long output의 링크/메타데이터를 보여준다.

표시 원칙:

- `restricted=false`: path/url/repo/commit 표시
- `restricted=true`: 본문/민감 정보 표시 금지, restriction reason만 표시

데이터 연결:

- `Artifact.findMany()`
- 개별 artifact metadata API: `GET /api/artifacts/[id]`

주요 파일:

- `src/app/(app)/artifacts/page.tsx`
- `src/app/api/artifacts/[id]/route.ts`
- `src/components/artifact-link.tsx`

### `/events` — Event Timeline

목적: audit/event stream을 운영자가 필터링/확인한다.

필수 영역:

- Recent events
- Severity badge
- Event type
- Event timestamp
- API/SSE 연결 정보

데이터 연결:

- Page: Prisma `Event.findMany()`
- API: `GET /api/events?type=...`
- SSE: `GET /api/events/stream`

주요 파일:

- `src/app/(app)/events/page.tsx`
- `src/app/api/events/route.ts`
- `src/app/api/events/stream/route.ts`
- `src/components/event-timeline.tsx`

### `/policies` — Safety Policies

목적: 어떤 action이 allow / require_approval / block / require_manual_handoff인지 보여준다.

데이터 연결:

- `Policy.findMany()`
- Seeded defaults from `prisma/seed.ts`

주요 파일:

- `src/app/(app)/policies/page.tsx`
- `src/server/policies.ts`

### `/settings` — Environment and Integration Placeholders

목적: 환경 상태, private deployment assumption, notification/integration placeholders를 보여준다.

현재는 placeholder이며, production hardening 단계에서 다음 연결을 추가한다:

- Auth proxy status
- Redis/rate-limit status
- Worker status
- Backup freshness
- Notification target status

주요 파일:

- `src/app/(app)/settings/page.tsx`

## 3. 컴포넌트 구조

현재 컴포넌트는 shadcn/ui-compatible한 “작은 조립 단위”를 목표로 한다. 실제 shadcn CLI를 도입하지 않아도 다음 구조를 유지한다.

- `AppShell`
  - 전체 navigation, private-network banner, main layout 담당
- `MetricCard`
  - dashboard 숫자/상태 카드
- `StatusBadge`
  - status/health/severity 공통 badge
- `RiskBadge`
  - risk level 전용 badge
- `ApprovalActions`
  - 승인 액션 client component
  - API 호출과 `router.refresh()` 담당
- `ArtifactLink`
  - restricted artifact 표시 정책 담당
- `EventTimeline`
  - audit/event timeline 표시
- `AgentStatusGrid`
  - agent cards
- `ProjectBoard`
  - project cards

확장 규칙:

- 페이지는 가능하면 **Server Component**로 시작한다.
- 사용자 입력/버튼/fetch mutation만 **Client Component**로 분리한다.
- DB 조회는 page에서 직접 하거나 `src/server/*` helper로 분리한다.
- 위험 액션 판단은 UI에서 재구현하지 말고 `src/server/policies.ts`, `src/server/approvals.ts`, `src/lib/auth.ts`의 서버 규칙을 따른다.

## 4. 프론트엔드 ↔ 백엔드 연결 패턴

### Read path

권장 흐름:

```txt
Page Server Component
  -> src/server/* query helper
  -> Prisma
  -> typed props
  -> presentational components
```

예시:

```txt
/dashboard
  -> getDashboardSummary()
  -> Agent/Project/Task/Approval/Artifact/Event
  -> MetricCard / AgentStatusGrid / ProjectBoard / EventTimeline
```

### Mutation path

권장 흐름:

```txt
Client Component button/form
  -> fetch('/api/...', { method: 'POST' })
  -> Route Handler
  -> src/server/* domain function
  -> Prisma transaction/update
  -> Event audit record
  -> Client router.refresh()
```

예시:

```txt
ApprovalActions
  -> POST /api/approvals/[id]/manual-submit
  -> markManualSubmitted()
  -> Approval completed + Project submitted + Task completed + Event created
  -> router.refresh()
```

### Realtime path

현재 SSE는 snapshot 형태로 시작한다.

```txt
GET /api/events/stream
  -> listEvents()
  -> text/event-stream snapshot
```

향후 개선:

- Redis pub/sub 또는 DB polling을 붙여 live event push
- Dashboard에서 `EventSource('/api/events/stream')` client component 추가
- 연결 실패 시 static server-rendered event list로 fallback

## 5. Auth / Private Network 연결

현재 auth gate는 `middleware.ts`에서 처리한다.

허용 방식:

- Production-private reverse proxy가 `x-ops-operator-email` header를 주입
- Local development에서는 `AUTH_BYPASS_LOCAL=true`일 때 bootstrap operator 사용

UI 요구사항:

- 운영 화면은 header 없이는 접근 불가해야 한다.
- UI에서 password, 2FA, seed phrase, private key, plaintext token 입력 필드를 만들면 안 된다.
- 실제 SSO/OAuth가 붙더라도 plaintext token을 UI-visible field에 저장하지 않는다.

관련 파일:

- `middleware.ts`
- `src/lib/auth.ts`
- `.env.example`
- `docs/operations/SECURITY.md`

## 6. Bounty Submission Approval UI Flow

현재 첫 vertical slice의 기준 흐름:

```txt
Seed / ingestion
  -> CapyFi project/task/artifacts/approval 생성

/approvals
  -> bounty_submission card 표시

/approvals/[id]
  -> report path + PoC path + commit SHA + risk 표시
  -> approve / reject / request changes / manual submit 액션 제공

Approve
  -> Immunefi submit은 manual handoff action이므로 자동 실행 금지
  -> CommandQueue status = waiting_manual_handoff
  -> approval.approved event 생성

Manual submitted
  -> report ID 입력
  -> Approval status = completed
  -> Project status = submitted
  -> Task status = completed
  -> approval.manual_submitted event 생성
```

UI에서 특히 강조할 것:

- “Approve”는 Immunefi 자동 제출이 아니다.
- manual handoff 상태와 command queue 상태를 별도 영역에 보여준다.
- report ID 입력 전에는 manual submitted 버튼을 비활성화한다.

## 7. 다음 UI 확장 순서

1. **Approval detail polish**
   - decision history를 더 명확히 분리
   - command/manual handoff status card 추가
   - destructive/risky action 색상 체계 강화

2. **Dashboard realtime client island**
   - `EventSource('/api/events/stream')` 연결
   - 새 critical event toast 또는 banner 표시

3. **Settings status cards**
   - DB health
   - Redis health
   - worker heartbeat
   - backup freshness
   - auth proxy mode

4. **Artifact detail page**
   - restricted metadata only
   - non-restricted artifact는 path/repo/commit 중심으로 표시
   - raw body rendering은 기본 금지

5. **Revenue Manual Outreach slice**
   - outreach approval card
   - external send는 manual handoff only
   - submitted/contacted 상태 timeline 추가

## 8. 디자인 기준

현재 visual direction은 “industrial private ops terminal”이다.

- Background: dark green/black operational surface
- Accent: acid green for safe/active operational cues
- Warning: amber
- Danger: coral/red
- Cards: rounded panels, strong borders, dense but readable layout
- Typography: monospace-forward, command center 느낌

UI를 추가할 때 피할 것:

- SaaS marketing dashboard처럼 과하게 밝은 톤
- purple gradient/white card generic AI 디자인
- 긴 로그 본문을 dashboard에 직접 표시
- 위험 액션 버튼을 일반 primary button처럼 보이게 하는 것

## 9. 구현 체크리스트

새 화면/컴포넌트를 추가할 때 확인한다.

- [ ] 이 화면이 operator의 next action 판단을 돕는가?
- [ ] 긴 출력은 artifact 링크로 처리했는가?
- [ ] restricted artifact 본문을 숨기는가?
- [ ] 위험 액션은 approval/manual handoff로 분리했는가?
- [ ] mutation 후 audit event가 생성되는가?
- [ ] server rule을 UI에서 중복 구현하지 않았는가?
- [ ] unauthenticated 접근이 막히는가?
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`가 통과하는가?
