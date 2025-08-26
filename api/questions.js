//questions.js

import { SlotSystem } from "../utils/slotSystem.js";
import { IntentAnalyzer } from "../utils/intentAnalyzer.js";
import { MentionExtractor } from "../utils/mentionExtractor.js";
import { QuestionOptimizer } from "../utils/questionOptimizer.js";
import { readJson } from "../api/helpers.js";

const slots = new SlotSystem();
const analyzer = new IntentAnalyzer(slots, new MentionExtractor());
const qo = new QuestionOptimizer();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { domain = "dev", userInput = "", answers = [], askedKeys = [] } = await readJson(req);


  const report = analyzer.generateAnalysisReport(userInput, answers, { primary: domain });
  let missing = report.missingSlots || [];
    // 이미 물어본 키 제외
    const asked = new Set(Array.isArray(askedKeys) ? askedKeys : []);
    missing = missing.filter(k => !asked.has(k));

    // 의도 컷오프 달성 or 더 물을 게 없음 → 질문 중단
    if (report.intentScore >= 95 || missing.length === 0) {
      return res.status(200).json({ questions: [], missing, intentScore: report.intentScore });
    }

    // 중요도 기반 상위 2개만 선택(고정질문 방지)
    const questions = qo.pick(missing, domain, 2);

  res.status(200).json({ questions, missing, intentScore: report.intentScore });
}
