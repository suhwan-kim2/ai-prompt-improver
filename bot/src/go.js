/* 한 번에 전체 흐름을 돌린다: 설정 확인 → 정가 조회 → 수집 → 검토 → 신고서 입력.
 *
 * 명령을 네 개 외우게 할 이유가 없다. 각 단계는 따로도 돌릴 수 있게 남겨두되,
 * 평소에는 이것만 실행하면 된다. */
import fs from 'fs';
import { ask } from './prompt.js';
import { CONFIG_PATH, loadConfig } from './config.js';
import { refreshPrices } from './price.js';
import { scan } from './scan.js';
import { review } from './review.js';
import { fileReports } from './file.js';
import { candidates } from './store.js';

const line = (ch = '─') => console.log(ch.repeat(64));

/* 설정 파일이 없으면 손으로 JSON 을 만들게 하지 않고 물어서 만든다. */
async function setupConfig() {
  console.log('\n감시할 공연을 등록합니다. (나중에 config.json 에서 고칠 수 있습니다)\n');

  const eventName = await ask('  공연·경기명 > ');
  if (!eventName) {
    console.log('\n공연명이 필요합니다. 다시 실행해주세요.');
    return false;
  }

  console.log('\n  예매처 공연 페이지 주소를 넣으면 정가를 자동으로 읽어옵니다.');
  console.log('  (예: https://ticket.melon.com/performance/index.htm?prodId=...)');
  const ticketUrl = await ask('  예매처 주소 (없으면 그냥 엔터) > ');

  let faceValue = 0;
  if (!ticketUrl) {
    const v = await ask('  1매 정가 (숫자만) > ');
    faceValue = parseInt(String(v).replace(/[^\d]/g, ''), 10) || 0;
    if (!faceValue) {
      console.log('\n정가나 예매처 주소 중 하나는 있어야 합니다. 정가를 모르면 암표인지 판단할 수 없습니다.');
      return false;
    }
  }

  console.log('\n  중고거래 앱에서 검색할 말을 쉼표로 구분해 넣으세요.');
  const kw = await ask(`  검색 키워드 (그냥 엔터 시 "${eventName} 양도") > `);
  const keywords = kw
    ? kw.split(',').map((s) => s.trim()).filter(Boolean)
    : [`${eventName} 양도`];

  const ratio = await ask('  기준 배율 (그냥 엔터 시 1.5배) > ');

  const entry = { eventName, keywords, minRatio: parseFloat(ratio) || 1.5 };
  if (ticketUrl) entry.ticketUrl = ticketUrl;
  if (faceValue) entry.faceValue = faceValue;

  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ watchlist: [entry] }, null, 2), 'utf8');
  console.log(`\n등록했습니다 → ${CONFIG_PATH}`);
  return true;
}

export async function go() {
  line('═');
  console.log('  암표 신고 봇');
  line('═');

  // ── 설정 ────────────────────────────────────────────────
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('\n[설정] 처음 실행이네요.');
    if (!await setupConfig()) return;
  }

  let cfg = loadConfig({ requireFaceValue: false });
  console.log(`\n감시 중인 공연 ${cfg.watchlist.length}건:`);
  cfg.watchlist.forEach((w) => console.log(
    `  · ${w.eventName}` + (w.faceValue ? ` — 정가 ${w.faceValue.toLocaleString('ko-KR')}원` : ' — 정가 미확인')
  ));

  // ── 정가 ────────────────────────────────────────────────
  if (cfg.watchlist.some((w) => !w.faceValue && w.ticketUrl)) {
    console.log('\n[1/4] 예매처에서 정가를 읽어옵니다.');
    await refreshPrices();
    cfg = loadConfig({ requireFaceValue: false });
  }

  const ready = cfg.watchlist.filter((w) => w.faceValue);
  if (!ready.length) {
    console.log('\n정가를 확인한 공연이 없어 여기서 멈춥니다.');
    console.log('config.json 의 faceValue 를 채우거나 ticketUrl 을 올바른 공연 페이지로 고쳐주세요.');
    return;
  }

  // ── 수집 ────────────────────────────────────────────────
  console.log('\n[2/4] 의심 매물을 찾습니다. 잠시 걸립니다.\n');
  const { found, stats } = await scan();
  console.log(
    `\n목록 ${stats.listed}건 확인 → 상세 ${stats.detail}건 열람 → 후보 ${found.length}건\n` +
    `  제외: 기준미달 ${stats.below} · 매수글 ${stats.wanted} · 비정상가격 ${stats.joke} · 중복 ${stats.dup}`
  );

  const pending = candidates.all().filter((c) => c.status === 'pending');
  if (!pending.length) {
    console.log('\n검토할 후보가 없습니다. 오늘은 여기까지입니다.');
    return;
  }

  // ── 검토 ────────────────────────────────────────────────
  console.log(`\n[3/4] 후보 ${pending.length}건을 검토합니다.`);
  const { approved } = await review();
  if (!approved) {
    console.log('\n승인한 건이 없어 여기서 끝냅니다.');
    return;
  }

  // ── 신고서 입력 ─────────────────────────────────────────
  console.log(`\n[4/4] 승인한 ${approved}건을 신고서에 입력합니다.`);
  const goOn = await ask('  지금 신고서를 열까요? [Y/n] > ');
  if (goOn.toLowerCase() === 'n') {
    console.log('\n나중에 `npm run file` 로 이어서 할 수 있습니다.');
    return;
  }

  await fileReports();
}

/* 대화형 질문 없이 공연을 추가한다. 스케줄러나 스크립트에서 쓰기 좋고,
 * 설정 파일을 직접 편집하지 않아도 된다. */
export function addWatch({ eventName, ticketUrl, faceValue, keywords, minRatio }) {
  if (!eventName) throw new Error('공연명이 필요합니다.');
  if (!ticketUrl && !faceValue) {
    throw new Error('예매처 주소(ticketUrl) 또는 정가(faceValue) 중 하나는 필요합니다.');
  }

  const cfg = fs.existsSync(CONFIG_PATH)
    ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    : { watchlist: [] };
  if (!Array.isArray(cfg.watchlist)) cfg.watchlist = [];

  if (cfg.watchlist.some((w) => w.eventName === eventName)) {
    throw new Error(`이미 등록된 공연입니다: ${eventName}`);
  }

  const entry = {
    eventName,
    keywords: keywords && keywords.length ? keywords : [`${eventName} 양도`],
    minRatio: minRatio || 1.5
  };
  if (ticketUrl) entry.ticketUrl = ticketUrl;
  if (faceValue) entry.faceValue = faceValue;

  cfg.watchlist.push(entry);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  return entry;
}
