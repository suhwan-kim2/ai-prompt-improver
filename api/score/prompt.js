
//prompt.js
import { EvaluationSystem } from "../../utils/evaluationSystem.js";
import { readJson } from "../helpers.js";

const evaluator = new EvaluationSystem();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { prompt = "", domain = "development" } = await readJson(req);
  const out = evaluator.evaluatePromptQuality(prompt, domain);
  res.status(200).json(out);
}
