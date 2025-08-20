// server.js - Express 서버
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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

// AI 프롬프트 개선 API
app.post('/api/improve-prompt', async (req, res) => {
    try {
        const { userInput, category, questions, answers, step } = req.body;
        
        console.log('API 요청:', { step, userInput: userInput?.substring(0, 50) + '...' });
        
        let systemPrompt = '';
        let userPrompt = '';
        
        if (step === 'questions') {
            // 재질문 생성
            systemPrompt = getQuestionGenerationPrompt(category);
            userPrompt = `사용자 입력: "${userInput}"`;
        } else if (step === 'improve') {
            // 프롬프트 개선
            systemPrompt = getImprovementPrompt(category);
            userPrompt = buildImprovementPrompt(userInput, questions, answers);
        } else if (step === 'evaluate') {
            // 품질 평가
            systemPrompt = getEvaluationPrompt();
            userPrompt = `평가할 프롬프트: "${userInput}"`;
        } else if (step === 'auto-improve') {
            // 자동 개선
            systemPrompt = getAutoImprovementPrompt(category);
            userPrompt = `현재 프롬프트: "${userInput}"\n\n이 프롬프트를 9점급으로 자동 개선해주세요.`;
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
                temperature: step === 'questions' ? 0.3 : 0.7,
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

// 재질문 생성 프롬프트
function getQuestionGenerationPrompt(category) {
    const categoryPrompts = {
        mcp: `당신은 MCP (Model Context Protocol) 전문가입니다. 사용자의 MCP 서버 개발 요청을 분석하고, 더 효과적인 MCP 서버를 개발하기 위해 필요한 3-4개의 핵심 질문을 만들어주세요.

질문 영역:
- 서버 기능 및 도구 유형
- 데이터 소스 및 연동 방식
- 보안 및 인증 요구사항
- 성능 및 확장성

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "질문 내용",
      "type": "choice",
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}`,

        website: `당신은 웹사이트 개발 전문가입니다. 더 효과적인 웹사이트를 만들기 위한 3-4개의 핵심 질문을 만들어주세요.

질문 영역:
- 웹사이트 목적 및 타겟 사용자
- 디자인 스타일 및 브랜딩
- 기능 요구사항 및 상호작용
- 반응형 및 성능 최적화

JSON 형식으로 응답해주세요.`,

        data: `당신은 데이터 분석 전문가입니다. 더 정확하고 인사이트 있는 데이터 분석을 위한 3-4개의 핵심 질문을 만들어주세요.

질문 영역:
- 데이터 유형 및 규모
- 분석 목적 및 가설
- 시각화 및 리포트 형식
- 도구 및 방법론

JSON 형식으로 응답해주세요.`,

        presentation: `당신은 프레젠테이션 전문가입니다. 더 효과적이고 설득력 있는 프레젠테이션을 위한 3-4개의 핵심 질문을 만들어주세요.

질문 영역:
- 발표 목적 및 청중
- 구조 및 스토리텔링
- 디자인 및 시각 요소
- 발표 방식 및 상호작용

JSON 형식으로 응답해주세요.`
    };

    return categoryPrompts[category] || categoryPrompts.mcp;
}

// 프롬프트 개선 시스템 프롬프트
function getImprovementPrompt(category) {
    return `당신은 ${category} 분야의 최고 전문가이자 프롬프트 엔지니어링 마스터입니다.

사용자의 초기 입력과 추가 정보를 바탕으로 최고 품질의 프롬프트를 작성해주세요.

개선 기준:
1. 명확성: 모호함 없이 구체적으로
2. 완성도: 필요한 모든 요소 포함
3. 구조화: 논리적이고 체계적으로
4. 실행가능성: 바로 실행 가능하도록
5. 전문성: 분야별 전문 용어와 기법 활용

최종 프롬프트만 제공하고, 설명은 생략하세요.`;
}

// 품질 평가 프롬프트
function getEvaluationPrompt() {
    return `당신은 프롬프트 품질 평가 전문가입니다. 주어진 프롬프트를 다음 기준으로 10점 만점으로 평가해주세요:

1. 명확성 (구체적이고 이해하기 쉬운가?)
2. 완성도 (필요한 정보가 모두 포함되어 있는가?)
3. 구조화 (논리적으로 잘 구성되어 있는가?)
4. 실행가능성 (실제로 구현/실행 가능한가?)
5. 전문성 (해당 분야의 전문 용어와 개념이 정확한가?)

JSON 형식으로 응답:
{
  "score": 점수(1-10),
  "strengths": ["강점1", "강점2"],
  "improvements": ["개선점1", "개선점2"],
  "needsReimprovement": true/false,
  "recommendation": "추가 개선 방향"
}`;
}

// 자동 개선 프롬프트
function getAutoImprovementPrompt(category) {
    return `당신은 ${category} 분야의 최고 전문가입니다. 주어진 프롬프트를 9점 이상 수준으로 자동 개선해주세요.

9점급 프롬프트 필수 요소:
1. 구체적이고 명확한 요구사항 명시
2. 기술적 세부사항 및 제약조건 포함
3. 예상 결과물의 형태와 기준 제시
4. 실행 가능한 단계별 지침
5. 성공 측정 방법 명시

개선된 프롬프트만 제공하세요.`;
}

// 개선 프롬프트 구성
function buildImprovementPrompt(userInput, questions, answers) {
    let prompt = `원본 프롬프트: "${userInput}"\n\n사용자 추가 정보:\n`;
    
    if (questions && answers) {
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

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 AI 프롬프트 개선기 서버가 포트 ${PORT}에서 실행 중입니다!`);
    console.log(`📱 로컬에서 테스트: http://localhost:${PORT}`);
    
    if (!OPENAI_API_KEY) {
        console.warn('⚠️  OPENAI_API_KEY 환경변수가 설정되지 않았습니다!');
    }
});
