const forcePrompt = `
현재 프롬프트: "${currentPrompt}"
평가 점수: ${evaluation.total}/100점
부족한 부분: ${weakPoints.join(', ')}

🔥 90점 이상 달성을 위한 완전한 프롬프트 재작성을 해주세요!

🎯 필수 포함 요소들:
1. 구체적 주제: 정확한 대상과 특징 명시
2. 세부 스타일: 구체적인 예술 스타일이나 기법
3. 색상 팔레트: 구체적인 색상 조합과 톤
4. 구체적 포즈/동작: 정확한 자세와 표정
5. 상세한 배경: 구체적인 환경과 소품들
6. 조명 설정: 조명 종류, 방향, 분위기
7. 카메// api/improve-prompt.js - 완전 새로운 내부 개선 + 자동 반복 시스템

// ✅ 올바른 Utils import
import { evaluatePrompt } from '../utils/evaluationSystem.js';
import { SlotSystem } from '../utils/slotSystem.js';
import { MentionExtractor } from '../utils/mentionExtractor.js';
import { IntentAnalyzer } from '../utils/intentAnalyzer.js';
import { QuestionOptimizer } from '../utils/questionOptimizer.js';

// 전역 인스턴스 생성
const slotSystem = new SlotSystem();
const mentionExtractor = new MentionExtractor();
const intentAnalyzer = new IntentAnalyzer();
const questionOptimizer = new QuestionOptimizer();

export default async function handler(req, res) {
    console.log('🚀 완전 새로운 API 시작!', new Date().toISOString());
    
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
        const { step, userInput, answers = [], mode = 'normal', round = 1, current_score = 0 } = req.body;
        
        console.log('📨 요청 데이터:', { step, userInput, answersCount: answers.length, mode, round, current_score });
        
        // Step 검증
        const validSteps = ['questions', 'additional-questions', 'final-improve'];
        if (!validSteps.includes(step)) {
            throw new Error(`유효하지 않은 step: ${step}`);
        }
        
        // 사용자 입력 검증
        if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
            throw new Error('사용자 입력이 필요합니다');
        }
        
        const cleanInput = userInput.trim();
        
        // 🎯 Step별 처리
        switch (step) {
            case 'questions':
                return await handleInitialQuestions(cleanInput, mode, res);
            
            case 'additional-questions':
                return await handleAdditionalQuestions(cleanInput, answers, round, res);
            
            case 'final-improve':
                return await handleFinalImprove(cleanInput, answers, round, mode, res);
            
            default:
                throw new Error('알 수 없는 step입니다');
        }
        
    } catch (error) {
        console.error('❌ API 오류:', error);
        return res.status(500).json({
            error: error.message,
            step: 'error',
            fallback: true,
            timestamp: new Date().toISOString()
        });
    }
}

// =============================================================================
// 🎯 Step 1: 초기 질문 생성 (하드코딩 + 도메인 감지)
// =============================================================================

async function handleInitialQuestions(userInput, mode, res) {
    console.log('🎯 Step 1: 초기 질문 생성');
    
    try {
        // 1. 도메인 감지
        const domainInfo = slotSystem.detectDomains(userInput);
        console.log('🔍 감지된 도메인:', domainInfo);
        
        // 2. 사용자 언급 정보 추출
        const mentionedInfo = mentionExtractor.extract(userInput);
        console.log('📝 언급된 정보:', mentionedInfo);
        
        // 3. 도메인별 하드코딩 질문 생성
        let questions = [];
        
        if (domainInfo.primary === 'visual_design') {
            // 🎨 이미지 도메인 전용 질문
            questions = generateImageDomainQuestions(mentionedInfo);
        } else {
            // 🔧 기타 도메인 폴백 질문
            questions = slotSystem.generateFallbackQuestions(domainInfo, mentionedInfo);
        }
        
        // 4. 질문 최적화 (중복 제거 등)
        const optimizedQuestions = questionOptimizer.optimize(
            questions, 
            mentionedInfo, 
            domainInfo, 
            mode === 'expert' ? 8 : 6
        );
        
        // 5. 객관식 형태로 변환
        const multipleChoiceQuestions = convertToMultipleChoice(optimizedQuestions, domainInfo.primary);
        
        console.log('✅ 최종 질문 생성 완료:', multipleChoiceQuestions.length, '개');
        
        return res.json({
            questions: multipleChoiceQuestions,
            question_type: "multiple_choice",
            domain: domainInfo.primary,
            round: 1,
            confidence: domainInfo.confidence,
            message: `${domainInfo.primary === 'visual_design' ? '🎨 이미지' : '🔧 일반'} 도메인 질문 생성 완료`
        });
        
    } catch (error) {
        console.error('❌ Step 1 오류:', error);
        
        // 안전한 폴백 질문
        const fallbackQuestions = [
            {
                question: "구체적으로 어떤 결과물을 원하시나요?",
                options: ["이미지/그림", "텍스트/글", "코드/프로그램", "영상/음성", "기타"]
            },
            {
                question: "어떤 스타일이나 느낌을 선호하시나요?",
                options: ["사실적", "귀여운", "전문적", "심플한", "화려한", "기타"]
            },
            {
                question: "크기나 품질 요구사항이 있나요?",
                options: ["HD급", "4K급", "인쇄용", "웹용", "모바일용", "기타"]
            }
        ];
        
        return res.json({
            questions: fallbackQuestions,
            question_type: "multiple_choice",
            domain: "general",
            round: 1,
            fallback: true,
            message: "기본 질문으로 시작합니다"
        });
    }
}

// 이미지 도메인 하드코딩 질문 생성
function generateImageDomainQuestions(mentionedInfo) {
    const baseQuestions = [
        "어떤 스타일로 제작하고 싶으신가요?",
        "선호하는 색상이나 톤이 있나요?", 
        "어떤 크기나 비율로 만들까요?",
        "해상도나 품질 요구사항이 있나요?",
        "배경은 어떻게 구성하고 싶으신가요?",
        "어떤 분위기나 느낌을 원하시나요?",
        "특별한 각도나 구도가 있나요?",
        "용도나 목적이 정해져 있나요?"
    ];
    
    // 이미 언급된 정보와 관련된 질문 제외
    return baseQuestions.filter(question => {
        if (question.includes('스타일') && mentionedInfo.스타일) return false;
        if (question.includes('색상') && mentionedInfo.색상) return false;
        if (question.includes('크기') && mentionedInfo.크기) return false;
        if (question.includes('해상도') && mentionedInfo.해상도) return false;
        return true;
    }).slice(0, 6); // 최대 6개
}

// 질문을 객관식 형태로 변환
function convertToMultipleChoice(questions, domain) {
    const optionMap = {
        visual_design: {
            스타일: ["사실적", "3D", "애니메이션", "일러스트", "수채화", "유화", "기타"],
            색상: ["따뜻한톤", "차가운톤", "모노톤", "비비드", "파스텔", "무지개색", "기타"],
            크기: ["정사각형", "가로형(16:9)", "세로형(9:16)", "A4용지", "모바일용", "기타"],
            해상도: ["HD", "4K", "8K", "인쇄용 고화질", "웹용 최적화", "기타"],
            배경: ["단색 배경", "자연 풍경", "실내 공간", "추상적", "투명 배경", "기타"],
            분위기: ["밝고 화사하게", "부드럽고 따뜻하게", "드라마틱하게", "차분하게", "신비롭게", "기타"],
            구도: ["정면", "측면", "위에서", "아래서", "대각선", "기타"],
            용도: ["SNS 프로필", "유튜브 썸네일", "포스터", "로고", "일러스트북", "기타"]
        }
    };
    
    return questions.map(question => {
        // 질문에서 키워드 추출하여 적절한 옵션 찾기
        let options = ["예", "아니요", "잘 모르겠음", "기타"]; // 기본 옵션
        
        if (domain === 'visual_design') {
            const domainOptions = optionMap.visual_design;
            
            for (const [key, opts] of Object.entries(domainOptions)) {
                if (question.includes(key) || 
                    (key === '스타일' && question.includes('스타일')) ||
                    (key === '색상' && (question.includes('색상') || question.includes('톤'))) ||
                    (key === '크기' && (question.includes('크기') || question.includes('비율'))) ||
                    (key === '해상도' && (question.includes('해상도') || question.includes('품질'))) ||
                    (key === '배경' && question.includes('배경')) ||
                    (key === '분위기' && (question.includes('분위기') || question.includes('느낌'))) ||
                    (key === '구도' && (question.includes('각도') || question.includes('구도'))) ||
                    (key === '용도' && (question.includes('용도') || question.includes('목적')))) {
                    options = opts;
                    break;
                }
            }
        }
        
        return {
            question: question,
            options: options
        };
    });
}

// =============================================================================
// 🎯 Step 2: 추가 질문 생성 (AI 기반 맞춤 질문)
// =============================================================================

async function handleAdditionalQuestions(userInput, answers, round, res) {
    console.log('🎯 Step 2: AI 맞춤 질문 생성, 라운드:', round);
    
    try {
        // 1. 의도 분석
        const intentAnalysis = intentAnalyzer.calculateIntentScore(userInput, answers);
        console.log('📊 의도 분석:', intentAnalysis);
        
        // 2. 부족한 정보 파악
        const mentionedInfo = mentionExtractor.extract([userInput, ...answers].join(' '));
        const missingInfo = identifyMissingInfo(userInput, answers, intentAnalysis);
        
        console.log('❓ 부족한 정보:', missingInfo);
        
        // 3. AI에게 맞춤 질문 요청
        const aiQuestions = await requestAICustomQuestions(
            userInput, 
            answers, 
            missingInfo, 
            round,
            intentAnalysis.score
        );
        
        return res.json({
            questions: aiQuestions,
            question_type: "multiple_choice",
            domain: "visual_design",
            round: round,
            intent_score: intentAnalysis.score,
            missing_info: missingInfo,
            message: `🎯 ${round}라운드: 맞춤 질문 생성 완료 (의도 점수: ${intentAnalysis.score}점)`
        });
        
    } catch (error) {
        console.error('❌ Step 2 오류:', error);
        
        // 폴백: 간단한 추가 질문
        const fallbackQuestions = [
            {
                question: "더 구체적으로 어떤 특징을 원하시나요?",
                options: ["디테일한", "심플한", "독특한", "클래식한", "모던한", "기타"]
            },
            {
                question: "완성도는 어느 수준으로 원하시나요?",
                options: ["전문가급", "상급", "중급", "기본급", "스케치급", "기타"]
            }
        ];
        
        return res.json({
            questions: fallbackQuestions,
            question_type: "multiple_choice",
            domain: "visual_design",
            round: round,
            fallback: true,
            message: "기본 추가 질문으로 진행합니다"
        });
    }
}

// 부족한 정보 식별
function identifyMissingInfo(userInput, answers, intentAnalysis) {
    const allText = [userInput, ...answers].join(' ').toLowerCase();
    
    const checkList = {
        주제디테일: !allText.includes('포즈') && !allText.includes('표정') && !allText.includes('동작'),
        배경정보: !allText.includes('배경') && !allText.includes('장소') && !allText.includes('환경'),
        조명분위기: !allText.includes('조명') && !allText.includes('밝기') && !allText.includes('분위기'),
        감정표현: !allText.includes('감정') && !allText.includes('느낌') && !allText.includes('표정'),
        세부사항: !allText.includes('디테일') && !allText.includes('장식') && !allText.includes('소품'),
        기술스펙: !allText.includes('해상도') && !allText.includes('품질') && !allText.includes('크기'),
        용도목적: !allText.includes('용도') && !allText.includes('목적') && !allText.includes('사용'),
        참고사항: !allText.includes('참고') && !allText.includes('예시') && !allText.includes('스타일')
    };
    
    return Object.entries(checkList)
        .filter(([key, missing]) => missing)
        .map(([key]) => key)
        .slice(0, 5); // 최대 5개만
}

// AI 맞춤 질문 요청
async function requestAICustomQuestions(userInput, answers, missingInfo, round, intentScore) {
    try {
        const context = `
사용자 요청: "${userInput}"
기존 답변들: ${answers.join(' / ')}
부족한 정보: ${missingInfo.join(', ')}
현재 라운드: ${round}
의도 점수: ${intentScore}점

이미지 생성을 위해 부족한 정보를 파악하는 한국어 객관식 질문을 만들어주세요.

요구사항:
1. 부족한 정보에 기반한 구체적 질문
2. 각 질문마다 5-6개의 선택지 포함
3. 마지막 선택지는 항상 "기타"
4. 중복되지 않는 새로운 관점의 질문
5. 질문 개수: 3-4개

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "질문 내용?",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4", "기타"]
    }
  ]
}
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // 비용 절약용
                messages: [
                    {
                        role: 'system',
                        content: '당신은 이미지 생성을 위한 전문 질문 생성 AI입니다. 사용자의 의도를 파악하기 위한 구체적이고 유용한 한국어 객관식 질문을 만들어주세요.'
                    },
                    {
                        role: 'user',
                        content: context
                    }
                ],
                temperature: 0.7,
                max_tokens: 800
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API 오류: ${response.status}`);
        }
        
        const result = await response.json();
        const aiContent = result.choices[0].message.content;
        
        console.log('🤖 AI 응답:', aiContent);
        
        // JSON 파싱
        let questions;
        try {
            const parsed = JSON.parse(aiContent);
            questions = parsed.questions || [];
        } catch (parseError) {
            console.log('📝 JSON 파싱 실패, 텍스트 파싱 시도');
            questions = parseQuestionsFromText(aiContent);
        }
        
        // 질문 검증 및 정리
        return validateAndCleanQuestions(questions);
        
    } catch (error) {
        console.error('❌ AI 질문 요청 실패:', error);
        
        // 폴백: 미리 정의된 질문
        return getFallbackQuestions(missingInfo);
    }
}

// 텍스트에서 질문 파싱
function parseQuestionsFromText(text) {
    const questions = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    let currentQuestion = null;
    let currentOptions = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // 질문 감지
        if (trimmed.includes('?') || trimmed.includes('질문')) {
            if (currentQuestion && currentOptions.length > 0) {
                questions.push({
                    question: currentQuestion,
                    options: [...currentOptions]
                });
            }
            currentQuestion = trimmed.replace(/^\d+\.?\s*/, '').replace(/질문:\s*/, '');
            currentOptions = [];
        }
        // 선택지 감지
        else if (trimmed.match(/^[-•]\s*/) || trimmed.match(/^\d+\)\s*/)) {
            const option = trimmed.replace(/^[-•]\s*/, '').replace(/^\d+\)\s*/, '');
            if (option.length > 0) {
                currentOptions.push(option);
            }
        }
    }
    
    // 마지막 질문 저장
    if (currentQuestion && currentOptions.length > 0) {
        questions.push({
            question: currentQuestion,
            options: [...currentOptions]
        });
    }
    
    return questions;
}

// 질문 검증 및 정리
function validateAndCleanQuestions(questions) {
    if (!Array.isArray(questions)) return [];
    
    return questions
        .filter(q => q.question && Array.isArray(q.options) && q.options.length >= 3)
        .map(q => {
            // "기타" 옵션 보장
            const cleanOptions = q.options.filter(opt => opt && opt.trim().length > 0);
            if (!cleanOptions.some(opt => opt.includes('기타'))) {
                cleanOptions.push('기타');
            }
            
            return {
                question: q.question.trim(),
                options: cleanOptions.slice(0, 6) // 최대 6개 옵션
            };
        })
        .slice(0, 4); // 최대 4개 질문
}

// 폴백 질문
function getFallbackQuestions(missingInfo) {
    const fallbackMap = {
        주제디테일: {
            question: "주인공의 구체적인 모습이나 포즈를 어떻게 표현할까요?",
            options: ["정면으로", "측면으로", "역동적으로", "차분하게", "특별한 포즈로", "기타"]
        },
        배경정보: {
            question: "배경은 어떤 분위기로 구성하고 싶으신가요?",
            options: ["자연 풍경", "실내 공간", "단색 배경", "추상적", "화려한 배경", "기타"]
        },
        조명분위기: {
            question: "조명이나 전체적인 분위기는 어떻게 설정할까요?",
            options: ["밝고 환하게", "부드럽고 따뜻하게", "드라마틱하게", "어둡고 신비롭게", "자연스럽게", "기타"]
        },
        감정표현: {
            question: "어떤 감정이나 표정을 강조하고 싶으신가요?",
            options: ["행복한", "차분한", "신비로운", "장난스러운", "진지한", "기타"]
        },
        세부사항: {
            question: "특별한 디테일이나 장식 요소가 필요한가요?",
            options: ["심플하게", "디테일 풍부하게", "액세서리 포함", "특수 효과", "미니멀하게", "기타"]
        }
    };
    
    const result = [];
    for (const info of missingInfo) {
        if (fallbackMap[info] && result.length < 3) {
            result.push(fallbackMap[info]);
        }
    }
    
    if (result.length === 0) {
        result.push({
            question: "추가로 고려하고 싶은 요소가 있나요?",
            options: ["특별한 효과", "참고할 스타일", "색상 조합", "완성도 수준", "없음", "기타"]
        });
    }
    
    return result;
}

// =============================================================================
// 🎯 Step 3: 최종 프롬프트 개선 + 자동 반복
// =============================================================================

async function handleFinalImprove(userInput, answers, round, mode, res) {
    console.log('🎯 Step 3: 최종 프롬프트 개선, 라운드:', round, '모드:', mode);
    
    try {
        // 🚨 API 키 확인
        if (!process.env.OPENAI_API_KEY) {
            console.error('❌ OpenAI API 키가 없습니다!');
            throw new Error('OpenAI API 키가 설정되지 않았습니다');
        }
        
        console.log('✅ OpenAI API 키 확인됨');
        
        // 1. 내부 프롬프트 개선 (사용자가 모르게)
        console.log('🔄 내부 개선 시작...');
        const internallyImprovedPrompt = await performInternalImprovement(userInput, answers, round);
        console.log('✅ 내부 개선 완료:', internallyImprovedPrompt);
        
        // 2. 도메인 감지
        const domainInfo = slotSystem.detectDomains(internallyImprovedPrompt);
        console.log('🔍 도메인 감지:', domainInfo);
        
        // 3. 프롬프트 평가 (올바른 함수 사용!)
        console.log('📊 프롬프트 평가 시작...');
        const evaluation = evaluatePrompt(internallyImprovedPrompt, userInput, domainInfo);
        console.log('📊 평가 결과:', evaluation);
        
        // 4. 전문가모드이고 90점 미만이면 자동 개선 시도
        if (mode === 'expert' && evaluation.total < 90 && round < 5) {
            console.log(`🔄 ${evaluation.total}점으로 90점 미만! 강제 개선 시작...`);
            
            const forceImprovedPrompt = await performForceImprovement(
                internallyImprovedPrompt, 
                evaluation, 
                userInput, 
                answers
            );
            
            console.log('🔥 강제 개선 완료:', forceImprovedPrompt);
            
            // 강제 개선된 프롬프트 재평가
            const reEvaluation = evaluatePrompt(forceImprovedPrompt, userInput, domainInfo);
            console.log('📈 재평가 결과:', reEvaluation);
            
            // 이미지 도메인이면 영문 번역
            let finalPrompt = forceImprovedPrompt;
            if (domainInfo.primary === 'visual_design') {
                console.log('🌍 영문 번역 시작...');
                finalPrompt = await translateToEnglish(forceImprovedPrompt, answers);
                console.log('🌍 영문 번역 완료:', finalPrompt);
            }
            
            return res.json({
                improved_prompt: finalPrompt,
                score: reEvaluation.total,
                improvements: reEvaluation.improvements,
                evaluation_details: reEvaluation.details,
                domain: domainInfo.primary,
                round: round,
                should_continue: reEvaluation.total < 90 && round < 4,
                completed: reEvaluation.total >= 90 || round >= 4,
                language: domainInfo.primary === 'visual_design' ? 'english' : 'korean',
                force_improved: true,
                previous_score: evaluation.total,
                score_improvement: reEvaluation.total - evaluation.total,
                message: `🔥 강제 개선 완료! ${evaluation.total}점 → ${reEvaluation.total}점 (+${reEvaluation.total - evaluation.total}점)`
            });
        }
        
        // 5. 일반모드이거나 90점 이상이면 완료
        let finalPrompt = internallyImprovedPrompt;
        
        // 이미지 도메인이면 영문 번역
        if (domainInfo.primary === 'visual_design') {
            console.log('🌍 영문 번역 시작...');
            finalPrompt = await translateToEnglish(internallyImprovedPrompt, answers);
            console.log('🌍 영문 번역 완료:', finalPrompt);
        }
        
        return res.json({
            improved_prompt: finalPrompt,
            score: evaluation.total,
            improvements: evaluation.improvements,
            evaluation_details: evaluation.details,
            domain: domainInfo.primary,
            round: round,
            should_continue: false,
            completed: true,
            language: domainInfo.primary === 'visual_design' ? 'english' : 'korean',
            message: evaluation.total >= 90 ? 
                `🎉 목표 달성! ${evaluation.total}점의 고품질 프롬프트 완성!` : 
                `✅ 프롬프트 개선 완료! (${evaluation.total}점)`
        });
        
    } catch (error) {
        console.error('❌ Step 3 오류:', error);
        console.error('❌ 오류 상세:', error.stack);
        
        // 🚨 긴급 폴백: 수동 개선
        console.log('🆘 긴급 수동 개선 시작...');
        
        // 사용자 답변을 실제로 반영한 수동 개선
        let manualPrompt = createManualImprovedPrompt(userInput, answers);
        const domainInfo = slotSystem.detectDomains(userInput);
        
        // 이미지 도메인이면 영문 번역
        if (domainInfo.primary === 'visual_design') {
            manualPrompt = createManualEnglishPrompt(manualPrompt, answers);
        }
        
        // 수동 평가
        const manualEvaluation = evaluatePrompt(manualPrompt, userInput, domainInfo);
        
        console.log('🆘 수동 개선 완료:', {
            prompt: manualPrompt,
            score: manualEvaluation.total
        });
        
        return res.json({
            improved_prompt: manualPrompt,
            score: manualEvaluation.total,
            improvements: manualEvaluation.improvements,
            evaluation_details: manualEvaluation.details,
            domain: domainInfo.primary,
            round: round,
            completed: true,
            language: domainInfo.primary === 'visual_design' ? 'english' : 'korean',
            manual_fallback: true,
            error_message: error.message,
            message: `🆘 수동 개선으로 ${manualEvaluation.total}점 달성`
        });
    }
}
            
            return res.json({
                improved_prompt: fallbackPrompt,
                score: fallbackEvaluation.total,
                improvements: fallbackEvaluation.improvements,
                evaluation_details: fallbackEvaluation.details,
                domain: domainInfo.primary,
                round: round,
                completed: true,
                language: domainInfo.primary === 'visual_design' ? 'english' : 'korean',
                fallback: true,
                message: `폴백 시스템으로 ${fallbackEvaluation.total}점 달성`
            });
            
// 수동 개선 프롬프트 생성 (사용자 답변 실제 반영)
function createManualImprovedPrompt(userInput, answers) {
    console.log('🔧 수동 개선 시작:', { userInput, answers });
    
    // 사용자 답변에서 핵심 정보 추출
    const answerInfo = {
        style: null,
        color: null,
        size: null,
        quality: null,
        mood: null,
        background: null,
        pose: null,
        effect: null
    };
    
    // answers 배열에서 실제 답변 추출
    if (Array.isArray(answers)) {
        answers.forEach(answer => {
            const answerStr = typeof answer === 'string' ? answer : JSON.stringify(answer);
            console.log('📝 분석 중인 답변:', answerStr);
            
            // A: 부분에서 실제 답변 추출
            const answerMatch = answerStr.match(/A:\s*([^,\n]+)/);
            const actualAnswer = answerMatch ? answerMatch[1].trim() : answerStr;
            
            // 답변별로 카테고리 분류
            if (actualAnswer.includes('사실적') || actualAnswer.includes('애니메이션') || actualAnswer.includes('3D')) {
                answerInfo.style = actualAnswer;
            } else if (actualAnswer.includes('파스텔') || actualAnswer.includes('비비드') || actualAnswer.includes('톤')) {
                answerInfo.color = actualAnswer;
            } else if (actualAnswer.includes('세로형') || actualAnswer.includes('가로형') || actualAnswer.includes('정사각형')) {
                answerInfo.size = actualAnswer;
            } else if (actualAnswer.includes('HD') || actualAnswer.includes('4K') || actualAnswer.includes('웹용')) {
                answerInfo.quality = actualAnswer;
            } else if (actualAnswer.includes('밝고') || actualAnswer.includes('어둡고') || actualAnswer.includes('신비')) {
                answerInfo.mood = actualAnswer;
            } else if (actualAnswer.includes('우주') || actualAnswer.includes('배경') || actualAnswer.includes('공원')) {
                answerInfo.background = actualAnswer;
            } else if (actualAnswer.includes('측면') || actualAnswer.includes('정면') || actualAnswer.includes('포즈')) {
                answerInfo.pose = actualAnswer;
            } else if (actualAnswer.includes('특수') || actualAnswer.includes('효과') || actualAnswer.includes('디테일')) {
                answerInfo.effect = actualAnswer;
            }
        });
    }
    
    console.log('✅ 추출된 답변 정보:', answerInfo);
    
    // 수동으로 고품질 프롬프트 생성
    let improvedPrompt = '';
    
    // 기본 주제
    if (userInput.includes('강아지')) {
        improvedPrompt += '사랑스러운 강아지';
        
        // 스타일 반영
        if (answerInfo.style) {
            if (answerInfo.style.includes('사실적')) {
                improvedPrompt += '의 사실적이고 생동감 있는 모습';
            } else if (answerInfo.style.includes('3D')) {
                improvedPrompt += '의 입체적이고 현대적인 3D 렌더링';
            } else {
                improvedPrompt += `의 ${answerInfo.style} 스타일`;
            }
        }
        
        // 포즈 반영
        if (answerInfo.pose) {
            if (answerInfo.pose.includes('측면')) {
                improvedPrompt += '을 측면에서 바라본 우아한 프로필 샷';
            } else {
                improvedPrompt += `을 ${answerInfo.pose}으로 표현`;
            }
        }
        
        // 배경 반영
        if (answerInfo.background) {
            if (answerInfo.background.includes('우주')) {
                improvedPrompt += '. 신비로운 우주 공간을 배경으로 한 환상적인 장면';
            } else {
                improvedPrompt += `. ${answerInfo.background}을 배경으로 한 아름다운 장면`;
            }
        }
        
        // 분위기 반영
        if (answerInfo.mood) {
            if (answerInfo.mood.includes('밝고 화사')) {
                improvedPrompt += '. 밝고 화사한 자연광 조명 아래 행복한 분위기';
            } else if (answerInfo.mood.includes('어둡고 신비')) {
                improvedPrompt += '. 어둡고 신비로운 조명으로 연출된 몽환적 분위기';
            } else if (answerInfo.mood.includes('신비')) {
                improvedPrompt += '. 신비롭고 매혹적인 표정과 눈빛';
            }
        }
        
        // 색상 반영
        if (answerInfo.color) {
            if (answerInfo.color.includes('파스텔')) {
                improvedPrompt += '. 부드러운 파스텔 톤의 따뜻한 색감';
            } else {
                improvedPrompt += `. ${answerInfo.color} 색상으로 표현`;
            }
        }
        
        // 효과 반영
        if (answerInfo.effect) {
            if (answerInfo.effect.includes('특수')) {
                improvedPrompt += '. 마법같은 특수 효과와 반짝이는 디테일';
            }
        }
        
        // 품질 지시어
        if (answerInfo.quality) {
            if (answerInfo.quality.includes('웹용')) {
                improvedPrompt += '. 웹 최적화된 선명한 고품질';
            } else {
                improvedPrompt += `. ${answerInfo.quality} 고해상도 품질`;
            }
        }
        
        // 크기 반영
        if (answerInfo.size) {
            if (answerInfo.size.includes('세로형')) {
                improvedPrompt += '. 세로형 9:16 비율의 모바일 최적화 구도';
            } else {
                improvedPrompt += `. ${answerInfo.size} 비율로 구성`;
            }
        }
        
        // 전문적 마무리
        improvedPrompt += '. 전문가급 펫 포트레이트 사진 품질로 정교한 디테일과 완성도 높은 마감. 4K 해상도.';
    } else {
        // 강아지가 아닌 경우 기본 처리
        improvedPrompt = `${userInput}을 고품질로 전문적으로 제작. `;
        
        // 답변 정보 반영
        Object.values(answerInfo).forEach(info => {
            if (info) {
                improvedPrompt += `${info} 적용. `;
            }
        });
        
        improvedPrompt += '전문가급 품질로 완성.';
    }
    
    console.log('🎯 수동 생성된 프롬프트:', improvedPrompt);
    return improvedPrompt;
}

// 수동 영문 번역
function createManualEnglishPrompt(koreanPrompt, answers) {
    console.log('🌍 수동 영문 번역 시작:', koreanPrompt);
    
    let englishPrompt = '';
    
    // 기본 번역
    if (koreanPrompt.includes('강아지')) {
        englishPrompt = 'Adorable cute dog ';
        
        // 스타일
        if (koreanPrompt.includes('사실적')) {
            englishPrompt += 'photorealistic portrait ';
        } else if (koreanPrompt.includes('3D')) {
            englishPrompt += '3D rendered character ';
        }
        
        // 배경
        if (koreanPrompt.includes('우주')) {
            englishPrompt += 'in mystical space background with stars and nebula ';
        }
        
        // 포즈
        if (koreanPrompt.includes('측면')) {
            englishPrompt += 'side profile view ';
        }
        
        // 분위기
        if (koreanPrompt.includes('밝고 화사')) {
            englishPrompt += 'bright cheerful lighting ';
        } else if (koreanPrompt.includes('신비')) {
            englishPrompt += 'mysterious magical atmosphere ';
        }
        
        // 색상
        if (koreanPrompt.includes('파스텔')) {
            englishPrompt += 'soft pastel colors ';
        }
        
        // 효과
        if (koreanPrompt.includes('특수 효과')) {
            englishPrompt += 'magical sparkle effects ';
        }
        
        // 품질
        englishPrompt += 'professional pet portrait photography, highly detailed, 4K resolution, masterpiece quality';
        
        // 비율
        if (koreanPrompt.includes('세로형')) {
            englishPrompt += ', 9:16 aspect ratio';
        }
        
        // 부정 명령어
        englishPrompt += ' --no blurry, low quality, watermark, text, dark shadows';
    } else {
        // 기본 번역
        englishPrompt = koreanPrompt
            .replace(/고품질/g, 'high quality')
            .replace(/전문가/g, 'professional')
            .replace(/완성/g, 'masterpiece') + ', 4K resolution --no low quality, blurry';
    }
    
    console.log('🌍 수동 번역 완료:', englishPrompt);
    return englishPrompt;
}

// =============================================================================
// 🛠️ 내부 개선 함수들
// =============================================================================

// 내부 프롬프트 개선 (사용자가 모름)
async function performInternalImprovement(userInput, answers, round) {
    try {
        console.log('🔄 내부 개선 시작...');
        
        const answerContext = answers.length > 0 ? 
            `사용자 답변: ${answers.join(' / ')}` : 
            '추가 답변 없음';
            
        const improvementPrompt = `
원본 요청: "${userInput}"
${answerContext}
현재 라운드: ${round}

이 정보를 바탕으로 완전히 새롭고 구체적인 고품질 프롬프트를 작성해주세요.

🎯 필수 개선사항:
1. 구체적인 주제 명시 (정확한 품종, 나이, 특징)
2. 세부적인 스타일과 분위기 (사실적/애니메이션/일러스트 등)
3. 구체적인 색상과 톤 (따뜻한/차가운/파스텔 등)
4. 정확한 포즈와 표정 (앉아있는/뛰어가는/웃고있는 등)
5. 상세한 배경 설정 (공원/집/스튜디오 등)
6. 조명과 분위기 (자연광/스튜디오/황금시간 등)
7. 카메라 구도 (클로즈업/전신/측면 등)
8. 품질 지시어 (고해상도/전문가급/마스터피스 등)

❌ 금지사항: 단순 번역이나 키워드 나열 금지
✅ 목표: 완전히 새로운 고품질 프롬프트 작성

예시 수준:
"사랑스러운 골든리트리버 강아지가 화창한 봄날 벚꽃이 만개한 공원에서 활짝 웃으며 앉아있는 모습. 부드러운 황금빛 털과 맑고 순수한 눈망울, 살짝 내민 분홍색 혀. 자연스러운 황금시간 조명 아래 따뜻하고 행복한 분위기. 얕은 심도로 배경은 부드럽게 흐려진 클로즈업 구도. 전문가급 펫 포트레이트 사진 품질로 4K 해상도."

이런 수준으로 완전히 새롭게 작성해주세요:
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: '당신은 프롬프트 개선 전문가입니다. 사용자의 의도를 파악하여 더 구체적이고 완성도 높은 프롬프트로 개선해주세요.'
                    },
                    {
                        role: 'user',
                        content: improvementPrompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API 오류: ${response.status}`);
        }
        
        const result = await response.json();
        const improvedPrompt = result.choices[0].message.content.trim();
        
        return improvedPrompt || userInput; // 실패시 원본 반환
        
    } catch (error) {
        console.error('❌ 내부 개선 실패:', error);
        return userInput; // 실패시 원본 반환
    }
}

// 강제 개선 (90점 미만시)
async function performForceImprovement(currentPrompt, evaluation, userInput, answers) {
    try {
        console.log('🔥 강제 개선 시작...');
        
        // 평가 결과에서 부족한 부분 파악
        const weakPoints = [];
        if (evaluation.details) {
            Object.entries(evaluation.details).forEach(([key, result]) => {
                if (result.score && result.score < result.max * 0.7) { // 70% 미만
                    weakPoints.push(key);
                }
            });
        }
        
        const forcePrompt = `
현재 프롬프트: "${currentPrompt}"
평가 점수: ${evaluation.total}/100점
부족한 부분: ${weakPoints.join(', ')}

이 프롬프트를 90점 이상으로 강제 개선해주세요.

개선 방향:
${generateImprovementInstructions(weakPoints)}

요구사항:
1. 기존 의도 유지하면서 품질 대폭 향상
2. 전문적이고 구체적인 표현 사용  
3. 세부사항과 디테일 추가
4. 명확하고 정확한 지시사항
5. 한국어로 작성

개선된 프롬프트만 출력하세요:
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: '당신은 프롬프트 강제 개선 전문가입니다. 기존 프롬프트의 약점을 파악하여 90점 이상의 고품질 프롬프트로 완전히 개선해주세요.'
                    },
                    {
                        role: 'user',
                        content: forcePrompt
                    }
                ],
                temperature: 0.2, // 일관성을 위해 낮게
                max_tokens: 600
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API 오류: ${response.status}`);
        }
        
        const result = await response.json();
        let forceImproved = result.choices[0].message.content.trim();
        
        // 품질 향상을 위한 후처리
        forceImproved = enhancePromptQuality(forceImproved, weakPoints);
        
        return forceImproved || currentPrompt;
        
    } catch (error) {
        console.error('❌ 강제 개선 실패:', error);
        return manualForceImprovement(currentPrompt, evaluation);
    }
}

// 개선 지시사항 생성
function generateImprovementInstructions(weakPoints) {
    const instructionMap = {
        informationDensity: '- 구체적인 수치, 크기, 색상, 재질 정보를 대폭 추가',
        completeness: '- 필수 요소들(스타일, 품질, 용도, 대상 등)을 모두 포함',
        clarity: '- 모호한 표현을 제거하고 명확한 지시사항으로 변경',
        executability: '- 실제 제작 가능한 현실적인 요구사항으로 조정',
        efficiency: '- 불필요한 중복 제거하고 핵심 내용에 집중',
        주체구체화: '- 주체를 더 구체적으로: 정확한 품종, 크기, 나이, 특징 상세 명시',
        감정표정: '- 감정 표현 강화: 구체적 눈빛, 표정, 미묘한 감정 상태 디테일 추가',
        포즈동작: '- 포즈 디테일 추가: 정확한 자세, 각도, 손발 위치, 움직임 상세 묘사',
        배경설정: '- 배경 상세화: 구체적 장소, 환경 디테일, 소품, 분위기 요소 추가',
        조명정보: '- 조명 전문화: 조명 종류, 방향, 강도, 색온도, 그림자 설정 명시',
        카메라구도: '- 카메라 설정 추가: 구도 법칙, 초점, 앵글, 거리감, 렌즈 정보',
        예술스타일: '- 스타일 구체화: 구체적 작가명, 스튜디오, 세부 기법, 장르 언급',
        색상팔레트: '- 색상 정확화: 구체적 색상명, 조합, 채도, 명도, 색온도 설정',
        품질지시어: '- 품질 키워드 강화: masterpiece, professional, premium 등 전문 용어',
        기술스펙: '- 기술 사양 추가: 해상도, 비율, 포맷, DPI, 색공간 등 명시'
    };
    
    return weakPoints.map(point => instructionMap[point] || `- ${point} 관련 내용 대폭 강화`).join('\n');
}

// 프롬프트 품질 향상 후처리
function enhancePromptQuality(prompt, weakPoints) {
    let enhanced = prompt;
    
    // 기본 품질 키워드 강화
    if (weakPoints.includes('품질지시어')) {
        if (!enhanced.includes('고품질') && !enhanced.includes('전문가급')) {
            enhanced += '. 전문가급 고품질로 제작';
        }
    }
    
    // 구체성 향상
    if (weakPoints.includes('informationDensity')) {
        enhanced = enhanced.replace(/크게|작게/g, '정확한 크기로');
        enhanced = enhanced.replace(/예쁘게|멋있게/g, '세련되고 아름답게');
    }
    
    // 명확성 향상
    if (weakPoints.includes('clarity')) {
        enhanced = enhanced.replace(/적당히|알아서/g, '정확히');
        enhanced = enhanced.replace(/좀|약간/g, '적절히');
    }
    
    return enhanced;
}

// 수동 강제 개선 (AI 실패시 폴백)
function manualForceImprovement(currentPrompt, evaluation) {
    console.log('🔧 수동 강제 개선 시작');
    
    let improved = currentPrompt;
    
    // 기본 품질 키워드 추가
    if (!improved.includes('고품질') && !improved.includes('전문가')) {
        improved += '. 전문가급 고품질로 제작';
    }
    
    // 구체적 스타일 정보 추가
    if (!improved.includes('스타일') && !improved.includes('느낌')) {
        improved += '. 현대적이고 세련된 스타일로';
    }
    
    // 세부사항 추가
    if (!improved.includes('디테일') && !improved.includes('정교')) {
        improved += '. 정교한 디테일과 완성도 높은 마감으로';
    }
    
    // 용도 명시
    if (!improved.includes('용도') && !improved.includes('목적')) {
        improved += '. 실용적이고 효과적인 결과물로';
    }
    
    return improved;
}

// 영문 번역 (이미지 도메인용)
async function translateToEnglish(koreanPrompt, answers) {
    try {
        console.log('🌍 영문 번역 시작...');
        
        const answerContext = answers.length > 0 ? 
            `추가 요구사항: ${answers.join(' / ')}` : 
            '';
            
        const translationPrompt = `
한국어 프롬프트: "${koreanPrompt}"
${answerContext}

이 한국어 프롬프트를 AI 이미지 생성기(Midjourney, DALL-E, Stable Diffusion)가 완벽하게 이해할 수 있는 전문가급 영문 프롬프트로 번역해주세요.

요구사항:
1. 완전한 영어 번역
2. AI 이미지 생성에 최적화된 키워드 사용
3. 전문적인 사진/그래픽 용어 포함
4. 구체적인 스타일, 조명, 구도, 품질 정보
5. 부정 명령어(--no) 포함 권장
6. 100-200 단어 길이

영문 프롬프트만 출력하세요:
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: '당신은 AI 이미지 생성을 위한 전문 영문 프롬프트 번역 전문가입니다. 한국어를 완벽한 영문 이미지 프롬프트로 변환해주세요.'
                    },
                    {
                        role: 'user',
                        content: translationPrompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 400
            })
        });
        
        if (!response.ok) {
            throw new Error(`번역 API 오류: ${response.status}`);
        }
        
        const result = await response.json();
        let englishPrompt = result.choices[0].message.content.trim();
        
        // 영문 프롬프트 품질 향상
        englishPrompt = enhanceEnglishPrompt(englishPrompt);
        
        return englishPrompt;
        
    } catch (error) {
        console.error('❌ 영문 번역 실패:', error);
        return generateFallbackEnglishPrompt(koreanPrompt);
    }
}

// 영문 프롬프트 품질 향상
function enhanceEnglishPrompt(prompt) {
    let enhanced = prompt;
    
    // 기본 품질 키워드 추가
    if (!enhanced.toLowerCase().includes('quality')) {
        enhanced += ', high quality, masterpiece';
    }
    
    // 해상도 정보 추가
    if (!enhanced.includes('4K') && !enhanced.includes('HD')) {
        enhanced += ', 4K resolution';
    }
    
    // 전문적 키워드 추가
    if (!enhanced.includes('detailed')) {
        enhanced += ', highly detailed';
    }
    
    // 부정 명령어 추가 (없는 경우)
    if (!enhanced.includes('--no')) {
        enhanced += ' --no blurry, low quality, watermark';
    }
    
    return enhanced;
}

// 폴백 영문 번역
function generateFallbackEnglishPrompt(koreanPrompt) {
    console.log('🔄 폴백 영문 번역');
    
    // 기본적인 한영 번역 + 품질 키워드
    let prompt = koreanPrompt
        .replace(/그려줘|만들어줘|생성해줘/g, 'create')
        .replace(/이미지|그림/g, 'image')
        .replace(/고품질/g, 'high quality')
        .replace(/전문가/g, 'professional')
        .replace(/세련된/g, 'stylish')
        .replace(/아름다운/g, 'beautiful');
        
    // 기본 품질 키워드 추가
    prompt += ', professional artwork, high quality, detailed, 4K resolution, masterpiece';
    prompt += ' --no blurry, low quality, watermark, text';
    
    return prompt;
}

// =============================================================================
// 🎯 유틸리티 함수들
// =============================================================================

// 답변 배열을 문자열로 포맷
function formatAnswersToString(answers) {
    if (!Array.isArray(answers) || answers.length === 0) return '';
    
    return answers
        .map(answer => {
            if (typeof answer === 'string') {
                return answer.replace(/^Q:|^A:/g, '').trim();
            }
            return String(answer);
        })
        .filter(answer => answer.length > 0)
        .join(' / ');
}

// 폴백 점수 계산
function calculateFallbackScore(improvedPrompt, originalPrompt, answers) {
    let score = 45; // 기본 점수 상향
    
    // 길이 개선도
    const lengthRatio = improvedPrompt.length / originalPrompt.length;
    if (lengthRatio > 1.2 && lengthRatio < 5) {
        score += Math.min(20, (lengthRatio - 1) * 15);
    }
    
    // 구체성 점수
    const specificsCount = (improvedPrompt.match(/(구체적|정확|세부|디테일|전문|고품질)/gi) || []).length;
    score += Math.min(15, specificsCount * 3);
    
    // 답변 반영 점수
    if (Array.isArray(answers) && answers.length > 0) {
        score += Math.min(15, answers.length * 2);
    }
    
    // 전문 용어 사용
    const professionalTerms = (improvedPrompt.match(/(해상도|품질|스타일|조명|구도|색상|분위기)/gi) || []).length;
    score += Math.min(10, professionalTerms * 2);
    
    return Math.min(95, Math.round(score));
}

console.log('🎉 완전 새로운 API 시스템 로드 완료!');
console.log('✅ 주요 기능:');
console.log('  - 🎯 3단계 프로세스 (질문 → 추가질문 → 최종개선)');
console.log('  - 🔄 내부 자동 개선 시스템');
console.log('  - 🎨 이미지 도메인 전용 처리');
console.log('  - 🔥 90점 미만시 강제 개선');
console.log('  - 🌍 영문 자동 번역');
console.log('  - ⚡ 전문가모드 자동 반복');
