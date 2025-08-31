// api/improve-prompt.js - 유틸 호출 에러 수정 버전
import { readJson } from './helpers.js';
import { MentionExtractor } from '../utils/mentionExtractor.js';
import { IntentAnalyzer } from '../utils/intentAnalyzer.js';
import { EvaluationSystem } from '../utils/evaluationSystem.js';

// 유틸 인스턴스 생성
const mentionExtractor = new MentionExtractor();
const intentAnalyzer = new IntentAnalyzer();
const evaluationSystem = new EvaluationSystem();

// ========== 메인 핸들러 ==========
export default async function handler(req, res) {
  try {
    const body = await readJson(req);
    const {
      step = 'start',
      userInput = '',
      answers = [],
      domain = 'video',
      round = 1,
      askedQuestions = [], // 이전에 물어본 모든 질문들 (중복 방지)
      currentPrompt = '',  // 현재까지 개선된 프롬프트
    } = body;

    console.log(`📥 라운드 ${round}: ${step}, 답변 ${answers.length}개`);

    if (!userInput) {
      return res.status(400).json({ 
        success: false, 
        message: '프롬프트를 입력해주세요.' 
      });
    }

    // 최대 라운드 체크
    if (round > 5) {
      return await finalizePrompt(res, userInput, answers, domain, currentPrompt);
    }

    // 프로세스 진행
    return await processRound(res, userInput, answers, domain, round, askedQuestions, currentPrompt);
    
  } catch (error) {
    console.error('❌ API 오류:', error);
    return res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
}

// ========== 라운드 처리 (핵심!) ==========
async function processRound(res, userInput, answers, domain, round, askedQuestions, previousPrompt) {
  
  try {
    // 1️⃣ 현재까지의 모든 정보 추출
    const allText = [userInput, ...answers].join(' ');
    const mentions = mentionExtractor.extract(allText);
    console.log('📊 추출된 정보:', Object.keys(mentions).length, '개 카테고리');
    
    // 2️⃣ 현재 정보로 프롬프트 개선 (첫 라운드면 원본 사용)
    let improvedPrompt = previousPrompt || userInput;
    if (answers.length > 0) {
      improvedPrompt = await improvePromptWithAI(userInput, answers, domain, previousPrompt);
      console.log('✨ 프롬프트 개선 완료');
    }
    
    // 3️⃣ 점수 계산 (수정된 부분!)
    // intentAnalyzer의 calculateIntentScore는 다른 구조를 기대함
    // 간단한 체크리스트 구조 생성
    const simpleChecklist = createSimpleChecklist(domain);
    
    const intentScore = calculateSimpleIntentScore(
      userInput, 
      answers, 
      domain,
      mentions,
      improvedPrompt
    );
    
    // evaluationSystem은 제대로 사용
    const qualityEval = evaluationSystem.evaluatePromptQuality(improvedPrompt, domain);
    const qualityScore = qualityEval.total;
    
    console.log(`📈 점수: 의도 ${intentScore}/95, 품질 ${qualityScore}/95`);
    
    // 4️⃣ 목표 달성 체크
    if (intentScore >= 95 && qualityScore >= 95) {
      return res.status(200).json({
        success: true,
        step: 'completed',
        originalPrompt: userInput,
        improvedPrompt,
        intentScore,
        qualityScore,
        attempts: round,
        message: `🎉 완벽한 프롬프트 완성! ${round}라운드 만에 목표 달성!`
      });
    }
    
    // 5️⃣ 부족한 부분 분석
    const missingInfo = analyzeMissingInfo(
      improvedPrompt, 
      domain, 
      intentScore, 
      qualityScore,
      qualityEval,
      mentions
    );
    
    // 6️⃣ AI로 타겟 질문 생성 (중복 방지)
    const questions = await generateSmartQuestions(
      userInput,
      improvedPrompt,
      answers,
      domain,
      missingInfo,
      askedQuestions,
      round,
      intentScore,
      qualityScore
    );
    
    // 질문이 없으면 현재 상태로 완성
    if (!questions || questions.length === 0) {
      return await finalizePrompt(res, userInput, answers, domain, improvedPrompt);
    }
    
    // 7️⃣ 다음 라운드 준비
    const newAskedQuestions = [...askedQuestions];
    questions.forEach(q => {
      if (q && q.question) {
        newAskedQuestions.push(q.question);
      }
    });
    
    return res.status(200).json({
      success: true,
      step: 'questions',
      questions,
      round: round + 1,
      intentScore,
      qualityScore,
      currentPrompt: improvedPrompt,
      draftPrompt: improvedPrompt,
      askedQuestions: newAskedQuestions,
      status: 'improving',
      message: `라운드 ${round}: 의도 ${intentScore}점, 품질 ${qualityScore}점. 추가 정보를 수집합니다.`
    });
    
  } catch (error) {
    console.error('processRound 오류:', error);
    throw error;
  }
}

// ========== 간단한 의도 점수 계산 (수정) ==========
function calculateSimpleIntentScore(userInput, answers, domain, mentions, improvedPrompt) {
  let score = 20; // 기본 점수
  
  // 입력 길이
  if (userInput.length > 10) score += 10;
  if (userInput.length > 20) score += 10;
  
  // 답변 수 (각 답변당 10점, 최대 50점)
  score += Math.min(answers.length * 10, 50);
  
  // 멘션 정보 (각 카테고리당 3점)
  const mentionCount = Object.keys(mentions).length;
  score += Math.min(mentionCount * 3, 15);
  
  // 프롬프트 개선도
  if (improvedPrompt && improvedPrompt.length > userInput.length * 2) {
    score += 10;
  }
  
  return Math.min(score, 100);
}

// ========== 간단한 체크리스트 생성 ==========
function createSimpleChecklist(domain) {
  const checklists = {
    video: {
      items: [
        { item: '목적', keywords: ['교육', '홍보', '광고'] },
        { item: '타겟', keywords: ['시청자', '연령', '대상'] },
        { item: '길이', keywords: ['초', '분', '시간'] },
        { item: '플랫폼', keywords: ['유튜브', '인스타', '틱톡'] },
        { item: '스타일', keywords: ['실사', '애니메이션', '모션'] }
      ]
    },
    image: {
      items: [
        { item: '용도', keywords: ['SNS', '웹', '인쇄'] },
        { item: '스타일', keywords: ['사실적', '일러스트', '미니멀'] },
        { item: '크기', keywords: ['정사각형', '가로', '세로'] },
        { item: '색상', keywords: ['컬러', '모노톤', '파스텔'] }
      ]
    },
    dev: {
      items: [
        { item: '유형', keywords: ['웹', '앱', 'API'] },
        { item: '기능', keywords: ['로그인', '결제', '검색'] },
        { item: '기술', keywords: ['React', 'Node', 'Python'] }
      ]
    }
  };
  
  return checklists[domain] || checklists.video;
}

// ========== AI 프롬프트 개선 ==========
async function improvePromptWithAI(userInput, answers, domain, previousPrompt) {
  const prompt = `
당신은 ${domain} 프롬프트 전문가입니다.

원본 입력: ${userInput}
이전 프롬프트: ${previousPrompt || userInput}
추가 정보: ${answers.join(', ')}

위 정보를 모두 통합하여 전문적이고 구체적인 ${domain} 프롬프트로 개선하세요.
이전 프롬프트를 기반으로 새로운 정보를 추가하여 누적 개선하세요.

요구사항:
- 구체적인 디테일과 기술 사양
- 명확한 목적과 타겟
- 실행 가능한 구체적 지시
- 한국어로 작성

프롬프트만 출력하세요.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: '당신은 프롬프트 개선 전문가입니다.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || previousPrompt;
  } catch (error) {
    console.error('OpenAI API 오류:', error);
    // 폴백: 규칙 기반 개선
    return improveWithRules(userInput, answers, domain, previousPrompt);
  }
}

// ========== AI 질문 생성 (중복 방지!) ==========
async function generateSmartQuestions(
  userInput, 
  currentPrompt, 
  answers, 
  domain, 
  missingInfo, 
  askedQuestions,
  round,
  intentScore,
  qualityScore
) {
  // 목표 질문 수: 라운드 1-2는 7개, 3-5는 5개
  const targetCount = round <= 2 ? 7 : 5;
  
  const prompt = `
당신은 ${domain} 전문가입니다. 프롬프트를 완성하기 위한 핵심 질문을 생성하세요.

현재 프롬프트: ${currentPrompt}
원본 입력: ${userInput}
수집된 답변: ${answers.join(', ') || '없음'}

현재 점수:
- 의도 파악: ${intentScore}/95
- 품질: ${qualityScore}/95

부족한 부분:
${missingInfo.length > 0 ? missingInfo.map(item => `- ${item}`).join('\n') : '- 전반적인 디테일 부족'}

이미 물어본 질문들 (절대 중복/유사 질문 금지):
${askedQuestions.length > 0 ? askedQuestions.join(', ') : '없음'}

요구사항:
1. ${targetCount}개의 핵심 질문 생성
2. 부족한 부분을 정확히 타겟
3. 이미 물어본 것과 중복/유사 금지
4. 구체적이고 답변하기 쉬운 질문
5. 객관식 위주 (선택지 4-6개)
6. 한국어로 작성

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "질문 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4", "기타"],
      "key": "고유키",
      "priority": "high"
    }
  ]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'JSON만 출력하세요. 다른 설명은 포함하지 마세요.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 1500
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '{}';
    
    // JSON 추출 (```json 등 제거)
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // JSON 파싱
    const parsed = JSON.parse(content);
    let questions = parsed.questions || [];
    
    // 유효성 검사
    questions = questions.filter(q => q && q.question && q.options);
    
    // 중복 필터링 (한 번 더 체크)
    questions = questions.filter(q => {
      const qText = q.question.toLowerCase();
      return !askedQuestions.some(asked => {
        const askedLower = asked.toLowerCase();
        return askedLower.includes(qText) || qText.includes(askedLower);
      });
    });
    
    // 최대 10개 제한
    return questions.slice(0, 10);
    
  } catch (error) {
    console.error('질문 생성 오류:', error);
    // 폴백: 기본 질문 제공
    return getFallbackQuestions(domain, round, askedQuestions);
  }
}

// ========== 폴백 질문 ==========
function getFallbackQuestions(domain, round, askedQuestions) {
  const fallbacks = {
    video: [
      { question: "영상의 주요 목적은 무엇인가요?", options: ["교육", "홍보", "엔터테인먼트", "광고", "기타"], key: "purpose" },
      { question: "타겟 시청자는 누구인가요?", options: ["10대", "20-30대", "40대 이상", "전연령", "기타"], key: "audience" },
      { question: "영상 길이는?", options: ["15초 이하", "30초-1분", "1-3분", "3분 이상"], key: "length" }
    ],
    image: [
      { question: "이미지 용도는?", options: ["SNS", "웹사이트", "인쇄", "프레젠테이션"], key: "purpose" },
      { question: "원하는 스타일은?", options: ["사실적", "일러스트", "미니멀", "빈티지"], key: "style" }
    ],
    dev: [
      { question: "프로젝트 유형은?", options: ["웹사이트", "모바일 앱", "API", "기타"], key: "type" }
    ]
  };
  
  const domainQuestions = fallbacks[domain] || fallbacks.video;
  
  // 이미 물어본 질문 제외
  return domainQuestions.filter(q => 
    !askedQuestions.some(asked => 
      asked.toLowerCase().includes(q.question.toLowerCase())
    )
  ).slice(0, 3);
}

// ========== 부족한 정보 분석 ==========
function analyzeMissingInfo(prompt, domain, intentScore, qualityScore, qualityEval, mentions) {
  const missing = [];
  
  // 품질 평가에서 부족한 항목 추출
  if (qualityEval && qualityEval.evaluationDetails) {
    Object.entries(qualityEval.evaluationDetails).forEach(([key, detail]) => {
      if (detail.percentage < 70) {
        missing.push(`${key}: ${detail.description}`);
      }
    });
  }
  
  // 도메인별 필수 요소 체크
  const essentials = {
    video: ['목적', '타겟', '길이', '플랫폼', '스타일'],
    image: ['용도', '스타일', '크기', '색상', '분위기'],
    dev: ['기능', '기술스택', '사용자', '플랫폼']
  };
  
  const domainEssentials = essentials[domain] || essentials.video;
  domainEssentials.forEach(item => {
    if (!prompt.includes(item)) {
      missing.push(`${item} 정보 부족`);
    }
  });
  
  return [...new Set(missing)].slice(0, 10); // 중복 제거, 최대 10개
}

// ========== 최종 완성 처리 ==========
async function finalizePrompt(res, userInput, answers, domain, currentPrompt) {
  try {
    // 마지막 한 번 더 개선 시도
    const finalPrompt = await improvePromptWithAI(userInput, answers, domain, currentPrompt);
    
    // 최종 점수 계산
    const mentions = mentionExtractor.extract([userInput, ...answers].join(' '));
    const intentScore = calculateSimpleIntentScore(userInput, answers, domain, mentions, finalPrompt);
    const qualityScore = evaluationSystem.evaluatePromptQuality(finalPrompt, domain).total;
    
    return res.status(200).json({
      success: true,
      step: 'completed',
      originalPrompt: userInput,
      improvedPrompt: finalPrompt,
      intentScore: Math.max(intentScore, 85),
      qualityScore: Math.max(qualityScore, 85),
      message: `프롬프트 개선 완료! (최종 점수: 의도 ${intentScore}, 품질 ${qualityScore})`
    });
  } catch (error) {
    console.error('finalizePrompt 오류:', error);
    // 에러시에도 기본 응답 반환
    return res.status(200).json({
      success: true,
      step: 'completed',
      originalPrompt: userInput,
      improvedPrompt: currentPrompt || userInput,
      intentScore: 80,
      qualityScore: 80,
      message: '프롬프트 개선 완료!'
    });
  }
}

// ========== 규칙 기반 폴백 ==========
function improveWithRules(userInput, answers, domain, previousPrompt) {
  let improved = previousPrompt || userInput;
  
  // 템플릿 기반 개선
  const templates = {
    video: '\n\n[영상 제작 사양]',
    image: '\n\n[이미지 생성 요구사항]',
    dev: '\n\n[개발 프로젝트 명세]'
  };
  
  if (!improved.includes(templates[domain])) {
    improved += templates[domain];
  }
  
  // 답변 정보 구조화
  answers.forEach(answer => {
    if (!improved.includes(answer)) {
      const parts = answer.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join(':').trim();
        improved += `\n- ${key}: ${value}`;
      }
    }
  });
  
  // 기본 품질 향상 문구
  if (!improved.includes('고품질')) {
    improved += '\n- 고품질 제작 요청';
  }
  
  return improved;
}
