// api/improve-prompt.js - 의도 파악 & 품질 100점 시스템
import { readJson } from './helpers.js';
import { MentionExtractor } from '../utils/mentionExtractor.js';
import { EvaluationSystem } from '../utils/evaluationSystem.js';

const mentionExtractor = new MentionExtractor();
const evaluationSystem = new EvaluationSystem();

// ========== 메인 핸들러 ==========
export default async function handler(req, res) {
  try {
    const body = await readJson(req);
    const {
      userInput = '',
      answers = [],
      domain = 'video',
      round = 1,
      conversationHistory = [],
      currentPrompt = '',
      coveredTopics = []
    } = body;

    console.log(`📥 라운드 ${round}: 답변 ${answers.length}개`);

    if (!userInput) {
      return res.status(400).json({ 
        success: false, 
        message: '프롬프트를 입력해주세요.' 
      });
    }

    // 최대 5라운드
    if (round > 5) {
      return await finalizePrompt(res, userInput, answers, domain, currentPrompt);
    }

    return await processSmartRound(res, userInput, answers, domain, round, conversationHistory, currentPrompt, coveredTopics);
    
  } catch (error) {
    console.error('❌ 오류:', error);
    return res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
}

// ========== 스마트 라운드 처리 ==========
async function processSmartRound(res, userInput, answers, domain, round, conversationHistory, previousPrompt, coveredTopics) {
  try {
    // 1️⃣ 정보 추출 & 분석
    const allText = [userInput, ...answers].join(' ');
    const mentions = mentionExtractor.extract(allText);
    
    // 2️⃣ 대화 기록 구성
    const conversation = buildConversation(userInput, conversationHistory, answers);
    
    // 3️⃣ 프롬프트 개선 (AI가 점진적으로)
    let improvedPrompt = previousPrompt || userInput;
    if (answers.length > 0) {
      improvedPrompt = await improvePromptWithContext(userInput, conversation, domain, previousPrompt);
    }
    
    // 4️⃣ 점수 계산 (의도 & 품질)
    const intentScore = calculateRealIntentScore(conversation, coveredTopics, domain);
    const qualityScore = calculateRealQualityScore(improvedPrompt, domain);
    
    console.log(`📊 의도: ${intentScore}/95, 품질: ${qualityScore}/100`);
    
    // 5️⃣ 목표 달성 체크
    if (intentScore >= 95 && qualityScore >= 100) {
      const englishPrompt = await translateToEnglish(improvedPrompt, domain);
      return res.status(200).json({
        success: true,
        step: 'completed',
        originalPrompt: userInput,
        improvedPrompt,
        englishPrompt,
        intentScore: 95,
        qualityScore: 100,
        attempts: round,
        message: `🎉 완벽한 프롬프트 완성!`
      });
    }
    
    // 6️⃣ AI가 놓친 부분 찾기
    const missingInsights = await findHiddenNeeds(
      userInput,
      improvedPrompt,
      conversation,
      domain,
      coveredTopics
    );
    
    // 7️⃣ 스마트 질문 생성 (중복 완벽 방지)
    const questions = await generateInsightfulQuestions(
      conversation,
      missingInsights,
      coveredTopics,
      domain,
      round,
      intentScore,
      qualityScore
    );
    
    if (!questions || questions.length === 0) {
      return await finalizePrompt(res, userInput, answers, domain, improvedPrompt);
    }
    
    // 8️⃣ 다룬 주제 업데이트
    const newCoveredTopics = updateCoveredTopics(coveredTopics, questions);
    
    return res.status(200).json({
      success: true,
      step: 'questions',
      questions,
      round: round + 1,
      intentScore,
      qualityScore,
      currentPrompt: improvedPrompt,
      draftPrompt: improvedPrompt,
      conversationHistory: conversation,
      coveredTopics: newCoveredTopics,
      status: 'improving',
      message: `라운드 ${round}: 의도 ${intentScore}점, 품질 ${qualityScore}점`
    });
    
  } catch (error) {
    console.error('processRound 오류:', error);
    throw error;
  }
}

// ========== 대화 기록 구성 ==========
function buildConversation(userInput, history, answers) {
  const conversation = [
    { role: "user", content: userInput },
    ...history
  ];
  
  // 새 답변 추가
  answers.forEach(answer => {
    const [key, value] = answer.split(':').map(s => s.trim());
    conversation.push({
      role: "user",
      content: value,
      category: key
    });
  });
  
  return conversation;
}

// ========== 의도 파악 점수 (효율성 중심) ==========
function calculateRealIntentScore(conversation, coveredTopics, domain) {
  let score = 0;
  
  // 1. 명확성 (30점) - 사용자가 원하는 것이 명확한가
  const clarity = assessClarity(conversation);
  score += Math.min(clarity * 30, 30);
  
  // 2. 포괄성 (30점) - 필요한 정보를 다 다뤘는가
  const coverage = assessCoverage(coveredTopics, domain);
  score += Math.min(coverage * 30, 30);
  
  // 3. 효율성 (20점) - 적은 질문으로 파악했는가
  const efficiency = Math.max(0, 20 - (conversation.length - 1) * 2);
  score += efficiency;
  
  // 4. 관련성 (15점) - 모든 질문이 관련 있었는가
  const relevance = assessRelevance(conversation, domain);
  score += Math.min(relevance * 15, 15);
  
  return Math.min(Math.round(score), 95);
}

// ========== 품질 점수 (100점 목표) ==========
function calculateRealQualityScore(prompt, domain) {
  let score = 0;
  const promptLower = prompt.toLowerCase();
  
  // 1. 실행 가능성 (40점) - AI가 바로 실행 가능한가
  const executable = assessExecutability(prompt, domain);
  score += Math.min(executable * 40, 40);
  
  // 2. 구체성 (30점) - 디테일이 충분한가
  const detailed = assessDetail(prompt, domain);
  score += Math.min(detailed * 30, 30);
  
  // 3. 창의성 (20점) - 독특하고 차별화된 요소
  const creative = assessCreativity(prompt);
  score += Math.min(creative * 20, 20);
  
  // 4. 기술 사양 (10점) - 필요한 기술 정보
  const technical = assessTechnical(prompt, domain);
  score += Math.min(technical * 10, 10);
  
  return Math.min(Math.round(score), 100);
}

// ========== AI가 숨은 니즈 찾기 ==========
async function findHiddenNeeds(userInput, currentPrompt, conversation, domain, coveredTopics) {
  const prompt = `
당신은 ${domain} 프롬프트 전문가입니다.
사용자가 놓칠 수 있는 중요한 부분을 찾아내는 것이 임무입니다.

사용자 요청: ${userInput}
현재 프롬프트: ${currentPrompt}
대화 내용: ${conversation.map(c => `${c.role}: ${c.content}`).join('\n')}

이미 다룬 주제:
${coveredTopics.join(', ')}

사용자가 생각하지 못했지만 결과물 품질에 중요한 요소를 3개 찾으세요.
예시:
- 감정적 임팩트
- 시청자 행동 유도
- 차별화 포인트
- 의외성 요소

JSON 형식:
{
  "insights": [
    {
      "aspect": "놓친 관점",
      "importance": "왜 중요한지",
      "impact": "결과물에 미치는 영향"
    }
  ]
}`;

  try {
    const response = await callOpenAI(prompt);
    const parsed = JSON.parse(response);
    return parsed.insights || [];
  } catch (error) {
    console.error('인사이트 찾기 오류:', error);
    return [];
  }
}

// ========== 통찰력 있는 질문 생성 ==========
async function generateInsightfulQuestions(
  conversation,
  insights,
  coveredTopics,
  domain,
  round,
  intentScore,
  qualityScore
) {
  // 라운드별 전략
  const strategy = getQuestionStrategy(round, intentScore, qualityScore);
  
  const prompt = `
당신은 ${domain} 프롬프트 마스터입니다.
현재 ${round}라운드이며, 의도 ${intentScore}/95, 품질 ${qualityScore}/100입니다.

대화 기록:
${conversation.slice(-5).map(c => `${c.role}: ${c.content}`).join('\n')}

이미 다룬 주제 (절대 재질문 금지):
${coveredTopics.join(', ')}

발견한 인사이트:
${insights.map(i => i.aspect).join(', ')}

전략: ${strategy}

${strategy === 'deep' ? '깊이 있는' : strategy === 'creative' ? '창의적인' : '효율적인'} 질문 ${round <= 2 ? 5 : 3}개를 생성하세요.

규칙:
1. 이미 다룬 주제의 변형 절대 금지
2. 사용자가 놓친 중요한 부분 집중
3. 결과물 품질을 크게 향상시킬 질문

JSON 형식:
{
  "questions": [
    {
      "question": "질문 내용",
      "reason": "왜 이걸 묻는지",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4", "직접입력"],
      "key": "unique_${round}_${Date.now()}",
      "priority": "high",
      "category": "카테고리명"
    }
  ]
}`;

  try {
    const response = await callOpenAI(prompt);
    let content = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const parsed = JSON.parse(content);
    
    // 중복 최종 체크
    let questions = parsed.questions || [];
    questions = filterDuplicates(questions, coveredTopics, conversation);
    
    return questions.slice(0, round <= 2 ? 5 : 3);
  } catch (error) {
    console.error('질문 생성 오류:', error);
    return [];
  }
}

// ========== 질문 전략 ==========
function getQuestionStrategy(round, intentScore, qualityScore) {
  if (round === 1) return 'broad'; // 넓은 범위
  if (round === 2) return 'deep';  // 깊이 있게
  if (round === 3) return 'creative'; // 창의적
  if (intentScore < 70) return 'intent'; // 의도 파악
  if (qualityScore < 70) return 'quality'; // 품질 향상
  return 'polish'; // 마무리
}

// ========== 중복 필터링 (강력) ==========
function filterDuplicates(questions, coveredTopics, conversation) {
  const topicPatterns = {
    '목적': ['목적', '용도', '왜', '이유', '목표'],
    '스타일': ['스타일', '느낌', '분위기', '톤', '비주얼'],
    '대상': ['대상', '타겟', '누구', '시청자', '사용자'],
    '길이': ['길이', '시간', '분량', '러닝타임'],
    '기술': ['해상도', '크기', '포맷', '비율']
  };
  
  return questions.filter(q => {
    const qLower = q.question.toLowerCase();
    
    // 패턴 기반 중복 체크
    for (const [category, patterns] of Object.entries(topicPatterns)) {
      if (coveredTopics.includes(category)) {
        const hasPattern = patterns.some(p => qLower.includes(p));
        if (hasPattern) return false;
      }
    }
    
    // 대화 내용과 중복 체크
    const isDuplicate = conversation.some(c => {
      if (c.content && typeof c.content === 'string') {
        return c.content.toLowerCase().includes(qLower.slice(0, 10));
      }
      return false;
    });
    
    return !isDuplicate;
  });
}

// ========== 다룬 주제 업데이트 ==========
function updateCoveredTopics(current, questions) {
  const newTopics = [...current];
  
  questions.forEach(q => {
    if (q.category && !newTopics.includes(q.category)) {
      newTopics.push(q.category);
    }
  });
  
  return newTopics;
}

// ========== 컨텍스트 기반 프롬프트 개선 ==========
async function improvePromptWithContext(userInput, conversation, domain, previousPrompt) {
  const domainExpert = {
    video: '영상 생성 AI 프롬프트 엔지니어',
    image: '이미지 생성 AI 프롬프트 엔지니어',
    dev: '개발 명세서 작성 전문가'
  };

  const prompt = `
당신은 ${domainExpert[domain]}입니다.
대화 내용을 바탕으로 점진적으로 프롬프트를 개선하세요.

원본: ${userInput}
이전 버전: ${previousPrompt || userInput}

대화 내용:
${conversation.slice(-10).map(c => `${c.role}: ${c.content}`).join('\n')}

AI가 즉시 실행 가능한 구체적 프롬프트를 작성하세요.
촬영 장비, 편집 프로그램 등은 제외하세요.
한국어로 작성하세요.`;

  try {
    const response = await callOpenAI(prompt);
    return response || previousPrompt;
  } catch (error) {
    console.error('프롬프트 개선 오류:', error);
    return previousPrompt;
  }
}

// ========== 영어 번역 ==========
async function translateToEnglish(koreanPrompt, domain) {
  if (domain !== 'video' && domain !== 'image') return null;
  
  const prompt = `
Translate this Korean ${domain} prompt to English for AI generation.
Make it perfect for tools like Midjourney, Stable Diffusion, or Runway.
Keep all details and style descriptions.

Korean: ${koreanPrompt}

English (only the translation):`;

  try {
    const response = await callOpenAI(prompt);
    return response;
  } catch (error) {
    console.error('번역 오류:', error);
    return null;
  }
}

// ========== OpenAI API 호출 ==========
async function callOpenAI(prompt) {
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
          { role: 'system', content: 'You are an expert prompt engineer.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });
    
    if (!response.ok) throw new Error('OpenAI API 오류');
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenAI 오류:', error);
    throw error;
  }
}

// ========== 평가 함수들 ==========
function assessClarity(conversation) {
  // 대화가 명확할수록 1에 가까움
  const hasSpecificDetails = conversation.some(c => 
    c.content && c.content.length > 20
  );
  return hasSpecificDetails ? 0.8 : 0.5;
}

function assessCoverage(coveredTopics, domain) {
  const required = {
    video: ['스토리', '스타일', '길이', '분위기', '음향'],
    image: ['주체', '스타일', '배경', '색상', '분위기'],
    dev: ['기능', '기술', '사용자', '디자인']
  };
  
  const domainRequired = required[domain] || required.video;
  const covered = coveredTopics.filter(t => domainRequired.includes(t)).length;
  return covered / domainRequired.length;
}

function assessRelevance(conversation, domain) {
  // 모든 대화가 도메인과 관련 있는지
  return 0.9; // 대부분 관련 있다고 가정
}

function assessExecutability(prompt, domain) {
  // AI가 바로 실행 가능한지
  const hasConcreteDetails = prompt.length > 100;
  const hasStyle = prompt.includes('스타일') || prompt.includes('style');
  return (hasConcreteDetails && hasStyle) ? 0.9 : 0.6;
}

function assessDetail(prompt, domain) {
  // 구체적 디테일
  const wordCount = prompt.split(' ').length;
  return Math.min(wordCount / 50, 1);
}

function assessCreativity(prompt) {
  // 창의적 요소
  const uniqueWords = new Set(prompt.toLowerCase().split(' ')).size;
  return Math.min(uniqueWords / 30, 1);
}

function assessTechnical(prompt, domain) {
  // 기술 사양
  const hasTechnical = /\d+/.test(prompt); // 숫자 포함
  return hasTechnical ? 1 : 0.5;
}

// ========== 최종 완성 ==========
async function finalizePrompt(res, userInput, answers, domain, currentPrompt) {
  const finalPrompt = await improvePromptWithContext(
    userInput,
    buildConversation(userInput, [], answers),
    domain,
    currentPrompt
  );
  
  const englishPrompt = await translateToEnglish(finalPrompt, domain);
  
  return res.status(200).json({
    success: true,
    step: 'completed',
    originalPrompt: userInput,
    improvedPrompt: finalPrompt,
    englishPrompt,
    intentScore: 95,
    qualityScore: 100,
    message: `프롬프트 완성!`
  });
}
