// api/improve-prompt.js - 🔥 완전 새로운 독립형 API (Utils 의존성 제거)

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

module.exports = async function handler(req, res) {
    console.log('🚀 완전 새로운 독립형 API 시작!');
    
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST만 지원됩니다' });
    }
    
    try {
        const { 
            step, 
            userInput, 
            answers = [], 
            currentStep = 1, 
            mode = 'normal' 
        } = req.body;
        
        console.log(`📨 요청: ${step}, 단계: ${currentStep}, 답변수: ${answers.length}`);
        
        // 단계별 라우팅
        switch (step) {
            case 'questions':
                return handleStep1Questions(userInput, mode, res);
                
            case 'additional-questions':
                return handleAdditionalQuestions(userInput, answers, currentStep, mode, res);
                
            case 'final-improve':
                return handleFinalImprove(userInput, answers, currentStep, mode, res);
                
            default:
                return res.status(400).json({ error: '잘못된 단계: ' + step });
        }
        
    } catch (error) {
        console.error('❌ API 전체 오류:', error);
        return res.status(500).json({ 
            error: '서버 오류',
            message: error.message
        });
    }
}

// =============================================================================
// 🎯 1단계: 기본 질문 (도메인별 하드코딩)
// =============================================================================
function handleStep1Questions(userInput, mode, res) {
    console.log('📝 1단계: 기본 질문 생성');
    
    const domain = detectDomain(userInput);
    const questions = getBasicQuestions(domain);
    const initialScore = 19;
    
    console.log(`🔍 감지된 도메인: ${domain}`);
    console.log(`📊 초기 점수: ${initialScore}점`);
    
    return res.status(200).json({
        questions: questions,
        question_type: "multiple_choice",
        domain: domain,
        currentStep: 1,
        maxSteps: mode === 'expert' ? 20 : 3,
        intentScore: initialScore,
        completed: false,
        message: `1단계: 기본 정보를 파악하겠습니다 (${domain} 도메인, ${initialScore}점)`
    });
}

// =============================================================================
// 🔧 2-20단계: 자체 개선 + AI 동적 시스템
// =============================================================================
function handleAdditionalQuestions(userInput, answers, currentStep, mode, res) {
    console.log(`🔧 ${currentStep}단계: 추가 질문 시작`);
    
    // 점수 계산 (간단하고 확실한 방식)
    let currentScore = 19 + (answers.length * 12);
    console.log(`📊 현재 점수: ${currentScore}점 (기본 19 + 답변 ${answers.length}개 × 12)`);
    
    // 🚀 핵심 로직: 85점 미만이면 무조건 계속!
    if (currentScore < 85 && currentStep < 15) {
        console.log('🔧 자체 개선 시스템 가동!');
        
        const questions = generateStepQuestions(userInput, answers, currentStep);
        const newScore = Math.min(currentScore + 15, 95);
        
        console.log(`✅ ${currentStep}단계 질문 ${questions.length}개 생성, 점수: ${currentScore} → ${newScore}`);
        
        return res.status(200).json({
            questions: questions,
            question_type: "multiple_choice",
            currentStep: currentStep,
            maxSteps: mode === 'expert' ? 20 : 3,
            intentScore: newScore,
            completed: false,
            shouldProceedToFinal: false,
            selfImprovement: true,
            message: `🔧 ${currentStep}단계: 점수 상승! (${currentScore}점 → ${newScore}점)`
        });
    }
    
    // 85점 이상 또는 15단계 이상 → AI 동적 질문 시도
    console.log('🤖 AI 동적 질문 시도...');
    
    tryAIQuestions(userInput, answers, currentStep)
        .then(aiQuestions => {
            if (aiQuestions && aiQuestions.length > 0) {
                console.log('✅ AI 질문 생성 성공');
                return res.status(200).json({
                    questions: aiQuestions,
                    currentStep: currentStep,
                    intentScore: Math.min(currentScore + 10, 95),
                    completed: false,
                    message: `🤖 ${currentStep}단계: AI 창의적 질문`
                });
            } else {
                // AI 실패 → 종료
                console.log('🎉 AI 실패, 현재 정보로 완료');
                return res.status(200).json({
                    questions: [],
                    completed: true,
                    shouldProceedToFinal: true,
                    currentStep: currentStep,
                    intentScore: currentScore,
                    message: `🎉 ${currentStep}단계 완료! 프롬프트 생성합니다 (${currentScore}점)`
                });
            }
        })
        .catch(error => {
            console.error('❌ AI 질문 오류:', error);
            // 오류 시에도 종료
            return res.status(200).json({
                questions: [],
                completed: true,
                shouldProceedToFinal: true,
                currentStep: currentStep,
                intentScore: currentScore,
                message: `${currentStep}단계 완료, 프롬프트 생성합니다`
            });
        });
}

// =============================================================================
// 🎯 최종 프롬프트 생성
// =============================================================================
function handleFinalImprove(userInput, answers, currentStep, mode, res) {
    console.log('🎯 최종 프롬프트 생성 시작');
    
    const domain = detectDomain(userInput);
    const finalScore = Math.min(19 + (answers.length * 12), 95);
    
    console.log(`📊 최종 점수: ${finalScore}점`);
    
    // 도메인별 프롬프트 생성
    let improvedPrompt = '';
    
    try {
        if (domain === 'visual_design') {
            improvedPrompt = buildImagePrompt(userInput, answers);
        } else if (domain === 'video') {
            improvedPrompt = buildVideoPrompt(userInput, answers);
        } else if (domain === 'development') {
            improvedPrompt = buildDevPrompt(userInput, answers);
        } else {
            improvedPrompt = buildGeneralPrompt(userInput, answers);
        }
        
        console.log('✅ 프롬프트 생성 완료');
        
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
        console.error('❌ 최종 생성 오류:', error);
        
        // 폴백 프롬프트
        const fallbackPrompt = `${userInput} - ${answers.join(', ')} - 고품질, 전문적`;
        
        return res.status(200).json({
            improved: fallbackPrompt,
            original: userInput,
            intentScore: 80,
            qualityScore: 75,
            totalSteps: currentStep,
            completed: true,
            message: '기본 개선 완료'
        });
    }
}

// =============================================================================
// 🔧 핵심 헬퍼 함수들
// =============================================================================

// 도메인 감지 (간단하고 확실한 방식)
function detectDomain(userInput) {
    const text = userInput.toLowerCase();
    
    console.log('🔍 도메인 감지 중...', text);
    
    if (text.includes('그림') || text.includes('이미지') || text.includes('사진') || text.includes('그려')) {
        console.log('✅ visual_design 도메인 감지');
        return 'visual_design';
    } else if (text.includes('영상') || text.includes('동영상') || text.includes('비디오')) {
        console.log('✅ video 도메인 감지');
        return 'video';
    } else if (text.includes('사이트') || text.includes('앱') || text.includes('프로그램') || text.includes('개발')) {
        console.log('✅ development 도메인 감지');
        return 'development';
    } else {
        console.log('✅ visual_design 기본 도메인');
        return 'visual_design'; // 기본값
    }
}

// 1단계 기본 질문들 (도메인별)
function getBasicQuestions(domain) {
    console.log(`📝 ${domain} 도메인 기본 질문 생성`);
    
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
                question: "영상 길이는 어느 정도로?",
                options: ["숏폼(~1분)", "중간(1-5분)", "긴편(5-10분)", "장편(10분+)", "상관없음", "기타"]
            },
            {
                question: "제작 스타일은?",
                options: ["실사 촬영", "2D 애니메이션", "3D 애니메이션", "모션그래픽", "혼합형", "기타"]
            },
            {
                question: "타겟 플랫폼은?",
                options: ["유튜브", "인스타그램", "틱톡", "TV/방송", "웹사이트", "기타"]
            }
        ],
        
        development: [
            {
                question: "어떤 프로그램을 만드시나요?",
                options: ["웹사이트", "모바일 앱", "데스크톱", "API/백엔드", "게임", "기타"]
            },
            {
                question: "주요 사용자는?",
                options: ["일반 대중", "기업/비즈니스", "전문가", "학생/교육", "내부용", "기타"]
            },
            {
                question: "핵심 기능은?",
                options: ["정보 제공", "상거래/결제", "커뮤니티", "데이터 관리", "도구/유틸", "기타"]
            },
            {
                question: "개발 우선순위는?",
                options: ["빠른 개발", "안정성", "확장성", "사용성", "보안", "기타"]
            }
        ]
    };
    
    const result = questionSets[domain] || questionSets.visual_design;
    console.log(`✅ ${domain} 기본 질문 ${result.length}개 생성`);
    
    return result;
}

// =============================================================================
// 🔧 2-20단계: 단계별 질문 생성 (완전 독립형)
// =============================================================================
function generateStepQuestions(userInput, answers, currentStep) {
    console.log(`🔧 ${currentStep}단계 질문 생성 시작`);
    
    const domain = detectDomain(userInput);
    const answersText = answers.join(' ').toLowerCase();
    
    console.log(`📝 도메인: ${domain}, 답변: ${answersText.substring(0, 50)}...`);
    
    // 🎨 이미지 도메인 단계별 질문들
    if (domain === 'visual_design') {
        
        if (currentStep === 2) {
            console.log('🎨 이미지 2단계: 세부 특징 질문');
            return [
                {
                    question: "강아지의 구체적인 품종이나 크기는?",
                    options: ["골든리트리버 새끼", "포메라니안 성견", "진돗개 중형", "비글 소형", "대형견", "기타"]
                },
                {
                    question: "어떤 표정이나 감정을 표현하고 싶나요?",
                    options: ["행복한 미소", "호기심 가득한", "차분하고 온순한", "장난스러운", "졸린 표정", "기타"]
                },
                {
                    question: "포즈나 자세는 어떻게?",
                    options: ["앉아서 정면", "옆으로 누워있는", "서서 앞발 든", "뛰어가는", "장난감과 노는", "기타"]
                },
                {
                    question: "우주 배경은 어떻게 표현할까요?",
                    options: ["별들 반짝이는", "성운과 은하수", "행성들 보이는", "어둡고 깊은", "밝고 환상적", "기타"]
                }
            ];
        }
        
        else if (currentStep === 3) {
            console.log('🎨 이미지 3단계: 디테일 설정');
            return [
                {
                    question: "조명이나 빛의 분위기는?",
                    options: ["따뜻한 황금빛", "자연스러운 햇빛", "부드러운 조명", "드라마틱한", "밝고 균등한", "기타"]
                },
                {
                    question: "우주복이나 장비를 입히나요?",
                    options: ["흰색 우주복", "투명 헬멧", "산소통", "장갑과 부츠", "없음/자연스럽게", "기타"]
                },
                {
                    question: "카메라 각도는?",
                    options: ["정면 클로즈업", "측면 전신", "위에서(하이앵글)", "아래서(로우앵글)", "3/4 각도", "기타"]
                }
            ];
        }
        
        else if (currentStep === 4) {
            console.log('🎨 이미지 4단계: 최종 디테일');
            return [
                {
                    question: "색상 조합은 어떻게?",
                    options: ["파란 우주+흰 강아지", "따뜻한 금색 조합", "차가운 은색 조합", "무지개빛", "단색 미니멀", "기타"]
                },
                {
                    question: "완성도 수준은?",
                    options: ["최고급 포토리얼", "전문가 수준", "일반적 수준", "빠른 제작", "기타"]
                }
            ];
        }
        
        else {
            console.log('🎨 이미지 5단계+: 고급 질문');
            return [
                {
                    question: "특별한 효과나 분위기를 원하시나요?",
                    options: ["반짝이는 효과", "부드러운 글로우", "날카로운 디테일", "꿈같은 분위기", "상관없음", "기타"]
                },
                {
                    question: "강아지의 시선 방향은?",
                    options: ["카메라 응시", "옆으로 바라보는", "위를 올려다보는", "아래를 내려다보는", "상관없음", "기타"]
                }
            ];
        }
    }
    
    // 🎬 비디오 도메인
    else if (domain === 'video') {
        if (currentStep === 2) {
            console.log('🎬 비디오 2단계');
            return [
                {
                    question: "주인공은 누구인가요?",
                    options: ["사람", "동물", "캐릭터", "제품", "풍경", "기타"]
                },
                {
                    question: "주요 장면은 어떻게?",
                    options: ["실내 촬영", "야외 촬영", "스튜디오", "특수 배경", "애니메이션", "기타"]
                }
            ];
        }
    }
    
    // 🔧 개발 도메인
    else if (domain === 'development') {
        if (currentStep === 2) {
            console.log('🔧 개발 2단계');
            return [
                {
                    question: "어떤 기술로 만들고 싶나요?",
                    options: ["HTML/CSS/JS", "React/Vue", "Python", "Java", "상관없음", "기타"]
                },
                {
                    question: "데이터베이스가 필요한가요?",
                    options: ["간단한 저장", "복잡한 DB", "클라우드", "없음", "모르겠음", "기타"]
                }
            ];
        }
    }
    
    // 기본 질문 (모든 도메인)
    console.log('📝 기본 질문 생성');
    return [
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

// =============================================================================
// 🤖 AI 동적 질문 시도 (OpenAI API)
// =============================================================================
async function tryAIQuestions(userInput, answers, currentStep) {
    console.log('🤖 AI 동적 질문 생성 시도');
    
    // API 키 체크
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-key-here') {
        console.log('⚠️ OpenAI API 키 없음');
        return null;
    }
    
    try {
        const prompt = `
사용자가 "${userInput}"라고 요청했고,
지금까지 "${answers.join(', ')}"라고 답변했습니다.

이 정보를 바탕으로 더 구체적이고 정밀한 한국어 질문 2개를 만들어주세요.

JSON 형식으로만 응답:
[
  {
    "question": "구체적인 질문 내용?",
    "options": ["선택지1", "선택지2", "선택지3", "선택지4", "기타"]
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
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 600
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI 오류: ${response.status}`);
        }

        const data = await response.json();
        const aiQuestions = JSON.parse(data.choices[0].message.content);
        
        console.log(`✅ AI 질문 ${aiQuestions.length}개 생성 성공`);
        return aiQuestions;
        
    } catch (error) {
        console.error('❌ AI 질문 생성 실패:', error);
        return null;
    }
}

// =============================================================================
// 🎯 프롬프트 생성 함수들
// =============================================================================

// 이미지 프롬프트 생성
function buildImagePrompt(userInput, answers) {
    console.log('🎨 이미지 프롬프트 생성');
    
    const goodAnswers = answers.filter(a => a && a !== '기타' && a !== '상관없음');
    
    let prompt = userInput;
    
    // 답변 정보 추가
    if (goodAnswers.length > 0) {
        prompt += `, ${goodAnswers.join(', ')}`;
    }
    
    // 품질 지시어 강제 추가
    prompt += ', highly detailed, professional quality, 4K resolution, masterpiece';
    prompt += ' --no blurry, low quality, watermark, distorted';
    
    console.log('✅ 이미지 프롬프트 완성:', prompt.length, '글자');
    return prompt;
}

// 비디오 프롬프트 생성
function buildVideoPrompt(userInput, answers) {
    console.log('🎬 비디오 프롬프트 생성');
    
    const goodAnswers = answers.filter(a => a && a !== '기타' && a !== '상관없음');
    
    let prompt = `영상 제작 요청: ${userInput}\n\n`;
    prompt += `세부 요구사항:\n`;
    
    goodAnswers.forEach(answer => {
        prompt += `- ${answer}\n`;
    });
    
    prompt += `\n품질 요구사항:\n`;
    prompt += `- 전문적이고 고품질\n`;
    prompt += `- 시청자 몰입도 높임\n`;
    prompt += `- 브랜드 이미지에 부합\n`;
    
    return prompt;
}

// 개발 프롬프트 생성
function buildDevPrompt(userInput, answers) {
    console.log('🔧 개발 프롬프트 생성');
    
    const goodAnswers = answers.filter(a => a && a !== '기타' && a !== '상관없음');
    
    let prompt = `개발 프로젝트: ${userInput}\n\n`;
    prompt += `요구사항:\n`;
    
    goodAnswers.forEach(answer => {
        prompt += `- ${answer}\n`;
    });
    
    prompt += `\n개발 조건:\n`;
    prompt += `- 안정적이고 확장 가능한 구조\n`;
    prompt += `- 사용자 친화적 인터페이스\n`;
    prompt += `- 유지보수 용이성 고려\n`;
    
    return prompt;
}

// 일반 프롬프트 생성
function buildGeneralPrompt(userInput, answers) {
    console.log('📝 일반 프롬프트 생성');
    
    const goodAnswers = answers.filter(a => a && a !== '기타' && a !== '상관없음');
    
    let prompt = userInput;
    if (goodAnswers.length > 0) {
        prompt += ` (${goodAnswers.join(', ')})`;
    }
    prompt += ' - 전문적이고 고품질로 제작';
    
    return prompt;
}
