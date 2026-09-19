/* JSON 파일 기반 저장소. 후보 큐, 신고 완료 기록, 이미 본 매물 목록을 다룬다. */
import fs from 'fs';
import { PATHS, ensureDirs } from './config.js';

function read(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function write(file, data) {
  ensureDirs();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

export const candidates = {
  all: () => read(PATHS.candidates),
  save: (list) => write(PATHS.candidates, list),
  add(items) {
    const list = read(PATHS.candidates);
    list.push(...items);
    write(PATHS.candidates, list);
    return list.length;
  },
  remove(id) {
    write(PATHS.candidates, read(PATHS.candidates).filter((c) => c.id !== id));
  },
  update(id, patch) {
    const list = read(PATHS.candidates).map((c) => (c.id === id ? { ...c, ...patch } : c));
    write(PATHS.candidates, list);
  }
};

export const filed = {
  all: () => read(PATHS.filed),
  add(item) {
    const list = read(PATHS.filed);
    list.push(item);
    write(PATHS.filed, list);
  }
};

/* 한 번 본 매물은 다시 후보로 올리지 않는다. 같은 글을 매일 다시 보게 되면
 * 검토가 무의미해지고 중복 신고로 이어진다. */
export const seen = {
  all: () => new Set(read(PATHS.seen)),
  add(urls) {
    const set = new Set(read(PATHS.seen));
    urls.forEach((u) => set.add(u));
    // 오래된 것부터 잘라 파일이 무한정 커지지 않게 한다.
    write(PATHS.seen, Array.from(set).slice(-5000));
  }
};
