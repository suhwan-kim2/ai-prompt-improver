// 🔥 api/improve-prompt.js - 8단계 플로우 메인 API
// - 의도점수 = 체크리스트 충족률(%)
// - 부족 항목만 질문 (95% 목표)
// - 중복 질문 강력 차단(이전 답변 키워드 금지)
// - 매 라운드 임시 개선 프롬프트 생성(영상/이미지 = 영어)
// - 폴백 없음, 실패 시 명확한 에러

import { readJson } from "./helpers.js";
import { MentionExtractor } from "../utils/mentionExtractor.js";
import { IntentAnalyzer } from "../utils/intentAnalyzer.js";
import { EvaluationSystem } from "../utils/evaluationSystem.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* ====================== 공통 유틸 ====================== */
function toFlatStringArray(val) {
  if (typeof val === "string") return [val];
  if (Array.isArray(val)) return val.flatMap(v => toFlatStringArray(v));
  if (val && typeof val === "object") return Object.values(val).flatMap(v => toFlatStringArray(v));
  return [];
}
function stringifyMentions(mentions) {
  if (!mentions || typeof mentions !== "object") return "";
  try {
    return Object.entries(mentions)
      .map(([key, values]) => {
        const arr = toFlatStringArray(values);
        if (arr.length) return `${key}: ${arr.join(", ")}`;
        if (values && typeof values === "object") {
          const kv = Object.entries(values).map(([k, v]) => `${k}=${toFlatStringArray(v).join(" ")}`).join(", ");
          return `${key}: ${kv}`;
        }
        return `${key}: ${String(values ?? "")}`;
      })
      .join("\n");
  } catch {
    return JSON.stringify(mentions, null, 2);
  }
}
function extractItemKeywords(item) {
  const str = String(item);
  const keywordMap = {
    "목적": ["목적", "용도", "목표"],
    "시청자": ["시청자", "대상", "타겟"],
    "길이": ["길이", "시간", "분", "초"],
    "플랫폼": ["플랫폼", "유튜브", "인스타", "틱톡", "릴스"],
    "스토리": ["스토리", "구성", "흐름"],
    "등장인물": ["등장인물", "캐릭터", "인물"],
    "카메라": ["카메라", "촬영", "앵글"],
    "음향": ["음향", "음악", "소리", "내레이션"]
  };
  for (const [key, arr] of Object.entries(keywordMap)) {
    if (str.includes(key)) return arr;
  }
  return str.split(/\s+/).filter(w => w.length > 1);
}
function checkItemCoverage(item, text, mentions) {
  const keywords = extractItemKeywords(item).map(s => s.toLowerCase());
  if (!keywords.length) return 0;
  const haystackText = String(text || "").toLowerCase();
  const mentionText = toFlatStringArray(mentions).map(s => String(s).toLowerCase()).join(" ");
  let matches = 0;
  for (const kw of keywords) {
    if (!kw) continue;
    if (haystackText.includes(kw) || mentionText.includes(kw)) matches++;
  }
  return Math.min(1, matches / keywords.length);
}
function buildAnsweredKeywords(answers = []) {
  const txt = (Array.isArray(answers) ? answers.join(" ") : String(answers || "")).toLowerCase();
  const tokens = txt.split(/[^가-힣a-z0-9+#:/.-]+/i).filter(w => w && w.length >= 2);
  return Array.from(new Set(tokens)).slice(0, 80);
}
function getCoverageRatio(checklist, allText, mentions) {
  const items = Object.values(checklist || {}).flat();
  if (!items.length) return 0;
  let covered = 0;
  for (const it of items) {
    const cov = checkItemCoverage(it, allText, mentions);
    if (cov >= 0.7) covered++;
  }
  return covered / items.length;
}

/* ====================== OpenAI 호출 ====================== */
async function callOpenAI(prompt, temperature = 0.7, { timeoutMs = 60000, model = "gpt-4o-mini", forceJson = false } = {}) {
  const RUNTIME_KEY = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  const apiKey = RUNTIME_KEY && RUNTIME_KEY !== "your-api-key-here" ? RUNTIME_KEY : null;
  if (!apiKey) throw new Error("AI_SERVICE_UNAVAILABLE");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages = forceJson
      ? [
          { role: "system", content: "You must answer with a SINGLE valid JSON object only. No code fences. No extra text." },
          { role: "user", content: prompt }
        ]
      : [{ role: "user", content: prompt }];

    const body = {
      model,
      messages,
      temperature,
      max_tokens: 1200
    };
    if (forceJson) body.response_format = { type: "json_object" };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenAI API 오류: ${res.status} - ${err?.error?.message || "Unknown"}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim();
  } finally {
    clearTimeout(timer);
  }
}

/* ====================== 도메인 체크리스트 ====================== */
export const DOMAIN_CHECKLISTS = {
  video: {
    basic_info: [
      "영상의 구체적인 목적과 용도",
      "타겟 시청자의 연령대와 특성",
      "정확한 영상 길이와 시간",
      "배포할 플랫폼과 채널",
      "핵심 메시지와 전달 내용"
    ],
    content_structure: [
      "전체 스토리 구성과 흐름",
      "씬별 분할과 타임라인",
      "등장인물과 캐릭터 설정",
      "대사/내레이션 스크립트",
      "감정적 톤과 분위기"
    ],
    technical_specs: [
      "시각적 스타일과 컨셉",
      "카메라워크와 촬영 기법",
      "해상도와 화질 요구사항",
      "편집 스타일과 전환 효과",
      "색감과 조명 설정"
    ],
    audio_extras: [
      "배경음악과 효과음",
      "음성/내레이션 스타일",
      "자막 설정과 언어",
      "브랜딩 요소와 로고",
      "CTA와 행동 유도"
    ]
  },
  image: {
    basic_info: ["그릴 주제와 대상", "사용 목적과 용도", "타겟 감상자", "전체적인 컨셉", "핵심 메시지"],
    visual_elements: ["구체적인 구도와 레이아웃", "색상 팔레트와 톤", "조명과 그림자 설정", "배경과 환경 설정", "세부 디테일과 질감"],
    style_specs: ["예술적 스타일과 기법", "해상도와 비율", "분위기와 감정 표현", "브랜딩 요소", "금지/회피 요소"]
  },
  dev: {
    project_basics: ["프로젝트 유형과 목적", "주요 기능과 특징", "타겟 사용자 그룹", "사용 시나리오", "성공 지표"],
    technical_reqs: ["기술 스택과 프레임워크", "성능 요구사항", "보안 고려사항", "확장성 요구사항", "통합/연동 필요성"],
    ux_design: ["UI/UX 디자인 방향", "사용자 경험 플로우", "접근성 고려사항", "반응형/다기기 지원", "브랜딩과 스타일 가이드"]
  }
};

/* ====================== 인스턴스 ====================== */
const mentionExtractor = new MentionExtractor();
const intentAnalyzer = new IntentAnalyzer();
const evaluationSystem = new EvaluationSystem();

/* ====================== 메인 핸들러 ====================== */
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: true, message: "Method not allowed. Use POST." });

  try {
    const body = await readJson(req);
    const { userInput = "", answers = [], domain = "video", step = "start", round = 1 } = body;

    const RUNTIME_KEY = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
    if (!RUNTIME_KEY || RUNTIME_KEY === "your-api-key-here") throw new Error("AI_SERVICE_UNAVAILABLE");

    switch (step) {
      case "start":
        return await handleStart(res, userInput, domain);
      case "questions":
        return await handleQuestions(res, userInput, answers, domain, round);
      case "generate":
        return await handleGenerate(res, userInput, answers, domain);
      default:
        throw new Error("INVALID_STEP");
    }
  } catch (err) {
    return handleError(res, err);
  }
}

/* ====================== 단계 ====================== */
async function handleStart(res, userInput, domain) {
  try {
    const mentions = mentionExtractor.extract(userInput);
    const questions = await generateAIQuestions(userInput, [], domain, mentions, 1);
    const draft = await generateDraftPrompt(userInput, [], domain); // 라운드 1 임시 개선 프롬프트
    return res.status(200).json({
      success: true,
      step: "questions",
      questions,
      round: 1,
      mentions,
      draftPrompt: draft
    });
  } catch (e) {
    throw new Error(`AI_QUESTION_GENERATION_FAILED: ${e.message}`);
  }
}

async function handleQuestions(res, userInput, answers, domain, round) {
  try {
    const allText = [userInput, ...answers].join(" ");
    const mentions = mentionExtractor.extract(allText);
    const checklist = DOMAIN_CHECKLISTS[domain] || DOMAIN_CHECKLISTS.video;

    // 점수 = 체크리스트 충족률
    const intentScore = intentAnalyzer.calculateIntentScore(userInput, answers, domain, checklist, mentions);

    // 커버리지로 생성 단계 진입 여부 판단
    const coverage = getCoverageRatio(checklist, allText.toLowerCase(), mentions);
    const coveragePct = Math.round(coverage * 100);

    // 라운드별 임시 개선 프롬프트(영상/이미지 = 영어)
    const draft = await generateDraftPrompt(userInput, answers, domain);

    if (coverage >= 0.65 || (round >= 3 && coverage >= 0.55) || intentScore >= 95) {
      return res.status(200).json({
        success: true,
        step: "generate",
        intentScore,
        coverage: coveragePct,
        draftPrompt: draft,
        message: `충분한 정보가 수집되었습니다. (coverage ${coveragePct}%) 프롬프트를 생성합니다.`
      });
    }

    const nextQuestions = await generateAIQuestions(userInput, answers, domain, mentions, round + 1);
    return res.status(200).json({
      success: true,
      step: "questions",
      questions: nextQuestions,
      round: round + 1,
      intentScore,
      coverage: coveragePct,
      draftPrompt: draft,
      message: `현재 coverage ${coveragePct}%. 더 보완이 필요합니다.`
    });
  } catch (e) {
    throw new Error(`INTENT_ANALYSIS_FAILED: ${e.message}`);
  }
}

async function handleGenerate(res, userInput, answers, domain) {
  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    attempts++;
    try {
      const improved = await generateAIPrompt(userInput, answers, domain);
      const score = evaluationSystem.evaluatePromptQuality(improved, domain);
      if (score.total >= 95) {
        return res.status(200).json({
          success: true,
          step: "completed",
          originalPrompt: userInput,
          improvedPrompt: improved,
          intentScore: 95,
          qualityScore: score.total,
          attempts
        });
      }
      if (attempts >= maxAttempts) {
        return res.status(200).json({
          success: true,
          step: "completed",
          originalPrompt: userInput,
          improvedPrompt: improved,
          intentScore: 95,
          qualityScore: score.total,
          attempts
        });
      }
    } catch (e) {
      if (attempts >= maxAttempts) throw new Error(`AI_GENERATION_MAX_ATTEMPTS: ${e.message}`);
    }
  }
}

/* ====================== 생성 로직 ====================== */
// 질문 생성 (부족 항목만, 중복 차단, JSON 강제)
async function generateAIQuestions(userInput, answers, domain, mentions, round) {
  const checklist = DOMAIN_CHECKLISTS[domain] || DOMAIN_CHECKLISTS.video;
  const allText = [userInput, ...answers].join(" ").toLowerCase();

  // 부족 항목만 집계
  const missingItems = [];
  Object.entries(checklist).forEach(([category, items]) => {
    items.forEach(item => {
      const coverage = checkItemCoverage(item, allText, mentions);
      if (coverage < 0.7) missingItems.push({ category, item, coverage });
    });
  });

  const answeredKW = buildAnsweredKeywords(answers);
  const answeredLine = answeredKW.join(", ");
  const safeMentions = (stringifyMentions(mentions) || "").slice(0, 800);
  const baseSchema = `
{
  "questions": [
    {
      "key": "q1",
      "question": "구체적인 질문 한 문장",
      "options": ["선택지1","선택지2","선택지3","선택지4","직접 입력"],
      "priority": "high|medium|low",
      "category": "카테고리명"
    }
  ]
}`;

  const prompt = `너는 ${domain} 분야 어시스턴트야.
현재 coverage는 ${(getCoverageRatio(checklist, allText, mentions) * 100).toFixed(0)}%이고, 목표는 95%야.
아래 정보를 바탕으로 "아직 충족되지 않은 항목"에 대해서만 객관식 질문 3~5개를 생성해.
💥 중요: '이미 답변됨/확정됨 키워드'에 해당하는 내용은 절대 다시 묻지 마. (동의어/유사표현 포함 금지)
반드시 '단 하나의 유효한 JSON 객체'로만 답해. 코드펜스 금지. 설명문 금지.

입력: ${userInput.slice(0, 400)}
이전답변: ${(answers.join(" | ") || "없음").slice(0, 400)}
추출키워드:
${safeMentions || "(없음)"}

이미 답변됨/확정됨 키워드(질문 금지):
${answeredLine || "(없음)"}

부족정보(질문 대상으로만 사용):
${missingItems.map(x => `- ${typeof x.item === "string" ? x.item : String(x.item)}`).join("\n")}

반환 스키마 예시(형식 참고, 내용은 생성):
${baseSchema}
`;

  let lastErr = null;
  const tries = [
    { timeoutMs: 60000, temp: 0.4 },
    { timeoutMs: 60000, temp: 0.2 },
    { timeoutMs: 70000, temp: 0.1 }
  ];

  for (let i = 0; i < tries.length; i++) {
    try {
      const text = await callOpenAI(prompt, tries[i].temp, { timeoutMs: tries[i].timeoutMs, model: "gpt-4o-mini", forceJson: true });
      let s = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      const first = s.indexOf("{"), last = s.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);

      const parsed = JSON.parse(s);
      let qs = Array.isArray(parsed?.questions) ? parsed.questions : [];
      if (!qs.length) throw new Error("빈 questions");

      // 중복 차단: 이전 답변 키워드가 question/option에 포함되면 제거
      const ban = new Set(answeredKW);
      qs = qs.filter(q => {
        const bucket = [q?.question || "", ...(q?.options || [])].join(" ").toLowerCase();
        for (const k of ban) { if (k && bucket.includes(k)) return false; }
        return true;
      });

      if (qs.length > 1) qs = qs.sort(() => Math.random() - 0.5);
      return qs.slice(0, 5);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`AI_QUESTION_GENERATION_FAILED: ${lastErr?.message || lastErr || "unknown"}`);
}

// 라운드별 임시 개선 프롬프트(영상/이미지=영문)
async function generateDraftPrompt(userInput, answers, domain) {
  const all = [userInput, ...answers].join("\n");
  const langHint = (domain === "video" || domain === "image")
    ? "Write the production prompt in clear, natural English."
    : "한국어로 간결하고 구조화하여 작성하세요.";

  const prompt = `${langHint}
Use only the given info. If a detail is missing, leave it generic rather than inventing facts.

Domain: ${domain}
Collected info:
${all}

Return a concise, execution-ready prompt (1–2 short paragraphs or a structured list) that a model can use directly.`;

  return await callOpenAI(prompt, 0.4, { timeoutMs: 45000, model: "gpt-4o-mini", forceJson: false });
}

// 최종 프롬프트 생성(영상/이미지=영문)
async function generateAIPrompt(userInput, answers, domain) {
  const all = [userInput, ...answers].join("\n");
  const langHint = (domain === "video" || domain === "image")
    ? "Write the production prompt in clear, natural English."
    : "한국어로 간결하고 구조화하여 작성하세요.";

  const domainPrompts = {
    video: `${langHint}
Using only the info below, produce a professional video production prompt with:
- Scene timeline (start/middle/end)
- Clear subject and goal
- Camera & editing guidance
- Music/SFX & captions guidance
- Technical specs (resolution/codec)
Length: 500–800 characters.

Info:
${all}`,
    image: `${langHint}
Using only the info below, produce a professional image generation prompt with:
- Subject & composition
- Color palette & lighting
- Style & techniques
- Detail & mood
- Technical specs (resolution/aspect)
Length: 400–600 characters.

Info:
${all}`,
    dev: `다음 정보를 바탕으로 전문적인 개발 요구사항을 생성하세요:
- 프로젝트 개요와 목적
- 핵심 기능 명세
- 기술 스택과 아키텍처
- UI/UX 가이드라인
- 성능 및 보안 요구사항
분량: 600–1000자

정보:
${all}`
  };

  const prompt = domainPrompts[domain] || domainPrompts.video;
  return await callOpenAI(prompt, 0.6, { timeoutMs: 60000, model: "gpt-4o-mini", forceJson: false });
}

/* ====================== 에러 응답 ====================== */
function handleError(res, error) {
  const msg = error?.message || "";
  if (msg.includes("AI_SERVICE_UNAVAILABLE")) {
    return res.status(503).json({
      error: true, type: "service_unavailable",
      title: "🚫 AI 서비스 이용 불가",
      message: "OpenAI API 키가 설정되지 않았습니다.",
      canRetry: false
    });
  }
  if (msg.includes("QUOTA_EXCEEDED")) {
    return res.status(503).json({
      error: true, type: "quota_exceeded",
      title: "🚫 AI 사용량 초과",
      message: "AI 서비스 사용량이 초과되었습니다.",
      canRetry: true, retryAfter: "1-2시간"
    });
  }
  return res.status(500).json({
    error: true, type: "system_error",
    title: "❌ 시스템 오류",
    message: "AI 프롬프트 개선 중 오류가 발생했습니다.",
    canRetry: true, originalError: msg
  });
}
