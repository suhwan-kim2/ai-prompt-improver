// 🔥 api/improve-prompt.js - 8단계 플로우 메인 API (no-fallback, robust JSON)

import { readJson } from "./helpers.js";
import { MentionExtractor } from "../utils/mentionExtractor.js";
import { IntentAnalyzer } from "../utils/intentAnalyzer.js";
import { EvaluationSystem } from "../utils/evaluationSystem.js";

// 빌드 시 읽은 값(호환) + 런타임에서 재확인
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* ====================== 공통 유틸 (안전 처리) ====================== */

// 문자열/배열/객체 → 문자열 배열
function toFlatStringArray(val) {
  if (typeof val === "string") return [val];
  if (Array.isArray(val)) return val.flatMap(v => toFlatStringArray(v));
  if (val && typeof val === "object") {
    return Object.values(val).flatMap(v => toFlatStringArray(v));
  }
  return [];
}

// mentions를 보기 좋게 문자열화 (객체/배열 섞여 있어도 OK)
function stringifyMentions(mentions) {
  if (!mentions || typeof mentions !== "object") return "";
  try {
    return Object.entries(mentions)
      .map(([key, values]) => {
        const arr = toFlatStringArray(values);
        if (arr.length) return `${key}: ${arr.join(", ")}`;
        if (values && typeof values === "object") {
          const kv = Object.entries(values)
            .map(([k, v]) => `${k}=${toFlatStringArray(v).join(" ")}`)
            .join(", ");
          return `${key}: ${kv}`;
        }
        return `${key}: ${String(values ?? "")}`;
      })
      .join("\n");
  } catch {
    return JSON.stringify(mentions, null, 2);
  }
}

// 체크리스트 키워드 추출(간단 맵 + 토큰화)
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

// 커버리지 계산(mentions에 객체 섞여도 안전)
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

/* ====================== OpenAI 호출 ====================== */

// 60s 타임아웃, JSON 강제, 빠른 모델 기본
async function callOpenAI(prompt, temperature = 0.7, { timeoutMs = 60000, model = "gpt-4o-mini" } = {}) {
  const RUNTIME_KEY = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  const apiKey = RUNTIME_KEY && RUNTIME_KEY !== "your-api-key-here" ? RUNTIME_KEY : null;
  if (!apiKey) throw new Error("AI_SERVICE_UNAVAILABLE");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You must answer with a SINGLE valid JSON object only. No code fences. No extra text." },
          { role: "user", content: prompt }
        ],
        temperature,
        max_tokens: 1200,
        // 일부 모델에서만 적용되지만, 가능하면 JSON 보장
        response_format: { type: "json_object" }
      }),
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

/* ====================== 도메인 체크리스트 (원문 구조 유지) ====================== */

const DOMAIN_CHECKLISTS = {
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
  console.log("🚀 AI 프롬프트 개선기 8단계 플로우 시작");

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: true, message: "Method not allowed. Use POST." });
  }

  try {
    const body = await readJson(req);
    const {
      userInput = "",
      answers = [],
      domain = "video",
      step = "start",
      round = 1
    } = body;

    console.log(`📍 현재 단계: ${step}, 라운드: ${round}`);

    const RUNTIME_KEY = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
    if (!RUNTIME_KEY || RUNTIME_KEY === "your-api-key-here") {
      throw new Error("AI_SERVICE_UNAVAILABLE");
    }

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
    console.error("❌ API 오류:", err);
    return handleError(res, err);
  }
}

/* ====================== 단계별 처리 ====================== */

// 2단계: 질문 생성
async function handleStart(res, userInput, domain) {
  console.log("📍 2단계: AI 체크리스트 질문 생성");
  try {
    const mentions = mentionExtractor.extract(userInput);
    const questions = await generateAIQuestions(userInput, [], domain, mentions, 1);
    return res.status(200).json({
      success: true,
      step: "questions",
      questions,
      round: 1,
      mentions,
      message: "AI가 체크리스트를 분석해서 질문을 생성했습니다."
    });
  } catch (e) {
    throw new Error(`AI_QUESTION_GENERATION_FAILED: ${e.message}`);
  }
}

// 3~6단계: 답변 분석 → 추가 질문/생성 단계 분기
async function handleQuestions(res, userInput, answers, domain, round) {
  console.log("📍 3-6단계: 답변 분석 및 의도 파악");
  try {
    const intentScore = intentAnalyzer.calculateIntentScore(userInput, answers, domain);
    console.log("📊 의도 파악 점수:", intentScore);

    if (intentScore >= 95) {
      return res.status(200).json({
        success: true,
        step: "generate",
        intentScore,
        message: "의도 파악 완료! 프롬프트를 생성합니다."
      });
    }

    const mentions = mentionExtractor.extract([userInput, ...answers].join(" "));
    const questions = await generateAIQuestions(userInput, answers, domain, mentions, round + 1);

    return res.status(200).json({
      success: true,
      step: "questions",
      questions,
      round: round + 1,
      intentScore,
      message: `의도 파악 ${intentScore}점. 95점 달성을 위한 추가 질문입니다.`
    });
  } catch (e) {
    throw new Error(`INTENT_ANALYSIS_FAILED: ${e.message}`);
  }
}

// 5~8단계: 최종 프롬프트 생성 + 품질 평가
async function handleGenerate(res, userInput, answers, domain) {
  console.log("📍 5-8단계: AI 프롬프트 생성 및 품질 평가");

  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 프롬프트 생성 시도 ${attempts}/${maxAttempts}`);

    try {
      const improved = await generateAIPrompt(userInput, answers, domain);
      console.log("🤖 AI 생성 프롬프트:", (improved || "").slice(0, 100) + "...");

      const score = evaluationSystem.evaluatePromptQuality(improved, domain);
      console.log("📊 프롬프트 품질 점수:", score.total);

      if (score.total >= 95) {
        return res.status(200).json({
          success: true,
          step: "completed",
          originalPrompt: userInput,
          improvedPrompt: improved,
          intentScore: 95,
          qualityScore: score.total,
          attempts,
          message: `🎉 완성! AI가 ${attempts}번 만에 95점 품질 달성!`
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
          attempts,
          message: `최대 시도 도달. 현재 최고 품질 ${score.total}점으로 완료.`
        });
      }
    } catch (e) {
      console.error(`💥 시도 ${attempts} 실패:`, e.message);
      if (attempts >= maxAttempts) throw new Error(`AI_GENERATION_MAX_ATTEMPTS: ${e.message}`);
    }
  }
}

/* ====================== 질문/프롬프트 생성 로직 ====================== */

// 질문 생성 (폴백 없음, 실패 시 throw)
async function generateAIQuestions(userInput, answers, domain, mentions, round) {
  const checklist = DOMAIN_CHECKLISTS[domain] || DOMAIN_CHECKLISTS.video;
  const allText = [userInput, ...answers].join(" ").toLowerCase();

  const missing = [];
  Object.entries(checklist).forEach(([category, items]) => {
    items.forEach(item => {
      const cov = checkItemCoverage(item, allText, mentions);
      if (cov < 0.7) missing.push({ category, item, cov });
    });
  });

  const safeMentions = (stringifyMentions(mentions) || "").slice(0, 800);
  const schema = `
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

  const basePrompt = `너는 ${domain} 분야 어시스턴트야.
아래 정보를 바탕으로 "가장 부족한 정보 3~5개"에 대한 객관식 질문을 생성해.
반드시 '단 하나의 유효한 JSON 객체'로만 답해. 코드펜스 사용 금지. 설명/문장 금지.

입력: ${userInput.slice(0, 400)}
이전답변: ${(answers.join(" | ") || "없음").slice(0, 400)}
추출키워드:
${safeMentions || "(없음)"}

부족정보(상위 8):
${missing.slice(0, 8).map(x => `- ${typeof x.item === "string" ? x.item : String(x.item)}`).join("\n")}

반환 스키마 예시(형식 참고, 내용은 생성):
${schema}
`;

  // 최대 3회 재시도(폴백 없음)
  let lastErr = null;
  const tries = [
    { timeoutMs: 60000, temp: 0.4 },
    { timeoutMs: 60000, temp: 0.2 },
    { timeoutMs: 70000, temp: 0.1 }
  ];

  for (let i = 0; i < tries.length; i++) {
    try {
      const text = await callOpenAI(basePrompt, tries[i].temp, { timeoutMs: tries[i].timeoutMs, model: "gpt-4o-mini" });
      let s = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      const first = s.indexOf("{"), last = s.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);

      const parsed = JSON.parse(s);
      const qs = Array.isArray(parsed?.questions) ? parsed.questions : [];
      if (!qs.length) throw new Error("빈 questions");
      return qs.slice(0, 5);
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(`AI_QUESTION_GENERATION_FAILED: ${lastErr?.message || lastErr || "unknown"}`);
}

// 프롬프트 생성 (도메인별 템플릿)
async function generateAIPrompt(userInput, answers, domain) {
  const all = [userInput, ...answers].join("\n");

  const domainPrompts = {
    video: `다음 정보를 바탕으로 전문적인 영상 제작 프롬프트를 생성해주세요:

${all}

요구사항:
- 씬별 타임라인 구성
- 구체적인 등장인물 설정
- 카메라워크와 편집 지시사항
- 음향 및 자막 가이드
- 기술적 사양 (해상도, 코덱 등)
- 500-800자 분량`,

    image: `다음 정보를 바탕으로 전문적인 이미지 생성 프롬프트를 생성해주세요:

${all}

요구사항:
- 구체적인 주제와 구도 설명
- 색상 팔레트와 조명 설정
- 스타일과 기법 명시
- 세부 디테일과 분위기
- 기술적 사양 (해상도, 비율)
- 400-600자 분량`,

    dev: `다음 정보를 바탕으로 전문적인 개발 요구사항을 생성해주세요:

${all}

요구사항:
- 프로젝트 개요와 목적
- 핵심 기능 명세
- 기술 스택과 아키텍처
- UI/UX 가이드라인
- 성능 및 보안 요구사항
- 600-1000자 분량`
  };

  const prompt = domainPrompts[domain] || domainPrompts.video;
  // 결과물은 JSON이 아니므로 system 강제 없이 호출
  const text = await callOpenAI(
    prompt,
    0.8,
    { timeoutMs: 60000, model: "gpt-4o-mini" }
  );
  return text;
}

/* ====================== 에러 응답 ====================== */

function handleError(res, error) {
  const msg = error?.message || "";

  if (msg.includes("AI_SERVICE_UNAVAILABLE")) {
    return res.status(503).json({
      error: true,
      type: "service_unavailable",
      title: "🚫 AI 서비스 이용 불가",
      message: "OpenAI API 키가 설정되지 않았습니다.",
      canRetry: false
    });
  }

  if (msg.includes("QUOTA_EXCEEDED")) {
    return res.status(503).json({
      error: true,
      type: "quota_exceeded",
      title: "🚫 AI 사용량 초과",
      message: "AI 서비스 사용량이 초과되었습니다.",
      canRetry: true,
      retryAfter: "1-2시간"
    });
  }

  return res.status(500).json({
    error: true,
    type: "system_error",
    title: "❌ 시스템 오류",
    message: "AI 프롬프트 개선 중 오류가 발생했습니다.",
    canRetry: true,
    originalError: msg
  });
}
