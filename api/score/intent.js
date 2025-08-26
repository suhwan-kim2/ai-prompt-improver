import { IntentAnalyzer } from "../../utils/intentAnalyzer.js";
import { MentionExtractor } from "../../utils/mentionExtractor.js";
import { SlotSystem } from "../../utils/slotSystem.js";
import { readJson } from"../helpers.js";

const analyzer = new IntentAnalyzer(new SlotSystem(), new MentionExtractor());

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { userInput = "", answers = [], domain = "dev" } = await readJson(req);
  const report = analyzer.generateAnalysisReport(userInput, answers, { primary: domain });
  res.status(200).json(report);
}
