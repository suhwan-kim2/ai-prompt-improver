// 🔥 api/improve-prompt.js - 8단계 플로우 메인 API (디버그 강화판)

import { readJson } from "./helpers.js";
import { MentionExtractor } from "../utils/mentionExtractor.js";
import { IntentAnalyzer } from "../utils/intentAnalyzer.js";
import { EvaluationSystem } from "../utils/evaluationSystem.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🎯 도메인별 체크리스트 (생략 없이 유지)
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
    basic_info: ["그릴 주제와 대상","사용 목적과 용도","타겟 감상자","전체적인 컨셉","핵심 메시지"],
    visual_elements: ["구체적인 구도와 레이아웃","색상 팔레트와 톤","조명과 그림자 설정","배경과 환경 설정","세부 디테일과 질감"],
    style_specs: ["예술적 스타일과 기법","해상도와 비율","분위기와 감정 표현","브랜딩 요소","금지/회피 요소"]
  },
  dev: {
    project_basics: ["프로젝트 유형과 목적","주요 기능과 특징","타겟 사용자 그룹","사용 시나리오","성공 지표"],
    technical_reqs: ["기술 스택과 프레임워크","성능 요구사항","보안 고려사항","확장성 요구사항","통합/연동 필요성"],
    ux_design: ["UI/UX 디자인 방향","사용자 경험 플로우","접근성 고려사항","반응형/다기기 지원","브랜딩과 스타일 가이드"]
  }
};

// 유틸 인스턴스
const mentionExtractor = new MentionExtractor();
const intentAnalyzer = new IntentAnalyzer();
const evaluationSystem = new EvaluationSystem();

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Method not allowed. Use POST.' });
  }

  // 요청 파싱 가드
  let requestData = {};
  try {
    requestData = await readJson(req);
  } catch (e) {
    console.warn('⚠️ 요청 JSON 파싱 실패:', e?.message);
    requestData = {};
  }

  const {
    userInput = "",
    answers = [],
    domain = "video",
    step = "start",
    round = 1,
    mode,
    debug // ← 프론트에서 {debug:true} 넣으면 상세로그 반환
  } = requestData;

  try {
    // 간단 진단 모드: OPENAI 키 유무 + 테스트 호출
    if (step === 'diag') {
      const diag = await runDiagnostics(debug);
      return res.status(diag.ok ? 200 : 500).json(diag);
    }

    if (!OPENAI_API_KEY) {
      throw makeErr('AI_SERVICE_UNAVAILABLE', 'OPENAI_API_KEY is missing on server (Vercel env).');
    }

    switch (step) {
      case 'start':
        return await handleStart(res, userInput, domain, debug);

      case 'questions':
        return await handleQuestions(res, userInput, answers, domain, round, mode, debug);

      case 'generate':
        return await handleGenerate(res, userInput, answers, domain, debug);

      default:
        throw makeErr('INVALID_STEP', `Unknown step: ${step}`);
    }
  } catch (error) {
    return handleError(res, error);
  }
}

// ========== 단계 핸들러들 ==========

async function handleStart(res, userInput, domain, debug) {
  try {
    const mentions = mentionExtractor.extract(userInput);
    const questions = await generateAIQuestions(userInput, [], domain, mentions, 1, { draftPrompt: "", targetCount: 5, debug });
    return res.status(200).json({
      success: true,
      step: 'questions',
      questions,
      round: 1,
      mentions,
      message: 'AI가 체크리스트를 분석해서 질문을 생성했습니다.'
    });
  } catch (e) {
    throw wrap(e, 'AI_QUESTION_GENERATION_FAILED');
  }
}

async function handleQuestions(res, userInput, answers, domain, round, mode, debug) {
  try {
    const allText = [userInput, ...answers].join(" ");
    const mentions = mentionExtractor.extract(allText);
    const checklist = DOMAIN_CHECKLISTS[domain] || DOMAIN_CHECKLISTS.video;

    // 임시 개선(영문)
    const draftPrompt = await generateDraftPrompt(userInput, answers, domain, debug);

    // 의도/커버리지
    const intentScore = intentAnalyzer.calculateIntentScore(userInput, answers, domain, checklist, mentions);
    const coverage = getCoverageRatio(checklist, (allText + "\n" + draftPrompt).toLowerCase(), mentions);
    const coveragePct = Math.round(coverage * 100);

    if (coverage >= 0.65 || (round >= 3 && coverage >= 0.55) || intentScore >= 95) {
      return res.status(200).json({
        success: true,
        step: "generate",
        intentScore,
        coverage: coveragePct,
        draftPrompt,
        message: `충분한 정보가 수집되었습니다. (coverage ${coveragePct}%) 프롬프트를 생성합니다.`
      });
    }

    const targetCount = mode === 'bulk' ? 7 : 3;
    const nextQuestions = await generateAIQuestions(userInput, answers, domain, mentions, round + 1, { draftPrompt, targetCount, debug });

    if (!nextQuestions || nextQuestions.length === 0) {
      return res.status(200).json({
        success: true,
        step: "generate",
        intentScore,
        coverage: coveragePct,
        draftPrompt,
        message: "더 물어볼 핵심 정보가 없어 최종 프롬프트를 생성합니다."
      });
    }

    return res.status(200).json({
      success: true,
      step: "questions",
      questions: nextQuestions,
      round: round + 1,
      intentScore,
      coverage: coveragePct,
      draftPrompt,
      message: `현재 coverage ${coveragePct}%. 부족 정보만 이어서 질문합니다.`
    });
  } catch (e) {
    throw wrap(e, 'INTENT_ANALYSIS_FAILED');
  }
}

async function handleGenerate(res, userInput, answers, domain, debug) {
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const generatedPrompt = await generateAIPrompt(userInput, answers, domain, debug);
      const qualityScore = evaluationSystem.evaluatePromptQuality(generatedPrompt, domain);

      if (qualityScore.total >= 95) {
        return res.status(200).json({
          success: true,
          step: 'completed',
          originalPrompt: userInput,
          improvedPrompt: generatedPrompt,
          intentScore: 95,
          qualityScore: qualityScore.total,
          attempts,
          message: `🎉 완성! AI가 ${attempts}번 만에 95점 품질 달성!`
        });
      } else {
        if (attempts >= maxAttempts) {
          const mentions = mentionExtractor.extract([userInput, ...answers, generatedPrompt].join(' '));
          const followupQuestions = await generateAIQuestions(
            userInput, answers, domain, mentions, 1, { draftPrompt: generatedPrompt, targetCount: 3, debug }
          );
          return res.status(200).json({
            success: true,
            step: 'questions',
            questions: followupQuestions || [],
            round: 1,
            intentScore: 95,
            message: `현재 품질 ${qualityScore.total}점입니다. 부족 정보를 보완하기 위해 추가 질문을 제시합니다.`
          });
        }
        // 루프 계속
      }
    } catch (e) {
      if (attempts >= maxAttempts) {
        const mentions = mentionExtractor.extract([userInput, ...answers].join(' '));
        const fallbackQuestions = await generateAIQuestions(
          userInput, answers, domain, mentions, 1, { draftPrompt: '', targetCount: 3, debug }
        );
        return res.status(200).json({
          success: true,
          step: 'questions',
          questions: fallbackQuestions || [],
          round: 1,
          intentScore: 95,
          message: `생성에 반복 실패하여, 추가 정보를 수집합니다.`
        });
      }
    }
  }
}

// ========== LLM 유틸 ==========

// 임시 개선 프롬프트(영문)
async function generateDraftPrompt(userInput, answers, domain, debug) {
  const allAnswers = [userInput, ...answers].join('\n');
  const prompt =
    domain === 'image'
      ? `Create an interim improved image prompt in English from the following facts.
Keep it concise but structured.

${allAnswers}

Return only the prompt text.`
      : `Create an interim improved video prompt in English from the following facts.
Keep it concise but structured.

${allAnswers}

Return only the prompt text.`;

  return await callOpenAI(prompt, 0.4, debug);
}

// 질문 생성 (draft 포함해 중복 차단)
async function generateAIQuestions(userInput, answers, domain, mentions, round, opts = {}) {
  const { draftPrompt = "", targetCount = 3, debug = false } = opts;

  const checklist = DOMAIN_CHECKLISTS[domain] || DOMAIN_CHECKLISTS.video;
  const allText = [userInput, ...answers, draftPrompt].join(' ').toLowerCase();

  const missingItems = [];
  Object.entries(checklist).forEach(([category, items]) => {
    items.forEach(item => {
      const coverage = checkItemCoverage(item, allText, mentions);
      if (coverage < 0.7) missingItems.push({ category, item, coverage });
    });
  });

  const answeredKW = Array.from(new Set([
    ...buildAnsweredKeywords(answers),
    ...buildAnsweredKeywords([draftPrompt])
  ]));
  const answeredLine = answeredKW.join(", ");
  const safeMentions = stringifyMentions(mentions).slice(0, 800);

  const baseSchema = `
{
  "questions": [
    {
      "key": "q1",
      "question": "한 문장 객관식 질문",
      "options": ["선택지1","선택지2","선택지3","선택지4","직접 입력"],
      "priority": "high|medium|low",
      "category": "카테고리명"
    }
  ]
}`;

  const prompt = `You are an assistant for the ${domain} domain.
We already have a current draft prompt that MUST be treated as established facts (do not ask about them again).

Rules:
- Generate EXACTLY ${targetCount} multiple-choice questions targeting ONLY the still-missing info.
- If fewer than ${targetCount} distinct gaps remain, MERGE related gaps into combined questions so the total is ${targetCount}.
- Do NOT repeat or paraphrase any information already present in the answers or the current draft prompt.
- Ban any question or option that matches the banned keywords (including synonyms/variants).
- Output a SINGLE valid JSON object only (no code fences, no extra text).

Current draft prompt (established facts):
${draftPrompt ? draftPrompt.slice(0, 1200) : "(none)"}

User input: ${userInput.slice(0, 400)}
Answers so far: ${(answers.join(" | ") || "none").slice(0, 400)}
Extracted mentions:
${safeMentions || "(none)"}

BANNED keywords (already covered):
${answeredLine || "(none)"}

MISSING topics (ask ONLY about these; merge if < ${targetCount}):
${missingItems.map(x => `- ${String(x.item)}`).join("\n")}

Return JSON matching this example shape:
${baseSchema}
`;

  const text = await callOpenAI(prompt, 0.3, debug);
  let cleaned = text.trim().replace(/```(?:json)?/gi, "").replace(/```/g, "");
  const first = cleaned.indexOf("{"), last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);

  const parsed = JSON.parse(cleaned);
  let qs = Array.isArray(parsed?.questions) ? parsed.questions : [];

  const ban = new Set(answeredKW.map(v => v.toLowerCase()));
  qs = qs.filter(q => {
    const bucket = [q?.question || "", ...(q?.options || [])].join(" ").toLowerCase();
    for (const k of ban) { if (k && bucket.includes(k)) return false; }
    return true;
  });

  if (qs.length > targetCount) qs = qs.slice(0, targetCount);
  return qs;
}

// 최종 프롬프트 생성
async function generateAIPrompt(userInput, answers, domain, debug) {
  const allAnswers = [userInput, ...answers].join('\n');
  const domainPrompts = {
    video: `Create a professional, production-ready video prompt in English from the following information:

${allAnswers}

Requirements:
- Scene-by-scene timeline
- Clear subject + audience + platform fit
- Camera work and editing directions
- Music/SFX and captions guidance
- Technical specs (resolution, codec)
- Length target
- 500-800 characters total`,
    image: `Create a professional image-generation prompt in English from the following information:

${allAnswers}

Requirements:
- Concrete subject and composition
- Color palette and lighting
- Style and technique
- Details and mood
- Technical specs (resolution, aspect ratio)
- 400-600 characters total`,
    dev: `Create a professional software requirements brief in English from the following information:

${allAnswers}

Requirements:
- Project overview & objectives
- Core features
- Tech stack & architecture
- UI/UX guidelines
- Performance & security expectations
- 600-1000 characters total`
  };
  const prompt = domainPrompts[domain] || domainPrompts.video;
  return await callOpenAI(prompt, 0.8, debug);
}

// 🤖 OpenAI API 호출 (AbortController 타임아웃, 에러 메시지 풍부화)
async function callOpenAI(prompt, temperature = 0.7, debug = false) {
  const TIMEOUT_MS = 60000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(new Error("RequestTimeout")), TIMEOUT_MS);

  try {
    const body = {
      model: 'gpt-4o-mini', // 필요 시 계정에서 허용된 모델명으로 교체
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: 1000
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const rawText = await response.text().catch(() => '');
    if (!response.ok) {
      let apiMsg = rawText;
      try {
        const j = JSON.parse(rawText);
        apiMsg = j?.error?.message || rawText;
      } catch {}
      throw makeErr('OPENAI_API_ERROR', `status=${response.status} ${apiMsg || ''}`.trim());
    }
    let data;
    try { data = JSON.parse(rawText); } catch { throw makeErr('OPENAI_PARSE_ERROR', 'JSON parse failed'); }

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw makeErr('OPENAI_EMPTY', 'Empty content from API');

    if (debug) {
      console.log('🔎 OpenAI OK:', { model: data?.model, usage: data?.usage });
    }
    return text;
  } catch (e) {
    if (e?.name === 'AbortError' || String(e?.message).includes('RequestTimeout')) {
      throw makeErr('OPENAI_TIMEOUT', 'OpenAI call timed out');
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// ========== 스코어/커버리지 유틸 ==========

function checkItemCoverage(item, text, mentions) {
  const keywords = extractItemKeywords(item);
  let matches = 0;

  keywords.forEach(k => { if (text.includes(String(k).toLowerCase())) matches++; });

  Object.values(mentions || {}).flat().forEach(m => {
    keywords.forEach(k => {
      if (String(m || '').toLowerCase().includes(String(k).toLowerCase())) matches++;
    });
  });

  return keywords.length > 0 ? Math.min(matches / keywords.length, 1) : 0;
}

function buildAnsweredKeywords(arr = []) {
  const text = (arr || []).join(" ").toLowerCase();
  const tokens = text.split(/[^a-zA-Z0-9가-힣+#:/._-]+/).filter(Boolean);
  return Array.from(new Set(tokens)).slice(0, 200);
}

function stringifyMentions(mentions = {}) {
  try {
    return Object.entries(mentions).map(([k, v]) => `${k}: ${(v||[]).join(", ")}`).join("\n");
  } catch {
    return "";
  }
}

function extractItemKeywords(item) {
  const keywordMap = {
    '목적': ['목적','용도','목표'],
    '시청자': ['시청자','대상','타겟','성인','30대','20대','10대'],
    '길이': ['길이','시간','분','초','1-2분','1~2분','1-3분','3분','1분','2분'],
    '플랫폼': ['플랫폼','유튜브','youtube','틱톡','tiktok','인스타','instagram','shorts','쇼츠'],
    '스토리': ['스토리','구성','흐름','시작','중간','끝','씬','타임라인'],
    '등장인물': ['등장인물','캐릭터','인물','강아지','주인공'],
    '카메라': ['카메라','촬영','앵글','줌','슬로우 모션','드론'],
    '음향': ['음향','음악','소리','효과음','BGM','자막']
  };
  for (const [key, keywords] of Object.entries(keywordMap)) {
    if (String(item).includes(key)) return keywords;
  }
  return String(item).split(' ').filter(word => word.length > 1);
}

function getCoverageRatio(checklist, text, mentions) {
  let total = 0, covered = 0;
  Object.values(checklist).forEach(items => {
    items.forEach(item => {
      total++;
      if (checkItemCoverage(item, text, mentions) >= 0.7) covered++;
    });
  });
  return total ? covered / total : 0;
}

// ========== 에러 & 진단 ==========

function makeErr(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}
function wrap(e, code) {
  const err = new Error(`${code}: ${e?.message || e}`);
  err.code = code;
  err.cause = e;
  return err;
}

function handleError(res, error) {
  const payload = {
    error: true,
    type: error?.code || 'system_error',
    title: '❌ 시스템 오류',
    message: 'AI 프롬프트 개선 중 오류가 발생했습니다.',
    canRetry: true,
    originalError: String(error?.message || error)
  };

  // 스택/내부 cause 도 함께 내려줌(디버깅 편의)
  if (error?.cause) payload.cause = String(error.cause?.message || error.cause);
  if (error?.stack) payload.stack = String(error.stack);

  console.error('❌ API 오류 상세:', payload);
  return res.status(500).json(payload);
}

// 간단 서버 진단: 키 유무 + 소형 프롬프트 호출
async function runDiagnostics(debug = false) {
  const out = { ok: false, checks: {} };
  try {
    out.checks.env = { hasKey: !!OPENAI_API_KEY, keyPrefix: OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 6) + '…' : null };
    if (!OPENAI_API_KEY) {
      out.message = 'OPENAI_API_KEY missing on server';
      return out;
    }
    try {
      const ping = await callOpenAI('Say "pong".', 0.0, debug);
      out.checks.model = { ok: true, sample: ping.slice(0, 40) };
    } catch (e) {
      out.checks.model = { ok: false, error: String(e?.message || e) };
      out.message = 'Model call failed';
      return out;
    }
    out.ok = true;
    out.message = 'All diagnostics passed';
    return out;
  } catch (e) {
    out.ok = false;
    out.message = String(e?.message || e);
    return out;
  }
}
