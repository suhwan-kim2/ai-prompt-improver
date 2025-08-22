// api/improve-prompt.js - 한국어 강제 + 새 평가시스템 + 스마트 질문 시스템

// 새로운 시스템 imports (실제 환경에서는 require 사용)
// import { evaluatePrompt, detectDomain } from '../utils/evaluationSystem.js';
// import { generateSmartQuestions, detectDomains } from '../utils/slotSystem.js';
// import { extractMentionedInfo } from '../utils/mentionExtractor.js';
// import { optimizeQuestions } from '../utils/questionOptimizer.js';

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
        let useStructuredOutput = false;
        
        // 단계별 프롬프트 설정
        switch (step) {
            case 'questions':
                // 🚀 새로운 스마트 질문 시스템 사용
                console.log('=== 스마트 질문 생성 시작 ===');
                
                const smartQuestions = generateSmartQuestionsLocal(userInput, isExpertMode);
                
                // JSON 형태로 반환
                const questionResponse = {
                    detectedCategory: smartQuestions.detectedDomains || "일반",
                    questions: smartQuestions.questions.map(q => ({
                        question: q.question,
                        type: q.type,
                        options: q.options,
                        category: q.category,
                        domain: q.domain
                    }))
                };
                
                res.json({ 
                    success: true, 
                    result: JSON.stringify(questionResponse)
                });
                return;
                
            case 'internal-improve-1':
                systemPrompt = getInternalImprovePrompt(1);
                userPrompt = buildInternalImprovementPrompt(userInput, questions, answers, 1);
                break;
                
            case 'questions-round-1':
                systemPrompt = getExpertQuestionsPrompt(1);
                userPrompt = buildExpertQuestionPrompt(userInput, internalImprovedPrompt, 1);
                useStructuredOutput = true;
                break;
                
            case 'internal-improve-2':
                systemPrompt = getInternalImprovePrompt(2);
                userPrompt = buildInternalImprovementPrompt(userInput, questions, answers, 2, internalImprovedPrompt);
                break;
                
            case 'questions-round-2':
                systemPrompt = getExpertQuestionsPrompt(2);
                userPrompt = buildExpertQuestionPrompt(userInput, internalImprovedPrompt, 2);
                useStructuredOutput = true;
                break;
                
            case 'final-improve':
                systemPrompt = getFinalImprovementPrompt(isExpertMode);
                userPrompt = buildFinalImprovementPrompt(userInput, questions, answers, isExpertMode, internalImprovedPrompt);
                break;
                
            case 'evaluate':
                // 새로운 평가시스템 사용
                const domainInfo = detectDomainSimple(userInput);
                const evaluation = evaluatePromptNew(userInput, userInput, domainInfo);
                
                res.json({ 
                    success: true, 
                    result: JSON.stringify(evaluation)
                });
                return;
                
            case 'auto-improve':
                systemPrompt = getAutoImprovementPrompt();
                userPrompt = `현재 프롬프트: "${userInput}"\n현재 점수: ${currentScore}점\n\n90점 이상으로 개선해주세요.`;
                break;
                
            default:
                throw new Error(`지원하지 않는 단계: ${step}`);
        }
        
        console.log('=== OpenAI 요청 ===');
        
        // OpenAI API 호출 설정
        const requestBody = {
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: step.includes('questions') ? 0.2 : 0.7,
            max_tokens: 2500
        };
        
        // JSON Schema 강제 적용 (질문 생성 단계)
        if (useStructuredOutput) {
            requestBody.response_format = {
                type: "json_schema",
                json_schema: {
                    name: "QuestionResponse",
                    schema: {
                        type: "object",
                        properties: {
                            questions: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        question: { type: "string" },
                                        type: { type: "string" },
                                        options: { 
                                            type: "array", 
                                            items: { type: "string" }
                                        }
                                    },
                                    required: ["question", "type"]
                                }
                            }
                        },
                        required: ["questions"],
                        additionalProperties: false
                    }
                }
            };
        }
        
        // 🚀 최대 3번 재시도로 좋은 한국어 응답 확보
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
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('OpenAI API 오류:', response.status, errorData);
                throw new Error(`OpenAI API 오류: ${response.status}`);
            }

            const data = await response.json();
            const rawResult = data.choices[0].message.content;
            
            console.log(`시도 ${attempts} 결과:`, rawResult.substring(0, 100));
            
            // 🔥 한국어 응답 품질 검증
            if (isValidKoreanResponse(rawResult, step, userInput)) {
                result = rawResult;
                console.log('✅ 좋은 한국어 응답 확보!');
            } else {
                console.log('❌ 불량 응답, 재시도...');
                
                // 재시도를 위해 시스템 프롬프트 강화
                requestBody.messages[0].content = enhanceSystemPromptForKorean(systemPrompt, attempts);
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

// ======================
// 🚀 스마트 질문 생성 (로컬 구현)
// ======================

function generateSmartQuestionsLocal(userInput, isExpertMode) {
    console.log('=== 로컬 스마트 질문 생성 ===');
    console.log('입력:', userInput);
    console.log('전문가모드:', isExpertMode);
    
    // 1. 도메인 감지
    const detectedDomains = detectDomainsLocal(userInput);
    console.log('감지된 도메인:', detectedDomains);
    
    // 2. 언급된 정보 추출
    const mentionedInfo = extractMentionedInfoLocal(userInput);
    console.log('언급된 정보:', mentionedInfo);
    
    // 3. 슬롯 기반 질문 생성
    const questions = generateQuestionsFromDomains(detectedDomains, mentionedInfo, isExpertMode);
    
    // 4. 질문 최적화
    const maxQuestions = isExpertMode ? 12 : 8;
    const optimizedQuestions = optimizeQuestionsLocal(questions, userInput, mentionedInfo, maxQuestions);
    
    console.log(`최종 질문 수: ${optimizedQuestions.length}`);
    
    return {
        detectedDomains: detectedDomains.map(d => d.domain).join(', '),
        questions: optimizedQuestions,
        mentionedInfo: mentionedInfo
    };
}

function detectDomainsLocal(userInput) {
    const domains = [
        {
            name: 'visual_design',
            keywords: ['이미지', '그림', '사진', '로고', '디자인', '그려', 'UI', 'UX'],
            weight: 1.0
        },
        {
            name: 'video', 
            keywords: ['영상', '비디오', '동영상', '애니메이션', '촬영'],
            weight: 1.0
        },
        {
            name: 'text_language',
            keywords: ['글', '텍스트', '써줘', '작성', '보고서', '블로그'],
            weight: 0.9
        },
        {
            name: 'development',
            keywords: ['웹사이트', '앱', '프로그램', '코드', '개발'],
            weight: 0.9
        },
        {
            name: 'presentation_education',
            keywords: ['PPT', '발표', '프레젠테이션', '교육', '강의'],
            weight: 0.8
        }
    ];
    
    const detected = [];
    const input = userInput.toLowerCase();
    
    domains.forEach(domain => {
        const matches = domain.keywords.filter(keyword => input.includes(keyword)).length;
        if (matches > 0) {
            detected.push({
                domain: domain.name,
                confidence: (matches / domain.keywords.length) * domain.weight,
                matches: matches
            });
        }
    });
    
    return detected.sort((a, b) => b.confidence - a.confidence);
}

function extractMentionedInfoLocal(userInput) {
    const mentioned = {};
    const input = userInput.toLowerCase();
    
    // 색상 추출
    const colors = ['빨간', '파란', '노란', '검은', '흰', '초록', '보라', '분홍'];
    colors.forEach(color => {
        if (input.includes(color)) mentioned['색상'] = color + '색';
    });
    
    // 스타일 추출
    const styles = ['3d', '애니메이션', '실사', '만화', '일러스트'];
    styles.forEach(style => {
        if (input.includes(style)) mentioned['스타일'] = style;
    });
    
    // 크기/길이 추출
    if (/\d+초/.test(input)) mentioned['길이'] = input.match(/\d+초/)[0];
    if (/\d+분/.test(input)) mentioned['길이'] = input.match(/\d+분/)[0];
    
    // 해상도 추출
    if (/4k|4K/.test(input)) mentioned['해상도'] = '4K';
    if (/hd|HD/.test(input)) mentioned['해상도'] = 'HD';
    
    return mentioned;
}

function generateQuestionsFromDomains(detectedDomains, mentionedInfo, isExpertMode) {
    const questions = [];
    
    if (detectedDomains.length === 0) {
        // 기본 질문
        questions.push({
            question: "어떤 종류의 작업을 원하시나요?",
            type: "choice",
            options: ["이미지/디자인", "영상", "글쓰기", "웹개발", "발표자료", "기타"],
            category: "기본분류",
            domain: "general",
            weight: 10
        });
        return questions;
    }
    
    // 도메인별 질문 템플릿
    const domainQuestions = {
        visual_design: [
            {
                category: "주제",
                question: "구체적으로 어떤 주제나 내용인가요?",
                type: "text",
                weight: 10,
                required: true
            },
            {
                category: "스타일", 
                question: "어떤 스타일로 만들까요?",
                type: "choice",
                options: ["사실적/포토리얼", "3D렌더링", "애니메이션", "일러스트", "만화", "기타"],
                weight: 9,
                required: true
            },
            {
                category: "색상",
                question: "색상이나 색조는 어떻게 할까요?",
                type: "choice", 
                options: ["따뜻한 톤", "차가운 톤", "모노톤", "화려한", "자연색", "기타"],
                weight: 7,
                required: false
            },
            {
                category: "용도",
                question: "어떤 용도로 사용하실 건가요?",
                type: "choice",
                options: ["개인용", "상업용", "포트폴리오", "SNS용", "인쇄물", "기타"],
                weight: 6,
                required: false
            },
            {
                category: "해상도",
                question: "해상도나 화질은 어느 정도로 할까요?",
                type: "choice",
                options: ["HD", "4K", "인쇄용 고해상도", "웹용", "상관없음"],
                weight: 5,
                required: false
            }
        ],
        
        video: [
            {
                category: "목적",
                question: "영상의 주요 목적은 무엇인가요?",
                type: "choice",
                options: ["광고/홍보", "교육/튜토리얼", "엔터테인먼트", "소개/프레젠테이션", "기타"],
                weight: 10,
                required: true
            },
            {
                category: "길이",
                question: "영상 길이는 어느 정도로 할까요?",
                type: "choice",
                options: ["짧게(15초 이하)", "숏폼(1분 이하)", "중간(1-5분)", "길게(5분 이상)", "기타"],
                weight: 9,
                required: true
            },
            {
                category: "스타일",
                question: "영상 스타일은 어떻게 할까요?",
                type: "choice", 
                options: ["실사촬영", "3D애니메이션", "2D애니메이션", "모션그래픽", "기타"],
                weight: 8,
                required: true
            },
            {
                category: "플랫폼",
                question: "주로 어떤 플랫폼에서 사용하실 건가요?",
                type: "choice",
                options: ["YouTube", "TikTok/숏츠", "Instagram", "웹사이트", "기타"],
                weight: 6,
                required: false
            }
        ],
        
        text_language: [
            {
                category: "목적",
                question: "이 글의 주요 목적은 무엇인가요?",
                type: "choice",
                options: ["정보전달", "설득/논증", "감정표현", "교육/설명", "엔터테인먼트", "기타"],
                weight: 10,
                required: true
            },
            {
                category: "대상독자",
                question: "주요 대상 독자는 누구인가요?",
                type: "choice",
                options: ["전문가", "일반인", "학생", "고객", "동료", "기타"],
                weight: 9,
                required: true
            },
            {
                category: "분량",
                question: "대략적인 분량은 어느 정도로 할까요?",
                type: "choice",
                options: ["짧게(1-2페이지)", "중간(3-10페이지)", "길게(10페이지 이상)", "기타"],
                weight: 7,
                required: false
            },
            {
                category: "톤",
                question: "어떤 톤으로 작성할까요?",
                type: "choice",
                options: ["공식적/정중한", "친근한/편안한", "전문적/기술적", "유머러스", "기타"],
                weight: 8,
                required: false
            }
        ],
        
        development: [
            {
                category: "프로젝트유형",
                question: "어떤 종류의 프로젝트인가요?",
                type: "choice",
                options: ["웹사이트", "모바일앱", "데스크톱앱", "API/백엔드", "기타"],
                weight: 10,
                required: true
            },
            {
                category: "주요기능",
                question: "핵심적으로 필요한 기능들을 알려주세요",
                type: "text",
                placeholder: "예: 로그인, 게시판, 결제, 검색 등",
                weight: 9,
                required: true
            },
            {
                category: "기술스택",
                question: "선호하는 기술이나 프레임워크가 있나요?",
                type: "text",
                placeholder: "예: React, Node.js, Python 등",
                weight: 7,
                required: false
            },
            {
                category: "사용자규모",
                question: "예상 사용자 규모는 어느 정도인가요?",
                type: "choice",
                options: ["개인용", "소규모(~100명)", "중규모(~1,000명)", "대규모(1,000명+)", "기타"],
                weight: 6,
                required: false
            }
        ],
        
        presentation_education: [
            {
                category: "목적",
                question: "발표의 주요 목적은 무엇인가요?",
                type: "choice",
                options: ["업무발표", "교육/강의", "세일즈피치", "학술발표", "기타"],
                weight: 10,
                required: true
            },
            {
                category: "청중",
                question: "주요 청중은 누구인가요?",
                type: "choice",
                options: ["동료/팀원", "상급자/임원", "고객", "학생", "일반인", "기타"],
                weight: 9,
                required: true
            },
            {
                category: "분량",
                question: "슬라이드 수는 대략 어느 정도로 할까요?",
                type: "choice",
                options: ["짧게(5-10슬라이드)", "중간(10-20슬라이드)", "길게(20슬라이드 이상)", "기타"],
                weight: 7,
                required: false
            }
        ]
    };
    
    // 각 도메인별로 질문 생성
    detectedDomains.forEach((domain, domainIndex) => {
        const domainWeight = domainIndex === 0 ? 1.0 : 0.6; // 주 도메인 vs 부 도메인
        const domainQuestionList = domainQuestions[domain.domain] || [];
        
        domainQuestionList.forEach(questionTemplate => {
            // 이미 언급된 정보는 건너뛰기
            if (mentionedInfo[questionTemplate.category]) {
                console.log(`🚫 질문 건너뛰기: ${questionTemplate.category} (이미 언급: ${mentionedInfo[questionTemplate.category]})`);
                return;
            }
            
            const priority = questionTemplate.weight * domainWeight * domain.confidence;
            
            questions.push({
                question: questionTemplate.question,
                type: questionTemplate.type,
                options: questionTemplate.options,
                placeholder: questionTemplate.placeholder,
                category: questionTemplate.category,
                domain: domain.domain,
                weight: questionTemplate.weight,
                priority: priority,
                required: questionTemplate.required || false
            });
        });
    });
    
    return questions;
}

function optimizeQuestionsLocal(questions, userInput, mentionedInfo, maxQuestions) {
    console.log('=== 질문 최적화 ===');
    console.log(`입력: ${questions.length}개, 목표: ${maxQuestions}개`);
    
    // 1. 우선순위 정렬
    questions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // 2. 필수 질문은 무조건 포함
    const requiredQuestions = questions.filter(q => q.required);
    const optionalQuestions = questions.filter(q => !q.required);
    
    console.log(`필수: ${requiredQuestions.length}개, 선택: ${optionalQuestions.length}개`);
    
    // 3. 목표 개수에 맞춰 선택
    let selectedQuestions = [...requiredQuestions];
    const remainingSlots = Math.max(0, maxQuestions - requiredQuestions.length);
    
    selectedQuestions = selectedQuestions.concat(
        optionalQuestions.slice(0, remainingSlots)
    );
    
    console.log(`최종 선택: ${selectedQuestions.length}개`);
    
    return selectedQuestions;
}

// ======================
// 🔥 한국어 강제 시스템 (이전과 동일)
// ======================

const KOREAN_ENFORCER = `

!!! 절대 중요한 지시사항 !!!
- 반드시 모든 응답을 한국어로만 작성하세요
- 질문도 한국어로만 생성하세요  
- 영어 응답은 절대 금지합니다
- "Hello", "What", "How" 같은 영어 단어 사용 금지
- 한국어가 아닌 응답은 무조건 실패로 간주됩니다

KOREAN ONLY! NO ENGLISH ALLOWED!
`;

function isValidKoreanResponse(response, step, originalInput) {
    const invalidResponses = [
        'hello! how can i assist you today?',
        'hello!',
        'how can i help you',
        'what can i do for you',
        'how may i assist you',
        'i am an ai assistant',
        'i\'m here to help',
        'what would you like',
        'how may i help'
    ];
    
    const lowerResponse = response.toLowerCase().trim();
    
    // 1. 일반적인 불량 응답 체크
    for (const invalid of invalidResponses) {
        if (lowerResponse.includes(invalid)) {
            console.log('❌ 불량 응답 감지:', invalid);
            return false;
        }
    }
    
    // 2. 영어 패턴 감지 (특히 질문 단계)
    if (step.includes('questions')) {
        const englishPatterns = [
            /\bwhat\b/i, /\bhow\b/i, /\bwhen\b/i, /\bwhere\b/i, 
            /\bwhy\b/i, /\bwhich\b/i, /\bwho\b/i, /\bdo you\b/i,
            /\bwould you\b/i, /\bcan you\b/i, /\bshould\b/i
        ];
        
        for (const pattern of englishPatterns) {
            if (pattern.test(response)) {
                console.log('❌ 영어 질문 패턴 감지:', pattern);
                return false;
            }
        }
    }
    
    // 3. 너무 짧은 응답 체크
    if (response.trim().length < 20) {
        console.log('❌ 너무 짧은 응답:', response.length);
        return false;
    }
    
    // 4. 한국어 문자 비율 체크
    const koreanChars = (response.match(/[가-힣]/g) || []).length;
    const totalChars = response.replace(/\s/g, '').length;
    const koreanRatio = koreanChars / Math.max(1, totalChars);
    
    if (koreanRatio < 0.3) {
        console.log('❌ 한국어 비율 부족:', koreanRatio);
        return false;
    }
    
    // 5. 프롬프트 개선 단계에서 원본 입력 관련성 체크
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
        
        // 너무 장황한 프롬프트 체크
        if (response.length > originalInput.length * 4) {
            console.log('❌ 너무 장황한 프롬프트');
            return false;
        }
    }
    
    return true;
}

function extractKeywords(text) {
    const stopWords = ['을', '를', '이', '가', '은', '는', '의', '에', '과', '와', '으로', '로', '에서'];
    return text.toLowerCase()
        .replace(/[^\w\s가-힣]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1 && !stopWords.includes(word));
}

function enhanceSystemPromptForKorean(originalPrompt, attempt) {
    const strongerInstructions = `

!!! CRITICAL KOREAN-ONLY INSTRUCTIONS FOR ATTEMPT ${attempt} !!!
- 이번 ${attempt}번째 시도입니다. 반드시 한국어로만 응답하세요!
- NEVER respond with any English words
- NEVER use "Hello", "What", "How", "Can", "Would" etc.
- 질문 생성시에도 반드시 한국어만 사용하세요
- Focus ONLY on the task described in the user input
- Maintain the exact topic and domain from the original input

한국어가 아닌 응답은 즉시 실패 처리됩니다!
KOREAN ONLY OR IMMEDIATE FAILURE!
`;
    
    return originalPrompt + strongerInstructions;
}

// ======================
// 🔥 새로운 평가시스템 (간단 버전) - 이전과 동일
// ======================

function detectDomainSimple(userInput) {
    const input = userInput.toLowerCase();
    
    if (/이미지|그림|사진|로고|디자인|그려/.test(input)) {
        return { domain: 'visual_design', confidence: 0.8 };
    }
    if (/영상|비디오|동영상|애니메이션/.test(input)) {
        return { domain: 'video', confidence: 0.8 };
    }
    if (/글|텍스트|써|작성|보고서|이메일/.test(input)) {
        return { domain: 'text_language', confidence: 0.8 };
    }
    if (/웹사이트|앱|프로그램|코드|개발/.test(input)) {
        return { domain: 'development', confidence: 0.8 };
    }
    
    return { domain: null, confidence: 0 };
}

function evaluatePromptNew(prompt, originalInput, domainInfo) {
    try {
        const words = prompt.split(/\s+/).filter(w => w.length > 0);
        const lengthRatio = prompt.length / originalInput.length;
        
        // 1. 정보밀도 (30점)
        const informativeKeywords = ['색상', '크기', '스타일', '해상도', '길이', '시간', '분', '초', 'cm', 'px', '4k', 'hd'];
        const fluffKeywords = ['아름다운', '멋진', '완벽한', '최고의', '감동적인', '마법같은'];
        
        const informativeCount = informativeKeywords.filter(k => prompt.toLowerCase().includes(k)).length;
        const fluffCount = fluffKeywords.filter(k => prompt.toLowerCase().includes(k)).length;
        
        const densityScore = Math.min(30, Math.max(10, (informativeCount - fluffCount) * 5 + 15));
        
        // 2. 완성도 (25점)
        let completenessScore = 20;
        if (domainInfo.domain === 'visual_design') {
            if (/색상|색깔/.test(prompt)) completenessScore += 2;
            if (/스타일|3d|애니메이션/.test(prompt)) completenessScore += 2;
            if (/크기|해상도/.test(prompt)) completenessScore += 1;
        }
        
        // 3. 명확성 (20점)
        const numberCount = (prompt.match(/\d+/g) || []).length;
        const vagueWords = ['어떤', '좀', '약간', '적당히'].filter(w => prompt.includes(w)).length;
        
        const clarityScore = Math.min(20, Math.max(10, 15 + numberCount * 2 - vagueWords * 2));
        
        // 4. 실행가능성 (15점)
        const difficultWords = ['저작권', '실존인물', '브랜드'].filter(w => prompt.includes(w)).length;
        const executabilityScore = Math.min(15, Math.max(8, 15 - difficultWords * 3));
        
        // 5. 효율성 (10점)
        let efficiencyScore = 10;
        if (lengthRatio > 4) efficiencyScore = 5;
        else if (lengthRatio > 3) efficiencyScore = 7;
        else if (lengthRatio < 1.2) efficiencyScore = 8;
        
        const totalScore = densityScore + completenessScore + clarityScore + executabilityScore + efficiencyScore;
        
        const recommendations = [];
        if (densityScore < 20) recommendations.push("더 구체적인 정보를 추가해보세요");
        if (clarityScore < 15) recommendations.push("모호한 표현을 구체적으로 바꿔보세요");
        if (efficiencyScore < 8) recommendations.push("불필요한 내용을 줄여보세요");
        
        return {
            score: Math.round(totalScore),
            breakdown: {
                informationDensity: densityScore,
                completeness: completenessScore,
                clarity: clarityScore,
                executability: executabilityScore,
                efficiency: efficiencyScore
            },
            recommendations: recommendations.length > 0 ? recommendations : ["좋은 프롬프트입니다!"],
            grade: totalScore >= 95 ? 'A+' : totalScore >= 90 ? 'A' : totalScore >= 80 ? 'B+' : totalScore >= 70 ? 'B' : 'C'
        };
        
    } catch (error) {
        console.error('평가 중 오류:', error);
        return {
            score: 75,
            breakdown: { informationDensity: 75, completeness: 75, clarity: 75, executability: 75, efficiency: 75 },
            recommendations: ["평가 중 오류가 발생했습니다."],
            grade: 'B'
        };
    }
}

// 대체 응답 생성 함수
function generateFallbackResponse(step, userInput) {
    switch (step) {
        case 'questions':
            return `{
  "detectedCategory": "사용자 요청",
  "questions": [
    {
      "question": "어떤 종류의 작업을 원하시나요?",
      "type": "choice",
      "options": ["이미지/디자인", "영상", "글쓰기", "웹개발", "발표자료", "기타"]
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
  "breakdown": {"informationDensity": 75, "completeness": 75, "clarity": 75, "executability": 75, "efficiency": 75},
  "recommendations": ["추가 정보가 있으면 더 좋은 결과를 얻을 수 있습니다"],
  "grade": "B"
}`;
        default:
            return `${userInput}에 대한 응답을 생성했습니다.`;
    }
}

// 프롬프트 생성 함수들 (한국어 강제 적용)
function getInternalImprovePrompt(round) {
    return `# 한국어 프롬프트 내부 개선 전문가 (${round}라운드)

당신은 프롬프트를 내부적으로 개선하는 전문가입니다.

${KOREAN_ENFORCER}

## ${round}라운드 내부 개선 목표
${round === 1 ? 
  '- 기본 답변을 바탕으로 첫 번째 개선\n- 더 구체적이고 명확한 요구사항으로 발전' :
  '- 심층 답변을 통합한 두 번째 개선\n- 전문가급 완성도로 향상'}

## 응답 방법
개선된 프롬프트만 제공하고, 절대로 설명이나 인사말을 하지 마세요.

중요: 한국어로만 응답하세요.`;
}

function getExpertQuestionsPrompt(round) {
    return `# ${round}라운드 심층 질문 생성 전문가

당신은 전문가 모드에서 심층 질문을 생성하는 전문가입니다.

${KOREAN_ENFORCER}

## ${round}라운드 심층 질문 목적
${round === 1 ? 
`- 기본 질문에서 포착하지 못한 숨겨진 의도 발견` :
`- 실행과 구현 관점에서의 세부사항`}

## JSON 응답 형식
{
  "questions": [
    {
      "question": "구체적인 심층 질문",
      "type": "choice",
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}

중요: 한국어로만 응답하세요.`;
}

function getFinalImprovementPrompt(isExpertMode) {
    return `# 최종 프롬프트 완성 전문가

${KOREAN_ENFORCER}

## 목표 품질
${isExpertMode ? '전문가급 최고 품질 프롬프트 (95점 이상)' : '고품질 실용적 프롬프트 (85점 이상)'}

## 개선 방향
1. 명확성: 요구사항을 구체적으로 명시
2. 완성도: 필요한 모든 정보 포함
3. 실행가능성: AI가 정확히 수행할 수 있도록
4. 간결성: 불필요한 설명 제거, 핵심만 포함

## 응답 방법
최종 개선된 프롬프트만 제공하고, 절대로 설명이나 인사말을 하지 마세요.`;
}

function getAutoImprovementPrompt() {
    return `# 자동 프롬프트 개선 전문가

${KOREAN_ENFORCER}

## 개선 방향
1. 더 구체적인 요구사항 추가 (수치, 크기, 색상 등)
2. 명확한 출력 형식 지정
3. 품질 향상을 위한 세부 조건 추가
4. 간결성 유지 (원본의 3배 이내)

## 응답 방법
개선된 프롬프트만 응답하세요.`;
}

// 프롬프트 구성 함수들
function buildInternalImprovementPrompt(userInput, questions, answers, round, previousImproved = '') {
    let prompt = `원본 사용자 입력: "${userInput}"\n\n`;
    
    if (previousImproved) {
        prompt += `이전 개선된 프롬프트: "${previousImproved}"\n\n`;
    }
    
    if (answers) {
        prompt += `사용자 답변:\n${formatAnswersForPrompt(answers)}\n\n`;
    }
    
    prompt += `${round}라운드 내부 개선을 진행하세요.`;
    
    return prompt;
}

function buildExpertQuestionPrompt(userInput, internalImprovedPrompt, round) {
    let prompt = `원본 사용자 입력: "${userInput}"\n\n`;
    
    if (internalImprovedPrompt) {
        prompt += `현재 개선된 상태: "${internalImprovedPrompt}"\n\n`;
    }
    
    prompt += `${round}라운드 심층 질문을 생성하세요.`;
    
    return prompt;
}

function buildFinalImprovementPrompt(userInput, questions, answers, isExpertMode, internalImprovedPrompt = '') {
    let prompt = `원본 사용자 입력: "${userInput}"\n\n`;
    
    if (internalImprovedPrompt) {
        prompt += `내부 개선된 프롬프트: "${internalImprovedPrompt}"\n\n`;
    }
    
    if (answers) {
        prompt += `모든 사용자 답변:\n${formatAnswersForPrompt(answers)}\n\n`;
    }
    
    prompt += `위 정보를 모두 종합하여 ${isExpertMode ? '전문가급' : '고품질'} 최종 프롬프트를 생성하세요.`;
    
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
}// api/improve-prompt.js - 한국어 강제 + 새로운 평가시스템 적용

// 새로운 평가시스템 import (Node.js 환경에서는 require 사용)
// import { evaluatePrompt, detectDomain } from '../utils/evaluationSystem.js';

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
                // 새로운 평가시스템 사용
                const domainInfo = detectDomainSimple(userInput);
                const evaluation = evaluatePromptNew(userInput, userInput, domainInfo);
                
                res.json({ 
                    success: true, 
                    result: JSON.stringify(evaluation)
                });
                return;
                
            case 'auto-improve':
                systemPrompt = getAutoImprovementPrompt();
                userPrompt = `현재 프롬프트: "${userInput}"\n현재 점수: ${currentScore}점\n\n90점 이상으로 개선해주세요.`;
                break;
                
            default:
                throw new Error(`지원하지 않는 단계: ${step}`);
        }
        
        console.log('=== OpenAI 요청 ===');
        
        // 🚀 최대 3번 재시도로 좋은 한국어 응답 확보
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
            
            // 🔥 한국어 응답 품질 검증
            if (isValidKoreanResponse(rawResult, step, userInput)) {
                result = rawResult;
                console.log('✅ 좋은 한국어 응답 확보!');
            } else {
                console.log('❌ 불량 응답, 재시도...');
                
                // 재시도를 위해 시스템 프롬프트 강화
                systemPrompt = enhanceSystemPromptForKorean(systemPrompt, attempts);
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

// ======================
// 🔥 한국어 강제 시스템
// ======================

// 한국어 강제 프롬프트 (모든 시스템 프롬프트에 추가)
const KOREAN_ENFORCER = `

!!! 절대 중요한 지시사항 !!!
- 반드시 모든 응답을 한국어로만 작성하세요
- 질문도 한국어로만 생성하세요  
- 영어 응답은 절대 금지합니다
- "Hello", "What", "How" 같은 영어 단어 사용 금지
- 한국어가 아닌 응답은 무조건 실패로 간주됩니다

KOREAN ONLY! NO ENGLISH ALLOWED!
`;

// 한국어 응답 품질 검증 함수
function isValidKoreanResponse(response, step, originalInput) {
    const invalidResponses = [
        'hello! how can i assist you today?',
        'hello!',
        'how can i help you',
        'what can i do for you',
        'how may i assist you',
        'i am an ai assistant',
        'i\'m here to help',
        'what would you like',
        'how may i help'
    ];
    
    const lowerResponse = response.toLowerCase().trim();
    
    // 1. 일반적인 불량 응답 체크
    for (const invalid of invalidResponses) {
        if (lowerResponse.includes(invalid)) {
            console.log('❌ 불량 응답 감지:', invalid);
            return false;
        }
    }
    
    // 2. 영어 패턴 감지 (특히 질문 단계)
    if (step.includes('questions')) {
        const englishPatterns = [
            /\bwhat\b/i, /\bhow\b/i, /\bwhen\b/i, /\bwhere\b/i, 
            /\bwhy\b/i, /\bwhich\b/i, /\bwho\b/i, /\bdo you\b/i,
            /\bwould you\b/i, /\bcan you\b/i, /\bshould\b/i
        ];
        
        for (const pattern of englishPatterns) {
            if (pattern.test(response)) {
                console.log('❌ 영어 질문 패턴 감지:', pattern);
                return false;
            }
        }
    }
    
    // 3. 너무 짧은 응답 체크
    if (response.trim().length < 20) {
        console.log('❌ 너무 짧은 응답:', response.length);
        return false;
    }
    
    // 4. 한국어 문자 비율 체크
    const koreanChars = (response.match(/[가-힣]/g) || []).length;
    const totalChars = response.replace(/\s/g, '').length;
    const koreanRatio = koreanChars / Math.max(1, totalChars);
    
    if (koreanRatio < 0.3) { // 한국어 비율이 30% 미만이면 거부
        console.log('❌ 한국어 비율 부족:', koreanRatio);
        return false;
    }
    
    // 5. 프롬프트 개선 단계에서 원본 입력 관련성 체크
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
        
        // 너무 장황한 프롬프트 체크 (원본의 4배 이상이면 거부)
        if (response.length > originalInput.length * 4) {
            console.log('❌ 너무 장황한 프롬프트');
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

// 한국어 강제를 위한 시스템 프롬프트 강화
function enhanceSystemPromptForKorean(originalPrompt, attempt) {
    const strongerInstructions = `

!!! CRITICAL KOREAN-ONLY INSTRUCTIONS FOR ATTEMPT ${attempt} !!!
- 이번 ${attempt}번째 시도입니다. 반드시 한국어로만 응답하세요!
- NEVER respond with any English words
- NEVER use "Hello", "What", "How", "Can", "Would" etc.
- 질문 생성시에도 반드시 한국어만 사용하세요
- Focus ONLY on the task described in the user input
- Maintain the exact topic and domain from the original input
- NO English words, NO greetings in English, NO generic responses

한국어가 아닌 응답은 즉시 실패 처리됩니다!
KOREAN ONLY OR IMMEDIATE FAILURE!
`;
    
    return originalPrompt + strongerInstructions;
}

// ======================
// 🔥 새로운 평가시스템 (간단 버전)
// ======================

// 간단한 도메인 감지
function detectDomainSimple(userInput) {
    const input = userInput.toLowerCase();
    
    if (/이미지|그림|사진|로고|디자인|그려/.test(input)) {
        return { domain: 'visual_design', confidence: 0.8 };
    }
    if (/영상|비디오|동영상|애니메이션/.test(input)) {
        return { domain: 'video', confidence: 0.8 };
    }
    if (/글|텍스트|써|작성|보고서|이메일/.test(input)) {
        return { domain: 'text_language', confidence: 0.8 };
    }
    if (/웹사이트|앱|프로그램|코드|개발/.test(input)) {
        return { domain: 'development', confidence: 0.8 };
    }
    
    return { domain: null, confidence: 0 };
}

// 새로운 평가 함수 (간단 버전)
function evaluatePromptNew(prompt, originalInput, domainInfo) {
    try {
        // 기본 분석
        const words = prompt.split(/\s+/).filter(w => w.length > 0);
        const lengthRatio = prompt.length / originalInput.length;
        
        // 1. 정보밀도 (30점)
        const informativeKeywords = ['색상', '크기', '스타일', '해상도', '길이', '시간', '분', '초', 'cm', 'px', '4k', 'hd'];
        const fluffKeywords = ['아름다운', '멋진', '완벽한', '최고의', '감동적인', '마법같은'];
        
        const informativeCount = informativeKeywords.filter(k => prompt.toLowerCase().includes(k)).length;
        const fluffCount = fluffKeywords.filter(k => prompt.toLowerCase().includes(k)).length;
        
        const densityScore = Math.min(30, Math.max(10, (informativeCount - fluffCount) * 5 + 15));
        
        // 2. 완성도 (25점)
        let completenessScore = 20; // 기본점수
        if (domainInfo.domain === 'visual_design') {
            if (/색상|색깔/.test(prompt)) completenessScore += 2;
            if (/스타일|3d|애니메이션/.test(prompt)) completenessScore += 2;
            if (/크기|해상도/.test(prompt)) completenessScore += 1;
        }
        
        // 3. 명확성 (20점)
        const numberCount = (prompt.match(/\d+/g) || []).length;
        const vagueWords = ['어떤', '좀', '약간', '적당히'].filter(w => prompt.includes(w)).length;
        
        const clarityScore = Math.min(20, Math.max(10, 15 + numberCount * 2 - vagueWords * 2));
        
        // 4. 실행가능성 (15점)
        const difficultWords = ['저작권', '실존인물', '브랜드'].filter(w => prompt.includes(w)).length;
        const executabilityScore = Math.min(15, Math.max(8, 15 - difficultWords * 3));
        
        // 5. 효율성 (10점)
        let efficiencyScore = 10;
        if (lengthRatio > 4) efficiencyScore = 5;
        else if (lengthRatio > 3) efficiencyScore = 7;
        else if (lengthRatio < 1.2) efficiencyScore = 8;
        
        const totalScore = densityScore + completenessScore + clarityScore + executabilityScore + efficiencyScore;
        
        const recommendations = [];
        if (densityScore < 20) recommendations.push("더 구체적인 정보를 추가해보세요");
        if (clarityScore < 15) recommendations.push("모호한 표현을 구체적으로 바꿔보세요");
        if (efficiencyScore < 8) recommendations.push("불필요한 내용을 줄여보세요");
        
        return {
            score: Math.round(totalScore),
            breakdown: {
                informationDensity: densityScore,
                completeness: completenessScore,
                clarity: clarityScore,
                executability: executabilityScore,
                efficiency: efficiencyScore
            },
            recommendations: recommendations.length > 0 ? recommendations : ["좋은 프롬프트입니다!"],
            grade: totalScore >= 95 ? 'A+' : totalScore >= 90 ? 'A' : totalScore >= 80 ? 'B+' : totalScore >= 70 ? 'B' : 'C'
        };
        
    } catch (error) {
        console.error('평가 중 오류:', error);
        return {
            score: 75,
            breakdown: { informationDensity: 75, completeness: 75, clarity: 75, executability: 75, efficiency: 75 },
            recommendations: ["평가 중 오류가 발생했습니다."],
            grade: 'B'
        };
    }
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
  "breakdown": {"informationDensity": 75, "completeness": 75, "clarity": 75, "executability": 75, "efficiency": 75},
  "recommendations": ["추가 정보가 있으면 더 좋은 결과를 얻을 수 있습니다"],
  "grade": "B"
}`;
        default:
            return `${userInput}에 대한 응답을 생성했습니다.`;
    }
}

// ======================
// 강화된 프롬프트 생성 함수들 (한국어 강제 추가)
// ======================

function getBasicQuestionsPrompt(isExpertMode) {
    return `# 한국어 프롬프트 분석 및 질문 생성 전문가

당신은 사용자의 프롬프트를 분석하고 개선을 위한 질문을 생성하는 전문가입니다.

${KOREAN_ENFORCER}

## 현재 모드: ${isExpertMode ? '전문가 모드' : '일반 모드'}

## 응답 규칙
1. 사용자 입력을 정확히 분석하세요
2. 해당 도메인에 특화된 질문을 생성하세요
3. 반드시 JSON 형식으로만 응답하세요
4. 모든 질문과 옵션은 한국어로 작성하세요

## 도메인별 질문 예시
- 이미지/영상 생성: 스타일, 구성, 색상, 분위기, 세부사항
- 웹사이트 제작: 목적, 대상 사용자, 기능, 디자인 스타일  
- 글쓰기: 톤, 대상, 길이, 형식, 목적
- 데이터 분석: 분석 목적, 변수, 시각화 방법

## JSON 응답 형식
{
  "detectedCategory": "감지된 도메인",
  "questions": [
    {
      "question": "구체적인 질문 내용",
      "type": "choice",
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}

${isExpertMode ? '전문가 모드: 1-3개의 핵심 질문 생성' : '일반 모드: 1-6개의 질문을 동적으로 생성'}

중요: 반드시 한국어로만 응답하세요. 영어 응답은 즉시 거부됩니다.`;
}

function getInternalImprovePrompt(round) {
    return `# 한국어 프롬프트 내부 개선 전문가 (${round}라운드)

당신은 프롬프트를 내부적으로 개선하는 전문가입니다.

${KOREAN_ENFORCER}

## 절대 중요 규칙
- 원본 입력의 주제나 도메인을 절대 변경하지 마세요
- 사용자의 원본 의도를 100% 유지하면서 개선하세요

## ${round}라운드 내부 개선 목표
${round === 1 ? 
  '- 기본 답변을 바탕으로 첫 번째 개선\n- 더 구체적이고 명확한 요구사항으로 발전' :
  '- 심층 답변을 통합한 두 번째 개선\n- 전문가급 완성도로 향상'}

## 응답 방법
개선된 프롬프트만 제공하고, 절대로 설명이나 인사말을 하지 마세요.

중요: 한국어로만 응답하세요.`;
}

function getExpertQuestionsPrompt(round) {
    return `# ${round}라운드 심층 질문 생성 전문가

당신은 전문가 모드에서 심층 질문을 생성하는 전문가입니다.

${KOREAN_ENFORCER}

## ${round}라운드 심층 질문 목적
${round === 1 ? 
`- 기본 질문에서 포착하지 못한 숨겨진 의도 발견
- 사용자의 진짜 목적과 배경 이해
- 더 구체적인 요구사항과 세부사항 파악` :
`- 실행과 구현 관점에서의 세부사항
- 품질과 완성도를 높이기 위한 최종 요소들
- 사용자의 최종 기대사항과 성공 지표`}

## 중복 방지 원칙
이전 질문과 키워드나 주제에서 절대 겹치지 않아야 합니다.
완전히 새로운 관점에서만 질문을 생성하세요.

## JSON 응답 형식
{
  "questions": [
    {
      "question": "완전히 다른 새로운 관점의 심층 질문",
      "type": "choice",
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}

중요: 한국어로만 응답하세요.`;
}

function getFinalImprovementPrompt(isExpertMode) {
    return `# 최종 프롬프트 완성 전문가

당신은 모든 정보를 종합하여 최고 품질의 프롬프트를 만드는 전문가입니다.

${KOREAN_ENFORCER}

## 절대 중요 규칙
- 원본 입력의 주제나 도메인을 절대 변경하지 마세요
- 사용자의 원본 의도를 100% 보존하면서 전문가급으로 개선하세요

## 목표 품질
${isExpertMode ? '전문가급 최고 품질 프롬프트 (95점 이상)' : '고품질 실용적 프롬프트 (85점 이상)'}

## 개선 방향
1. 명확성: 요구사항을 구체적으로 명시
2. 완성도: 필요한 모든 정보 포함
3. 실행가능성: AI가 정확히 수행할 수 있도록
4. 간결성: 불필요한 설명 제거, 핵심만 포함

## 금지사항
- 원본보다 4배 이상 길어지면 안 됩니다
- 과도한 감정 표현이나 배경 설명 금지 ("아름다운", "감동적인" 등)
- 불필요한 형용사나 수식어 남발 금지

## 응답 방법
최종 개선된 프롬프트만 제공하고, 절대로 설명이나 인사말을 하지 마세요.

중요: 한국어로만 응답하세요.`;
}

function getAutoImprovementPrompt() {
    return `# 자동 프롬프트 개선 전문가

당신은 프롬프트를 자동으로 90점 이상 수준으로 개선하는 전문가입니다.

${KOREAN_ENFORCER}

## 절대 규칙
- 원본 입력의 주제와 도메인 유지
- 구체적인 수치와 기술적 세부사항 추가
- 불필요한 감정 표현 제거

## 개선 방향
1. 더 구체적인 요구사항 추가 (수치, 크기, 색상 등)
2. 명확한 출력 형식 지정
3. 품질 향상을 위한 세부 조건 추가
4. 전문 용어와 기법 활용
5. 간결성 유지 (원본의 3배 이내)

## 응답 방법
개선된 프롬프트만 응답하세요.

중요: 한국어로만 응답하세요.`;
}

// ======================
// 프롬프트 구성 함수들  
// ======================

function buildInternalImprovementPrompt(userInput, questions, answers, round, previousImproved = '') {
    let prompt = `원본 사용자 입력: "${userInput}"\n\n** 절대 중요: 위 원본 입력의 주제와 도메인을 유지하세요 **\n\n`;
    
    if (previousImproved) {
        prompt += `이전 개선된 프롬프트: "${previousImproved}"\n\n`;
    }
    
    if (answers) {
        prompt += `사용자 답변:\n${formatAnswersForPrompt(answers)}\n\n`;
    }
    
    prompt += `${round}라운드 내부 개선을 진행하세요. 원본 입력의 주제와 도메인을 유지하면서 답변 정보를 반영하세요.`;
    
    return prompt;
}

function buildExpertQuestionPrompt(userInput, internalImprovedPrompt, round) {
    let prompt = `원본 사용자 입력: "${userInput}"\n\n** 절대 중요: 위 원본 입력의 주제와 도메인을 유지하세요 **\n\n`;
    
    if (internalImprovedPrompt) {
        prompt += `현재 개선된 상태: "${internalImprovedPrompt}"\n\n`;
    }
    
    prompt += `${round}라운드 심층 질문을 생성하세요. 이전 질문과 중복되지 않는 새로운 관점에서 질문하세요.`;
    
    return prompt;
}

function buildFinalImprovementPrompt(userInput, questions, answers, isExpertMode, internalImprovedPrompt = '') {
    let prompt = `원본 사용자 입력: "${userInput}"\n\n** 절대 중요: 위 원본 입력의 주제와 도메인을 유지하세요 **\n\n`;
    
    if (internalImprovedPrompt) {
        prompt += `내부 개선된 프롬프트: "${internalImprovedPrompt}"\n\n`;
    }
    
    if (answers) {
        prompt += `모든 사용자 답변:\n${formatAnswersForPrompt(answers)}\n\n`;
    }
    
    prompt += `위 정보를 모두 종합하여 ${isExpertMode ? '전문가급' : '고품질'} 최종 프롬프트를 생성하세요.`;
    
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
