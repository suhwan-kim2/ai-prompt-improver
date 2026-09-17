/* 암표 신고 도우미
 * 신고문 작성 · 증거 정리 · 기록 관리를 돕는 클라이언트 전용 도구.
 * 어떤 신고 창구에도 자동 제출하지 않는다. 제출은 사용자가 직접 한다.
 */

const STORAGE_KEY = 'scalpingReportLog';

/* 공식 신고 창구.
 * 기관 사이트는 개편이 잦아 링크가 끊길 수 있다. 화면에도 안내 문구를 함께 띄운다. */
const CHANNELS = [
  {
    id: 'platform',
    name: '판매 플랫폼 / 예매처 신고',
    desc: '가장 빠르고 실효적. 게시글 삭제·계정 정지·예매 취소까지 이어짐',
    url: '',
    urlHint: '판매글 내 "신고" 버튼 또는 예매처 고객센터 → 부정거래 신고',
    ask: '해당 게시글 삭제 및 판매자 계정에 대한 이용제한, 부정 예매로 확인될 경우 해당 예매건 취소 조치를 요청합니다.'
  },
  {
    id: 'kopis',
    name: '공연 암표 신고 (KOPIS)',
    desc: '문화체육관광부·예술경영지원센터 운영 공연 암표 신고 창구',
    url: 'https://www.kopis.or.kr',
    urlHint: 'KOPIS 접속 → 암표 신고 게시판',
    ask: '공연 입장권 부정판매 정황에 대한 확인 및 관련 조치를 요청합니다.'
  },
  {
    id: 'ecrm',
    name: '경찰 사이버범죄 신고 (ECRM)',
    desc: '선입금 후 미이행 등 사기 피해가 있거나 매크로 부정판매가 명확할 때',
    url: 'https://ecrm.police.go.kr',
    urlHint: '경찰청 사이버범죄 신고상담시스템',
    ask: '위 행위에 대한 수사 및 법령 위반 여부 확인을 요청합니다.'
  },
  {
    id: 'epeople',
    name: '국민신문고',
    desc: '소관 기관이 불분명하거나 제도 개선을 함께 요구할 때',
    url: 'https://www.epeople.go.kr',
    urlHint: '국민신문고 → 민원 신청',
    ask: '위 사안에 대한 소관 기관의 확인 및 조치, 처리 결과 회신을 요청합니다.'
  }
];

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

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('기록을 읽을 수 없습니다:', e);
    return [];
  }
}

function writeStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.warn('기록을 저장할 수 없습니다:', e);
    return false;
  }
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

  L(`[입장권 부정판매(암표) 신고] ${d.eventName}`);
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
  if (d.seat) L(`- 좌석: ${d.seat}`);
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

  const headers = ['저장일시', '신고채널', '공연명', '공연일시', '장소', '좌석',
    '판매경로', '판매자', '판매글주소', '정가', '요구금액', '배율', '의심근거'];

  const escape = (v) => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';

  const rows = log.map((r) => [
    r.savedAt, r.channelName, r.eventName, r.eventDate, r.venue, r.seat,
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

  ['eventName', 'eventDate', 'venue', 'seat', 'faceValue', 'askPrice',
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

/* ---------- 초기화 ---------- */

document.addEventListener('DOMContentLoaded', () => {
  renderChannels();
  renderAnalysis();
  renderLog();

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
