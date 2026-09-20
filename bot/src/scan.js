/* 매일 1회 감시 목록을 돌며 암표 의심 매물을 모은다.
 *
 * 판매글은 금방 내려가므로, 후보로 올릴 때 화면을 함께 저장한다.
 * 나중에 신고하려고 보면 이미 글이 사라져 증빙을 못 내는 일이 잦다. */
import path from 'path';
import { chromium } from 'playwright';
import { loadConfig, ensureDirs, SHOT_DIR } from './config.js';
import { ListingParser } from './parser.js';
import { candidates, filed, seen } from './store.js';
import { pickFaceValue } from './price.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 판매글 페이지에서 본문만 떼어낸다. 페이지 전체를 넘기면 관련상품·추천 목록의
 * 가격까지 섞여 들어와 추출이 망가진다(실제로 금액이 20개 잡힌 적이 있다).
 * 웹 도구의 북마클릿과 같은 규칙이다. */
function pageExtract() {
  const CUT = /(비슷해요|비슷한\s*상품|이런\s*상품|관련\s*상품|추천\s*상품|함께\s*본|최근\s*본|다른\s*상품|인기\s*상품|상점정보|판매자의\s*다른|카테고리\s*홈|이\s*상품과)/;
  const txt = (e) => (e && e.innerText) || '';
  const meta = (p) => {
    const m = document.querySelector(`meta[property="${p}"],meta[name="${p}"]`);
    return (m && m.content) || '';
  };

  const sels = ['[class*="ProductDetail"]', '[class*="product-detail"]', '[class*="ProductInfo"]',
    '[class*="product-info"]', '[itemprop="description"]', 'article', 'main', '[role="main"]'];
  let el = document.body;
  for (const s of sels) {
    const e = document.querySelector(s);
    if (txt(e).length > 120 && txt(e).length < txt(document.body).length * 0.8) { el = e; break; }
  }

  let t = txt(el);
  const cut = t.search(CUT);
  if (cut > 60) t = t.slice(0, cut);
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000);

  const site = meta('og:site_name');
  const h1 = txt(document.querySelector('h1')).trim();
  let title = meta('og:title') || h1 || document.title || '';
  if (site && title.replace(/\s/g, '') === site.replace(/\s/g, '')) title = h1 || '';

  /* 판매자 닉네임. 번개장터는 '구매하기' 바로 다음 줄에 상점명이 온다.
   * 본문 파서는 @핸들 형태만 찾을 수 있어 이런 사이트에서는 못 잡는다. */
  const all = (document.body.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean);
  let seller = '';
  const buyIdx = all.indexOf('구매하기');
  if (buyIdx >= 0) {
    const cand = all[buyIdx + 1] || '';
    if (cand && cand.length <= 24 && !/^\d+$/.test(cand) && !/원$/.test(cand)) seller = cand;
  }

  return { title, text: t, seller };
}

/* 예매처 주소에서 신고서의 예매처 코드를 정한다.
   01 NOL티켓(인터파크) 02 YES24 03 티켓링크 04 멜론티켓 05 쿠팡플레이 06 기타 */
const TICKET_SITES = [
  { re: /ticket\.melon\.com|melon/i, code: '04' },
  { re: /interpark|nol\.|nolticket/i, code: '01' },
  { re: /yes24/i, code: '02' },
  { re: /ticketlink|ticket\.naver/i, code: '03' },
  { re: /coupangplay|coupang/i, code: '05' }
];

export function ticketSiteCode(ticketUrl) {
  if (!ticketUrl) return '';
  const hit = TICKET_SITES.find((t) => t.re.test(ticketUrl));
  return hit ? hit.code : '06';
}

/* 번개장터 검색. 검색 결과는 자바스크립트로 그려지므로 실제 브라우저로 연다. */
async function searchBunjang(ctx, keyword) {
  const page = await ctx.newPage();
  try {
    await page.goto('https://m.bunjang.co.kr/search/products?q=' + encodeURIComponent(keyword),
      { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    return await page.evaluate(() => Array.from(document.querySelectorAll('a[href*="/products/"]'))
      .map((a) => ({
        url: new URL((a.getAttribute('href') || '').split('?')[0], location.origin).toString(),
        text: (a.innerText || '').replace(/\s+/g, ' ').trim()
      }))
      .filter((x) => x.text));
  } finally {
    await page.close();
  }
}

/** 목록 텍스트의 가격만 빠르게 본다. 상세 페이지를 열 가치가 있는지 거르는 용도. */
function listPrice(text) {
  const m = text.replace(/,/g, '').match(/(\d{4,})\s*원/);
  return m ? parseInt(m[1], 10) : 0;
}

/* 티켓을 '구하는' 글. 파는 사람이 아니므로 암표 신고 대상이 아니다.
 * 이런 글은 127,127,127원 같은 자리수 장난 가격을 올려두는 경우가 많아,
 * 거르지 않으면 배율이 수백 배로 튀어 후보를 오염시킨다. */
const WANTED_RE = /(구해요|구합니다|구함|삽니다|사요|삽니닷|양도\s*받|받아요|받습니다|구매\s*해요|구매합니다|wtb)/i;

function looksWanted(text) {
  return WANTED_RE.test(text);
}

/* 실제 판매가로 보기 어려운 금액을 거른다. 연락 유도용으로 999,999원이나
 * 자기 숫자(127…)를 올려두는 글이 흔하다. */
function isJokePrice(ask, faceValue, maxRatio) {
  if (ask > faceValue * maxRatio) return true;
  const digits = String(ask);
  // 1234567 처럼 같은 토막이 반복되는 금액(127127127 등)
  if (/^(\d{3})\1+$/.test(digits)) return true;
  return false;
}

export async function scan({ verbose = true } = {}) {
  const cfg = loadConfig();
  ensureDirs();

  const alreadySeen = seen.all();
  const openUrls = new Set(candidates.all().map((c) => c.url));
  const filedUrls = new Set(filed.all().map((c) => c.url));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: 'ko-KR', userAgent: UA,
    viewport: { width: 1280, height: 1000 } });

  const found = [];
  const visited = [];
  const stats = { listed: 0, detail: 0, below: 0, dup: 0, noPrice: 0, wanted: 0, joke: 0 };
  const maxRatio = cfg.maxRatio || 20;

  try {
    for (const watch of cfg.watchlist) {
      for (const keyword of watch.keywords) {
        if (verbose) console.log(`  검색: "${keyword}"`);
        let items = [];
        try {
          items = await searchBunjang(ctx, keyword);
        } catch (e) {
          console.log(`    검색 실패(건너뜀): ${e.message.split('\n')[0]}`);
          continue;
        }
        stats.listed += items.length;

        // 목록 가격만으로 먼저 거르고, 비싼 것부터 본다.
        const worth = items
          .filter((it) => {
            if (alreadySeen.has(it.url) || openUrls.has(it.url) || filedUrls.has(it.url)) {
              stats.dup++; return false;
            }
            if (looksWanted(it.text)) { stats.wanted++; return false; }
            const p = listPrice(it.text);
            if (!p) { stats.noPrice++; return false; }
            if (isJokePrice(p, watch.faceValue, maxRatio)) { stats.joke++; return false; }
            if (p < watch.faceValue * watch.minRatio) { stats.below++; return false; }
            return true;
          })
          .sort((a, b) => listPrice(b.text) - listPrice(a.text));

        for (const item of worth) {
          if (stats.detail >= cfg.maxDetailPerRun) break;
          stats.detail++;
          visited.push(item.url);

          await sleep(cfg.delayMs);
          const page = await ctx.newPage();
          try {
            await page.goto(item.url, { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForTimeout(1500);

            const { title, text, seller: pageSeller } = await page.evaluate(pageExtract);
            const parsed = ListingParser.parseListing([title, text].filter(Boolean).join('\n\n'), {
              catalog: [{ eventName: watch.eventName, faceValue: watch.faceValue,
                keywords: watch.keywords.join(','), minRatio: watch.minRatio }],
              url: item.url
            });

            if (looksWanted(title + '\n' + text)) { stats.wanted++; continue; }

            const ask = parsed.fields.askPrice || listPrice(item.text);
            if (!ask) continue;

            // 판매글이 VIP 를 말하면 VIP 정가와 비교한다. 등급을 모르면 가장 비싼
            // 등급을 써서 배율이 과장되지 않게 한다.
            const faceValue = pickFaceValue(watch.faceValues, title + '\n' + text) || watch.faceValue;
            if (isJokePrice(ask, faceValue, maxRatio)) { stats.joke++; continue; }

            const ratio = ask / faceValue;
            if (ratio < watch.minRatio) { stats.below++; continue; }

            // 글이 내려가기 전에 증거를 남긴다.
            const id = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
            const shot = path.join(SHOT_DIR, `${id}.png`);
            await page.screenshot({ path: shot, fullPage: true });

            found.push({
              id,
              foundAt: new Date().toISOString(),
              url: item.url,
              eventName: watch.eventName,
              faceValue: faceValue,
              askPrice: ask,
              ratio: Number(ratio.toFixed(2)),
              eventDate: parsed.fields.eventDate || '',
              seat: parsed.fields.seat || '',
              bookingRef: parsed.fields.bookingRef || '',
              // 파서가 못 잡으면 페이지에서 읽은 상점명을 쓴다.
              seller: parsed.fields.seller || pageSeller || '',
              platform: 'B',
              ticketSite: ticketSiteCode(watch.ticketUrl),
              grounds: parsed.grounds,
              signals: parsed.signalLabels,
              warnings: parsed.warnings,
              excerpt: text.replace(/\s+/g, ' ').trim().slice(0, 400),
              evidence: shot,
              status: 'pending'
            });

            if (verbose) {
              console.log(`    ● ${ratio.toFixed(1)}배  ${ask.toLocaleString('ko-KR')}원  ${item.url}`);
            }
          } catch (e) {
            console.log(`    상세 실패(건너뜀): ${e.message.split('\n')[0]}`);
          } finally {
            await page.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (found.length) candidates.add(found);
  seen.add(visited);

  return { found, stats };
}
