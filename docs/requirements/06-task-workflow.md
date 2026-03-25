# Task Workflow — bpro 요구사항

> 도메인: 점진적 통제 + 요청자/작업자 분리 | 항목 수: 12건

| ID | Title | Priority | Status | Description |
|---|---|---|---|---|
| BR-110 | task new | HIGH | DONE | 신규 태스크. --requester 지정 |
| BR-111 | task import | HIGH | DONE | 기획문서 연결 |
| BR-112 | 기획문서 품질 검증 | MEDIUM | DONE | task validate — conductor가 모호성/누락 체크 |
| BR-113 | task decompose | HIGH | DONE | 태스크 단위 REQ 분해 |
| BR-114 | task confirm | HIGH | DONE | 요청자 컨펌 |
| BR-115 | task assign | HIGH | DONE | 작업자 배정 (사람/에이전트) |
| BR-116 | task done | HIGH | DONE | 완료 + 자동 검증 + 리포트 |
| BR-117 | task escalate | MEDIUM | DONE | 에스컬레이션 |
| BR-120 | 요청자(owner) 필드 | HIGH | DONE | task yaml requester |
| BR-121 | 작업자(assignee) 필드 | HIGH | DONE | task yaml assignees[] |
| BR-122 | 요청자→작업자 워크플로우 | HIGH | DONE | 상태 전이 체계 |
| BR-123 | 다른 PC에서 작업 | MEDIUM | WIP | git으로 .bpro/ 공유. 전용 동기화 미구현 |
