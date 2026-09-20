/* 후보를 하나씩 보여주고 사용자가 판단하게 한다.
 * 승인한 건만 신고서 입력 대상이 된다 — 봇이 알아서 넘기지 않는다. */
import { ask } from './prompt.js';
import { candidates } from './store.js';

const won = (n) => Number(n || 0).toLocaleString('ko-KR') + '원';

/* 5nn·800번대·n열처럼 가려 적은 좌석은 좌석이 특정되지 않은 것으로 본다.
 * 신고센터는 좌석번호나 예매번호가 특정되어야 유효 접수로 처리한다. */
function isSeatVague(seat) {
  const v = String(seat || '');
  if (!v) return false;
  return /[nN]{1,2}\s*번?대?|\d00\s*번대|[nN]{1,2}\s*열|[*x✕]/.test(v);
}

function show(c, i, total) {
  console.log('\n' + '─'.repeat(72));
  console.log(`[${i + 1}/${total}]  ${c.eventName}`);
  console.log('─'.repeat(72));
  console.log(`  정가      ${won(c.faceValue)}`);
  console.log(`  요구 금액  ${won(c.askPrice)}   →  정가의 ${c.ratio}배`);
  console.log(`  공연일시   ${c.eventDate || '(미확인)'}`);
  console.log(`  좌석번호   ${c.seat || '(미확인)'}`);
  console.log(`  예매번호   ${c.bookingRef || '(미확인)'}`);
  console.log(`  판매자    ${c.seller || '(미확인)'}`);
  console.log(`  주소      ${c.url}`);
  if (c.signals && c.signals.length) console.log(`  정황      ${c.signals.join(', ')}`);
  console.log(`  증거캡처   ${c.evidence}`);
  if (c.warnings && c.warnings.length) {
    c.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }
  console.log(`\n  판매글 내용:\n    ${c.excerpt.slice(0, 260)}`);

  if (!c.seat && !c.bookingRef) {
    console.log('\n  ✗ 좌석번호도 예매번호도 없습니다. 이대로는 신고센터가 유효 접수로 처리하지 않습니다.');
  } else if (isSeatVague(c.seat) && !c.bookingRef) {
    console.log(`\n  ✗ 좌석번호가 "${c.seat}" 로 가려져 있어 좌석이 특정되지 않습니다.`);
    console.log('    이대로 내면 반려될 가능성이 큽니다. 판매자에게 물어 예매번호를 받거나,');
    console.log('    번개장터 앱 안의 신고 기능으로 게시글을 내리는 쪽이 빠릅니다.');
  }
}

export async function review() {
  const list = candidates.all().filter((c) => c.status === 'pending');

  if (!list.length) {
    console.log('검토할 후보가 없습니다. 먼저 scan 을 돌려주세요.');
    return { approved: 0, rejected: 0 };
  }

  console.log(`\n검토할 후보 ${list.length}건.`);
  console.log('판매글을 직접 열어 눈으로 확인한 뒤 판단하세요. 확인 없이 승인하면 허위신고가 될 수 있습니다.');

  let approved = 0;
  let rejected = 0;

  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    show(c, i, list.length);

    let done = false;
    while (!done) {
      const a = (await ask('\n  [y] 승인  [n] 제외  [s] 보류  [e] 값 수정  [q] 그만  > ')).toLowerCase();

      if (a === 'y') {
        const noSeat = !c.seat && !c.bookingRef;
        const vague = isSeatVague(c.seat) && !c.bookingRef;
        if (noSeat || vague) {
          const why = noSeat ? '좌석·예매번호가 없어' : '좌석번호가 특정되지 않아';
          const go = await ask(`  ${why} 반려될 가능성이 큽니다. 그래도 승인할까요? [y/N] `);
          if (go.toLowerCase() !== 'y') continue;
        }
        candidates.update(c.id, { status: 'approved', approvedAt: new Date().toISOString() });
        approved++; done = true;
      } else if (a === 'n') {
        candidates.update(c.id, { status: 'rejected' });
        rejected++; done = true;
      } else if (a === 's') {
        done = true;
      } else if (a === 'e') {
        const fields = [
          ['eventName', '공연명'], ['eventDate', '공연일시(YYYY-MM-DD HH:MM)'],
          ['seat', '좌석번호'], ['bookingRef', '예매번호'],
          ['seller', '판매자'], ['faceValue', '정가(숫자)'], ['askPrice', '요구금액(숫자)']
        ];
        const patch = {};
        for (const [key, label] of fields) {
          const v = await ask(`    ${label} [${c[key] || ''}] > `);
          if (v) patch[key] = /^(faceValue|askPrice)$/.test(key) ? Number(v.replace(/[^\d]/g, '')) : v;
        }
        if (patch.faceValue || patch.askPrice) {
          const face = patch.faceValue || c.faceValue;
          const askP = patch.askPrice || c.askPrice;
          patch.ratio = Number((askP / face).toFixed(2));
        }
        Object.assign(c, patch);
        candidates.update(c.id, patch);
        show(c, i, list.length);
      } else if (a === 'q') {
        console.log(`\n중단합니다. 승인 ${approved}건, 제외 ${rejected}건.`);
        return { approved, rejected };
      }
    }
  }

  console.log(`\n검토 완료. 승인 ${approved}건, 제외 ${rejected}건.`);
  if (approved) console.log('다음: npm run file  — 신고서를 열어 항목을 입력합니다.');
  return { approved, rejected };
}
