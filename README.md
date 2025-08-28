# 프롬프트 개선기 MVP

## 사용법
1) 이 저장소를 Vercel에 연결 후 배포
2) `/public/index.html` 접속 → 초기 프롬프트 입력 → 질문 1~2개씩 답변
3) 의도/프롬프트 점수 모두 95 이상이면 최종 프롬프트 + MCP JSON 노출
4) "MCP로 전달" 버튼 → /api/mcp 에 POST (데모 echo)

## 구조
- /api/_helpers.js       : 공통 JSON 파서(버그 방지)
- /api/config.js         : 기본 설정(슬롯/체크리스트/라우팅)
- /api/score/intent.js   : 의도 점수 계산(슬롯 충족도)
- /api/score/prompt.js   : 프롬프트 점수 계산(체크리스트)
- /api/questions.js      : 부족 슬롯 기반 질문 1~2개
- /api/mcp.js            : 컷오프(95/95) 통과시 중계(echo)
- /public/*              : 정적 UI
- /utils/*               : 룰/정규식 기반 엔진

## ENV (선택)
MCP_IMAGE=...
MCP_VIDEO=...
MCP_DEV=...

## 개발 메모
- ESM(ES Module) 기반. Node 18 런타임.
- 클라이언트/서버 모두 fetch 사용.
- req.body undefined 문제 → /api/_helpers.js 의 readJson 사용으로 해결.

<!-- 재배포 트리거 -->
