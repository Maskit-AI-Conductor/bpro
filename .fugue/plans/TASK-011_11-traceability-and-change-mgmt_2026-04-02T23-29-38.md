# 11. Progressive Detail — 자동 상세화 추적 시스템

> 작성일: 2026-04-03
> 배경: cs-agent, qless console 착수를 앞두고, Fugue가 qless-docs 수준의 SSOT를 자동으로 만들어내는 시스템을 설계한다.
> 핵심 원칙: "일의 크기에 따라 문서화 수준이 자동으로 조절된다"
> 벤치마크: qless-docs의 추적성 매트릭스(D2.03) + 정책 문서(Policy) 수준

---

## 11.0 Progressive Detail 모델

### 개요
문서화의 양은 일의 크기에 비례해야 한다. 고정된 구조(항상 Policy 작성 등)는 작은 일에서 마찰을 만들고, 문서 없음은 큰 일에서 붕괴를 만든다. Fugue는 복잡도가 쌓이면 자동으로 상세화 수준을 올린다.

### 4단계 상세화 레벨

- **L0 (커밋 태깅)**: 커밋 메시지에 REQ-ID만 포함. fugue sync가 code_refs를 자동 채움. 추가 작업 없음.
- **L1 (REQ 정의)**: REQ YAML에 title + description. decompose가 자동 생성하거나 사람이 직접 작성. Policy 문서 없음.
- **L2 (AI 컨텍스트 자동 생성)**: code_refs가 임계치(기본 5개)를 넘으면, fugue가 코드를 분석하여 ai_context(summary, key_rules, common_mistakes)를 자동 생성. 사람은 검토만.
- **L3 (정책문서 자동 생성)**: code_refs가 상위 임계치(기본 10개)를 넘거나, 여러 에이전트가 참조하면 Policy MD 초안을 코드에서 역생성. 사람이 리뷰 후 confirm.

### 자동 승급 규칙
- L0→L1: fugue sync 시 REQ-ID가 커밋에 있으나 specs에 없으면 REQ YAML 자동 생성 제안
- L1→L2: code_refs 수가 임계치 초과 시 ai_context 자동 생성 트리거
- L2→L3: code_refs 수가 상위 임계치 초과, 또는 3개 이상 다른 REQ가 동일 파일 참조 시 Policy 생성 제안
- 역방향(L3→L0): Policy가 먼저 작성되면 REQ YAML + ai_context를 Policy에서 자동 추출

### 제약사항
- 자동 승급은 제안(suggest)이지 강제가 아니다. 사람이 dismiss 가능.
- L2, L3 자동 생성은 Conductor 모델을 사용한다.
- 임계치 값은 .fugue/config.yaml에서 프로젝트별로 조정 가능하다.

---

## 11.1 fugue sync — 커밋-매트릭스 자동 동기화 + 복잡도 감지

### 목적
커밋에 REQ-ID를 넣으면 추적성이 자동으로 유지되고, 복잡도가 쌓이면 상세화를 제안한다.

### 요구사항

#### 기본 동기화 (L0)
- git log에서 REQ-XXX-NNN 패턴을 파싱하여 해당 커밋의 변경 파일을 추출한다
- 변경 파일 중 소스 코드는 code_refs에, 테스트 파일은 test_refs에 자동 매핑한다
- 테스트 파일 판별: 파일명에 test/spec/__tests__ 포함, 또는 tests/ 하위
- code_refs에 파일 경로만 기록한다 (라인번호는 L2에서 추가)
- 이미 매핑된 파일이 삭제된 경우 STALE로 마킹한다
- 기존 수동 매핑을 덮어쓰지 않고 병합(union)한다
- CLI: `fugue sync [--since <commit>] [--dry-run]`
- MCP tool: `fugue_sync`

#### 복잡도 감지 및 승급 제안
- sync 완료 후 각 REQ의 code_refs 수를 집계한다
- L2 임계치(기본 5) 초과 REQ를 식별하여 "ai_context 생성을 권장합니다" 메시지를 출력한다
- L3 임계치(기본 10) 초과 또는 cross-reference(3개+ REQ가 동일 파일 참조) 감지 시 "Policy 생성을 권장합니다" 메시지를 출력한다
- --auto-enrich 옵션: 제안 대신 즉시 L2/L3 생성을 실행한다

#### 결과 출력
- 요약: "5 REQs synced, 12 code_refs added, 3 test_refs added"
- 승급 제안: "2 REQs recommend L2 enrichment, 1 REQ recommends L3 policy"

### 제약사항
- git 히스토리를 변경하지 않는다 (읽기 전용)
- REQ-ID가 없는 커밋은 무시한다

---

## 11.2 REQ YAML 스키마 확장

### 목적
REQ YAML이 L0~L3 전 단계를 담을 수 있는 그릇이 되어야 한다.

### 요구사항

#### 스키마 필드 추가
- ai_context 객체 추가: summary(string, 100자 이내), key_rules(string[], 3~5개), common_mistakes(string[], 2~4개)
- policy_ref 필드 추가: 연결된 Policy MD 파일 경로
- detail_level 필드 추가: 0, 1, 2, 3 중 하나. 현재 상세화 수준을 나타낸다
- revision 숫자 필드와 history 배열 필드 추가
- history 항목: rev, at(ISO8601), by, field, from, to, reason(선택)

#### 하위호환
- 기존 REQ YAML(ai_context, policy_ref, detail_level, revision, history 없음)도 정상 동작해야 한다
- 없는 필드는 기본값으로 처리: detail_level=1, revision=0, history=[], ai_context=null, policy_ref=null

#### 변경 이력 자동 기록
- title, description, priority, status 필드 변경 시 이전 값을 history에 자동 기록한다
- CLI에서 --reason 옵션으로 변경 사유를 받는다
- fugue plan history에서 feedback + 변경이력을 통합 타임라인으로 보여준다

---

## 11.3 ai_context 자동 생성 (L2)

### 목적
code_refs가 일정 수준 쌓인 REQ에 대해, 코드를 분석하여 에이전트가 참조할 수 있는 압축 정보를 자동 생성한다.

### 요구사항
- 대상: detail_level이 1이고 code_refs 수가 L2 임계치를 초과한 REQ
- Conductor 모델에 code_refs의 소스 코드를 읽혀서 ai_context를 생성한다
- 생성 내용: summary(이 REQ가 무엇을 하는지 한 줄), key_rules(핵심 비즈니스 규칙 3~5개), common_mistakes(자주 하는 실수 2~4개)
- 생성된 ai_context는 REQ YAML에 저장하고 detail_level을 2로 변경한다
- CLI: `fugue enrich [REQ-ID] [--all]` — 특정 REQ 또는 임계 초과 전체 REQ에 대해 실행
- MCP tool: `fugue_enrich`
- --dry-run 옵션으로 미리보기 가능

### 제약사항
- 이미 ai_context가 있는 REQ는 --force 없이 덮어쓰지 않는다
- 사람이 수정한 ai_context는 보존한다 (수동 편집 여부를 auto_generated 플래그로 추적)

---

## 11.4 Policy 자동 생성 (L3)

### 목적
복잡한 REQ에 대해 qless-docs 수준의 정책문서를 코드에서 역생성한다.

### 요구사항

#### 코드→정책 역생성
- 대상: detail_level이 2이고 L3 임계치를 초과한 REQ
- Conductor 모델에 해당 REQ의 모든 code_refs 소스 코드를 읽혀서 Policy MD를 생성한다
- 생성 구조: frontmatter(id, title, domain, version, code_refs, ai_context) + 본문(비즈니스 규칙 목록, 각 규칙의 조건→행동→결과, 코드 스니펫, 에러 케이스)
- 저장 경로: .fugue/policies/{domain}/{policy-name}.md
- REQ YAML의 policy_ref에 경로를 기록하고 detail_level을 3으로 변경한다
- CLI: `fugue policy generate [REQ-ID] [--all]`
- MCP tool: `fugue_policy_generate`

#### 정책→REQ 역생성
- .fugue/policies/ 에 Policy MD가 먼저 작성된 경우, Policy를 파싱하여 REQ YAML + ai_context를 자동 추출한다
- CLI: `fugue policy import <policy-file>`
- frontmatter의 ai_context를 REQ YAML로 복사하고, 본문의 규칙 목록에서 key_rules를 추출한다

### 제약사항
- 생성된 Policy는 DRAFT 상태로 시작. 사람이 리뷰 후 confirmed로 변경.
- 기존 Policy를 덮어쓰지 않는다 (--force 필요)

---

## 11.5 PM 에이전트 연동 인터페이스

### 목적
PM 에이전트가 Fugue를 자연스럽게 사용하여 프로젝트 상태를 파악하고 REQ를 관리한다.

### 요구사항
- pm-daily 워크플로우: status → audit(quick) → 블로커 REQ 목록 + 승급 제안 목록 출력
- pm-review 워크플로우: DRAFT REQ 순차 리뷰 → confirm
- `fugue agent guide --role pm` 명령: PM 에이전트 프롬프트에 삽입할 Fugue MCP 사용 가이드를 생성
- 가이드에 포함할 내용: 도구별 용도, 일반적 사용 순서, Progressive Detail 모델 설명, 예시

### 제약사항
- 기존 워크플로우 엔진을 확장한다 (신규 엔진 아님)
- PM 외 역할(dev, qa)의 프리셋은 이번 범위에서 제외

---

## 11.6 fugue verify — 회귀 감지

### 목적
REQ에 매핑된 코드가 변경되었을 때 관련 테스트 존재 여부와 재실행 필요성을 경고한다.

### 요구사항
- `fugue verify [--since <commit>]`로 변경된 파일에서 REQ를 역매핑한다
- 해당 REQ의 test_refs가 비어있으면 NO_TEST 경고
- test_refs가 있으면 TEST_NEEDED 표시 + 테스트 실행 명령 안내
- 결과 요약: "5 REQs affected, 2 NO_TEST, 3 TEST_NEEDED"
- MCP tool: `fugue_verify`

### 제약사항
- 테스트를 직접 실행하지 않는다 (경고와 안내만)
- matrix가 비어있으면 fugue sync 실행을 먼저 안내한다

---

## 11.7 decompose 품질 개선

### 목적
다양한 포맷의 계획 문서에서 일관된 품질의 REQ를 생성한다.

### 요구사항
- 문서 포맷 자동 감지: 마크다운 헤딩, 린캔버스, 태스크 체크리스트 등
- 포맷별 프롬프트 템플릿 사용
- source.section으로 원본 추적
- --dry-run으로 미리보기
- 기존 CONFIRMED REQ와 중복 시 경고

### 제약사항
- 기존 postprocess.ts 파이프라인을 확장

---

## 우선순위

| 순위 | 섹션 | 필수 여부 | 비고 |
|------|------|:---------:|------|
| P0 | 11.0 Progressive Detail 모델 | 필수 | config 스키마 + 임계치 설정 |
| P0 | 11.1 fugue sync | 필수 | L0의 기반, 이게 없으면 전체가 안 돌아감 |
| P0 | 11.2 REQ YAML 스키마 확장 | 필수 | 모든 레벨의 그릇 |
| P1 | 11.3 ai_context 자동 생성 (L2) | 필수 | SSOT 품질의 핵심 |
| P1 | 11.4 Policy 자동 생성 (L3) | 필수 | qless-docs 수준 달성 |
| P1 | 11.5 PM 연동 | 필수 | 채택의 접점 |
| P2 | 11.6 fugue verify | 개발 진행 후 | 회귀 방지 |
| P2 | 11.7 decompose 품질 | 권장 | 점진적 개선 |
