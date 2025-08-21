// server.js - Express 서버 (v5.0 - 일반/전문가 모드 + 의도 파악 시스템)
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

// AI 프롬프트 개선 API (v5.0)
app.post('/api/improve-prompt', async (req, res) => {
    try {
        const { 
            userInput, 
            questions, 
            answers, 
            step, 
            isExpertMode, 
            round, 
            previousAnswers,
            currentImproved,
            additionalAnswers,
            currentScore,
            rounds
        } = req.body;
        
        console.log('API 요청:', { 
            step, 
            isExpertMode, 
            round, 
            userInput: userInput?.substring(0, 50) + '...' 
        });
        
        let systemPrompt = '';
        let userPrompt = '';
        
        if (step === 'questions') {
            // 질문 생성 (일반/전문가 모드 지원)
            systemPrompt = getAdaptiveQuestionPrompt(isExpertMode, round);
            userPrompt = `사용자 입력: "${userInput}"`;
            
            if (round > 0 && previousAnswers) {
                userPrompt += `\n\n이전 답변들:\n${previousAnswers}`;
            }
            
            // 중복 방지를 위한 이전 질문 컨텍스트 추가
            if (previousQuestions) {
                userPrompt += `\n\n이전에 이미 물어본 질문들 (절대 중복 금지):\n${previousQuestions}`;
                userPrompt += `\n\n** 엄격한 중복 금지 규칙 **`;
                userPrompt += `\n- 위 질문들과 키워드나 주제가 겹치면 절대 안됨`;
                userPrompt += `\n- 완전히 새로운 관점에서만 질문 생성`;
                userPrompt += `\n- 같은 단어(스타일, 길이, 감정 등)를 재사용하지 말 것`;
                
                if (isExpertMode && round === 1) {
                    userPrompt += `\n\n1차 심층질문 가이드 (기본질문과 완전히 달라야 함):`;
                    userPrompt += `\n- 기본질문이 "무엇"을 물었다면 → "왜"를 물어보기`;
                    userPrompt += `\n- 기본질문이 "어떤"을 물었다면 → "목적/이유"를 물어보기`;
                    userPrompt += `\n- 예: 스타일→목적, 분위기→타겟관객, 특징→사용용도`;
                } else if (isExpertMode && round === 2) {
                    userPrompt += `\n\n2차 심층질문 가이드 (1차와도 완전히 달라야 함):`;
                    userPrompt += `\n- 실행/제작 관점에서 질문`;
                    userPrompt += `\n- 성과/결과 측정 관점에서 질문`;
                    userPrompt += `\n- 예외상황/제약조건 관점에서 질문`;
                    userPrompt += `\n- 예: 제작기간, 예산, 플랫폼, 성공기준, 위험요소`;
                }
            }
        } else if (step === 'additional-questions') {
            // 추가 질문 생성
            systemPrompt = getAdditionalQuestionPrompt();
            userPrompt = `
원본 입력: "${userInput}"
현재 개선된 프롬프트: "${currentImproved}"
기존 답변들: "${additionalAnswers || answers}"

현재 답변을 바탕으로 점수를 더 높일 수 있는 추가 질문 2-3개를 생성해주세요.
사용자의 숨겨진 의도나 세부 요구사항을 발굴할 수 있는 질문으로 만들어주세요.
            `;
        } else if (step === 'improve') {
            // 프롬프트 개선 (일반/전문가 모드 지원)
            systemPrompt = getAdaptiveImprovementPrompt(isExpertMode, rounds);
            userPrompt = buildImprovementPrompt(userInput, questions, answers, isExpertMode);
        } else if (step === 'improve-with-additional') {
            // 추가 답변 기반 재개선
            systemPrompt = getAdditionalImprovementPrompt();
            userPrompt = `
원본 입력: "${userInput}"
현재 개선된 프롬프트: "${currentImproved}"
추가 답변들: "${additionalAnswers}"

추가 답변을 바탕으로 현재 프롬프트를 더욱 정밀하게 개선해주세요.
사용자의 숨겨진 의도와 요청사항을 정확히 반영해주세요.
            `;
        } else if (step === 'evaluate') {
            // 품질 평가 (90점 기준)
            systemPrompt = getEvaluationPrompt90();
            userPrompt = `평가할 프롬프트: "${userInput}"`;
        } else if (step === 'auto-improve') {
            // 자동 개선 (90점 기준)
            systemPrompt = getAutoImprovementPrompt90();
            userPrompt = `
현재 프롬프트: "${userInput}"
현재 점수: ${currentScore}점

이 프롬프트를 90점 이상으로 자동 개선해주세요.
${isExpertMode ? '전문가모드' : '일반모드'}에 맞는 개선을 진행해주세요.
            `;
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
                max_tokens: 2500
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

// 🆕 적응형 질문 생성 프롬프트 (일반/전문가 모드 지원)
function getAdaptiveQuestionPrompt(isExpertMode, round) {
    const basePrompt = `당신은 프롬프트 개선 전문가입니다. 사용자의 입력을 분석해서 분야를 자동으로 판단하고, 해당 분야에 최적화된 질문을 만들어주세요.

현재 모드: ${isExpertMode ? '전문가모드' : '일반모드'}
현재 라운드: ${round + 1}차`;

    if (isExpertMode) {
        if (round === 0) {
            return basePrompt + `

전문가모드 1차 질문 (기본 정보 파악):
- 1-3개의 핵심 질문으로 기본 정보 파악
- 프로젝트의 목적과 배경 이해
- 타겟 대상과 사용 맥락 파악

분야별 질문 초점:
- 개발/코딩: 기술스택, 아키텍처, 성능요구사항
- 이미지/영상: 스타일, 구도, 색감, 분위기
- 글쓰기/번역: 목적, 독자, 톤앤매너, 형식
- 비즈니스: 목표, 전략, 타겟고객, 예산

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
        } else if (round === 1) {
            return basePrompt + `

전문가모드 2차 질문 (심층 의도 파악):
- 이전 답변을 바탕으로 더 깊은 의도 파악
- 숨겨진 요구사항과 세부 조건 발굴
- 창작자의 진짜 목적과 비전 이해
- 1-3개의 정밀한 질문 생성

** 중요: 이전 질문과 절대 중복되지 않는 새로운 관점의 질문을 만드세요 **

심층 분석 포인트:
- 사용자가 말하지 않은 진짜 의도는 무엇인가?
- 프로젝트의 숨겨진 제약조건은 무엇인가?
- 이상적인 결과물에 대한 구체적 비전은?
- 특별히 강조하거나 피해야 할 요소는?

예시 질문 진화:
기본질문이 "스타일"이었다면 → "왜 그 스타일을 선택했는가? 목적은?"
기본질문이 "기능"이었다면 → "사용자 경험에서 가장 중요한 순간은?"

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "이전과 다른 새로운 관점의 심층 질문",
      "type": "choice", 
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}`;
        } else {
            return basePrompt + `

전문가모드 3차 질문 (최종 세부사항):
- 이전 2차례 답변을 종합하여 마지막 핵심 질문
- 완성도를 높이기 위한 세밀한 디테일 파악
- 실행 시 발생할 수 있는 예외상황 고려
- 1-2개의 최종 확인 질문

** 절대 이전 질문들과 중복되지 않는 완전히 새로운 질문 **

최종 확인 포인트:
- 실제 구현/제작 시 놓칠 수 있는 중요한 요소
- 품질과 완성도를 결정하는 핵심 디테일
- 타겟 사용자/독자의 최종 반응과 목표
- 성공 측정 기준과 평가 방법

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "최종 완성도를 위한 핵심 질문",
      "type": "choice",
      "options": ["옵션1", "옵션2", "옵션3", "기타"]
    }
  ]
}`;
        }
    } else {
        return basePrompt + `

일반모드 질문 생성:
- 사용자 입력의 복잡도에 따라 1-6개 질문 동적 생성
- 간단한 요청: 1-2개 핵심 질문
- 복잡한 요청: 4-6개 세분화 질문
- 빠른 개선을 위한 효율적 질문

분야별 질문 초점:
- 개발/코딩: 기술스택, 기본 기능, 목적
- 이미지/영상: 스타일, 색상, 크기, 용도
- 글쓰기: 톤, 길이, 독자, 형식
- 일반 업무: 목적, 형태, 범위

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
}

// 🆕 추가 질문 생성 프롬프트
function getAdditionalQuestionPrompt() {
    return `당신은 프롬프트 개선 전문가입니다. 현재 개선된 프롬프트의 점수를 더 높이기 위한 추가 질문을 생성해주세요.

목표:
- 현재 프롬프트에서 부족한 부분 파악
- 사용자의 숨겨진 의도나 요구사항 발굴
- 더 구체적이고 정밀한 개선을 위한 정보 수집
- 2-3개의 핵심 추가 질문 생성

추가 질문 초점:
- 현재 프롬프트에서 애매한 부분
- 더 구체화할 수 있는 요소들
- 사용자가 놓친 중요한 고려사항
- 결과물의 품질을 높일 수 있는 세부사항

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

// 🆕 적응형 프롬프트 개선 시스템 프롬프트 (일반/전문가 모드 지원)
function getAdaptiveImprovementPrompt(isExpertMode, rounds) {
    const basePrompt = `당신은 모든 분야의 최고 전문가이자 프롬프트 엔지니어링 마스터입니다.

현재 모드: ${isExpertMode ? '전문가모드' : '일반모드'}
질문 라운드 수: ${rounds || 1}회차

사용자의 초기 입력을 분석해서 분야를 자동으로 판단하고, 해당 분야에 최적화된 최고 품질의 프롬프트를 작성해주세요.`;

    if (isExpertMode) {
        return basePrompt + `

전문가모드 개선 전략:
- 다회차 질문을 통해 수집된 심층 정보 활용
- 사용자의 숨겨진 의도와 요청사항 정확히 반영
- 창작자/전문가 수준의 세밀한 요구사항 포함
- 업계 표준과 베스트 프랙티스 적용

분야별 전문가급 개선:
- 개발: 상세한 아키텍처, 성능 최적화, 보안 고려사항, 확장성
- 이미지생성: 전문적 촬영 기법, 라이팅, 컴포지션, 색상 이론
- 글쓰기: 고급 수사법, 독자 심리, 브랜드 톤앤매너, 전략적 메시징
- 비즈니스: 시장 분석, 경쟁 우위, ROI 고려, 리스크 관리

개선 기준 (전문가급):
1. 전문성: 해당 분야 전문가 수준의 디테일
2. 완성도: 실무에서 바로 활용 가능한 수준
3. 구체성: 모호함 없는 명확한 지시사항
4. 전략성: 목표 달성을 위한 체계적 접근
5. 혁신성: 차별화된 접근법과 창의적 요소

최종 프롬프트만 제공하고, 설명은 생략하세요.`;
    } else {
        return basePrompt + `

일반모드 개선 전략:
- 빠르고 효율적인 개선 중심
- 핵심 요소에 집중한 간결한 프롬프트
- 사용자가 쉽게 이해하고 활용할 수 있는 수준
- 기본적인 품질 기준 충족

분야별 일반 개선:
- 개발: 기본 기능, 주요 기술스택, 기본 요구사항
- 이미지생성: 기본 스타일, 색상, 구도, 품질
- 글쓰기: 기본 톤, 형식, 길이, 목적
- 비즈니스: 기본 목표, 타겟, 방향성

개선 기준 (일반):
1. 명확성: 이해하기 쉽고 구체적으로
2. 실용성: 바로 사용 가능한 수준으로
3. 완성도: 필요한 핵심 요소 포함
4. 효율성: 간결하면서도 효과적으로
5. 접근성: 일반 사용자도 쉽게 활용

최종 프롬프트만 제공하고, 설명은 생략하세요.`;
    }
}

// 🆕 추가 답변 기반 개선 프롬프트
function getAdditionalImprovementPrompt() {
    return `당신은 프롬프트 개선 전문가입니다. 추가 질문에 대한 답변을 바탕으로 현재 프롬프트를 더욱 정밀하게 개선해주세요.

개선 방향:
- 추가 답변에서 드러난 사용자의 숨겨진 의도 반영
- 요청사항에 명시된 세부 조건들 정확히 포함
- 기존 프롬프트의 약점 보완
- 더 높은 품질과 정확도 달성

중요 원칙:
1. 추가 답변의 모든 내용을 빠뜨리지 말고 반영
2. 사용자가 명시한 요청사항을 정확히 해석
3. 기존 프롬프트의 좋은 부분은 유지
4. 새로운 정보로 더 구체화하고 정밀화

개선된 프롬프트만 제공하고, 설명은 생략하세요.`;
}

// 🆕 품질 평가 프롬프트 (90점 기준)
function getEvaluationPrompt90() {
    return `당신은 프롬프트 품질 평가 전문가입니다. 주어진 프롬프트를 100점 만점으로 평가해주세요.

AI가 이 프롬프트를 받았을 때 얼마나 정확하고 유용한 결과를 낼 수 있을지를 기준으로 평가하세요.

평가 관점:
- 얼마나 구체적이고 명확한가?
- 필요한 정보가 충분히 포함되어 있는가?
- 실제로 실행 가능한 수준인가?
- 애매하거나 모호한 부분이 있는가?
- AI가 이해하기 쉬운 구조인가?

점수 가이드:
- 90-100점: AI가 완벽하게 이해하고 고품질 결과 생성 가능
- 80-89점: 매우 좋음, 양질의 결과 예상
- 70-79점: 양호, 괜찮은 결과 예상  
- 60-69점: 보통, 기본적인 결과 예상
- 60점 미만: 부족, 개선 필요

JSON 응답:
{
  "score": 점수(1-100),
  "strengths": ["강점1", "강점2"],
  "improvements": ["개선점1", "개선점2"],
  "needsReimprovement": true/false,
  "recommendation": "개선 방향 제시"
}`;
}

// 🆕 자동 개선 프롬프트 (90점 기준)
function getAutoImprovementPrompt90() {
    return `당신은 프롬프트 개선 전문가입니다. 주어진 프롬프트를 90점 이상 수준으로 자동 개선해주세요.

90점급 프롬프트 필수 요소:
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

// 개선 프롬프트 구성
function buildImprovementPrompt(userInput, questions, answers, isExpertMode) {
    let prompt = `원본 프롬프트: "${userInput}"\n\n`;
    
    if (questions && answers) {
        prompt += `사용자 ${isExpertMode ? '전문가모드' : '일반모드'} 답변 정보:\n`;
        
        // answers가 문자열인 경우와 객체인 경우 모두 처리
        if (typeof answers === 'string') {
            prompt += answers;
        } else {
            Object.entries(answers).forEach(([index, answerData]) => {
                const question = questions[parseInt(index)]?.question || `질문 ${parseInt(index) + 1}`;
                
                if (typeof answerData === 'object' && answerData.answers) {
                    const answerText = Array.isArray(answerData.answers) ? answerData.answers.join(', ') : answerData.answers;
                    const requestText = answerData.request ? `\n요청사항: ${answerData.request}` : '';
                    prompt += `Q: ${question}\nA: ${answerText}${requestText}\n\n`;
                } else {
                    const answerText = Array.isArray(answerData) ? answerData.join(', ') : answerData;
                    prompt += `Q: ${question}\nA: ${answerText}\n\n`;
                }
            });
        }
    }
    
    prompt += `위 정보를 바탕으로 원본 프롬프트를 ${isExpertMode ? '전문가급으로' : '효율적으로'} 개선해주세요.

중요한 규칙:
1. 사용자가 제공한 정보를 정확히 그대로 반영하세요
2. 사용자가 선택한 옵션이나 입력한 내용을 바꾸거나 반대로 해석하지 마세요
3. 모든 답변 내용과 요청사항을 빠뜨리지 말고 포함하세요
4. 사용자가 명시한 것만 사용하고 추측하지 마세요

${isExpertMode ? '전문가모드' : '일반모드'} 개선 지침:
1. 명확하고 구체적인 지시사항으로 변경
2. 원하는 결과물의 형식과 스타일 명시
3. 사용자가 제공한 모든 컨텍스트와 요구사항 포함
4. AI가 이해하기 쉬운 구조로 작성
5. 사용자의 모든 답변과 요청사항을 정확히 반영

개선된 프롬프트만 응답해주세요:`;
    
    return prompt;
}

// 🆕 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        version: '5.0',
        features: [
            '일반모드 vs 전문가모드',
            '동적 질문 개수 (1-6개)',
            '다회차 심층 질문 (전문가모드)',
            '90점 기준 자동 재개선',
            '추가 질문 시스템',
            '의도 파악 기반 개선',
            '요청사항 입력 지원'
        ],
        timestamp: new Date().toISOString()
    });
});

// 🆕 통계 엔드포인트 (개발용)
app.get('/api/stats', (req, res) => {
    res.json({
        version: '5.0',
        modes: {
            normal: '일반모드 - 빠른 개선',
            expert: '전문가모드 - 심층 분석'
        },
        features: {
            dynamicQuestions: '1-6개 동적 질문',
            multiRoundQuestions: '2-3회차 심층 질문',
            autoImprovement: '90점 기준 자동 재개선',
            intentAnalysis: '의도 파악 시스템',
            requestInput: '요청사항 입력 지원'
        },
        topCategories: [
            '개발/코딩',
            '이미지 생성', 
            '글쓰기/번역',
            '웹사이트 개발',
            '데이터 분석',
            '비즈니스 전략'
        ]
    });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 AI 프롬프트 개선기 v5.0 서버가 포트 ${PORT}에서 실행 중입니다!`);
    console.log(`📱 로컬에서 테스트: http://localhost:${PORT}`);
    console.log(`✨ v5.0 새로운 기능:`);
    console.log(`   - 🚀 일반모드: 빠른 개선 (1-6개 동적 질문)`);
    console.log(`   - 🎯 전문가모드: 심층 분석 (2-3회차 질문)`);
    console.log(`   - 🔄 90점 기준 자동 재개선`);
    console.log(`   - 📈 추가 질문으로 점수 향상`);
    console.log(`   - 💡 요청사항 입력으로 의도 파악`);
    console.log(`   - 🎨 분야별 맞춤 질문 생성`);
    
    if (!OPENAI_API_KEY) {
        console.warn('⚠️  OPENAI_API_KEY 환경변수가 설정되지 않았습니다!');
    } else {
        console.log('✅ OpenAI API 키 확인됨');
    }
});
