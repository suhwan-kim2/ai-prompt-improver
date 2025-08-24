// api/improve-prompt.js - 완전 수정된 버그 없는 버전

// Utils import (안전한 방식)
import { evaluatePrompt } from '../utils/evaluationSystem.js';
import { SlotSystem } from '../utils/slotSystem.js';
import { MentionExtractor } from '../utils/mentionExtractor.js';
import { QuestionOptimizer } from '../utils/questionOptimizer.js';

// IntentAnalyzer 동적 로딩
let IntentAnalyzer = null;

async function loadIntentAnalyzer() {
  if (IntentAnalyzer !== null) return IntentAnalyzer;
  
  try {
    const intentModule = await import('../utils/intentAnalyzer.js');
    IntentAnalyzer = intentModule.IntentAnalyzer;
    console.log('IntentAnalyzer 로드 성공');
    return IntentAnalyzer;
  } catch (error) {
    console.error('IntentAnalyzer 로드 실패:', error);
    IntentAnalyzer = false;
    return null;
  }
}

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 방식만 허용됩니다' });
  }

  try {
    const { step, userInput, answers, mode = 'normal' } = req.body;
    
    console.log('API 요청 받음:', { step, mode, userInput: userInput?.substring(0, 50) + '...' });

    // step 파라미터 검증 (모든 가능한 값 포함)
    const validSteps = ['questions', 'final-improve', 'additional-questions'];
    if (!step || !validSteps.includes(step)) {
      console.error('잘못된 step 파라미터:', step);
      return res.status(400).json({ 
        error: '유효하지 않은 step 파라미터',
        received: step,
        expected: validSteps
      });
    }

    // 사용자 입력 검증
    if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
      return res.status(400).json({ 
        error: '사용자 입력이 필요합니다',
        received: { userInput, step, mode }
      });
    }

    // OpenAI API 키 확인
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 
                          process.env.REACT_APP_OPENAI_API_KEY || 
                          process.env.VITE_OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.log('OpenAI API 키가 없어서 폴백 모드로 실행');
      return handleFallbackMode(step, userInput, answers || [], res);
    }

    // 한국어 강제 프롬프트
    const KOREAN_ENFORCER = `
!!! 절대 중요한 지시사항 !!!
- 반드시 모든 응답을 한국어로만 작성하세요
- 영어나 다른 언어는 절대 사용 금지
- 질문도 한국어로만 생성하세요
`;

    // OpenAI API 호출 함수
    async function callOpenAI(messages, maxRetries = 2) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`OpenAI API 호출 시도 ${attempt}/${maxRetries}`);
          
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: messages,
              temperature: 0.7,
              max_tokens: 1500,
              timeout: 25000
            })
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`OpenAI API 오류 ${response.status}: ${errorData}`);
          }

          const data = await response.json();
          const content = data.choices[0].message.content;
          
          if (!isValidKoreanResponse(content)) {
            console.log('영어 응답 감지, 재시도');
            throw new Error('영어 응답 감지됨');
          }
          
          return content;

        } catch (error) {
          console.log(`OpenAI 시도 ${attempt} 실패:`, error.message);
          
          if (attempt === maxRetries) {
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // 한국어 응답 검증
    function isValidKoreanResponse(text) {
      if (!text || text.trim().length === 0) return false;
      
      try {
        if (text.trim().startsWith('{')) {
          const parsed = JSON.parse(text);
          if (parsed.questions && Array.isArray(parsed.questions)) {
            return parsed.questions.every(q => 
              typeof q === 'string' && /[가-힣]/.test(q)
            );
          }
          if (parsed.improved_prompt) {
            return /[가-힣]/.test(parsed.improved_prompt);
          }
        }
      } catch (e) {
        // JSON 아닌 경우
      }
      
      const koreanChars = (text.match(/[가-힣]/g) || []).length;
      const totalChars = text.replace(/\s/g, '').length;
      return koreanChars > 0 && (koreanChars / totalChars) > 0.1;
    }

    // ============================================================================
    // 1단계: 질문 생성
    // ============================================================================
    if (step === 'questions') {
      try {
        console.log('질문 생성 단계 시작');
        
        let analysis = null;
        
        // 의도 분석 시도
        const intentAnalyzer = await loadIntentAnalyzer();
        if (intentAnalyzer) {
          try {
            const analyzer = new intentAnalyzer();
            analysis = analyzer.generateAnalysisReport(userInput, answers || []);
            console.log('의도 분석 성공:', analysis?.intentScore);
          } catch (error) {
            console.error('의도 분석 실패:', error);
          }
        }

        // 기본 분석 (항상 실행)
        const mentionExtractor = new MentionExtractor();
        const mentionedInfo = mentionExtractor.extract(userInput);
        
        const slotSystem = new SlotSystem();
        const detectedDomains = slotSystem.detectDomains(userInput);
        
        // AI 질문 생성
        const questionCount = mode === 'expert' ? 6 : 4;
        
        const questionPrompt = [
          {
            role: 'system',
            content: `${KOREAN_ENFORCER}

당신은 사용자 의도 파악 전문가입니다.

${analysis ? `현재 의도 분석:
- 의도 점수: ${analysis.intentScore}/100
- 전략: ${analysis.strategy?.message || '기본'}` : '기본 분석 모드'}

질문 생성 규칙:
1. 반드시 한국어로만 질문 작성
2. 구체적이고 답변하기 쉬운 질문
3. ${questionCount}개 이하의 적절한 질문 생성
4. 이미 파악된 정보는 다시 묻지 않기

응답 형식 (반드시 JSON):
{
  "questions": ["질문1", "질문2", "질문3"]
}`
          },
          {
            role: 'user',
            content: `사용자 입력: "${userInput}"

이 입력을 분석해서 사용자 의도를 완벽히 파악하기 위한 ${questionCount}개 이하의 질문을 생성해주세요.`
          }
        ];

        try {
          const result = await callOpenAI(questionPrompt);
          const parsedResult = JSON.parse(result);
          
          // 질문 검증 및 정리
          let questions = [];
          if (parsedResult.questions && Array.isArray(parsedResult.questions)) {
            questions = parsedResult.questions
              .filter(q => typeof q === 'string' && q.trim().length > 0)
              .map(q => q.trim())
              .slice(0, questionCount);
          }
          
          if (questions.length === 0) {
            throw new Error('유효한 질문이 생성되지 않음');
          }
          
          console.log(`AI 질문 생성 성공: ${questions.length}개`);
          
          return res.json({
            questions: questions,
            analysis: analysis,
            domains: detectedDomains,
            mentioned: mentionedInfo,
            ai_mode: true
          });
          
        } catch (error) {
          console.log('AI 질문 생성 실패, 폴백 사용:', error.message);
          throw error;
        }

      } catch (error) {
        console.log('질문 생성 전체 실패, 폴백 모드');
        return handleFallbackQuestions(userInput, res, mode);
      }
    }

    // ============================================================================
    // 2단계: 추가 질문 생성
    // ============================================================================
    if (step === 'additional-questions') {
      try {
        console.log('추가 질문 생성 시작');
        
        const answersArray = Array.isArray(answers) ? answers : [];
        const existingInfo = answersArray.join(' ');
        
        const additionalPrompt = [
          {
            role: 'system',
            content: `${KOREAN_ENFORCER}

당신은 추가 정보 수집 전문가입니다.

기존 답변을 분석해서 부족한 부분을 찾아 2-3개의 추가 질문을 생성하세요.

응답 형식 (반드시 JSON):
{
  "questions": ["추가질문1", "추가질문2"]
}`
          },
          {
            role: 'user',
            content: `원본 요청: "${userInput}"

기존 답변들:
${existingInfo || '답변 없음'}

이 정보를 바탕으로 더 완벽한 결과물을 위한 추가 질문 2-3개를 생성해주세요.`
          }
        ];

        try {
          const result = await callOpenAI(additionalPrompt);
          const parsedResult = JSON.parse(result);
          
          let additionalQuestions = [];
          if (parsedResult.questions && Array.isArray(parsedResult.questions)) {
            additionalQuestions = parsedResult.questions
              .filter(q => typeof q === 'string' && q.trim().length > 0)
              .slice(0, 3);
          }
          
          if (additionalQuestions.length === 0) {
            throw new Error('추가 질문 생성 실패');
          }
          
          return res.json({
            questions: additionalQuestions,
            mode: 'additional'
          });
          
        } catch (error) {
          console.log('AI 추가 질문 생성 실패, 폴백 사용');
          throw error;
        }

      } catch (error) {
        // 폴백 추가 질문
        const fallbackQuestions = [
          "더 구체적으로 설명하고 싶은 부분이 있나요?",
          "추가로 고려해야 할 사항이 있나요?",
          "특별한 제약이나 조건이 있나요?"
        ];
        
        return res.json({
          questions: fallbackQuestions.slice(0, 2),
          mode: 'fallback_additional'
        });
      }
    }

    // ============================================================================
    // 3단계: 최종 프롬프트 개선
    // ============================================================================
    if (step === 'final-improve') {
      try {
        console.log('최종 프롬프트 개선 시작');
        
        const answersArray = Array.isArray(answers) ? answers : [];
        const answersText = answersArray
          .filter(a => a && typeof a === 'string' && a.trim().length > 0)
          .join('\n');

        const improvePrompt = [
          {
            role: 'system',
            content: `${KOREAN_ENFORCER}

당신은 세계 최고 수준의 프롬프트 엔지니어링 전문가입니다.

목표: 95점 이상의 전문가급 프롬프트를 한국어로 생성

95점 달성 기준:
1. 구체적 기술 사양 (해상도, fps, 크기 등)
2. 정확한 수치 정보 (시간, 크기, 비율 등)  
3. 세부적인 스타일 지시사항
4. 명확한 품질 요구사항
5. 실행 가능한 구체성
6. 불필요한 감정 표현 제거

개선 원칙:
- "감동적이고 따뜻한" → 삭제 (감정 표현 불필요)
- "30초 이하" → "정확히 25-30초"
- "큰 개" → "골든 리트리버 (체고 60cm)"
- "밝고 화사한" → "밝은 조명, 채도 높은 색감"
- "고품질" → "4K 해상도, 고화질"

응답 형식 (반드시 JSON):
{
  "improved_prompt": "구체적이고 기술적인 95점 프롬프트",
  "score": 95,
  "improvements": ["개선사항1", "개선사항2", "개선사항3"]
}`
          },
          {
            role: 'user',
            content: `원본 요청: "${userInput}"

${answersText ? `사용자 추가 정보:
${answersText}` : '추가 정보 없음'}

위 정보를 바탕으로 95점 이상의 전문가급 프롬프트로 개선해주세요.`
          }
        ];

        try {
          const result = await callOpenAI(improvePrompt);
          const parsedResult = JSON.parse(result);
          
          if (!parsedResult.improved_prompt) {
            throw new Error('개선된 프롬프트가 없음');
          }
          
          // 평가 시스템으로 점수 계산
          const evaluationResult = evaluatePrompt(parsedResult.improved_prompt, userInput);
          const finalScore = typeof evaluationResult === 'object' ? evaluationResult.total : evaluationResult;
          
          console.log('AI 프롬프트 개선 성공, 점수:', finalScore);
          
          return res.json({
            improved_prompt: parsedResult.improved_prompt,
            score: finalScore,
            improvements: parsedResult.improvements || ['AI 기반 전문가급 개선'],
            evaluation_details: evaluationResult
          });
          
        } catch (error) {
          console.log('AI 프롬프트 개선 실패, 폴백 사용');
          throw error;
        }

      } catch (error) {
        console.log('최종 개선 전체 실패, 폴백 모드');
        return handleFallbackImprovement(userInput, answers || [], res);
      }
    }

    // 잘못된 step
    return res.status(400).json({ 
      error: 'step은 questions, final-improve 또는 additional-questions 이어야 합니다',
      received: step,
      expected: validSteps
    });

  } catch (error) {
    console.error('전체 API 오류:', error);
    return res.status(500).json({ 
      error: '서버 내부 오류가 발생했습니다',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// ============================================================================
// 폴백 모드 함수들
// ============================================================================

function handleFallbackMode(step, userInput, answers, res) {
  console.log('폴백 모드 실행:', step);
  
  if (step === 'questions') {
    return handleFallbackQuestions(userInput, res, 'normal');
  }
  
  if (step === 'additional-questions') {
    const fallbackQuestions = [
      "더 구체적으로 설명하고 싶은 부분이 있나요?",
      "추가로 고려해야 할 사항이 있나요?"
    ];
    
    return res.json({
      questions: fallbackQuestions,
      mode: 'fallback_additional'
    });
  }
  
  if (step === 'final-improve') {
    return handleFallbackImprovement(userInput, answers, res);
  }
  
  return res.status(400).json({ error: '잘못된 step 파라미터' });
}

function handleFallbackQuestions(userInput, res, mode = 'normal') {
  console.log('폴백 질문 생성');
  
  // 완성도 분석
  const analysis = analyzeCompleteness(userInput);
  
  if (analysis.completeness > 75) {
    return res.json({
      questions: [],
      analysis: { intentScore: analysis.completeness },
      message: "충분한 정보가 제공되어 바로 개선 가능합니다.",
      mode: 'fallback_skip'
    });
  }
  
  // 기본 질문 생성
  const basicQuestions = [
    "구체적으로 무엇을 만들고 싶으신가요?",
    "어떤 스타일이나 느낌을 원하시나요?",
    "크기나 해상도 등 요구사항이 있나요?",
    "누가 사용하거나 볼 예정인가요?",
    "특별히 중요하게 생각하는 부분이 있나요?",
    "용도나 목적이 정해져 있나요?"
  ];
  
  const questionCount = mode === 'expert' ? 5 : 3;
  const selectedQuestions = [];
  
  // 부족한 정보에 따라 질문 선택
  if (!analysis.already_provided.includes('목적')) {
    selectedQuestions.push(basicQuestions[0]);
  }
  if (!analysis.already_provided.includes('스타일')) {
    selectedQuestions.push(basicQuestions[1]);
  }
  if (!analysis.already_provided.includes('크기')) {
    selectedQuestions.push(basicQuestions[2]);
  }
  if (!analysis.already_provided.includes('대상')) {
    selectedQuestions.push(basicQuestions[3]);
  }
  
  // 부족하면 나머지 추가
  while (selectedQuestions.length < questionCount && selectedQuestions.length < basicQuestions.length) {
    const remaining = basicQuestions.filter(q => !selectedQuestions.includes(q));
    if (remaining.length > 0) {
      selectedQuestions.push(remaining[0]);
    } else {
      break;
    }
  }
  
  return res.json({
    questions: selectedQuestions.slice(0, questionCount),
    analysis: { intentScore: analysis.completeness },
    mode: 'fallback'
  });
}

function handleFallbackImprovement(userInput, answers, res) {
  console.log('폴백 프롬프트 개선');
  
  let improvedPrompt = userInput;
  const improvements = [];
  
  // 답변 정보 통합
  if (answers && Array.isArray(answers) && answers.length > 0) {
    const validAnswers = answers
      .filter(a => a && typeof a === 'string' && a.trim().length > 0)
      .map(a => a.trim());
    
    if (validAnswers.length > 0) {
      improvedPrompt = `${userInput}\n\n추가 요구사항: ${validAnswers.join(', ')}`;
      improvements.push('사용자 답변 정보 통합');
    }
  }
  
  // 기본 품질 향상
  if (!improvedPrompt.match(/(고품질|고화질|4K|HD)/i)) {
    improvedPrompt += ', 고품질로 제작';
    improvements.push('품질 요구사항 추가');
  }
  
  // 해상도 추가
  if (!improvedPrompt.match(/\d+x\d+|\d+(px|K|p)/i)) {
    if (improvedPrompt.match(/(이미지|그림|사진|포스터)/i)) {
      improvedPrompt += ', 1920x1080 해상도';
      improvements.push('기본 해상도 추가');
    }
  }
  
  // 구체성 추가
  if (!improvedPrompt.match(/\d+/)) {
    if (improvedPrompt.match(/(시간|길이|분량)/i)) {
      improvedPrompt += ', 약 30초 길이';
      improvements.push('시간 정보 추가');
    }
  }
  
  // 평가
  const evaluationResult = evaluatePrompt(improvedPrompt, userInput);
  const finalScore = typeof evaluationResult === 'object' ? evaluationResult.total : evaluationResult;
  
  return res.json({
    improved_prompt: improvedPrompt,
    score: finalScore,
    improvements: improvements,
    evaluation_details: evaluationResult,
    mode: 'fallback'
  });
}

function analyzeCompleteness(userInput) {
  const input = userInput.toLowerCase();
  const already_provided = [];
  let completeness = 30;
  
  // 크기/해상도
  if (input.match(/(크기|사이즈|해상도|4k|hd|fhd|px|cm|mm)/)) {
    already_provided.push('크기');
    completeness += 15;
  }
  
  // 목적/용도
  if (input.match(/(만들|생성|제작|디자인|개발|용도|목적)/)) {
    already_provided.push('목적');
    completeness += 15;
  }
  
  // 대상
  if (input.match(/(사용자|고객|아이|어른|학생|대상|타겟)/)) {
    already_provided.push('대상');
    completeness += 15;
  }
  
  // 스타일
  if (input.match(/(스타일|느낌|색상|톤|분위기|방식)/)) {
    already_provided.push('스타일');
    completeness += 10;
  }
  
  // 시간
  if (input.match(/(초|분|시간|길이|기간)/)) {
    already_provided.push('시간');
    completeness += 10;
  }
  
  // 구체성 보너스
  const numbers = (input.match(/\d+/g) || []).length;
  completeness += Math.min(15, numbers * 5);
  
  return {
    completeness: Math.min(100, completeness),
    already_provided
  };
}
