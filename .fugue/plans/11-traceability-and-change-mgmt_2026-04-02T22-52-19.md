# 11. 추적성 및 변경관리 고도화

> 작성일: 2026-04-03
> 배경: cs-agent, qless console 두 프로젝트 착수를 앞두고, Fugue가 실제 업무 도구로 채택되려면 필요한 기능들을 정의한다.
> 원칙: "문서를 더 쓰게 하는 도구"가 아니라 "이미 하는 일에 ID를 붙여주는 도구"

---

## 11.1 커밋-매트릭스 자동 동기화 (fugue sync)

### 목적
개발자나 에이전트가 커밋할 때 메시지에 REQ ID를 넣으면, 추적 매트릭스(matrix.yaml)에 자동으로 code_refs와 test_refs가 갱신되어야 한다. 수동으로 matrix를 관리하면 아무도 안 쓰게 된다.

### 요구사항
- git log에서 REQ-XXX-NNN 패턴을 파싱하여 해당 커밋의 변경 파일을 추출한다
- 변경 파일 중 소스 코드는 code_refs에, 테스트 파일은 test_refs에 자동 매핑한다
- 테스트 파일 판별 기준: 파일명에 test, spec, __tests__ 포함, 또는 tests/ 디렉토리 하위
- 이미 매핑된 파일이 삭제된 경우 STALE로 마킹한다
- CLI: `fugue sync [--since <commit>] [--dry-run]`
- MCP tool: `fugue_sync` (동일 기능)
- 결과를 요약 출력한다: "3 REQs updated, 7 code_refs added, 2 test_refs added"

### 제약사항
- git 히스토리를 변경하지 않는다 (읽기 전용)
- 기존 수동 매핑을 덮어쓰지 않고 병합한다
- 커밋 메시지에 REQ ID가 없는 커밋은 무시한다

---

## 11.2 요구사항 변경 이력 관리

### 목적
REQ의 title, description, priority 등 내용이 변경될 때 이전 값과 변경 사유를 기록한다. "이 요구사항이 왜, 언제, 어떻게 바뀌었는가"를 추적할 수 있어야 한다.

### 요구사항
- REQ YAML에 revision(숫자)과 history(배열) 필드를 추가한다
- title, description, priority, status 필드 변경 시 자동으로 이전 값을 history에 기록한다
- 각 history 항목: rev, at(ISO8601), by(변경자), field, from, to, reason(선택)
- `fugue plan history <REQ-ID>`에서 기존 feedback + 새 변경이력을 통합 타임라인으로 보여준다
- 변경 사유(reason)는 CLI에서 --reason 옵션으로 받거나, 대화형으로 입력받는다
- MCP tool: `fugue_feedback`에 field 변경 기능을 추가하거나 별도 `fugue_req_update` 도구를 만든다

### 제약사항
- 기존 specs YAML과 하위호환 유지 (history 필드 없는 기존 REQ도 정상 동작)
- status 변경은 기존 feedback 메커니즘과 통합 (중복 기록 방지)

---

## 11.3 PM 에이전트 연동 인터페이스

### 목적
cs-agent의 cs-pm, qless console의 PM이 Fugue MCP 도구를 자연스럽게 사용할 수 있어야 한다. PM이 별도로 Fugue 사용법을 학습하지 않아도 되게 한다.

### 요구사항
- PM 에이전트용 워크플로우 프리셋을 제공한다: `pm-daily` (상태 확인 + 블로커 식별), `pm-review` (REQ 리뷰 사이클)
- `fugue workflow run pm-daily`로 실행하면: status → audit(quick) → 블로커 REQ 목록을 한 번에 출력
- `fugue workflow run pm-review`로 실행하면: DRAFT REQ 순차 리뷰 → confirm 까지
- PM 에이전트 프롬프트에 삽입할 수 있는 Fugue MCP 사용 가이드 마크다운을 생성하는 명령: `fugue agent guide --role pm`
- 이 가이드에는 도구별 용도, 일반적 사용 순서, 예시가 포함된다

### 제약사항
- 기존 워크플로우 엔진(workflow.ts)을 확장한다 (신규 엔진 아님)
- PM이 아닌 역할(dev, qa)의 프리셋은 이번 범위에서 제외

---

## 11.4 회귀 감지 (fugue verify)

### 목적
REQ에 매핑된 코드가 변경되었을 때, 관련 테스트가 존재하는지 및 재실행이 필요한지를 경고한다. 기존 기능이 망가지는 상황을 사전에 방지한다.

### 요구사항
- `fugue verify [--since <commit>]`로 실행한다
- 지정 커밋 이후 변경된 파일 목록을 추출한다
- 변경된 파일이 어떤 REQ의 code_refs에 포함되는지 역매핑한다
- 해당 REQ의 test_refs가 비어있으면 "NO_TEST" 경고를 출력한다
- test_refs가 있으면 "TEST_NEEDED" 상태로 표시하고, 테스트 실행 명령을 안내한다
- 결과를 요약 출력: "5 REQs affected, 2 NO_TEST, 3 TEST_NEEDED"
- MCP tool: `fugue_verify`
- --run 옵션으로 직접 테스트를 실행하는 기능은 향후 확장 (이번에는 경고만)

### 제약사항
- 테스트를 직접 실행하지 않는다 (경고와 안내만)
- matrix가 비어있으면 먼저 `fugue sync`를 실행하라고 안내한다

---

## 11.5 decompose 품질 개선

### 목적
다양한 포맷의 계획 문서(린캔버스, TASKS.md, 마일스톤 문서 등)를 import했을 때 일관된 품질의 REQ가 생성되어야 한다.

### 요구사항
- decompose 시 문서 포맷을 자동 감지한다 (마크다운 헤딩 구조, 린캔버스 9블록, 태스크 체크리스트 등)
- 포맷별로 최적화된 프롬프트 템플릿을 사용한다
- 생성된 REQ에 source.section 필드로 원본 문서의 어느 섹션에서 추출했는지 기록한다
- decompose 결과를 dry-run으로 미리 볼 수 있다: `fugue plan decompose --dry-run`
- 기존 CONFIRMED REQ와 중복되는 REQ가 생성되면 경고한다

### 제약사항
- 기존 decompose 파이프라인(postprocess.ts)을 확장한다
- 새 프롬프트 템플릿은 prompts/ 디렉토리에 추가한다

---

## 우선순위

| 순위 | 섹션 | 착수 전 필수 여부 |
|------|------|:---------------:|
| P1 | 11.1 커밋-매트릭스 자동 동기화 | 필수 |
| P1 | 11.2 요구사항 변경 이력 관리 | 필수 |
| P1 | 11.3 PM 에이전트 연동 인터페이스 | 필수 |
| P2 | 11.4 회귀 감지 | 개발 진행 후 |
| P2 | 11.5 decompose 품질 개선 | 권장 |
