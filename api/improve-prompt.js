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
}

// 간단한 완성도 분석 함수 (AI 없이)
function analyzeCompleteness(userInput) {
  const input = userInput.toLowerCase();
  let completeness = 0;
  let missingInfo = [];
  let providedInfo = [];
  
  // 기본 요소들 체크
  const elements = {
    '주제': /(그림|이미지|영상|글|웹사이트|앱)/,
    '스타일': /(실사|애니메이션|3d|일러스트|사실적)/,
    '크기': /(\d+\s*(초|분|px|cm)|크기|해상도)/,
    '색상': /(빨간|파란|노란|밝은|어두운|색상|컬러)/,
    '목적': /(광고|교육|홍보|설명|용도)/,
    '대상': /(아이|어른|학생|고객|사용자)/
  };
  
  Object.entries(elements).forEach(([key, pattern]) => {
    if (input.match(pattern)) {
      completeness += 15;
      providedInfo.push(key);
    } else {
      missingInfo.push(key);
    }
  });
  
  // 세부 정보 보너스
  if (input.match(/\d+/)) completeness += 10; // 수치 포함
  if (input.length > 50) completeness += 10; // 상세한 설명
  
  return {
    completeness: Math.min(100, completeness),
    missing_info: missingInfo,
    already_provided: providedInfo
  };
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

        // OpenAI를 통한 진짜 AI 질문 생성
        const questionPrompt = [
          {
            role: 'system',
            content: `${KOREAN_ENFORCER}

당신은 프롬프트 분석 전문가입니다. 사용자의 요청을 분석해서 고품질 결과물을 위해 **정말 필요한 정보만** 질문하세요.

핵심 원칙:
1. 이미 충분한 정보가 있으면 질문하지 마세요 (0개도 가능)
2. 부족한 정보가 많으면 많이 질문하세요 (15개도 가능)  
3. 절대 하드코딩된 질문 사용 금지
4. 사용자가 이미 말한 내용은 다시 묻지 마세요
5. 반드시 한국어로만 질문

정보 완성도 평가 기준:
- 90% 이상 완성: 질문 0-2개
- 70-90% 완성: 질문 3-5개  
- 50-70% 완성: 질문 6-8개
- 50% 미만 완성: 질문 9개 이상

응답 형식 (JSON):
{
  "analysis": {
    "completeness": 85,
    "missing_info": ["해상도", "카메라앵글"], 
    "already_provided": ["길이", "스타일", "주제", "음악"]
  },
  "questions": [
    "정말 필요한 질문만"
  ]
}`
          },
          {
            role: 'user',
            content: `사용자 요청 분석해주세요:

"${userInput}"

위 요청의 완성도를 평가하고, 95점 결과물을 위해 정말 필요한 정보만 질문해주세요.
이미 제공된 정보는 다시 묻지 마세요.`
          }
        ];

        const result = await callOpenAI(questionPrompt);
        
        try {
          const parsedResult = JSON.parse(result);
          
          console.log('AI 분석 결과:', parsedResult.analysis);
          console.log('생성된 질문들:', parsedResult.questions);
          
          // AI가 분석한 완성도에 따라 질문 개수 결정
          const questions = parsedResult.questions || [];
          
          if (questions.length === 0) {
            console.log('AI 판단: 추가 질문 불필요');
          }
          
          return res.json({
            questions: questions,
            analysis: parsedResult.analysis,
            domains: detectedDomains,
            mentioned: mentionedInfo,
            ai_mode: true
          });
          
        } catch (parseError) {
          console.log('JSON 파싱 실패, 간단한 분석으로 대체');
          
          // AI가 실패하면 간단한 로직으로 판단
          const simpleAnalysis = this.analyzeCompleteness(userInput);
          
          if (simpleAnalysis.completeness > 80) {
            // 80% 이상 완성도면 질문 최소화
            return res.json({
              questions: [],
              analysis: simpleAnalysis,
              message: "충분한 정보가 제공되어 바로 개선 가능합니다."
            });
          } else {
            // 부족하면 폴백 질문 사용
            throw parseError;
          }
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
