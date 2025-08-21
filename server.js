// server.js - Express 서버 (v4.0 - 카테고리 제거 + 100점 시스템)
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// API 키 확인
console.log('API 키 확인:', process.env.OPENAI_API_KEY ? '있음' : '없음');
console.log('API 키 앞 10자리:', process.env.OPENAI_API_KEY?.substring(0, 10));

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// 환경변수에서 API 키 가져오기
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 메인 페이지 제공
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// AI 프롬프트 개선 API (v4.0)
app.post('/api/improve-prompt', async (req, res) => {
    try {
        const { userInput, questions, answers, step, previousQuestions, previousAnswers } = req.body;
        
        console.log('API 요청:', { step, userInput: userInput?.substring(0, 50) + '...' });
        
        let systemPrompt = '';
        let userPrompt = '';
        
        if (step === 'questions') {
            // 재질문 생성 (카테고리 자동 판단)
            systemPrompt = getAdaptiveQuestionPrompt();
            userPrompt = `사용자 입력: "${userInput}"`;
        } else if (step === 'additional-questions') {
            // 🆕 추가 질문 생성
            systemPrompt = getAdditionalQuestionPrompt();
            userPrompt = `
원본 입력: "${userInput}"
기존 질문들: ${JSON.stringify(previousQuestions)}
기존 답변들: "${previousAnswers}"

현재 답변을 바탕으로 더 구체적이고 깊이 있는 추가 질문 2-3개를 생성해주세요.
기존 질문과 중복되지 않는 새로운 관점의 질문으로 만들어주세요.
            `;
        } else if (step === 'improve') {
            // 프롬프트 개선 (카테고리 자동 판단)
            systemPrompt = getAdaptiveImprovementPrompt();
            userPrompt = buildImprovementPrompt(userInput, questions, answers);
        } else if (step === 'evaluate') {
            // 품질 평가 (100점 만점)
            systemPrompt = getEvaluationPrompt100();
            userPrompt = `평가할 프롬프트: "${userInput}"`;
        } else if (step === 'auto-improve') {
            // 자동 개선 (95점 기준)
            systemPrompt = getAutoImprovementPrompt();
            userPrompt = `현재 프롬프트: "${userInput}"\n\n이 프롬프트를 95점급으로 자동 개선해주세요.`;
        }

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
                temperature: step === 'questions' || step === 'additional-questions' ? 0.3 : 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('OpenAI API 오류:', response.status, errorData);
            throw new Error(`OpenAI API 오류: ${response.status}`);
        }

        const data = await response.json();
        const result = data.choices[0].message.content;

        console.log('API 응답 성공');
        res.json({ 
            success: true, 
            result: result,
            usage: data.usage 
        });

    } catch (error) {
        console.error('서버 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || '서버 내부 오류가 발생했습니다.' 
        });
    }
});

// 🆕 적응형 질문 생성 프롬프트 (카테고리 자동 판단)
function getAdaptiveQuestionPrompt() {
    return `당신은 프롬프트 개선 전문가입니다. 사용자의 입력을 분석해서 분야를 자동으로 판단하고, 해당 분야에 최적화된 3-4개의 핵심 질문을 만들어주세요.

단계:
1. 사용자 입력 분석 → 분야 자동 판단
2. 해당 분야에 맞는 핵심 질문 생성

분야별 질문 초점:
- 개발/코딩: 기술스택, 기능요구사항, 성능조건, 아키텍처
- 이미지/영상: 스타일, 색상, 구도, 분위기, 해상도
- 글쓰기/번역: 톤앤매너, 타겟독자, 형식, 길이
- 데이터분석: 데이터유형, 분석목적, 시각화형태, 인사이트
- 웹사이트: 목적, 타겟사용자, 디자인스타일, 필요기능
- 비즈니스: 목표, 타겟고객, 예산, 일정
- 일상대화: 맥락, 관계, 목적, 톤

JSON 형식으로 응답:
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

// 🆕 추가 질문 생성 프롬프트
function getAdditionalQuestionPrompt() {
    return `당신은 프롬프트 개선 전문가입니다. 사용자의 기존 답변을 분석해서 더 구체적이고 깊이 있는 추가 질문 2-3개를 생성해주세요.

목표:
- 기존 답변에서 부족한 부분 파악
- 더 구체적인 세부사항 요청
- 새로운 관점의 질문 추가
- 기존 질문과 중복 방지

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "추가 질문 내용",
      "type": "choice",
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}`;
}

// 🆕 적응형 프롬프트 개선 시스템 프롬프트
function getAdaptiveImprovementPrompt() {
    return `당신은 모든 분야의 최고 전문가이자 프롬프트 엔지니어링 마스터입니다.

사용자의 초기 입력을 분석해서 분야를 자동으로 판단하고, 해당 분야에 최적화된 최고 품질의 프롬프트를 작성해주세요.

분야별 개선 전략:
- 개발: 기술스택, 아키텍처, 기능명세, 성능요구사항, 예외처리
- 이미지생성: 스타일, 구도, 조명, 색감, 디테일, 화질
- 글쓰기: 목적, 독자, 톤, 구조, 형식, 길이
- 데이터분석: 목표, 방법론, 시각화, 인사이트 도출
- 웹사이트: UX/UI, 반응형, 접근성, 성능, SEO
- 비즈니스: 목표, 전략, 지표, 타임라인

개선 기준:
1. 명확성: 모호함 없이 구체적으로
2. 완성도: 필요한 모든 요소 포함
3. 구조화: 논리적이고 체계적으로
4. 실행가능성: 바로 실행 가능하도록
5. 전문성: 분야별 전문 용어와 기법 활용

최종 프롬프트만 제공하고, 설명은 생략하세요.`;
}

// 🆕 품질 평가 프롬프트 (100점 만점)
function getEvaluationPrompt100() {
    return `당신은 프롬프트 품질 평가 전문가입니다. 주어진 프롬프트를 100점 만점으로 평가해주세요.

AI가 이 프롬프트를 받았을 때 얼마나 정확하고 유용한 결과를 낼 수 있을지를 기준으로 평가하세요.

평가 관점:
- 얼마나 구체적이고 명확한가?
- 필요한 정보가 충분히 포함되어 있는가?
- 실제로 실행 가능한 수준인가?
- 애매하거나 모호한 부분이 있는가?
- AI가 이해하기 쉬운 구조인가?

점수 가이드:
- 95-100점: AI가 완벽하게 이해하고 최고 품질 결과 생성 가능
- 85-94점: 매우 좋음, 고품질 결과 예상
- 75-84점: 양호, 괜찮은 결과 예상  
- 65-74점: 보통, 기본적인 결과 예상
- 65점 미만: 부족, 개선 필요

JSON 응답:
{
  "score": 점수(1-100),
  "strengths": ["강점1", "강점2"],
  "improvements": ["개선점1", "개선점2"],
  "needsReimprovement": true/false,
  "recommendation": "추가 개선 방향"
}`;
}

// 🆕 자동 개선 프롬프트 (95점 기준)
function getAutoImprovementPrompt() {
    return `당신은 프롬프트 개선 전문가입니다. 주어진 프롬프트를 95점 이상 수준으로 자동 개선해주세요.

95점급 프롬프트 필수 요소:
1. 명확한 역할 정의 ("당신은 ~전문가입니다")
2. 구체적이고 상세한 요구사항 명시
3. 원하는 출력 형식과 구조 지정
4. 기술적 세부사항 및 제약조건 포함
5. 예상 결과물의 형태와 품질 기준 제시
6. 실행 가능한 단계별 지침 (필요시)
7. 성공 측정 방법 명시 (필요시)
8. 맥락과 배경 정보 포함
9. 톤앤매너나 스타일 가이드 명시
10. 구체적인 예시나 참고자료 제시 (필요시)

개선 원칙:
- "대충", "적당히", "좋게" 같은 애매한 표현 제거
- 구체적인 수치, 색상, 스타일 명시
- 전문 용어와 정확한 기술명 사용
- 단계별 구조화된 지시사항
- 예외상황과 대안 고려

개선된 프롬프트만 응답하세요.`;
}

// 개선 프롬프트 구성 (카테고리 제거)
function buildImprovementPrompt(userInput, questions, answers) {
    let prompt = `원본 프롬프트: "${userInput}"\n\n`;
    
    if (questions && answers) {
        prompt += `사용자 추가 정보:\n`;
        Object.entries(answers).forEach(([index, answer]) => {
            const question = questions[parseInt(index)]?.question || `질문 ${parseInt(index) + 1}`;
            const answerText = Array.isArray(answer) ? answer.join(', ') : answer;
            prompt += `Q: ${question}\nA: ${answerText}\n\n`;
        });
    }
    
    prompt += `위 정보를 바탕으로 원본 프롬프트를 훨씬 더 효과적이고 구체적으로 개선해주세요.

중요한 규칙:
1. 사용자가 제공한 정보를 정확히 그대로 반영하세요
2. 사용자가 선택한 옵션이나 입력한 내용을 바꾸거나 반대로 해석하지 마세요
3. 모든 답변 내용을 빠뜨리지 말고 포함하세요
4. 사용자가 명시한 것만 사용하고 추측하지 마세요

개선 지침:
1. 명확하고 구체적인 지시사항으로 변경
2. 원하는 결과물의 형식과 스타일 명시
3. 사용자가 제공한 모든 컨텍스트와 요구사항 포함
4. AI가 이해하기 쉬운 구조로 작성
5. 사용자의 모든 답변을 정확히 반영

개선된 프롬프트만 응답해주세요:`;
    
    return prompt;
}

// 🆕 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        version: '4.0',
        features: [
            'AI 자동 분야 판단',
            '100점 만점 품질 평가',
            '95점 기준 고품질 시스템', 
            '추가 질문 생성',
            '완전 자동화 개선'
        ],
        timestamp: new Date().toISOString()
    });
});

// 🆕 통계 엔드포인트 (개발용)
app.get('/api/stats', (req, res) => {
    res.json({
        totalRequests: 'N/A (개발 중)',
        averageScore: 'N/A (개발 중)',
        topCategories: [
            '개발/코딩',
            '이미지 생성', 
            '글쓰기/번역',
            '웹사이트 개발',
            '데이터 분석'
        ]
    });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 AI 프롬프트 개선기 v4.0 서버가 포트 ${PORT}에서 실행 중입니다!`);
    console.log(`📱 로컬에서 테스트: http://localhost:${PORT}`);
    console.log(`✨ 새로운 기능:`);
    console.log(`   - 카테고리 자동 판단`);
    console.log(`   - 100점 만점 품질 평가`);
    console.log(`   - 95점 기준 고품질 시스템`);
    console.log(`   - 추가 질문 생성 기능`);
    console.log(`   - 완전 자동화 개선 시스템`);
    
    if (!OPENAI_API_KEY) {
        console.warn('⚠️  OPENAI_API_KEY 환경변수가 설정되지 않았습니다!');
    } else {
        console.log('✅ OpenAI API 키 확인됨');
    }
});
