# TASK-011 리뷰 — Progressive Detail 자동 상세화 추적 시스템

> 리뷰일: 2026-04-03
> 작성: CEO + Claude
> 상태: DECOMPOSED → 리뷰 중
> 총 REQ: 42개 (6개 도메인)

---

## 구현 배경

cs-agent, qless console 두 프로젝트 착수를 앞두고, Fugue가 실제 업무 도구로 채택되려면 필요한 기능들을 정의했다. qless-docs 추적성 매트릭스(D2.03) + 정책 문서 수준을 목표로 하되, "일의 크기에 따라 문서화 수준이 자동으로 조절되는" Progressive Detail 모델을 도입한다.

---

## PDET — Progressive Detail (12개)

핵심: L0(커밋태깅) → L1(REQ) → L2(ai_context) → L3(Policy) 자동 상세화

| ID | Priority | Title | Description |
|----|----------|-------|-------------|
| PDET-001 | HIGH | Progressive Detail 4단계 레벨 정의 | L0~L3 모델을 config.yaml에 정의 |
| PDET-002 | HIGH | 상세화 임계치 설정 | L2(code_refs 5개), L3(10개 또는 cross-ref 3+). config에서 조정 가능 |
| PDET-003 | HIGH | 자동 승급 제안 엔진 | sync 후 임계치 초과 시 suggest. 강제 아닌 dismiss 가능 |
| PDET-004 | MEDIUM | 역방향 승급 (Policy→REQ) | Policy가 먼저 작성된 경우 REQ+ai_context 자동 추출 |
| PDET-005 | HIGH | ai_context 자동 생성 (L2 엔진) | Conductor가 코드 분석 → summary, key_rules, common_mistakes 생성 |
| PDET-006 | HIGH | fugue enrich CLI 명령어 | `fugue enrich [REQ-ID] [--all] [--dry-run] [--force]` |
| PDET-007 | MEDIUM | fugue_enrich MCP 도구 | 동일 기능을 MCP tool로 노출 |
| PDET-008 | MEDIUM | 수동 편집 ai_context 보존 | auto_generated 플래그로 추적, --force 없이 덮어쓰지 않음 |
| PDET-009 | HIGH | Policy MD 자동 생성 (L3 엔진) | 코드에서 정책문서 역생성. frontmatter + 규칙(조건→행동→결과) + 코드 스니펫 |
| PDET-010 | HIGH | fugue policy generate CLI | `fugue policy generate [REQ-ID] [--all]`. .fugue/policies/{domain}/ 저장 |
| PDET-011 | MEDIUM | fugue policy import CLI | 기존 Policy에서 REQ+ai_context 역추출 |
| PDET-012 | MEDIUM | 생성된 Policy DRAFT 상태 관리 | 자동 생성은 DRAFT, 리뷰 후 confirmed. --force 없이 덮어쓰지 않음 |

---

## TRAC — Traceability & Sync (15개)

핵심: fugue sync + REQ 스키마 확장 + 변경 이력

| ID | Priority | Title | Description |
|----|----------|-------|-------------|
| TRAC-001 | HIGH | git log에서 REQ-ID 패턴 파싱 | 커밋 메시지에서 REQ-XXX-NNN 정규식 추출 + 변경 파일 목록 |
| TRAC-002 | HIGH | 소스 파일 code_refs 자동 매핑 | 변경 파일 중 소스 코드를 code_refs에 추가 |
| TRAC-003 | HIGH | 테스트 파일 test_refs 자동 매핑 | test/spec/__tests__/tests/ 패턴으로 자동 분류 |
| TRAC-004 | MEDIUM | 삭제된 파일 STALE 마킹 | 매핑된 파일이 삭제되면 STALE로 표시 |
| TRAC-005 | HIGH | fugue sync CLI 명령어 | `fugue sync [--since <commit>] [--dry-run] [--auto-enrich]` |
| TRAC-006 | MEDIUM | fugue_sync MCP 도구 | 동일 기능을 MCP tool로 노출 |
| TRAC-007 | MEDIUM | 수동 매핑과 자동 매핑 병합 | 기존 수동 매핑을 덮어쓰지 않고 union 병합 |
| TRAC-008 | LOW | sync 결과 요약 출력 | N REQs synced, N refs added + 승급 제안 목록 |
| TRAC-009 | HIGH | REQ YAML에 ai_context 필드 추가 | summary(100자), key_rules(3~5개), common_mistakes(2~4개) |
| TRAC-010 | HIGH | REQ YAML에 policy_ref 필드 추가 | Policy MD 파일 경로 저장 |
| TRAC-011 | HIGH | REQ YAML에 detail_level 필드 추가 | 0~3 정수. 현재 상세화 수준 |
| TRAC-012 | HIGH | REQ YAML에 revision/history 필드 추가 | revision(숫자) + history 배열(rev, at, by, field, from, to, reason) |
| TRAC-013 | HIGH | 필드 변경 시 자동 history 기록 | title/description/priority/status 변경 시 이전 값 자동 기록 |
| TRAC-014 | HIGH | 기존 REQ YAML 하위호환 | 새 필드 없는 기존 REQ도 정상 동작. 기본값 처리 |
| TRAC-015 | MEDIUM | 통합 타임라인 조회 | feedback + 변경이력을 시간순 통합 타임라인 |

---

## PMIF — PM Interface (3개)

핵심: PM 에이전트가 Fugue를 자연스럽게 사용

| ID | Priority | Title | Description |
|----|----------|-------|-------------|
| PMIF-001 | HIGH | pm-daily 워크플로우 프리셋 | status → audit → 블로커 + 승급 제안 한 번에 출력 |
| PMIF-002 | HIGH | pm-review 워크플로우 프리셋 | DRAFT REQ 순차 리뷰 → confirm |
| PMIF-003 | MEDIUM | PM용 MCP 사용 가이드 생성 | `fugue agent guide --role pm` |

---

## VRFY — Verify & Regression (3개)

핵심: 코드 변경 시 관련 REQ/테스트 경고

| ID | Priority | Title | Description |
|----|----------|-------|-------------|
| VRFY-001 | MEDIUM | fugue verify CLI 명령어 | 변경 파일→REQ 역매핑, NO_TEST/TEST_NEEDED 경고 |
| VRFY-002 | LOW | fugue_verify MCP 도구 | 동일 기능을 MCP tool로 노출 |
| VRFY-003 | LOW | 빈 matrix 시 sync 안내 | matrix 비어있으면 fugue sync 먼저 안내 |

---

## DCMP — Decompose Quality (4개)

핵심: 다양한 문서 포맷에서 일관된 REQ 생성

| ID | Priority | Title | Description |
|----|----------|-------|-------------|
| DCMP-001 | MEDIUM | 문서 포맷 자동 감지 | 마크다운, 린캔버스, 태스크 체크리스트 등 |
| DCMP-002 | MEDIUM | 포맷별 프롬프트 템플릿 | 감지된 포맷에 최적화된 템플릿 사용 |
| DCMP-003 | LOW | decompose dry-run | `--dry-run`으로 생성될 REQ 미리보기 |
| DCMP-004 | LOW | 기존 CONFIRMED REQ 중복 경고 | 기존 REQ와 중복 시 경고 |

---

## TRAC 추가 — REQ→TASK 역추적 (1개)

| ID | Priority | Title | Description |
|----|----------|-------|-------------|
| TRAC-016 | HIGH | REQ YAML에 task_id 필드 추가 | REQ가 어느 TASK에서 생성되었는지 역추적. decompose 시 자동 채움 |

---

## AGNT — Agent Governance 추가 (4개)

핵심: Fugue가 프로젝트의 에이전트 부족분을 분석하고, 승인 시 프롬프트를 자동 생성

| ID | Priority | Title | Description |
|----|----------|-------|-------------|
| AGNT-010 | HIGH | 프로젝트 에이전트 갭 분석 | REQ 도메인/복잡도 대비 현재 에이전트 구성의 부족분을 분석, 필요 역할 권고 |
| AGNT-011 | HIGH | 에이전트 프롬프트 자동 생성 | 승인된 에이전트에 대해 CLAUDE.md/REQ/코드 분석 → .claude/agents/{name}.md 생성 |
| AGNT-012 | MEDIUM | 에이전트 권고 승인 워크플로우 | 갭 분석 결과 제시 → accept/dismiss/edit 선택지 → 승인 시 생성 |
| AGNT-013 | HIGH | CLAUDE.md 스캐폴드 생성 | fugue init 시 프로젝트 구조 분석 → CLAUDE.md 초안 자동 생성 |

---

## Priority 분포

| Priority | 수 | 비율 |
|----------|-----|------|
| HIGH | 22 | 52% |
| MEDIUM | 14 | 33% |
| LOW | 6 | 14% |

---

## 구현 순서 (제안)

### Phase 1 — 기반 (P0, 착수 전 필수)
- TRAC-009~014, 016: REQ YAML 스키마 확장 + 하위호환 + task_id
- TRAC-001~007: fugue sync 핵심 로직
- PDET-001~003: Progressive Detail 모델 + 임계치 + 승급 엔진
- AGNT-013: CLAUDE.md 스캐폴드 생성 (fugue init 확장)

### Phase 2 — SSOT 품질 (P1)
- PDET-005~008: L2 ai_context 자동 생성
- PDET-009~012: L3 Policy 자동 생성
- PDET-004: Policy→REQ 역방향
- PMIF-001~003: PM 연동
- AGNT-010~012: 에이전트 갭 분석 + 자동 생성 + 승인 워크플로우

### Phase 3 — 보강 (P2)
- VRFY-001~003: 회귀 감지
- DCMP-001~004: decompose 품질
- TRAC-008, 015: 출력/타임라인

---

## 리뷰 판정

- [ ] **ACCEPT** — 전체 confirm 후 구현 착수
- [ ] **COMMENT** — 조정 필요 (아래에 코멘트)
- [ ] **REJECT** — 재설계 필요

### 코멘트란

> (여기에 피드백을 작성하세요)
