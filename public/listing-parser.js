/* 판매글 텍스트 → 신고 항목 추출 파서
 *
 * 잘못 추출한 값이 그대로 신고문에 들어가면 허위 신고가 되므로,
 * 모든 필드에 신뢰도(high/mid/low)를 붙이고 화면에서 확인을 받게 한다.
 * 추측으로 값을 채우지 않는다 — 근거가 없으면 비워서 내보낸다.
 */
(function (global) {
  'use strict';

  /* 가격 앞에 붙는 단서. 정가와 요구가를 구분하는 핵심 근거다. */
  const FACE_CUES = /(정가|원가|실가|티켓가|공식가|액면|티켓값)/g;
  const ASK_CUES = /(양도가|판매가|희망가|플미|프리미엄|웃돈|장당|매당|한장|1장|받고|네고|가격)/g;

  /* 정황 키워드 → 신고문에 들어갈 의심 근거 문장 */
  const SIGNAL_RULES = [
    {
      re: /(선입금|입금\s*먼저|무통장|계좌\s*(?:주|드|알려)|현금\s*거래만)/,
      ground: '선입금만 요구하고 안전결제를 거부함(사기 의심)',
      label: '선입금 요구'
    },
    {
      re: /(안전\s*결제\s*(?:불가|안|거부|x|X)|안전거래\s*(?:불가|안|거부)|더치트|직거래만)/,
      ground: '선입금만 요구하고 안전결제를 거부함(사기 의심)',
      label: '안전결제 거부'
    },
    {
      re: /(대리\s*(?:입장|수령)|명의\s*(?:변경|이전|빌려)|본인\s*인증\s*(?:대행|해드)|아이디\s*(?:양도|빌려))/,
      ground: '타인 명의 예매·대리 입장을 안내하고 있음',
      label: '타인 명의 입장'
    },
    {
      re: /(매크로|자동\s*예매|봇\s*돌|프로그램\s*돌|피켓팅\s*대행|예매\s*대행)/,
      ground: '매크로 프로그램 이용 정황이 있음(예매 개시 직후 대량 확보, 판매자 스스로 언급 등)',
      label: '매크로 정황'
    },
    {
      re: /(플미|프리미엄|웃돈|프리\s*받)/,
      ground: '정가를 크게 초과하는 금액을 요구함',
      label: '웃돈 언급'
    },
    {
      re: /(양도\s*불가인?데|약관|재판매\s*금지|취소\s*불가라)/,
      ground: '예매처 약관상 금지된 양도·재판매를 공개적으로 권유하고 있음',
      label: '약관상 금지 재판매'
    }
  ];

  /* ---------- 가격 ---------- */

  /** 한국식 금액 표기를 원 단위 정수로 변환한다. '60만5천' → 605000 */
  function normalizeAmount(intPart, manPart, cheonPart) {
    let value = 0;
    if (manPart !== undefined) {
      value = parseFloat(manPart) * 10000;
      if (cheonPart) value += parseInt(cheonPart, 10) * 1000;
    } else {
      value = parseFloat(String(intPart).replace(/,/g, ''));
    }
    return Math.round(value);
  }

  /**
   * 텍스트 안의 금액 표기를 모두 찾아 위치·신뢰도와 함께 돌려준다.
   * 날짜(2026-03-14)나 좌석 번호를 금액으로 오인하지 않도록,
   * 단위(만·원)나 천 단위 콤마가 있는 표기만 인정한다.
   */
  function findPrices(text) {
    const found = [];

    // 60만, 60만5천, 1.5만원
    const manRe = /(\d+(?:\.\d+)?)\s*만\s*(?:(\d+)\s*천)?\s*원?/g;
    let m;
    while ((m = manRe.exec(text)) !== null) {
      found.push({
        value: normalizeAmount(null, m[1], m[2]),
        index: m.index, end: m.index + m[0].length, confidence: 'high'
      });
    }

    // 600,000원 / 600,000
    const commaRe = /(\d{1,3}(?:,\d{3})+)\s*(원)?/g;
    while ((m = commaRe.exec(text)) !== null) {
      found.push({
        value: normalizeAmount(m[1]),
        index: m.index, end: m.index + m[0].length, confidence: m[2] ? 'high' : 'mid'
      });
    }

    // 600000원 (콤마 없이 '원'이 붙은 경우만)
    const wonRe = /(\d{4,})\s*원/g;
    while ((m = wonRe.exec(text)) !== null) {
      found.push({
        value: parseInt(m[1], 10),
        index: m.index, end: m.index + m[0].length, confidence: 'high'
      });
    }

    // 같은 위치에서 중복 검출된 것은 신뢰도 높은 쪽만 남긴다.
    const byIndex = new Map();
    found.forEach((p) => {
      const key = p.index + ':' + p.value;
      const prev = byIndex.get(key);
      if (!prev || (prev.confidence !== 'high' && p.confidence === 'high')) byIndex.set(key, p);
    });

    return Array.from(byIndex.values())
      .filter((p) => p.value >= 1000 && p.value <= 100000000)
      .sort((a, b) => a.index - b.index);
  }

  /** 문자열 안에서 해당 패턴이 마지막으로 나타난 위치. 없으면 -1. */
  function lastCueIndex(text, cueRe) {
    cueRe.lastIndex = 0;
    let last = -1;
    let m;
    while ((m = cueRe.exec(text)) !== null) last = m.index;
    return last;
  }

  /**
   * 금액 바로 앞 구간을 보고 정가/요구가 중 어느 쪽 단서가 붙어 있는지 판단한다.
   * 되돌아보는 범위는 직전 금액이 끝난 지점까지로 자른다 — 그러지 않으면
   * 앞 판매글의 '정가' 같은 단서가 다음 금액까지 넘어와 오분류된다.
   */
  function classifyPrice(text, price, prevEnd) {
    const start = Math.max(prevEnd || 0, price.index - 14);
    const before = text.slice(start, price.index);
    const faceAt = lastCueIndex(before, FACE_CUES);
    const askAt = lastCueIndex(before, ASK_CUES);
    if (faceAt === -1 && askAt === -1) return 'unknown';
    // 금액에 더 가까운(뒤쪽에 있는) 단서를 따른다.
    return faceAt > askAt ? 'face' : 'ask';
  }

  function extractPrices(text) {
    const prices = findPrices(text);
    const result = { faceValue: 0, askPrice: 0, faceConf: 'low', askConf: 'low', warnings: [] };
    if (!prices.length) return result;

    const faces = [];
    const asks = [];
    const unknowns = [];

    let prevEnd = 0;
    prices.forEach((p) => {
      const kind = classifyPrice(text, p, prevEnd);
      if (kind === 'face') faces.push(p);
      else if (kind === 'ask') asks.push(p);
      else unknowns.push(p);
      prevEnd = Math.max(prevEnd, p.end || p.index);
    });

    if (faces.length) {
      result.faceValue = faces[0].value;
      result.faceConf = faces[0].confidence;
    }

    if (asks.length) {
      result.askPrice = asks[0].value;
      result.askConf = asks[0].confidence;
    } else if (unknowns.length === 1) {
      // 단서 없는 금액이 딱 하나면 요구 금액으로 본다. 신뢰도는 낮춰서 확인을 받는다.
      result.askPrice = unknowns[0].value;
      result.askConf = unknowns[0].confidence === 'high' ? 'mid' : 'low';
    } else if (unknowns.length > 1) {
      // 정가가 이미 잡혔다면 그보다 큰 금액을 요구가 후보로 본다.
      const candidates = result.faceValue
        ? unknowns.filter((p) => p.value > result.faceValue)
        : unknowns;
      if (candidates.length) {
        result.askPrice = candidates[0].value;
        result.askConf = 'low';
      }
      result.warnings.push(
        `금액이 ${prices.length}개 발견됐습니다(${prices.map((p) => p.value.toLocaleString('ko-KR')).join(', ')}). 정가와 요구 금액이 맞는지 직접 확인하세요.`
      );
    }

    if (result.faceValue && result.askPrice && result.askPrice < result.faceValue) {
      result.warnings.push('요구 금액이 정가보다 낮게 추출됐습니다. 두 값이 바뀌지 않았는지 확인하세요.');
    }

    return result;
  }

  /* ---------- 날짜 ---------- */

  function extractDate(text) {
    let m = text.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/);
    let date = '';
    let conf = 'low';
    let warning = '';

    if (m) {
      date = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
      conf = 'high';
    } else {
      m = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
      if (m) {
        // 연도는 본문에 없다. 값에 섞지 않고 경고로 알린다.
        date = `${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
        conf = 'mid';
        warning = `공연 일시에 연도가 없어 '${date}'로만 추출했습니다. 연도를 직접 넣어주세요.`;
      }
    }

    const time = text.match(/(\d{1,2})\s*(?::|시)\s*(\d{2})?/);
    if (date && time) {
      const hh = String(time[1]).padStart(2, '0');
      const mm = time[2] || '00';
      if (parseInt(hh, 10) <= 23) date += ` ${hh}:${mm}`;
    }

    return { value: date, confidence: date ? conf : 'low', warning: warning };
  }

  /* ---------- 좌석 · 매수 ---------- */

  function extractSeat(text) {
    const parts = [];
    const patterns = [
      /(\d)\s*층/,
      /([A-Za-z가-힣]{1,3})\s*구역/,
      /(\d{1,2})\s*열/,
      /스탠딩\s*([A-Za-z]|\d{1,2})?/,
      /(플로어|플꾸|1층석|2층석|3층석|지정석|테이블석)/
    ];

    patterns.forEach((re) => {
      const m = text.match(re);
      if (m) parts.push(m[0].replace(/\s+/g, ''));
    });

    const seat = Array.from(new Set(parts)).join(' ');
    return { value: seat, confidence: seat ? (parts.length >= 2 ? 'high' : 'mid') : 'low' };
  }

  function extractQuantity(text) {
    const m = text.match(/(\d{1,2})\s*(?:연석|매|장)/);
    if (!m) return { value: 0, confidence: 'low' };
    const n = parseInt(m[1], 10);
    return { value: n >= 1 && n <= 20 ? n : 0, confidence: 'mid' };
  }

  /* ---------- 판매자 ---------- */

  function extractSeller(text) {
    let m = text.match(/@([A-Za-z0-9_]{3,30})/);
    if (m) return { value: '@' + m[1], confidence: 'high' };

    m = text.match(/(?:닉네임|판매자|아이디|ID)\s*[:：]?\s*([A-Za-z0-9가-힣_.\-]{2,24})/);
    if (m) return { value: m[1], confidence: 'mid' };

    m = text.match(/(?:오픈\s*)?카톡\s*[:：]?\s*([A-Za-z0-9_.\-]{3,24})/);
    if (m) return { value: '카톡 ' + m[1], confidence: 'mid' };

    return { value: '', confidence: 'low' };
  }

  /* ---------- 공연명 ---------- */

  /** 감시 목록(catalog)의 키워드와 먼저 맞춰본다. 맞으면 정가까지 목록에서 가져올 수 있다. */
  function matchCatalog(text, catalog) {
    if (!Array.isArray(catalog)) return null;
    const hay = text.replace(/\s+/g, '').toLowerCase();

    for (const entry of catalog) {
      const keywords = (entry.keywords || '')
        .split(/[,\n]/)
        .map((k) => k.replace(/\s+/g, '').toLowerCase())
        .filter(Boolean);
      const all = [entry.eventName.replace(/\s+/g, '').toLowerCase(), ...keywords];
      if (all.some((k) => k && hay.includes(k))) return entry;
    }
    return null;
  }

  function extractEventName(text, catalog) {
    const hit = matchCatalog(text, catalog);
    if (hit) return { value: hit.eventName, confidence: 'high', catalogEntry: hit };

    // 제목처럼 보이는 첫 줄을 후보로 쓴다. 확정하지 않고 확인을 받는다.
    const firstLine = text.split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';
    const cleaned = firstLine.replace(/^[\[\]#*\-·\s]+/, '').slice(0, 60);
    return { value: cleaned, confidence: cleaned ? 'low' : 'low', catalogEntry: null };
  }

  /* ---------- 정황 ---------- */

  function extractSignals(text) {
    const grounds = [];
    const labels = [];
    SIGNAL_RULES.forEach((rule) => {
      if (rule.re.test(text)) {
        if (!grounds.includes(rule.ground)) grounds.push(rule.ground);
        labels.push(rule.label);
      }
    });
    return { grounds, labels };
  }

  /* ---------- 공개 메타데이터(서버 fetch 결과) 병합 ---------- */

  function fromMeta(meta) {
    if (!meta) return '';
    return [meta.title, meta.description].filter(Boolean).join('\n');
  }

  /* ---------- 메인 ---------- */

  /**
   * @param {string} text  판매글 본문(복사해 붙여넣은 텍스트)
   * @param {object} opts  { catalog, url, meta }
   */
  function parseListing(text, opts) {
    const options = opts || {};
    const body = [fromMeta(options.meta), text || ''].filter(Boolean).join('\n');

    const event = extractEventName(body, options.catalog);
    const prices = extractPrices(body);
    const date = extractDate(body);
    const seat = extractSeat(body);
    const qty = extractQuantity(body);
    const seller = extractSeller(body);
    const signals = extractSignals(body);

    const warnings = prices.warnings.slice();
    if (date.warning) warnings.push(date.warning);

    // 감시 목록에 등록된 공연이면 정가는 목록 값을 신뢰한다(사용자가 직접 확인해 넣은 값).
    let faceValue = prices.faceValue;
    let faceConf = prices.faceConf;
    if (event.catalogEntry && event.catalogEntry.faceValue) {
      if (prices.faceValue && prices.faceValue !== event.catalogEntry.faceValue) {
        warnings.push(
          `본문의 정가(${prices.faceValue.toLocaleString('ko-KR')}원)와 감시 목록의 정가(${event.catalogEntry.faceValue.toLocaleString('ko-KR')}원)가 다릅니다. 목록 값을 사용했습니다.`
        );
      }
      faceValue = event.catalogEntry.faceValue;
      faceConf = 'high';
    }

    if (!faceValue) {
      warnings.push('정가를 찾지 못했습니다. 예매처에서 확인해 직접 입력하세요.');
    }
    if (!prices.askPrice) {
      warnings.push('요구 금액을 찾지 못했습니다. 직접 입력하세요.');
    }

    const seatText = [seat.value, qty.value ? `(${qty.value}매)` : ''].filter(Boolean).join(' ');

    return {
      fields: {
        eventName: event.value,
        eventDate: date.value,
        venue: '',
        seat: seatText,
        faceValue: faceValue,
        askPrice: prices.askPrice,
        seller: seller.value,
        url: options.url || ''
      },
      confidence: {
        eventName: event.confidence,
        eventDate: date.confidence,
        venue: 'low',
        seat: seat.confidence,
        faceValue: faceConf,
        askPrice: prices.askConf,
        seller: seller.confidence,
        url: options.url ? 'high' : 'low'
      },
      grounds: signals.grounds,
      signalLabels: signals.labels,
      catalogEntry: event.catalogEntry,
      warnings: warnings,
      raw: text || ''
    };
  }

  /**
   * 검색 결과 페이지를 통째로 붙여넣은 텍스트를 여러 건으로 쪼개 파싱한다.
   * 금액 표기를 기준으로 블록을 나눈다 — 목록형 페이지는 한 건에 최소 한 번 가격이 나온다.
   */
  function parseSearchResults(text, opts) {
    const options = opts || {};
    const lines = (text || '').split('\n').map((l) => l.trim());

    const blocks = [];
    let current = [];
    let currentHasPrice = false;

    const flush = () => {
      if (current.length && currentHasPrice) blocks.push(current.join('\n'));
      current = [];
      currentHasPrice = false;
    };

    lines.forEach((line) => {
      if (!line) {
        flush();
        return;
      }
      const hasPrice = findPrices(line).length > 0;
      // 이미 가격이 들어간 블록에서 새 가격 줄이 나오면 다음 건으로 본다.
      if (hasPrice && currentHasPrice) flush();
      current.push(line);
      if (hasPrice) currentHasPrice = true;
    });
    flush();

    return blocks.map((block) => parseListing(block, options));
  }

  global.ListingParser = {
    parseListing: parseListing,
    parseSearchResults: parseSearchResults,
    findPrices: findPrices,
    matchCatalog: matchCatalog,
    SIGNAL_RULES: SIGNAL_RULES
  };
})(window);
