// 원래 복잡한 버전 - 환경변수만 핸들러 내부로 이동
import { SlotSystem } from "../utils/slotSystem.js";
import { IntentAnalyzer } from "../utils/intentAnalyzer.js";
import { MentionExtractor } from "../utils/mentionExtractor.js";
import { QuestionOptimizer } from "../utils/questionOptimizer.js";
import { EvaluationSystem } from "../utils/evaluationSystem.js";
import { readJson } from "./helpers.js";

const slots = new SlotSystem();
const analyzer = new IntentAnalyzer(slots, new MentionExtractor());
const qo = new QuestionOptimizer();
const evaluator = new EvaluationSystem();

export default async function handler(req, res) {
  console.log('🚀 [API/IMPROVE-PROMPT] 요청 시작');
  
  // 환경변수를 핸들러 내부에서 읽기 - 캐싱 문제 해결
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  console.log('🔑 환경변수 확인:', {
    hasKey: !!OPENAI_API_KEY,
    keyLength: OPENAI_API_KEY ? OPENAI_API_KEY.length : 0
  });

  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    console.log('❌ POST가 아닌 요청');
    return res.status(405).end();
  }

  try {
    console.log('📖 JSON 읽기 시작');
    const requestData = await readJson(req);
    console.log('📖 읽은 데이터:', requestData);

    const { 
      userInput = "", 
      answers = [], 
      domain = "image",
      askedKeys = [], 
      step = "questions"
    } = requestData;

    console.log('🔍 파라미터 추출:', {
      userInput: userInput.slice(0, 50) + '...',
      answersCount: answers.length,
      domain,
      step,
      askedKeysCount: askedKeys.length
    });

    // API 키 검증
    if (!OPENAI_API_KEY) {
      console.error('❌ API 키 없음');
      return res.status(503).json({
        error: true,
        type: 'no_api_key',
        title: '🚫 API 키 없음',
        message: 'OPENAI_API_KEY가 설정되지 않았습니다.'
      });
    }

    // Step별 처리
    if (step === "questions") {
      return await handleQuestions(userInput, answers, domain, askedKeys, res);
    } else if (step === "final") {
      return await handleFinalImprove(userInput, answers, domain, OPENAI_API_KEY, res);
    } else {
      return res.status(400).json({
        error: true,
        message: 'Invalid step parameter'
      });
    }

  } catch (error) {
    console.error('❌ 전체 시스템 오류:', error);
    console.error('❌ 오류 스택:', error.stack);
    
    res.status(500).json({ 
      error: true,
      message: String(error?.message || error),
      stack: error?.stack,
      timestamp: new Date().toISOString()
    });
  }
}

// 질문 처리
async function handleQuestions(userInput, answers, domain, askedKeys, res) {
  console.log('❓ 질문 처리 시작');
  
  // 의도 분석
  const report = analyzer.generateAnalysisReport(userInput, answers, { primary: domain });
  console.log('📊 의도 분석 결과:', report);

  let missing = report.missingSlots || [];
  console.log('🔍 부족한 슬롯:', missing);
  
  const asked = new Set(Array.isArray(askedKeys) ? askedKeys : []);
  missing = missing.filter(k => !asked.has(k));
  console.log('🔍 아직 안 물어본 슬롯:', missing);

  // 질문 중단 조건 체크
  const shouldStop = report.intentScore >= 95 || missing.length === 0;
  console.log('🛑 중단 조건 체크:', {
    intentScore: report.intentScore,
    missingCount: missing.length,
    shouldStop
  });

  if (shouldStop) {
    console.log('🎉 질문 완료 - 최종 프롬프트 생성 단계로');
    return res.status(200).json({ 
      questions: [], 
      missing, 
      intentScore: report.intentScore,
      shouldProceedToFinal: true,
      message: '질문 완료! 프롬프트 생성 단계로 넘어갑니다.'
    });
  }

  // 질문 후보 생성
  console.log('❓ 질문 생성 시작');
  const candidates = slots.questionsFor(missing, domain, askedKeys);
  console.log('📝 질문 후보들:', candidates);

  const best = qo.optimize(candidates, {}, { primary: domain }, 2);
  console.log('🎯 최적화된 질문들:', best);

  const questions = (best || []).map(x => ({ 
    key: x.key, 
    question: x.question 
  }));

  console.log('✅ 최종 질문들:', questions);

  const response = {
    questions, 
    missing, 
    intentScore: report.intentScore,
    message: `${questions.length}개 질문 생성 완료`
  };

  console.log('📤 응답 데이터:', response);
  return res.status(200).json(response);
}

// 최종 프롬프트 생성
async function handleFinalImprove(userInput, answers, domain, apiKey, res) {
  console.log('🎯 최종 프롬프트 생성 시작');
  
  const allText = [userInput, ...answers].join(' ');
  
  // 도메인별 프롬프트 템플릿
  const prompts = {
    image: `다음 한국어 요청을 상세한 영어 이미지 프롬프트로 개선하세요:
"${allText}"

요구사항:
- 주체, 스타일, 구도, 조명을 포함
- 품질 키워드 추가 (masterpiece, award-winning)
- 카메라 설정 및 예술적 스타일 명시
- 최대 400단어
- 전문 사진/예술 용어 사용`,
    
    video: `다음 영상 요청을 상세한 기획서로 개선하세요:
"${allText}"

요구사항:
- 목적, 길이, 스타일, 대상 관객 명시
- 기술 사양 포함 (해상도, 포맷)
- 제작 세부사항 추가 (카메라워크, 편집 스타일)
- 한국어 400자 이내`,
    
    dev: `다음 개발 요청을 상세한 기술 요구사항으로 개선하세요:
"${allText}"

요구사항:
- 프로젝트 유형, 핵심 기능, 대상 사용자 명시
- 기술 스택 및 제약사항 포함
- 성능 및 보안 요구사항 추가
- 한국어 400자 이내`
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: prompts[domain] || prompts.image
        }],
        temperature: 0.7,
        max_tokens: 600
      }),
      signal: AbortSignal.timeout(15000)
    });

    console.log('🤖 OpenAI 응답 상태:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('🤖 OpenAI 오류:', errorData);
      throw new Error(`OpenAI API 오류: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const improved = data.choices[0]?.message?.content?.trim();

    if (!improved || improved.length < 10) {
      throw new Error('OpenAI 응답이 비어있거나 너무 짧습니다.');
    }

    // 프롬프트 품질 평가
    const qualityEvaluation = evaluator.evaluatePromptQuality(improved, domain);
    
    console.log('✨ 최종 완료:', {
      originalLength: userInput.length,
      improvedLength: improved.length,
      qualityScore: qualityEvaluation.total
    });

    return res.status(200).json({
      success: true,
      improved: improved,
      intentScore: 95, // 최종 단계에서는 95점으로 가정
      promptScore: qualityEvaluation.total,
      message: '✨ AI가 프롬프트를 완벽하게 개선했습니다!',
      method: 'openai_success',
      originalLength: userInput.length,
      improvedLength: improved.length,
      domain: domain,
      tokenUsage: data.usage,
      qualityDetails: qualityEvaluation
    });

  } catch (error) {
    console.error('💥 OpenAI 호출 오류:', error);
    
    let errorResponse = {
      error: true,
      title: '💥 AI 서비스 오류',
      message: 'AI 서비스에 문제가 발생했습니다.',
      suggestion: '잠시 후 다시 시도해주세요.'
    };
    
    if (error.message.includes('401')) {
      errorResponse.title = '🔐 인증 오류';
      errorResponse.message = 'OpenAI API 키가 유효하지 않습니다.';
    } else if (error.message.includes('429')) {
      errorResponse.title = '🚫 사용량 초과';
      errorResponse.message = 'API 사용량 한도를 초과했습니다.';
    } else if (error.name === 'AbortError') {
      errorResponse.title = '⏰ 시간 초과';
      errorResponse.message = 'AI 서비스 응답이 너무 오래 걸립니다.';
    }
    
    return res.status(503).json(errorResponse);
  }
}
