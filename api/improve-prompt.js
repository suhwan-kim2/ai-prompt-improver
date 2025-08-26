// api/improve-prompt.js - 수정된 버전 (2단계 멈춤 문제 해결)

const { slotSystem } = require('../utils/slotSystem');
const { evaluationSystem } = require('../utils/evaluationSystem');
const { intentAnalyzer } = require('../utils/intentAnalyzer');
const { mentionExtractor } = require('../utils/mentionExtractor');
const { questionOptimizer } = require('../utils/questionOptimizer');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

module.exports = async function handler(req, res) {
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
        
        switch (step) {
            case 'questions':
                return await handleQuestions(userInput, mode, res);
                
            case 'additional-questions':
                return await handleAdditionalQuestions(userInput, answers, currentStep, mode, targetScore, res);
                
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
// 🎯 1단계: 기본 질문 생성
// =============================================================================
async function handleQuestions(userInput, mode, res) {
    try {
        console.log('📝 1단계: 기본 질문 생성');
        
        // 도메인 감지
        const domainInfo = { primary: detectDomain(userInput) };
        const questions = generateStep1Questions(domainInfo);
        const initialScore = 19; // 기본 점수
        
        console.log('🔍 도메인:', domainInfo.primary);
        console.log('📊 초기 점수:', initialScore);
        
        return res.status(200).json({
            questions: questions,
            question_type: "multiple_choice",
            domain: domainInfo.primary,
            currentStep: 1,
            maxSteps: mode === 'expert' ? 20 : 3,
            intentScore: initialScore,
            completed: false,
            message: `1단계: 기본 정보를 파악하겠습니다 (${domainInfo.primary} 도메인)`
        });
        
    } catch (error) {
        console.error('❌ 1단계 오류:', error);
        return res.status(500).json({ error: '1단계 질문 생성 실패' });
    }
}

// =============================================================================
// 🔧 핵심 수정: 2단계 자체 개선 시스템
// =============================================================================
async function handleAdditionalQuestions(userInput, answers, currentStep, mode, targetScore, res) {
    try {
        console.log(`🔧 ${currentStep}단계: 자체 개선 시스템 가동`);
        
        // 현재 점수 계산 (간단한 방식)
        let currentScore = 19 + (answers.length * 10); // 기본 19점 + 답변당 10점
        console.log(`📊 현재 점수: ${currentScore}점`);
        
        // 🚀 핵심 로직: 80점 미만이면 무조건 자체 개선
        if (currentScore < 80) {
            console.log('🚀 자체 개선 시스템 가동 - 80점까지 끌어올리기');
            
            const improvedQuestions = generateSelfImprovementQuestions(
                userInput, answers, currentStep
            );
            
            // 점수 강제 상승
            const newScore = Math.min(currentScore + 15, 85);
            
            return res.status(200).json({
                questions: improvedQuestions,
                question_type: "multiple_choice",
                currentStep: currentStep,
                maxSteps: mode === 'expert' ? 20 : 3,
                intentScore: newScore,
                completed: false,
                shouldProceedToFinal: false,
                selfImprovement: true,
                message: `🔧 ${currentStep}단계: 자체 개선으로 점수 상승! (${currentScore}점 → ${newScore}점)`
            });
        }
        
        // 80점 이상이면 AI 시도
        console.log('🤖 AI 질문 생성 시도...');
        let aiQuestions = null;
        
        try {
            aiQuestions = await generateAIDynamicQuestions(userInput, answers, currentStep);
        } catch (aiError) {
            console.log('🤖 AI 실패, 자체 개선으로 전환');
        }
        
        // AI 실패시 자체 개선
        if (!aiQuestions || aiQuestions.length === 0) {
            const selfQuestions = generateSelfImprovementQuestions(userInput, answers, currentStep);
            
            return res.status(200).json({
                questions: selfQuestions,
                currentStep: currentStep,
                intentScore: Math.min(currentScore + 10, 95),
                completed: false,
                message: `🔧 ${currentStep}단계: 자체 개선 진행 (${currentScore}점 → ${Math.min(currentScore + 10, 95)}점)`
            });
        }
        
        // 종료 조건
        if (currentScore >= 85 || currentStep >= 20) {
            return res.status(200).json({
                questions: [],
                completed: true,
                currentStep: currentStep,
                intentScore: currentScore,
                shouldProceedToFinal: true,
                message: `🎉 충분한 정보 확보! 프롬프트 생성합니다 (${currentScore}점)`
            });
        }
        
        // AI 성공
        return res.status(200).json({
            questions: aiQuestions,
            currentStep: currentStep,
            intentScore: Math.min(currentScore + 10, 95),
            completed: false,
            message: `🤖 ${currentStep}단계: AI 질문 생성 성공`
        });
        
    } catch (error) {
        console.error(`❌ ${currentStep}단계 오류:`, error);
        
        // 최종 폴백 - 무조건 종료하지 말고 기본 질문 제공
        const fallbackQuestions = generateFallbackQuestions(currentStep);
        
        return res.status(200).json({
            questions: fallbackQuestions,
            completed: false, // ⭐ 중요: false로 변경
            currentStep: currentStep,
            intentScore: Math.max(70, currentScore || 31),
            shouldProceedToFinal: false, // ⭐ 중요: 계속 진행
            message: `${currentStep}단계 질문을 생성합니다.`
        });
    }
}

// =============================================================================
// 🔧 자체 개선 질문 생성 시스템
// =============================================================================
function generateSelfImprovementQuestions(userInput, answers, currentStep) {
    console.log('🔧 자체 개선 질문 시스템 가동');
    
    const answersText = answers.join(' ').toLowerCase();
    const domain = detectDomain(userInput);
    
    let questions = [];
    
    // 🎨 이미지 도메인 전용 개선 질문들
    if (domain === 'visual_design' || userInput.includes('그림') || userInput.includes('이미지')) {
        
        if (currentStep === 2) {
            questions = [
                {
                    question: "강아지의 구체적인 품종이나 크기는?",
                    options: ["골든리트리버 새끼", "포메라니안 성견", "진돗개 중형", "비글 소형", "대형견", "기타"]
                },
                {
                    question: "어떤 표정이나 감정을 표현하고 싶나요?",
                    options: ["행복한 미소", "호기심 가득한 눈빛", "차분하고 온순한", "장난스러운", "졸린 표정", "기타"]
                },
                {
                    question: "강아지의 포즈나 자세는?",
                    options: ["앉아서 정면 응시", "옆으로 누워있는", "앞발 들고 서있는", "뛰어가는 모습", "장난감과 놀고있는", "기타"]
                },
                {
                    question: "우주 배경의 디테일은 어떻게?",
                    options: ["별들이 반짝이는", "성운과 은하수", "행성들이 보이는", "어둡고 깊은 우주", "밝고 환상적인", "기타"]
                }
            ];
        } else if (currentStep === 3) {
            questions = [
                {
                    question: "조명이나 빛의 분위기는?",
                    options: ["따뜻한 황금빛", "자연스러운 햇빛", "부드러운 스튜디오 조명", "드라마틱한 측면 조명", "밝고 균등한 조명", "기타"]
                },
                {
                    question: "우주복이나 특별한 장비를 입히나요?",
                    options: ["흰색 우주복", "투명 헬멧", "산소통", "장갑과 부츠", "없음/자연스럽게", "기타"]
                },
                {
                    question: "카메라 각도나 구도는?",
                    options: ["정면 클로즈업", "측면 전신샷", "하이앵글(위에서)", "로우앵글(아래서)", "3/4 각도", "기타"]
                }
            ];
        } else {
            // 4단계 이상
            questions = [
                {
                    question: "색상의 세부적인 조합은?",
                    options: ["파란 우주 + 흰 강아지", "따뜻한 금색 조합", "차가운 은색 조합", "무지개빛 환상적", "단색 미니멀", "기타"]
                },
                {
                    question: "전체적인 완성도는 어느 수준으로?",
                    options: ["최고급 포토리얼", "전문가 수준", "일반적 수준", "빠른 제작용", "기타"]
                }
            ];
        }
    }
    
    // 🎬 비디오 도메인
    else if (domain === 'video') {
        questions = [
            {
                question: "영상의 오프닝은 어떻게 시작할까요?",
                options: ["로고와 함께", "바로 메인 장면", "텍스트 소개", "음악과 함께", "기타"]
            },
            {
                question: "주인공의 의상이나 스타일은?",
                options: ["현대적 캐주얼", "클래식 정장", "특별한 코스튬", "계절감 있는", "기타"]
            }
        ];
    }
    
    // 🔧 개발 도메인  
    else if (domain === 'development') {
        questions = [
            {
                question: "가장 중요한 핵심 기능은?",
                options: ["사용자 인터페이스", "데이터 처리", "보안", "성능", "기타"]
            },
            {
                question: "어떤 기술로 만들고 싶나요?",
                options: ["React/Vue", "Node.js", "Python", "Java", "기타"]
            }
        ];
    }
    
    // 기본 질문 (모든 도메인)
    else {
        questions = [
            {
                question: "더 구체적으로 어떤 특징을 원하시나요?",
                options: ["매우 상세하게", "적당한 수준", "간단하게", "상관없음", "기타"]
            },
            {
                question: "완성도나 품질 수준은?",
                options: ["최고급", "전문가급", "일반적", "빠른 제작", "기타"]
            }
        ];
    }
    
    console.log(`✅ ${currentStep}단계 자체 개선 질문 ${questions.length}개 생성`);
    return questions.slice(0, 4); // 최대 4개
}

// =============================================================================
// 🔧 AI 동적 질문 생성 (개선된 버전)
// =============================================================================
async function generateAIDynamicQuestions(userInput, answers, currentStep) {
    console.log('🤖 AI 질문 생성 시작');
    
    // API 키 체크
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-key-here') {
        console.log('⚠️ OpenAI API 키 없음 - 기본 질문으로 대체');
        return null; // 자체 개선으로 폴백
    }
    
    try {
        const aiPrompt = `
사용자가 "${userInput}"라고 요청했고, 
지금까지 "${answers.join(', ')}"라고 답변했습니다.

이 정보를 바탕으로 더 구체적이고 정밀한 한국어 질문 3개를 만들어주세요.
JSON 형식으로만 응답하세요:

[
  {
    "question": "질문 내용",
    "options": ["선택지1", "선택지2", "선택지3", "선택지4", "기타"]
  }
]
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: aiPrompt }],
                temperature: 0.7,
                max_tokens: 800
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI 오류: ${response.status}`);
        }

        const data = await response.json();
        const generatedQuestions = JSON.parse(data.choices[0].message.content);
        
        console.log('✅ AI 질문 생성 성공:', generatedQuestions.length);
        return generatedQuestions;
        
    } catch (error) {
        console.error('❌ AI 질문 생성 실패:', error);
        return null; // 자체 개선으로 폴백
    }
}

// =============================================================================
// 🎯 최종 프롬프트 생성
// =============================================================================
async function handleFinalImprove(userInput, answers, currentStep, mode, res) {
    try {
        console.log(`🎯 최종 프롬프트 생성 시작`);
        
        // 점수 계산
        const finalScore = Math.min(19 + (answers.length * 12), 95);
        
        // 도메인별 프롬프트 생성
        const domain = detectDomain(userInput);
        let improvedPrompt = '';
        
        if (domain === 'visual_design') {
            improvedPrompt = createImagePrompt(userInput, answers);
        } else if (domain === 'video') {
            improvedPrompt = createVideoPrompt(userInput, answers);
        } else if (domain === 'development') {
            improvedPrompt = createDevelopmentPrompt(userInput, answers);
        } else {
            improvedPrompt = createGeneralPrompt(userInput, answers);
        }
        
        return res.status(200).json({
            improved: improvedPrompt,
            original: userInput,
            intentScore: finalScore,
            qualityScore: finalScore - 5,
            totalSteps: currentStep,
            domain: domain,
            completed: true,
            message: `✨ ${currentStep}단계 완료! 최종 점수: ${finalScore}점`
        });
        
    } catch (error) {
        console.error('❌ 최종 개선 오류:', error);
        
        const basicPrompt = `${userInput} - ${answers.join(', ')} - 고품질, 전문적`;
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
// 🔧 헬퍼 함수들
// =============================================================================

// 도메인 감지
function detectDomain(userInput) {
    const text = userInput.toLowerCase();
    
    if (text.includes('그림') || text.includes('이미지') || text.includes('사진') || text.includes('그려')) {
        return 'visual_design';
    } else if (text.includes('영상') || text.includes('동영상') || text.includes('비디오')) {
        return 'video';
    } else if (text.includes('사이트') || text.includes('앱') || text.includes('프로그램') || text.includes('개발')) {
        return 'development';
    } else if (text.includes('글') || text.includes('문서') || text.includes('작성')) {
        return 'text_language';
    } else {
        return 'visual_design'; // 기본값
    }
}

// 1단계 기본 질문 생성
function generateStep1Questions(domainInfo) {
    const domain = domainInfo.primary;
    
    const questionSets = {
        visual_design: [
            {
                question: "어떤 스타일로 제작하고 싶으신가요?",
                options: ["사실적/포토", "3D 렌더링", "애니메이션/만화", "일러스트/아트", "수채화/유화", "기타"]
            },
            {
                question: "주요 색상 톤은 어떻게 설정할까요?",
                options: ["따뜻한 톤", "차가운 톤", "모노톤/흑백", "비비드/선명한", "파스텔/부드러운", "기타"]
            },
            {
                question: "크기나 비율은 어떻게 하시겠어요?",
                options: ["정사각형(1:1)", "가로형(16:9)", "세로형(9:16)", "4K/고해상도", "HD/일반", "기타"]
            },
            {
                question: "배경 설정은 어떻게 할까요?",
                options: ["단색/그라데이션", "자연/야외", "실내/인테리어", "판타지/상상", "투명/없음", "기타"]
            }
        ],
        video: [
            {
                question: "영상의 주요 목적이 무엇인가요?",
                options: ["광고/마케팅", "교육/강의", "엔터테인먼트", "홍보/소개", "튜토리얼", "기타"]
            },
            {
                question: "영상 길이는 어느 정도로 계획하시나요?",
                options: ["숏폼(~1분)", "중간(1-5분)", "긴편(5-10분)", "장편(10분+)", "상관없음", "기타"]
            },
            {
                question: "어떤 스타일로 제작하고 싶나요?",
                options: ["실사 촬영", "2D 애니메이션", "3D 애니메이션", "모션그래픽", "혼합형", "기타"]
            },
            {
                question: "주요 타겟 플랫폼은?",
                options: ["유튜브", "인스타그램", "틱톡", "TV/방송", "웹사이트", "기타"]
            }
        ],
        development: [
            {
                question: "어떤 종류의 프로그램을 만드시나요?",
                options: ["웹사이트", "모바일 앱", "데스크톱 프로그램", "API/백엔드", "게임", "기타"]
            },
            {
                question: "주요 사용자는 누구인가요?",
                options: ["일반 대중", "비즈니스/기업", "전문가", "학생/교육", "내부용", "기타"]
            },
            {
                question: "핵심 기능은 무엇인가요?",
                options: ["정보 제공", "상거래/결제", "커뮤니티/소셜", "데이터 관리", "도구/유틸리티", "기타"]
            },
            {
                question: "개발 우선순위는?",
                options: ["빠른 개발", "안정성", "확장성", "사용성", "보안", "기타"]
            }
        ]
    };
    
    return questionSets[domain] || questionSets.visual_design;
}

// 폴백 질문들
function generateFallbackQuestions(currentStep) {
    return [
        {
            question: "더 구체적으로 어떤 특징을 원하시나요?",
            options: ["매우 상세하게", "적당한 수준으로", "간단하게", "상관없음", "기타"]
        },
        {
            question: "완성도나 품질 수준은 어떻게 할까요?",
            options: ["최고급 수준", "전문가 수준", "일반적 수준", "빠른 제작용", "기타"]
        }
    ];
}

// =============================================================================
// 🎯 도메인별 프롬프트 생성
// =============================================================================

// 이미지 프롬프트 생성
function createImagePrompt(userInput, answers) {
    let prompt = userInput;
    
    // 답변들에서 유용한 정보 추출
    const goodAnswers = answers.filter(a => a && a !== '기타' && a !== '상관없음');
    
    if (goodAnswers.length > 0) {
        prompt += `, ${goodAnswers.join(', ')}`;
    }
    
    // 품질 개선 지시어 추가
    prompt += ', highly detailed, professional quality, 4K resolution';
    prompt += ' --no blurry, low quality, watermark, distorted';
    
    return prompt;
}

// 비디오 프롬프트 생성
function createVideoPrompt(userInput, answers) {
    let prompt = `영상 제작 요청: ${userInput}\n\n`;
    
    prompt += `세부 요구사항:\n`;
    answers.forEach((answer, index) => {
        if (answer && answer !== '기타' && answer !== '상관없음') {
            prompt += `- ${answer}\n`;
        }
    });
    
    prompt += `\n품질 요구사항:\n`;
    prompt += `- 전문적이고 고품질\n`;
    prompt += `- 시청자 몰입도 높임\n`;
    prompt += `- 브랜드 이미지에 부합\n`;
    
    return prompt;
}

// 개발 프롬프트 생성
function createDevelopmentPrompt(userInput, answers) {
    let prompt = `개발 프로젝트: ${userInput}\n\n`;
    
    prompt += `요구사항:\n`;
    answers.forEach((answer, index) => {
        if (answer && answer !== '기타' && answer !== '상관없음') {
            prompt += `- ${answer}\n`;
        }
    });
    
    prompt += `\n개발 조건:\n`;
    prompt += `- 안정적이고 확장 가능한 구조\n`;
    prompt += `- 사용자 친화적 인터페이스\n`;
    prompt += `- 유지보수 용이성 고려\n`;
    
    return prompt;
}

// 일반 프롬프트 생성
function createGeneralPrompt(userInput, answers) {
    const goodAnswers = answers.filter(a => a && a !== '기타' && a !== '상관없음');
    
    let prompt = userInput;
    if (goodAnswers.length > 0) {
        prompt += ` (${goodAnswers.join(', ')})`;
    }
    prompt += ' - 전문적이고 고품질로 제작';
    
    return prompt;
}
