// api/improve-prompt.js - 이 파일만 GitHub에 추가하세요!

export default async function handler(req, res) {
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { 
            userInput, 
            questions, 
            answers, 
            step, 
            isExpertMode, 
            round, 
            previousAnswers,
            previousQuestions,
            currentImproved,
            additionalAnswers,
            currentScore,
            rounds
        } = req.body;
        
        console.log('API 요청:', { step, isExpertMode, round });
        
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        
        if (!OPENAI_API_KEY) {
            throw new Error('OpenAI API 키가 설정되지 않았습니다.');
        }
        
        let systemPrompt = '';
        let userPrompt = '';
        
        if (step === 'questions') {
            systemPrompt = getAdaptiveQuestionPrompt(isExpertMode, round);
            userPrompt = `사용자 입력: "${userInput}"`;
            
            if (round > 0 && previousAnswers) {
                userPrompt += `\n\n이전 답변들:\n${previousAnswers}`;
            }
            
            if (previousQuestions && previousQuestions.trim()) {
                userPrompt += `\n\n이전에 이미 물어본 질문들 (절대 중복 금지):\n${previousQuestions}`;
                userPrompt += `\n\n** 엄격한 중복 금지 규칙 **`;
                userPrompt += `\n- 위 질문들과 키워드나 주제가 겹치면 절대 안됨`;
                userPrompt += `\n- 완전히 새로운 관점에서만 질문 생성`;
                
                if (isExpertMode && round === 1) {
                    userPrompt += `\n\n1차 심층질문 가이드: 기본질문이 "무엇"을 물었다면 → "왜"를 물어보기`;
                } else if (isExpertMode && round === 2) {
                    userPrompt += `\n\n2차 심층질문 가이드: 실행/제작/성과 측정 관점에서 질문`;
                }
            }
        } else if (step === 'additional-questions') {
            systemPrompt = getAdditionalQuestionPrompt();
            userPrompt = `원본 입력: "${userInput}"\n현재 개선된 프롬프트: "${currentImproved}"\n기존 답변들: "${additionalAnswers || answers}"\n\n현재 답변을 바탕으로 점수를 더 높일 수 있는 추가 질문 2-3개를 생성해주세요.`;
        } else if (step === 'improve') {
            systemPrompt = getAdaptiveImprovementPrompt(isExpertMode, rounds);
            userPrompt = buildImprovementPrompt(userInput, questions, answers, isExpertMode, rounds);
        } else if (step === 'improve-with-additional') {
            systemPrompt = getAdditionalImprovementPrompt();
            userPrompt = `원본 입력: "${userInput}"\n현재 개선된 프롬프트: "${currentImproved}"\n추가 답변들: "${additionalAnswers}"\n\n추가 답변을 바탕으로 현재 프롬프트를 더욱 정밀하게 개선해주세요.`;
        } else if (step === 'evaluate') {
            systemPrompt = getEvaluationPrompt90();
            userPrompt = `평가할 프롬프트: "${userInput}"`;
        } else if (step === 'auto-improve') {
            systemPrompt = getAutoImprovementPrompt90();
            userPrompt = `현재 프롬프트: "${userInput}"\n현재 점수: ${currentScore}점\n\n이 프롬프트를 90점 이상으로 자동 개선해주세요.`;
        }
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: step === 'questions' || step === 'additional-questions' ? 0.3 : 0.7,
                max_tokens: 2500
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('OpenAI API 오류:', response.status, errorData);
            throw new Error(`OpenAI API 오류: ${response.status}`);
        }

        const data = await response.json();
        const result = data.choices[0].message.content;

        console.log('API 응답 성공');
        res.json({ 
            success: true, 
            result: result,
            usage: data.usage 
        });

    } catch (error) {
        console.error('서버 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || '서버 내부 오류가 발생했습니다.' 
        });
    }
}

// 프롬프트 생성 함수들
function getAdaptiveQuestionPrompt(isExpertMode, round) {
    const basePrompt = `당신은 프롬프트 개선 전문가입니다. 사용자의 입력을 분석해서 분야를 자동으로 판단하고, 해당 분야에 최적화된 질문을 만들어주세요.

현재 모드: ${isExpertMode ? '전문가모드' : '일반모드'}
현재 라운드: ${round + 1}차`;

    if (isExpertMode) {
        if (round === 0) {
            return basePrompt + `

전문가모드 1차 질문 (기본 정보 파악):
- 1-3개의 핵심 질문으로 기본 정보 파악
- 프로젝트의 목적과 배경 이해
- 타겟 대상과 사용 맥락 파악

JSON 형식으로 응답:
{
  "detectedCategory": "판단된 분야",
  "questions": [
    {
      "question": "질문 내용",
      "type": "choice",
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}`;
        } else if (round === 1) {
            return basePrompt + `

전문가모드 2차 질문 (심층 의도 파악):
- 이전 답변을 바탕으로 더 깊은 의도 파악
- 숨겨진 요구사항과 세부 조건 발굴
- 창작자의 진짜 목적과 비전 이해

** 중요: 이전 질문과 절대 중복되지 않는 새로운 관점의 질문을 만드세요 **

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "이전과 다른 새로운 관점의 심층 질문",
      "type": "choice", 
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}`;
        } else {
            return basePrompt + `

전문가모드 3차 질문 (최종 세부사항):
- 이전 2차례 답변을 종합하여 마지막 핵심 질문
- 완성도를 높이기 위한 세밀한 디테일 파악

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "최종 완성도를 위한 핵심 질문",
      "type": "choice",
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}`;
        }
    } else {
        return basePrompt + `

일반모드 질문 생성:
- 사용자 입력의 복잡도에 따라 1-6개 질문 동적 생성
- 빠른 개선을 위한 효율적 질문

JSON 형식으로 응답:
{
  "detectedCategory": "판단된 분야",
  "questions": [
    {
      "question": "질문 내용",
      "type": "choice",
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}`;
    }
}

function getAdditionalQuestionPrompt() {
    return `당신은 프롬프트 개선 전문가입니다. 현재 개선된 프롬프트의 점수를 더 높이기 위한 추가 질문을 생성해주세요.

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "추가 질문 내용",
      "type": "choice",
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}`;
}

function getAdaptiveImprovementPrompt(isExpertMode, rounds) {
    return `당신은 모든 분야의 최고 전문가이자 프롬프트 엔지니어링 마스터입니다.

현재 모드: ${isExpertMode ? '전문가모드' : '일반모드'}
질문 라운드 수: ${rounds || 1}회차

최종 프롬프트만 제공하고, 설명은 생략하세요.`;
}

function getAdditionalImprovementPrompt() {
    return `당신은 프롬프트 개선 전문가입니다. 추가 질문에 대한 답변을 바탕으로 현재 프롬프트를 더욱 정밀하게 개선해주세요.

개선된 프롬프트만 제공하고, 설명은 생략하세요.`;
}

function getEvaluationPrompt90() {
    return `당신은 프롬프트 품질 평가 전문가입니다. 주어진 프롬프트를 100점 만점으로 평가해주세요.

JSON 응답:
{
  "score": 점수(1-100),
  "strengths": ["강점1", "강점2"],
  "improvements": ["개선점1", "개선점2"]
}`;
}

function getAutoImprovementPrompt90() {
    return `당신은 프롬프트 개선 전문가입니다. 주어진 프롬프트를 90점 이상 수준으로 자동 개선해주세요.

개선된 프롬프트만 응답하세요.`;
}

function buildImprovementPrompt(userInput, questions, answers, isExpertMode, rounds) {
    let prompt = `원본 프롬프트: "${userInput}"\n\n`;
    
    if (questions && answers) {
        prompt += `사용자 ${isExpertMode ? '전문가모드' : '일반모드'} 답변 정보 (${rounds || 1}회차):\n`;
        
        if (typeof answers === 'string') {
            prompt += answers;
        } else {
            Object.entries(answers).forEach(([index, answerData]) => {
                const question = questions[parseInt(index)] ? questions[parseInt(index)].question : `질문 ${parseInt(index) + 1}`;
                
                if (typeof answerData === 'object' && answerData.answers) {
                    const answerText = Array.isArray(answerData.answers) ? answerData.answers.join(', ') : answerData.answers;
                    const requestText = answerData.request ? `\n요청사항: ${answerData.request}` : '';
                    prompt += `Q: ${question}\nA: ${answerText}${requestText}\n\n`;
                } else {
                    const answerText = Array.isArray(answerData) ? answerData.join(', ') : answerData;
                    prompt += `Q: ${question}\nA: ${answerText}\n\n`;
                }
            });
        }
    }
    
    prompt += `위 정보를 바탕으로 원본 프롬프트를 ${isExpertMode ? '전문가급으로' : '효율적으로'} 개선해주세요.

개선된 프롬프트만 응답해주세요:`;
    
    return prompt;
}
