/* 암표 신고 도우미
 * 신고문 작성 · 증거 정리 · 기록 관리를 돕는 클라이언트 전용 도구.
 * 어떤 신고 창구에도 자동 제출하지 않는다. 제출은 사용자가 직접 한다.
 */

const STORAGE_KEY = 'scalpingReportLog';
const WATCHLIST_KEY = 'scalpingWatchlist';
const QUEUE_KEY = 'scalpingCandidates';

const MODE_DESC = {
  auto: '감시 목록에 공연과 정가를 등록하고, 검색 결과를 붙여넣으면 조건을 넘는 판매글만 골라 후보 큐에 쌓습니다. 후보를 고르면 양식이 채워지고, 제출은 형이 직접 합니다.',
  url: '판매글 주소를 넣거나 본문을 붙여넣으면 가격·좌석·날짜·정황을 뽑아 양식을 채웁니다. 추출값을 확인한 뒤 신고문을 생성하세요.',
  manual: '모든 항목을 직접 입력합니다. 추출이 잘 안 되는 판매글이나, 현장에서 목격한 경우에 쓰세요.'
};

/* 공식 신고 창구.
 * 기관 사이트는 개편이 잦아 링크가 끊길 수 있다. 화면에도 안내 문구를 함께 띄운다. */
const CHANNELS = [
  {
    id: 'culture',
    name: '공연 암표 통합신고센터',
    desc: '문체부·한국콘텐츠진흥원 운영. 과징금 부과와 포상금 지급이 여기서 나온다',
    url: 'https://www.culture.go.kr/singo/',
    urlHint: 'culture.go.kr/singo → 공연 분야 신고 (온라인 접수만 가능)',
    ask: '공연법상 입장권 부정판매에 해당하는지 확인하여 과징금 부과 등 필요한 조치를 요청합니다.',
    needsRef: true
  },
  {
    id: 'prosports',
    name: '프로스포츠 암표신고센터',
    desc: '야구·축구 등 프로스포츠 경기 입장권은 이쪽으로',
    url: 'https://www.prosports.or.kr/report/m01/main',
    urlHint: '한국프로스포츠협회 온라인 암표신고센터',
    ask: '국민체육진흥법상 입장권 부정판매에 해당하는지 확인하여 필요한 조치를 요청합니다.',
    needsRef: true
  },
  {
    id: 'platform',
    name: '판매 플랫폼 / 예매처 신고',
    desc: '가장 빠름. 게시글 삭제·계정 정지·예매 취소로 이어짐 (포상금 대상 아님)',
    url: '',
    urlHint: '판매글 내 "신고" 버튼 또는 예매처 고객센터 → 부정거래 신고',
    ask: '해당 게시글 삭제 및 판매자 계정에 대한 이용제한, 부정 예매로 확인될 경우 해당 예매건 취소 조치를 요청합니다.',
    needsRef: false
  },
  {
    id: 'ecrm',
    name: '경찰 사이버범죄 신고 (ECRM)',
    desc: '선입금 후 미이행 등 사기 피해가 실제로 발생했을 때',
    url: 'https://ecrm.police.go.kr',
    urlHint: '경찰청 사이버범죄 신고상담시스템',
    ask: '위 행위에 대한 수사 및 법령 위반 여부 확인을 요청합니다.',
    needsRef: false
  }
];

/* 2026-08-28 시행된 공연법·국민체육진흥법 시행령 개정 기준 포상금 안내 */
const REWARD_INFO = {
  sale: '부정판매 신고: 해당 판매자에게 부과된 과징금의 50% 범위에서 포상금이 지급될 수 있습니다. ' +
    '과징금은 판매금액의 2배~50배로 차등 부과됩니다.',
  purchase: '부정구매 신고: 최대 5,000만원 이내에서 포상금이 지급될 수 있습니다. ' +
    '재판매를 목적으로 표를 부정하게 구매한 행위가 대상입니다.'
};

let selectedChannel = CHANNELS[0];
let lastGenerated = null;

/* ---------- 유틸 ---------- */

const $ = (id) => document.getElementById(id);

function toNumber(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function formatWon(n) {
  return n.toLocaleString('ko-KR') + '원';
}

function readStorage(key) {
  try {
    const raw = localStorage.getItem(key || STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('저장된 값을 읽을 수 없습니다:', e);
    return [];
  }
}

function writeStorage(list, key) {
  try {
    localStorage.setItem(key || STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.warn('값을 저장할 수 없습니다:', e);
    return false;
  }
}

function newId() {
  return Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function checkedValues(boxId) {
  return Array.from($(boxId).querySelectorAll('input[type="checkbox"]:checked'))
    .map((el) => el.value);
}

/* ---------- 입력 수집 ---------- */

function collect() {
  return {
    eventName: $('eventName').value.trim(),
    eventDate: $('eventDate').value.trim(),
    venue: $('venue').value.trim(),
    seat: $('seat').value.trim(),
    bookingRef: $('bookingRef').value.trim(),
    reportType: $('reportType').value,
    faceValue: toNumber($('faceValue').value),
    askPrice: toNumber($('askPrice').value),
    platform: $('platform').value,
    seller: $('seller').value.trim(),
    url: $('url').value.trim(),
    context: $('context').value.trim(),
    grounds: checkedValues('groundsBox'),
    evidence: checkedValues('evidenceBox'),
    reporterName: $('reporterName').value.trim(),
    reporterContact: $('reporterContact').value.trim()
  };
}

function missingFields(d) {
  const missing = [];
  if (!d.eventName) missing.push('공연·경기명');
  if (!d.faceValue) missing.push('정가');
  if (!d.askPrice) missing.push('요구 금액');
  if (!d.platform) missing.push('판매 경로');
  if (!d.seller && !d.url) missing.push('판매자 식별정보 또는 판매글 주소');
  if (!d.context) missing.push('발견 경위');
  // 신고센터는 좌석번호 또는 예매번호가 특정되지 않으면 유효 접수로 처리하지 않는다.
  if (selectedChannel.needsRef && !d.seat && !d.bookingRef) {
    missing.push('좌석번호 또는 예매번호(둘 중 하나 필수)');
  }
  return missing;
}

/* ---------- 분석 ---------- */

function analyze(d) {
  const diff = d.askPrice - d.faceValue;
  const ratio = d.faceValue > 0 ? d.askPrice / d.faceValue : 0;

  let verdict, note, level;
  if (!d.faceValue || !d.askPrice) {
    verdict = '—';
    note = '정가와 요구 금액을 입력하면 분석 결과가 표시됩니다.';
    level = 'neutral';
  } else if (diff <= 0) {
    verdict = '해당 없음';
    note = '정가 이하 양도입니다. 웃돈이 없으면 암표로 보기 어렵습니다. ' +
      '다만 예매처 약관이 양도 자체를 금지하거나 선입금 사기 정황이 있으면 그 사유로 신고할 수 있습니다.';
    level = 'low';
  } else if (ratio < 1.2) {
    verdict = '약함';
    note = '웃돈이 크지 않습니다. 수수료·배송비를 웃돈으로 오인하지 않았는지 확인하세요. ' +
      '약관 위반이나 매크로 정황 같은 별도 근거가 있을 때 신고하는 편이 좋습니다.';
    level = 'low';
  } else if (ratio < 2) {
    verdict = '신고 가능';
    note = '정가를 뚜렷하게 초과하는 웃돈입니다. 플랫폼·예매처 신고가 가장 실효적입니다.';
    level = 'mid';
  } else {
    verdict = '신고 권장';
    note = '정가의 2배 이상을 요구하고 있습니다. 조직적 매입 정황이 함께 있으면 ' +
      '플랫폼 신고와 함께 공연 암표 신고 창구에도 접수하는 것을 권합니다.';
    level = 'high';
  }

  return { diff, ratio, verdict, note, level };
}

function renderAnalysis() {
  const d = collect();
  const a = analyze(d);

  $('statDiff').textContent = d.faceValue && d.askPrice
    ? (a.diff > 0 ? '+' : '') + formatWon(a.diff)
    : '—';
  $('statRatio').textContent = a.ratio ? a.ratio.toFixed(1) + '배' : '—';
  $('statVerdict').textContent = a.verdict;
  $('statVerdict').className = 'stat-value verdict-' + a.level;
  $('analysisNote').textContent = a.note;
}

/* ---------- 중복 확인 ---------- */

function findDuplicates(d) {
  const log = readStorage();
  return log.filter((row) => {
    const sameUrl = d.url && row.url && row.url === d.url;
    const sameSeller = d.seller && row.seller &&
      row.seller === d.seller && row.eventName === d.eventName;
    return sameUrl || sameSeller;
  });
}

/* ---------- 신고문 생성 ---------- */

function buildReport(d, channel) {
  const a = analyze(d);
  const lines = [];
  const L = (s) => lines.push(s === undefined ? '' : s);

  const typeLabel = d.reportType === 'purchase' ? '부정구매' : '부정판매';
  L(`[입장권 ${typeLabel}(암표) 신고] ${d.eventName}`);
  L();
  L('■ 1. 신고 대상');
  L(`- 판매 경로: ${d.platform}`);
  if (d.url) L(`- 판매글 주소: ${d.url}`);
  if (d.seller) L(`- 판매자 식별정보: ${d.seller}`);
  L();
  L('■ 2. 공연·경기 정보');
  L(`- 명칭: ${d.eventName}`);
  if (d.eventDate) L(`- 일시: ${d.eventDate}`);
  if (d.venue) L(`- 장소: ${d.venue}`);
  if (d.seat) L(`- 좌석번호: ${d.seat}`);
  if (d.bookingRef) L(`- 예매번호: ${d.bookingRef}`);
  L();
  L('■ 3. 가격');
  L(`- 정가(1매): ${formatWon(d.faceValue)}`);
  L(`- 요구 금액(1매): ${formatWon(d.askPrice)}`);
  L(`- 웃돈: ${(a.diff > 0 ? '+' : '') + formatWon(a.diff)} (정가의 ${a.ratio.toFixed(1)}배)`);
  L();
  L('■ 4. 발견 경위 및 정황');
  L(d.context);
  L();

  if (d.grounds.length) {
    L('■ 5. 부정판매 의심 근거');
    d.grounds.forEach((g, i) => L(`${i + 1}) ${g}`));
    L();
  }

  if (d.evidence.length) {
    L('■ 6. 첨부 가능한 증거자료');
    d.evidence.forEach((e, i) => L(`${i + 1}) ${e}`));
    L();
  }

  L('■ 7. 요청 사항');
  L(channel.ask);
  L();

  if (channel.id === 'ecrm') {
    L('■ 8. 피해 여부');
    L('- 금전 피해: (있음 / 없음 — 해당하는 쪽을 남기고 금액·입금일시를 적어주세요)');
    L('- 입금 계좌: (있으면 기재)');
    L();
  }

  if (d.reporterName || d.reporterContact) {
    L('■ 신고인');
    if (d.reporterName) L(`- 성명: ${d.reporterName}`);
    if (d.reporterContact) L(`- 연락처: ${d.reporterContact}`);
    L();
  }

  L(`※ 위 내용은 신고인이 ${new Date().toLocaleDateString('ko-KR')} 기준으로 직접 확인한 사실에 기초하여 작성했습니다.`);

  return lines.join('\n');
}

/* ---------- 채널 UI ---------- */

function renderChannels() {
  const box = $('channelList');
  box.innerHTML = '';

  CHANNELS.forEach((ch) => {
    const card = document.createElement('div');
    card.className = 'channel-card' + (ch.id === selectedChannel.id ? ' active' : '');

    const title = document.createElement('div');
    title.className = 'channel-name';
    title.textContent = ch.name;

    const desc = document.createElement('div');
    desc.className = 'channel-desc';
    desc.textContent = ch.desc;

    const hint = document.createElement('div');
    hint.className = 'channel-hint';
    hint.textContent = '경로: ' + ch.urlHint;

    card.append(title, desc, hint);

    if (ch.url) {
      const link = document.createElement('a');
      link.className = 'channel-link';
      link.href = ch.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '신고 창구 열기 ↗';
      link.addEventListener('click', (e) => e.stopPropagation());
      card.appendChild(link);
    }

    card.addEventListener('click', () => {
      selectedChannel = ch;
      renderChannels();
      if (lastGenerated) generate();
    });

    box.appendChild(card);
  });
}

/* ---------- 기록 UI ---------- */

function renderLog() {
  const log = readStorage();
  $('logCount').textContent = log.length + '건';

  const box = $('logTable');
  if (!log.length) {
    box.innerHTML = '<p class="hint">저장된 신고 기록이 없습니다.</p>';
    return;
  }

  box.innerHTML = '';
  log.slice().reverse().forEach((row) => {
    const item = document.createElement('div');
    item.className = 'log-row';

    const main = document.createElement('div');
    main.className = 'log-main';
    main.textContent = `${row.eventName} · ${row.seller || row.url || '판매자 미기재'}`;

    const meta = document.createElement('div');
    meta.className = 'log-meta';
    meta.textContent = [
      row.savedAt,
      row.channelName,
      `정가 ${formatWon(row.faceValue)} → ${formatWon(row.askPrice)}`,
      `${row.ratio}배`
    ].join(' | ');

    const del = document.createElement('button');
    del.className = 'btn btn-ghost btn-small';
    del.textContent = '삭제';
    del.addEventListener('click', () => {
      const next = readStorage().filter((r) => r.id !== row.id);
      writeStorage(next);
      renderLog();
    });

    item.append(main, meta, del);
    box.appendChild(item);
  });
}

function exportCsv() {
  const log = readStorage();
  if (!log.length) {
    alert('내보낼 기록이 없습니다.');
    return;
  }

  const headers = ['저장일시', '신고채널', '공연명', '공연일시', '장소', '좌석번호', '예매번호',
    '판매경로', '판매자', '판매글주소', '정가', '요구금액', '배율', '의심근거'];

  const escape = (v) => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';

  const rows = log.map((r) => [
    r.savedAt, r.channelName, r.eventName, r.eventDate, r.venue, r.seat, r.bookingRef,
    r.platform, r.seller, r.url, r.faceValue, r.askPrice, r.ratio,
    (r.grounds || []).join(' / ')
  ].map(escape).join(','));

  // BOM을 붙여 엑셀에서 한글이 깨지지 않게 한다.
  const csv = '﻿' + [headers.map(escape).join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  // 파일명은 ASCII로 둔다. 한글 파일명은 일부 브라우저에서 무시되고 'download'로 저장된다.
  link.download = `scalping-report-log_${new Date().toISOString().slice(0, 10)}.csv`;
  // download 속성이 무시되지 않도록 문서에 붙인 뒤 클릭하고, 저장이 시작된 다음 해제한다.
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}

/* ---------- 경고 표시 ---------- */

function showWarnings(messages) {
  const box = $('warnBox');
  if (!messages.length) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  box.classList.remove('hidden');
  box.innerHTML = '';
  messages.forEach((m) => {
    const p = document.createElement('p');
    p.innerHTML = m;
    box.appendChild(p);
  });
}

/* ---------- 액션 ---------- */

function generate() {
  const d = collect();
  const missing = missingFields(d);

  if (missing.length) {
    showWarnings(['다음 항목을 채워주세요: <strong>' + missing.join(', ') + '</strong>']);
    $('output').value = '';
    $('copyBtn').disabled = true;
    $('saveBtn').disabled = true;
    lastGenerated = null;
    return;
  }

  const warnings = [];
  const a = analyze(d);

  if (a.diff <= 0) {
    warnings.push('요구 금액이 정가 이하입니다. 웃돈이 없는 양도는 암표 신고 대상이 아닐 수 있습니다.');
  }
  if (!d.evidence.length) {
    warnings.push('증거자료를 하나도 체크하지 않았습니다. 캡처 없이 접수하면 확인이 어려워 대부분 종결됩니다. 먼저 판매글을 캡처해두세요.');
  }
  const dups = findDuplicates(d);
  if (dups.length) {
    warnings.push(`같은 대상에 대한 기록이 이미 <strong>${dups.length}건</strong> 있습니다 (최근: ${dups[dups.length - 1].savedAt}, ${dups[dups.length - 1].channelName}). 중복 접수는 처리를 늦춥니다.`);
  }

  showWarnings(warnings);

  const text = buildReport(d, selectedChannel);
  $('output').value = text;
  $('copyBtn').disabled = false;
  $('saveBtn').disabled = false;
  lastGenerated = { data: d, channel: selectedChannel, text, ratio: a.ratio };
}

async function copyOutput() {
  const text = $('output').value;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    flash($('copyBtn'), '복사됨');
  } catch (e) {
    // 클립보드 권한이 없는 환경 대비
    $('output').removeAttribute('readonly');
    $('output').select();
    const ok = document.execCommand && document.execCommand('copy');
    $('output').setAttribute('readonly', 'readonly');
    flash($('copyBtn'), ok ? '복사됨' : '복사 실패 — 직접 선택하세요');
  }
}

function saveToLog() {
  if (!lastGenerated) return;
  const { data: d, channel, ratio } = lastGenerated;

  const log = readStorage();
  log.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    savedAt: new Date().toLocaleString('ko-KR'),
    channelId: channel.id,
    channelName: channel.name,
    eventName: d.eventName,
    eventDate: d.eventDate,
    venue: d.venue,
    seat: d.seat,
    bookingRef: d.bookingRef,
    platform: d.platform,
    seller: d.seller,
    url: d.url,
    faceValue: d.faceValue,
    askPrice: d.askPrice,
    ratio: ratio.toFixed(1),
    grounds: d.grounds
  });

  if (writeStorage(log)) {
    renderLog();
    flash($('saveBtn'), '저장됨');
  } else {
    alert('브라우저 저장공간을 사용할 수 없어 기록을 저장하지 못했습니다. CSV로 내보내 보관하세요.');
  }
}

function flash(btn, message) {
  const original = btn.textContent;
  btn.textContent = message;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 1500);
}

function resetInputs() {
  if (!confirm('입력한 대상 정보를 모두 지웁니다. 계속할까요? (신고 기록은 유지됩니다)')) return;

  ['eventName', 'eventDate', 'venue', 'seat', 'bookingRef', 'faceValue', 'askPrice',
    'seller', 'url', 'context'].forEach((id) => { $(id).value = ''; });
  $('platform').value = '';
  document.querySelectorAll('#groundsBox input, #evidenceBox input')
    .forEach((el) => { el.checked = false; });
  $('confirmCheck').checked = false;
  $('output').value = '';
  lastGenerated = null;
  $('generateBtn').disabled = true;
  $('copyBtn').disabled = true;
  $('saveBtn').disabled = true;
  showWarnings([]);
  renderAnalysis();
}

/* ---------- 모드 전환 ---------- */

function setMode(mode) {
  document.querySelectorAll('.mode-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
  document.querySelectorAll('.mode-panel').forEach((p) => {
    p.classList.toggle('hidden', p.dataset.modePanel !== mode);
  });
  $('modeDesc').textContent = MODE_DESC[mode] || '';
}

/* ---------- 감시 목록 ---------- */

function renderWatchlist() {
  const list = readStorage(WATCHLIST_KEY);
  const box = $('watchlistTable');

  if (!list.length) {
    box.innerHTML = '<p class="hint">등록된 공연이 없습니다. 공연명과 정가를 넣고 추가하세요.</p>';
    return;
  }

  box.innerHTML = '';
  list.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'log-row';

    const main = document.createElement('div');
    main.className = 'log-main';
    main.textContent = item.eventName;

    const meta = document.createElement('div');
    meta.className = 'log-meta';
    meta.textContent = [
      `정가 ${formatWon(item.faceValue)}`,
      `기준 ${item.minRatio}배 이상`,
      item.keywords ? `키워드: ${item.keywords}` : '키워드 없음'
    ].join(' | ');

    const del = document.createElement('button');
    del.className = 'btn btn-ghost btn-small';
    del.textContent = '삭제';
    del.addEventListener('click', () => {
      writeStorage(readStorage(WATCHLIST_KEY).filter((w) => w.id !== item.id), WATCHLIST_KEY);
      renderWatchlist();
    });

    row.append(main, meta, del);
    box.appendChild(row);
  });
}

function addWatchItem() {
  const eventName = $('wlName').value.trim();
  const faceValue = toNumber($('wlFace').value);
  const ratio = parseFloat($('wlRatio').value) || 1.5;

  if (!eventName || !faceValue) {
    alert('공연명과 정가는 반드시 입력해야 합니다. 정가가 없으면 배율을 계산할 수 없습니다.');
    return;
  }

  const list = readStorage(WATCHLIST_KEY);
  list.push({
    id: newId(),
    eventName: eventName,
    faceValue: faceValue,
    keywords: $('wlKeywords').value.trim(),
    minRatio: ratio < 1 ? 1.5 : ratio
  });

  if (!writeStorage(list, WATCHLIST_KEY)) {
    alert('브라우저 저장공간을 사용할 수 없어 감시 목록을 저장하지 못했습니다.');
    return;
  }

  ['wlName', 'wlFace', 'wlKeywords', 'wlRatio'].forEach((id) => { $(id).value = ''; });
  renderWatchlist();
}

/* ---------- 판매 경로 추측 ---------- */

const PLATFORM_HINTS = [
  { re: /daangn|당근/i, value: '중고거래 앱(당근·번개장터 등)' },
  { re: /bunjang|번개장터/i, value: '중고거래 앱(당근·번개장터 등)' },
  { re: /joonggonara|중고나라|cafe\.naver/i, value: '중고거래 커뮤니티/카페' },
  { re: /twitter\.com|x\.com|트위터/i, value: 'X(트위터)' },
  { re: /instagram|인스타/i, value: '인스타그램' },
  { re: /open\.kakao|오픈채팅|텔레그램|t\.me/i, value: '오픈채팅·텔레그램' },
  { re: /interpark|yes24|ticketlink|melon|예매처/i, value: '공식 예매처 내 2차거래' }
];

function guessPlatform(text) {
  for (const hint of PLATFORM_HINTS) {
    if (hint.re.test(text)) return hint.value;
  }
  return '';
}

/* ---------- 후보 큐 ---------- */

let lastScanSummary = '';

function scanBulk() {
  const text = $('bulkInput').value.trim();
  if (!text) {
    alert('검색 결과를 붙여넣어 주세요.');
    return;
  }

  const catalog = readStorage(WATCHLIST_KEY);
  if (!catalog.length) {
    alert('먼저 감시 목록에 공연과 정가를 등록하세요. 정가가 없으면 신고 조건을 판정할 수 없습니다.');
    return;
  }

  const results = window.ListingParser.parseSearchResults(text, { catalog: catalog });
  const queue = readStorage(QUEUE_KEY);
  const log = readStorage(STORAGE_KEY);

  let added = 0, below = 0, unknown = 0, duplicate = 0;

  results.forEach((r) => {
    const entry = r.catalogEntry;
    const f = r.fields;

    // 감시 목록에 없는 공연은 정가 기준이 없어 판정할 수 없다.
    if (!entry) { unknown++; return; }

    const excerpt = r.raw.replace(/\s+/g, ' ').trim().slice(0, 300);

    // 이미 큐에 있거나 이미 신고 기록이 있는 대상은 건너뛴다.
    const dupInQueue = queue.some((q) => q.excerpt === excerpt);
    const dupInLog = log.some((l) =>
      l.eventName === entry.eventName && f.seller && l.seller === f.seller);
    if (dupInQueue || dupInLog) { duplicate++; return; }

    if (!f.askPrice) { unknown++; return; }

    const ratio = f.askPrice / entry.faceValue;
    if (ratio < entry.minRatio) { below++; return; }

    queue.push({
      id: newId(),
      foundAt: new Date().toLocaleString('ko-KR'),
      eventName: entry.eventName,
      eventDate: f.eventDate,
      seat: f.seat,
      bookingRef: f.bookingRef,
      faceValue: entry.faceValue,
      askPrice: f.askPrice,
      ratio: Number(ratio.toFixed(2)),
      seller: f.seller,
      platform: guessPlatform(r.raw),
      grounds: r.grounds,
      signalLabels: r.signalLabels,
      warnings: r.warnings,
      excerpt: excerpt
    });
    added++;
  });

  writeStorage(queue, QUEUE_KEY);

  lastScanSummary = `총 ${results.length}건 분석 → 후보 ${added}건 추가` +
    `, 기준 미달 ${below}건, 판정 불가 ${unknown}건, 중복 ${duplicate}건 제외.`;

  renderQueue();

  if (!added) {
    alert('조건을 넘는 판매글을 찾지 못했습니다.\n\n' + lastScanSummary);
  }
}

function renderQueue() {
  const queue = readStorage(QUEUE_KEY);
  $('queueCount').textContent = queue.length + '건';

  const box = $('queueTable');
  box.innerHTML = '';

  if (lastScanSummary) {
    const s = document.createElement('p');
    s.className = 'scan-summary';
    s.textContent = lastScanSummary;
    box.appendChild(s);
  }

  if (!queue.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = '후보가 없습니다. 검색 결과를 붙여넣고 후보 추출을 눌러주세요.';
    box.appendChild(p);
    return;
  }

  queue.slice().reverse().forEach((c) => {
    const row = document.createElement('div');
    row.className = 'queue-row';

    const head = document.createElement('div');
    head.className = 'queue-head';

    const title = document.createElement('span');
    title.className = 'log-main';
    title.textContent = c.eventName;

    const badge = document.createElement('span');
    badge.className = 'ratio-badge ' + (c.ratio >= 2 ? 'high' : 'mid');
    badge.textContent = c.ratio + '배';

    head.append(title, badge);

    const meta = document.createElement('div');
    meta.className = 'log-meta';
    meta.textContent = [
      `${formatWon(c.faceValue)} → ${formatWon(c.askPrice)}`,
      c.seat || '좌석 미확인',
      c.seller || '판매자 미확인',
      c.platform || '경로 미확인'
    ].join(' | ');

    const excerpt = document.createElement('div');
    excerpt.className = 'queue-excerpt';
    excerpt.textContent = c.excerpt;

    const actions = document.createElement('div');
    actions.className = 'btn-row queue-actions';

    const use = document.createElement('button');
    use.className = 'btn btn-small btn-primary';
    use.textContent = '양식에 채우기';
    use.addEventListener('click', () => loadCandidate(c.id));

    const drop = document.createElement('button');
    drop.className = 'btn btn-ghost btn-small';
    drop.textContent = '제외';
    drop.addEventListener('click', () => {
      writeStorage(readStorage(QUEUE_KEY).filter((q) => q.id !== c.id), QUEUE_KEY);
      renderQueue();
    });

    actions.append(use, drop);
    row.append(head, meta, excerpt);

    if (c.signalLabels && c.signalLabels.length) {
      const tags = document.createElement('div');
      tags.className = 'tag-row';
      c.signalLabels.forEach((l) => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = l;
        tags.appendChild(tag);
      });
      row.appendChild(tags);
    }

    row.appendChild(actions);
    box.appendChild(row);
  });
}

/* ---------- 발견 경위 초안 ---------- */

function draftContext(src) {
  const ratio = src.faceValue ? (src.askPrice / src.faceValue).toFixed(1) : '?';
  const lines = [
    `${new Date().toLocaleDateString('ko-KR')} ${src.platform || '(판매 경로)'}에서 '${src.eventName}' 관련 판매글을 발견했습니다.`,
    `정가 ${formatWon(src.faceValue)} 좌석을 ${formatWon(src.askPrice)}(정가의 ${ratio}배)에 판매하고 있습니다.`
  ];
  if (src.signalLabels && src.signalLabels.length) {
    lines.push(`판매글에서 다음 정황이 확인됩니다: ${src.signalLabels.join(', ')}.`);
  }
  if (src.excerpt) {
    lines.push(`판매글 원문 일부: "${src.excerpt}"`);
  }
  lines.push('(※ 이 내용은 자동 생성된 초안입니다. 직접 확인한 사실에 맞게 고쳐주세요.)');
  return lines.join('\n');
}

function fillForm(src) {
  if (src.eventName) $('eventName').value = src.eventName;
  if (src.eventDate) $('eventDate').value = src.eventDate;
  if (src.venue) $('venue').value = src.venue;
  if (src.seat) $('seat').value = src.seat;
  if (src.bookingRef) $('bookingRef').value = src.bookingRef;
  if (src.faceValue) $('faceValue').value = src.faceValue.toLocaleString('ko-KR');
  if (src.askPrice) $('askPrice').value = src.askPrice.toLocaleString('ko-KR');
  if (src.seller) $('seller').value = src.seller;
  if (src.url) $('url').value = src.url;

  if (src.platform) {
    const option = Array.from($('platform').options).find((o) => o.value === src.platform);
    if (option) $('platform').value = src.platform;
  }

  if (src.grounds && src.grounds.length) {
    $('groundsBox').querySelectorAll('input[type="checkbox"]').forEach((el) => {
      if (src.grounds.includes(el.value)) el.checked = true;
    });
  }

  if (src.draftContext && !$('context').value.trim()) {
    $('context').value = draftContext(src);
  }

  // 자동으로 채운 값은 사실 확인을 다시 받는다.
  $('confirmCheck').checked = false;
  $('generateBtn').disabled = true;
  $('copyBtn').disabled = true;
  $('saveBtn').disabled = true;
  $('output').value = '';
  lastGenerated = null;

  renderAnalysis();

  const notes = ['자동으로 채운 값입니다. <strong>각 항목과 발견 경위를 직접 확인하고 고친 뒤</strong> 아래 확인란을 체크하세요.'];
  if (src.warnings && src.warnings.length) notes.push(...src.warnings);

  // 자동 추출로는 채워지지 않는 항목(특히 판매 경로)을 바로 알려준다.
  const still = missingFields(collect());
  if (still.length) {
    notes.push('아직 비어 있는 필수 항목: <strong>' + still.join(', ') + '</strong>');
  }

  showWarnings(notes);

  $('formSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function loadCandidate(id) {
  const c = readStorage(QUEUE_KEY).find((q) => q.id === id);
  if (!c) return;
  fillForm(Object.assign({}, c, { draftContext: true }));
}

/* ---------- 북마클릿 ---------- */

/* 판매글 페이지에서 실행돼 제목·본문·주소를 이 페이지로 넘긴다.
 * 사용자의 브라우저가 이미 그려 놓은 화면을 읽으므로 로그인이 필요한 앱이나
 * 자바스크립트로 본문을 그리는 사이트에서도 그대로 동작한다. */
function buildBookmarklet() {
  const target = location.origin + location.pathname;
  const src = `(function(){
try{
var s=(window.getSelection&&String(window.getSelection())||'').trim();
var t=s||(document.body&&document.body.innerText||'');
t=t.replace(/[ \\t]+/g,' ').replace(/\\n{3,}/g,'\\n\\n').trim().slice(0,6000);
var d={u:location.href,t:document.title||'',x:t};
window.open('${target}#listing='+encodeURIComponent(JSON.stringify(d)),'_blank');
}catch(e){alert('수집에 실패했습니다: '+e.message);}
})()`.replace(/\n/g, '');

  return 'javascript:' + encodeURIComponent(src);
}

/** 북마클릿이 넘긴 데이터를 받아 바로 분석한다. */
function consumeBookmarkletPayload() {
  const match = location.hash.match(/^#listing=(.*)$/);
  if (!match) return false;

  let payload;
  try {
    payload = JSON.parse(decodeURIComponent(match[1]));
  } catch (e) {
    console.warn('북마클릿 데이터를 읽을 수 없습니다:', e);
    return false;
  }

  // 주소창에 본문이 남아 있지 않도록 즉시 지운다.
  history.replaceState(null, '', location.pathname + location.search);

  setMode('url');
  $('fetchUrl').value = payload.u || '';
  $('pasteInput').value = [payload.t, payload.x].filter(Boolean).join('\n\n');

  showFetchStatus('북마클릿으로 판매글을 가져왔습니다. 추출 결과를 확인하세요.', false);
  runParse();
  $('extractPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

/* ---------- 주소·본문 분석 ---------- */

let lastExtract = null;

function showFetchStatus(message, isError) {
  const box = $('fetchStatus');
  if (!message) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  box.classList.remove('hidden');
  box.className = 'warn-box' + (isError ? '' : ' info');
  box.innerHTML = '<p>' + message + '</p>';
}

async function fetchListing() {
  const url = $('fetchUrl').value.trim();
  if (!url) {
    alert('판매글 주소를 입력하세요.');
    return;
  }

  showFetchStatus('페이지를 읽고 있습니다…', false);
  $('fetchBtn').disabled = true;

  try {
    const res = await fetch('/api/fetch-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });

    if (!res.ok) {
      showFetchStatus(
        `페이지 조회 기능을 쓸 수 없습니다 (HTTP ${res.status}). ` +
        '배포된 서버에서만 동작합니다. <strong>판매글 본문을 복사해 아래에 붙여넣으면</strong> 그대로 분석됩니다.',
        true
      );
      return;
    }

    const data = await res.json();

    if (!data.ok) {
      showFetchStatus(
        `${data.error || '페이지를 읽지 못했습니다.'} ${data.hint || ''}`.trim(),
        true
      );
      return;
    }

    const parts = [data.meta.title, data.meta.description, data.text].filter(Boolean);
    $('pasteInput').value = parts.join('\n\n');

    showFetchStatus(
      data.wall
        ? `${data.wall} 읽어온 내용이 부족하면 판매글 본문을 직접 붙여넣어 주세요.`
        : '페이지를 읽었습니다. 아래 내용을 확인하고 분석을 눌러주세요.',
      Boolean(data.wall)
    );

    runParse();
  } catch (e) {
    showFetchStatus(
      '페이지 조회에 실패했습니다: ' + (e.message || e) +
      '. 판매글 본문을 복사해 아래에 붙여넣으면 그대로 분석됩니다.',
      true
    );
  } finally {
    $('fetchBtn').disabled = false;
  }
}

const EXTRACT_LABELS = {
  eventName: '공연·경기명',
  eventDate: '공연 일시',
  seat: '좌석번호',
  bookingRef: '예매번호',
  faceValue: '정가',
  askPrice: '요구 금액',
  seller: '판매자',
  url: '판매글 주소'
};

const CONF_LABELS = { high: '높음', mid: '보통', low: '확인 필요' };

function runParse() {
  const text = $('pasteInput').value.trim();
  if (!text) {
    alert('판매글 본문을 붙여넣거나 주소로 페이지를 읽어주세요.');
    return;
  }

  const result = window.ListingParser.parseListing(text, {
    catalog: readStorage(WATCHLIST_KEY),
    url: $('fetchUrl').value.trim()
  });

  result.fields.platform = guessPlatform(text + ' ' + $('fetchUrl').value);
  lastExtract = result;
  renderExtract(result);
}

function renderExtract(result) {
  const box = $('extractTable');
  box.innerHTML = '';

  Object.keys(EXTRACT_LABELS).forEach((key) => {
    const value = result.fields[key];
    const conf = result.confidence[key] || 'low';
    const display = typeof value === 'number'
      ? (value ? formatWon(value) : '')
      : (value || '');

    const row = document.createElement('label');
    row.className = 'extract-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.field = key;
    cb.disabled = !display;
    // 신뢰도가 낮은 값은 기본으로 적용하지 않는다.
    cb.checked = Boolean(display) && conf !== 'low';

    const name = document.createElement('span');
    name.className = 'extract-name';
    name.textContent = EXTRACT_LABELS[key];

    const val = document.createElement('span');
    val.className = 'extract-value' + (display ? '' : ' empty');
    val.textContent = display || '추출 실패 — 직접 입력하세요';

    const badge = document.createElement('span');
    badge.className = 'conf-badge conf-' + conf;
    badge.textContent = CONF_LABELS[conf];

    row.append(cb, name, val, badge);
    box.appendChild(row);
  });

  if (result.signalLabels.length) {
    const tags = document.createElement('div');
    tags.className = 'tag-row';
    const lead = document.createElement('span');
    lead.className = 'hint';
    lead.textContent = '감지된 정황: ';
    tags.appendChild(lead);
    result.signalLabels.forEach((l) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = l;
      tags.appendChild(tag);
    });
    box.appendChild(tags);
  }

  if (result.warnings.length) {
    const warn = document.createElement('div');
    warn.className = 'warn-box';
    result.warnings.forEach((w) => {
      const p = document.createElement('p');
      p.textContent = w;
      warn.appendChild(p);
    });
    box.appendChild(warn);
  }

  $('extractPanel').classList.remove('hidden');
}

function applyExtract() {
  if (!lastExtract) return;

  const picked = {};
  $('extractTable').querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    if (cb.checked) picked[cb.dataset.field] = lastExtract.fields[cb.dataset.field];
  });

  picked.platform = lastExtract.fields.platform;
  picked.grounds = lastExtract.grounds;
  picked.signalLabels = lastExtract.signalLabels;
  picked.warnings = lastExtract.warnings;
  picked.excerpt = lastExtract.raw.replace(/\s+/g, ' ').trim().slice(0, 300);
  picked.draftContext = Boolean(picked.eventName && picked.askPrice);

  fillForm(picked);
}

/* ---------- 초기화 ---------- */

document.addEventListener('DOMContentLoaded', () => {
  renderChannels();
  renderAnalysis();
  renderLog();
  renderWatchlist();
  renderQueue();
  setMode('auto');

  document.querySelectorAll('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  });

  const bookmarklet = buildBookmarklet();
  $('bookmarklet').setAttribute('href', bookmarklet);
  $('bookmarklet').addEventListener('click', (e) => {
    e.preventDefault();
    alert('이 버튼은 눌러서 쓰는 게 아니라 북마크 바로 끌어다 놓는 것입니다.\n' +
      '그 다음 판매글 페이지에서 북마크를 누르세요.');
  });

  $('copyBookmarkletBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(decodeURIComponent(bookmarklet));
      flash($('copyBookmarkletBtn'), '복사됨 — 북마크 주소란에 붙여넣기');
    } catch (e) {
      flash($('copyBookmarkletBtn'), '복사 실패');
    }
  });

  consumeBookmarkletPayload();

  $('wlAddBtn').addEventListener('click', addWatchItem);
  $('scanBtn').addEventListener('click', scanBulk);
  $('fetchBtn').addEventListener('click', fetchListing);
  $('parseBtn').addEventListener('click', runParse);
  $('applyBtn').addEventListener('click', applyExtract);

  $('clearQueueBtn').addEventListener('click', () => {
    if (!confirm('후보 큐를 비웁니다. 계속할까요?')) return;
    writeStorage([], QUEUE_KEY);
    lastScanSummary = '';
    renderQueue();
  });

  ['faceValue', 'askPrice'].forEach((id) => {
    $(id).addEventListener('input', renderAnalysis);
    // 자릿수 오입력을 줄이기 위해 포커스를 벗어나면 천 단위로 끊어 보여준다.
    $(id).addEventListener('blur', (e) => {
      const n = toNumber(e.target.value);
      e.target.value = n ? n.toLocaleString('ko-KR') : '';
    });
  });

  // 확인 체크 없이는 신고문을 만들 수 없다.
  $('confirmCheck').addEventListener('change', (e) => {
    $('generateBtn').disabled = !e.target.checked;
    if (!e.target.checked) {
      $('copyBtn').disabled = true;
      $('saveBtn').disabled = true;
    }
  });

  const updateRewardHint = () => {
    $('rewardHint').textContent = REWARD_INFO[$('reportType').value] || '';
  };
  $('reportType').addEventListener('change', updateRewardHint);
  updateRewardHint();

  $('bookingRef').addEventListener('input', () => { if (lastGenerated) generate(); });

  $('generateBtn').addEventListener('click', generate);
  $('copyBtn').addEventListener('click', copyOutput);
  $('saveBtn').addEventListener('click', saveToLog);
  $('resetBtn').addEventListener('click', resetInputs);
  $('exportBtn').addEventListener('click', exportCsv);

  $('clearLogBtn').addEventListener('click', () => {
    if (!confirm('신고 기록을 전부 삭제합니다. 복구할 수 없습니다. 계속할까요?')) return;
    writeStorage([]);
    renderLog();
  });
});
