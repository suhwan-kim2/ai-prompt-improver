/* 승인된 건을 신고서 양식에 입력한다.
 *
 * 절대 제출하지 않는다. 브라우저를 눈에 보이게 띄우고, 입력이 끝나면 그 자리에서
 * 멈춘 채 사용자에게 넘긴다. 본인인증·증빙첨부·제출은 사용자 몫이다.
 * 신고는 신고인 명의로 접수되고 그 책임도 신고인이 진다. */
import readline from 'readline';
import { chromium } from 'playwright';
import { loadConfig, ROOT } from './config.js';
import { candidates, filed } from './store.js';
import path from 'path';

const PROFILE_DIR = path.join(ROOT, 'data', 'browser-profile');
const LIMITS = { CONTENTS: 500, TITLE: 82, ITEM: 166 };

const cut = (s, n) => (String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || ''));

function ask(q) {
  const io = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => io.question(q, (a) => { io.close(); r(a.trim()); }));
}

/** datetime-local 이 받는 'YYYY-MM-DDTHH:MM'. 불완전하면 비운다. */
function toDateTimeLocal(v) {
  const m = String(v || '').match(/(20\d{2})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return '';
  return `${m[1]}-${m[2]}-${m[3]}T${String(m[4] || '00').padStart(2, '0')}:${m[5] || '00'}`;
}

/* 신고 내용란은 500자 제한이다. 개별 항목에 이미 들어간 값은 반복하지 않고
 * 발견 경위와 의심 근거만 담는다. */
function buildContents(c) {
  const when = c.foundAt ? c.foundAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const lines = [
    `${when} 번개장터에서 '${c.eventName}' 양도글을 발견했습니다. ` +
    `정가 ${c.faceValue.toLocaleString('ko-KR')}원인 입장권을 ` +
    `${c.askPrice.toLocaleString('ko-KR')}원(정가의 ${c.ratio}배)에 판매하고 있습니다.`
  ];
  if (c.grounds && c.grounds.length) {
    lines.push('[의심 근거] ' + c.grounds.map((g) => g.replace(/\(.*?\)/g, '').trim()).join(' / '));
  }
  const text = lines.join('\n\n');
  return text.length > LIMITS.CONTENTS ? cut(text, LIMITS.CONTENTS) : text;
}

/* 페이지 안에서 각 항목을 채운다. 채운 곳은 초록 테두리로 표시해 눈으로 확인할 수 있게 한다. */
function fillForm(d) {
  const set = (id, v) => {
    const e = document.getElementById(id);
    if (!e || v === undefined || v === null || v === '') return 0;
    e.value = v;
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
    e.style.outline = '2px solid #22c55e';
    return 1;
  };
  const tick = (id) => {
    const e = document.getElementById(id);
    if (!e) return 0;
    if (!e.checked) e.click();
    if (!e.checked) { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }
    e.style.outline = '2px solid #22c55e';
    return 1;
  };

  let n = 0;
  n += set('TITLE', d.TITLE);
  n += set('SHOW_DT', d.SHOW_DT);
  n += set('PAYMENT_ORG', d.PAYMENT_ORG);
  n += set('PAYMENT_USE', d.PAYMENT_USE);
  n += set('INVALID_SEL_DT', d.INVALID_SEL_DT);
  n += set('SEAT_NUMBER', d.SEAT_NUMBER);
  n += set('RESERVATION_NUMBER', d.RESERVATION_NUMBER);
  n += set('CONTENTS', d.CONTENTS);
  if (d.showType) n += tick('showType' + d.showType);
  if (d.paySite) n += tick('paySiteTypeCd' + d.paySite);
  if (d.ticketSite) n += tick('ticketSiteCd' + d.ticketSite);
  if (d.sellerId) { n += tick('invalidInfoCd03'); n += set('invalidInfoCd03_item', d.sellerId); }
  if (d.link) { n += tick('selInfoTypeCd04'); n += set('selInfoTypeCd04_item', d.link); }
  return n;
}

export async function fileReports() {
  const cfg = loadConfig();
  const approved = candidates.all().filter((c) => c.status === 'approved');

  if (!approved.length) {
    console.log('승인된 건이 없습니다. 먼저 review 로 후보를 승인해주세요.');
    return;
  }

  console.log(`\n승인된 ${approved.length}건을 신고서에 입력합니다.`);
  console.log('브라우저가 열립니다. 입력이 끝나면 멈추니, 확인하고 직접 제출하세요.');
  console.log('본인인증·이메일·증빙첨부·제출 버튼은 봇이 건드리지 않습니다.\n');

  // 사용자 프로필을 유지해 본인인증 세션이 매번 날아가지 않게 한다.
  // 평소에는 창을 띄운다. HEADLESS=1 은 자동 검증용.
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: process.env.HEADLESS === '1',
    locale: 'ko-KR',
    viewport: { width: 1280, height: 1000 },
    args: ['--window-size=1300,1050']
  });

  try {
    for (let i = 0; i < approved.length; i++) {
      const c = approved[i];
      console.log(`\n[${i + 1}/${approved.length}] ${c.eventName} — ${c.ratio}배`);

      const page = ctx.pages()[0] || await ctx.newPage();
      await page.goto(cfg.govFormUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      // 로딩 화면이 폼을 덮으므로 보이는지가 아니라 붙었는지로 기다린다.
      await page.waitForSelector('#TITLE', { state: 'attached', timeout: 45000 });
      await page.waitForFunction(
        () => !/LOADING/.test((document.body.innerText || '').slice(0, 40)),
        null, { timeout: 30000 }
      ).catch(() => {});
      await page.waitForTimeout(1200);

      const payload = {
        TITLE: cut(c.eventName, LIMITS.TITLE),
        SHOW_DT: toDateTimeLocal(c.eventDate),
        PAYMENT_ORG: String(c.faceValue || ''),
        PAYMENT_USE: String(c.askPrice || ''),
        INVALID_SEL_DT: toDateTimeLocal((c.foundAt || '').replace('T', ' ').slice(0, 16)),
        SEAT_NUMBER: c.seat,
        RESERVATION_NUMBER: c.bookingRef,
        CONTENTS: buildContents(c),
        showType: c.showType || '1',
        paySite: c.platform || 'B',
        ticketSite: c.ticketSite || '',
        sellerId: cut(c.seller, LIMITS.ITEM),
        link: cut(c.url, LIMITS.ITEM)
      };

      const filledCount = await page.evaluate(fillForm, payload);
      console.log(`  ${filledCount}개 항목 입력 완료 (초록 테두리).`);

      const todo = ['휴대전화 본인인증', 'E-mail', '부정거래 매수', '증빙파일 첨부'];
      if (!payload.SHOW_DT) todo.push('공연일시');
      if (!payload.RESERVATION_NUMBER && !payload.SEAT_NUMBER) todo.push('좌석번호 또는 예매번호');
      if (!payload.ticketSite) todo.push('예매처');
      console.log(`  직접 입력해야 할 항목: ${todo.join(', ')}`);
      console.log(`  증거 캡처: ${c.evidence}`);

      const a = await ask('\n  제출을 마쳤으면 [y], 이 건을 건너뛰려면 [s], 전체 중단은 [q] > ');
      if (a.toLowerCase() === 'y') {
        candidates.remove(c.id);
        filed.add({ ...c, status: 'filed', filedAt: new Date().toISOString() });
        console.log('  신고 기록에 저장했습니다.');
      } else if (a.toLowerCase() === 'q') {
        console.log('  중단합니다. 남은 건은 승인 상태로 남아 있습니다.');
        break;
      }
    }
  } finally {
    await ctx.close();
  }
}
