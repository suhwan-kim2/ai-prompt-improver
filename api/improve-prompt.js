// api/improve-prompt.js
// 핸들러 내부에서 env 읽기 + mentions 안전 처리 + 커버리지 계산 안정화

import { readJson } from "./helpers.js";
import { SlotSystem } from "../utils/slotSystem.js";
import { IntentAnalyzer } from "../utils/intentAnalyzer.js";
import { MentionExtractor } from "../utils/mentionExtractor.js";
import { QuestionOptimizer } from "../utils/questionOptimizer.js";
import { EvaluationSystem } from "../utils/evaluationSystem.js";

/* ------------------------ 유틸 함수들 (안전한 처리) ------------------------ */

// 값이 문자열이면 [문자열], 배열이면 평탄화된 문자열 배열, 객체면 값 중 문자열만 추출
function toFlatStringArray(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((v) => toFlatStringArray(v));
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((v) => toFlatStringArray(v));
  }
  return [];
}

// mentions를 프롬프트에 넣기 좋게 렌더링 (배열/객체 안전)
function stringifyMentions(mentions) {
  try {
    return Object.entries(mentions)
      .map(([key, values]) => {
        if (Array.isArray(values)) {
          const arr = toFlatStringArray(values);
          return `${key}: ${arr.join(", ")}`;
        } else if (values && typeof values === "object") {
          const kv = Object.entries(values)
            .map(([k, v]) => `${k}=${toFlatStringArray(v).join(" ")}`)
            .join(", ");
          return `${key}: ${kv}`;
        } else {
          return `${key}: ${String(values ?? "")}`;
        }
      })
      .join("\n");
  } catch {
    // 문제가 나더라도 전체 흐름을 끊지 않기 위해 폴백
    return JSON.stringify(mentions, null, 2);
  }
}

// 체크리스트 키워드가 입력/답변/멘션에 얼마나 포함되는지 측정 (문자열/객체 모두 처리)
function checkItemCoverage(item, allText, mentions) {
  const keywords = toFlatStringArray(item).map((s) => s.toLowerCase()).filter(Boolean);
  if (keywords.length === 0) return 0;

  const haystacks = [
    (allText || "").toLowerCase(),
    // mentions에서 가능한 모든 문자열을 평탄화하여 합치기
    toFlatStringArray(mentions).map((s) => s.toLowerCase()).join(" "),
  ];

  let matches = 0;
  for (const kw of keywords) {
    for (const h of haystacks) {
      if (kw && h.includes(kw)) {
        matches++;
        break;
      }
    }
  }
  return Math.min(1, matches / keywords.length); // 0~1
}

// fetch 래퍼 (OpenAI 호출용)
async function callOpenAI(apiKey, body, endpoint = "https://api.openai.com/v1/chat/completions") {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

/* ------------------------------- 메인 핸들러 ------------------------------- */

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: true, message: "Method not allowed. Use POST." });
    }

    // ✅ 런타임에 env 읽기 (빌드 캐싱 이슈 방지)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(503).json({
        error: true,
        type: "no_api_key",
        title: "🔒 API 키 없음",
        message: "OpenAI API 키가 설정되지 않았습니다.",
        debug: { where: "env", var: "OPENAI_API_KEY" },
      });
    }

    const payload = await readJson(req);
    const step = String(payload?.step || "questions");
    const userInput = String(payload?.userInput || "").trim();
    const domain = String(payload?.domain || "image").toLowerCase();
    const answers = Array.isArray(payload?.answers) ? payload.answers : [];

    // 도메인/모듈 준비
    const slotSystem = new SlotSystem();
    const intentAnalyzer = new IntentAnalyzer(slotSystem, new MentionExtractor());
    const mentionExtractor = new MentionExtractor();
    const questionOptimizer = new QuestionOptimizer();
    const evaluator = new EvaluationSystem();

    // 의도/멘션 계산
    const analysis = intentAnalyzer.generateAnalysisReport(userInput, answers, { primary: domain });
    const mentioned = mentionExtractor.extract([userInput, ...answers]);

    // 사용자 입력 + 답변을 하나의 텍스트로
    const allText = [userInput, ...answers].join("\n");

    // 점수(참고용)
    const intentScore = analysis?.intentScore ?? 0;

    /* ------------------------------- 질문 단계 ------------------------------ */
    if (step === "questions") {
      // 체크리스트(도메인별 기준) 가져오기
      const checklist = slotSystem.getChecklistForDomain(domain); // 내부에서 도메인별 체크리스트 반환된다고 가정

      // 커버리지 측정해서 부족한 항목만 추림
      const gaps = [];
      for (const item of checklist) {
        const coverage = checkItemCoverage(item, allText, mentioned);
        if (coverage < 0.6) gaps.push(item);
      }

      // 부족 슬롯을 기반으로 질문 생성(최적화)
      const rawQuestions = gaps.map((g) => `다음 요소를 더 구체화해 주세요: ${toFlatStringArray(g).join(", ")}`);
      const questions = questionOptimizer.optimize(rawQuestions, mentioned, { domain }, 2);

      // 질문이 없으면 바로 최종 단계로 넘어갈 수 있도록 신호
      return res.json({
        ok: true,
        step: "questions",
        intentScore,
        questions,
        message: questions.length ? "부족한 정보를 보완하기 위한 질문을 생성했습니다." : "질문 없이도 충분합니다. 바로 최종 프롬프트를 만들 수 있어요.",
      });
    }

    /* -------------------------------- 최종 단계 ----------------------------- */
    if (step === "final") {
      // 프롬프트에 보여줄 멘션 문자열 (안전 변환)
      const mentionText = stringifyMentions(mentioned);

      // 모델에게 넘겨줄 시스템/유저 메시지(예시 템플릿)
      const systemMsg = `당신은 사용자의 목표를 달성할 수 있도록 프롬프트를 구조화해 주는 보조 도구입니다.
- 불명확한 표현을 구체화하고, 모델이 바로 실행 가능한 형태로 정리하세요.
- 불필요한 수사는 제거하고, 요구사항/제약/출력형식을 명확하게 써 주세요.`;

      const userMsg = [
        `도메인: ${domain}`,
        `원본 입력: ${userInput}`,
        answers.length ? `답변: ${answers.join(" | ")}` : `답변: (없음)`,
        `추출된 정보:\n${mentionText || "(없음)"}`,
        "",
        "위 정보를 토대로 다음을 반환하세요:",
        "1) 개선된 프롬프트 (한 문단 또는 구조화된 목록)",
        "2) 간단한 이유/근거 (한두 줄)",
      ].join("\n");

      // OpenAI 호출 (원하는 모델로 교체 가능)
      const completion = await callOpenAI(OPENAI_API_KEY, {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
        temperature: 0.2,
      });

      const improved = completion?.choices?.[0]?.message?.content?.trim() || "(개선 프롬프트 생성 실패)";
      const score = evaluator.evaluatePromptQuality(improved, domain);
      const hints = evaluator.suggestImprovements?.(improved, domain) ?? [];

      return res.json({
        ok: true,
        step: "final",
        intentScore,
        promptScore: score?.total ?? 0,
        improvedPrompt: improved,
        improvements: hints,
      });
    }

    // 그 외 step
    return res.status(400).json({ error: true, message: `알 수 없는 step: ${step}` });
  } catch (err) {
    // 모든 예외를 잡아 사용자에게 의미 있게 전달
    return res.status(500).json({
      error: true,
      title: "API 오류",
      message: String(err?.message || err),
      stack: process.env.NODE_ENV === "development" ? String(err?.stack || "") : undefined,
    });
  }
}
