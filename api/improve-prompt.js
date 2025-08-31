// api/improve-prompt.js - 중복/점수/품질 문제 모두 수정
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
      askedQuestions = [], // 이전 질문들 (중복 방지 핵심!)
      currentPrompt = '',
    } = body;

    console.log(`📥 라운드 ${round}:`);
    console.log('- 답변 수:', answers.length);
    console.log('- 이전 질문 수:', askedQuestions.length);

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

    return await processRound(res, userInput, answers, domain, round, askedQuestions, currentPrompt);
    
  } catch (error) {
    console.error('❌ 오류:', error);
    return res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
}

// ========== 라운드 처리 ==========
async function processRound(res, userInput, answers, domain, round, askedQuestions, previousPrompt) {
  try {
    // 1️⃣ 정보 추출
    const allText = [userInput, ...answers].join(' ');
    const mentions = mentionExtractor.extract(allText);
    
    // 2️⃣ 프롬프트 개선 (답변이 있을 때만)
    let improvedPrompt = previousPrompt || userInput;
    if (answers.length > 0) {
      improvedPrompt = await improvePromptWithAI(userInput, answers, domain, previousPrompt);
    }
    
    // 3️⃣ 점수 계산 (수정!)
    const intentScore = calculateCorrectIntentScore(userInput, answers, domain, mentions);
    const qualityEval = evaluationSystem.evaluatePromptQuality(improvedPrompt, domain);
    const qualityScore = qualityEval.total;
    
    console.log(`📊 점수: 의도 ${intentScore}/95, 품질 ${qualityScore}/95`);
    
    // 4️⃣ 두 점수 모두 95점 이상이면 완료
    if (intentScore >= 95 && qualityScore >= 95) {
      return res.status(200).json({
        success: true,
        step: 'completed',
        originalPrompt: userInput,
        improvedPrompt,
        intentScore: Math.min(intentScore, 95), // 95점 초과 방지
        qualityScore,
        attempts: round,
        message: `🎉 완벽한 프롬프트 완성!`
      });
    }
    
    // 5️⃣ 부족한 부분 분석
    const missingInfo = analyzeMissingInfo(improvedPrompt, domain, qualityEval);
    
    // 6️⃣ AI 질문 생성 (중복 방지 강화!)
    const questions = await generateUniqueQuestions(
      userInput,
      improvedPrompt,
      answers,
      domain,
      missingInfo,
      askedQuestions, // 중요! 이전 질문 전달
      round,
      intentScore,
      qualityScore
    );
    
    if (!questions || questions.length === 0) {
      return await finalizePrompt(res, userInput, answers, domain, improvedPrompt);
    }
    
    // 7️⃣ 새로운 질문들을 askedQuestions에 추가
    const updatedAskedQuestions = [
      ...askedQuestions,
      ...questions.map(q => q.question)
    ];
    
    return res.status(200).json({
      success: true,
      step: 'questions',
      questions,
      round: round + 1,
      intentScore: Math.min(intentScore, 95),
      qualityScore,
      currentPrompt: improvedPrompt,
      draftPrompt: improvedPrompt,
      askedQuestions: updatedAskedQuestions, // 업데이트된 질문 목록 전달!
      status: 'improving',
      message: `라운드 ${round}: 의도 ${Math.min(intentScore, 95)}점, 품질 ${qualityScore}점. 추가 정보를 수집합니다.`
    });
    
  } catch (error) {
    console.error('processRound 오류:', error);
    throw error;
  }
}

// ========== 의도 점수 계산 (수정!) ==========
function calculateCorrectIntentScore(userInput, answers, domain, mentions) {
  let score = 0;
  
  // 기본 입력 (최대 15점)
  if (userInput.length > 5) score += 10;
  if (userInput.length > 20) score += 5;
  
  // 답변 수 (각 10점, 최대 60점)
  score += Math.min(answers.length * 10, 60);
  
  // 도메인별 필수 정보 체크 (최대 20점)
  const essentials = {
    video: ['목적', '길이', '플랫폼', '스타일', '타겟'],
    image: ['용도', '스타일', '크기', '색상'],
    dev: ['기능', '기술', '사용자']
  };
  
  const domainEssentials = essentials[domain] || essentials.video;
  const allText = [userInput, ...answers].join(' ').toLowerCase();
  
  let coveredCount = 0;
  domainEssentials.forEach(item => {
    if (allText.includes(item)) coveredCount++;
  });
  
  score += Math.round((coveredCount / domainEssentials.length) * 20);
  
  // 최대 95점으로 제한!
  return Math.min(score, 95);
}

// ========== AI 프롬프트 개선 (품질 향상) ==========
async function improvePromptWithAI(userInput, answers, domain, previousPrompt) {
  // 도메인별 프롬프트 템플릿
  const domainInstructions = {
    video: `
영상 제작 AI를 위한 프롬프트를 생성하세요.
포함해야 할 요소:
- 구체적인 장면 구성과 시퀀스
- 카메라 앵글과 움직임
- 색감, 톤, 분위기
- 음향 효과와 배경음악 스타일
- 편집 리듬과 전환 효과
- 텍스트/자막 스타일 (필요시)
제외할 것: 제작 기간, 예산, 실제 촬영 장비`,
    
    image: `
이미지 생성 AI를 위한 프롬프트를 생성하세요.
포함해야 할 요소:
- 주체의 구체적인 묘사
- 구도와 카메라 앵글
- 조명과 그림자
- 색상 팔레트
- 스타일과 분위기
- 배경과 환경
- 품질 키워드 (masterpiece, high quality 등)`,
    
    dev: `
개발 프로젝트 명세를 생성하세요.
포함해야 할 요소:
- 핵심 기능 목록
- 기술 스택과 아키텍처
- 사용자 인터페이스
- 데이터 구조
- 보안 요구사항`
  };

  const prompt = `
${domainInstructions[domain] || domainInstructions.video}

원본 요청: ${userInput}
수집된 정보: ${answers.map(a => {
  const [key, value] = a.split(':');
  return `${key}: ${value}`;
}).join(', ')}

이전 버전: ${previousPrompt || '없음'}

위 정보를 통합하여 구체적이고 실행 가능한 프롬프트를 한국어로 작성하세요.
AI가 즉시 실행할 수 있는 명확한 지시사항으로 작성하세요.`;

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
          { role: 'system', content: '당신은 AI 프롬프트 엔지니어입니다.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) throw new Error('OpenAI API 오류');
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || previousPrompt;
    
  } catch (error) {
    console.error('OpenAI 오류:', error);
    return improveWithRules(userInput, answers, domain, previousPrompt);
  }
}

// ========== 중복 방지 강화된 질문 생성 ==========
async function generateUniqueQuestions(
  userInput, 
  currentPrompt, 
  answers, 
  domain, 
  missingInfo, 
  askedQuestions, // 이전에 물어본 모든 질문들
  round,
  intentScore,
  qualityScore
) {
  const targetCount = round <= 2 ? 7 : 5;
  
  // 이미 답변받은 키들 추출
  const answeredKeys = answers.map(a => a.split(':')[0].trim());
  
  const prompt = `
${domain} 프롬프트 개선을 위한 질문을 생성하세요.

현재 프롬프트: ${currentPrompt}
현재 점수: 의도 ${intentScore}/95, 품질 ${qualityScore}/95

부족한 부분:
${missingInfo.slice(0, 10).join('\n')}

이미 물어본 질문들 (절대 중복 금지):
${askedQuestions.join('\n')}

이미 답변받은 항목 (재질문 금지):
${answeredKeys.join(', ')}

요구사항:
1. 정확히 ${targetCount}개의 새로운 질문
2. 이전 질문과 완전히 다른 관점
3. 프롬프트 품질 향상에 필수적인 질문
4. 구체적이고 명확한 객관식
5. ${domain} 도메인에 특화된 전문적 질문

JSON 형식:
{
  "questions": [
    {
      "question": "새로운 질문",
      "options": ["옵션1", "옵션2", "옵션3", "옵션4", "기타"],
      "key": "unique_key_${round}_1",
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
          { role: 'system', content: 'JSON만 출력. 중복 질문 절대 금지.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9, // 다양성 증가
        max_tokens: 1500
      })
    });
    
    if (!response.ok) throw new Error('OpenAI API 오류');
    
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '{}';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    const parsed = JSON.parse(content);
    let questions = parsed.questions || [];
    
    // 추가 중복 필터링
    questions = questions.filter(q => {
      const qLower = q.question.toLowerCase();
      
      // 이전 질문과 비교
      const isDuplicate = askedQuestions.some(asked => {
        const askedLower = asked.toLowerCase();
        return askedLower.includes(qLower.slice(0, 10)) || 
               qLower.includes(askedLower.slice(0, 10));
      });
      
      // 이미 답변받은 키와 비교
      const keyExists = answeredKeys.includes(q.key);
      
      return !isDuplicate && !keyExists;
    });
    
    return questions.slice(0, Math.min(targetCount, 10));
    
  } catch (error) {
    console.error('질문 생성 오류:', error);
    return [];
  }
}

// ========== 부족한 정보 분석 (구체적) ==========
function analyzeMissingInfo(prompt, domain, qualityEval) {
  const missing = [];
  
  // 품질 평가에서 낮은 점수 항목
  if (qualityEval?.evaluationDetails) {
    Object.entries(qualityEval.evaluationDetails).forEach(([key, detail]) => {
      if (detail.percentage < 70) {
        missing.push(`${key} (현재 ${detail.percentage}%)`);
      }
    });
  }
  
  // 도메인별 필수 요소 체크
  const requirements = {
    video: {
      '장면 구성': ['씬', '시퀀스', '장면'],
      '시각 효과': ['색감', '톤', '필터', '효과'],
      '음향': ['음악', 'BGM', '효과음', '사운드'],
      '편집': ['컷', '전환', '리듬', '템포'],
      '카메라': ['앵글', '샷', '구도', '움직임']
    },
    image: {
      '구도': ['구도', '레이아웃', '배치'],
      '조명': ['조명', '빛', '그림자', '명암'],
      '디테일': ['질감', '텍스처', '세부'],
      '스타일': ['화풍', '기법', '스타일']
    }
  };
  
  const domainReqs = requirements[domain] || requirements.video;
  const promptLower = prompt.toLowerCase();
  
  Object.entries(domainReqs).forEach(([category, keywords]) => {
    const hasAny = keywords.some(k => promptLower.includes(k));
    if (!hasAny) {
      missing.push(`${category} 정보 부족`);
    }
  });
  
  return [...new Set(missing)];
}

// ========== 최종 완성 ==========
async function finalizePrompt(res, userInput, answers, domain, currentPrompt) {
  const finalPrompt = await improvePromptWithAI(userInput, answers, domain, currentPrompt);
  const mentions = mentionExtractor.extract([userInput, ...answers].join(' '));
  const intentScore = calculateCorrectIntentScore(userInput, answers, domain, mentions);
  const qualityScore = evaluationSystem.evaluatePromptQuality(finalPrompt, domain).total;
  
  return res.status(200).json({
    success: true,
    step: 'completed',
    originalPrompt: userInput,
    improvedPrompt: finalPrompt,
    intentScore: Math.min(intentScore, 95),
    qualityScore: Math.max(qualityScore, 85), // 최소 85점 보장
    message: `프롬프트 개선 완료!`
  });
}

// ========== 규칙 기반 개선 ==========
function improveWithRules(userInput, answers, domain, previousPrompt) {
  let improved = previousPrompt || userInput;
  
  const answersMap = {};
  answers.forEach(answer => {
    const [key, value] = answer.split(':').map(s => s.trim());
    answersMap[key] = value;
  });
  
  if (domain === 'video') {
    improved = `
${userInput}

[영상 제작 사양]
${answersMap.purpose ? `목적: ${answersMap.purpose}` : ''}
${answersMap.length ? `길이: ${answersMap.length}` : ''}
${answersMap.platform ? `플랫폼: ${answersMap.platform}` : ''}
${answersMap.style ? `스타일: ${answersMap.style}` : ''}
${answersMap.audience ? `타겟: ${answersMap.audience}` : ''}

[기술 요구사항]
- 고품질 제작
- 플랫폼 최적화
- 전문적 완성도
`.trim();
  }
  
  return improved;
}
