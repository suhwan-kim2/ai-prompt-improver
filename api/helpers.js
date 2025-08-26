// 공통 JSON 파서: req.body가 string/object/stream 어떤 형태든 안전하게 파싱
export async function readJson(req) {
  try {
    if (typeof req.body === 'string') return JSON.parse(req.body);
    if (req.body && typeof req.body === 'object') return req.body;
    const chunks = [];
    for await (const c of req) chunks.push(Buffer.from(c));
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('readJson error:', e);
    return {};
  }
}
