/* 시스템 클립보드에 텍스트를 넣는다.
 * 운영체제마다 도구가 달라 있는 것을 찾아 쓴다. */
import { spawn } from 'child_process';

const CANDIDATES = {
  win32: [['clip', []]],
  darwin: [['pbcopy', []]],
  linux: [['wl-copy', []], ['xclip', ['-selection', 'clipboard']], ['xsel', ['--clipboard', '--input']]]
};

function tryCopy(cmd, args, text) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    } catch (e) {
      return resolve(false);
    }
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
    try {
      // clip.exe 는 UTF-8 을 그대로 받으면 한글이 깨진다. UTF-16LE 로 넘긴다.
      child.stdin.end(Buffer.from(text, cmd === 'clip' ? 'utf16le' : 'utf8'));
    } catch (e) {
      resolve(false);
    }
  });
}

export async function copyToClipboard(text) {
  for (const [cmd, args] of (CANDIDATES[process.platform] || [])) {
    if (await tryCopy(cmd, args, text)) return true;
  }
  return false;
}

/** 기본 브라우저로 주소를 연다. */
export function openInBrowser(url) {
  const map = {
    win32: ['cmd', ['/c', 'start', '', url]],
    darwin: ['open', [url]],
    linux: ['xdg-open', [url]]
  };
  const entry = map[process.platform];
  if (!entry) return false;
  try {
    const child = spawn(entry[0], entry[1], { stdio: 'ignore', detached: true });
    // 여는 도구가 없으면 'error' 이벤트로 오는데, 받아두지 않으면 프로그램이 통째로 죽는다.
    child.on('error', () => {});
    child.unref();
    return true;
  } catch (e) {
    return false;
  }
}
