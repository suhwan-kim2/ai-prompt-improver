// api/improve-prompt.js - 100% AI 기반 고급 프롬프트 개선 시스템 (완전판)
import { readJson } from './helpers.js';
import OpenAI from 'openai';

// OpenAI 클라이언트 초기화 - 필수!
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// API 키 체크
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY가 설정되지 않았습니다!');
}

export default async function handler(req, res) {
  // API 키 없으면 즉시 에러
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      title: '⚠️ OpenAI API 키 누락',
      message: 'AI 서비스를 사용하려면 OpenAI API 키가 필요합니다.',
      action: 'Vercel 환경변수에 OPENAI_API_KEY를 설정해주세요.'
    });
  }

  try {
    const body = await readJson(req);
    const {
      userInput = '',
      answers = [],
      domain = 'video',
      step = 'start',
      round = 1,
      asked = []
    } = body;

    console.log(`🤖 AI 프롬프트 개선 - Step: ${step}, Round: ${round}`);

    if (!userInput) {
      return res.status(400).json({
        success: false,
        message: '개선할 프롬프트를 입력해주세요.'
      });
    }

    // 단계별 AI 처리
    switch (step) {
      case 'start':
      case 'questions':
        return await handleAIQuestions(res, userInput, answers, domain, round, asked);
      case 'generate':
        return await handleAIGenerate(res, userInput, answers, domain);
      default:
        return res.status(400).json({
          success: false,
          message: '잘못된 요청입니다.'
        });
    }

  } catch (error) {
    console.error('❌ AI 처리 오류:', error);
    return res.status(500).json({
      success: false,
      title: '🤖 AI 서비스 오류',
      message: error.message || 'AI 처리 중 문제가 발생했습니다.',
      action: 'API 키를 확인하고 다시 시도해주세요.'
    });
  }
}

// 🤖 AI 기반 질문 생성 및 점수 계산
async function handleAIQuestions(res, userInput, answers, domain, round, asked) {
  try {
    // 1. 현재까지 수집된 정보로 점수 계산
    const scoreResult = await calculateScores(userInput, answers, domain);
    
    console.log(`📊 Round ${round} - 의도: ${scoreResult.intentScore}/95, 품질: ${scoreResult.qualityScore}/95`);

    // 2. 목표 달성 체크 (95/95)
    if (scoreResult.intentScore >= 95 && scoreResult.qualityScore >= 95) {
      const finalPrompt = await generateFinalPrompt(userInput, answers, domain);
      return res.status(200).json({
        success: true,
        step: 'completed',
        originalPrompt: userInput,
        improvedPrompt: finalPrompt,
        intentScore: 95,
        qualityScore: 95,
        message: '🎉 완벽한 95점 프롬프트가 완성되었습니다!',
        attempts: round
      });
    }

    // 3. 라운드 제한 체크
    if (round >= 10) {
      return handleAIGenerate(res, userInput, answers, domain);
    }

    // 4. AI가 다음 질문 생성
    const questions = await generateSmartQuestions(
      userInput, 
      answers, 
      domain, 
      round,
      asked,
      scoreResult
    );

    // 5. 현재 드래프트 생성
    const draftPrompt = await generateDraftPrompt(userInput, answers, domain);

    return res.status(200).json({
      success: true,
      step: 'questions',
      questions,
      round: round + 1,
      intentScore: scoreResult.intentScore,
      qualityScore: scoreResult.qualityScore,
      draftPrompt,
      status: scoreResult.intentScore < 95 ? 'collecting' : 'improving',
      message: `AI가 ${domain} 전문 질문을 생성했습니다. (${round}라운드)`
    });

  } catch (error) {
    console.error('질문 생성 오류:', error);
    throw error;
  }
}

// 🎯 AI로 스마트한 질문 생성
async function generateSmartQuestions(userInput, answers, domain, round, asked, scores) {
  const domainContext = getDomainContext(domain);
  
  const prompt = `당신은 ${domain} 프롬프트 개선 전문가입니다.
현재 프롬프트 품질을 95점 이상으로 만들기 위해 핵심 질문을 생성해야 합니다.

=== 현재 상황 ===
도메인: ${domain}
라운드: ${round}/10
원본 입력: "${userInput}"
현재 점수: 의도 ${scores.intentScore}/95, 품질 ${scores.qualityScore}/95

수집된 답변:
${answers.length > 0 ? answers.join('\n') : '아직 없음'}

이미 한 질문들:
${asked.length > 0 ? asked.join('\n') : '없음'}

=== ${domain} 필수 요소 ===
${domainContext}

=== 요구사항 ===
1. 아직 수집하지 못한 핵심 정보를 파악하는 질문 ${round <= 2 ? '5개' : '3개'}
2. 이미 한 질문과 절대 중복되지 않을 것
3. 답변하기 쉬운 객관식 형태 (4-5개 옵션 + 기타)
4. ${domain} 전문가 수준의 구체적 질문
5. 점수를 크게 향상시킬 수 있는 고가치 질문

JSON 형식으로 응답:
{
  "questions": [
    {
      "key": "unique_key",
      "question": "구체적인 한국어 질문",
      "options": ["옵션1", "옵션2", "옵션3", "옵션4", "직접 입력"],
      "priority": "high",
      "scoreValue": 10,
      "reason": "이 정보가 왜 중요한지"
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1500,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(completion.choices[0].message.content);
  return result.questions || [];
}

// 📊 AI로 점수 계산
async function calculateScores(userInput, answers, domain) {
  const allInfo = [userInput, ...answers].join('\n');
  
  const prompt = `프롬프트 품질 평가 전문가로서 다음 정보를 분석해주세요.

도메인: ${domain}
입력 정보:
${allInfo}

=== 평가 기준 ===
의도 파악 점수 (95점 만점):
- 목적 명확성 (25점): 무엇을 만들고 싶은지
- 대상 정의 (20점): 누구를 위한 것인지
- 기술 사양 (15점): 크기, 길이, 해상도 등
- 스타일 (15점): 시각적/청각적 스타일
- 제약사항 (10점): 예산, 시간, 플랫폼
- 세부사항 (10점): 구체적 요구사항

프롬프트 품질 점수 (95점 만점):
- 구체성 (30점): 모호한 표현이 없는가
- 완성도 (25점): 필수 요소가 모두 있는가
- 기술적 정확성 (20점): 전문 용어 사용
- 실행가능성 (20점): 실제 제작 가능한가

JSON 형식으로 점수만 응답:
{
  "intentScore": 0-95 사이 정수,
  "qualityScore": 0-95 사이 정수,
  "weakPoints": ["부족한 점1", "부족한 점2"]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0].message.content);
}

// ✨ 최종 프롬프트 생성
async function handleAIGenerate(res, userInput, answers, domain) {
  try {
    const finalPrompt = await generateFinalPrompt(userInput, answers, domain);
    const finalScores = await calculateScores(userInput, answers, domain);

    return res.status(200).json({
      success: true,
      step: 'completed',
      originalPrompt: userInput,
      improvedPrompt: finalPrompt,
      intentScore: Math.max(finalScores.intentScore, 85),
      qualityScore: Math.max(finalScores.qualityScore, 85),
      message: '✨ AI가 최고 품질의 프롬프트를 완성했습니다!'
    });

  } catch (error) {
    console.error('최종 생성 오류:', error);
    throw error;
  }
}

// 🎯 드래프트 프롬프트 생성
async function generateDraftPrompt(userInput, answers, domain) {
  const platform = getPlatform(domain);
  const allInfo = [userInput, ...answers].join('\n');

  const prompt = `${domain} 프롬프트 전문가로서 현재까지 정보로 최선의 프롬프트를 작성하세요.

플랫폼: ${platform}
정보: ${allInfo}

간결하고 전문적인 프롬프트만 작성 (설명 없이):`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 800
  });

  return completion.choices[0].message.content;
}

// 🏆 최종 완벽한 프롬프트 생성
async function generateFinalPrompt(userInput, answers, domain) {
  const platform = getPlatform(domain);
  const requirements = getRequirements(domain);
  
  // 답변 정리
  const cleanedAnswers = cleanupAnswers(answers);
  
  const prompt = `당신은 ${platform} 프롬프트 작성 전문가입니다.
다음 정보로 실제 ${platform}에 바로 사용할 수 있는 프롬프트를 작성하세요.

=== 입력 정보 ===
원본 요청: "${userInput}"
수집된 정보: ${cleanedAnswers}
모든 답변: ${answers.join(', ')}

=== 중요 규칙 ===
1. JSON이나 구조화된 형식 절대 금지
2. ${platform}에 직접 입력할 수 있는 자연어 프롬프트
3. 한 문단의 명확하고 구체적인 설명
4. 플랫폼별 파라미터는 프롬프트 끝에 추가
5. 모순되는 정보는 제거하고 핵심만 포함

${domain === 'video' ? `
=== Runway/Pika Labs 프롬프트 예시 ===
"Handheld camera following a happy golden retriever exploring various natural landscapes around the world. The dog walks through green parks, sniffs flowers, and playfully interacts with other animals. Peaceful atmosphere with soft natural lighting. Multiple short clips showing different locations, maintaining consistent look. Natural color grading, no special effects. -motion 3 --seed 12345"
` : ''}

${domain === 'image' ? `
=== Midjourney 프롬프트 예시 ===
"Professional photography of golden retriever puppy in magical forest, soft morning light filtering through trees, photorealistic, highly detailed fur texture, shallow depth of field, nature documentary style --ar 16:9 --stylize 750 --v 6"
` : ''}

${domain === 'dev' ? `
=== 개발 프로젝트 프롬프트 예시 ===
"E-commerce website using Next.js 14 and Tailwind CSS. Features: product catalog with filtering, shopping cart, user authentication with JWT, payment integration with Stripe. PostgreSQL database with Prisma ORM. Responsive design for mobile and desktop. Deploy on Vercel with CI/CD pipeline."
` : ''}

실제 사용 가능한 프롬프트만 출력 (설명이나 JSON 없이):`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 500
  });

  return completion.choices[0].message.content.trim();
}

// ============ 헬퍼 함수들 (오류 수정) ============

// 도메인별 컨텍스트
function getDomainContext(domain) {
  const contexts = {
    video: `필수: 플랫폼(유튜브/틱톡), 길이, 해상도, 타겟 시청자
중요: 스토리라인, 카메라 워크, 전환 효과, 음향
선택: 자막, 색보정, 특수효과`,
    
    image: `필수: 주체, 스타일(사실적/일러스트/3D), 해상도, 용도
중요: 조명, 구도, 색상 팔레트, 분위기
선택: 카메라 설정, 참조 아티스트, 플랫폼 파라미터`,
    
    dev: `필수: 프로젝트 유형, 기술 스택, 핵심 기능
중요: 데이터베이스, API 설계, 인증 방식
선택: 배포 환경, 성능 요구사항, 보안`
  };
  return contexts[domain] || contexts.video;
}

// 플랫폼 매핑
function getPlatform(domain) {
  const platforms = {
    video: 'Runway Gen-3/Pika Labs',
    image: 'Midjourney v6/DALL-E 3',
    dev: 'GitHub Copilot/Cursor'
  };
  return platforms[domain] || 'AI Platform';
}

// 플랫폼별 요구사항
function getRequirements(domain) {
  const reqs = {
    video: `- 카메라 움직임 명시 (dolly, pan, zoom)
- 씬 단위 구체적 묘사
- 조명과 분위기 설정
- 모션 강도 지정 (-motion 0-4)
- 시드값 일관성 (--seed)`,
    
    image: `- Midjourney: --ar 비율, --stylize 750, --v 6
- 네거티브 프롬프트 필수
- 품질 키워드: highly detailed, 8K, masterpiece
- 조명: dramatic lighting, golden hour
- 스타일 참조: trending on ArtStation`,
    
    dev: `- 명확한 프로젝트 스코프
- 기술 스택 상세 명시
- 데이터 모델 설계
- API 엔드포인트 정의
- 성능/보안 요구사항`
  };
  return reqs[domain] || '';
}

// 답변 정리 함수
function cleanupAnswers(answers) {
  const uniqueAnswers = {};
  
  answers.forEach(answer => {
    const [key, value] = answer.split(':').map(s => s.trim());
    if (key && value && value !== '없음' && value !== '불필요') {
      if (!uniqueAnswers[key]) {
        uniqueAnswers[key] = value;
      }
    }
  });
  
  const important = [];
  if (uniqueAnswers.video_length) important.push(`길이: ${uniqueAnswers.video_length}`);
  if (uniqueAnswers.resolution_quality) important.push(`해상도: ${uniqueAnswers.resolution_quality}`);
  if (uniqueAnswers.camera_work_style) important.push(`카메라: ${uniqueAnswers.camera_work_style}`);
  if (uniqueAnswers.specific_theme_or_mood) important.push(`분위기: ${uniqueAnswers.specific_theme_or_mood}`);
  if (uniqueAnswers.target_audience_age_group) important.push(`타겟: ${uniqueAnswers.target_audience_age_group}`);
  
  return important.join(', ');
}
