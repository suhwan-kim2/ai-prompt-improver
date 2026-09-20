#!/usr/bin/env node
/* 암표 신고 봇 CLI.
 *
 * scan   : 감시 목록을 돌며 의심 매물을 모으고 증거를 캡처한다 (자동)
 * review : 후보를 하나씩 보여주고 승인/제외를 받는다 (사람)
 * file   : 승인된 건을 신고서 양식에 입력하고 멈춘다 (자동 입력 + 사람이 제출)
 * daily  : scan 만 돌린다. 스케줄러에 걸어두는 용도.
 */
import { scan } from './scan.js';
import { review } from './review.js';
import { fileReports } from './file.js';
import { refreshPrices } from './price.js';
import { go, addWatch } from './go.js';
import { closePrompt } from './prompt.js';
import { candidates, filed } from './store.js';

function summary() {
  const all = candidates.all();
  const by = (s) => all.filter((c) => c.status === s).length;
  console.log(`\n현재 상태  대기 ${by('pending')} · 승인 ${by('approved')} · 제외 ${by('rejected')} · 신고완료 ${filed.all().length}`);
}

async function main() {
  const cmd = process.argv[2] || 'go';

  try {
    if (cmd === 'go') {
      await go();
    } else if (cmd === 'scan' || cmd === 'daily') {
      console.log(`[${new Date().toLocaleString('ko-KR')}] 스캔 시작`);
      const { found, stats } = await scan();
      console.log(
        `\n스캔 완료: 목록 ${stats.listed}건 확인 → 상세 ${stats.detail}건 열람 → ` +
        `후보 ${found.length}건 추가\n  제외: 기준미달 ${stats.below} · 매수글 ${stats.wanted} · ` +
        `비정상가격 ${stats.joke} · 중복 ${stats.dup} · 가격없음 ${stats.noPrice}`
      );
      summary();
      if (found.length) console.log('\n다음: npm run review');
    } else if (cmd === 'add') {
      const eventName = process.argv[3];
      const second = process.argv[4] || '';
      const entry = addWatch({
        eventName,
        ticketUrl: /^https?:\/\//.test(second) ? second : '',
        faceValue: /^[\d,]+$/.test(second) ? parseInt(second.replace(/,/g, ''), 10) : 0
      });
      console.log('등록했습니다:', entry.eventName);
      console.log('  검색 키워드:', entry.keywords.join(', '));
      console.log(entry.ticketUrl
        ? '  정가는 다음 실행 때 예매처에서 읽어옵니다.'
        : `  정가: ${entry.faceValue.toLocaleString('ko-KR')}원`);
    } else if (cmd === 'price') {
      console.log('예매처에서 좌석 등급별 정가를 읽어옵니다.\n');
      await refreshPrices();
    } else if (cmd === 'review') {
      await review();
      summary();
    } else if (cmd === 'file') {
      await fileReports();
      summary();
    } else if (cmd === 'status') {
      summary();
    } else {
      console.log(`암표 신고 봇

  npm start        전체 과정을 한 번에 (설정 → 정가 → 수집 → 검토 → 입력)

  공연 추가 (설정 파일을 직접 고치지 않아도 됩니다):
  node src/index.js add "공연명" "예매처주소"
  node src/index.js add "공연명" 154000

  낱개로 돌리고 싶을 때:
  npm run price    예매처에서 등급별 정가를 읽어 config.json 에 기록
  npm run scan     감시 목록을 돌며 의심 매물 수집 + 증거 캡처
  npm run review   후보를 검토해 승인/제외
  npm run file     승인된 건을 신고서에 입력 (제출은 직접)
  node src/index.js status   현재 상태

  설정: config.json (config.example.json 참고)
  공연을 추가하면 price → scan → review → file 순서로 돌리면 됩니다.`);
    }
  } catch (e) {
    console.error('\n오류:', e.message);
    process.exitCode = 1;
  } finally {
    closePrompt();
  }
}

main();
