// api/fetch-listing.js - 공개 판매글 페이지에서 제목·본문을 best-effort로 읽어온다.
//
// 로그인이 필요하거나 자바스크립트로 본문을 그리는 사이트(중고거래 앱, X 등)는
// 여기서 본문을 얻을 수 없다. 그 경우 실패로 끝내지 말고 "직접 붙여넣기" 안내를 돌려준다.
import { readJson } from './helpers.js';
import dns from 'dns';

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;

/** 내부망·메타데이터 주소로의 요청을 막는다(SSRF 방지). */
function isBlockedIp(ip) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 0 || p[0] === 127 || p[0] === 10) return true;          // 현재망·루프백·사설
    if (p[0] === 169 && p[1] === 254) return true;                        // 링크로컬(클라우드 메타데이터)
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;            // 사설
    if (p[0] === 192 && p[1] === 168) return true;                        // 사설
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;           // CGNAT
    if (p[0] >= 224) return true;                                         // 멀티캐스트·예약
    return false;
  }
  const low = String(ip).toLowerCase();
  if (low === '::1' || low === '::') return true;
  if (low.startsWith('::ffff:')) return isBlockedIp(low.slice(7));
  if (low.startsWith('fe80') || low.startsWith('fc') || low.startsWith('fd')) return true;
  return false;
}

/** URL의 스킴과 실제 해석된 IP를 모두 검사한다. */
async function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    throw new Error('올바른 주소 형식이 아닙니다.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('http 또는 https 주소만 허용됩니다.');
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host.endsWith('.internal')) {
    throw new Error('내부 주소는 조회할 수 없습니다.');
  }

  // 호스트명이 IP 리터럴이면 바로 검사, 도메인이면 DNS로 해석해 검사한다.
  let addresses;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    addresses = [{ address: host }];
  } else {
    addresses = await dns.promises.lookup(host, { all: true });
  }

  if (addresses.some((a) => isBlockedIp(a.address))) {
    throw new Error('내부 주소는 조회할 수 없습니다.');
  }

  return parsed;
}

/** 리다이렉트를 직접 따라가며 각 단계마다 주소를 다시 검사한다. */
async function safeFetch(startUrl) {
  let url = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(url);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          // 봇 차단 우회를 시도하지 않는다. 일반적인 브라우저 UA만 밝힌다.
          'User-Agent': 'Mozilla/5.0 (compatible; TicketReportHelper/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9'
        }
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error('리다이렉트 주소를 확인할 수 없습니다.');
      url = new URL(location, url).toString();
      continue;
    }

    return { res, finalUrl: url };
  }

  throw new Error('리다이렉트가 너무 많습니다.');
}

/** 응답 본문을 크기 제한을 두고 읽는다. */
async function readCapped(res) {
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) {
    const text = await res.text();
    return text.slice(0, MAX_BYTES);
  }

  const chunks = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    chunks.push(value);
  }
  try {
    await reader.cancel();
  } catch (e) { /* 이미 닫힌 경우 무시 */ }

  const merged = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return merged.toString('utf8').slice(0, MAX_BYTES);
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

function metaContent(html, keys) {
  for (const key of keys) {
    const re = new RegExp(
      '<meta[^>]+(?:property|name)\\s*=\\s*["\']' + key + '["\'][^>]*>',
      'i'
    );
    const tag = html.match(re);
    if (tag) {
      const content = tag[0].match(/content\s*=\s*["']([\s\S]*?)["']/i);
      if (content && content[1].trim()) return decodeEntities(content[1].trim());
    }
  }
  return '';
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/** 로그인 벽이나 자바스크립트 껍데기인지 추정한다. */
function detectWall(text, title) {
  const hay = (title + ' ' + text).toLowerCase();
  if (text.length < 200) return '본문이 거의 비어 있습니다. 자바스크립트로 내용을 그리는 페이지일 수 있습니다.';
  if (/로그인|sign in|log in|본인\s*인증|캡차|captcha|자동입력\s*방지/.test(hay) && text.length < 1500) {
    return '로그인이 필요한 페이지로 보입니다.';
  }
  return '';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST만 허용됩니다.' });
  }

  const body = await readJson(req);
  const url = typeof body.url === 'string' ? body.url.trim() : '';

  if (!url) {
    return res.status(400).json({ ok: false, error: '조회할 주소(url)가 필요합니다.' });
  }

  try {
    const { res: upstream, finalUrl } = await safeFetch(url);

    if (!upstream.ok) {
      return res.status(200).json({
        ok: false,
        error: `페이지를 읽을 수 없습니다 (HTTP ${upstream.status}).`,
        hint: '판매글 본문을 직접 복사해 붙여넣으면 그대로 분석할 수 있습니다.',
        finalUrl
      });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (contentType && !/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
      return res.status(200).json({
        ok: false,
        error: `HTML 페이지가 아닙니다 (${contentType.split(';')[0]}).`,
        hint: '판매글 본문을 직접 복사해 붙여넣으세요.',
        finalUrl
      });
    }

    const html = await readCapped(upstream);
    const title = metaContent(html, ['og:title', 'twitter:title']) ||
      decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1].trim());
    const description = metaContent(html, ['og:description', 'twitter:description', 'description']);
    const siteName = metaContent(html, ['og:site_name']);
    const text = htmlToText(html).slice(0, 8000);

    return res.status(200).json({
      ok: true,
      finalUrl,
      meta: { title, description, siteName },
      text,
      wall: detectWall(text, title)
    });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: e.message || '페이지 조회에 실패했습니다.',
      hint: '판매글 본문을 직접 복사해 붙여넣으면 그대로 분석할 수 있습니다.'
    });
  }
}
