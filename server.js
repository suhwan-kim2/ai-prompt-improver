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
        } else {
            return basePrompt + `

전문가모드 ${round + 1}차 질문 (심층 의도 파악):
- 이전 답변을 바탕으로 더 깊은 의도 파악
- 숨겨진 요구사항과 세부 조건 발굴
- 창작자의 진짜 목적과 비전 이해
- 1-3개의 정밀한 질문 생성

심층 분석 포인트:
- 사용자가 말하지 않은 진짜 의도
- 프로젝트의 숨겨진 제약조건
- 이상적인 결과물에 대한 구체적 비전
- 특별히 강조하거나 피해야 할 요소

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "심층 질문 내용",
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

// 🆕 적응형 프롬프트 개선 시스템 프롬프트 (일반
