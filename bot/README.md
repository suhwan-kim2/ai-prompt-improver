# 암표 신고 봇

매일 한 번 암표 의심 매물을 찾아 증거를 캡처해두고, 사용자가 승인한 건만
공연분야 온라인 암표신고센터 양식에 입력해주는 로컬 프로그램.

**제출은 하지 않는다.** 양식을 채운 뒤 브라우저를 띄운 채 멈춘다.
본인인증·증빙첨부·제출은 사용자가 한다. 신고는 신고인 명의로 접수되고
그 책임도 신고인이 지므로, 사람이 확인하지 않은 건은 접수되지 않는다.

## 설치

```bash
cd bot
npm install          # playwright + chromium 자동 설치
cp config.example.json config.json
```

`config.json` 에 감시할 공연을 넣는다. **정가는 예매처에서 직접 확인한 값**을
넣어야 한다. 이 값이 모든 배율 판정의 기준이고, 봇은 추측해서 채우지 않는다.

```json
{
  "watchlist": [
    {
      "eventName": "NCT 127 NEO CITY : SEOUL - THE REDLINE",
      "faceValue": 198000,
      "minRatio": 1.5,
      "keywords": ["nct127 콘서트 양도", "엔시티127 양도"]
    }
  ]
}
```

| 설정 | 뜻 | 기본값 |
|---|---|---|
| `faceValue` | 1매 정가. **필수** | — |
| `minRatio` | 이 배율 이상이면 후보로 올린다 | 1.5 |
| `maxRatio` | 이 배율을 넘으면 실제 판매가로 보지 않고 거른다 | 20 |
| `maxDetailPerRun` | 한 번 돌 때 상세 페이지를 여는 최대 건수 | 20 |
| `delayMs` | 요청 사이 대기 | 2000 |

## 사용

```bash
npm run scan     # ① 수집 (자동) — 의심 매물 + 증거 캡처
npm run review   # ② 검토 (사람) — 승인 / 제외 / 값 수정
npm run file     # ③ 입력 (자동) — 신고서 양식에 입력 후 정지
```

### ① scan

감시 목록의 키워드로 검색해 정가 대비 배율이 기준을 넘는 매물만 추린다.
**후보로 올릴 때 판매글 전체 화면을 저장한다** (`data/evidence/`) — 판매글은
금방 내려가서, 나중에 신고하려 하면 증빙을 낼 수 없는 경우가 많다.

거르는 것:
- **매수글** (`구해요`, `양도 받아요` 등) — 파는 사람이 아니라 신고 대상이 아니다.
  이런 글은 `127,127,127원` 같은 자리수 장난 가격을 올려두는 경우가 많아,
  거르지 않으면 배율이 수백 배로 튀어 후보가 오염된다
- **비정상 가격** — `maxRatio` 초과, 같은 토막이 반복되는 금액
- 기준 배율 미달, 이미 본 매물, 이미 신고한 매물

### ② review

후보를 하나씩 보여주고 판단을 받는다. `[y]` 승인 `[n]` 제외 `[s]` 보류
`[e]` 값 수정 `[q]` 중단.

좌석번호와 예매번호가 둘 다 없으면 경고한다 — 신고센터는 둘 중 하나가
특정되지 않으면 유효 접수로 처리하지 않는다.

### ③ file

브라우저를 띄워 신고서를 열고 승인된 건을 입력한다. 채운 항목은 초록
테두리로 표시된다. 입력이 끝나면 멈추고, 사용자가 제출한 뒤 `[y]` 를
누르면 신고 기록으로 옮긴다.

본인인증 세션이 매번 날아가지 않도록 브라우저 프로필을 유지한다
(`data/browser-profile/`).

**자동으로 채우는 항목 (15개)**
`TITLE` `SHOW_DT` `PAYMENT_ORG`(정가) `PAYMENT_USE`(부정거래 가격)
`INVALID_SEL_DT` `SEAT_NUMBER` `RESERVATION_NUMBER` `CONTENTS`,
`showType`(공연 종류) `paySiteTypeCd`(판매 경로) `ticketSiteCd`(예매처)
`invalidInfoCd03`(닉네임) `selInfoTypeCd04`(링크주소)

**사용자가 직접 해야 하는 것**
휴대전화 본인인증 · E-mail · 부정거래 매수 · 증빙파일 첨부 · **제출**

## 매일 자동 실행

`scan` 만 걸어두고, 검토와 입력은 시간 날 때 하면 된다.

**macOS / Linux** — `crontab -e`
```
0 21 * * * cd /path/to/bot && /usr/bin/npm run scan >> data/scan.log 2>&1
```

**Windows** — 작업 스케줄러에서 매일 실행
```
프로그램: node
인수:     src/index.js scan
시작 위치: C:\path\to\bot
```

## 한계

- 수집 대상은 번개장터다. 로그인이 필요한 앱(당근 등)은 이 방식으로 읽을 수 없다.
  그런 곳은 웹 도구(`/public/report.html`)의 북마클릿을 쓴다.
- **정가는 자동으로 못 구한다.** 판매글에 적혀 있지 않기 때문이다.
- **예매번호도 대부분 못 구한다.** 판매자에게 문의해야 나온다.
- 판매글 문구는 제각각이라 좌석·날짜 추출이 틀릴 수 있다. review 단계에서
  반드시 눈으로 확인하고, 틀리면 `[e]` 로 고친 뒤 승인한다.

## 데이터

모두 `data/` 아래 로컬에만 저장된다. 외부로 전송하지 않는다.

```
data/candidates.json   후보 (pending / approved / rejected)
data/filed.json        신고 완료 기록
data/seen.json         이미 본 매물 (중복 방지)
data/evidence/*.png    판매글 캡처
data/browser-profile/  브라우저 세션
```
