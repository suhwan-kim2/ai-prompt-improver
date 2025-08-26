//questions.js

import { SlotSystem } from "../utils/slotSystem.js";
import { IntentAnalyzer } from "../utils/intentAnalyzer.js";
import { MentionExtractor } from "../utils/mentionExtractor.js";
import { readJson } from "./_helpers.js";

const slots = new SlotSystem();
const analyzer = new IntentAnalyzer(slots, new MentionExtractor());

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { domain = "dev", userInput = "", answers = [] } = await readJson(req);

  const report = analyzer.generateAnalysisReport(userInput, answers, { primary: domain });
  const missing = report.missingSlots || [];
  const questions = slots.questionsFor(missing, domain).slice(0, 2);

  res.status(200).json({ questions, missing, intentScore: report.intentScore });
}
