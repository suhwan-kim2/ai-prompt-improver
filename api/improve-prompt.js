// api/improve-prompt.js - AI 대화형 프롬프트 개선기 (완전 새 버전)

const { slotSystem } = require('../utils/slotSystem');
const { evaluationSystem } = require('../utils/evaluationSystem');
const { intentAnalyzer } = require('../utils/intentAnalyzer');
const { mentionExtractor } = require('../utils/mentionExtractor');
const { questionOptimizer } = require('../utils/questionOptimizer');

// OpenAI API 설정
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// =============================================================================
// 🎯 메인 API 엔드포인트
// =============================================================================
module.exports = async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { 
            step, 
            userInput, 
            answers = [], 
            currentStep = 1, 
            mode = 'normal',
            targetScore = 95 
        } = req.body;
        
        console.log(`\n🚀 API 호출: ${step}, 단계: ${currentStep}, 모드: ${mode}`);
        
        // 단계별 라우팅
        switch (step) {
            case 'questions':
                return await handleQuestions(userInput, mode, res);
                
            case 'additional-questions':
                return await handleAdditionalQuestions(
                    userInput, answers, currentStep, mode, targetScore, res
                );
                
            case 'final-improve':
                return await handleFinalImprove(userInput, answers, currentStep, mode, res);
                
            default:
                return res.status(400).json({ 
                    error: '잘못된 단계',
                    validSteps: ['questions', 'additional-questions', 'final-improve']
                });
        }
        
    } catch (error) {
        console.error('❌ API 전체 오류:', error);
        return res.status(500).json({ 
            error: '서버 오류가 발생했습니다',
            message: error.message
        });
    }
}

// =============================================================================
// 🎯 1단계: 기본 질문 생성 (utils 연동)
// =============================================================================
async function handleQuestions(userInput, mode, res) {
    try {
        console.log('📝 1단계: 기본 질문 생성');
        
        const domainInfo = slotSystem.detectDomains(userInput);
        const mentionedInfo = mentionExtractor.extract(userInput);
        const intentAnalysis = intentAnalyzer.generateAnalysisReport(userInput);
        
        console.log('🔍 도메인:', domainInfo.primary);
        
        // utils에서 1단계 질문 생성
        const questions = slotSystem.generateStep1Questions(domainInfo, mentionedInfo);
        
        console.log('🔑 OpenAI API 키 존재:', !!OPENAI_API_KEY);
        console.log('🔑 API 키 앞 10글자:', OPENAI_API_KEY?.substring(0, 10));

        
        return res.status(200).json({
            questions: questions,
            question_type: "multiple_choice",
            domain: domainInfo.primary,
            currentStep: 1,
            maxSteps: mode === 'expert' ? 20 : 3,
            intentScore: intentAnalysis.intentScore,
            completed: false,
            message: `1단계: 기본 정보를 파악하겠습니다 (${domainInfo.primary} 도메인)`
        });
        
    } catch (error) {
        console.error('❌ 1단계 오류:', error);
        return res.status(500).json({ error: '1단계 질문 생성 실패' });
    }
}

// =============================================================================
// 🤖 2-20단계: AI 동적 질문 생성 (완전 새 버전)
// =============================================================================
async function handleAdditionalQuestions(userInput, answers, currentStep, mode, targetScore, res) {
    try {
        console.log(`🤖 ${currentStep}단계: AI 동적 질문 생성`);
        
        // 현재 상태 분석
        const domainInfo = slotSystem.detectDomains(userInput);
        const mentionedInfo = mentionExtractor.extract([userInput, ...answers].join(' '));
        const intentAnalysis = intentAnalyzer.generateAnalysisReport(userInput, answers);
        const currentScore = intentAnalysis.intentScore || 0;
        
        console.log(`📊 현재: ${currentScore}점/${targetScore}점`);
        
        // 종료 조건
        if (currentScore >= targetScore || currentStep >= 20) {
            const reason = currentScore >= targetScore ? '목표 달성' : '최대 단계';
            return res.status(200).json({
                questions: [],
                completed: true,
                currentStep: currentStep,
                intentScore: currentScore,
                shouldProceedToFinal: true,
                message: `🎉 ${reason}! 프롬프트 생성합니다 (${currentScore}점)`
            });
        }
        
        // 🤖 AI가 질문 생성
        const aiQuestions = await generateAIDynamicQuestions(
            userInput, answers, currentStep, domainInfo, intentAnalysis
        );
        
        if (!aiQuestions || aiQuestions.length === 0) {
            return res.status(200).json({
                questions: [],
                completed: true,
                currentStep: currentStep,
                intentScore: currentScore,
                shouldProceedToFinal: true,
                message: `AI 질문 생성 실패. 현재 정보로 진행합니다.`
            });
        }
        
        // 질문 최적화
        const optimized = questionOptimizer.optimize(aiQuestions, mentionedInfo, domainInfo, 5);
        
        return res.status(200).json({
            questions: optimized,
            question_type: "multiple_choice",
            currentStep: currentStep,
            maxSteps: mode === 'expert' ? 20 : 3,
            intentScore: currentScore,
            completed: false,
            shouldProceedToFinal: false,
            message: `🤖 ${currentStep}단계: AI 맞춤 질문 (${currentScore}점→${targetScore}점)`
        });
        
    } catch (error) {
        console.error(`❌ ${currentStep}단계 오류:`, error);
        return res.status(200).json({
            questions: [],
            completed: true,
            shouldProceedToFinal: true,
            message: `오류로 인해 현재 정보로 진행합니다.`
        });
    }
}

// =============================================================================
// 🎯 최종 프롬프트 생성 (AI 기반)
// =============================================================================
async function handleFinalImprove(userInput, answers, currentStep, mode, res) {
    try {
        console.log(`🎯 AI 최종 프롬프트 생성`);
        
        const domainInfo = slotSystem.detectDomains(userInput);
        const intentAnalysis = intentAnalyzer.generateAnalysisReport(userInput, answers);
        
        // AI가 완벽한 프롬프트 생성
        const improvedPrompt = await generateAIPerfectPrompt(
            userInput, answers, domainInfo, intentAnalysis
        );
        
        // 품질 평가
        const qualityScore = evaluationSystem?.evaluatePromptQuality?.(
            improvedPrompt, domainInfo.primary
        ) || 85;
        
        return res.status(200).json({
            improved: improvedPrompt,
            original: userInput,
            intentScore: intentAnalysis.intentScore,
            qualityScore: qualityScore,
            totalSteps: currentStep,
            domain: domainInfo.primary,
            completed: true
        });
        
    } catch (error) {
        console.error('❌ 최종 개선 오류:', error);
        
        const basicPrompt = `${userInput} (${answers.join(', ')}) - 고품질, 전문적`;
        return res.status(200).json({
            improved: basicPrompt,
            original: userInput,
            intentScore: 80,
            qualityScore: 75,
            completed: true
        });
    }
}

// =============================================================================
// 🤖 AI 동적 질문 생성 (디버깅 버전)
// =============================================================================
async function generateAIDynamicQuestions(userInput, answers, currentStep, domainInfo, intentAnalysis) {
    console.log('🤖 AI 질문 생성 시작 - 디버깅 모드');
    console.log('🔑 API 키 존재:', !!OPENAI_API_KEY);
    console.log('📝 입력 데이터:', { userInput, answers, currentStep });
    
    try {
        // 🔑 API 키 체크
        if (!OPENAI_API_KEY) {
            console.log('⚠️ OpenAI API 키 없음 - 테스트 질문 반환');
            return generateTestQuestions(userInput, answers, currentStep);
        }
        
        console.log('🔑 API 키 앞 10글자:', OPENAI_API_KEY.substring(0, 10));
        
        const domain = domainInfo.primary;
        const currentScore = intentAnalysis.intentScore;
        
        console.log('🎯 AI 요청 준비:', { domain, currentScore });
        
        // 간단한 AI 프롬프트 (테스트용)
        const aiPrompt = `
사용자가 "${userInput}"라고 요청했고, 지금까지 "${answers.join(', ')}"라고 답변했습니다.

현재 의도 파악 점수: ${currentScore}점 (목표: 95점)

더 구체적인 정보를 얻기 위한 한국어 질문 3개를 JSON 형식으로 만들어주세요:

[
  {
    "question": "질문 내용",
    "options": ["선택지1", "선택지2", "선택지3", "기타"]
  }
]
`;

        console.log('🤖 OpenAI API 호출 중...');
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo', // 더 안정적인 모델
                messages: [
                    { role: 'user', content: aiPrompt }
                ],
                temperature: 0.7,
                max_tokens: 800
            })
        });

        console.log('📡 OpenAI 응답 상태:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ OpenAI API 오류:', response.status, errorText);
            throw new Error(`OpenAI API 오류: ${response.status}`);
        }

        const data = await response.json();
        console.log('📨 OpenAI 원본 응답:', data);

        let generatedQuestions;
        try {
            generatedQuestions = JSON.parse(data.choices[0].message.content);
            console.log('✅ JSON 파싱 성공:', generatedQuestions);
        } catch (parseError) {
            console.log('⚠️ JSON 파싱 실패, 텍스트 파싱 시도');
            generatedQuestions = parseTextToQuestions(data.choices[0].message.content);
        }
        
        return generatedQuestions;
        
    } catch (error) {
        console.error('❌ AI 질문 생성 완전 실패:', error);
        console.error('❌ 오류 상세:', error.message);
        
        // 테스트 질문 반환
        return generateTestQuestions(userInput, answers, currentStep);
    }
}

// =============================================================================
// 🔧 테스트 및 폴백 함수들
// =============================================================================

// API 없이도 테스트할 수 있는 질문들
function generateTestQuestions(userInput, answers, currentStep) {
    console.log('🔧 테스트 질문 생성 중...');
    
    const testQuestions = [
        {
            question: "강아지의 구체적인 품종이나 특징이 있나요?",
            options: ["골든리트리버", "포메라니안", "진돗개", "비글", "믹스견", "기타"]
        },
        {
            question: "어떤 표정이나 감정을 표현하고 싶나요?",
            options: ["행복한 미소", "호기심 가득", "차분하고 온순", "장난스러운", "졸린 표정", "기타"]
        },
        {
            question: "강아지의 포즈나 자세는 어떻게 할까요?",
            options: ["앉아있는 자세", "누워있는 자세", "서있는 자세", "뛰어가는 모습", "장난치는 모습", "기타"]
        },
        {
            question: "배경이나 주변 환경을 더 자세히 설명해주세요",
            options: ["거실 소파", "야외 정원", "스튜디오", "자연 풍경", "단색 배경", "기타"]
        },
        {
            question: "조명이나 분위기는 어떻게 설정할까요?",
            options: ["밝고 화사한", "부드럽고 따뜻한", "자연스러운", "드라마틱한", "스튜디오 조명", "기타"]
        }
    ];
    
    // 현재 단계에 맞는 질문 선택
    const startIndex = Math.max(0, currentStep - 2);
    const selectedQuestions = testQuestions.slice(startIndex, startIndex + 3);
    
    console.log(`✅ ${currentStep}단계 테스트 질문 ${selectedQuestions.length}개 생성`);
    return selectedQuestions;
}

// 텍스트를 질문으로 파싱
function parseTextToQuestions(text) {
    console.log('🔧 텍스트 파싱 시도:', text);
    
    try {
        const questions = [];
        const lines = text.split('\n').filter(line => line.includes('?'));
        
        lines.slice(0, 3).forEach(line => {
            const question = line.replace(/^\d+\.|\*|-/, '').trim();
            if (question.length > 10) {
                questions.push({
                    question: question,
                    options: ["네", "아니오", "조금", "많이", "상관없음", "기타"]
                });
            }
        });
        
        return questions.length > 0 ? questions : generateTestQuestions('', [], 2);
        
    } catch (error) {
        console.error('텍스트 파싱 실패:', error);
        return generateTestQuestions('', [], 2);
    }
}
// =============================================================================
// 🤖 AI 완벽 프롬프트 생성 (OpenAI API)
// =============================================================================
async function generateAIPerfectPrompt(userInput, answers, domainInfo, intentAnalysis) {
    try {
        if (!OPENAI_API_KEY) {
            return generateBasicPrompt(userInput, answers, domainInfo);
        }
        
        const domain = domainInfo.primary;
        
        const perfectPrompt = `
당신은 ${domain} 전문가입니다.

원본: "${userInput}"
대화 내용: ${answers.join(' | ')}
의도 점수: ${intentAnalysis.intentScore}점

임무: AI가 100% 이해할 수 있는 완벽한 프롬프트 생성

${domain === 'visual_design' ? '이미지 생성 AI 최적화 형태로 만들어주세요.' : ''}

최종 프롬프트만 출력:
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: `${domain} 분야 전문가로서 완벽한 프롬프트를 생성합니다.` },
                    { role: 'user', content: perfectPrompt }
                ],
                temperature: 0.7,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI 오류: ${response.status}`);
        }

        const data = await response.json();
        const result = data.choices[0].message.content.trim();
        
        console.log('🎉 AI 완벽 프롬프트 생성 완료');
        return result;
        
    } catch (error) {
        console.error('❌ AI 프롬프트 생성 실패:', error);
        return generateBasicPrompt(userInput, answers, domainInfo);
    }
}

// =============================================================================
// 🔧 폴백 함수들
// =============================================================================
function generateBasicPrompt(userInput, answers, domainInfo) {
    const domain = domainInfo.primary;
    const goodAnswers = answers.filter(a => a && a !== '기타' && a !== '상관없음');
    
    if (domain === 'visual_design') {
        let prompt = userInput;
        if (goodAnswers.length > 0) {
            prompt += `, ${goodAnswers.join(', ')}`;
        }
        prompt += ', high quality, detailed, professional, 4K resolution --no blurry, low quality';
        return prompt;
    }
    
    return `${userInput} (${goodAnswers.join(', ')}) - 전문적이고 고품질로`;
}

function generateFallbackQuestions(step) {
    return [
        {
            question: "더 구체적으로 어떤 특징을 원하시나요?",
            options: ["매우 상세하게", "적당히", "간단하게", "상관없음", "기타"]
        },
        {
            question: "특별히 피하고 싶은 요소가 있나요?",
            options: ["복잡한 것", "단순한 것", "특정 색상", "없음", "기타"]
        }
    ];
}
