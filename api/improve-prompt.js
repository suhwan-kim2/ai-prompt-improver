// 🔥 api/improve-prompt.js - 8단계 플로우 메인 API

import { readJson } from "./helpers.js";
import { MentionExtractor } from "../utils/mentionExtractor.js";
import { IntentAnalyzer } from "../utils/intentAnalyzer.js";
import { EvaluationSystem } from "../utils/evaluationSystem.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* -------------------------------------------------------
 * 안전 유틸: 문자열/배열/객체 → 문자열 배열로 평탄화
 * ----------------------------------------------------- */
function toFlatStringArray(val) {
  if (typeof val === "string") return [val];
  if (Array.isArray(val)) return val.flatMap(v => toFlatStringArray(v));
  if (val && typeof val === "object") {
    return Object.values(val).flatMap(v => toFlatStringArray(v));
  }
  return [];
}

/* -------------------------------------------------------
 * mentions 출력용 안전 문자열화 (객체/배열 섞여도 OK)
 * ----------------------------------------------------- */
function stringifyMentions(mentions) {
  if (!mentions || typeof mentions !== "object") return "";
  try {
    return Object.entries(mentions)
      .map(([key, values]) => {
        const arr = toFlatStringArray(values);
        if (arr.length) return `${key}: ${arr.join(", ")}`;
        // 값이 비어있을 때 객체 키=값 형태로 최대한 표현
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

/* -------------------------------------------------------
 * 키워드 커버리지 계산(mentions에 객체 섞여도 안전)
 * ----------------------------------------------------- */
function checkItemCoverage(item, text, mentions) {
  // 키워드 추출
  const keywords = extractItemKeywords(item).map(s => s.toLowerCase());
  if (keywords.length === 0) return 0;

  // 사용자가 입력한 전체 텍스트 (이미 toLowerCase 적용된 형태로 넘겨옴)
  const haystackText = String(text || "").toLowerCase();

  // mentions에서 가능한 모든 문자열 추출 후 합치기
  const mentionText = toFlatStringArray(mentions).map(s => String(s).toLowerCase()).join(" ");

  let matches = 0;
  for (const kw of keywords) {
    if (!kw) continue;
    if (haystackText.includes(kw) || mentionText.includes(kw)) {
      matches++;
    }
  }
  return Math.min(1, matches / keywords.length);
}

/* -------------------------------------------------------
 * 키워드 추출 로직 (기존 그대로 유지 + 보완)
 * ----------------------------------------------------- */
function extractItemKeywords(item) {
  const keywordMap = {
    '목적': ['목적', '용도', '목표'],
    '시청자': ['시청자', '대상', '타겟'],
    '길이': ['길이', '시간', '분', '초'],
    '플랫폼': ['플랫폼', '유튜브', '인스타'],
    '스토리': ['스토리', '구성', '흐름'],
    '등장인물': ['등장인물', '캐릭터', '인물'],
    '카메라': ['카메라', '촬영', '앵글'],
    '음향': ['음향', '음악', '소리']
  };

  for (const [key, keywords] of Object.entries(keywordMap)) {
    if (String(item).includes(key)) return keywords;
  }
  return String(item).split(' ').filter(word => word.length > 1);
}

/* -------------------------------------------------------
 * OpenAI 호출 래퍼 (구조 유지, 런타임 키도 함께 체크)
 * ----------------------------------------------------- */
async function callOpenAI(prompt, temperature = 0.7) {
  const RUNTIME_KEY = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  const apiKey = RUNTIME_KEY && RUNTIME_KEY !== 'your-api-key-here' ? RUNTIME_KEY : null;
  if (!apiKey) throw new Error('AI_SERVICE_UNAVAILABLE');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: 1000
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API 오류: ${response.status} - ${errorData.error?.message || 'Unknown'}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim();
}

/* -------------------------------------------------------
 * 도메인 체크리스트 (원문 유지)
 * ----------------------------------------------------- */
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

// 유틸리티 인스턴스들 (원문 유지)
const mentionExtractor = new MentionExtractor();
const intentAnalyzer = new IntentAnalyzer();
const evaluationSystem = new EvaluationSystem();

export default async function handler(req, res) {
  console.log('🚀 AI 프롬프트 개선기 8단계 플로우 시작');

  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ 
      error: true,
      message: 'Method not allowed. Use POST.'
    });
  }

  try {
    // 📥 1단계: 사용자 입력 받기
    const requestData = await readJson(req);
    const { 
      userInput = "", 
      answers = [], 
      domain = "video",
      step = "start",
      round = 1
    } = requestData;

    console.log(`📍 현재 단계: ${step}, 라운드: ${round}`);

    // 런타임 키도 함께 확인(캐싱 이슈 방지)
    const RUNTIME_KEY = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
    if (!RUNTIME_KEY || RUNTIME_KEY === 'your-api-key-here') {
      throw new Error('AI_SERVICE_UNAVAILABLE');
    }

    // 단계별 처리
    switch (step) {
      case 'start':
        return await handleStart(res, userInput, domain);
      case 'questions':
        return await handleQuestions(res, userInput, answers, domain, round);
      case 'generate':
        return await handleGenerate(res, userInput, answers, domain);
      default:
        throw new Error('INVALID_STEP');
    }

  } catch (error) {
    console.error('❌ API 오류:', error);
    return handleError(res, error);
  }
}

// 🎯 2단계: AI가 체크리스트 보고 질문 생성
async function handleStart(res, userInput, domain) {
  console.log('📍 2단계: AI 체크리스트 질문 생성');

  try {
    // 키워드 추출
    const mentions = mentionExtractor.extract(userInput);
    console.log('🔍 추출된 키워드:', mentions);

    // 체크리스트 기반 AI 질문 생성
    const questions = await generateAIQuestions(userInput, [], domain, mentions, 1);

    return res.status(200).json({
      success: true,
      step: 'questions',
      questions,
      round: 1,
      mentions,
      message: 'AI가 체크리스트를 분석해서 질문을 생성했습니다.'
    });

  } catch (error) {
    throw new Error(`AI_QUESTION_GENERATION_FAILED: ${error.message}`);
  }
}

// 🔄 3-6단계: 답변 수집 → 의도분석 → 추가질문
async function handleQuestions(res, userInput, answers, domain, round) {
  console.log('📍 3-6단계: 답변 분석 및 의도 파악');

  try {
    // 📍 4단계: intentAnalyzer.js로 95점 계산
    const intentScore = intentAnalyzer.calculateIntentScore(userInput, answers, domain);
    console.log('📊 의도 파악 점수:', intentScore);

    if (intentScore >= 95) {
      // 충분한 정보 수집 → 프롬프트 생성 단계로
      return res.status(200).json({
        success: true,
        step: 'generate',
        intentScore,
        message: '의도 파악 완료! 프롬프트를 생성합니다.'
      });
    } else {
      // 📍 6단계: 95점 미만 → AI 추가 질문 생성
      const mentions = mentionExtractor.extract([userInput, ...answers].join(' '));
      const additionalQuestions = await generateAIQuestions(
        userInput, 
        answers, 
        domain, 
        mentions, 
        round + 1
      );

      return res.status(200).json({
        success: true,
        step: 'questions',
        questions: additionalQuestions,
        round: round + 1,
        intentScore,
        message: `의도 파악 ${intentScore}점. 95점 달성을 위한 추가 질문입니다.`
      });
    }

  } catch (error) {
    throw new Error(`INTENT_ANALYSIS_FAILED: ${error.message}`);
  }
}

// 🎯 5-8단계: 프롬프트 생성 → 품질 평가
async function handleGenerate(res, userInput, answers, domain) {
  console.log('📍 5-8단계: AI 프롬프트 생성 및 품질 평가');

  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 프롬프트 생성 시도 ${attempts}/${maxAttempts}`);

    try {
      // 📍 5단계: AI가 사용자 답변 보고 프롬프트 생성 ⭐핵심⭐
      const generatedPrompt = await generateAIPrompt(userInput, answers, domain);
      console.log('🤖 AI 생성 프롬프트:', (generatedPrompt || '').substring(0, 100) + '...');

      // 📍 8단계: evaluationSystem.js로 품질 95점 계산
      const qualityScore = evaluationSystem.evaluatePromptQuality(generatedPrompt, domain);
      console.log('📊 프롬프트 품질 점수:', qualityScore.total);

      if (qualityScore.total >= 95) {
        // 🎉 완성!
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
        // 품질 부족 → 재생성 (5번~6번 반복)
        console.log(`⚠️ 품질 ${qualityScore.total}점 → 재생성 필요`);
        if (attempts >= maxAttempts) {
          // 최대 시도 횟수 도달
          return res.status(200).json({
            success: true,
            step: 'completed',
            originalPrompt: userInput,
            improvedPrompt: generatedPrompt,
            intentScore: 95,
            qualityScore: qualityScore.total,
            attempts,
            message: `최대 시도 도달. 현재 최고 품질 ${qualityScore.total}점으로 완료.`
          });
        }
      }

    } catch (error) {
      console.error(`💥 시도 ${attempts} 실패:`, error.message);
      if (attempts >= maxAttempts) {
        throw new Error(`AI_GENERATION_MAX_ATTEMPTS: ${error.message}`);
      }
    }
  }
}

// 🤖 AI 질문 생성 함수
async function generateAIQuestions(userInput, answers, domain, mentions, round) {
  const checklist = DOMAIN_CHECKLISTS[domain] || DOMAIN_CHECKLISTS.video;
  const allText = [userInput, ...answers].join(' ').toLowerCase();

  // 체크리스트 항목 중 부족한 것 찾기
  const missingItems = [];
  Object.entries(checklist).forEach(([category, items]) => {
    items.forEach(item => {
      const coverage = checkItemCoverage(item, allText, mentions);
      if (coverage < 0.7) {
        missingItems.push({ category, item, coverage });
      }
    });
  });

  const safeMentions = stringifyMentions(mentions);

  const prompt = `당신은 ${domain} 전문가입니다. 사용자의 프롬프트를 완벽하게 만들기 위해 질문을 생성해주세요.

=== 현재 상황 ===
- 도메인: ${domain}
- 라운드: ${round}
- 사용자 입력: "${userInput}"
- 이전 답변: ${answers.length > 0 ? answers.join(', ') : '없음'}

=== 추출된 키워드 ===
${safeMentions || '(없음)'}

=== 아직 부족한 정보 ===
${missingItems.slice(0, 8).map(item => `❌ ${item.item}`).join('\n')}

=== 질문 생성 규칙 ===
1. 가장 중요하고 부족한 정보 3-5개만 선택
2. 사용자가 답하기 쉬운 객관식으로 구성
3. 각 질문당 4-5개 선택지 + "직접 입력" 옵션
4. ${round}라운드에 맞는 디테일 수준으로 조정
5. 이미 파악된 정보는 묻지 않기

JSON 형태로 응답:
{
  "questions": [
    {
      "key": "unique_key",
      "question": "구체적인 질문 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4", "직접 입력"],
      "priority": "high|medium|low",
      "category": "해당 카테고리"
    }
  ]
}`;

  const response = await callOpenAI(prompt, 0.7);

  try {
    const result = JSON.parse(response);
    return result.questions || [];
  } catch (error) {
    console.error('AI 질문 파싱 오류:', error);
    throw new Error('AI 응답을 파싱할 수 없습니다.');
  }
}

// 🤖 AI 프롬프트 생성 함수 (5단계 핵심)
async function generateAIPrompt(userInput, answers, domain) {
  const allAnswers = [userInput, ...answers].join('\n');

  const domainPrompts = {
    video: `다음 정보를 바탕으로 전문적인 영상 제작 프롬프트를 생성해주세요:

${allAnswers}

요구사항:
- 씬별 타임라인 구성
- 구체적인 등장인물 설정
- 카메라워크와 편집 지시사항
- 음향 및 자막 가이드
- 기술적 사양 (해상도, 코덱 등)
- 500-800자 분량`,

    image: `다음 정보를 바탕으로 전문적인 이미지 생성 프롬프트를 생성해주세요:

${allAnswers}

요구사항:
- 구체적인 주제와 구도 설명
- 색상 팔레트와 조명 설정
- 스타일과 기법 명시
- 세부 디테일과 분위기
- 기술적 사양 (해상도, 비율)
- 400-600자 분량`,

    dev: `다음 정보를 바탕으로 전문적인 개발 요구사항을 생성해주세요:

${allAnswers}

요구사항:
- 프로젝트 개요와 목적
- 핵심 기능 명세
- 기술 스택과 아키텍처
- UI/UX 가이드라인
- 성능 및 보안 요구사항
- 600-1000자 분량`
  };

  const prompt = domainPrompts[domain] || domainPrompts.video;
  return await callOpenAI(prompt, 0.8);
}

// ❌ 에러 처리
function handleError(res, error) {
  const errorMessage = error.message || '';

  if (errorMessage.includes('AI_SERVICE_UNAVAILABLE')) {
    return res.status(503).json({
      error: true,
      type: 'service_unavailable',
      title: '🚫 AI 서비스 이용 불가',
      message: 'OpenAI API 키가 설정되지 않았습니다.',
      canRetry: false
    });
  }

  if (errorMessage.includes('QUOTA_EXCEEDED')) {
    return res.status(503).json({
      error: true,
      type: 'quota_exceeded',
      title: '🚫 AI 사용량 초과',
      message: 'AI 서비스 사용량이 초과되었습니다.',
      canRetry: true,
      retryAfter: '1-2시간'
    });
  }

  return res.status(500).json({
    error: true,
    type: 'system_error',
    title: '❌ 시스템 오류',
    message: 'AI 프롬프트 개선 중 오류가 발생했습니다.',
    canRetry: true,
    originalError: errorMessage
  });
}
