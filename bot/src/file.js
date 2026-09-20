/* 승인된 건을 신고서에 넣을 수 있도록 넘겨준다.
 *
 * 자동화 브라우저를 띄우지 않는다. 한국 본인인증(PASS 등)은 자동화된 브라우저를
 * 막는 경우가 많아 그 창에서는 인증을 끝낼 수 없다. 대신 사용자의 평소
 * 브라우저로 신고서를 열고, 값은 클립보드 + 북마클릿으로 넣는다.
 * 인증·첨부·제출은 그 브라우저에서 사용자가 한다. */
import fs from 'fs';
import path from 'path';
import { ask } from './prompt.js';
import { loadConfig, ROOT } from './config.js';
import { candidates, filed } from './store.js';
import { copyToClipboard, openInBrowser } from './clipboard.js';
import { bookmarkletPage } from './filler.js';

const LIMITS = { CONTENTS: 500, TITLE: 82, ITEM: 166 };
const BOOKMARKLET_PATH = path.join(ROOT, 'bookmarklet.html');

const cut = (s, n) => (String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || ''));

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

function buildPayload(c) {
  const skipped = ['휴대전화 본인인증', 'E-mail', '부정거래 매수', '증빙파일 첨부'];
  const showDt = toDateTimeLocal(c.eventDate);
  const link = /^https?:\/\//i.test(c.url || '') ? cut(c.url, LIMITS.ITEM) : '';

  if (!showDt) skipped.push('공연일시');
  if (!c.seat && !c.bookingRef) skipped.push('좌석번호 또는 예매번호');
  if (!c.ticketSite) skipped.push('예매처');
  if (!c.seller) skipped.push('판매자 정보(ID/닉네임 등)');
  if (!link) skipped.push('링크주소(필수)');

  return {
    v: 1,
    TITLE: cut(c.eventName, LIMITS.TITLE),
    SHOW_DT: showDt,
    PAYMENT_ORG: String(c.faceValue || ''),
    PAYMENT_USE: String(c.askPrice || ''),
    INVALID_SEL_DT: toDateTimeLocal((c.foundAt || '').replace('T', ' ').slice(0, 16)),
    SEAT_NUMBER: c.seat,
    RESERVATION_NUMBER: c.bookingRef,
    CONTENTS: buildContents(c),
    showType: c.showType || '1',
    paySite: c.platform || 'B',
    ticketSite: c.ticketSite || '',
    ticketSiteText: c.ticketSiteText || '',
    sellerId: cut(c.seller, LIMITS.ITEM),
    link,
    _skipped: skipped
  };
}

/* 북마클릿 설치 페이지는 매번 최신으로 덮어쓴다. 채우기 코드가 바뀌었는데
 * 예전 파일이 남아 있으면 옛 코드를 북마크에 담게 된다. */
function writeBookmarkletPage() {
  fs.writeFileSync(BOOKMARKLET_PATH, bookmarkletPage(), 'utf8');
  return BOOKMARKLET_PATH;
}

export async function fileReports() {
  const cfg = loadConfig();
  const approved = candidates.all().filter((c) => c.status === 'approved');

  if (!approved.length) {
    console.log('승인된 건이 없습니다. 먼저 review 로 후보를 승인해주세요.');
    return;
  }

  const page = writeBookmarkletPage();
  console.log(`\n승인된 ${approved.length}건을 신고서에 넣을 준비를 합니다.`);
  console.log('형이 평소 쓰는 브라우저에서 진행합니다 — 본인인증(PASS)이 거기서만 제대로 됩니다.\n');
  console.log('처음이라면 북마클릿부터 설치하세요 (한 번만):');
  console.log(`  ${page}`);
  console.log('  이 파일을 브라우저로 열고 「신고서 채우기」 버튼을 북마크 바로 드래그하면 됩니다.');

  const openIt = await ask('\n  북마클릿 설치 페이지를 지금 열까요? [y/N] > ');
  if (openIt.toLowerCase() === 'y') openInBrowser('file://' + page);

  for (let i = 0; i < approved.length; i++) {
    const c = approved[i];
    const payload = buildPayload(c);
    const json = JSON.stringify(payload);

    console.log('\n' + '─'.repeat(64));
    console.log(`[${i + 1}/${approved.length}] ${c.eventName} — 정가의 ${c.ratio}배`);
    console.log('─'.repeat(64));
    console.log(`  정가      ${c.faceValue.toLocaleString('ko-KR')}원`);
    console.log(`  요구 금액  ${c.askPrice.toLocaleString('ko-KR')}원`);
    console.log(`  좌석번호   ${c.seat || '(없음)'}`);
    console.log(`  판매자    ${c.seller || '(없음)'}`);
    console.log(`  증거 캡처  ${c.evidence}`);
    console.log(`  직접 입력  ${payload._skipped.join(', ')}`);

    if (await copyToClipboard(json)) {
      console.log('\n  ✔ 폼 데이터를 클립보드에 복사했습니다.');
    } else {
      console.log('\n  클립보드 복사에 실패했습니다. 아래 한 줄을 직접 복사하세요:\n');
      console.log('  ' + json + '\n');
    }

    console.log('\n  1) 신고서 페이지를 연다');
    console.log('  2) 북마크 바의 「신고서 채우기」를 누른다');
    console.log('  3) 본인인증 → 증거 캡처 첨부 → 제출');

    const open = await ask('\n  신고서 페이지를 열까요? [Y/n] > ');
    if (open.toLowerCase() !== 'n') openInBrowser(cfg.govFormUrl);

    const done = await ask('  제출을 마쳤으면 [y], 건너뛰려면 [s], 전체 중단은 [q] > ');
    if (done.toLowerCase() === 'y') {
      candidates.remove(c.id);
      filed.add({ ...c, status: 'filed', filedAt: new Date().toISOString() });
      console.log('  신고 기록에 저장했습니다.');
    } else if (done.toLowerCase() === 'q') {
      console.log('  중단합니다. 남은 건은 승인 상태로 남아 있습니다.');
      break;
    }
  }
}
