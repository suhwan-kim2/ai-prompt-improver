// api/improve-prompt.js - 안정적인 AI 연결 + 오류 해결 시스템
import { evaluatePrompt } from '../utils/evaluationSystem.js';
import { SlotSystem } from '../utils/slotSystem.js';
import { MentionExtractor } from '../utils/mentionExtractor.js';
import { QuestionOptimizer } from '../utils/questionOptimizer.js';
import { IntentAnalyzer } from '../utils/intentAnalyzer.js';

export default async function handler(req, res) {
  // CORS 설정 (브라우저 접근 허용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
}

// 의도 분석 기반 폴백 질문 생성
function generateFallbackQuestions(analysis) {
  const questions = [];
  
  // 우선순위 기반으로 질문 생성
  analysis.priorities.forEach(({ slot, priority }) => {
    switch(slot) {
      case '목표':
        questions.push("구체적으로 무엇을 만들고 싶으신가요?");
        break;
      case '대상':
        questions.push("누가 사용하거나 볼 예정인가요?");
        break;
      case '제약':
        questions.push("크기, 시간, 예산 등 제약사항이 있나요?");
        break;
      case '스타일':
        questions.push("어떤 스타일이나 느낌을 원하시나요?");
        break;
      case '용도':
        questions.push("주로 어디에 사용할 예정인가요?");
        break;
      case '도구':
        questions.push("특별히 사용하고 싶은 도구나 기술이 있나요?");
        break;
      case '톤':
        questions.push("전문적인지 친근한지, 어떤 톤을 원하시나요?");
        break;
    }
  });
  
  // 전략에 맞는 개수만 반환
  const targetCount = typeof analysis.strategy.questionCount === 'string' 
    ? parseInt(analysis.strategy.questionCount.split('-')[1]) || 6
    : analysis.strategy.questionCount;
    
  return questions.slice(0, targetCount);
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

    // 한국어 응답 검증 함수 (완화된 버전)
    function isKoreanResponse(text) {
      // 너무 엄격한 영어 체크를 완화
      const problematicEnglish = /\b(hello|hi|thank you|please|sorry|goodbye)\b/i;
      if (problematicEnglish.test(text)) return false;
      
      const koreanRatio = (text.match(/[가-힣]/g) || []).length / text.length;
      return koreanRatio > 0.2; // 20%로 완화 (JSON 등 고려)
    }

    // 1단계: 의도 분석 기반 스마트 질문 생성
    if (step === 'questions') {
      try {
        // 의도 분석 먼저 실행
        const intentAnalyzer = new IntentAnalyzer();
        const analysis = intentAnalyzer.generateAnalysisReport(userInput, answers || []);
        
        console.log('의도 분석 결과:', analysis);
        
        // 충분한 의도 파악이면 질문 생략
        if (!analysis.strategy.needMore) {
          return res.json({
            questions: [],
            analysis: analysis,
            message: analysis.strategy.message,
            skipToImprovement: true
          });
        }

        // 사용자 입력 분석 (기존 로직도 유지)
        const mentionExtractor = new MentionExtractor();
        const mentionedInfo = mentionExtractor.extract(userInput);
        
        const slotSystem = new SlotSystem();
        const detectedDomains = slotSystem.detectDomains(userInput);
        
        console.log('감지된 도메인:', detectedDomains);
        console.log('언급된 정보:', mentionedInfo);

        // AI를 통한 의도 기반 질문 생성
        const questionPrompt = [
          {
            role: 'system',
            content: `${KOREAN_ENFORCER}

당신은 사용자 의도 파악 전문가입니다.

현재 의도 분석 결과:
- 의도 점수: ${analysis.intentScore}/100
- 부족한 슬롯: ${analysis.priorities.map(p => p.slot).join(', ')}
- 전략: ${analysis.strategy.focus}

목표: ${analysis.strategy.message}

부족한 정보를 채우기 위한 질문을 ${analysis.strategy.questionCount}개 생성해주세요.

우선순위:
${analysis.priorities.map((p, i) => `${i+1}. ${p.slot} (중요도: ${p.priority})`).join('\n')}

질문 생성 규칙:
1. 반드시 한국어로만 질문
2. 우선순위가 높은 슬롯부터 질문  
3. 이미 파악된 정보는 절대 다시 묻지 않기
4. 구체적이고 답변하기 쉬운 질문
5. 사용자 의도를 정확히 파악하는 데 집중

응답 형식 (JSON):
{
  "questions": [
    "우선순위 높은 질문부터 순서대로"
  ],
  "reasoning": "이 질문들이 필요한 이유"
}`
          },
          {
            role: 'user',
            content: `사용자 입력: "${userInput}"

의도 분석:
- 점수: ${analysis.intentScore}점
- 부족한 정보: ${analysis.missingSlots?.join(', ') || '없음'}
- 추천사항: ${analysis.recommendations?.join(', ') || '없음'}

이 분석을 바탕으로 사용자 의도를 완벽히 파악하기 위한 질문을 생성해주세요.`
          }
        ];

        const result = await callOpenAI(questionPrompt);
        
        try {
          const parsedResult = JSON.parse(result);
          
          console.log('AI 질문 생성 결과:', parsedResult);
          
          // AI가 생성한 질문들
          const questions = parsedResult.questions || [];
          
          return res.json({
            questions: questions,
            analysis: analysis,
            reasoning: parsedResult.reasoning,
            domains: detectedDomains,
            mentioned: mentionedInfo,
            ai_mode: true
          });
          
        } catch (parseError) {
          console.log('AI 질문 생성 실패, 의도 분석 기반 폴백 사용');
          
          // AI 실패시 의도 분석 결과로 폴백 질문 생성
          const fallbackQuestions = this.generateFallbackQuestions(analysis);
          
          return res.json({
            questions: fallbackQuestions,
            analysis: analysis,
            mode: 'fallback_intent'
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
        const improvePrompt = [
          {
            role: 'system',
            content: `${KOREAN_ENFORCER}

당신은 세계 최고 수준의 프롬프트 엔지니어링 전문가입니다.

목표: 95점 이상의 전문가급 영상 제작 프롬프트를 한국어로 생성

95점 달성 기준:
1. 구체적 기술 사양 (해상도, fps, 코덱 등)
2. 정확한 수치 정보 (시간, 크기, 비율 등)  
3. 카메라 워크 세부사항 (앵글, 무빙, 초점 등)
4. 조명/색보정 구체적 지시
5. 편집 스타일 명확한 정의
6. 오디오 기술 사양 포함
7. 불필요한 감정 표현 제거
8. 실행 가능한 구체성

개선 원칙:
- "감동적이고 따뜻한" → 삭제 (감정 표현 불필요)
- "30초 이하" → "정확히 25-30초"
- "큰 리트리버" → "골든 리트리버 (체고 60cm)"
- "밝고 화사한" → "색온도 5600K, 채도 +20%"
- "감정적인 음악" → "오케스트라 배경음악, -23 LUFS"

응답 형식 (JSON):
{
  "improved_prompt": "기술적으로 구체적인 95점 프롬프트",
  "score": 95,
  "improvements": ["개선사항1", "개선사항2", "개선사항3"]
}`
          },
          {
            role: 'user',
            content: `원본 요청: "${userInput}"

사용자 추가 정보:
${answers.map((answer, index) => `${index + 1}. ${answer}`).join('\n')}

위 정보를 바탕으로 95점 이상의 전문가급 영상 제작 프롬프트로 개선해주세요. 
구체적인 기술 사양과 수치를 포함하고, 불필요한 감정 표현은 제거해주세요.`
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
