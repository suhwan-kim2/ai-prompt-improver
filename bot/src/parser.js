/* 웹 도구(public/listing-parser.js)의 파서를 그대로 가져다 쓴다.
 * 규칙을 두 벌 유지하면 금방 어긋나므로, 원본 한 곳만 고치면 되도록 했다. */
import fs from 'fs';
import path from 'path';
import { ROOT } from './config.js';

const SRC = path.resolve(ROOT, '..', 'public', 'listing-parser.js');

if (!fs.existsSync(SRC)) {
  throw new Error(`파서 파일을 찾을 수 없습니다: ${SRC}`);
}

// 원본은 (function(global){ ... })(window) 형태라 window 를 넣어주면 그대로 돈다.
const sandbox = {};
new Function('window', fs.readFileSync(SRC, 'utf8'))(sandbox);

if (!sandbox.ListingParser) {
  throw new Error('listing-parser.js 에서 ListingParser 를 얻지 못했습니다.');
}

export const ListingParser = sandbox.ListingParser;
