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
      /* 입장권은 정가라고 적고 굿즈를 끼워 웃돈을 받는 수법. 이 시장에서
       * 가장 흔한 형태라, 배율만 적으면 "굿즈 값"이라는 해명에 그대로 막힌다. */
      re: /(원가|정가)\s*(?:양도)?[)\]）]?\s*[+＋]\s*(굿즈|포카|포토\s*카드|키링|슬로건|응원봉|미공포)|(굿즈|포카|포토\s*카드|미공포)\s*(포함|끼워|일괄|같이|함께)/,
      // 굿즈만 파는 글에는 걸리면 안 된다. 입장권 거래 글일 때만 인정한다.
      requires: /(티켓|입장권|좌석|구역|스탠딩|지정석|회차|첫콘|막콘|중콘|연석|\d+열)/,
      ground: '입장권 값은 정가라고 하면서 굿즈·포토카드를 묶어 판매가를 올려, 실질적으로 웃돈을 받고 있음',
      label: '굿즈 끼워팔기'
    },
    {
      /* '티미포'(티켓+미공개 포토카드) 등으로 웃돈 액수를 직접 제시하라고 요구하는 경우. */
      re: /(티미포|티\+미포|프리\s*제시|웃돈\s*제시|\d+\s*이상으?로?\s*제시|제시\s*받)/,
      ground: '구매자에게 웃돈 액수를 제시하도록 요구하고 있음',
      label: '웃돈 제시 요구'
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
      const shown = prices.slice(0, 6).map((p) => p.value.toLocaleString('ko-KR')).join(', ');
      result.warnings.push(
        `금액이 ${prices.length}개 발견됐습니다(${shown}${prices.length > 6 ? ' …' : ''}). ` +
        (prices.length > 6
          ? '관련상품·추천 목록의 가격까지 섞여 들어온 것으로 보입니다. ' +
            '판매글에서 제목과 가격, 좌석 부분만 드래그해 선택한 뒤 북마클릿을 누르면 훨씬 정확합니다.'
          : '정가와 요구 금액이 맞는지 직접 확인하세요.')
      );
    }

    if (result.faceValue && result.askPrice && result.askPrice < result.faceValue) {
      result.warnings.push('요구 금액이 정가보다 낮게 추출됐습니다. 두 값이 바뀌지 않았는지 확인하세요.');
    }

    return result;
  }

  /* ---------- 날짜 ---------- */

  /* '11/7' 같은 표기. 페이지네이션('1 / 1')을 날짜로 오인하지 않도록
   * 주변에 공연 관련 단어가 있을 때만 인정한다. */
  function matchSlashDate(text) {
    const CONTEXT = /(공연|콘서트|첫콘|막콘|중콘|경기|투어|일자|날짜|회차)/;
    // 슬래시 주변에 공백·줄바꿈을 허용하지 않는다. 허용하면 페이지네이션
    // '1 / 1'을 1월 1일로 읽어버린다(실제로 겪음).
    const re = /\b(\d{1,2})\/(\d{1,2})\b/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const month = parseInt(m[1], 10);
      const day = parseInt(m[2], 10);
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;
      const around = text.slice(Math.max(0, m.index - 25), m.index + 25);
      if (CONTEXT.test(around)) return [m[0], month, day];
    }
    return null;
  }

  function extractDate(text) {
    let m = text.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/);
    let date = '';
    let conf = 'low';
    let warning = '';

    if (m) {
      date = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
      conf = 'high';
      // 지난 공연 날짜는 페이지 다른 곳에서 딸려온 값일 가능성이 크다.
      const year = parseInt(m[1], 10);
      const thisYear = new Date().getFullYear();
      if (year < thisYear || year > thisYear + 2) {
        conf = 'low';
        warning = `추출한 공연 일시(${date})가 판매 중인 공연으로는 어색합니다. ` +
          '페이지의 다른 날짜를 잘못 읽었을 수 있으니 직접 확인하세요.';
      }
    } else if ((m = matchSlashDate(text))) {
      date = `${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
      // 슬래시 표기는 연도도 없고 오인 여지가 커서 자동 적용하지 않는다.
      conf = 'low';
      warning = `공연 일시를 '${date}'로 읽었습니다(연도 없음). 맞는지 확인하고 연도와 함께 직접 넣어주세요.`;
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
      { re: /([1-9])\s*층/ },
      // 구역명 앞이 글자면 긴 단어의 꼬리를 구역명으로 읽게 된다("REDLINE구역" → "ine구역").
      { re: /(?:^|[\s,./()\[\]-])([A-Za-z가-힣]{1,3})\s*구역/, fmt: (m) => m[1] + '구역' },
      { re: /(\d{1,2})\s*열/ },
      { re: /스탠딩\s*([A-Za-z]|\d{1,2})?/ },
      { re: /(플로어|플꾸|1층석|2층석|3층석|지정석|테이블석)/ }
    ];

    patterns.forEach(({ re, fmt }) => {
      const m = text.match(re);
      if (m) parts.push((fmt ? fmt(m) : m[0]).replace(/\s+/g, ''));
    });

    const seat = Array.from(new Set(parts)).join(' ');
    return { value: seat, confidence: seat ? (parts.length >= 2 ? 'high' : 'mid') : 'low' };
  }

  /** 예매번호. 신고센터가 좌석번호와 함께 유효 접수의 필수 요건으로 보는 값이다. */
  function extractBookingRef(text) {
    const m = text.match(/(?:예매\s*번호|예매번호|주문\s*번호|티켓\s*번호)\s*[:：]?\s*([A-Za-z0-9\-]{6,24})/);
    return m ? { value: m[1], confidence: 'high' } : { value: '', confidence: 'low' };
  }

  function extractQuantity(text) {
    const m = text.match(/(\d{1,2})\s*(?:연석|매|장)/);
    if (!m) return { value: 0, confidence: 'low' };
    const n = parseInt(m[1], 10);
    return { value: n >= 1 && n <= 20 ? n : 0, confidence: 'mid' };
  }

  /* ---------- 판매자 ---------- */

  /* 플랫폼 자신의 공식 계정. 페이지 머리말·푸터에 박혀 있어 판매자로 오인하기 쉽다. */
  const PLATFORM_HANDLES = /^(bunjang|daangn|joongna|joonggonara|karrot|번개장터|당근|중고나라|naver|kakao|instagram|facebook|twitter|x|youtube|tiktok|help|support|official|cs)$/i;

  function extractSeller(text) {
    let m = text.match(/@([A-Za-z0-9_]{3,30})/);
    if (m && !PLATFORM_HANDLES.test(m[1])) return { value: '@' + m[1], confidence: 'high' };

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

  function isPlatformName(s) {
    return PLATFORM_HANDLES.test(String(s).replace(/\s/g, ''));
  }

  /* 거래 페이지에서는 상품 제목이 가격 바로 위에 온다. 첫 줄이 사이트명이나
   * 내비게이션일 때 이 위치를 대신 본다. */
  function titleNearPrice(text, firstPriceIndex) {
    if (firstPriceIndex === undefined || firstPriceIndex === null) return '';
    const lines = text.slice(0, firstPriceIndex).split('\n')
      .map((l) => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 3; i--) {
      if (lines[i].length >= 8 && !isPlatformName(lines[i])) return lines[i].slice(0, 60);
    }
    return '';
  }

  function extractEventName(text, catalog, firstPriceIndex) {
    const hit = matchCatalog(text, catalog);
    if (hit) return { value: hit.eventName, confidence: 'high', catalogEntry: hit };

    // 제목처럼 보이는 첫 줄을 후보로 쓴다. 확정하지 않고 확인을 받는다.
    const firstLine = text.split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';
    const cleaned = firstLine.replace(/^[\[\]#*\-·\s]+/, '').slice(0, 60);

    if (cleaned && cleaned.length >= 8 && !isPlatformName(cleaned)) {
      return { value: cleaned, confidence: 'low', catalogEntry: null };
    }

    // 첫 줄이 사이트명·내비게이션이면 가격 위쪽 제목을 후보로 쓴다.
    return { value: titleNearPrice(text, firstPriceIndex), confidence: 'low', catalogEntry: null };
  }

  /* ---------- 정황 ---------- */

  function extractSignals(text) {
    const grounds = [];
    const labels = [];
    SIGNAL_RULES.forEach((rule) => {
      if (rule.requires && !rule.requires.test(text)) return;
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

    const prices = extractPrices(body);
    const firstPrice = findPrices(body)[0];
    const event = extractEventName(body, options.catalog, firstPrice && firstPrice.index);
    const date = extractDate(body);
    const seat = extractSeat(body);
    const bookingRef = extractBookingRef(body);
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

    if (!seat.value && !bookingRef.value) {
      warnings.push('좌석번호도 예매번호도 찾지 못했습니다. 신고센터는 둘 중 하나가 특정되지 않으면 ' +
        '유효한 접수로 처리하지 않으니, 판매글에서 확인해 직접 넣어주세요.');
    }

    return {
      fields: {
        eventName: event.value,
        eventDate: date.value,
        venue: '',
        seat: seatText,
        bookingRef: bookingRef.value,
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
        bookingRef: bookingRef.confidence,
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
