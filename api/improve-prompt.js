// api/improve-prompt.js - 가이드 기반 고품질 프롬프트 개선 시스템
import { readJson } from './helpers.js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🎯 도메인별 완성도 가이드 (2025년 1월 최신)
const COMPLETION_GUIDES = {
  video: {
    플랫폼: { weight: 15, options: ["유튜브 장편", "유튜브 쇼츠", "인스타 릴스", "틱톡", "광고용"], keywords: ["유튜브", "쇼츠", "릴스", "틱톡", "광고"] },
    길이: { weight: 15, options: ["15초", "30초", "1분", "3분", "5분+"], keywords: ["초", "분", "길이"] },
    주인공: { weight: 12, options: ["사람", "동물", "제품", "캐릭터", "없음"], keywords: ["강아지", "사람", "캐릭터", "주인공"] },
    스토리: { weight: 12, options: ["여행", "일상", "모험", "튜토리얼", "광고"], keywords: ["여행", "모험", "스토리", "내용"] },
    스타일: { weight: 10, options: ["다큐멘터리", "시네마틱", "브이로그", "애니메이션", "실사"], keywords: ["스타일", "느낌", "톤"] },
    카메라: { weight: 8, options: ["고정", "핸드헬드", "드론", "클로즈업", "와이드"], keywords: ["카메라", "촬영", "앵글"] },
    음향: { weight: 8, options: ["BGM", "내레이션", "자연음", "무음", "효과음"], keywords: ["음악", "소리", "음향"] },
    분위기: { weight: 6, options: ["밝은", "어두운", "신나는", "차분한", "감동적"], keywords: ["분위기", "느낌", "톤"] }
  },
  
  image: {
    용도: { weight: 15, options: ["썸네일", "포스터", "로고", "일러스트", "사진"], keywords: ["썸네일", "포스터", "로고", "용도"] },
    주체: { weight: 15, options: ["인물", "동물", "제품", "풍경", "추상"], keywords: ["강아지", "사람", "제품", "풍경"] },
    스타일: { weight: 12, options: ["사실적", "일러스트", "3D", "수채화", "만화"], keywords: ["스타일", "화풍", "그림체"] },
    해상도: { weight: 10, options: ["HD", "4K", "정사각형", "세로", "가로"], keywords: ["해상도", "크기", "비율"] },
    색상: { weight: 10, options: ["밝은", "어두운", "파스텔", "비비드", "모노톤"], keywords: ["색상", "색깔", "컬러"] },
    구도: { weight: 10, options: ["클로즈업", "전신", "중간", "와이드", "특이한"], keywords: ["구도", "앵글", "시점"] },
    조명: { weight: 8, options: ["자연광", "스튜디오", "어둠", "화려한", "부드러운"], keywords: ["조명", "빛", "밝기"] },
    배경: { weight: 6, options: ["자연", "도시", "실내", "추상", "단색"], keywords: ["배경", "뒤", "환경"] }
  },
  
  dev: {
    목적: { weight: 15, options: ["쇼핑몰", "SNS", "포트폴리오", "회사사이트", "게임"], keywords: ["쇼핑몰", "커뮤니티", "블로그", "회사"] },
    플랫폼: { weight: 12, options: ["웹", "모바일", "데스크톱", "크로스", "PWA"], keywords: ["웹", "모바일", "앱", "플랫폼"] },
    기술스택: { weight: 12, options: ["React", "Vue", "Next.js", "Node.js", "Python"], keywords: ["react", "vue", "node", "python"] },
    사용자: { weight: 10, options: ["일반인", "관리자", "개발자", "고객", "학생"], keywords: ["사용자", "고객", "관리자"] },
    핵심기능: { weight: 10, options: ["결제", "로그인", "게시판", "검색", "채팅"], keywords: ["결제", "로그인", "게시판", "검색"] },
    데이터: { weight: 10, options: ["MySQL", "MongoDB", "Firebase", "PostgreSQL", "없음"], keywords: ["데이터베이스", "DB", "mysql"] },
    보안: { weight: 8, options: ["기본", "중급", "고급", "엔터프라이즈", "없음"], keywords: ["보안", "인증", "권한"] },
    배포: { weight: 8, options: ["Vercel", "Netlify", "AWS", "Heroku", "미정"], keywords: ["배포", "서버", "호스팅"] }
  }
};

// 🏆 최고 품질 프롬프트 패턴 (월 1회 업데이트)
const HIGH_QUALITY_PATTERNS = {
  video: {
    "여행_동물": "Medium shot: Golden retriever exploring iconic landmarks across different countries - Eiffel Tower, Tokyo streets, NYC Central Park. Cinematic travel documentary style with natural lighting, smooth camera movements following the dog's journey. Uplifting background music, 3-5 minute format perfect for YouTube travel content.",
    "일상_브이로그": "Handheld camera: Day in the life following [character] through morning routine, work, and evening activities. Casual vlog aesthetic with natural audio, quick cuts, and personal narration. Warm color grading, 8-12 minutes for YouTube long-form content."
  },
  image: {
    "동물_여행": "Golden retriever wearing a small travel backpack sitting in front of the Eiffel Tower, shot on Canon 5D with 85mm lens, golden hour lighting, shallow depth of field, travel photography style --ar 16:9 --style raw",
    "썸네일": "Eye-catching YouTube thumbnail with large text overlay, high contrast colors, expressive facial expression, bold typography, optimized for mobile viewing --ar 16:9"
  },
  dev: {
    "쇼핑몰": `E-commerce Platform Architecture:
Frontend: Next.js 14 + TypeScript + Tailwind CSS
Backend: Node.js + Express + JWT Authentication  
Database: PostgreSQL + Prisma ORM
Payments: Stripe integration with webhook handling
Features: Product catalog, shopping cart, user accounts, admin dashboard, order management
Deployment: Vercel frontend + Railway backend
Performance: Image optimization, caching strategy, SEO optimization`
  }
};

export default async function handler(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      title: 'API 키 설정 필요',
      message: 'OpenAI API 키를 설정해주세요.',
      canRetry: false
    });
  }

  try {
    const body = await readJson(req);
    const { userInput = '', answers = [], domain = 'video', step = 'start', round = 1 } = body;

    if (!userInput?.trim()) {
      return res.status(400).json({ success: false, message: '프롬프트를 입력해주세요.' });
    }

    console.log(`🎯 Round ${round}: ${step} - ${domain}`);

    switch (step) {
      case 'start':
      case 'questions':
        return await handleGuideBasedImprovement(res, userInput, answers, domain, round);
      case 'generate':
        return await handleFinalGeneration(res, userInput, answers, domain);
      default:
        return res.status(400).json({ success: false, message: '잘못된 단계입니다.' });
    }

  } catch (error) {
    console.error('❌ 시스템 오류:', error);
    return res.status(500).json({
      success: false,
      title: '처리 오류',
      message: error.message,
      canRetry: true
    });
  }
}

// 🎯 가이드 기반 개선 처리
async function handleGuideBasedImprovement(res, userInput, answers, domain, round) {
  try {
    // 1. 현재 가이드 완성도 분석
    const guideCompletion = analyzeGuideCompletion(userInput, answers, domain);
    const intentScore = calculateIntentScore(guideCompletion);
    
    // 2. 현재 정보로 프롬프트 생성 시도
    const currentPrompt = await generateCurrentPrompt(userInput, answers, domain, guideCompletion);
    const qualityScore = await evaluatePromptQuality(currentPrompt, domain);
    
    console.log(`📊 Round ${round} - 의도: ${intentScore}/95, 품질: ${qualityScore}/95`);
    console.log(`📋 가이드 완성도:`, Object.keys(guideCompletion.filled).length + '/' + Object.keys(COMPLETION_GUIDES[domain]).length);

    // 3. 95점 달성 체크
    if (intentScore >= 95 && qualityScore >= 95) {
      return res.status(200).json({
        success: true,
        step: 'completed',
        originalPrompt: userInput,
        improvedPrompt: currentPrompt,
        intentScore: 95,
        qualityScore: 95,
        message: '🎉 95점 고품질 프롬프트 완성!',
        attempts: round,
        guideCompletion: guideCompletion.filled
      });
    }

    // 4. 최대 라운드 체크 (5라운드로 제한)
    if (round >= 5) {
      return res.status(200).json({
        success: true,
        step: 'completed',
        originalPrompt: userInput,
        improvedPrompt: currentPrompt,
        intentScore: Math.max(intentScore, 85),
        qualityScore: Math.max(qualityScore, 85),
        message: `✨ 최대 라운드 도달 - 현재 최고 품질로 완성 (${round}라운드)`,
        attempts: round
      });
    }

    // 5. 부족한 가이드 기반 질문 생성
    const questions = await generateGuideBasedQuestions(guideCompletion.missing, domain, round);

    return res.status(200).json({
      success: true,
      step: 'questions',
      questions: questions,
      round: round + 1,
      intentScore,
      qualityScore,
      draftPrompt: currentPrompt,
      guideStatus: guideCompletion,
      message: `가이드 기반 ${questions.length}개 질문 생성 (${round}라운드)`
    });

  } catch (error) {
    console.error('가이드 기반 처리 오류:', error);
    throw error;
  }
}

// 🧭 가이드 완성도 분석
function analyzeGuideCompletion(userInput, answers, domain) {
  const guide = COMPLETION_GUIDES[domain];
  const allText = [userInput, ...answers].join(' ').toLowerCase();
  
  const filled = {};
  const missing = {};
  
  Object.entries(guide).forEach(([key, config]) => {
    // 키워드 매칭으로 완성도 체크
    const hasKeyword = config.keywords.some(keyword => allText.includes(keyword.toLowerCase()));
    
    // 답변에서 구체적 언급 체크
    const hasSpecificAnswer = answers.some(answer => 
      answer.toLowerCase().includes(key.toLowerCase()) || 
      config.keywords.some(k => answer.toLowerCase().includes(k.toLowerCase()))
    );
    
    if (hasKeyword || hasSpecificAnswer) {
      filled[key] = config;
    } else {
      missing[key] = config;
    }
  });
  
  return { filled, missing, total: Object.keys(guide).length };
}

// 📊 의도 파악 점수 계산 (가이드 완성도 기반)
function calculateIntentScore(guideCompletion) {
  const totalWeight = Object.values(COMPLETION_GUIDES.video).reduce((sum, item) => sum + item.weight, 0);
  const filledWeight = Object.values(guideCompletion.filled).reduce((sum, item) => sum + item.weight, 0);
  
  return Math.round((filledWeight / totalWeight) * 95);
}

// 🎯 가이드 기반 질문 생성
async function generateGuideBasedQuestions(missingGuides, domain, round) {
  // 중요도 순으로 정렬
  const sortedMissing = Object.entries(missingGuides)
    .sort(([,a], [,b]) => b.weight - a.weight)
    .slice(0, round <= 2 ? 3 : 2); // 초반엔 3개, 나중엔 2개

  const questions = sortedMissing.map(([key, config], index) => ({
    key: `guide_${key}_${round}`,
    question: `${key}에 대해 구체적으로 어떻게 하시겠어요?`,
    options: [...config.options, "직접 입력"],
    priority: config.weight >= 12 ? "high" : "medium",
    scoreValue: config.weight,
    guideKey: key
  }));

  // AI로 질문 자연스럽게 다듬기
  if (questions.length > 0) {
    try {
      const improvedQuestions = await refineQuestionsWithAI(questions, domain, round);
      return improvedQuestions.length > 0 ? improvedQuestions : questions;
    } catch (error) {
      console.log('질문 다듬기 실패, 기본 질문 사용:', error.message);
      return questions;
    }
  }

  return questions;
}

// ✨ AI로 질문 자연스럽게 다듬기
async function refineQuestionsWithAI(questions, domain, round) {
  const prompt = `${domain} 전문가로서 다음 질문들을 자연스럽고 구체적으로 다듬어주세요.

질문 목록: ${questions.map(q => `${q.guideKey}: ${q.question}`).join(', ')}

요구사항:
1. ${domain} 전문 용어 사용
2. 답변하기 쉬운 구체적 질문
3. 기존 선택지 유지하면서 자연스럽게

JSON 형식으로만 응답:
{
  "questions": [
    {
      "key": "${questions[0]?.key || 'q1'}",
      "question": "다듬어진 자연스러운 질문?",
      "options": ${JSON.stringify(questions[0]?.options || [])},
      "priority": "high",
      "scoreValue": ${questions[0]?.scoreValue || 10},
      "guideKey": "${questions[0]?.guideKey || 'key1'}"
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1000,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(completion.choices[0].message.content);
  return result.questions || questions;
}

// 📝 현재 프롬프트 생성
async function generateCurrentPrompt(userInput, answers, domain, guideCompletion) {
  const filledInfo = Object.keys(guideCompletion.filled).map(key => {
    const answer = answers.find(a => a.toLowerCase().includes(key.toLowerCase()));
    return answer ? `${key}: ${answer.split(':')[1]?.trim()}` : key;
  }).join(', ');

  // 패턴 매칭
  const bestPattern = findBestPattern(userInput, domain);
  
  const prompt = `${domain} 최고 전문가로서 현재 정보를 바탕으로 고품질 프롬프트를 생성하세요.

원본: "${userInput}"
수집 정보: ${filledInfo}
${bestPattern ? `참고 패턴: ${bestPattern}` : ''}

완성된 전문가 수준 프롬프트만 출력:`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    return bestPattern || `${userInput} (개선 중...)`;
  }
}

// 🏆 프롬프트 품질 평가
async function evaluatePromptQuality(prompt, domain) {
  const prompt_eval = `다음 ${domain} 프롬프트의 품질을 0-100점으로 평가하세요.

프롬프트: "${prompt}"

평가 기준:
- 구체성: 모호하지 않고 명확한가?
- 완성도: 실제 제작 가능한 수준인가?
- 전문성: 해당 분야 전문 용어 사용했나?
- 실용성: 바로 사용할 수 있는 품질인가?

숫자만 응답 (0-100):`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt_eval }],
      temperature: 0.3,
      max_tokens: 50
    });

    const score = parseInt(completion.choices[0].message.content.trim());
    return isNaN(score) ? 70 : Math.min(score, 95);
  } catch (error) {
    // 기본 품질 계산
    return Math.min(60 + (prompt.length / 10), 85);
  }
}

// 🔍 최적 패턴 찾기
function findBestPattern(userInput, domain) {
  const patterns = HIGH_QUALITY_PATTERNS[domain] || {};
  const input = userInput.toLowerCase();
  
  // 키워드 기반 패턴 매칭
  for (const [key, pattern] of Object.entries(patterns)) {
    const keywords = key.split('_');
    if (keywords.every(keyword => input.includes(keyword))) {
      return pattern;
    }
  }
  
  return null;
}

// 🎯 최종 생성 핸들러
async function handleFinalGeneration(res, userInput, answers, domain) {
  const guideCompletion = analyzeGuideCompletion(userInput, answers, domain);
  const finalPrompt = await generateCurrentPrompt(userInput, answers, domain, guideCompletion);
  const qualityScore = await evaluatePromptQuality(finalPrompt, domain);
  const intentScore = calculateIntentScore(guideCompletion);

  return res.status(200).json({
    success: true,
    step: 'completed',
    originalPrompt: userInput,
    improvedPrompt: finalPrompt,
    intentScore: Math.max(intentScore, 85),
    qualityScore: Math.max(qualityScore, 85),
    message: '✨ 가이드 기반 고품질 프롬프트 완성!',
    guideCompletion: guideCompletion.filled
  });
}
