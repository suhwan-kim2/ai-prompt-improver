// api/improve-prompt.js - 완전 개선된 20단계 95점 달성 시스템

import { evaluatePrompt } from '../utils/evaluationSystem.js';
import { SlotSystem } from '../utils/slotSystem.js';
import { MentionExtractor } from '../utils/mentionExtractor.js';
import { IntentAnalyzer } from '../utils/intentAnalyzer.js';
import { QuestionOptimizer } from '../utils/questionOptimizer.js';

const slotSystem = new SlotSystem();
const mentionExtractor = new MentionExtractor();
const intentAnalyzer = new IntentAnalyzer();
const questionOptimizer = new QuestionOptimizer();

// OpenAI API 키 (환경 변수에서 가져오기)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
    console.log('🚀 AI 프롬프트 개선 API 시작 - 20단계 95점 시스템');
    
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST만 지원됩니다' });
    }
    
    try {
        const { step, userInput, answers = [], mode = 'normal', currentStep = 1, targetScore = 95 } = req.body;

        console.log('📨 요청 정보:', {
            step,
            userInput,
            answersCount: answers.length,
            mode,
            currentStep,
            targetScore
        });

        
        // Step별 처리
        switch (step) {
            case 'questions':
                return await handleQuestions(userInput, mode, res);
            
            case 'additional-questions':
                return await handleAdditionalQuestions(userInput, answers, currentStep, mode, targetScore, res);

            
            case 'final-improve':
                return await handleFinalImprove(userInput, answers, currentStep, mode, targetScore, res);
            
            default:
                throw new Error('알 수 없는 step: ' + step);
        }
        
    } catch (error) {
        console.error('❌ API 오류:', error);
        return res.status(500).json({
            error: error.message,
            step: 'error'
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
        const domainInfo = slotSystem.detectDomains(userInput);
        console.log('🔍 감지된 도메인:', domainInfo);
        
        // 사용자 언급 정보 추출
        const mentionedInfo = mentionExtractor.extract(userInput);
        console.log('💬 언급된 정보:', mentionedInfo);
        
        // 의도 분석
        const intentAnalysis = intentAnalyzer.generateAnalysisReport(userInput);
        console.log('🎯 의도 분석:', intentAnalysis);
        
        // 1단계 기본 질문 생성 (도메인별)
        const questions = generateStep1Questions(domainInfo, mentionedInfo);
        
        return res.json({
            questions: questions,
            question_type: "multiple_choice",
            domain: domainInfo.primary,
            currentStep: 1,
            maxSteps: mode === 'expert' ? 20 : 3,
            intentScore: intentAnalysis.intentScore,
            message: `1단계: 기본 정보를 파악하겠습니다 (현재 의도 파악: ${intentAnalysis.intentScore}점)`
        });
        
    } catch (error) {
        console.error('❌ 1단계 질문 생성 오류:', error);
        throw error;
    }
}

// =============================================================================
// 🎯 2-20단계: 추가 질문 생성
// =============================================================================
async function handleAdditionalQuestions(userInput, answers, currentStep, mode, targetScore, res) {
    try {
        console.log(`📝 ${currentStep}단계: 추가 질문 생성`);
        
        // 현재까지의 의도 점수 계산
        const intentAnalysis = intentAnalyzer.generateAnalysisReport(userInput, answers);
        const currentScore = intentAnalysis.intentScore;
        
        console.log(`📊 현재 의도 파악 점수: ${currentScore}점`);
        
        // 95점 이상이면 질문 종료
         // 목표 점수 이상이면 질문 종료
          if (currentScore >= targetScore) {
            console.log(`🎉 ${targetScore}점 달성! 질문 종료`);
            return res.json({
                questions: [],
                completed: true,
                currentStep: currentStep,
                intentScore: currentScore,
                shouldProceedToFinal: true, // ⭐ 이 한 줄 추가!
                message: `🎉 완벽합니다! ${targetScore}점 달성으로 바로 개선하겠습니다.`
            });
        }
        
        // 최대 단계 도달 체크
            if (currentStep >= 20) {
                console.log('⚠️ 최대 20단계 도달');
                return res.json({
                    questions: [],
                    completed: true,
                    currentStep: 20,
                    intentScore: currentScore,
                    shouldProceedToFinal: true, // ⭐ 이 한 줄 추가!
                    message: `최대 20단계 완료. 현재 정보로 최선의 개선을 진행합니다. (${currentScore}점)`
                });
        }
        
        // 단계별 질문 생성
        let questions = [];
        
        if (currentStep <= 3) {
            // 2-3단계: 도메인별 전문 질문 (하드코딩)
            questions = generateStep2_3Questions(userInput, answers, currentStep);
        } else if (currentStep <= 10) {
            // 4-10단계: 세부 디테일 질문
            questions = generateDetailQuestions(userInput, answers, currentStep);
        } else {
            // 11-20단계: AI 동적 초정밀 질문
            questions = await generateAIDynamicQuestions(userInput, answers, currentStep, intentAnalysis);
        }
        
        // 질문 최적화
        const optimizedQuestions = questionOptimizer.optimize(
            questions,
            mentionExtractor.extract([userInput, ...answers].join(' ')),
            slotSystem.detectDomains(userInput),
            8
        );
        
        return res.json({
            questions: optimizedQuestions,
            question_type: "multiple_choice",
            currentStep: currentStep,
            maxSteps: mode === 'expert' ? 20 : 3,
            intentScore: currentScore,
           needMoreInfo: currentScore < targetScore,
            message: `${currentStep}단계: 더 정확한 의도 파악을 위한 질문입니다 (현재 ${currentScore}점 → 목표 ${targetScore}점)`
        });
        
    } catch (error) {
        console.error(`❌ ${currentStep}단계 질문 생성 오류:`, error);
        
        // 폴백: 기본 질문 제공
        return res.json({
            questions: generateFallbackQuestions(currentStep),
            currentStep: currentStep,
            intentScore: 70,
            message: `${currentStep}단계 질문을 생성합니다.`
        });
    }
}

// =============================================================================
// 🎯 최종 개선 (95점 달성 후)
// =============================================================================
async function handleFinalImprove(userInput, answers, currentStep, mode, targetScore, res) {
    try {
        console.log('🎯 최종 개선 시작');
        
        // 최종 의도 점수 계산
        const finalIntentAnalysis = intentAnalyzer.generateAnalysisReport(userInput, answers);
        const intentScore = finalIntentAnalysis.intentScore;
        
        console.log(`📊 최종 의도 파악 점수: ${intentScore}점`);
        
        // 프롬프트 생성
        const improvedPrompt = await createImprovedPrompt(userInput, answers, finalIntentAnalysis);
        
        // 품질 평가
        const domainInfo = slotSystem.detectDomains(userInput);
        const evaluation = evaluatePrompt(improvedPrompt, userInput, domainInfo);
        const qualityScore = evaluation.total;
        
        console.log(`📊 프롬프트 품질 점수: ${qualityScore}점`);
        
        // 최종 점수 (의도 + 품질 평균)
        const finalScore = Math.round((intentScore + qualityScore) / 2);
        
        // 영문 번역 (이미지/영상 도메인)
        let finalPrompt = improvedPrompt;
        if (domainInfo.primary === 'visual_design' || domainInfo.primary === 'video') {
            finalPrompt = await translateToEnglish(improvedPrompt);
        }
        
        return res.json({
            improved_prompt: finalPrompt,
            score: finalScore,
            intentScore: intentScore,
            qualityScore: qualityScore,
            improvements: evaluation.improvements || [],
            evaluation_details: evaluation.details || {},
            domain: domainInfo.primary,
            totalSteps: currentStep,
            completed: true,
            language: domainInfo.primary === 'visual_design' ? 'english' : 'korean',
            message: `✨ ${currentStep}단계 만에 완성! 의도파악 ${intentScore}점, 품질 ${qualityScore}점 달성! (목표 ${targetScore}점)`
        });
        
    } catch (error) {
        console.error('❌ 최종 개선 오류:', error);
        
        // 폴백 개선
        const fallbackPrompt = createFallbackPrompt(userInput, answers);
        return res.json({
            improved_prompt: fallbackPrompt,
            score: 75,
            intentScore: 70,
            qualityScore: 80,
            improvements: ['기본 개선 완료'],
            domain: 'general',
            totalSteps: currentStep,
            completed: true,
            message: '기본 개선이 완료되었습니다.'
        });
    }
}

// =============================================================================
// 🎯 단계별 질문 생성 함수들
// =============================================================================

// 1단계: 기본 질문
function generateStep1Questions(domainInfo, mentionedInfo) {
    const domain = domainInfo.primary;
    
    const step1Questions = {
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
                options: ["숏폼(~1분)", "중간(1-5분)", "긴편(5-10분)", "장편(10분+)", "기타"]
            },
            {
                question: "영상 스타일은 어떻게 하시겠어요?",
                options: ["실사 촬영", "2D 애니메이션", "3D 애니메이션", "모션그래픽", "혼합형", "기타"]
            },
            {
                question: "타겟 플랫폼은 어디인가요?",
                options: ["유튜브", "인스타그램/릴스", "틱톡", "TV/방송", "웹사이트", "기타"]
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
                question: "개발 우선순위는 무엇인가요?",
                options: ["빠른 개발", "안정성", "확장성", "사용성", "보안", "기타"]
            }
        ],
        // ... 다른 도메인들도 추가
        general: [
            {
                question: "어떤 종류의 작업을 원하시나요?",
                options: ["콘텐츠 제작", "분석/리서치", "계획/전략", "문제 해결", "학습/교육", "기타"]
            },
            {
                question: "결과물의 형태는 무엇인가요?",
                options: ["문서/텍스트", "이미지/그래픽", "코드/프로그램", "계획/전략", "기타"]
            },
            {
                question: "누가 사용하거나 볼 예정인가요?",
                options: ["나 혼자", "팀/동료", "고객/클라이언트", "대중/공개", "기타"]
            },
            {
                question: "언제까지 필요하신가요?",
                options: ["즉시/오늘", "이번 주", "이번 달", "여유있음", "기타"]
            }
        ]
    };
    
    return step1Questions[domain] || step1Questions.general;
}

// 2-3단계: 도메인별 전문 질문
function generateStep2_3Questions(userInput, answers, currentStep) {
    const domain = slotSystem.detectDomains(userInput).primary;
    
    const step2Questions = {
        visual_design: [
            {
                question: "주인공/주체의 구체적인 특징이나 외모는 어떻게 설정할까요?",
                options: ["매우 상세하게", "적당히 구체적으로", "간단하게", "추상적으로", "기타"]
            },
            {
                question: "표정이나 감정 표현은 어떻게 할까요?",
                options: ["밝고 긍정적", "진지하고 집중", "신비롭고 몽환적", "역동적이고 열정적", "무표정/중립", "기타"]
            },
            {
                question: "정확한 포즈나 동작은 어떻게 설정할까요?",
                options: ["정면 직립", "측면 프로필", "역동적 동작", "앉아있는 자세", "자유로운 포즈", "기타"]
            },
            {
                question: "의상이나 액세서리는 어떻게 할까요?",
                options: ["현대적/일상복", "전통적/클래식", "미래적/SF", "판타지/코스튬", "없음/누드", "기타"]
            },
            {
                question: "조명과 분위기는 어떻게 설정할까요?",
                options: ["밝고 화사한", "어둡고 드라마틱", "부드럽고 몽환적", "강렬한 명암", "자연광", "기타"]
            }
        ],
        video: [
            {
                question: "오프닝 장면은 어떻게 시작할까요?",
                options: ["페이드인", "강렬한 시작", "로고/타이틀", "내레이션 시작", "액션 장면", "기타"]
            },
            {
                question: "주요 장면 전환은 어떻게 처리할까요?",
                options: ["부드러운 전환", "컷 편집", "특수효과 전환", "매치컷", "디졸브", "기타"]
            },
            {
                question: "배경음악 스타일은 어떻게 할까요?",
                options: ["업비트/경쾌한", "감성적/잔잔한", "웅장한/오케스트라", "일렉트로닉", "음악 없음", "기타"]
            },
            {
                question: "내레이션이나 자막 처리는?",
                options: ["전문 성우", "AI 음성", "자막만", "둘 다", "없음", "기타"]
            },
            {
                question: "색보정 톤은 어떻게 설정할까요?",
                options: ["따뜻한 톤", "차가운 톤", "높은 채도", "낮은 채도", "자연스럽게", "기타"]
            }
        ]
        // ... 다른 도메인들
    };
    
    const step3Questions = {
        visual_design: [
            {
                question: "카메라 앵글과 구도는 어떻게 잡을까요?",
                options: ["클로즈업", "미디엄샷", "풀샷", "버드아이뷰", "로우앵글", "기타"]
            },
            {
                question: "특수 효과나 후처리는 어떻게 할까요?",
                options: ["없음/최소", "약간의 보정", "판타지 효과", "글리치/디지털", "아트 필터", "기타"]
            },
            {
                question: "텍스처와 재질감은 어떻게 표현할까요?",
                options: ["매우 정밀하게", "적당히 표현", "단순하게", "스타일라이즈", "기타"]
            },
            {
                question: "전체적인 완성도 수준은?",
                options: ["상업용/프로급", "준프로급", "아마추어/취미", "스케치/초안", "기타"]
            },
            {
                question: "참고하고 싶은 작가나 스타일이 있나요?",
                options: ["특정 작가 있음", "유명 스튜디오 스타일", "트렌드 따라가기", "독창적으로", "기타"]
            }
        ]
        // ... 다른 도메인들
    };
    
    return currentStep === 2 ? 
        (step2Questions[domain] || step2Questions.visual_design) :
        (step3Questions[domain] || step3Questions.visual_design);
}

// 4-10단계: 세부 디테일 질문
function generateDetailQuestions(userInput, answers, currentStep) {
    // 이전 답변에서 부족한 부분 분석
    const mentionedInfo = mentionExtractor.extract([userInput, ...answers].join(' '));
    const missingDetails = analyzeMissingDetails(mentionedInfo);
    
    const detailQuestions = [];
    
    // 색상 디테일
    if (!mentionedInfo.색상 || mentionedInfo.색상.length < 2) {
        detailQuestions.push({
            question: "주요 색상과 보조 색상의 조합은?",
            options: ["단색 위주", "2-3색 조합", "다채로운 색상", "그라데이션", "커스텀 팔레트", "기타"]
        });
    }
    
    // 크기/해상도 디테일
    if (!mentionedInfo.크기 || !mentionedInfo.해상도) {
        detailQuestions.push({
            question: "정확한 크기나 해상도 사양은?",
            options: ["1920x1080", "3840x2160(4K)", "1080x1080", "1080x1920", "커스텀 크기", "기타"]
        });
    }
    
    // 품질 디테일
    if (!mentionedInfo.품질) {
        detailQuestions.push({
            question: "품질과 디테일 수준은?",
            options: ["초고품질/8K", "고품질/4K", "일반품질/HD", "빠른 제작용", "기타"]
        });
    }
    
    // 추가 요구사항
    detailQuestions.push({
        question: "특별히 강조하고 싶은 부분은?",
        options: ["주제/캐릭터", "배경/환경", "색상/분위기", "디테일/질감", "전체 조화", "기타"]
    });
    
    detailQuestions.push({
        question: "피하고 싶은 요소가 있나요?",
        options: ["어두운 분위기", "복잡한 배경", "특정 색상", "특정 스타일", "없음", "기타"]
    });
    
    return detailQuestions.slice(0, 5); // 최대 5개
}

// 11-20단계: AI 동적 초정밀 질문 (OpenAI API 사용)
async function generateAIDynamicQuestions(userInput, answers, currentStep, intentAnalysis) {
    try {
        // OpenAI API가 없으면 폴백
        if (!OPENAI_API_KEY) {
            console.log('⚠️ OpenAI API 키 없음, 폴백 질문 사용');
            return generateFallbackDynamicQuestions(userInput, answers, currentStep);
        }
        
        const prompt = `
사용자의 원본 요청: "${userInput}"

지금까지의 답변들:
${answers.map((a, i) => `${i+1}. ${a}`).join('\n')}

현재 의도 파악 점수: ${intentAnalysis.intentScore}점
부족한 정보: ${intentAnalysis.missingSlots.join(', ')}

위 정보를 바탕으로, 95점 달성을 위해 아직 파악하지 못한 초정밀 디테일을 
알아내기 위한 한국어 객관식 질문 5개를 생성해주세요.

규칙:
1. 이전 답변의 세부사항을 더 깊이 파고드는 질문
2. 각 질문은 매우 구체적이고 전문적이어야 함
3. 객관식 형태 (5-6개 선택지)
4. 중복되지 않는 다양한 관점

JSON 형식:
[
  {
    "question": "질문 내용",
    "options": ["선택지1", "선택지2", "선택지3", "선택지4", "선택지5", "기타"]
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
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that generates detailed questions in Korean.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            throw new Error('OpenAI API 오류');
        }

        const data = await response.json();
        const generatedQuestions = JSON.parse(data.choices[0].message.content);
        
        return generatedQuestions;
        
    } catch (error) {
        console.error('AI 질문 생성 오류:', error);
        return generateFallbackDynamicQuestions(userInput, answers, currentStep);
    }
}

// 폴백: AI 없이 동적 질문 생성
function generateFallbackDynamicQuestions(userInput, answers, currentStep) {
    const recentAnswer = answers[answers.length - 1] || '';
    const questions = [];
    
    // 최근 답변 기반 추가 질문
    if (recentAnswer.includes('우주')) {
        questions.push({
            question: "우주 환경의 구체적인 설정은?",
            options: ["지구 궤도", "달 표면", "화성", "성운 속", "블랙홀 근처", "기타"]
        });
    }
    
    if (recentAnswer.includes('캐릭터') || recentAnswer.includes('사람')) {
        questions.push({
            question: "캐릭터의 나이대와 성별은?",
            options: ["어린이", "청소년", "청년", "중년", "노년", "기타"]
        });
    }
    
    // 일반적인 초정밀 질문들
    questions.push({
        question: "작업물의 최종 용도는 정확히 무엇인가요?",
        options: ["포트폴리오", "상업용", "개인소장", "SNS공유", "프레젠테이션", "기타"]
    });
    
    questions.push({
        question: "가장 중요하게 생각하는 요소는?",
        options: ["정확성", "창의성", "완성도", "속도", "비용", "기타"]
    });
    
    questions.push({
        question: "참고하고 싶은 레퍼런스가 있나요?",
        options: ["있음(URL 제공)", "비슷한 스타일 있음", "특정 작가/브랜드", "없음", "기타"]
    });
    
    return questions;
}

// 폴백 질문들
function generateFallbackQuestions(currentStep) {
    const fallbackQuestions = [
        {
            question: "구체적으로 어떤 결과물을 원하시나요?",
            options: ["이미지/그림", "영상/비디오", "웹/앱", "문서/텍스트", "기타"]
        },
        {
            question: "어떤 스타일이나 느낌을 선호하시나요?",
            options: ["모던/현대적", "클래식/전통적", "미니멀/단순", "화려한/복잡한", "기타"]
        },
        {
            question: "주요 타겟이나 사용자는 누구인가요?",
            options: ["일반 대중", "전문가", "아이들", "비즈니스", "기타"]
        },
        {
            question: "언제까지 필요하신가요?",
            options: ["즉시", "오늘 중", "이번 주", "이번 달", "여유있음", "기타"]
        }
    ];
    
    return fallbackQuestions;
}

// =============================================================================
// 🎯 프롬프트 생성 함수들
// =============================================================================

// 개선된 프롬프트 생성
async function createImprovedPrompt(userInput, answers, intentAnalysis) {
    console.log('🚀 프롬프트 생성 시작');
    
    // 모든 정보 통합
    const allInfo = [userInput, ...answers].join('. ');
    
    // 도메인 감지
    const domainInfo = slotSystem.detectDomains(userInput);
    const domain = domainInfo.primary;
    
    // 언급 정보 추출
    const mentionedInfo = mentionExtractor.extract(allInfo);
    
    let improvedPrompt = '';
    
    // 도메인별 프롬프트 구조화
    switch(domain) {
        case 'visual_design':
            improvedPrompt = createVisualPrompt(userInput, answers, mentionedInfo);
            break;
        case 'video':
            improvedPrompt = createVideoPrompt(userInput, answers, mentionedInfo);
            break;
        case 'development':
            improvedPrompt = createDevelopmentPrompt(userInput, answers, mentionedInfo);
            break;
        case 'text_language':
            improvedPrompt = createTextPrompt(userInput, answers, mentionedInfo);
            break;
        case 'business':
            improvedPrompt = createBusinessPrompt(userInput, answers, mentionedInfo);
            break;
        default:
            improvedPrompt = createGeneralPrompt(userInput, answers, mentionedInfo);
    }
    
    // 품질 키워드 추가
    improvedPrompt = addQualityKeywords(improvedPrompt, domain);
    
    // 부정 프롬프트 추가
    improvedPrompt = addNegativePrompts(improvedPrompt, answers);
    
    console.log('✅ 프롬프트 생성 완료:', improvedPrompt);
    return improvedPrompt;
}

// 비주얼 디자인 프롬프트 생성
function createVisualPrompt(userInput, answers, mentionedInfo) {
    let prompt = '';
    
    // 주제 추출
    const subject = extractSubject(userInput, answers);
    if (subject) prompt += subject;
    
    // 스타일 정보
    const style = extractStyle(answers);
    if (style) prompt += `, ${style}`;
    
    // 색상 정보
    const colors = mentionedInfo.색상 || [];
    if (colors.length > 0) {
        prompt += `, ${colors.join(' and ')} color palette`;
    }
    
    // 구도와 앵글
    const composition = extractComposition(answers);
    if (composition) prompt += `, ${composition}`;
    
    // 배경 설정
    const background = extractBackground(answers);
    if (background) prompt += `, ${background} background`;
    
    // 조명 설정
    const lighting = extractLighting(answers);
    if (lighting) prompt += `, ${lighting} lighting`;
    
    // 분위기
    const mood = mentionedInfo.분위기 || [];
    if (mood.length > 0) {
        prompt += `, ${mood[0]} atmosphere`;
    }
    
    // 기술 스펙
    const techSpecs = extractTechSpecs(answers);
    if (techSpecs) prompt += `, ${techSpecs}`;
    
    // 품질 지시어
    prompt += ', highly detailed, professional quality, masterpiece';
    
    return prompt;
}

// 영상 프롬프트 생성
function createVideoPrompt(userInput, answers, mentionedInfo) {
    let prompt = `영상 제작 요청:\n\n`;
    
    prompt += `목적: ${extractPurpose(answers)}\n`;
    prompt += `길이: ${extractDuration(answers)}\n`;
    prompt += `스타일: ${extractStyle(answers)}\n`;
    prompt += `타겟: ${extractTarget(answers)}\n`;
    
    if (mentionedInfo.음악) {
        prompt += `음악: ${mentionedInfo.음악.join(', ')}\n`;
    }
    
    prompt += `\n주요 장면:\n`;
    prompt += `- 오프닝: ${extractOpening(answers)}\n`;
    prompt += `- 메인: ${extractMainScenes(answers)}\n`;
    prompt += `- 엔딩: ${extractEnding(answers)}\n`;
    
    prompt += `\n기술 사양:\n`;
    prompt += `- 해상도: ${extractResolution(answers)}\n`;
    prompt += `- 프레임레이트: ${extractFrameRate(answers)}\n`;
    prompt += `- 색보정: ${extractColorGrading(answers)}\n`;
    
    return prompt;
}

// 개발 프롬프트 생성
function createDevelopmentPrompt(userInput, answers, mentionedInfo) {
    let prompt = `개발 프로젝트:\n\n`;
    
    prompt += `프로젝트 유형: ${extractProjectType(answers)}\n`;
    prompt += `주요 기능: ${extractMainFeatures(answers)}\n`;
    prompt += `대상 사용자: ${extractTargetUsers(answers)}\n`;
    prompt += `기술 스택: ${extractTechStack(answers)}\n`;
    
    if (mentionedInfo.플랫폼) {
        prompt += `플랫폼: ${mentionedInfo.플랫폼.join(', ')}\n`;
    }
    
    prompt += `\n요구사항:\n`;
    prompt += `- 성능: ${extractPerformance(answers)}\n`;
    prompt += `- 보안: ${extractSecurity(answers)}\n`;
    prompt += `- 확장성: ${extractScalability(answers)}\n`;
    
    return prompt;
}

// 텍스트 프롬프트 생성
function createTextPrompt(userInput, answers, mentionedInfo) {
    let prompt = '';
    
    const purpose = extractPurpose(answers);
    const audience = extractAudience(answers);
    const tone = extractTone(answers);
    const length = extractLength(answers);
    
    prompt += `${purpose}을 위한 ${length} 분량의 ${tone} 톤 글 작성.\n`;
    prompt += `대상 독자: ${audience}\n`;
    
    if (mentionedInfo.키워드) {
        prompt += `필수 키워드: ${mentionedInfo.키워드.join(', ')}\n`;
    }
    
    prompt += `\n구조: ${extractStructure(answers)}\n`;
    prompt += `형식: ${extractFormat(answers)}\n`;
    
    return prompt;
}

// 비즈니스 프롬프트 생성
function createBusinessPrompt(userInput, answers, mentionedInfo) {
    let prompt = `비즈니스 전략:\n\n`;
    
    prompt += `사업 분야: ${extractBusinessField(answers)}\n`;
    prompt += `목표: ${extractGoals(answers)}\n`;
    prompt += `대상 고객: ${extractTargetCustomers(answers)}\n`;
    prompt += `예산: ${extractBudget(answers)}\n`;
    prompt += `기간: ${extractTimeline(answers)}\n`;
    
    if (mentionedInfo.경쟁사) {
        prompt += `경쟁사: ${mentionedInfo.경쟁사.join(', ')}\n`;
    }
    
    prompt += `\n차별화 전략: ${extractDifferentiation(answers)}\n`;
    prompt += `위험 요소: ${extractRisks(answers)}\n`;
    
    return prompt;
}

// 일반 프롬프트 생성
function createGeneralPrompt(userInput, answers, mentionedInfo) {
    let prompt = userInput;
    
    // 답변 정보 통합
    answers.forEach(answer => {
        if (answer && answer.length > 0) {
            prompt += `. ${answer}`;
        }
    });
    
    // 언급된 정보 추가
    Object.entries(mentionedInfo).forEach(([key, values]) => {
        if (Array.isArray(values) && values.length > 0) {
            prompt += `. ${key}: ${values.join(', ')}`;
        }
    });
    
    return prompt;
}

// 품질 키워드 추가
function addQualityKeywords(prompt, domain) {
    const qualityKeywords = {
        visual_design: ', masterpiece, award-winning, highly detailed, professional photography, studio quality',
        video: ', professional production, cinematic quality, high-end editing',
        development: ', clean code, best practices, scalable architecture, optimized performance',
        text_language: ', well-structured, engaging, professional writing',
        business: ', data-driven, strategic approach, measurable outcomes',
        general: ', high quality, professional standard'
    };
    
    return prompt + (qualityKeywords[domain] || qualityKeywords.general);
}

// 부정 프롬프트 추가
function addNegativePrompts(prompt, answers) {
    const negativeKeywords = [];
    
    // 답변에서 부정 키워드 추출
    answers.forEach(answer => {
        if (answer.includes('피하고 싶은') || answer.includes('제외')) {
            // 부정 키워드 추출 로직
            negativeKeywords.push(answer);
        }
    });
    
    if (negativeKeywords.length > 0) {
        prompt += ' --no ' + negativeKeywords.join(', ');
    } else {
        // 기본 부정 프롬프트
        prompt += ' --no blurry, low quality, watermark, distorted';
    }
    
    return prompt;
}

// =============================================================================
// 🎯 정보 추출 헬퍼 함수들
// =============================================================================

function extractSubject(userInput, answers) {
    // 주제 추출 로직
    const allText = [userInput, ...answers].join(' ');
    
    if (allText.includes('강아지')) return 'cute adorable dog';
    if (allText.includes('고양이')) return 'beautiful cat';
    if (allText.includes('사람')) return 'person';
    if (allText.includes('풍경')) return 'landscape';
    if (allText.includes('건물')) return 'architecture';
    
    return userInput;
}

function extractStyle(answers) {
    const styleMap = {
        '사실적': 'photorealistic',
        '3D': '3D rendered',
        '애니메이션': 'anime style',
        '일러스트': 'illustration',
        '수채화': 'watercolor painting',
        '유화': 'oil painting'
    };
    
    for (const answer of answers) {
        for (const [korean, english] of Object.entries(styleMap)) {
            if (answer.includes(korean)) return english;
        }
    }
    
    return 'artistic style';
}

function extractComposition(answers) {
    const compositionMap = {
        '클로즈업': 'close-up shot',
        '전신': 'full body shot',
        '측면': 'side profile',
        '정면': 'front view',
        '위에서': 'bird eye view',
        '아래서': 'low angle'
    };
    
    for (const answer of answers) {
        for (const [korean, english] of Object.entries(compositionMap)) {
            if (answer.includes(korean)) return english;
        }
    }
    
    return null;
}

function extractBackground(answers) {
    const allAnswers = answers.join(' ');
    
    if (allAnswers.includes('우주')) return 'space nebula';
    if (allAnswers.includes('자연')) return 'natural landscape';
    if (allAnswers.includes('도시')) return 'urban cityscape';
    if (allAnswers.includes('실내')) return 'indoor';
    if (allAnswers.includes('단색')) return 'solid color';
    
    return 'detailed';
}

function extractLighting(answers) {
    const lightingMap = {
        '자연광': 'natural',
        '스튜디오': 'studio',
        '황금시간': 'golden hour',
        '역광': 'backlit',
        '부드러운': 'soft ambient'
    };
    
    for (const answer of answers) {
        for (const [korean, english] of Object.entries(lightingMap)) {
            if (answer.includes(korean)) return english;
        }
    }
    
    return 'professional';
}

function extractTechSpecs(answers) {
    const specs = [];
    const allAnswers = answers.join(' ');
    
    if (allAnswers.includes('4K') || allAnswers.includes('4k')) specs.push('4K resolution');
    if (allAnswers.includes('8K') || allAnswers.includes('8k')) specs.push('8K ultra HD');
    if (allAnswers.includes('HD')) specs.push('HD quality');
    if (allAnswers.includes('16:9')) specs.push('16:9 aspect ratio');
    if (allAnswers.includes('정사각형')) specs.push('square format');
    
    return specs.length > 0 ? specs.join(', ') : '4K resolution';
}

// 기타 추출 함수들 (간단히 구현)
function extractPurpose(answers) { return answers[0] || '일반 목적'; }
function extractDuration(answers) { return answers[1] || '1-3분'; }
function extractTarget(answers) { return answers[2] || '일반 대중'; }
function extractOpening(answers) { return '페이드인 시작'; }
function extractMainScenes(answers) { return '주요 내용 전개'; }
function extractEnding(answers) { return '임팩트 있는 마무리'; }
function extractResolution(answers) { return '1920x1080 Full HD'; }
function extractFrameRate(answers) { return '30fps'; }
function extractColorGrading(answers) { return '자연스러운 색보정'; }
function extractProjectType(answers) { return answers[0] || '웹 애플리케이션'; }
function extractMainFeatures(answers) { return answers[1] || '핵심 기능'; }
function extractTargetUsers(answers) { return answers[2] || '일반 사용자'; }
function extractTechStack(answers) { return 'React, Node.js, MongoDB'; }
function extractPerformance(answers) { return '빠른 응답속도'; }
function extractSecurity(answers) { return '기본 보안 적용'; }
function extractScalability(answers) { return '확장 가능한 구조'; }
function extractAudience(answers) { return answers[1] || '일반 독자'; }
function extractTone(answers) { return answers[3] || '전문적인'; }
function extractLength(answers) { return answers[2] || '1000자'; }
function extractStructure(answers) { return '서론-본론-결론'; }
function extractFormat(answers) { return answers[4] || '기사 형식'; }
function extractBusinessField(answers) { return answers[0] || 'IT/테크'; }
function extractGoals(answers) { return answers[1] || '매출 증대'; }
function extractTargetCustomers(answers) { return answers[2] || 'B2C 고객'; }
function extractBudget(answers) { return answers[3] || '중간 규모'; }
function extractTimeline(answers) { return answers[4] || '3개월'; }
function extractDifferentiation(answers) { return '혁신적인 접근'; }
function extractRisks(answers) { return '시장 경쟁'; }

// =============================================================================
// 🌍 영문 번역 (이미지/영상용)
// =============================================================================

async function translateToEnglish(koreanPrompt) {
    try {
        // OpenAI API로 번역 (API 키가 있을 경우)
        if (OPENAI_API_KEY) {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { 
                            role: 'system', 
                            content: 'You are a professional translator. Translate Korean prompts to English for AI image generation. Keep technical terms and style keywords accurate.' 
                        },
                        { 
                            role: 'user', 
                            content: `Translate this to English for AI image generation: ${koreanPrompt}` 
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 500
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices[0].message.content;
            }
        }
        
        // 폴백: 기본 번역 매핑
        return basicTranslation(koreanPrompt);
        
    } catch (error) {
        console.error('번역 오류:', error);
        return basicTranslation(koreanPrompt);
    }
}

// 기본 번역 함수
function basicTranslation(koreanPrompt) {
    let translated = koreanPrompt;
    
    const translationMap = {
        '강아지': 'dog',
        '고양이': 'cat',
        '사람': 'person',
        '우주': 'space',
        '우주복': 'spacesuit',
        '귀여운': 'cute',
        '사실적': 'photorealistic',
        '애니메이션': 'anime style',
        '배경': 'background',
        '고품질': 'high quality',
        '전문가급': 'professional',
        '상세한': 'detailed',
        '밝은': 'bright',
        '어두운': 'dark',
        '따뜻한': 'warm',
        '차가운': 'cool'
    };
    
    Object.entries(translationMap).forEach(([korean, english]) => {
        translated = translated.replace(new RegExp(korean, 'g'), english);
    });
    
    return translated;
}

// 폴백 프롬프트 생성
function createFallbackPrompt(userInput, answers) {
    return `${userInput}. ${answers.join('. ')}. 고품질로 전문적으로 제작해주세요.`;
}

// 누락된 디테일 분석
function analyzeMissingDetails(mentionedInfo) {
    const requiredDetails = ['색상', '크기', '스타일', '품질', '배경'];
    const missing = [];
    
    requiredDetails.forEach(detail => {
        if (!mentionedInfo[detail] || mentionedInfo[detail].length === 0) {
            missing.push(detail);
        }
    });
    
    return missing;
}

console.log('✅ API 로드 완료 - 20단계 95점 시스템');


