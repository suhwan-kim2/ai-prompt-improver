// api/improve-prompt.js - 객관식 질문 + 자동 반복 개선 시스템

// Utils import
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
    const { step, userInput, answers, mode = 'normal', round = 1 } = req.body;
    
    console.log('API 요청:', { step, mode, round, userInput: userInput?.substring(0, 50) + '...' });

    // step 파라미터 검증
    const validSteps = ['questions', 'final-improve', 'additional-questions', 'auto-improve'];
    if (!step || !validSteps.includes(step)) {
      return res.status(400).json({ 
        error: '유효하지 않은 step 파라미터',
        received: step,
        expected: validSteps
      });
    }

    // 사용자 입력 검증
    if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
      return res.status(400).json({ 
        error: '사용자 입력이 필요합니다'
      });
    }

    // OpenAI API 키 확인
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.log('OpenAI API 키가 없어서 폴백 모드로 실행');
      return handleFallbackMode(step, userInput, answers || [], res);
    }

    // 한국어 강제 프롬프트
    const KOREAN_ENFORCER = `반드시 모든 응답을 한국어로만 작성하세요. 영어 사용 절대 금지.`;

    // OpenAI API 호출 함수
    async function callOpenAI(messages, maxRetries = 2) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
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
              max_tokens: 2000,
              timeout: 30000
            })
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`OpenAI API 오류 ${response.status}: ${errorData}`);
          }

          const data = await response.json();
          return data.choices[0].message.content;

        } catch (error) {
          console.log(`OpenAI 시도 ${attempt} 실패:`, error.message);
          
          if (attempt === maxRetries) {
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // ============================================================================
    // 1단계: 객관식 질문 생성 (선택지 포함)
    // ============================================================================
    if (step === 'questions') {
      try {
        console.log('객관식 질문 생성 시작');
        
        // 의도 분석
        let analysis = null;
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

        const questionCount = mode === 'expert' ? 6 : 4;
        
        const questionPrompt = [
          {
            role: 'system',
            content: `${KOREAN_ENFORCER}

당신은 객관식 질문 생성 전문가입니다.

목표: 사용자 의도 파악을 위한 객관식 질문 생성

질문 생성 규칙:
1. 반드시 한국어로만 작성
2. 각 질문마다 4-6개의 구체적인 선택지 제공
3. 마지막 선택지는 항상 "기타"로 설정
4. 선택지는 구체적이고 실용적으로 작성
5. ${questionCount}개의 질문 생성

응답 형식 (반드시 JSON):
{
  "questions": [
    {
      "question": "어떤 스타일로 제작하고 싶으신가요?",
      "options": ["사실적", "3D 애니메이션", "일러스트", "수채화", "만화풍", "기타"]
    },
    {
      "question": "크기나 해상도는 어떻게 설정할까요?",
      "options": ["1920x1080 (FHD)", "3840x2160 (4K)", "1280x720 (HD)", "A4 용지", "정사각형", "기타"]
    }
  ]
}`
          },
          {
            role: 'user',
            content: `사용자 입력: "${userInput}"

${analysis ? `의도 분석 결과:
- 점수: ${analysis.intentScore}점
- 부족한 정보: ${analysis.missingSlots?.join(', ') || '없음'}` : ''}

이 정보를 바탕으로 객관식 질문 ${questionCount}개를 생성해주세요. 각 질문마다 구체적인 선택지 4-6개와 "기타" 옵션을 포함해주세요.`
          }
        ];

        try {
          const result = await callOpenAI(questionPrompt);
          const parsedResult = JSON.parse(result);
          
          // 객관식 질문 검증
          let questions = [];
          if (parsedResult.questions && Array.isArray(parsedResult.questions)) {
            questions = parsedResult.questions
              .filter(q => q.question && Array.isArray(q.options))
              .map(q => ({
                question: q.question.trim(),
                options: q.options.filter(opt => typeof opt === 'string' && opt.trim().length > 0)
              }))
              .filter(q => q.options.length >= 3) // 최소 3개 선택지
              .slice(0, questionCount);
          }
          
          if (questions.length === 0) {
            throw new Error('유효한 객관식 질문이 생성되지 않음');
          }
          
          console.log(`객관식 질문 생성 성공: ${questions.length}개`);
          
          return res.json({
            questions: questions,
            analysis: analysis,
            question_type: 'multiple_choice',
            round: round,
            ai_mode: true
          });
          
        } catch (error) {
          console.log('AI 객관식 질문 생성 실패, 폴백 사용');
          throw error;
        }

      } catch (error) {
        console.log('질문 생성 전체 실패, 폴백 모드');
        return generateFallbackMultipleChoice(userInput, res, mode);
      }
    }

    // ============================================================================
    // 2단계: 추가 질문 생성 (자동 호출용)
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

당신은 부족한 정보 파악 전문가입니다.

목표: 기존 답변을 분석해서 부족한 부분에 대한 객관식 질문 생성

질문 생성 규칙:
1. 반드시 한국어로만 작성
2. 2-3개의 객관식 질문 생성
3. 각 질문마다 4-5개 선택지 + "기타"
4. 기존 답변에서 부족한 정보만 질문

응답 형식 (반드시 JSON):
{
  "questions": [
    {
      "question": "부족한 정보에 대한 질문",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4", "기타"]
    }
  ]
}`
          },
          {
            role: 'user',
            content: `원본 요청: "${userInput}"

기존 답변들:
${existingInfo || '답변 없음'}

기존 답변에서 부족한 부분을 파악해서 2-3개의 추가 객관식 질문을 생성해주세요.`
          }
        ];

        try {
          const result = await callOpenAI(additionalPrompt);
          const parsedResult = JSON.parse(result);
          
          let additionalQuestions = [];
          if (parsedResult.questions && Array.isArray(parsedResult.questions)) {
            additionalQuestions = parsedResult.questions
              .filter(q => q.question && Array.isArray(q.options))
              .slice(0, 3);
          }
          
          if (additionalQuestions.length === 0) {
            throw new Error('추가 질문 생성 실패');
          }
          
          return res.json({
            questions: additionalQuestions,
            question_type: 'multiple_choice',
            mode: 'additional',
            round: round + 1
          });
          
        } catch (error) {
          console.log('AI 추가 질문 생성 실패, 폴백 사용');
          throw error;
        }

      } catch (error) {
        // 폴백 추가 질문
        const fallbackQuestions = [
          {
            question: "더 구체적으로 어떤 부분을 개선하고 싶으신가요?",
            options: ["스타일", "크기", "색상", "품질", "기타"]
          },
          {
            question: "특별한 요구사항이 있나요?",
            options: ["시간 제약", "예산 제약", "기술 제약", "없음", "기타"]
          }
        ];
        
        return res.json({
          questions: fallbackQuestions,
          question_type: 'multiple_choice',
          mode: 'fallback_additional',
          round: round + 1
        });
      }
    }

    // ============================================================================
    // 3단계: 자동 점수 체크 및 반복 개선 시스템
    // ============================================================================
    if (step === 'auto-improve') {
      try {
        console.log('자동 반복 개선 시작, 라운드:', round);
        
        const answersArray = Array.isArray(answers) ? answers : [];
        const answersText = answersArray
          .filter(a => a && typeof a === 'string' && a.trim().length > 0)
          .join('\n');

        // 1차: 프롬프트 개선
        const improvePrompt = [
          {
            role: 'system',
            content: `${KOREAN_ENFORCER}

당신은 95점+ 달성 전문가입니다.

목표: 라운드 ${round}에서 더 높은 점수 달성

95점 달성 필수 요소:
1. 구체적 수치 (1920x1080, 30초, 4K 등)
2. 정확한 기술 사양 (fps, 해상도, 포맷 등)
3. 세부 스타일 지시 (조명, 각도, 색감 등)
4. 명확한 품질 기준 (고화질, 프리미엄 등)
5. 실행 가능한 구체성
6. 감정 표현 완전 제거

개선 전략:
- 모호한 표현 → 구체적 수치
- 일반적 요청 → 전문적 지시사항
- 감정적 묘사 → 기술적 설명

응답 형식 (반드시 JSON):
{
  "improved_prompt": "95점+ 전문가급 프롬프트",
  "confidence": 95,
  "technical_improvements": ["기술적 개선사항들"]
}`
          },
          {
            role: 'user',
            content: `${round === 1 ? '원본' : '이전 라운드'} 요청: "${userInput}"

${answersText ? `누적 정보:
${answersText}` : '추가 정보 없음'}

라운드 ${round}: 더 높은 점수를 위해 전문가급 프롬프트로 개선해주세요.`
          }
        ];

        const aiResult = await callOpenAI(improvePrompt);
        const parsedResult = JSON.parse(aiResult);
        
        if (!parsedResult.improved_prompt) {
          throw new Error('개선된 프롬프트가 없음');
        }
        
        // 2차: 점수 평가
        const evaluationResult = evaluatePrompt(parsedResult.improved_prompt, userInput);
        const finalScore = typeof evaluationResult === 'object' ? evaluationResult.total : evaluationResult;
        
        console.log(`라운드 ${round} 개선 완료, 점수: ${finalScore}`);
        
        // 3차: 점수 체크 및 반복 결정
        const maxRounds = mode === 'expert' ? 3 : 2;
        const targetScore = mode === 'expert' ? 90 : 80;
        
        if (finalScore < targetScore && round < maxRounds) {
          console.log(`점수 ${finalScore} < ${targetScore}, 추가 라운드 필요`);
          
          // 자동으로 추가 질문 생성
          return res.json({
            improved_prompt: parsedResult.improved_prompt,
            score: finalScore,
            improvements: parsedResult.technical_improvements || [],
            evaluation_details: evaluationResult,
            need_more_rounds: true,
            current_round: round,
            max_rounds: maxRounds,
            target_score: targetScore,
            auto_continue: true
          });
        } else {
          console.log(`최종 완성! 점수: ${finalScore} (목표: ${targetScore})`);
          
          // 최종 완성
          return res.json({
            improved_prompt: parsedResult.improved_prompt,
            score: finalScore,
            improvements: parsedResult.technical_improvements || [],
            evaluation_details: evaluationResult,
            final_round: true,
            completed: true
          });
        }
        
      } catch (error) {
        console.log('자동 개선 실패, 폴백 사용');
        return handleFallbackImprovement(userInput, answers || [], res);
      }
    }

    // ============================================================================
    // 4단계: 기존 final-improve (호환성 유지)
    // ============================================================================
    if (step === 'final-improve') {
      // auto-improve로 리다이렉트
      req.body.step = 'auto-improve';
      return handler(req, res);
    }

    // ============================================================================
    // 5단계: 추가 질문 (수동 요청시)
    // ============================================================================
    if (step === 'additional-questions') {
      try {
        console.log('수동 추가 질문 생성');
        
        const answersArray = Array.isArray(answers) ? answers : [];
        const existingInfo = answersArray.join(' ');
        
        const additionalPrompt = [
          {
            role: 'system',
            content: `${KOREAN_ENFORCER}

부족한 정보 파악 후 객관식 질문 생성 전문가입니다.

목표: 더 완벽한 결과를 위한 추가 객관식 질문

응답 형식 (반드시 JSON):
{
  "questions": [
    {
      "question": "추가로 필요한 정보 질문",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4", "기타"]
    }
  ]
}`
          },
          {
            role: 'user',
            content: `원본: "${userInput}"
기존 답변: ${existingInfo}

더 완벽한 결과를 위한 추가 객관식 질문 2개를 생성해주세요.`
          }
        ];

        const result = await callOpenAI(additionalPrompt);
        const parsedResult = JSON.parse(result);
        
        let additionalQuestions = [];
        if (parsedResult.questions && Array.isArray(parsedResult.questions)) {
          additionalQuestions = parsedResult.questions
            .filter(q => q.question && Array.isArray(q.options))
            .slice(0, 2);
        }
        
        if (additionalQuestions.length === 0) {
          throw new Error('추가 질문 생성 실패');
        }
        
        return res.json({
          questions: additionalQuestions,
          question_type: 'multiple_choice',
          mode: 'manual_additional'
        });
        
      } catch (error) {
        console.log('추가 질문 생성 실패, 폴백 사용');
        
        const fallbackQuestions = [
          {
            question: "어떤 부분을 더 구체화하고 싶으신가요?",
            options: ["색상", "크기", "스타일", "품질", "기타"]
          }
        ];
        
        return res.json({
          questions: fallbackQuestions,
          question_type: 'multiple_choice',
          mode: 'fallback_additional'
        });
      }
    }

  } catch (error) {
    console.error('전체 API 오류:', error);
    return res.status(500).json({ 
      error: '서버 내부 오류가 발생했습니다',
      message: error.message
    });
  }
}

// ============================================================================
// 폴백 함수들
// ============================================================================

function handleFallbackMode(step, userInput, answers, res) {
  console.log('폴백 모드:', step);
  
  if (step === 'questions') {
    return generateFallbackMultipleChoice(userInput, res, 'normal');
  }
  
  if (step === 'auto-improve' || step === 'final-improve') {
    return handleFallbackImprovement(userInput, answers, res);
  }
  
  if (step === 'additional-questions') {
    const fallbackQuestions = [
      {
        question: "추가로 고려할 사항이 있나요?",
        options: ["색상", "크기", "품질", "없음", "기타"]
      }
    ];
    
    return res.json({
      questions: fallbackQuestions,
      question_type: 'multiple_choice',
      mode: 'fallback'
    });
  }
  
  return res.status(400).json({ error: '잘못된 폴백 요청' });
}

function generateFallbackMultipleChoice(userInput, res, mode) {
  console.log('폴백 객관식 질문 생성');
  
  // 도메인 감지
  const input = userInput.toLowerCase();
  let domain = 'general';
  
  if (input.match(/(그림|이미지|디자인|포스터)/)) domain = 'visual';
  else if (input.match(/(영상|비디오|동영상)/)) domain = 'video';
  else if (input.match(/(웹|앱|프로그램|코딩)/)) domain = 'development';
  else if (input.match(/(글|텍스트|문서|기사)/)) domain = 'text';
  
  const questionTemplates = {
    visual: [
      {
        question: "어떤 스타일로 제작하고 싶으신가요?",
        options: ["사실적", "3D 애니메이션", "일러스트", "수채화", "만화풍", "기타"]
      },
      {
        question: "크기나 해상도는 어떻게 설정할까요?",
        options: ["1920x1080 (FHD)", "3840x2160 (4K)", "1280x720 (HD)", "A4 용지", "정사각형", "기타"]
      },
      {
        question: "누가 주로 사용하거나 볼 예정인가요?",
        options: ["일반인", "전문가", "학생", "어린이", "비즈니스", "기타"]
      }
    ],
    video: [
      {
        question: "영상 길이는 어느 정도로 생각하고 계신가요?",
        options: ["15초 이하", "30초-1분", "1-3분", "3-5분", "5분 이상", "기타"]
      },
      {
        question: "어떤 용도로 사용할 예정인가요?",
        options: ["SNS 게시", "유튜브", "광고", "교육", "홍보", "기타"]
      }
    ],
    development: [
      {
        question: "어떤 종류의 프로그램을 만들고 싶으신가요?",
        options: ["웹사이트", "모바일 앱", "데스크톱", "API", "게임", "기타"]
      },
      {
        question: "주요 사용자는 누구인가요?",
        options: ["일반 사용자", "관리자", "개발자", "고객", "내부 직원", "기타"]
      }
    ],
    text: [
      {
        question: "어떤 형식의 글을 원하시나요?",
        options: ["기사", "블로그", "보고서", "이메일", "SNS 포스트", "기타"]
      },
      {
        question: "글의 분량은 어느 정도로 생각하고 계신가요?",
        options: ["짧게(500자)", "보통(1000자)", "길게(2000자)", "매우 길게(5000자+)", "기타"]
      }
    ],
    general: [
      {
        question: "구체적으로 무엇을 만들고 싶으신가요?",
        options: ["이미지/그림", "영상/동영상", "웹사이트/앱", "문서/글", "음악/오디오", "기타"]
      },
      {
        question: "누가 주로 사용하거나 볼 예정인가요?",
        options: ["일반인", "전문가", "학생", "어린이", "비즈니스", "기타"]
      },
      {
        question: "어떤 스타일이나 느낌을 원하시나요?",
        options: ["전문적", "친근한", "창의적", "심플한", "화려한", "기타"]
      }
    ]
  };
  
  const questions = questionTemplates[domain] || questionTemplates.general;
  const questionCount = mode === 'expert' ? 4 : 3;
  
  return res.json({
    questions: questions.slice(0, questionCount),
    question_type: 'multiple_choice',
    mode: 'fallback',
    domain: domain
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
      improvedPrompt = `${userInput}\n\n구체적 요구사항:\n${validAnswers.join('\n')}`;
      improvements.push('사용자 답변 상세 반영');
    }
  }
  
  // 고급 개선 로직
  const input = improvedPrompt.toLowerCase();
  
  // 해상도 자동 추가
  if (!input.match(/\d+x\d+|\d+(px|k|p)/i)) {
    if (input.match(/(이미지|그림|사진|포스터|디자인)/)) {
      improvedPrompt += '\n- 해상도: 1920x1080 이상, 고화질';
      improvements.push('고화질 해상도 추가');
    }
  }
  
  // 시간 정보 추가
  if (!input.match(/\d+\s*(초|분)/)) {
    if (input.match(/(영상|비디오|동영상|애니메이션)/)) {
      improvedPrompt += '\n- 길이: 30-60초';
      improvements.push('적절한 길이 설정');
    }
  }
  
  // 품질 기준 강화
  if (!input.match(/(고품질|고화질|4k|hd|프리미엄)/i)) {
    improvedPrompt += '\n- 품질: 프로페셔널급, 고품질 제작';
    improvements.push('품질 기준 강화');
  }
  
  // 구체적 스타일 추가
  if (!input.match(/(스타일|색상|톤|느낌)/)) {
    improvedPrompt += '\n- 스타일: 세련되고 전문적인 디자인';
    improvements.push('구체적 스타일 지정');
  }
  
  // 최종 품질 강화
  improvedPrompt += '\n\n[최종 지시사항]\n- 모든 요소를 프로페셔널한 수준으로 제작\n- 세부사항까지 완벽하게 구현\n- 고품질 결과물 보장';
  improvements.push('최종 품질 보장 조항 추가');
  
  // 평가
  const evaluationResult = evaluatePrompt(improvedPrompt, userInput);
  const finalScore = typeof evaluationResult === 'object' ? evaluationResult.total : evaluationResult;
  
  console.log('폴백 개선 완료, 점수:', finalScore);
  
  return res.json({
    improved_prompt: improvedPrompt,
    score: finalScore,
    improvements: improvements,
    evaluation_details: evaluationResult,
    mode: 'fallback',
    completed: true
  });
}
