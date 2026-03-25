# Snapshot & Reverse — bpro 요구사항

> 도메인: 역설계 + Snapshot 고급 옵션 | 항목 수: 17건

| ID | Title | Priority | Status | Description |
|---|---|---|---|---|
| BR-010 | 코드→REQ 역설계 | HIGH | DONE | conductor가 분석 후 에이전트가 REQ 추출 |
| BR-011 | 테스트 문서 자동 생성 | MEDIUM | TODO | snapshot 시 REQ별 테스트 케이스 초안 |
| BR-012 | E2E 추적성 매트릭스 | HIGH | DONE | matrix.yaml 자동 생성 |
| BR-013 | 파일 배치 처리 | HIGH | DONE | MAX_BATCH_CHARS 기반 청크 분할 |
| BR-014 | scan include/exclude | MEDIUM | DONE | config.yaml의 scan 섹션 |
| BR-070 | staging area | HIGH | DONE | review → apply/discard |
| BR-071 | --clean 옵션 | MEDIUM | DONE | DRAFT 삭제 후 새로 분석 |
| BR-072 | --append 옵션 | MEDIUM | TODO | 기존 유지 + 새 것만 추가 |
| BR-073 | --keep-confirmed | MEDIUM | DONE | CONFIRMED 이상 보호 |
| BR-074 | --dry-run | MEDIUM | TODO | 저장 없이 미리보기 |
| BR-075 | --stash | LOW | TODO | 임시 저장 후 새로 분석 |
| BR-076 | --pick | MEDIUM | TODO | 특정 REQ만 선택 채택 |
| BR-077 | PROTECTED 상태 | HIGH | DONE | snapshot으로 덮어쓰기 방지 |
| BR-078 | 작업계획+프로그레스바 | MEDIUM | DONE | 4단계 + 경과 시간 |
| BR-079 | 도메인 병렬 처리 | LOW | TODO | 독립 도메인 동시 분석 |
| BR-080 | 예상 소요시간 | LOW | TODO | 남은 시간 추정 |
| BR-081 | 대형 레포 청크 처리 | HIGH | WIP | 파일 제한 있으나 디렉토리 단위 미구현 |
