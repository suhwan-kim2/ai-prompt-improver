// api/improve-prompt.js - 수정된 버전

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
            step,
            userInput, 
            questions, 
            answers, 
            isExpertMode,
            internalImprovedPrompt,
            currentScore
        } = req.body;
        
        console.log('=== API 요청 ===');
        console.log('Step:', step);
        console.log('원본 입력:', userInput);
        console.log('전문가모드:', isExpertMode);
        
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        
        if (!OPENAI_API_KEY) {
            throw new Error('OpenAI API 키가 설정되지 않았습니다.');
        }
        
        let systemPrompt = '';
        let userPrompt = '';
        
        // 단계별 프롬프트 설정
        switch (step) {
            case 'questions':
                systemPrompt = getBasicQuestionsPrompt(isExpertMode);
                userPrompt = `원본 사용자 입력: "${userInput}"

위 입력을 분석해서 해당 분야에 맞는 기본 질문을 생성해주세요.`;
                break;
                
            case 'internal-improve-1':
                systemPrompt = getInternalImprovePrompt(1);
                userPrompt = buildInternalImprovementPrompt(userInput, questions, answers, 1);
                break;
                
            case 'questions-round-1':
                systemPrompt = getExpertQuestionsPrompt(1);
                userPrompt = buildExpertQuestionPrompt(userInput, internalImprovedPrompt, 1);
                break;
                
            case 'internal-improve-2':
                systemPrompt = getInternalImprovePrompt(2);
                userPrompt = buildInternalImprovementPrompt(userInput, questions, answers, 2, internalImprovedPrompt);
                break;
                
            case 'questions-round-2':
                systemPrompt = getExpertQuestionsPrompt(2);
                userPrompt = buildExpertQuestionPrompt(userInput, internalImprovedPrompt, 2);
                break;
                
            case 'final-improve':
                systemPrompt = getFinalImprovementPrompt(isExpertMode);
                userPrompt = buildFinalImprovementPrompt(userInput, questions, answers, isExpertMode, internalImprovedPrompt);
                break;
                
            case 'evaluate':
                systemPrompt = getEvaluationPrompt();
                userPrompt = `평가할 프롬프트: "${userInput}"`;
                break;
                
            case 'auto-improve':
                systemPrompt = getAutoImprovementPrompt();
                userPrompt = `현재 프롬프트: "${userInput}"\n현재 점수: ${currentScore}점\n\n90점 이상으로 개선해주세요.`;
                break;
                
            default:
                throw new Error(`지원하지 않는 단계: ${step}`);
        }
        
        console.log('=== OpenAI 요청 ===');
        console.log('System:', systemPrompt.substring(0, 100) + '...');
        console.log('User:', userPrompt.substring(0, 100) + '...');
        
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
                temperature: step.includes('questions') ? 0.3 : 0.7,
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

        console.log('=== API 응답 성공 ===');
        console.log('결과 길이:', result.length);
        
        res.json({ 
            success: true, 
            result: result,
            usage: data.usage 
        });

    } catch (error) {
        console.error('=== 서버 오류 ===', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || '서버 내부 오류가 발생했습니다.' 
        });
    }
}

// ======================
// 프롬프트 생성 함수들
// ======================

function getBasicQuestionsPrompt(isExpertMode) {
    return `당신은 프롬프트 개선 전문가입니다. 사용자의 입력을 분석해서 해당 분야에 맞는 기본 질문을 생성해주세요.

현재 모드: ${isExpertMode ? '전문가모드' : '일반모드'}

** 중요: 원본 입력의 내용과 분야를 절대 바꾸지 마세요 **

분야별 질문 예시:
- 이미지 생성: 스타일, 색감, 구도, 분위기
- 웹사이트 제작: 목적, 타겟, 기능, 디자인  
- 글쓰기: 톤앤매너, 독자, 길이, 형식
- 데이터 분석: 목적, 변수, 시각화, 인사이트

${isExpertMode ? '전문가모드에서는 1-3개의 핵심 질문만 생성하세요.' : '일반모드에서는 1-6개의 질문을 동적으로 생성하세요.'}

반드시 JSON 형식으로 응답하세요:
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

function getInternalImprovePrompt(round) {
    return `당신은 프롬프트 개선 전문가입니다. 

${round}차 내부 개선을 진행합니다. 사용자의 원본 입력과 기본 답변을 바탕으로 프롬프트를 개선하되, 이는 내부 처리용이므로 사용자에게 보여지지 않습니다.

** 절대 중요: 원본 입력의 주제와 분야를 유지하세요 **

개선된 프롬프트만 응답하세요.`;
}

function getExpertQuestionsPrompt(round) {
    return `당신은 프롬프트 개선 전문가입니다. ${round}차 심층 질문을 생성합니다.

${round === 1 ? 
`1차 심층 질문 목적:
- 기본 질문에서 파악하지 못한 숨겨진 의도 발굴
- 사용자의 진짜 목적과 배경 이해
- 더 구체적인 요구사항 파악` :
`2차 심층 질문 목적:
- 실행과 구현 관점에서의 세부사항
- 품질과 완성도를 높이는 마지막 요소들
- 사용자의 최종 기대사항 확인`}

** 중요: 이전 질문들과 절대 중복되지 않는 새로운 관점의 질문을 만드세요 **

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "이전과 완전히 다른 새로운 관점의 질문",
      "type": "choice",
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}`;
}

function getFinalImprovementPrompt(isExpertMode) {
    return `당신은 프롬프트 개선 전문가입니다. 

모든 정보를 종합하여 최종 ${isExpertMode ? '전문가급' : '고품질'} 프롬프트를 생성해주세요.

** 중요: 원본 입력의 주제와 분야를 절대 바꾸지 마세요 **

최종 개선된 프롬프트만 응답하세요.`;
}

function getEvaluationPrompt() {
    return `당신은 프롬프트 품질 평가 전문가입니다. 주어진 프롬프트를 100점 만점으로 평가해주세요.

평가 기준:
- 명확성 (25점): 요구사항이 구체적이고 명확한가
- 완성도 (25점): 필요한 정보가 충분히 포함되어 있는가  
- 실행가능성 (25점): AI가 실제로 수행할 수 있는 내용인가
- 창의성 (25점): 독창적이고 흥미로운 요소가 있는가

JSON 형식으로 응답:
{
  "score": 점수,
  "strengths": ["강점1", "강점2"],
  "improvements": ["개선점1", "개선점2"],
  "recommendation": "종합 의견"
}`;
}

function getAutoImprovementPrompt() {
    return `당신은 프롬프트 개선 전문가입니다. 주어진 프롬프트를 90점 이상 수준으로 자동 개선해주세요.

개선 방향:
- 더 구체적인 요구사항 추가
- 명확한 출력 형식 지정
- 품질 향상을 위한 세부 조건 추가

개선된 프롬프트만 응답하세요.`;
}

// ======================
// 프롬프트 구성 함수들  
// ======================

function buildInternalImprovementPrompt(userInput, questions, answers, round, previousImproved = '') {
    let prompt = `원본 사용자 입력: "${userInput}"\n\n`;
    
    if (previousImproved) {
        prompt += `이전 개선된 프롬프트: "${previousImproved}"\n\n`;
    }
    
    if (answers) {
        prompt += `사용자 답변들:\n${formatAnswersForPrompt(answers)}\n\n`;
    }
    
    prompt += `${round}차 내부 개선을 진행해주세요. 원본 입력의 주제와 분야를 유지하면서 답변 정보를 반영해주세요.`;
    
    return prompt;
}

function buildExpertQuestionPrompt(userInput, internalImprovedPrompt, round) {
    let prompt = `원본 사용자 입력: "${userInput}"\n\n`;
    
    if (internalImprovedPrompt) {
        prompt += `현재 개선된 상태: "${internalImprovedPrompt}"\n\n`;
    }
    
    prompt += `${round}차 심층 질문을 생성해주세요. 이전 질문들과 중복되지 않는 새로운 관점에서 질문해주세요.`;
    
    return prompt;
}

function buildFinalImprovementPrompt(userInput, questions, answers, isExpertMode, internalImprovedPrompt = '') {
    let prompt = `원본 사용자 입력: "${userInput}"\n\n`;
    
    if (internalImprovedPrompt) {
        prompt += `내부 개선된 프롬프트: "${internalImprovedPrompt}"\n\n`;
    }
    
    if (answers) {
        prompt += `모든 사용자 답변들:\n${formatAnswersForPrompt(answers)}\n\n`;
    }
    
    prompt += `위 모든 정보를 종합하여 ${isExpertMode ? '전문가급' : '고품질'}의 최종 프롬프트를 생성해주세요.`;
    
    return prompt;
}

function formatAnswersForPrompt(answers) {
    if (typeof answers === 'string') {
        return answers;
    }
    
    if (typeof answers === 'object') {
        return Object.entries(answers)
            .map(([index, answerData]) => {
                if (typeof answerData === 'object' && answerData.answers) {
                    const answerText = Array.isArray(answerData.answers) ? answerData.answers.join(', ') : answerData.answers;
                    const requestText = answerData.request ? `\n요청사항: ${answerData.request}` : '';
                    return `답변 ${parseInt(index) + 1}: ${answerText}${requestText}`;
                } else {
                    const answerText = Array.isArray(answerData) ? answerData.join(', ') : answerData;
                    return `답변 ${parseInt(index) + 1}: ${answerText}`;
                }
            })
            .join('\n\n');
    }
    
    return String(answers);
}
