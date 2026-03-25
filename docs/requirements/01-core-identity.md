# Core Identity — bpro 요구사항

> 도메인: 핵심 정체성 | 항목 수: 7건

| ID | Title | Priority | Status | Description |
|---|---|---|---|---|
| BR-001 | 모델 비종속 아키텍처 | HIGH | DONE | 어떤 LLM/SLM이든 어댑터로 연결. 플랫폼 락인 없음 |
| BR-002 | SLM 퍼스트 설계 | HIGH | DONE | 기본값=SLM, 고수준 판단만 LLM. 무리해서 SLM 쓰지 않음 |
| BR-003 | CLI 도구 (터미널 명령어) | HIGH | DONE | git처럼 비대화형 CLI. Commander.js 기반 |
| BR-004 | MCP 서버 (프로토콜 레이어) | HIGH | TODO | Claude Code/Cursor/Codex에서 @이름으로 호출 가능 |
| BR-005 | git처럼 밑에 깔리는 도구 | MEDIUM | DONE | .bpro/ 디렉토리. 어떤 AI 도구를 쓰든 상관없이 동작 |
| BR-006 | AI의 관리자 (AI PMO) | HIGH | DONE | bpro는 코드를 안 짬. 에이전트가 만든 것을 관리 |
| BR-007 | 사이드프로젝트→프로덕션 | HIGH | WIP | 핵심 비전. 역설계+감리+추적성으로 프로덕션 품질 확보 |
