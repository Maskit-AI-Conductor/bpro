# Fugue 유저 시나리오

> 작성일: 2026-04-03
> 상태: DRAFT — cs-agent, qless console 적용 후 보정 예정
> 목적: "Fugue를 어떻게 쓰는가"를 역할별/상황별로 정의

---

## 일상 명령어 요약

일상에서 쓰는 명령은 3개다. 나머지는 프로젝트 시작 시 1회 또는 fugue가 제안할 때만 쓴다.

| 명령 | 누가 | 빈도 | 하는 일 |
|------|------|------|---------|
| `fugue sync` | PM / 개발자 | 주 1~2회 | 커밋→매트릭스 자동 동기화 + 승급 제안 |
| `fugue workflow run pm-daily` | PM | 매일 | 진행 현황 + 블로커 + 승급 제안 한눈에 |
| `fugue verify` | PM / 개발자 | 기능 완료 시 | 변경된 REQ의 테스트 커버리지 경고 |

---

## 역할 정의

| 역할 | 설명 | Fugue 사용 빈도 |
|------|------|----------------|
| **CEO** | 계획 문서 작성, REQ 리뷰/confirm, 전략 판단 | 프로젝트 시작 + 리뷰 시 |
| **PM 에이전트** | REQ 관리, 진행 추적, 블로커 식별 | 매일 |
| **개발 에이전트** | 코드 작성, 커밋에 REQ-ID 태깅 | 커밋 시 (fugue 명령 불필요) |
| **Fugue 자체** | 동기화, 승급 제안, 자동 생성 | 자동 (sync 트리거 시) |

---

## 시나리오 A: 신규 프로젝트 착수 (cs-agent)

> 정책/계획이 먼저, 코드가 나중

### A-1. 프로젝트 초기화 (CEO, 1회)

```bash
cd cs-agent
fugue init                    # .fugue/ 생성, CLAUDE.md 스캐폴드 제안
fugue plan import docs/lean-canvas-2026-03-04.md
fugue plan import docs/mvp-milestones-2026-03-04.md
```

결과:
- .fugue/ 디렉토리 생성
- 계획 문서 임포트 완료
- "에이전트 갭: QA 에이전트가 없습니다" 같은 권고 출력 (승인 시 프롬프트 자동 생성)

### A-2. 요구사항 분해 (CEO, 1회)

```bash
fugue task new "M1 MVP" --requester CEO
fugue task import TASK-001 docs/mvp-milestones-2026-03-04.md
fugue task decompose TASK-001
```

결과:
- REQ-CS-001 ~ REQ-CS-040 생성 (L1 수준)
- 도메인별 자동 분류 (AUTH, CHAT, API, WIDGET, BO)

### A-3. 리뷰 & 확정 (CEO, 1회)

```bash
fugue task confirm TASK-001   # 또는 리뷰 문서를 보고 판단 후
```

결과:
- DRAFT → CONFIRMED 전환
- 추적 매트릭스 초기화

### A-4. 개발 진행 (에이전트, 매일)

에이전트는 fugue 명령을 치지 않는다. 커밋 메시지에 REQ-ID만 넣는다.

```bash
git commit -m "feat: 챗봇 위젯 초기 렌더링 (REQ-CS-015)"
git commit -m "feat: Supabase 스키마 정의 (REQ-CS-003, REQ-CS-004)"
git commit -m "fix: OTP 검증 타임아웃 (REQ-CS-022)"
```

### A-5. 주간 동기화 (PM, 주 1~2회)

```bash
fugue sync
```

출력 예시:
```
✔ 8 REQs synced, 23 code_refs added, 5 test_refs added

  승급 제안:
  ⬆ REQ-CS-015 → L2 권장 (code_refs: 7개, 임계치: 5)
  ⬆ REQ-CS-003 → L2 권장 (code_refs: 6개, 임계치: 5)
```

PM이 판단:
```bash
fugue enrich REQ-CS-015       # 수락 → ai_context 자동 생성
# REQ-CS-003은 아직 이르다고 판단 → 무시 (dismiss)
```

### A-6. 매일 아침 현황 (PM, 매일)

```bash
fugue workflow run pm-daily
```

출력 예시:
```
  프로젝트: cs-agent  |  M1 MVP  |  진행률: 35%

  상태별 REQ:
  ■■■■■■■░░░░░░░░░░░░░  DONE 14 / TOTAL 40

  블로커:
  ⚠ REQ-CS-022: Supabase RLS 정책 미정의 (DEV 3일 경과)

  승급 대기:
  ⬆ REQ-CS-003: L2 권장 (지난 sync에서 제안, 미처리)
```

### A-7. 기능 완료 확인 (PM, 기능 완료 시)

```bash
fugue verify --since v0.1.0
```

출력 예시:
```
  5 REQs affected by recent changes

  ✅ REQ-CS-015: 3 tests mapped
  ⚠  REQ-CS-003: NO_TEST — 테스트 없음
  ⚠  REQ-CS-004: NO_TEST — 테스트 없음
  ✅ REQ-CS-022: 1 test mapped
  ✅ REQ-CS-030: 2 tests mapped

  권장: REQ-CS-003, REQ-CS-004에 테스트 추가
```

---

## 시나리오 B: 기존 프로젝트에 기능 추가 (qless console)

> 코드가 먼저 있고, 기능을 추가하는 상황

### B-1. 프로젝트 초기화 (PM, 1회)

```bash
cd maskit-qless-service-v2
fugue init                    # 기존 코드 구조 감지
```

기존 코드가 있으므로 fugue가 제안:
```
  기존 소스 파일 247개 감지.
  ? 역공학 스냅샷을 실행하시겠습니까? (기존 코드에서 REQ 추출)
    > 예 — fugue snapshot 실행
      아니오 — 신규 REQ만 관리
```

### B-2. 신규 기능 작업 등록 (PM, 기능 시작 시)

```bash
fugue task new "경영 대시보드 MVP" --requester CEO
fugue task import TASK-001 apps/console/docs/TASKS.md
fugue task decompose TASK-001
```

결과:
- REQ-DASH-001 ~ REQ-DASH-015 생성
- 기존 코드의 REQ와 분리 관리

### B-3. 이후 흐름은 시나리오 A와 동일

- 에이전트가 커밋에 REQ-ID 태깅
- PM이 주간 sync
- 복잡도 쌓이면 자동 승급 제안

### B-4. Policy 자동 생성 (복잡한 REQ만, fugue 제안 시)

대시보드 API가 복잡해져서 fugue가 L3를 제안한 경우:

```bash
fugue policy generate REQ-DASH-003
```

결과:
- `.fugue/policies/dash/dashboard-api.md` 생성 (DRAFT)
- 내용: frontmatter + 비즈니스 규칙(조건→행동→결과) + 코드 스니펫
- PM이 리뷰 후 confirmed
- 이후 이 영역 수정 시 에이전트가 Policy를 SSOT로 참조

---

## 시나리오 C: 버그 수정 (최소 마찰)

> 가장 작은 단위의 작업. Fugue 명령을 칠 필요 없음.

```bash
git commit -m "fix: 날짜 포맷 오류 (REQ-DASH-007)"
```

끝. 다음 `fugue sync` 때 자동으로 code_refs에 반영된다.

만약 REQ-ID를 모르거나 없는 버그면:

```bash
git commit -m "fix: 날짜 포맷 오류"
```

이것도 괜찮다. REQ-ID 없는 커밋은 무시된다. 나중에 관련 REQ에 수동 매핑하거나, 그냥 두어도 된다.

---

## 시나리오 D: 정책 문서가 먼저 있는 경우 (역방향)

> qless-docs처럼 이미 상세한 정책 문서가 있는 프로젝트

```bash
fugue policy import docs/policies/auth/authentication-flow.md
```

결과:
- Policy에서 REQ YAML 자동 추출
- ai_context 자동 채움
- detail_level = 3으로 시작
- 이후 코드 작성 시 커밋에 REQ-ID 태깅하면 code_refs 자동 연결

---

## Progressive Detail 자동 흐름 요약

```
커밋에 REQ-ID 태깅 (개발자/에이전트)
       │
       ▼
fugue sync (PM, 주 1~2회)
       │
       ├── code_refs/test_refs 자동 매핑
       │
       ├── code_refs < 5개 → L1 유지 (추가 작업 없음)
       │
       ├── code_refs ≥ 5개 → "L2 권장" 제안
       │         │
       │         ├── PM 수락 → fugue enrich → ai_context 생성
       │         └── PM 거부 → 무시, 다음 sync에서 다시 제안하지 않음
       │
       └── code_refs ≥ 10개 또는 cross-ref 3+ → "L3 권장" 제안
                 │
                 ├── PM 수락 → fugue policy generate → Policy MD 생성
                 └── PM 거부 → 무시
```

---

## 안티패턴 (하면 안 되는 것)

| 안티패턴 | 왜 안 되는가 | 대신 이렇게 |
|---------|-------------|-----------|
| 모든 REQ에 Policy 작성 강제 | 작은 일에서 마찰 → 채택 죽음 | L0~L1으로 시작, 복잡해지면 자동 승급 |
| sync 없이 code_refs 수동 관리 | 안 하게 됨 → 매트릭스 부패 | 커밋에 REQ-ID만 넣고 sync에 맡김 |
| 매 커밋마다 fugue 명령 실행 | 개발 흐름 방해 | 커밋은 git만, sync는 주 1~2회 |
| REQ-ID 없이 전체 개발 | 추적 불가 → Fugue 무용 | 최소한 기능 단위 커밋에는 REQ-ID 태깅 |
| ai_context를 사람이 처음부터 작성 | 시간 낭비 | fugue enrich가 초안 생성 → 사람이 검토 |

---

## 보정 계획

이 문서는 cs-agent, qless console에 실제 적용하면서 다음을 보정한다:

- [ ] sync 빈도: 주 1~2회가 적절한가? 매 PR 머지 시가 나은가?
- [ ] L2 임계치(5개): 너무 낮거나 높지 않은가?
- [ ] L3 임계치(10개): Policy가 필요한 실제 복잡도와 맞는가?
- [ ] pm-daily 워크플로우: PM이 실제로 매일 쓰는가? 어떤 정보가 더 필요한가?
- [ ] 에이전트의 REQ-ID 태깅 습관: 프롬프트에 어떻게 넣어야 자연스러운가?
- [ ] dismiss한 승급 제안: 다시 제안하지 않는 게 맞는가? 일정 기간 후 재제안?
