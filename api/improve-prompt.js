// api/improve-prompt.js - 1단계: 이미지 도메인 완성 버전

// Utils import
import { evaluatePrompt } from '../utils/evaluationSystem.js';
import { evaluateImagePrompt } from '../utils/imageEvaluationSystem.js'; // 🎨 이미지 전용 평가
import { SlotSystem } from '../utils/slotSystem.js';
import { MentionExtractor } from '../utils/mentionExtractor.js';
import { IntentAnalyzer } from '../utils/intentAnalyzer.js';
import { QuestionOptimizer } from '../utils/questionOptimizer.js';

// 전역 변수
const slotSystem = new SlotSystem();
const mentionExtractor = new MentionExtractor();
const intentAnalyzer = new IntentAnalyzer();
const questionOptimizer = new QuestionOptimizer();

export default async function handler(req, res) {
    console.log('🎨 이미지 도메인 API 시작!');
    
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
        const { step, userInput, answers = [], mode = 'normal', round = 1 } = req.body;
        
        console.log('📨 요청 데이터:', { step, userInput, answers, mode, round });
        
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
        
        // 🎯 Step 1: 카테고리 감지 + 하드코딩 질문
        if (step === 'questions') {
            return await handleInitialQuestions(cleanInput, mode, res);
        }
        
        // 🎯 Step 2: 의도 분석 + AI 맞춤 질문  
        if (step === 'additional-questions') {
            return await handleAdditionalQuestions(cleanInput, answers, round, res);
        }
        
        // 🎯 Step 3: 최종 영문 프롬프트 생성
        if (step === 'final-improve') {
            return await handleFinalImprove(cleanInput, answers, round, res);
        }
        
    } catch (error) {
        console.error('❌ API 오류:', error);
        return res.status(500).json({
            error: error.message,
            step: 'error',
            fallback: true
        });
    }
}

// =============================================================================
// 🎯 Step 1: 카테고리 감지 + 하드코딩 질문
// =============================================================================

async function handleInitialQuestions(userInput, mode, res) {
    console.log('🎯 Step 1: 카테고리 감지 시작');
    
    try {
        // 1. 도메인 감지
        const domainInfo = slotSystem.detectDomains(userInput);
        console.log('🔍 감지된 도메인:', domainInfo);
        
        // 2. 사용자가 이미 언급한 정보 추출
        const mentionedInfo = mentionExtractor.extract(userInput);
        console.log('📝 언급된 정보:', mentionedInfo);
        
        // 3. 이미지 도메인인지 확인
        if (domainInfo.primary !== 'visual_design') {
            // 이미지가 아닌 경우 임시로 general 처리
            return res.json({
                questions: [
                    {
                        question: "구체적으로 어떤 결과물을 원하시나요?",
                        options: ["이미지/그림", "텍스트/글", "코드/프로그램", "영상/음성", "기타"]
                    }
                ],
                question_type: "multiple_choice",
                domain: domainInfo.primary,
                round: 1,
                message: "1단계에서는 이미지 도메인만 지원합니다."
            });
        }
        
        // 4. 이미지 도메인 하드코딩 질문 생성
        const hardcodedQuestions = generateImageDomainQuestions(mentionedInfo);
        
        return res.json({
            questions: hardcodedQuestions,
            question_type: "multiple_choice", 
            domain: "visual_design",
            round: 1,
            message: "이미지 생성을 위한 기본 질문입니다."
        });
        
    } catch (error) {
        console.error('❌ Step 1 오류:', error);
        
        // 안전한 폴백
        return res.json({
            questions: [
                {
                    question: "어떤 스타일로 제작하고 싶으신가요?",
                    options: ["사실적", "3D", "애니메이션", "일러스트", "기타"]
                },
                {
                    question: "선호하는 색상이나 톤이 있나요?",
                    options: ["따뜻한 색상", "차가운 색상", "모노톤", "비비드", "기타"]
                }
            ],
            question_type: "multiple_choice",
            domain: "visual_design",
            round: 1,
            fallback: true
        });
    }
}

// 이미지 도메인 하드코딩 질문 생성
function generateImageDomainQuestions(mentionedInfo) {
    const baseQuestions = [
        {
            question: "어떤 스타일로 제작하고 싶으신가요?",
            options: ["사실적", "3D", "애니메이션", "일러스트", "수채화", "유화", "기타"]
        },
        {
            question: "선호하는 색상 톤이 있나요?",
            options: ["따뜻한톤", "차가운톤", "모노톤", "비비드", "파스텔", "기타"]
        },
        {
            question: "어떤 크기나 비율로 만들까요?",
            options: ["정사각형", "가로형(16:9)", "세로형(9:16)", "4K", "HD", "기타"]
        },
        {
            question: "해상도나 품질 요구사항이 있나요?",
            options: ["HD", "4K", "8K", "인쇄용 고화질", "웹용 최적화", "기타"]
        }
    ];
    
    // 이미 언급된 정보가 있으면 해당 질문 제외
    const filteredQuestions = baseQuestions.filter(q => {
        const questionKey = getQuestionKey(q.question);
        return !isAlreadyMentioned(questionKey, mentionedInfo);
    });
    
    // 최소 2개, 최대 4개 질문
    return filteredQuestions.slice(0, 4);
}

// 질문에서 키워드 추출
function getQuestionKey(question) {
    if (question.includes('스타일')) return '스타일';
    if (question.includes('색상')) return '색상';
    if (question.includes('크기') || question.includes('비율')) return '크기';
    if (question.includes('해상도') || question.includes('품질')) return '해상도';
    return null;
}

// 이미 언급되었는지 확인
function isAlreadyMentioned(questionKey, mentionedInfo) {
    if (!questionKey || !mentionedInfo) return false;
    
    const relatedKeys = {
        '스타일': ['스타일', '느낌', '방식'],
        '색상': ['색상', '색깔', '컬러'],
        '크기': ['크기', '사이즈', '해상도'],
        '해상도': ['해상도', '화질', '품질']
    };
    
    const related = relatedKeys[questionKey] || [questionKey];
    return related.some(key => mentionedInfo[key] && mentionedInfo[key].length > 0);
}

// =============================================================================
// 🎯 Step 2: 의도 분석 + AI 맞춤 질문
// =============================================================================

async function handleAdditionalQuestions(userInput, answers, round, res) {
    console.log('🎯 Step 2: AI 맞춤 질문 생성');
    
    try {
        // 1. 이전 답변들 분석
        const formattedAnswers = Array.isArray(answers) ? answers : [];
        const intentScore = intentAnalyzer.calculateIntentScore(userInput, formattedAnswers);
        
        console.log('📊 의도 점수:', intentScore);
        
        // 2. 부족한 정보 파악
        const missingInfo = identifyMissingImageInfo(userInput, formattedAnswers);
        console.log('❓ 부족한 정보:', missingInfo);
        
        // 3. AI에게 맞춤 질문 요청
        const aiQuestions = await requestAIQuestions(userInput, formattedAnswers, missingInfo, round);
        
        return res.json({
            questions: aiQuestions,
            question_type: "multiple_choice",
            domain: "visual_design", 
            round: round,
            intent_score: intentScore.score,
            missing_info: missingInfo,
            message: `${round}라운드: 이미지 디테일 파악 질문입니다.`
        });
        
    } catch (error) {
        console.error('❌ Step 2 오류:', error);
        
        // 폴백: 기본 추가 질문
        return res.json({
            questions: [
                {
                    question: "구체적인 포즈나 구도가 있나요?",
                    options: ["정면", "측면", "다양한 각도", "특정 포즈 있음", "기타"]
                },
                {
                    question: "배경은 어떻게 구성하고 싶으신가요?",
                    options: ["단색 배경", "자연 배경", "실내 배경", "투명 배경", "기타"]
                }
            ],
            question_type: "multiple_choice",
            domain: "visual_design",
            round: round,
            fallback: true
        });
    }
}

// 이미지 도메인에서 부족한 정보 파악
function identifyMissingImageInfo(userInput, answers) {
    const allText = [userInput, ...answers].join(' ').toLowerCase();
    
    const checkList = {
        주제디테일: !allText.includes('포즈') && !allText.includes('표정') && !allText.includes('동작'),
        배경정보: !allText.includes('배경') && !allText.includes('장소') && !allText.includes('환경'),
        조명분위기: !allText.includes('조명') && !allText.includes('밝기') && !allText.includes('분위기'),
        디테일요소: !allText.includes('디테일') && !allText.includes('장식') && !allText.includes('액세서리'),
        용도목적: !allText.includes('용도') && !allText.includes('목적') && !allText.includes('사용')
    };
    
    return Object.entries(checkList)
        .filter(([key, missing]) => missing)
        .map(([key]) => key);
}

// AI에게 맞춤 질문 요청
async function requestAIQuestions(userInput, answers, missingInfo, round) {
    try {
        const context = `
사용자 입력: "${userInput}"
기존 답변: ${answers.join(', ')}
부족한 정보: ${missingInfo.join(', ')}
라운드: ${round}

이미지 생성을 위해 부족한 정보를 파악하는 한국어 질문을 만들어주세요.
각 질문마다 4-6개의 선택지를 포함해야 합니다.
마지막 선택지는 항상 "기타"로 설정해주세요.

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "질문 내용",
      "options": ["선택지1", "선택지2", "선택지3", "기타"]
    }
  ]
}

질문 개수: 3-5개
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system', 
                        content: '당신은 이미지 생성을 위한 전문 질문 생성 AI입니다. 한국어로 명확하고 구체적인 객관식 질문을 만들어주세요.'
                    },
                    {
                        role: 'user',
                        content: context
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API 오류: ${response.status}`);
        }
        
        const aiResult = await response.json();
        const aiContent = aiResult.choices[0].message.content;
        
        console.log('🤖 AI 응답:', aiContent);
        
        // JSON 파싱 시도
        let parsedQuestions;
        try {
            parsedQuestions = JSON.parse(aiContent);
        } catch (parseError) {
            // JSON이 아닌 경우 텍스트에서 질문 추출
            console.log('📝 JSON 파싱 실패, 텍스트 파싱 시도');
            parsedQuestions = parseQuestionsFromText(aiContent);
        }
        
        // 검증 및 정리
        const validQuestions = validateAIQuestions(parsedQuestions);
        
        return validQuestions;
        
    } catch (error) {
        console.error('❌ AI 질문 요청 실패:', error);
        
        // 폴백: 미리 정의된 이미지 질문들
        return getFallbackImageQuestions(missingInfo);
    }
}

// AI 질문 검증
function validateAIQuestions(parsedQuestions) {
    console.log('✅ AI 질문 검증:', parsedQuestions);
    
    if (!parsedQuestions || !parsedQuestions.questions || !Array.isArray(parsedQuestions.questions)) {
        throw new Error('AI 질문 형식 오류');
    }
    
    const validQuestions = parsedQuestions.questions
        .filter(q => q.question && Array.isArray(q.options) && q.options.length >= 3)
        .map(q => ({
            question: q.question.trim(),
            options: q.options.map(opt => opt.trim()).filter(opt => opt.length > 0)
        }))
        .slice(0, 5); // 최대 5개
    
    // 각 질문에 "기타" 옵션 보장
    validQuestions.forEach(q => {
        if (!q.options.some(opt => opt.includes('기타'))) {
            q.options.push('기타');
        }
    });
    
    return validQuestions;
}

// 텍스트에서 질문 파싱
function parseQuestionsFromText(text) {
    console.log('📝 텍스트에서 질문 파싱');
    
    const questions = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    let currentQuestion = null;
    let currentOptions = [];
    
    lines.forEach(line => {
        const trimmed = line.trim();
        
        // 질문 감지 (물음표로 끝나거나 "질문:" 포함)
        if (trimmed.includes('?') || trimmed.includes('질문:')) {
            // 이전 질문 저장
            if (currentQuestion && currentOptions.length > 0) {
                questions.push({
                    question: currentQuestion,
                    options: [...currentOptions, '기타']
                });
            }
            
            // 새 질문 시작
            currentQuestion = trimmed.replace(/^\d+\.?\s*/, '').replace(/질문:\s*/, '');
            currentOptions = [];
        }
        // 선택지 감지 (- 또는 숫자로 시작)
        else if (trimmed.match(/^[-•]\s*/) || trimmed.match(/^\d+\)\s*/)) {
            const option = trimmed.replace(/^[-•]\s*/, '').replace(/^\d+\)\s*/, '');
            if (option.length > 0) {
                currentOptions.push(option);
            }
        }
    });
    
    // 마지막 질문 저장
    if (currentQuestion && currentOptions.length > 0) {
        questions.push({
            question: currentQuestion,
            options: [...currentOptions, '기타']
        });
    }
    
    return { questions: questions.slice(0, 5) };
}

// 폴백 이미지 질문들
function getFallbackImageQuestions(missingInfo) {
    const fallbackMap = {
        주제디테일: {
            question: "주인공의 구체적인 모습이나 포즈가 있나요?",
            options: ["정면 바라보기", "측면 프로필", "움직이는 모습", "특정 포즈 있음", "기타"]
        },
        배경정보: {
            question: "배경은 어떻게 구성하고 싶으신가요?",
            options: ["단색 배경", "자연 풍경", "실내 공간", "추상적 배경", "투명 배경", "기타"]
        },
        조명분위기: {
            question: "어떤 분위기나 조명을 원하시나요?",
            options: ["밝고 화사하게", "부드럽고 따뜻하게", "드라마틱하게", "자연스럽게", "기타"]
        },
        디테일요소: {
            question: "특별한 디테일이나 장식 요소가 있나요?",
            options: ["심플하게", "디테일 풍부하게", "액세서리 포함", "특수 효과", "기타"]
        },
        용도목적: {
            question: "어디에 사용할 이미지인가요?",
            options: ["SNS 프로필", "유튜브 썸네일", "포스터/광고", "개인 소장", "기타"]
        }
    };
    
    const selectedQuestions = [];
    
    // 부족한 정보 기반으로 질문 선택
    missingInfo.forEach(info => {
        if (fallbackMap[info] && selectedQuestions.length < 4) {
            selectedQuestions.push(fallbackMap[info]);
        }
    });
    
    // 부족하면 기본 질문 추가
    if (selectedQuestions.length === 0) {
        selectedQuestions.push(
            fallbackMap.주제디테일,
            fallbackMap.배경정보
        );
    }
    
    return selectedQuestions;
}

// =============================================================================
// 🎯 Step 3: 최종 영문 프롬프트 생성
// =============================================================================

async function handleFinalImprove(userInput, answers, round, res) {
    console.log('🎯 Step 3: 최종 영문 프롬프트 생성');
    
    try {
        // 1. 모든 정보 종합
        const allInfo = {
            original: userInput,
            answers: answers,
            round: round
        };
        
        console.log('📊 종합 정보:', allInfo);
        
        // 2. 영문 프롬프트 생성
        const englishPrompt = await generateEnglishImagePrompt(allInfo);
        
        // 🎨 3. 이미지 전용 평가 시스템 사용!
        const evaluation = evaluateImagePrompt(englishPrompt, userInput, answers);
        
        console.log('📊 이미지 전용 평가 결과:', evaluation);
        
        // 4. 자동 반복 판단 (전문가모드 + 90점 미만)
        const shouldContinue = evaluation.total < 90 && round < 5; // 최대 5라운드로 증가
        
        // 🔥 5. 90점 미만이면 강제 개선!
        if (shouldContinue) {
            console.log(`🔄 ${evaluation.total}점으로 90점 미만! 프롬프트 강제 개선 시작`);
            
            // AI에게 현재 프롬프트의 문제점 찾아서 개선 요청
            const improvedPrompt = await forceImprovePrompt(englishPrompt, evaluation, round);
            
            // 개선된 프롬프트 재평가
            const reEvaluation = evaluateImagePrompt(improvedPrompt, userInput, answers);
            
            console.log('📈 재평가 결과:', reEvaluation);
            
            return res.json({
                improved_prompt: improvedPrompt,
                score: reEvaluation.total,
                improvements: reEvaluation.improvements,
                evaluation_details: reEvaluation.details,
                domain: 'visual_design',
                round: round,
                should_continue: reEvaluation.total < 90 && round < 5,
                completed: reEvaluation.total >= 90 || round >= 5,
                language: 'english',
                force_improved: true,
                previous_score: evaluation.total,
                score_improvement: reEvaluation.total - evaluation.total,
                message: `강제 개선 완료! ${evaluation.total}점 → ${reEvaluation.total}점 (${reEvaluation.total - evaluation.total > 0 ? '+' : ''}${reEvaluation.total - evaluation.total}점)`
            });
        }
        
        // 90점 이상이면 완료
        return res.json({
            improved_prompt: englishPrompt,
            score: evaluation.total,
            improvements: evaluation.improvements,
            evaluation_details: evaluation.details,
            domain: 'visual_design',
            round: round,
            should_continue: false,
            completed: true,
            language: 'english',
            message: `🎉 목표 달성! ${evaluation.total}점의 전문가급 이미지 프롬프트 완성!`
        });
        
    } catch (error) {
        console.error('❌ Step 3 오류:', error);
        
        // 폴백: 기본 영문 프롬프트 + 강제 개선
        const fallbackPrompt = generateFallbackEnglishPrompt(userInput, answers);
        const fallbackEvaluation = evaluateImagePrompt(fallbackPrompt, userInput, answers);
        
        // 폴백도 90점 미만이면 강제 개선
        let finalPrompt = fallbackPrompt;
        let finalScore = fallbackEvaluation.total;
        
        if (finalScore < 90) {
            try {
                finalPrompt = await forceImprovePrompt(fallbackPrompt, fallbackEvaluation, round);
                const reEval = evaluateImagePrompt(finalPrompt, userInput, answers);
                finalScore = reEval.total;
            } catch (forceError) {
                console.warn('⚠️ 강제 개선도 실패, 수동 개선 시도');
                finalPrompt = manualImprovePrompt(fallbackPrompt, fallbackEvaluation.details);
                const manualEval = evaluateImagePrompt(finalPrompt, userInput, answers);
                finalScore = manualEval.total;
            }
        }
        
        return res.json({
            improved_prompt: finalPrompt,
            score: finalScore,
            improvements: ['기본 영문 변환 + 강제 개선 완료'],
            domain: 'visual_design',
            round: round,
            completed: true,
            language: 'english',
            fallback: true,
            force_improved: finalScore > fallbackEvaluation.total,
            message: `폴백 시스템으로 ${finalScore}점 달성!`
        });
    }
}

// 영문 이미지 프롬프트 생성
async function generateEnglishImagePrompt(allInfo) {
    try {
        const context = `
한국어 입력: "${allInfo.original}"
사용자 답변들: ${allInfo.answers.join('\n')}

이 정보를 바탕으로 AI 이미지 생성기(Midjourney, DALL-E 등)가 완벽하게 이해할 수 있는 
전문가급 영문 프롬프트를 작성해주세요.

요구사항:
1. 영어로 작성
2. 구체적인 스타일, 색상, 구도 포함
3. 기술적 스펙 (해상도, 품질) 명시
4. 부정 명령어 (what to avoid) 포함
5. 100-200 단어 길이

형식:
"Create [subject], [style], [colors], [composition], [technical specs], --no [avoid items]"
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: '당신은 AI 이미지 생성을 위한 전문 프롬프트 작성자입니다. 한국어 정보를 완벽한 영문 프롬프트로 변환해주세요.'
                    },
                    {
                        role: 'user',
                        content: context
                    }
                ],
                temperature: 0.3, // 일관성 위해 낮게
                max_tokens: 500
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API 오류: ${response.status}`);
        }
        
        const result = await response.json();
        let englishPrompt = result.choices[0].message.content.trim();
        
        // 품질 향상을 위한 후처리
        englishPrompt = enhanceImagePrompt(englishPrompt, allInfo);
        
        return englishPrompt;
        
    } catch (error) {
        console.error('❌ 영문 프롬프트 생성 실패:', error);
        throw error;
    }
}

// 영문 프롬프트 품질 향상
function enhanceImagePrompt(prompt, allInfo) {
    let enhanced = prompt;
    
    // 기본 품질 키워드 추가
    if (!enhanced.includes('quality')) {
        enhanced += ', high quality, masterpiece';
    }
    
    // 해상도 정보 추가
    if (!enhanced.includes('4K') && !enhanced.includes('HD')) {
        enhanced += ', 4K resolution';
    }
    
    // 스타일 일관성 추가
    if (!enhanced.includes('consistent')) {
        enhanced += ', consistent style';
    }
    
    // 부정 명령어 강화
    if (!enhanced.includes('--no')) {
        enhanced += ' --no blurry, low quality, watermark, text overlay';
    }
    
    return enhanced;
}

// 🔥 강제 프롬프트 개선 함수 (핵심!)
async function forceImprovePrompt(currentPrompt, evaluation, round) {
    console.log('🔥 강제 프롬프트 개선 시작');
    
    try {
        // 평가 결과에서 부족한 부분 파악
        const weakPoints = identifyWeakPoints(evaluation.details);
        console.log('📉 부족한 부분:', weakPoints);
        
        const improveContext = `
현재 영문 프롬프트: "${currentPrompt}"

평가 결과: ${evaluation.total}/96점
부족한 부분: ${weakPoints.join(', ')}

이 프롬프트를 다음 기준으로 개선해주세요:

${generateImprovementInstructions(weakPoints)}

목표: 90점+ 달성
결과: 개선된 영문 프롬프트만 출력 (설명 없이)
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: '당신은 AI 이미지 생성 프롬프트 개선 전문가입니다. 기존 프롬프트의 약점을 찾아 완벽하게 개선해주세요.'
                    },
                    {
                        role: 'user',
                        content: improveContext
                    }
                ],
                temperature: 0.4,
                max_tokens: 600
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API 오류: ${response.status}`);
        }
        
        const result = await response.json();
        let improvedPrompt = result.choices[0].message.content.trim();
        
        // 개선된 프롬프트 후처리
        improvedPrompt = postProcessImprovedPrompt(improvedPrompt, weakPoints);
        
        console.log('✨ 강제 개선 완료:', improvedPrompt);
        return improvedPrompt;
        
    } catch (error) {
        console.error('❌ 강제 개선 실패:', error);
        
        // 폴백: 수동 개선
        return manualImprovePrompt(currentPrompt, evaluation.details);
    }
}

// 평가 결과에서 부족한 부분 파악
function identifyWeakPoints(evaluationDetails) {
    const weakPoints = [];
    
    Object.entries(evaluationDetails).forEach(([key, result]) => {
        if (result.score < 6) { // 8점 만점에서 6점 미만
            weakPoints.push(key);
        }
    });
    
    return weakPoints;
}

// 개선 지시사항 생성
function generateImprovementInstructions(weakPoints) {
    const instructionMap = {
        주체구체화: "- 주체를 더 구체적으로: 정확한 품종, 크기, 나이, 특징 추가",
        감정표정: "- 감정 표현 강화: 구체적 눈빛, 표정, 미묘한 감정 상태 추가",
        포즈동작: "- 포즈 디테일 추가: 정확한 자세, 각도, 손발 위치, 움직임 묘사",
        배경설정: "- 배경 상세화: 구체적 장소, 환경 디테일, 소품, 분위기 추가",
        조명정보: "- 조명 전문화: 조명 종류, 방향, 강도, 색온도, 그림자 설정",
        카메라구도: "- 카메라 설정 추가: 구도 법칙, 초점, 앵글, 거리감 명시",
        예술스타일: "- 스타일 구체화: 구체적 작가, 스튜디오, 세부 기법 언급",
        색상팔레트: "- 색상 정확화: 구체적 색상명, 조합, 채도, 명도 설정",
        품질지시어: "- 품질 키워드 강화: masterpiece, award-winning, gallery quality 추가",
        참고플랫폼: "- 참고 사이트 추가: trending on ArtStation, featured on Behance",
        부정명령어: "- 부정 명령어 강화: --no blurry, low quality, dark, watermark, text",
        기술스펙: "- 기술 사양 추가: 4K resolution, 16:9 ratio, PNG format, 300 DPI"
    };
    
    return weakPoints.map(point => instructionMap[point] || `- ${point} 개선 필요`).join('\n');
}

// 개선된 프롬프트 후처리
function postProcessImprovedPrompt(prompt, weakPoints) {
    let processed = prompt;
    
    // 따옴표 제거
    processed = processed.replace(/^["']|["']$/g, '');
    
    // 기본 품질 키워드 강제 추가 (부족한 경우)
    if (weakPoints.includes('품질지시어') && !processed.includes('masterpiece')) {
        processed += ', masterpiece quality';
    }
    
    // 부정 명령어 강제 추가 (부족한 경우)
    if (weakPoints.includes('부정명령어') && !processed.includes('--no')) {
        processed += ' --no blurry, low quality, watermark';
    }
    
    // 기술 스펙 강제 추가 (부족한 경우)
    if (weakPoints.includes('기술스펙') && !processed.includes('4K')) {
        processed += ', 4K resolution';
    }
    
    return processed;
}

// 수동 개선 (AI 실패시 폴백)
function manualImprovePrompt(currentPrompt, evaluationDetails) {
    console.log('🔄 수동 개선 시작');
    
    let improved = currentPrompt;
    
    // 각 약점별로 수동 개선
    Object.entries(evaluationDetails).forEach(([key, result]) => {
        if (result.score < 6) {
            switch(key) {
                case '주체구체화':
                    improved = improved.replace(/dog/gi, 'golden retriever puppy');
                    improved = improved.replace(/cat/gi, 'domestic shorthair cat');
                    break;
                case '감정표정':
                    if (!improved.includes('eyes')) {
                        improved += ', bright curious eyes';
                    }
                    break;
                case '품질지시어':
                    if (!improved.includes('masterpiece')) {
                        improved += ', masterpiece quality, studio lighting';
                    }
                    break;
                case '부정명령어':
                    if (!improved.includes('--no')) {
                        improved += ' --no blurry, low quality, dark shadows';
                    }
                    break;
                case '기술스펙':
                    if (!improved.includes('4K')) {
                        improved += ', 4K resolution, high detail';
                    }
                    break;
            }
        }
    });
    
    return improved;
}

// 폴백 영문 프롬프트 생성
function generateFallbackEnglishPrompt(userInput, answers) {
    console.log('🔄 폴백 영문 프롬프트 생성');
    
    // 기본 번역 + 품질 키워드
    let prompt = `Create ${userInput.replace(/그려줘|만들어줘|생성해줘/g, 'artwork')}`;
    
    // 답변에서 스타일 정보 추출
    const answerText = answers.join(' ').toLowerCase();
    
    if (answerText.includes('사실적')) prompt += ', photorealistic style';
    else if (answerText.includes('3d')) prompt += ', 3D rendered style';
    else if (answerText.includes('애니메이션')) prompt += ', anime style';
    else if (answerText.includes('일러스트')) prompt += ', illustration style';
    else prompt += ', digital art style';
    
    // 기본 품질 추가
    prompt += ', high quality, detailed, 4K resolution, masterpiece';
    prompt += ' --no blurry, low quality, watermark';
    
    return prompt;
}

console.log('🎨 이미지 도메인 API + 전용 평가 시스템 로드 완료!');
