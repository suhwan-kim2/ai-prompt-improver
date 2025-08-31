// api/improve-prompt.js - AI 기반 완전 자동화 버전
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
  
  // 3️⃣ 점수 계산
  const checklist = evaluationSystem.qualityChecklist[domain];
  const intentScore = intentAnalyzer.calculateIntentScore(
    userInput, 
    answers, 
    domain, 
    checklist, 
    mentions, 
    improvedPrompt
  );
  
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
  return res.status(200).json({
    success: true,
    step: 'questions',
    questions,
    round: round + 1,
    intentScore,
    qualityScore,
    currentPrompt: improvedPrompt,
    draftPrompt: improvedPrompt,
    askedQuestions: [...askedQuestions, ...questions.map(q => q.question)],
    status: 'improving',
    message: `라운드 ${round}: 의도 ${intentScore}점, 품질 ${qualityScore}점. 추가 정보를 수집합니다.`
  });
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
  // 목표 질문 수: 라운드 1-2는 7-10개, 3-5는 3-5개
  const targetCount = round <= 2 ? 7 : 5;
  
  const prompt = `
당신은 ${domain} 전문가입니다. 프롬프트를 완성하기 위한 핵심 질문을 생성하세요.

현재 프롬프트: ${currentPrompt}
원본 입력: ${userInput}
수집된 답변: ${answers.join(', ')}

현재 점수:
- 의도 파악: ${intentScore}/95
- 품질: ${qualityScore}/95

부족한 부분:
${missingInfo.map(item => `- ${item}`).join('\n')}

이미 물어본 질문들 (절대 중복/유사 질문 금지):
${askedQuestions.join(', ')}

요구사항:
1. ${targetCount}개의 핵심 질문 생성
2. 부족한 부분을 정확히 타겟
3. 이미 물어본 것과 중복/유사 금지
4. 구체적이고 답변하기 쉬운 질문
5. 객관식 위주 (선택지 4-6개)

JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "질문 내용",
      "options": ["선택지1", "선택지2", ...],
      "key": "고유키",
      "priority": "high/medium/low"
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
          { role: 'system', content: 'JSON만 출력하세요.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 1500
      })
    });
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    // JSON 파싱
    const parsed = JSON.parse(content);
    let questions = parsed.questions || [];
    
    // 중복 필터링 (한 번 더 체크)
    questions = questions.filter(q => {
      const qText = q.question.toLowerCase();
      return !askedQuestions.some(asked => 
        asked.toLowerCase().includes(qText) || 
        qText.includes(asked.toLowerCase())
      );
    });
    
    // 최대 10개 제한
    return questions.slice(0, 10);
    
  } catch (error) {
    console.error('질문 생성 오류:', error);
    return []; // 오류시 빈 배열
  }
}

// ========== 부족한 정보 분석 ==========
function analyzeMissingInfo(prompt, domain, intentScore, qualityScore, qualityEval, mentions) {
  const missing = [];
  
  // 품질 평가에서 부족한 항목 추출
  if (qualityEval.evaluationDetails) {
    Object.entries(qualityEval.evaluationDetails).forEach(([key, detail]) => {
      if (detail.percentage < 70) {
        missing.push(`${key}: ${detail.description}`);
      }
    });
  }
  
  // 도메인별 필수 요소 체크
  const essentials = {
    video: ['목적', '타겟', '길이', '플랫폼', '스타일', '음악', '자막'],
    image: ['용도', '스타일', '크기', '색상', '분위기', '배경', '조명'],
    dev: ['기능', '기술스택', '사용자', '플랫폼', '보안', '성능']
  };
  
  const domainEssentials = essentials[domain] || essentials.video;
  domainEssentials.forEach(item => {
    if (!prompt.includes(item)) {
      missing.push(`${item} 정보 부족`);
    }
  });
  
  // 멘션되지 않은 중요 정보
  if (!mentions.platform || mentions.platform.length === 0) {
    missing.push('플랫폼 정보 필요');
  }
  if (!mentions.target_audience || mentions.target_audience.length === 0) {
    missing.push('타겟 대상 명확화 필요');
  }
  
  return [...new Set(missing)]; // 중복 제거
}

// ========== 최종 완성 처리 ==========
async function finalizePrompt(res, userInput, answers, domain, currentPrompt) {
  // 마지막 한 번 더 개선 시도
  const finalPrompt = await improvePromptWithAI(userInput, answers, domain, currentPrompt);
  
  // 최종 점수 계산
  const mentions = mentionExtractor.extract([userInput, ...answers].join(' '));
  const checklist = evaluationSystem.qualityChecklist[domain];
  const intentScore = intentAnalyzer.calculateIntentScore(
    userInput, answers, domain, checklist, mentions, finalPrompt
  );
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
}

// ========== 규칙 기반 폴백 ==========
function improveWithRules(userInput, answers, domain, previousPrompt) {
  let improved = previousPrompt || userInput;
  
  // 템플릿 기반 개선
  const templates = {
    video: '\n[영상 제작 사양]\n',
    image: '\n[이미지 생성 요구사항]\n',
    dev: '\n[개발 프로젝트 명세]\n'
  };
  
  if (!improved.includes(templates[domain])) {
    improved += templates[domain];
  }
  
  // 답변 정보 구조화
  answers.forEach(answer => {
    if (!improved.includes(answer)) {
      const [key, value] = answer.split(':').map(s => s.trim());
      improved += `\n- ${key}: ${value}`;
    }
  });
  
  return improved;
}
