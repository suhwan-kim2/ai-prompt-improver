// api/improve-prompt.js - 완전 수정 버전 (Hello 응답 차단 + 점수 시스템 개선)

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
                userPrompt = `분석할 사용자 입력: "${userInput}"

위 입력을 분석해서 해당 분야에 맞는 기본 질문을 생성하세요.`;
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
        
        // 🚀 최대 3번 재시도로 좋은 응답 확보
        let result = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts && !result) {
            attempts++;
            console.log(`시도 ${attempts}/${maxAttempts}`);
            
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
                    temperature: step.includes('questions') ? 0.2 : 0.7,
                    max_tokens: 2500
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('OpenAI API 오류:', response.status, errorData);
                throw new Error(`OpenAI API 오류: ${response.status}`);
            }

            const data = await response.json();
            const rawResult = data.choices[0].message.content;
            
            console.log(`시도 ${attempts} 결과:`, rawResult.substring(0, 100));
            
            // 🔥 응답 품질 검증
            if (isValidResponse(rawResult, step, userInput)) {
                result = rawResult;
                console.log('✅ 좋은 응답 확보!');
            } else {
                console.log('❌ 불량 응답, 재시도...');
                
                // 재시도를 위해 시스템 프롬프트 강화
                systemPrompt = enhanceSystemPrompt(systemPrompt, attempts);
            }
        }
        
        // 최종적으로 좋은 응답을 얻지 못한 경우 기본 처리
        if (!result) {
            console.log('⚠️ 최대 재시도 실패, 기본 응답 사용');
            result = generateFallbackResponse(step, userInput);
        }

        console.log('=== 최종 응답 성공 ===');
        console.log('결과 길이:', result.length);
        
        res.json({ 
            success: true, 
            result: result,
            attempts: attempts
        });

    } catch (error) {
        console.error('=== 서버 오류 ===', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || '서버 내부 오류가 발생했습니다.' 
        });
    }
}

// 🔥 응답 품질 검증 함수
function isValidResponse(response, step, originalInput) {
    const invalidResponses = [
        'hello! how can i assist you today?',
        'how can i help you',
        'what can i do for you',
        'how may i assist you',
        'i am an ai assistant',
        'i\'m here to help',
        '안녕하세요',
        '도움이 필요하시면',
        '무엇을 도와드릴까요'
    ];
    
    const lowerResponse = response.toLowerCase().trim();
    
    // 불량 응답 체크
    for (const invalid of invalidResponses) {
        if (lowerResponse.includes(invalid)) {
            console.log('❌ 불량 응답 감지:', invalid);
            return false;
        }
    }
    
    // 너무 짧은 응답 체크
    if (response.trim().length < 20) {
        console.log('❌ 너무 짧은 응답:', response.length);
        return false;
    }
    
    // 프롬프트 개선 단계에서 원본 입력 관련성 체크
    if (step === 'final-improve' || step === 'auto-improve') {
        const originalKeywords = extractKeywords(originalInput);
        const responseKeywords = extractKeywords(response);
        
        const hasRelevance = originalKeywords.some(keyword => 
            responseKeywords.some(respKeyword => 
                respKeyword.includes(keyword) || keyword.includes(respKeyword)
            )
        );
        
        if (!hasRelevance && originalInput.length > 10) {
            console.log('❌ 원본 입력과 관련성 없음');
            return false;
        }
    }
    
    return true;
}

// 키워드 추출 함수
function extractKeywords(text) {
    const stopWords = ['을', '를', '이', '가', '은', '는', '의', '에', '과', '와', '으로', '로', '에서', '만들어', '만들'];
    return text.toLowerCase()
        .replace(/[^\w\s가-힣]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1 && !stopWords.includes(word));
}

// 시스템 프롬프트 강화 함수
function enhanceSystemPrompt(originalPrompt, attempt) {
    const strongerInstructions = `

!!! CRITICAL INSTRUCTIONS FOR ATTEMPT ${attempt} !!!
- NEVER respond with generic greetings like "Hello! How can I assist you today?"
- NEVER provide general help messages
- You MUST follow the user's specific request
- Focus ONLY on the task described in the user input
- Maintain the exact topic and domain from the original input
- NO explanations, NO greetings, NO generic responses

REMEMBER: Your response will be evaluated. Generic responses = FAILURE.
`;
    
    return originalPrompt + strongerInstructions;
}

// 대체 응답 생성 함수
function generateFallbackResponse(step, userInput) {
    switch (step) {
        case 'questions':
            return `{
  "detectedCategory": "사용자 요청",
  "questions": [
    {
      "question": "어떤 스타일이나 형태를 원하시나요?",
      "type": "choice",
      "options": ["현실적", "만화적", "예술적", "기타"]
    }
  ]
}`;
        case 'final-improve':
        case 'auto-improve':
            return `다음과 같이 ${userInput}을 상세하게 구현해주세요:

${userInput}

위 요청을 구체적이고 명확한 지시사항으로 작성하여, 모든 세부 사항과 요구사항이 포함되도록 해주세요.`;
        case 'evaluate':
            return `{
  "score": 75,
  "strengths": ["기본 요구사항 포함"],
  "improvements": ["더 구체적인 세부사항 필요"],
  "recommendation": "추가 정보가 있으면 더 좋은 결과를 얻을 수 있습니다"
}`;
        default:
            return `${userInput}에 대한 응답을 생성했습니다.`;
    }
}

// ======================
// 강화된 프롬프트 생성 함수들
// ======================

function getBasicQuestionsPrompt(isExpertMode) {
    return `# PROMPT ANALYSIS AND QUESTION GENERATION EXPERT

You are an expert who analyzes user prompts and generates improvement questions.

## ABSOLUTE PROHIBITIONS
- NEVER provide generic greetings or help messages
- NEVER respond with "Hello! How can I assist you today?" or similar
- NEVER change the user's original input content or domain
- NEVER give explanations - ONLY generate questions

## Current Mode: ${isExpertMode ? 'Expert Mode' : 'Normal Mode'}

## Response Rules
1. Analyze the user input accurately
2. Generate specific questions for that domain
3. MUST respond ONLY in JSON format

## Domain-Specific Question Examples
- Image/Video Generation: Style, composition, colors, mood, details
- Website Creation: Purpose, target audience, features, design style  
- Writing: Tone, audience, length, format, purpose
- Data Analysis: Analysis purpose, variables, visualization methods

## JSON Response Format
{
  "detectedCategory": "detected domain",
  "questions": [
    {
      "question": "specific question content",
      "type": "choice",
      "options": ["Option1", "Option2", "Option3", "Other"]
    }
  ]
}

${isExpertMode ? 'Expert Mode: Generate 1-3 core questions' : 'Normal Mode: Generate 1-6 questions dynamically'}

CRITICAL: Your response will be validated. Any generic response will be rejected.`;
}

function getInternalImprovePrompt(round) {
    return `# PROMPT INTERNAL IMPROVEMENT EXPERT (Round ${round})

You are an expert who improves prompts internally.

## ABSOLUTE CRITICAL RULES
- NEVER change the original input's topic or domain
- NEVER respond with "Hello! How can I assist you today?" or similar generic responses
- NEVER provide explanations or greetings
- Maintain 100% of the user's original intent while improving

## Round ${round} Internal Improvement Goal
${round === 1 ? 
  '- First improvement based on basic answers\n- Develop into more specific and clear requirements' :
  '- Second improvement integrating deep answers\n- Enhance to expert-level completeness'}

## Response Method
Provide ONLY the improved prompt, absolutely NO explanations or greetings.

CRITICAL: Generic responses will result in immediate failure.`;
}

function getExpertQuestionsPrompt(round) {
    return `# ROUND ${round} DEEP QUESTION GENERATION EXPERT

You are an expert generating deep questions in expert mode.

## ABSOLUTE PROHIBITIONS
- NEVER provide generic greetings or help messages
- NEVER duplicate previous questions
- NEVER change the original input's topic or domain

## Round ${round} Deep Question Purpose
${round === 1 ? 
`- Discover hidden intentions not captured in basic questions
- Understand user's real purpose and background
- Identify more specific requirements and details` :
`- Details from execution and implementation perspective
- Final elements to enhance quality and completeness
- User's final expectations and success metrics`}

## Duplication Prevention Principle
Absolutely NO overlap with previous questions in keywords or topics.
Generate questions ONLY from completely new perspectives.

## JSON Response Format
{
  "questions": [
    {
      "question": "deep question from completely different new perspective",
      "type": "choice",
      "options": ["Option1", "Option2", "Option3", "Other"]
    }
  ]
}

CRITICAL: Generic responses will be immediately rejected.`;
}

function getFinalImprovementPrompt(isExpertMode) {
    return `# FINAL PROMPT COMPLETION EXPERT

You are an expert who synthesizes all information to create the highest quality prompts.

## ABSOLUTE CRITICAL RULES
- NEVER change the original input's topic or domain
- NEVER provide generic greetings or explanations
- Preserve 100% of the user's original intent while improving to expert level

## Target Quality
${isExpertMode ? 'Expert-level highest quality prompt' : 'High-quality practical prompt'}

## Improvement Directions
1. Clarity: Specify requirements concretely
2. Completeness: Include all necessary information
3. Executability: Enable AI to perform accurately
4. Creativity: Add unique and interesting elements

## Response Method
Provide ONLY the final improved prompt, absolutely NO explanations or greetings.

CRITICAL: Your response will be evaluated for relevance to the original input. Generic responses = immediate failure.`;
}

function getEvaluationPrompt() {
    return `# PROMPT QUALITY EVALUATION EXPERT

You are an expert who strictly evaluates prompts.

## STRICT EVALUATION CRITERIA
- Generic greetings like "Hello! How can I assist you today?": 0 points
- Vague requests without specificity: 10-30 points
- Basic requirements only: 40-60 points
- Specific and clear requirements: 70-85 points
- Expert-level detailed prompts: 85-100 points

## Evaluation Items (25 points each)
1. Clarity: Are requirements specific and clear?
2. Completeness: Is sufficient information included?
3. Executability: Can AI actually perform the content?
4. Creativity: Are there unique and interesting elements?

## JSON Response Format
{
  "score": score(1-100),
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "recommendation": "comprehensive opinion"
}

CRITICAL: Be very strict with scoring. Generic responses get 0 points.`;
}

function getAutoImprovementPrompt() {
    return `# AUTOMATIC PROMPT IMPROVEMENT EXPERT

You are an expert who automatically improves prompts to 90+ point level.

## ABSOLUTE RULES
- Maintain original input's topic and domain
- NEVER provide generic greetings or explanations

## Improvement Directions
1. Add more specific requirements
2. Specify clear output formats
3. Add detailed conditions for quality enhancement
4. Utilize professional terms and techniques

## Response Method
Respond with ONLY the improved prompt.

CRITICAL: Your response will be validated for relevance and quality.`;
}

// ======================
// 프롬프트 구성 함수들  
// ======================

function buildInternalImprovementPrompt(userInput, questions, answers, round, previousImproved = '') {
    let prompt = `Original user input: "${userInput}"\n\n** ABSOLUTELY CRITICAL: Maintain the topic and domain of the above original input **\n\n`;
    
    if (previousImproved) {
        prompt += `Previously improved prompt: "${previousImproved}"\n\n`;
    }
    
    if (answers) {
        prompt += `User answers:\n${formatAnswersForPrompt(answers)}\n\n`;
    }
    
    prompt += `Please proceed with round ${round} internal improvement. Maintain the original input's topic and domain while reflecting the answer information.`;
    
    return prompt;
}

function buildExpertQuestionPrompt(userInput, internalImprovedPrompt, round) {
    let prompt = `Original user input: "${userInput}"\n\n** ABSOLUTELY CRITICAL: Maintain the topic and domain of the above original input **\n\n`;
    
    if (internalImprovedPrompt) {
        prompt += `Current improved state: "${internalImprovedPrompt}"\n\n`;
    }
    
    prompt += `Please generate round ${round} deep questions. Ask from new perspectives that don't duplicate previous questions.`;
    
    return prompt;
}

function buildFinalImprovementPrompt(userInput, questions, answers, isExpertMode, internalImprovedPrompt = '') {
    let prompt = `Original user input: "${userInput}"\n\n** ABSOLUTELY CRITICAL: Maintain the topic and domain of the above original input **\n\n`;
    
    if (internalImprovedPrompt) {
        prompt += `Internally improved prompt: "${internalImprovedPrompt}"\n\n`;
    }
    
    if (answers) {
        prompt += `All user answers:\n${formatAnswersForPrompt(answers)}\n\n`;
    }
    
    prompt += `Synthesize all the above information to generate ${isExpertMode ? 'expert-level' : 'high-quality'} final prompt.`;
    
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
                    const requestText = answerData.request ? `\nRequest: ${answerData.request}` : '';
                    return `Answer ${parseInt(index) + 1}: ${answerText}${requestText}`;
                } else {
                    const answerText = Array.isArray(answerData) ? answerData.join(', ') : answerData;
                    return `Answer ${parseInt(index) + 1}: ${answerText}`;
                }
            })
            .join('\n\n');
    }
    
    return String(answers);
}
