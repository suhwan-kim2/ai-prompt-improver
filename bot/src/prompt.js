/* 터미널 입력은 하나의 readline 인터페이스로만 받는다.
 *
 * 질문마다 인터페이스를 새로 만들면 이미 버퍼에 들어온 줄을 흘려버린다.
 * 사람이 한 줄씩 칠 때는 티가 안 나지만, 붙여넣기나 파이프 입력에서는 답이 사라진다. */
import readline from 'readline';

let io = null;

function get() {
  if (!io) {
    io = readline.createInterface({ input: process.stdin, output: process.stdout });
    io.on('close', () => { io = null; });
  }
  return io;
}

export function ask(question) {
  return new Promise((resolve) => {
    const rl = get();
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };

    // 입력이 끝났는데(EOF) 답을 기다리면 영원히 멈춘 채 조용히 끝나버린다.
    // 빈 답으로 돌려주어 각 단계가 자기 기본값으로 진행하게 한다.
    const onClose = () => done('');
    rl.once('close', onClose);

    rl.question(question, (a) => {
      rl.off('close', onClose);   // 질문마다 리스너가 쌓이지 않게 떼어낸다
      done(a.trim());
    });
  });
}

/** 프로그램이 끝날 때 한 번만 닫는다. */
export function closePrompt() {
  if (io) io.close();
  io = null;
}
