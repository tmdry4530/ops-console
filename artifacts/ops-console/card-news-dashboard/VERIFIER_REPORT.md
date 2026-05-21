# Card News Dashboard — Final Plan / Verifier Report

- 작성: docs-agent verifier
- 시각: 2026-05-21 10:41 KST
- 범위: 최종 plan 문서화, verifier 기준, `docs/INDEX.md`/`log.md` 연결 문구
- 리스크 경계: hq-agent risk boundary review 조건 포함. 구현/배포/외부 발송은 하지 않음.

## Verdict

**PASS — docs/verifier 산출물 기준 충족.**

단, 이 verdict는 문서화/검증 기준 준비에 대한 PASS다. 실제 구현 완료, 운영 스케줄 등록, UI 렌더링, 리서치 수집 결과는 dev/qa 산출물로 별도 증거 제출 후 final verifier가 재판정한다.

## Final plan 요약

Card News Dashboard는 설정 가능한 도메인/소스에서 매일 08:00 KST에 최신 뉴스를 수집하고, 출처 기반 근거를 보존한 뒤, 중복 제거와 승인 분리를 거쳐 PC/mobile 카드뉴스 대시보드로 보여주는 기능이다.

### 필수 흐름

1. **Domain/source 설정**
   - 운영자가 도메인, 소스 목록, 포함/제외 키워드, 수집 주기, 카드 표시 개수를 설정한다.
   - 소스는 코드 하드코딩 금지. config/env/DB 중 하나를 canonical source로 둔다.
2. **08:00 KST workflow**
   - 매일 08:00 KST 기준 수집 job을 실행한다.
   - timezone은 `Asia/Seoul`로 명시하고 UTC 변환/서버 TZ 의존을 테스트한다.
3. **Research ingest**
   - 각 아이템은 `source`, `publishedAt`, `collectedAt`, `canonicalLink`, `title`, `summary`, `evidence`, `dedupeKey`를 가진다.
   - source-backed research 원칙: 링크/시각/출처 없는 항목은 카드 후보에서 제외한다.
4. **Dedupe/evidence**
   - canonical URL, normalized title, source+publishedAt 조합으로 중복 제거한다.
   - 중복 묶음은 evidence list에 보존하고 대표 카드만 노출한다.
5. **Card format**
   - 카드 필드: headline, 1-line summary, why-it-matters, source label, time label, canonical link, evidence count, approval state.
   - 카드 생성/요약이 불확실하면 추정 표기 금지, evidence 부족 상태로 둔다.
6. **Approval separation**
   - 수집/요약/대시보드 표시는 read-only 내부 작업으로 제한한다.
   - 외부 게시, 알림 발송, 자동 승인, 공개 공유는 별도 approval/manual handoff 없이는 실행하지 않는다.
7. **PC/mobile layout**
   - PC: dashboard grid + source/time/evidence metadata가 보이는 카드형 레이아웃.
   - Mobile: 1-column card stack, source/time/link/evidence가 접히지 않고 접근 가능해야 한다.
8. **Dev test plan**
   - config 파싱, KST 스케줄 계산, source-backed ingest, dedupe, card projection, approval 분리, responsive layout을 테스트한다.
9. **Final verifier**
   - dev/qa 산출물 제출 후 아래 체크리스트로 PASS/BLOCKED 판정한다.

## hq-agent risk boundary review 조건

아래 중 하나라도 해당하면 hq-agent review + 명시적 operator approval 전까지 **BLOCKED**다.

- 새 외부 API/vendor/유료 서비스 연결
- 공개 게시, Discord/메일/웹훅 등 외부 발송
- 크롤링/수집 대상 약관·robots·rate limit 불명확
- 개인정보/로그인 세션/쿠키/토큰/유료 구독 데이터 접근
- high/critical risk action, 배포, public routing 변경
- 자동 승인 또는 approval bypass
- 출처 없는 생성형 요약을 사실처럼 노출

허용되는 safe boundary:

- 내부 문서/plan 작성
- read-only config/ingest/card projection 설계
- mock/test fixture 기반 UI 및 dedupe 테스트
- 외부 발송 없는 로컬 검증

## Success criteria checklist

| Criteria | Verifier 기준 | Status |
|---|---|---|
| configurable domain source | 도메인/소스가 config/env/DB로 바뀌고 하드코딩이 아님 | PASS 기준 정의됨 |
| source/time/link/dedupe/evidence fields | 모든 카드 후보에 source, publishedAt/collectedAt, canonicalLink, dedupeKey, evidence가 있음 | PASS 기준 정의됨 |
| 08:00 KST workflow | Asia/Seoul 기준 08:00 실행/계산 테스트와 서버 TZ 독립성 증거 | PASS 기준 정의됨 |
| card format | headline, summary, why-it-matters, source/time/link/evidence/approval 표시 | PASS 기준 정의됨 |
| PC/mobile layout | PC grid, mobile 1-column, metadata 접근성, overflow 없음 | PASS 기준 정의됨 |
| approval separation | 수집/요약/보기와 외부 발송/게시/승인이 분리됨 | PASS 기준 정의됨 |
| dev test plan | unit/integration/UI/smoke 테스트 명령과 기대값 문서화 | PASS 기준 정의됨 |
| source-backed research | 출처·시간·링크 없는 항목 제외, evidence 보존 | PASS 기준 정의됨 |
| final verifier | dev/qa 증거 기반 PASS/BLOCKED 재판정 | PASS 기준 정의됨 |

## Final verifier 판정 규칙

### PASS

아래 증거가 모두 제출되면 PASS:

- 설정 가능한 domain/source 예시와 테스트 결과
- 08:00 KST 스케줄 계산/등록 증거
- source/time/link/dedupe/evidence 필드가 포함된 샘플 payload
- dedupe 전/후 샘플과 evidence 보존 증거
- 카드 포맷 스크린샷 또는 DOM/HTML smoke
- PC/mobile responsive 검증 증거
- approval separation 증거: 외부 발송/공개 게시/자동 승인 없음
- dev test plan 실행 결과
- source-backed research 샘플 3개 이상
- hq-agent risk boundary 위반 없음 또는 승인 기록 있음

### BLOCKED

아래 중 하나라도 있으면 BLOCKED:

- source/link/time 없는 카드가 노출됨
- dedupe/evidence가 누락됨
- 08:00 KST가 서버 로컬 TZ에 의존하거나 검증 없음
- 외부 게시/발송/유료 API/쿠키·토큰 접근이 approval 없이 추가됨
- PC/mobile 중 하나가 주요 metadata를 숨기거나 overflow 발생
- source-backed research 대신 추정/환각 요약이 사실처럼 표시됨
- hq-agent review 대상인데 review/approval 기록이 없음

## docs/INDEX.md update snippet

```md
## Feature plans / verifier artifacts

- `artifacts/ops-console/card-news-dashboard/VERIFIER_REPORT.md` — Card News Dashboard final plan, verifier checklist, hq-agent risk boundary, and PASS/BLOCKED criteria.
```

## log.md update snippet

```md
## 2026-05-21 10:41 KST — Card News Dashboard verifier docs

- docs-agent verifier가 Card News Dashboard 최종 plan/verifier 기준을 작성했다.
- 산출물: `artifacts/ops-console/card-news-dashboard/VERIFIER_REPORT.md`.
- verdict: PASS for docs/verifier readiness; 실제 구현/운영 검증은 dev/qa evidence 제출 후 final verifier가 재판정.
- hq-agent risk boundary: 외부 API/발송/공개 게시/유료 액션/쿠키·토큰 접근/approval bypass는 review+operator approval 전까지 BLOCKED.
```

## Verification notes

- 파일 작성만 수행. 앱 코드, schema, runtime, 배포, 외부 네트워크, secret 접근 없음.
- 본 문서는 final verifier가 사용할 기준을 고정한다.
