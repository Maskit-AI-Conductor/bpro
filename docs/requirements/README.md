# bpro Requirements

요구사항을 도메인별로 분리하여 관리합니다.

## 설계 원칙

1. **SLM이 처리할 수 있을 만큼 경량화** — 도메인당 10~15건 이내. 넘으면 쪼갠다.
2. **업무매뉴얼을 명확히** — 각 REQ는 1문장으로 테스트 가능해야 한다.
3. **문서가 커지면 구조화해서 쪼개기** — 89건을 한 덩어리로 던지지 않는다.
4. **무리해서 SLM 쓰지 않는다** — 퍼포먼스 유지가 목적. 고수준 판단은 LLM.

### 모델 선택 기준

| 작업 유형 | SLM | LLM | 코드만 | 이유 |
|----------|-----|-----|--------|------|
| REQ 10건 이하 분해 | O | | | 경량, 구조화된 입력 |
| REQ 30건+ 분해 | | O | | 컨텍스트 부족 |
| 기획문서 품질 검증 | | O | | 의미론적 판단 필요 |
| 코드→REQ 역설계 (파일 3-5개) | O | | | 배치로 쪼갠 단위 |
| 아키텍처 분석 (전체 구조) | | O | | 고수준 판단 |
| 감사 (파일 기반 매핑) | | | O | SLM도 불필요 |
| 상태 조회/리포트 | | | O | 순수 데이터 처리 |

### 요청자-작업자 분리

요청자와 작업자는 **다른 PC에서 작업**할 수 있다. `.bpro/`가 git에 커밋되면 양쪽에서 공유.

```
요청자 PC: bpro task new → git push
작업자 PC: git pull → bpro task show → 개발 → bpro task done → git push
요청자 PC: git pull → bpro task report 확인
```

## 도메인 목록

| # | Domain | File | Items | Task |
|---|--------|------|-------|------|
| 1 | Core Identity | 01-core-identity.md | 7 | TASK-001 |
| 2 | Snapshot & Reverse | 02-snapshot-reverse.md | 17 | TASK-002 |
| 3 | Plan & Forward | 03-plan-forward.md | 9 | TASK-003 |
| 4 | Agent Governance | 04-agent-governance.md | 9 | TASK-004 |
| 5 | Model Management | 05-model-management.md | 14 | TASK-005 |
| 6 | Task Workflow | 06-task-workflow.md | 12 | TASK-006 |
| 7 | Deliverables & Audit | 07-deliverables-audit.md | 8 | TASK-007 |
| 8 | Reporting & Notifications | 08-reporting-notifications.md | 7 | TASK-008 |
| 9 | Infra & MCP | 09-infra-mcp.md | 6 | TASK-009 |
