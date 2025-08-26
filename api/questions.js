// api/questions.js
import { SlotSystem } from "../utils/slotSystem.js";
import { IntentAnalyzer } from "../utils/intentAnalyzer.js";
import { MentionExtractor } from "../utils/mentionExtractor.js";
import { QuestionOptimizer } from "../utils/questionOptimizer.js";
import { readJson } from "./helpers.js";

const slots = new SlotSystem();
const analyzer = new IntentAnalyzer(slots, new MentionExtractor());
const qo = new QuestionOptimizer();

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const { domain = "dev", userInput = "", answers = [], askedKeys = [], promptScore = 0 } = await readJson(req);

    const report = analyzer.generateAnalysisReport(userInput, answers, { primary: domain });

    let missing = report.missingSlots || [];
    const asked = new Set(Array.isArray(askedKeys) ? askedKeys : []);
    missing = missing.filter(k => !asked.has(k));

    // 질문 중단 조건: 의도95↑ AND 프롬프트95↑, 또는 아예 물을 게 없음
    if ((report.intentScore >= 95 && promptScore >= 95) || missing.length === 0) {
      return res.status(200).json({ questions: [], missing, intentScore: report.intentScore });
    }

    // 질문 후보 생성
    const candidates = slots.questionsFor(missing, domain, askedKeys);
    const best = qo.optimize(candidates, {}, { primary: domain }, 2);
    const questions = (best || []).map(x => ({ key: x.key, question: x.question }));

    res.status(200).json({ questions, missing, intentScore: report.intentScore });
  } catch (e) {
    console.error("questions API error:", e);
    res.status(500).json({ error: String(e?.message || e) });
  }
}
