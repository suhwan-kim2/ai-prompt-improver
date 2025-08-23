// api/improve-prompt.js - 수정된 안정적인 AI 연결 + 오류 해결 시스템
import { evaluatePrompt } from '../utils/evaluationSystem.js';
import { SlotSystem } from '../utils/slotSystem.js';
import { MentionExtractor } from '../utils/mentionExtractor.js';
import { QuestionOptimizer } from '../utils/questionOptimizer.js';

// IntentAnalyzer import 디버깅 - 더 안정적으로
// ✅ 수정 코드
let IntentAnalyzer = null;

async function loadIntentAnalyzer() {
  if (IntentAnalyzer !== null) return IntentAnalyzer;
  
  try {
   // const intentModule = await import('../utils/intentAnalyzer.js');
    IntentAnalyzer = intentModule.IntentAnalyzer;
    console.log('IntentAnalyzer 로드 성공');
    return IntentAnalyzer;
  } catch (error) {
    console.error('IntentAnalyzer 로드 실패:', error);
    IntentAnalyzer = false; // 실패 표시
    return null;
  }
}

export default async function handler(req, res) {
  // CORS 설정 (브라우저 접근 허용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 방식만 허용됩니다' });
  }

  // 강력한 한국어 강제 프롬프트
  const KOREAN_ENFORCER = `
!!! 절대 중요한 지시사항 !!!
- 반드시 모든 응답을 한국어로만 작성하세요
- 영어나 다른 언어는 절대 사용 금지
- 질문도 한국어로만 생성하세요
- "What", "How", "Hello" 같은 영어 단어 사용 금지
- 한국어가 아닌 응답은 완전히 거부됩니다
`;

  try {
    const { step, userInput, answers, mode = 'normal' } = req.body;

    // 입력값 검증
    if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
      return res.status(400).json({ 
        error: '사용자 입력이 필요합니다',
        received: { userInput, step, mode }
      });
    }

    // OpenAI API 키 확인 (여러 환경변수 시도)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 
                          process.env.REACT_APP_OPENAI_API_KEY || 
                          process.env.VITE_OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.log('OpenAI API 키가 없어서 폴백 모드로 실행');
      return handleFallbackMode(step, userInput, answers || [], res);
    }

    // OpenAI API 호출 함수 (안정적 오류 처리)
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
              model: 'gpt-4o-mini', // 비용 최적화
              messages: messages,
              temperature: 0.7,
              max_tokens: 1500,
              timeout: 25000 // 25초 타임아웃
            })
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API 오류 ${response.status}: ${errorData}`);
          }

          const data = await response.json();
          const content = data.choices[0].message.content;
          
          // 완화된 한국어 검증
          if (!isValidKoreanResponse(content)) {
            console.log('영어 응답 감지, 재시도:', content.substring(0, 100));
            throw new Error('영어 응답 감지됨 - 재시도 필요');
          }
          
          return content;

        } catch (error) {
          console.log(`시도 ${attempt} 실패:`, error.message);
          
          if (attempt === maxRetries) {
            console.log('모든 시도 실패 - 폴백 모드로 전환');
            throw error;
          }
          
          // 재시도 전 잠시 대기
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // 완화된 한국어 응답 검증 함수
    function isValidKoreanResponse(text) {
      if (!text || text.trim().length === 0) return false;
      
      // JSON이면 내용만 체크
      if (text.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.questions && Array.isArray(parsed.questions)) {
            // 질문들이 한국어인지 체크
            return parsed.questions.every(q => 
              typeof q === 'string' && /[가-힣]/.test(q)
            );
          }
          if (parsed.improved_prompt) {
            return /[가-힣]/.test(parsed.improved_prompt);
          }
        } catch (e) {
          // JSON 파싱 실패시 일반 텍스트로 체크
        }
      }
      
      // 기본 한국어 체크 (완화됨)
      const koreanChars = (text.match(/[가-힣]/g) || []).length;
      const totalChars = text.replace(/\s/g, '').length;
      return koreanChars > 0 && (koreanChars / totalChars) > 0.1; // 10%로 완화
    }

    // 1단계: 의도 분석 기반 스마트 질문 생성
    // 1단계: 의도 분석 기반 스마트 질문 생성
      if (step === 'questions') {
        try {
          console.log('질문 생성 단계 시작:', { userInput, answers });
          
          let analysis = null;
          
          // ✅ 수정된 부분
          const intentAnalyzer = await loadIntentAnalyzer();
          if (intentAnalyzer) {
            try {
              const analyzer = new intentAnalyzer();
              analysis = analyzer.generateAnalysisReport(userInput, answers || []);
              console.log('의도 분석 성공:', analysis);
              // ...
            } catch (intentError) {
              console.error('의도 분석 실패:', intentError);
              analysis = null;
            }
          }

        // 기존 사용자 입력 분석 (항상 실행)
        const mentionExtractor = new MentionExtractor();
        const mentionedInfo = mentionExtractor.extract(userInput);
        
        const slotSystem = new SlotSystem();
        const detectedDomains = slotSystem.detectDomains(userInput);
        
        console.log('기본 분석 완료:', { detectedDomains, mentionedInfo });

        // AI를 통한 질문 생성
        const questionCount = analysis ? 
          (analysis.strategy?.questionCount || 5) : 5;

        const questionPrompt = [
          {
            role: 'system',
            content: `${KOREAN_ENFORCER}

당신은 사용자 의도 파악 전문가입니다.

${analysis ? `
현재 의도 분석 결과:
- 의도 점수: ${analysis.intentScore}/100
- 부족한 슬롯: ${analysis.priorities?.map(p => p.slot).join(', ') || '없음'}
- 전략: ${analysis.strategy?.focus || '기본'}

목표: ${analysis.strategy?.message || '사용자 의도 파악'}
` : '기본 질문 생성 모드'}

질문 생성 규칙:
1. 반드시 한국어로만 질문 작성
2. 이미 파악된 정보는 절대 다시 묻지 않기
3. 구체적이고 답변하기 쉬운 질문
4. 사용자 의도를 정확히 파악하는 데 집중
5. ${questionCount}개 이하의 적절한 질문 생성

응답 형식 (반드시 JSON):
{
  "questions": [
    "구체적인 질문 1",
    "구체적인 질문 2",
    "구체적인 질문 3"
  ]
}`
          },
          {
            role: 'user',
            content: `사용자 입력: "${userInput}"

${analysis ? `
의도 분석 결과:
- 점수: ${analysis.intentScore}점
- 부족한 정보: ${analysis.missingSlots?.join(', ') || '없음'}
- 추천사항: ${analysis.recommendations?.join(', ') || '없음'}
` : ''}

이 분석을 바탕으로 사용자 의도를 완벽히 파악하기 위한 질문을 생성해주세요.`
          }
        ];

        const result = await callOpenAI(questionPrompt);
        
        try {
          const parsedResult = JSON.parse(result);
          console.log('AI 질문 생성 성공:', parsedResult);
          
          // 질문 배열 검증 및 정리
          let questions = [];
          if (parsedResult.questions && Array.isArray(parsedResult.questions)) {
            questions = parsedResult.questions
              .filter(q => typeof q === 'string' && q.trim().length > 0)
              .map(q => q.trim())
              .slice(0, 6); // 최대 6개로 제한
          }
          
          console.log('검증된 질문들:', questions);
          
          if (questions.length === 0) {
            console.log('유효한 질문이 없음, 폴백 모드 사용');
            throw new Error('No valid questions generated');
          }
          
          return res.json({
            questions: questions,
            analysis: analysis,
            reasoning: parsedResult.reasoning || '질문 생성됨',
            domains: detectedDomains,
            mentioned: mentionedInfo,
            ai_mode: true
          });
          
        } catch (parseError) {
          console.error('AI 질문 파싱 실패:', parseError);
          console.error('원본 응답:', result);
          
          // 안전한 폴백 질문 생성
          const fallbackQuestions = generateSafeFallbackQuestions(userInput, analysis);
          
          return res.json({
            questions: fallbackQuestions,
            analysis: analysis,
            domains: detectedDomains,
            mentioned: mentionedInfo,
            mode: 'fallback'
          });
        }

      } catch (error) {
        console.log('AI 질문 생성 실패, 폴백 모드 사용:', error.message);
        return handleFallbackQuestions(userInput, res);
      }
    }

    // 2단계: 최종 프롬프트 개선
    if (step === 'final-improve') {
      try {
        // 답변 배열 처리
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

위 정보를 바탕으로 95점 이상의 전문가급 프롬프트로 개선해주세요. 
구체적인 수치와 기술 사양을 포함하고, 불필요한 감정 표현은 제거해주세요.`
          }
        ];

        const result = await callOpenAI(improvePrompt);
        
        try {
          const parsedResult = JSON.parse(result);
          console.log('AI 프롬프트 개선 성공:', parsedResult);
          
          // 개선된 프롬프트 평가
          const score = evaluatePrompt(parsedResult.improved_prompt, userInput);
          
          return res.json({
            improved_prompt: parsedResult.improved_prompt,
            score: typeof score === 'object' ? score.total : score,
            improvements: parsedResult.improvements || [],
            evaluation_details: score
          });
          
        } catch (parseError) {
          console.log('JSON 파싱 실패, 폴백 개선 사용');
          throw parseError;
        }

      } catch (error) {
        console.log('AI 프롬프트 개선 실패, 폴백 모드 사용:', error.message);
        return handleFallbackImprovement(userInput, answers || [], res);
      }
    }

    return res.status(400).json({ 
      error: 'step은 questions 또는 final-improve 이어야 합니다',
      received: step
    });

  } catch (error) {
    console.error('전체 API 오류:', error);
    return res.status(500).json({ 
      error: '서버 오류가 발생했습니다',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// 안전한 폴백 질문 생성
function generateSafeFallbackQuestions(userInput, analysis) {
  console.log('안전한 폴백 질문 생성:', { userInput, analysis });
  
  const basicQuestions = [
    "구체적으로 무엇을 만들고 싶으신가요?",
    "누가 사용하거나 볼 예정인가요?",
    "어떤 스타일이나 느낌을 원하시나요?",
    "크기나 해상도 등 요구사항이 있나요?",
    "특별히 중요하게 생각하는 부분이 있나요?"
  ];
  
  // 의도 분석이 있으면 우선순위 기반
  if (analysis && analysis.priorities && analysis.priorities.length > 0) {
    const priorityQuestions = [];
    
    analysis.priorities.slice(0, 5).forEach(({ slot }) => {
      switch(slot) {
        case '목표':
          priorityQuestions.push("구체적으로 무엇을 만들고 싶으신가요?");
          break;
        case '대상':
          priorityQuestions.push("누가 사용하거나 볼 예정인가요?");
          break;
        case '제약':
          priorityQuestions.push("크기, 시간, 예산 등 제약사항이 있나요?");
          break;
        case '스타일':
          priorityQuestions.push("어떤 스타일이나 느낌을 원하시나요?");
          break;
        case '용도':
          priorityQuestions.push("주로 어디에 사용할 예정인가요?");
          break;
        default:
          priorityQuestions.push("특별히 고려해야 할 사항이 있나요?");
      }
    });
    
    // 중복 제거 후 반환
    const uniqueQuestions = [...new Set(priorityQuestions)];
    return uniqueQuestions.slice(0, 4);
  }
  
  // 기본 질문 반환
  return basicQuestions.slice(0, 4);
}

// 폴백 모드: AI 없이도 동작하는 시스템
function handleFallbackMode(step, userInput, answers, res) {
  console.log('폴백 모드 실행:', step);
  
  if (step === 'questions') {
    return handleFallbackQuestions(userInput, res);
  }
  
  if (step === 'final-improve') {
    return handleFallbackImprovement(userInput, answers, res);
  }
  
  return res.status(400).json({ error: '잘못된 step 파라미터' });
}

// 폴백 질문 생성 (AI 실패시에만 사용)
function handleFallbackQuestions(userInput, res) {
  console.log('AI 실패로 폴백 모드 실행');
  
  // 간단한 완성도 분석
  const analysis = analyzeCompleteness(userInput);
  
  if (analysis.completeness > 75) {
    // 충분한 정보가 있으면 질문 없이 바로 개선 단계로
    return res.json({
      questions: [],
      analysis: analysis,
      message: "충분한 정보가 제공되어 추가 질문 없이 개선이 가능합니다.",
      mode: 'fallback_skip'
    });
  }
  
  // 정말 필요한 질문만 최소한으로
  const criticalQuestions = [];
  
  if (!analysis.already_provided.includes('크기')) {
    criticalQuestions.push("크기나 해상도 요구사항이 있나요?");
  }
  
  if (!analysis.already_provided.includes('목적')) {
    criticalQuestions.push("주요 용도나 목적이 무엇인가요?");
  }
  
  if (!analysis.already_provided.includes('대상')) {
    criticalQuestions.push("누가 사용하거나 볼 예정인가요?");
  }
  
  // 최대 3개까지만
  const finalQuestions = criticalQuestions.slice(0, 3);
  
  return res.json({
    questions: finalQuestions,
    analysis: analysis,
    mode: 'fallback_minimal'
  });
}

// 완성도 분석 함수
function analyzeCompleteness(userInput) {
  const input = userInput.toLowerCase();
  const already_provided = [];
  let completeness = 30; // 기본 점수
  
  // 크기 관련
  if (input.match(/(크기|사이즈|해상도|4k|hd|px|cm)/)) {
    already_provided.push('크기');
    completeness += 15;
  }
  
  // 목적 관련
  if (input.match(/(만들|생성|제작|디자인|개발)/)) {
    already_provided.push('목적');
    completeness += 15;
  }
  
  // 대상 관련
  if (input.match(/(사용자|고객|아이|어른|학생)/)) {
    already_provided.push('대상');
    completeness += 15;
  }
  
  // 스타일 관련
  if (input.match(/(스타일|느낌|색상|톤)/)) {
    already_provided.push('스타일');
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

// 폴백 프롬프트 개선
function handleFallbackImprovement(userInput, answers, res) {
  console.log('폴백 프롬프트 개선 시작');
  
  // 템플릿 기반 개선
  const improvements = [];
  let improvedPrompt = userInput;
  
  // 기본 개선 로직
  if (answers && Array.isArray(answers) && answers.length > 0) {
    const additionalInfo = answers
      .filter(a => a && typeof a === 'string' && a.trim())
      .join(', ');
    
    if (additionalInfo) {
      improvedPrompt = `${userInput}\n\n추가 요구사항: ${additionalInfo}`;
      improvements.push('사용자 답변 정보 통합');
    }
  }
  
  // 기본 품질 향상
  if (!improvedPrompt.includes('고품질') && !improvedPrompt.includes('고화질')) {
    improvedPrompt += ', 고품질로 제작';
    improvements.push('품질 요구사항 추가');
  }
  
  // 구체성 추가
  if (!improvedPrompt.match(/\d+/)) {
    if (improvedPrompt.includes('이미지') || improvedPrompt.includes('그림')) {
      improvedPrompt += ', 1920x1080 해상도';
      improvements.push('기본 해상도 추가');
    }
  }
  
  const score = evaluatePrompt(improvedPrompt, userInput);
  const finalScore = typeof score === 'object' ? score.total : score;
  
  return res.json({
    improved_prompt: improvedPrompt,
    score: finalScore,
    improvements: improvements,
    mode: 'fallback'
  });
}
