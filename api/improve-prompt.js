import { readJson } from "./helpers.js";
import { IntentAnalyzer } from "../utils/intentAnalyzer.js";
import { MentionExtractor } from "../utils/mentionExtractor.js";
import { SlotSystem } from "../utils/slotSystem.js";
import { EvaluationSystem } from "../utils/evaluationSystem.js";

const slots = new SlotSystem();
const analyzer = new IntentAnalyzer(slots, new MentionExtractor());
const evaluator = new EvaluationSystem();

function synthesizePrompt(input = "", answers = [], domain = "dev") {
  const header =
    domain === "dev"
      ? "[시스템] 당신은 프롬프트 개선기입니다. 의도/프롬프 95/95 달성 시 최종 출력.\n[사용자] "
      : domain === "image"
      ? "이미지 생성 프롬프트(한국어, 500자): "
      : "영상 생성 프롬프트(한국어, 500자): ";
  const body = [input, ...(answers || [])].join(" ").replace(/\s+/g, " ").trim();
  return (header + body).slice(0, 500);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { userInput = "", answers = [], domain = "dev" } = await readJson(req);

  const intent = analyzer.generateAnalysisReport(userInput, answers, { primary: domain });
  const draft = synthesizePrompt(userInput, answers, domain);
  const mapped = domain === "image" ? "visual_design" : domain === "video" ? "video" : "development";
  const pscore = evaluator.evaluatePromptQuality(draft, mapped);

  const missing = intent.missingSlots || [];
  const questions = slots.questionsFor(missing, domain).slice(0, 2);

  res.status(200).json({
    draft,
    intentScore: intent.intentScore,
    promptScore: pscore.total,
    missing,
    nextQuestions: questions,
    pass: intent.intentScore >= 95 && pscore.total >= 95
  });
}
