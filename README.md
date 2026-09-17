# 프롬프트 개선기 MVP

## 사용법
1) 이 저장소를 Vercel에 연결 후 배포
2) `/public/index.html` 접속 → 초기 프롬프트 입력 → 질문 1~2개씩 답변
3) 의도/프롬프트 점수 모두 95 이상이면 최종 프롬프트 + MCP JSON 노출
4) "MCP로 전달" 버튼 → /api/mcp 에 POST (데모 echo)

## 암표 신고 도우미 (`/public/report.html`)
판매글 정보를 입력하면 정가 대비 배율을 계산하고 채널별 신고문을 자동으로 작성해주는 도구.

- 입력 → 자동 분석(웃돈/배율/신고 적합도) → 채널 선택 → 신고문 생성 → 복사 → 기록 저장
- 신고 채널: 플랫폼·예매처 / KOPIS 공연 암표 신고 / 경찰 ECRM / 국민신문고 (채널별 템플릿 상이)
- 기록은 `localStorage`에만 저장. 서버 전송·외부 API 호출 없음. CSV 내보내기 지원
- 가드레일: 필수 항목 검증, 사실 확인 체크 전 생성 차단, 동일 대상 중복 신고 경고, 증거 미첨부 경고, 정가 이하 양도 시 신고 대상 아님 안내
- **자동 제출 기능은 의도적으로 넣지 않았음.** 제출은 사용자가 각 창구에서 직접 한다.

## 구조
- /api/_helpers.js       : 공통 JSON 파서(버그 방지)
- /api/config.js         : 기본 설정(슬롯/체크리스트/라우팅)
- /api/score/intent.js   : 의도 점수 계산(슬롯 충족도)
- /api/score/prompt.js   : 프롬프트 점수 계산(체크리스트)
- /api/questions.js      : 부족 슬롯 기반 질문 1~2개
- /api/mcp.js            : 컷오프(95/95) 통과시 중계(echo)
- /public/*              : 정적 UI
- /public/report.*       : 암표 신고 도우미 (독립 페이지, API 불필요)
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


git add .
git commit -m "환경변수 재설정 후 재배포"
git push
