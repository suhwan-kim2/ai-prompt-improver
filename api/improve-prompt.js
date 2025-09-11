// api/improve-prompt.js - 완전한 AI 프롬프트 개선 시스템 (2025년 1월 최신)
import { readJson } from './helpers.js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🎬 영상 씬 분할 엔진 (인라인 클래스 - import 불필요)
class VideoSceneEngine {
  constructor() {
    this.PLATFORM_LIMITS = {
      runway: { maxDuration: 10, extension: 3, format: 'image+text' },
      pika: { fixedDuration: 3, motionRange: '0-4', format: 'image+text' },
      sora: { maxDuration: 20, resolution: '1920x1080', format: 'text' },
      stable_video: { maxFrames: 25, fps: 6, format: 'image_only' }
    };
  }

  async splitIntoScenes(userInput, answers, duration = 60) {
    const sceneCount = duration <= 15 ? 3 : duration <= 30 ? 5 : duration <= 60 ? 8 : Math.ceil(duration / 8);
    const scenes = [];
    
    // 답변에서 정보 추출
    const dog = answers.find(a => a.includes('웰시코기')) ? 'Welsh Corgi' : 
                answers.find(a => a.includes('강아지')) ? 'cute dog' : 'dog';
    const location = answers.find(a => a.includes('파리')) ? 'Paris' : 
                     answers.find(a => a.includes('유럽')) ? 'Europe' : 'world';
    const style = answers.find(a => a.includes('브이로그')) ? 'vlog style' : 
                  answers.find(a => a.includes('시네마틱')) ? 'cinematic' : 'travel video';
    
    for (let i = 0; i < sceneCount; i++) {
      const start = i * Math.floor(duration / sceneCount);
      const end = Math.min(start + Math.floor(duration / sceneCount), duration);
      
      scenes.push({
        scene: i + 1,
        duration: `${start}-${end}초`,
        image_prompt: this.generateImagePrompt(dog, location, style, i + 1, sceneCount),
        video_prompt: this.generateVideoPrompt(dog, location, style, i + 1, sceneCount),
        camera: this.getCameraWork(i),
        transition: this.getTransition(i)
      });
    }
    
    return scenes;
  }

  generateImagePrompt(subject, location, style, sceneNum, totalScenes) {
    const prompts = {
      1: `${subject} with travel backpack arriving at ${location}, excited expression, ${style}, golden hour lighting, 4K quality`,
      2: `${subject} exploring famous landmark in ${location}, curious look, ${style}, professional photography`,
      3: `${subject} at local cafe in ${location}, sitting at table, ${style}, warm atmosphere, shallow depth of field`,
      4: `${subject} walking through streets of ${location}, happy trotting, ${style}, dynamic composition`,
      5: `${subject} meeting local people in ${location}, friendly interaction, ${style}, candid moment`,
      6: `${subject} enjoying sunset view in ${location}, peaceful moment, ${style}, cinematic lighting`,
      7: `${subject} playing in park of ${location}, joyful movement, ${style}, vibrant colors`,
      8: `${subject} at night scene in ${location}, city lights background, ${style}, moody lighting`
    };
    
    return prompts[sceneNum] || `${subject} in ${location}, scene ${sceneNum}, ${style}, high quality`;
  }

  generateVideoPrompt(subject, location, style, sceneNum, totalScenes) {
    const prompts = {
      1: `${subject} wagging tail excitedly, looking around ${location}, slow zoom in, ${style}`,
      2: `${subject} sniffing and exploring landmark, head tilting curiously, tracking shot, ${style}`,
      3: `${subject} at cafe, sniffing food, cute reactions, close-up shot, ${style}`,
      4: `${subject} trotting happily through streets, ears bouncing, following shot, ${style}`,
      5: `${subject} interacting with people, tail wagging, natural reactions, ${style}`,
      6: `${subject} sitting peacefully watching sunset, slow pan across scenery, ${style}`,
      7: `${subject} running and playing, dynamic movement, multiple angles, ${style}`,
      8: `${subject} under city lights, looking up at buildings, ambient mood, ${style}`
    };
    
    return prompts[sceneNum] || `${subject} natural movement in ${location}, scene ${sceneNum}, ${style}`;
  }

  getCameraWork(index) {
    const works = ['Static shot', 'Slow zoom in', 'Pan left to right', 'Tracking shot', 'Close-up', 'Wide angle', 'Drone shot', 'Handheld'];
    return works[index % works.length];
  }

  getTransition(index) {
    const transitions = ['Cut to', 'Fade in', 'Cross dissolve', 'Match cut', 'Wipe', 'Zoom transition'];
    return transitions[index % transitions.length];
  }
}

// 🎯 도메인별 완성도 가이드 (2025년 최신)
const COMPLETION_GUIDES = {
  video: {
    플랫폼: { 
      weight: 15, 
      options: ["유튜브 쇼츠", "틱톡", "인스타 릴스", "유튜브 롱폼", "광고"],
      keywords: ["유튜브", "틱톡", "인스타", "쇼츠", "릴스", "광고"]
    },
    길이: { 
      weight: 15, 
      options: ["15초", "30초", "60초", "3분", "5분+"],
      keywords: ["초", "분", "길이", "시간"]
    },
    주인공: { 
      weight: 12, 
      options: ["사람", "동물", "제품", "캐릭터", "풍경"],
      keywords: ["강아지", "고양이", "사람", "캐릭터", "주인공", "웰시코기"]
    },
    스토리: { 
      weight: 12, 
      options: ["튜토리얼", "브이로그", "스토리텔링", "제품소개", "교육"],
      keywords: ["이야기", "스토리", "내용", "줄거리", "브이로그"]
    },
    스타일: { 
      weight: 10, 
      options: ["시네마틱", "다큐멘터리", "애니메이션", "실사", "모션그래픽"],
      keywords: ["스타일", "느낌", "분위기", "톤", "시네마틱", "실사"]
    },
    씬구성: { 
      weight: 10, 
      options: ["3-5개", "6-10개", "10개이상"],
      keywords: ["씬", "장면", "구성", "분할"]
    },
    카메라: { 
      weight: 8, 
      options: ["고정", "핸드헬드", "드론", "짐벌", "크레인"],
      keywords: ["카메라", "촬영", "앵글", "샷", "흥미로운"]
    },
    음향: { 
      weight: 8, 
      options: ["BGM", "내레이션", "효과음", "무음"],
      keywords: ["음악", "소리", "음향", "BGM"]
    },
    장소: { 
      weight: 6, 
      options: ["실내", "실외", "스튜디오", "자연", "도시"],
      keywords: ["장소", "위치", "배경", "유럽", "파리", "세계"]
    },
    색감: { 
      weight: 4, 
      options: ["따뜻한", "차가운", "비비드", "빈티지"],
      keywords: ["색", "컬러", "톤"]
    }
  },
  
  image: {
    용도: { 
      weight: 15, 
      options: ["썸네일", "포스터", "로고", "일러스트", "NFT", "SNS"],
      keywords: ["썸네일", "포스터", "로고", "용도", "NFT"]
    },
    주체: { 
      weight: 15, 
      options: ["인물", "동물", "제품", "풍경", "추상"],
      keywords: ["사람", "강아지", "고양이", "제품", "풍경"]
    },
    스타일: { 
      weight: 12, 
      options: ["사실적", "일러스트", "3D", "수채화", "미니멀", "사이버펑크"],
      keywords: ["스타일", "화풍", "그림체", "아트"]
    },
    플랫폼: { 
      weight: 10, 
      options: ["Midjourney", "DALL-E", "Stable Diffusion", "Sora", "NanoBanana"],
      keywords: ["midjourney", "dalle", "stable", "sora", "nanobanana"]
    },
    해상도: { 
      weight: 10, 
      options: ["HD", "4K", "8K", "정사각형", "세로", "가로"],
      keywords: ["해상도", "크기", "비율", "4k", "8k"]
    },
    조명: { 
      weight: 10, 
      options: ["자연광", "스튜디오", "황금시간", "네온", "드라마틱"],
      keywords: ["조명", "빛", "라이팅", "광"]
    },
    색상: { 
      weight: 8, 
      options: ["모노톤", "파스텔", "비비드", "어스톤", "네온"],
      keywords: ["색상", "컬러", "색깔", "팔레트"]
    },
    구도: { 
      weight: 8, 
      options: ["클로즈업", "전신", "버드아이뷰", "로우앵글", "3분할"],
      keywords: ["구도", "앵글", "시점", "구성"]
    },
    배경: { 
      weight: 6, 
      options: ["단순", "복잡", "블러", "그라디언트", "패턴"],
      keywords: ["배경", "백그라운드", "환경"]
    },
    분위기: { 
      weight: 6, 
      options: ["밝은", "어두운", "몽환적", "역동적", "평화로운"],
      keywords: ["분위기", "무드", "느낌"]
    }
  },
  
  dev: {
    프로젝트: { 
      weight: 15, 
      options: ["웹사이트", "모바일앱", "API", "게임", "자동화"],
      keywords: ["웹", "앱", "사이트", "API", "게임"]
    },
    플랫폼: { 
      weight: 12, 
      options: ["웹", "iOS", "Android", "데스크톱", "크로스플랫폼"],
      keywords: ["웹", "모바일", "iOS", "안드로이드", "플랫폼"]
    },
    기술스택: { 
      weight: 12, 
      options: ["React", "Vue", "Next.js", "Node.js", "Python", "Flutter"],
      keywords: ["react", "vue", "next", "node", "python", "flutter"]
    },
    AI모델: { 
      weight: 10, 
      options: ["Claude", "GPT-4", "Copilot", "Cursor"],
      keywords: ["claude", "gpt", "copilot", "cursor", "ai"]
    },
    데이터베이스: { 
      weight: 10, 
      options: ["PostgreSQL", "MongoDB", "Firebase", "MySQL", "Redis"],
      keywords: ["데이터베이스", "db", "postgres", "mongo", "firebase"]
    },
    기능: { 
      weight: 10, 
      options: ["로그인", "결제", "실시간", "검색", "AI통합"],
      keywords: ["기능", "feature", "로그인", "결제", "검색"]
    },
    사용자: { 
      weight: 8, 
      options: ["일반사용자", "관리자", "개발자", "기업", "학생"],
      keywords: ["사용자", "유저", "고객", "관리자"]
    },
    보안: { 
      weight: 8, 
      options: ["기본", "OAuth", "JWT", "2FA", "엔터프라이즈"],
      keywords: ["보안", "인증", "security", "auth"]
    },
    배포: { 
      weight: 8, 
      options: ["Vercel", "AWS", "Netlify", "Heroku", "Docker"],
      keywords: ["배포", "deploy", "vercel", "aws", "docker"]
    },
    규모: { 
      weight: 7, 
      options: ["MVP", "소규모", "중규모", "대규모", "엔터프라이즈"],
      keywords: ["규모", "크기", "scale", "mvp"]
    }
  }
};

// 🏆 최고 품질 프롬프트 패턴 (2025년 1월 최신)
const HIGH_QUALITY_PATTERNS = {
  video: {
    "여행_강아지": `Travel vlog featuring a dog exploring world landmarks. 
                    60-second format optimized for YouTube Shorts. 
                    Scene breakdown: arrival, exploration, local interaction, 
                    sunset moments. Upbeat music, smooth transitions, 
                    professional color grading.`,
    
    "요리_동물": `Chef animal in professional kitchen, step-by-step cooking process, 
                  close-up shots of ingredients, steam effects, warm lighting, 
                  upbeat background music, quick cuts, 60 seconds format`,
    
    "여행_브이로그": `Travel vlog style, handheld camera movement, natural lighting,
                      location transitions, time-lapse sequences, ambient sounds,
                      personal narration, 3-5 minute format`,
    
    "제품_광고": `Product showcase, dynamic camera angles, studio lighting,
                  slow-motion highlights, modern graphics, upbeat music,
                  call-to-action ending, 30 seconds format`
  },
  
  image: {
    "sora_이미지": `Photorealistic quality, temporal consistency for video frames,
                    cinematic composition, natural lighting, 1920x1080 resolution,
                    smooth motion blur, professional color grading`,
    
    "nanobanana_고품질": `Ultra detailed 8K resolution, hyperrealistic textures,
                          professional photography style, perfect lighting,
                          award-winning composition, trending on artstation`,
    
    "midjourney_v7": `[subject], [environment], [art style], [lighting mood],
                      [color palette], [camera angle] --ar 16:9 --stylize 200 
                      --chaos 10 --quality 2 --version 7`,
    
    "dalle3_자연어": `A beautifully composed image showing [detailed description].
                      The scene features [specific elements] with [lighting].
                      The style is [artistic style] with [color mood].
                      High resolution, professional quality.`,
    
    "stable_diffusion_xl": `(masterpiece:1.3), (best quality:1.3), (detailed:1.2),
                           [main subject], [style modifiers], [lighting],
                           [composition], [mood], professional photography,
                           8k uhd, dslr, soft lighting, high quality`
  },
  
  dev: {
    "claude_구조화": `<task>
      <objective>Build a [project type] that [main purpose]</objective>
      <requirements>
        <functional>[list of features]</functional>
        <technical>[tech stack details]</technical>
        <constraints>[limitations]</constraints>
      </requirements>
      <context>[project background]</context>
    </task>
    
    Please provide a complete implementation with:
    1. Project structure
    2. Core functionality
    3. Error handling
    4. Best practices`,
    
    "gpt4_체인": `## Project: [Name]
    
    ### Goal
    Create a [type] application that [purpose]
    
    ### Requirements
    1. [Requirement 1]
    2. [Requirement 2]
    
    ### Tech Stack
    - Frontend: [technologies]
    - Backend: [technologies]
    - Database: [technology]
    
    Let's think step by step:
    1. First, design the architecture
    2. Then implement core features
    3. Finally, optimize and test
    
    Provide production-ready code with comments.`
  }
};

// 🎯 메인 핸들러
export default async function handler(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      title: '⚠️ API 키 설정 필요',
      message: 'OpenAI API 키를 환경변수에 설정해주세요.',
      action: '.env 파일에 OPENAI_API_KEY 추가',
      canRetry: false
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

    if (!userInput?.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: '프롬프트를 입력해주세요.' 
      });
    }

    console.log(`🎯 라운드 ${round}: ${step} - ${domain} 도메인`);
    console.log(`📝 사용자 입력: "${userInput}"`);
    console.log(`📋 답변 수집: ${answers.length}개`);

    switch (step) {
      case 'start':
      case 'questions':
        return await handleGuideBasedImprovement(res, userInput, answers, domain, round, asked);
      
      case 'generate':
        return await handleFinalGeneration(res, userInput, answers, domain);
      
      default:
        return res.status(400).json({ 
          success: false, 
          message: '잘못된 단계입니다.' 
        });
    }

  } catch (error) {
    console.error('❌ 시스템 오류:', error);
    return res.status(500).json({
      success: false,
      title: '🔧 처리 중 오류 발생',
      message: error.message || '일시적인 오류가 발생했습니다.',
      action: '잠시 후 다시 시도해주세요.',
      canRetry: true
    });
  }
}

// 🎯 가이드 기반 개선 처리
async function handleGuideBasedImprovement(res, userInput, answers, domain, round, asked = []) {
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
      return await handleFinalGeneration(res, userInput, answers, domain, intentScore, qualityScore);
    }

    // 4. 최대 라운드 체크 (5라운드로 제한)
    if (round >= 5) {
      return await handleFinalGeneration(res, userInput, answers, domain, 
                                        Math.max(intentScore, 85), 
                                        Math.max(qualityScore, 85));
    }

    // 5. 부족한 가이드 기반 질문 생성
    const questions = await generateGuideBasedQuestions(guideCompletion.missing, domain, round, userInput, answers, asked);

    return res.status(200).json({
      success: true,
      step: 'questions',
      questions: questions,
      round: round + 1,
      intentScore,
      qualityScore,
      draftPrompt: currentPrompt,
      guideStatus: guideCompletion,
      message: `가이드 기반 ${questions.length}개 질문 생성 (${round}라운드)`,
      status: 'collecting',
      progress: {
        intentScore,
        qualityScore,
        round: round + 1
      }
    });

  } catch (error) {
    console.error('가이드 기반 처리 오류:', error);
    // 오류시 바로 생성
    return await handleFinalGeneration(res, userInput, answers, domain, 70, 70);
  }
}

// 🧭 가이드 완성도 분석
function analyzeGuideCompletion(userInput, answers, domain) {
  const guide = COMPLETION_GUIDES[domain];
  const allText = [userInput, ...answers].join(' ').toLowerCase();
  
  const filled = {};
  const missing = {};
  let totalWeight = 0;
  let filledWeight = 0;
  
  Object.entries(guide).forEach(([key, config]) => {
    totalWeight += config.weight;
    
    // 키워드 매칭으로 완성도 체크
    const hasKeyword = config.keywords.some(keyword => 
      allText.includes(keyword.toLowerCase())
    );
    
    // 답변에서 구체적 언급 체크
    const hasSpecificAnswer = answers.some(answer => 
      answer.toLowerCase().includes(key.toLowerCase()) || 
      config.keywords.some(k => answer.toLowerCase().includes(k.toLowerCase()))
    );
    
    if (hasKeyword || hasSpecificAnswer) {
      filled[key] = config;
      filledWeight += config.weight;
    } else {
      missing[key] = config;
    }
  });
  
  return { 
    filled, 
    missing, 
    total: Object.keys(guide).length,
    completionRate: Math.round((filledWeight / totalWeight) * 100)
  };
}

// 📊 의도 파악 점수 계산 (가이드 완성도 기반)
function calculateIntentScore(guideCompletion) {
  // 완성률 기반 점수 (0-95)
  return Math.min(Math.round(guideCompletion.completionRate * 0.95), 95);
}

// 🎯 가이드 기반 질문 생성
async function generateGuideBasedQuestions(missingGuides, domain, round, userInput, answers, asked = []) {
  // 이미 물어본 질문 추적
  const askedSet = new Set(asked.map(q => q.toLowerCase()));
  
  // 중요도 순으로 정렬
  const sortedMissing = Object.entries(missingGuides)
    .sort(([,a], [,b]) => b.weight - a.weight)
    .filter(([key, config]) => {
      // 이미 물어본 질문 제외
      const questionText = `${key}에 대해 구체적으로 어떻게 하시겠어요?`;
      return !askedSet.has(questionText.toLowerCase());
    })
    .slice(0, round <= 2 ? 3 : 2); // 초반엔 3개, 나중엔 2개

  const questions = sortedMissing.map(([key, config], index) => ({
    key: `guide_${key}_${round}`,
    question: `${key}에 대해 구체적으로 어떻게 하시겠어요?`,
    options: [...config.options, "직접 입력"],
    priority: config.weight >= 12 ? "high" : "medium",
    scoreValue: config.weight,
    guideKey: key
  }));

  // AI로 질문 자연스럽게 다듬기 (3라운드 이상)
  if (round >= 3 && questions.length > 0) {
    try {
      const improvedQuestions = await refineQuestionsWithAI(questions, domain, round, userInput, answers);
      return improvedQuestions.length > 0 ? improvedQuestions : questions;
    } catch (error) {
      console.log('질문 다듬기 실패, 기본 질문 사용:', error.message);
      return questions;
    }
  }

  // AI 추가 질문 (라운드 3 이상에서 질문이 부족할 때)
  if (round >= 3 && questions.length < 2) {
    try {
      const aiQuestions = await generateAIQuestions(userInput, answers, domain, round);
      questions.push(...aiQuestions);
    } catch (error) {
      console.log('AI 질문 생성 실패');
    }
  }

  return questions.slice(0, 3); // 최대 3개
}

// ✨ AI로 질문 자연스럽게 다듬기
async function refineQuestionsWithAI(questions, domain, round, userInput, answers) {
  const prompt = `${domain} 전문가로서 다음 질문들을 자연스럽고 구체적으로 다듬어주세요.

원본 요청: "${userInput}"
현재까지 답변: ${answers.join(', ')}

질문 목록: ${questions.map(q => `${q.guideKey}: ${q.question}`).join(', ')}

요구사항:
1. ${domain} 전문 용어 사용
2. 답변하기 쉬운 구체적 질문
3. 기존 선택지 유지하면서 자연스럽게
4. 이미 답변한 내용과 중복되지 않게

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

// 🤖 AI 추가 질문 생성
async function generateAIQuestions(userInput, answers, domain, round) {
  const prompt = `${domain} 전문가로서 "${userInput}"를 완성하기 위한 핵심 질문 2개를 생성하세요.

현재까지 정보: ${answers.join(', ')}

아직 파악되지 않은 중요한 정보를 물어보세요.

JSON 형식:
{
  "questions": [
    {
      "key": "ai_q1",
      "question": "구체적인 질문",
      "options": ["옵션1", "옵션2", "옵션3", "직접 입력"],
      "priority": "high"
    }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return result.questions || [];
  } catch (error) {
    return [];
  }
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
수집 정보: ${filledInfo || answers.join(', ')}
${bestPattern ? `참고 패턴: ${bestPattern}` : ''}

완성된 전문가 수준 프롬프트만 출력 (영어로):`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    return bestPattern || `${userInput}. ${filledInfo}. Professional quality.`;
  }
}

// 🏆 프롬프트 품질 평가
async function evaluatePromptQuality(prompt, domain) {
  // 기본 품질 계산
  const length = prompt.length;
  let score = Math.min(length / 10, 40); // 길이 점수 (최대 40점)
  
  // 도메인별 키워드 체크
  const qualityKeywords = {
    video: ['scene', 'camera', 'transition', 'lighting', 'duration', 'format'],
    image: ['resolution', 'style', 'composition', 'lighting', 'quality', 'detailed'],
    dev: ['requirements', 'features', 'architecture', 'implementation', 'stack']
  };
  
  const keywords = qualityKeywords[domain] || [];
  const keywordMatches = keywords.filter(kw => 
    prompt.toLowerCase().includes(kw)
  ).length;
  
  score += keywordMatches * 8; // 키워드당 8점
  
  // 구조 점수
  if (prompt.includes('\n')) score += 10;
  if (prompt.includes('•') || prompt.includes('-')) score += 5;
  
  return Math.min(score, 95);
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
async function handleFinalGeneration(res, userInput, answers, domain, intentScore = 85, qualityScore = 85) {
  try {
    console.log('🎉 최종 프롬프트 생성 시작');
    
    // 영상 도메인: 씬 분할 처리
    if (domain === 'video') {
      const videoEngine = new VideoSceneEngine();
      
      // 길이 추출
      const duration = extractDuration(answers) || 60;
      console.log(`🎬 영상 길이: ${duration}초`);
      
      // 씬 분할 실행
      const scenes = await videoEngine.splitIntoScenes(userInput, answers, duration);
      
      // 씬별 프롬프트 텍스트 생성
      const scenePrompts = scenes.map(s => `
### 씬 ${s.scene} (${s.duration})
📷 이미지 프롬프트: ${s.image_prompt}
🎬 영상 프롬프트: ${s.video_prompt}
📹 카메라: ${s.camera} | 🔄 전환: ${s.transition}
`).join('\n');
      
      // 전체 시나리오
      const fullScenario = `
## 🎬 영상 시나리오: ${userInput}

### 📊 개요
- 총 길이: ${duration}초
- 씬 개수: ${scenes.length}개
- 플랫폼: ${getSelectedPlatform(answers)}
- 스타일: ${getSelectedStyle(answers)}

### 🎞️ 씬별 프롬프트
${scenePrompts}

### 💡 플랫폼별 사용 가이드

**Runway Gen-3 (추천):**
1. 각 씬의 이미지 프롬프트로 첫 프레임 생성
2. Image to Video 모드로 전환
3. 영상 프롬프트 입력 후 10초씩 생성
4. Extend 기능으로 연결 (최대 3회)

**Pika Labs:**
1. Discord에서 /create 명령어 사용
2. 이미지 업로드 + 프롬프트 입력
3. -motion 2 -ar 16:9 설정 추가
4. 3초씩 생성 후 연결

**Sora (OpenAI):**
1. 텍스트 프롬프트만 입력
2. 최대 20초까지 한 번에 생성 가능
3. 스타일 일관성 자동 유지

### 🎯 프로 팁
- 씬 간 연속성: 이전 씬 마지막 프레임을 다음 씬 시작에 활용
- 캐릭터 일관성: 동일한 seed 값 사용 (Runway: --seed 123)
- 색감 통일: 모든 씬에 동일한 색상 팔레트 키워드 추가
`;
      
      return res.status(200).json({
        success: true,
        step: 'completed',
        originalPrompt: userInput,
        improvedPrompt: fullScenario,
        scenarioData: {
          scenes: scenes,
          totalDuration: duration,
          sceneCount: scenes.length
        },
        intentScore,
        qualityScore,
        message: '🎬 영상 씬 분할 완성! 각 씬별로 바로 사용 가능한 프롬프트입니다.',
        attempts: answers.length
      });
    }
    
    // 이미지/개발 도메인: 일반 프롬프트
    const guideCompletion = analyzeGuideCompletion(userInput, answers, domain);
    const finalPrompt = await generateFinalPrompt(userInput, answers, domain, guideCompletion);
    
    return res.status(200).json({
      success: true,
      step: 'completed',
      originalPrompt: userInput,
      improvedPrompt: finalPrompt,
      intentScore,
      qualityScore,
      message: `✨ ${domain === 'image' ? '이미지' : '개발'} 프롬프트 완성!`,
      platformGuides: generatePlatformGuides(domain),
      attempts: answers.length
    });
    
  } catch (error) {
    console.error('최종 생성 오류:', error);
    
    // 폴백: 기본 프롬프트 반환
    const fallbackPrompt = `${userInput}\n\n추가 정보:\n${answers.join('\n')}`;
    
    return res.status(200).json({
      success: true,
      step: 'completed',
      originalPrompt: userInput,
      improvedPrompt: fallbackPrompt,
      intentScore: 80,
      qualityScore: 80,
      message: '프롬프트가 생성되었습니다.',
      attempts: answers.length
    });
  }
}

// 🎯 최종 프롬프트 생성 (GPT 활용)
async function generateFinalPrompt(userInput, answers, domain, guideCompletion) {
  const pattern = findBestPattern(userInput, domain);
  
  if (pattern) {
    return pattern;
  }
  
  try {
    const systemPrompt = `You are an expert ${domain} prompt engineer. 
Create a professional, detailed prompt that will produce excellent results.
Focus on clarity, specificity, and actionable instructions.`;
    
    const userPrompt = `
Original request: "${userInput}"
Additional info: ${answers.join(', ')}
Domain: ${domain}

Create a perfect ${domain} prompt for AI generation:`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 800
    });
    
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('GPT 생성 실패:', error);
    // 폴백
    return `${userInput}. ${answers.join('. ')}. High quality, professional result.`;
  }
}

// 📏 길이 추출
function extractDuration(answers) {
  const text = answers.join(' ');
  
  // 정확한 매칭
  if (text.includes('15초')) return 15;
  if (text.includes('30초')) return 30;
  if (text.includes('60초')) return 60;
  if (text.includes('3분')) return 180;
  if (text.includes('5분')) return 300;
  
  // 패턴 매칭
  const patterns = [
    { regex: /(\d+)\s*초/, multiplier: 1 },
    { regex: /(\d+)\s*분/, multiplier: 60 }
  ];
  
  for (const { regex, multiplier } of patterns) {
    const match = text.match(regex);
    if (match) {
      return parseInt(match[1]) * multiplier;
    }
  }
  
  return 60; // 기본값
}

// 📱 플랫폼 추출
function getSelectedPlatform(answers) {
  const text = answers.join(' ').toLowerCase();
  
  if (text.includes('유튜브') || text.includes('youtube')) return 'YouTube Shorts';
  if (text.includes('틱톡') || text.includes('tiktok')) return 'TikTok';
  if (text.includes('인스타') || text.includes('instagram')) return 'Instagram Reels';
  
  return 'YouTube Shorts'; // 기본값
}

// 🎨 스타일 추출
function getSelectedStyle(answers) {
  const text = answers.join(' ').toLowerCase();
  
  if (text.includes('시네마틱')) return '시네마틱';
  if (text.includes('브이로그') || text.includes('vlog')) return '브이로그';
  if (text.includes('실사')) return '실사';
  if (text.includes('애니메이션')) return '애니메이션';
  
  return '일반 영상'; // 기본값
}

// 📚 플랫폼 가이드 생성
function generatePlatformGuides(domain) {
  const guides = {
    video: {
      runway: "Gen-3: Image to Video, 10초 단위, 고품질",
      pika: "Pika Labs: 3초 고정, 빠른 생성, /create 명령",
      sora: "OpenAI Sora: 최대 20초, 텍스트만으로 가능",
      stable_video: "Stable Video: 오픈소스, 25프레임"
    },
    image: {
      midjourney: "/imagine prompt + --v 7 --ar 16:9",
      dalle3: "ChatGPT 통합, 자연어 대화로 개선",
      stable_diffusion: "로컬 실행 가능, LoRA 커스터마이징",
      sora: "비디오 프레임 추출로 이미지 생성",
      nanobanana: "초고해상도, 전문 사진 품질"
    },
    dev: {
      claude: "XML 태그 구조화, 안전성 중시",
      gpt4: "Chain of Thought, 창의적 해결",
      copilot: "VS Code 통합, 코드 자동완성",
      cursor: "전체 프로젝트 컨텍스트 이해"
    }
  };
  
  return guides[domain] || {};
}
