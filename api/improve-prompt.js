// api/improve-prompt.js - 안정적인 AI 연결 + 오류 해결 시스템
import { evaluatePrompt } from '../utils/evaluationSystem.js';
import { SlotSystem } from '../utils/slotSystem.js';
import { MentionExtractor } from '../utils/mentionExtractor.js';
import { QuestionOptimizer } from '../utils/questionOptimizer.js';

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

    // OpenAI API 키 확인 (여러 환경변수 시도)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 
                          process.env.REACT_APP_OPENAI_API_KEY || 
                          process.env.VITE_OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.log('OpenAI API 키가 없어서 폴백 모드로 실행');
      return handleFallbackMode(step, userInput, answers, res);
    }

    // OpenAI API 호출 함수 (안정적 오류 처리)
    async function callOpenAI(messages, maxRetries = 3) {
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
              max_tokens: 2000,
              timeout: 30000 // 30초 타임아웃
            })
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API 오류 ${response.status}: ${errorData}`);
          }

          const data = await response.json();
          const content = data.choices[0].message.content;
          
          // 한국어 검증
          if (!isKoreanResponse(content)) {
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

    // 한국어 응답 검증 함수
    function isKoreanResponse(text) {
      const englishPattern = /\b(what|how|when|where|why|which|hello|hi|thank|please|yes|no)\b/i;
      if (englishPattern.test(text)) return false;
      
      const koreanRatio = (text.match(/[가-힣]/g) || []).length / text.length;
      return koreanRatio > 0.3; // 30% 이상이 한국어여야 함
    }

    // 1단계: 스마트 질문 생성
    if (step === 'questions') {
      try {
        // 사용자 입력 분석
        const mentionExtractor = new MentionExtractor();
        const mentionedInfo = mentionExtractor.extract(userInput);
        
        const slotSystem = new SlotSystem();
        const detectedDomains = slotSystem.detectDomains(userInput);
        
        console.log('감지된 도메인:', detectedDomains);
        console.log('언급된 정보:', mentionedInfo);

        // OpenAI를 통한 질문 생성
        const questionPrompt = [
          {
            role: 'system',
            content: `${KOREAN_ENFORCER}

당신은 한국어 프롬프트 개선 전문가입니다.
사용자의 요청을 분석해서 더 구체적이고 고품질의 결과물을 만들기 위한 핵심 질문들을 생성해주세요.

도메인 정보: ${JSON.stringify(detectedDomains)}
이미 언급된 정보: ${JSON.stringify(mentionedInfo)}

질문 생성 규칙:
1. 반드시 한국어로만 질문 생성
2. 이미 언급된 정보는 다시 묻지 않기
3. 감지된 도메인에 적합한 전문적 질문
4. 구체적이고 실용적인 질문
5. 정확히 8개의 질문 생성

응답 형식 (JSON):
{
  "questions": [
    "질문 1",
    "질문 2",
    ...
    "질문 8"
  ]
}`
          },
          {
            role: 'user',
            content: `사용자 요청: "${userInput}"\n\n이 요청을 개선하기 위한 핵심 질문 8개를 한국어로 생성해주세요.`
          }
        ];

        const result = await callOpenAI(questionPrompt);
        
        try {
          const parsedResult = JSON.parse(result);
          
          // 질문 최적화
          const optimizer = new QuestionOptimizer();
          const optimizedQuestions = optimizer.optimize(
            parsedResult.questions, 
            mentionedInfo, 
            detectedDomains,
            mode === 'expert' ? 12 : 8
          );
          
          return res.json({
            questions: optimizedQuestions,
            domains: detectedDomains,
            mentioned: mentionedInfo
          });
          
        } catch (parseError) {
          console.log('JSON 파싱 실패, 폴백 질문 사용');
          throw parseError;
        }

      } catch (error) {
        console.log('AI 질문 생성 실패, 폴백 모드 사용:', error.message);
        return handleFallbackQuestions(userInput, res);
      }
    }

    // 2단계: 최종 프롬프트 개선
    if (step === 'final-improve') {
      try {
        const improvePrompt = [
          {
            role: 'system',
            content: `${KOREAN_ENFORCER}

당신은 세계 최고 수준의 프롬프트 엔지니어링 전문가입니다.

목표: 95점 이상의 전문가급 프롬프트를 한국어로 생성

개선 원칙:
1. 반드시 한국어로만 답변
2. 정보밀도 극대화 (구체적 수치, 재질, 위치 포함)
3. 구체적이고 상세한 묘사
4. 전문 용어 적절히 활용
5. 품질/스타일/기술적 요구사항 명시
6. 불필요한 감정 표현 제거
7. 실행 가능한 수준의 구체성

응답 형식 (JSON):
{
  "improved_prompt": "개선된 프롬프트",
  "score": 95,
  "improvements": ["개선 포인트 1", "개선 포인트 2", "개선 포인트 3"]
}`
          },
          {
            role: 'user',
            content: `원본 요청: "${userInput}"

추가 정보:
${answers.map((answer, index) => `${index + 1}. ${answer}`).join('\n')}

이 정보를 바탕으로 95점 이상의 전문가급 프롬프트로 개선해주세요.`
          }
        ];

        const result = await callOpenAI(improvePrompt);
        
        try {
          const parsedResult = JSON.parse(result);
          
          // 개선된 프롬프트 평가
          const score = evaluatePrompt(parsedResult.improved_prompt, userInput);
          
          return res.json({
            improved_prompt: parsedResult.improved_prompt,
            score: score,
            improvements: parsedResult.improvements || [],
            evaluation_details: score // 평가 상세 정보
          });
          
        } catch (parseError) {
          console.log('JSON 파싱 실패, 폴백 개선 사용');
          throw parseError;
        }

      } catch (error) {
        console.log('AI 프롬프트 개선 실패, 폴백 모드 사용:', error.message);
        return handleFallbackImprovement(userInput, answers, res);
      }
    }

    return res.status(400).json({ 
      error: 'step은 questions 또는 final-improve 이어야 합니다' 
    });

  } catch (error) {
    console.error('전체 API 오류:', error);
    return res.status(500).json({ 
      error: '서버 오류가 발생했습니다',
      message: error.message 
    });
  }
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
}

// 폴백 질문 생성
function handleFallbackQuestions(userInput, res) {
  const mentionExtractor = new MentionExtractor();
  const mentionedInfo = mentionExtractor.extract(userInput);
  
  const slotSystem = new SlotSystem();
  const detectedDomains = slotSystem.detectDomains(userInput);
  
  // 도메인별 기본 질문들
  const fallbackQuestions = slotSystem.generateFallbackQuestions(detectedDomains, mentionedInfo);
  
  const optimizer = new QuestionOptimizer();
  const optimizedQuestions = optimizer.optimize(fallbackQuestions, mentionedInfo, detectedDomains, 8);
  
  return res.json({
    questions: optimizedQuestions,
    domains: detectedDomains,
    mentioned: mentionedInfo,
    mode: 'fallback'
  });
}

// 폴백 프롬프트 개선
function handleFallbackImprovement(userInput, answers, res) {
  // 템플릿 기반 개선
  const improvements = [];
  let improvedPrompt = userInput;
  
  // 기본 개선 로직
  if (answers && answers.length > 0) {
    const additionalInfo = answers.filter(a => a && a.trim()).join(', ');
    improvedPrompt = `${userInput}. 추가 요구사항: ${additionalInfo}`;
    improvements.push('사용자 답변 정보 통합');
  }
  
  // 기본 품질 향상
  if (!improvedPrompt.includes('고품질')) {
    improvedPrompt += ', 고품질로 제작';
    improvements.push('품질 요구사항 추가');
  }
  
  const score = evaluatePrompt(improvedPrompt, userInput);
  
  return res.json({
    improved_prompt: improvedPrompt,
    score: score,
    improvements: improvements,
    mode: 'fallback'
  });
}
