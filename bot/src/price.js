/* 예매처 공연 페이지에서 좌석 등급별 정가를 읽어온다.
 *
 * 정가는 모든 배율 판정의 기준이라 틀리면 신고 자체가 틀어진다. 그래서
 * 봇이 찾아오되 config.json 에 기록해 사용자가 눈으로 확인할 수 있게 하고,
 * 공연명이 엉뚱하게 잡히지 않도록 검색이 아니라 사용자가 준 공연 페이지
 * 주소에서만 읽는다. */
import fs from 'fs';
import { chromium } from 'playwright';
import { loadConfig, CONFIG_PATH } from './config.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/* 예매처 페이지는 가격을 늦게 그린다. networkidle 로 기다려야 안정적으로 잡힌다
 * (domcontentloaded 로는 네 번 연속 빈 페이지였다). */
export async function lookupPrices(ticketUrl) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      locale: 'ko-KR', userAgent: UA, viewport: { width: 1280, height: 1000 }
    });
    await page.goto(ticketUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    return await page.evaluate(() => {
      const lines = (document.body.innerText || '').split('\n')
        .map((s) => s.trim()).filter(Boolean);

      const grades = [];
      lines.forEach((line, i) => {
        const m = line.match(/^([\d,]{5,})\s*원$/);
        if (!m) return;
        const price = parseInt(m[1].replace(/,/g, ''), 10);
        // 등급명은 금액 바로 앞 줄에 온다. 앞 줄이 또 금액이면 등급이 아니다.
        const label = lines[i - 1] || '';
        if (/^[\d,]{5,}\s*원$/.test(label)) return;
        if (!/석|席|STANDING|SEATED|VIP|R석|S석|A석|지정|스탠딩/i.test(label)) return;
        grades.push({ grade: label.slice(0, 40), price });
      });

      // 같은 등급명이 반복되면 한 번만 남긴다.
      const seen = new Set();
      return grades.filter((g) => {
        const key = g.grade + ':' + g.price;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
  } finally {
    await browser.close();
  }
}

/** 판매글 문구에 맞는 등급의 정가를 고른다. 맞는 게 없으면 가장 비싼 등급을 쓴다
 *  — 배율이 작게 나와 과장 신고를 피하는 쪽이 안전하다. */
export function pickFaceValue(grades, listingText) {
  if (!grades || !grades.length) return 0;
  const text = String(listingText || '').toUpperCase();

  if (/VIP/.test(text)) {
    const vip = grades.filter((g) => /VIP/i.test(g.grade));
    if (vip.length) return Math.max(...vip.map((g) => g.price));
  }
  return Math.max(...grades.map((g) => g.price));
}

export async function refreshPrices() {
  const cfg = loadConfig({ requireFaceValue: false });
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  let changed = 0;

  for (let i = 0; i < cfg.watchlist.length; i++) {
    const w = cfg.watchlist[i];
    if (!w.ticketUrl) {
      console.log(`  · ${w.eventName}\n      ticketUrl 이 없어 건너뜁니다. 예매처 공연 페이지 주소를 넣어주세요.`);
      continue;
    }

    console.log(`  · ${w.eventName}`);
    try {
      const grades = await lookupPrices(w.ticketUrl);
      if (!grades.length) {
        console.log('      가격을 찾지 못했습니다. 페이지 주소를 확인하거나 정가를 직접 넣어주세요.');
        continue;
      }
      grades.forEach((g) => console.log(`      ${g.grade.padEnd(20)} ${g.price.toLocaleString('ko-KR')}원`));

      raw.watchlist[i].faceValues = grades;
      // 기본 정가는 가장 비싼 등급. 판매글에 VIP 표기가 있으면 스캔 때 그 등급으로 바꾼다.
      raw.watchlist[i].faceValue = Math.max(...grades.map((g) => g.price));
      changed++;
    } catch (e) {
      console.log(`      조회 실패: ${e.message.split('\n')[0]}`);
    }
  }

  if (changed) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(raw, null, 2), 'utf8');
    console.log(`\n${changed}건의 정가를 config.json 에 기록했습니다. 값이 맞는지 한 번 확인해주세요.`);
  }
}
