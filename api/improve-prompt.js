// api/improve-prompt.js - 100% 동작하는 간단 버전

export default async function handler(req, res) {
    console.log('=== API 호출 시작 ===');
    console.log('Method:', req.method);
    
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed' 
        });
    }
    
    try {
        const { step, userInput, questions, answers, isExpertMode } = req.body;
        
        console.log('=== 요청 데이터 ===');
        console.log('Step:', step);
        console.log('UserInput:', userInput);
        console.log('ExpertMode:', isExpertMode);
        
        // 각 단계별 응답 생성
        let result;
        
        switch (step) {
            case 'questions':
                result = generateQuestions(userInput, isExpertMode);
                break;
                
            case 'final-improve':
                result = generateImprovedPrompt(userInput, answers, isExpertMode);
                break;
                
            case 'evaluate':
                result = generateEvaluation(userInput);
                break;
                
            case 'auto-improve':
                result = generateAutoImprovement(userInput);
                break;
                
            default:
                result = `${userInput}에 대한 응답을 처리했습니다.`;
        }
        
        console.log('=== 응답 생성 완료 ===');
        console.log('Result length:', result?.length || 0);
        
        res.json({ 
            success: true, 
            result: result
        });
        
    } catch (error) {
        console.error('=== API 오류 ===', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || '서버 내부 오류가 발생했습니다.' 
        });
    }
}

// 질문 생성 함수
function generateQuestions(userInput, isExpertMode) {
    console.log('질문 생성 중...');
    
    // 입력 내용 분석
    const input = userInput.toLowerCase();
    let questions = [];
    
    // 도메인 감지 및 적절한 질문 생성
    if (input.includes('그림') || input.includes('이미지') || input.includes('사진') || input.includes('디자인')) {
        questions = [
            {
                question: "어떤 스타일의 그림을 원하시나요?",
                type: "choice",
                options: ["사실적", "만화적", "3D", "수채화", "기타"]
            },
            {
                question: "주요 색상 톤을 선택해주세요.",
                type: "choice",
                options: ["밝은 톤", "어두운 톤", "무채색", "화려한 색상", "기타"]
            },
            {
                question: "어떤 해상도나 크기가 필요한가요?",
                type: "choice",
                options: ["4K (고해상도)", "HD (일반)", "인스타그램용", "프린트용", "기타"]
            }
        ];
    } else if (input.includes('영상') || input.includes('비디오') || input.includes('동영상')) {
        questions = [
            {
                question: "영상의 길이는 어느 정도가 좋을까요?",
                type: "choice",
                options: ["15초 이하", "1-3분", "5분 이상", "상관없음"]
            },
            {
                question: "영상의 스타일을 선택해주세요.",
                type: "choice",
                options: ["실사", "애니메이션", "3D", "슬라이드쇼", "기타"]
            },
            {
                question: "배경음악이나 효과음이 필요한가요?",
                type: "choice",
                options: ["필요", "불필요", "나중에 결정", "기타"]
            }
        ];
    } else if (input.includes('웹사이트') || input.includes('사이트') || input.includes('홈페이지')) {
        questions = [
            {
                question: "웹사이트의 주요 목적은 무엇인가요?",
                type: "choice",
                options: ["회사 소개", "온라인 쇼핑몰", "포트폴리오", "블로그", "기타"]
            },
            {
                question: "선호하는 디자인 스타일은?",
                type: "choice",
                options: ["모던", "클래식", "미니멀", "화려함", "기타"]
            },
            {
                question: "주요 기능이 있다면 알려주세요.",
                type: "choice",
                options: ["회원가입/로그인", "결제 시스템", "게시판", "검색 기능", "기타"]
            }
        ];
    } else {
        // 일반적인 질문
        questions = [
            {
                question: "어떤 스타일이나 톤을 원하시나요?",
                type: "choice",
                options: ["공식적", "친근한", "전문적", "창의적", "기타"]
            },
            {
                question: "주요 목적이나 용도는 무엇인가요?",
                type: "choice",
                options: ["업무용", "개인용", "교육용", "상업용", "기타"]
            },
            {
                question: "특별히 고려해야 할 요소가 있나요?",
                type: "choice",
                options: ["시간 제약", "예산 제약", "기술적 제약", "상관없음", "기타"]
            }
        ];
    }
    
    // 전문가 모드면 더 자세한 질문 추가
    if (isExpertMode) {
        questions.push({
            question: "추가로 고려해야 할 세부사항이 있나요?",
            type: "choice",
            options: ["성능 최적화", "접근성", "반응형 디자인", "SEO", "기타"]
        });
    }
    
    const response = {
        detectedCategory: detectCategory(userInput),
        questions: questions.slice(0, isExpertMode ? 8 : 6)
    };
    
    return JSON.stringify(response);
}

// 개선된 프롬프트 생성
function generateImprovedPrompt(userInput, answers, isExpertMode) {
    console.log('프롬프트 개선 중...');
    
    let improvedPrompt = `다음과 같이 "${userInput}"을 상세하게 구현해주세요:\n\n`;
    
    // 기본 요구사항 추가
    improvedPrompt += `주제: ${userInput}\n`;
    
    // 답변 내용 반영
    if (answers) {
        improvedPrompt += `사용자 요구사항:\n`;
        const answerText = typeof answers === 'string' ? answers : JSON.stringify(answers);
        improvedPrompt += `${answerText}\n\n`;
    }
    
    // 전문가 모드면 더 상세한 요구사항 추가
    if (isExpertMode) {
        improvedPrompt += `세부 요구사항:\n`;
        improvedPrompt += `- 고품질의 전문적인 결과물 제작\n`;
        improvedPrompt += `- 모든 기술적 사양과 세부사항 포함\n`;
        improvedPrompt += `- 사용자의 의도를 정확히 반영\n`;
        improvedPrompt += `- 완성도 높은 최종 결과물 생성\n\n`;
    }
    
    improvedPrompt += `위 요구사항을 모두 반영하여 정확하고 완성도 높은 결과물을 만들어주세요.`;
    
    return improvedPrompt;
}

// 평가 생성
function generateEvaluation(prompt) {
    console.log('평가 생성 중...');
    
    // 간단한 평가 로직
    let score = 70; // 기본 점수
    
    // 길이에 따른 점수 조정
    if (prompt.length > 200) score += 10;
    if (prompt.length > 500) score += 5;
    
    // 구체적 요소가 있으면 점수 추가
    if (prompt.match(/\d+/)) score += 5; // 숫자 포함
    if (prompt.includes('구체적') || prompt.includes('상세')) score += 5;
    if (prompt.includes('요구사항') || prompt.includes('조건')) score += 5;
    
    // 최대 95점으로 제한
    score = Math.min(95, score);
    
    const evaluation = {
        score: score,
        strengths: [
            "기본적인 요구사항이 포함되어 있습니다",
            "이해하기 쉽게 구성되어 있습니다"
        ],
        improvements: [
            "더 구체적인 세부사항을 추가하면 좋겠습니다",
            "기술적 요구사항을 더 명확히 할 수 있습니다"
        ],
        recommendation: score >= 85 ? 
            "우수한 품질의 프롬프트입니다!" : 
            "좋은 품질이지만 더 개선할 수 있습니다."
    };
    
    return JSON.stringify(evaluation);
}

// 자동 개선
function generateAutoImprovement(currentPrompt) {
    console.log('자동 개선 중...');
    
    let improved = currentPrompt;
    
    // 더 구체적인 표현 추가
    improved += `\n\n추가 개선사항:\n`;
    improved += `- 최고 품질의 결과물 제작\n`;
    improved += `- 모든 세부사항을 정확히 반영\n`;
    improved += `- 전문적이고 완성도 높은 출력\n`;
    improved += `- 사용자 만족도 최우선 고려`;
    
    return improved;
}

// 카테고리 감지
function detectCategory(input) {
    const categories = {
        '이미지/디자인': ['그림', '이미지', '사진', '디자인', '로고'],
        '영상/비디오': ['영상', '비디오', '동영상', '애니메이션'],
        '웹개발': ['웹사이트', '사이트', '홈페이지', '앱', '개발'],
        '텍스트/문서': ['글', '문서', '보고서', '기사', '편지'],
        '기타': []
    };
    
    const inputLower = input.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => inputLower.includes(keyword))) {
            return category;
        }
    }
    
    return '기타';
}
