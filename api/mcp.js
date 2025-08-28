//mcp

import { readJson } from "./helpers.js";

// 컷오프 충족 시만 중계. 데모에선 echo.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const payload = await readJson(req);
  const i = payload?.intent?.intentScore ?? 0;
  const p = payload?.prompt?.total ?? 0;

  if (i >= 95 && p >= 95) {
    // 실제 연결시: fetch(endpoint, {method:"POST", headers:{...}, body: JSON.stringify(payload)})
    return res.status(200).json({
      ok: true,
      routedTo: payload?.intent?.domain || "dev",
      received: payload
    });
  }
  return res.status(400).json({ ok: false, error: "cutoff_not_met", scores: { intent: i, prompt: p } });
}
