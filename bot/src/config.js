/* 설정과 저장소 경로.
 * 감시 목록의 정가는 사용자가 예매처에서 직접 확인해 넣은 값이어야 한다.
 * 이 값이 모든 배율 판정의 기준이므로 봇이 추측해서 채우지 않는다. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const SHOT_DIR = path.join(DATA_DIR, 'evidence');
export const CONFIG_PATH = path.join(ROOT, 'config.json');

export const PATHS = {
  candidates: path.join(DATA_DIR, 'candidates.json'),
  filed: path.join(DATA_DIR, 'filed.json'),
  seen: path.join(DATA_DIR, 'seen.json')
};

const DEFAULTS = {
  // 한 번 돌 때 상세 페이지를 여는 최대 건수. 과하게 긁지 않기 위한 상한.
  maxDetailPerRun: 20,
  // 요청 사이 대기(ms). 사이트에 부담을 주지 않도록 여유를 둔다.
  delayMs: 2000,
  // 정가 대비 이 배율 이상이면 후보로 올린다. 공연별로 덮어쓸 수 있다.
  defaultMinRatio: 1.5,
  govFormUrl: 'https://ent.kocca.kr/ticket/receive.do',
  watchlist: []
};

/* price 명령은 정가를 받아오려고 도는 것이므로 정가가 없어도 설정을 읽을 수 있어야 한다.
 * 그 외 명령은 정가가 없으면 배율을 낼 수 없으니 그대로 막는다. */
export function loadConfig({ requireFaceValue = true } = {}) {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `설정 파일이 없습니다: ${CONFIG_PATH}\n` +
      `config.example.json 을 config.json 으로 복사한 뒤 감시할 공연과 정가를 채워주세요.`
    );
  }

  const cfg = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };

  if (!Array.isArray(cfg.watchlist) || !cfg.watchlist.length) {
    throw new Error('config.json 의 watchlist 가 비어 있습니다. 감시할 공연을 한 건 이상 넣어주세요.');
  }

  cfg.watchlist.forEach((w, i) => {
    if (!w.eventName) throw new Error(`watchlist[${i}]: eventName 이 필요합니다.`);
    if (requireFaceValue && !w.faceValue) {
      throw new Error(
        `watchlist[${i}] "${w.eventName}": 정가를 알 수 없습니다.\n` +
        (w.ticketUrl
          ? '  ticketUrl 이 있으니 먼저 `npm run price` 를 돌려 정가를 받아오세요.'
          : '  faceValue 에 예매처에서 확인한 정가를 넣거나, ticketUrl 에 공연 페이지 주소를 넣고 `npm run price` 를 돌리세요.')
      );
    }
    w.minRatio = w.minRatio || cfg.defaultMinRatio;
    w.keywords = w.keywords && w.keywords.length ? w.keywords : [w.eventName];
  });

  return cfg;
}

export function ensureDirs() {
  [DATA_DIR, SHOT_DIR].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
}
