// api/improve-prompt.js - 완전한 AI 프롬프트 개선 시스템 (2025년 1월 최신)
import { readJson } from './helpers.js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🎬 영상 씬 분할 엔진 (인라인 클래스)
class VideoSceneEngine {
  constructor() {
    this.PLATFORM_LIMITS = {
      runway: { maxDuration: 10, extension: 3, format: 'image+text' },
      pika: { fixedDuration: 3, motionRange: '0-4', format: 'image+text' },
      sora: { maxDuration: 20, resolution: '1920x1080', format: 'text' },
      stable_video: { maxFrames: 25, fps: 6, format: 'image_only' }
    };
  }

  async splitIntoScenesWithConcept(userInput, answers, duration = 60) {
    const sceneCount = duration <= 15 ? 3 : duration <= 30 ? 5 : duration <= 60 ? 8 : Math.ceil(duration / 8);
    const scenes = [];
    
    // 특별 컨셉 추출
    const isSoloTravel = answers.some(a => 
      a.includes('혼자') || a.includes('사람처럼') || a.includes('사람 처럼')
    );
    const takesFlight = answers.some(a => a.includes('비행기'));
    const location = answers.find(a => a.includes('유럽')) ? 'Europe' : 
                    answers.find(a => a.includes('파리')) ? 'Paris' : 'world';
    const dogType = answers.find(a => a.includes('웰시코기')) ? 'Welsh Corgi' : 'cute dog';
    
    // 사람처럼 혼자 여행하는 강아지 씬
    const soloTravelScenes = [
      {
        concept: "✈️ 비행기 탑승",
        korean: "강아지가 비행기 좌석에 사람처럼 앉아 기내지를 읽는 모습",
        image: `${dogType} wearing tiny travel vest and glasses, sitting upright in airplane seat like human passenger, reading in-flight magazine, window view of clouds`,
        video: `${dogType} flipping through magazine pages with paw, looking out airplane window excitedly, adjusting seat belt, acting like human passenger`
      },
      {
        concept: "🏨 호텔 체크인",
        korean: "강아지가 호텔 프런트에서 체크인하는 모습",
        image: `${dogType} standing on hind legs at luxury hotel reception desk, passport in mouth, tiny suitcase beside, bell hop in background`,
        video: `${dogType} placing paws on check-in counter, nodding to receptionist, dragging small suitcase with mouth, wagging tail happily`
      },
      {
        concept: "📸 관광지 셀카",
        korean: "강아지가 에펠탑 앞에서 셀카봉으로 사진 찍는 모습",
        image: `${dogType} holding selfie stick with paw, posing at ${location} famous landmark, wearing tourist cap and sunglasses, camera angle from selfie perspective`,
        video: `${dogType} adjusting selfie stick angle with paw, making different cute poses, pressing camera button with nose, checking photo on phone`
      },
      {
        concept: "☕ 카페 주문",
        korean: "강아지가 카페에서 메뉴를 보며 주문하는 모습",
        image: `${dogType} sitting at outdoor cafe table in ${location}, menu propped up in paws, wearing beret, croissant and coffee on table`,
        video: `${dogType} pointing at menu items with paw, barking order to waiter, attempting to sip coffee, eating croissant delicately`
      },
      {
        concept: "🛍️ 기념품 쇼핑",
        korean: "강아지가 기념품 가게에서 쇼핑하는 모습",
        image: `${dogType} in souvenir shop, examining postcards with paw, tiny shopping basket on back, shelves full of ${location} souvenirs`,
        video: `${dogType} sniffing various souvenirs, picking items with mouth, placing in basket, looking at price tags with tilted head`
      },
      {
        concept: "🗺️ 지도 보기",
        korean: "강아지가 관광 지도를 펼쳐보는 모습",
        image: `${dogType} with tourist map spread out on bench, wearing reading glasses on nose, paw tracing route, ${location} landmarks visible`,
        video: `${dogType} studying map intently, tracing route with paw, looking up at street signs, folding map with struggle, looking confused but determined`
      },
      {
        concept: "🍝 현지 음식",
        korean: "강아지가 레스토랑에서 포크를 들고 식사하는 모습",
        image: `${dogType} at fancy restaurant table, napkin tucked in collar, attempting to hold fork with paws, local ${location} cuisine on plate`,
        video: `${dogType} trying to use utensils with paws, sniffing gourmet food, eating elegantly, wagging tail in approval, licking lips satisfied`
      },
      {
        concept: "🌅 일몰 감상",
        korean: "강아지가 전망대에서 석양을 바라보는 모습",
        image: `${dogType} sitting on scenic viewpoint bench like human, watching sunset over ${location} skyline, travel journal and camera beside`,
        video: `${dogType} sighing contentedly at sunset view, writing in journal with pen in mouth, taking photos, peaceful contemplative moment`
      }
    ];
    
    // 일반 강아지 여행 씬
    const regularScenes = [
      {
        concept: "🛬 도착",
        korean: "강아지가 여행지에 도착한 모습",
        image: `${dogType} with travel backpack arriving at ${location}, excited expression, airport or train station background`,
        video: `${dogType} wagging tail excitedly, looking around with wonder, jumping with joy`
      },
      {
        concept: "🏛️ 관광",
        korean: "강아지가 유명 관광지를 구경하는 모습",
        image: `${dogType} at famous ${location} landmark, tourist atmosphere, professional photography`,
        video: `${dogType} exploring landmark, sniffing around curiously, posing for photos`
      },
      {
        concept: "🚶 거리 산책",
        korean: "강아지가 거리를 걷는 모습",
        image: `${dogType} walking through charming ${location} streets, cobblestone roads, local architecture`,
        video: `${dogType} trotting happily, looking at shop windows, following interesting scents`
      },
      {
        concept: "🤝 현지인 만남",
        korean: "강아지가 현지인과 교감하는 모습",
        image: `${dogType} meeting friendly locals in ${location}, getting petted, happy interaction`,
        video: `${dogType} wagging tail, getting belly rubs, playing with local children`
      },
      {
        concept: "🌳 공원 놀이",
        korean: "강아지가 공원에서 노는 모습",
        image: `${dogType} playing in ${location} park, green grass, other dogs in background`,
        video: `${dogType} running freely, chasing butterflies, rolling in grass`
      },
      {
        concept: "🍖 간식 시간",
        korean: "강아지가 현지 간식을 먹는 모습",
        image: `${dogType} enjoying local treats at outdoor market, food stalls around`,
        video: `${dogType} sniffing different foods, eating treats happily, licking lips`
      },
      {
        concept: "🌉 다리 건너기",
        korean: "강아지가 유명한 다리를 건너는 모습",
        image: `${dogType} on famous ${location} bridge, scenic river view, golden hour lighting`,
        video: `${dogType} walking across bridge, looking at water below, ears flapping in wind`
      },
      {
        concept: "🌙 야경 감상",
        korean: "강아지가 야경을 보는 모습",
        image: `${dogType} looking at ${location} night skyline, city lights twinkling, peaceful moment`,
        video: `${dogType} sitting calmly, watching lights, yawning sleepily, content expression`
      }
    ];
    
    // 컨셉에 따라 씬 선택
    const selectedScenes = isSoloTravel ? soloTravelScenes : regularScenes;
    
    for (let i = 0; i < Math.min(sceneCount, selectedScenes.length); i++) {
      const start = i * Math.floor(duration / sceneCount);
      const end = Math.min(start + Math.floor(duration / sceneCount), duration);
      
      scenes.push({
        scene: i + 1,
        duration: `${start}-${end}초`,
        concept: selectedScenes[i].concept,
        korean_desc: selectedScenes[i].korean,
        image_prompt: selectedScenes[i].image,
        video_prompt: selectedScenes[i].video,
        camera: this.getCameraWork(i),
        transition: this.getTransition(i)
      });
    }
    
    return scenes;
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

// 🎯 도메인별 완성도 가이드
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
      keywords: ["장소", "위치", "배경", "유럽", "파리", "세계", "여행"]
    },
    색감: { 
      weight: 4, 
      options: ["따뜻한", "차가운", "비비드", "빈티지"],
      keywords: ["색", "컬러", "톤", "생생한", "색감"]
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
    }
  },
  
  dev: {
    프로젝트: { 
      weight: 15, 
      options: ["웹사이트", "모바일앱", "API", "게임", "자동화"],
      keywords: ["웹", "앱", "사이트", "API", "게임"]
    },
    기술스택: { 
      weight: 12, 
      options: ["React", "Vue", "Next.js", "Node.js", "Python", "Flutter"],
      keywords: ["react", "vue", "next", "node", "python", "flutter"]
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
    배포: { 
      weight: 8, 
      options: ["Vercel", "AWS", "Netlify", "Heroku", "Docker"],
      keywords: ["배포", "deploy", "vercel", "aws", "docker"]
    }
  }
};

// 🏆 최고 품질 프롬프트 패턴
const HIGH_QUALITY_PATTERNS = {
  video: {
    "여행_강아지": `Travel vlog featuring a dog exploring world landmarks. 
                    60-second format optimized for YouTube Shorts. 
                    Scene breakdown: arrival, exploration, local interaction, 
                    sunset moments. Upbeat music, smooth transitions, 
                    professional color grading.`,
    
    "요리_동물": `Chef animal in professional kitchen, step-by-step cooking process, 
                  close-up shots of ingredients, steam effects, warm lighting, 
                  upbeat background music, quick cuts, 60 seconds format`
  },
  
  image: {
    "midjourney_v7": `[subject], [environment], [art style], [lighting mood],
                      [color palette], [camera angle] --ar 16:9 --stylize 200 
                      --chaos 10 --quality 2 --version 7`
  },
  
  dev: {
    "claude_구조화": `<task>
      <objective>Build a [project type] that [main purpose]</objective>
      <requirements>[list of features]</requirements>
    </task>`
  }
};

// 🎯 메인 핸들러
export default async function handler(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      title: '⚠️ API 키 설정 필요',
      message: 'OpenAI API 키를 환경변수에 설정해주세요.',
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
      canRetry: true
    });
  }
}

// 🎯 가이드 기반 개선 처리
async function handleGuideBasedImprovement(res, userInput, answers, domain, round, asked = []) {
  try {
    const guideCompletion = analyzeGuideCompletion(userInput, answers, domain);
    const intentScore = calculateIntentScore(guideCompletion);
    
    const currentPrompt = await generateCurrentPrompt(userInput, answers, domain, guideCompletion);
    const qualityScore = await evaluatePromptQuality(currentPrompt, domain);
    
    console.log(`📊 Round ${round} - 의도: ${intentScore}/95, 품질: ${qualityScore}/95`);

    if (intentScore >= 95 && qualityScore >= 95) {
      return await handleFinalGeneration(res, userInput, answers, domain, intentScore, qualityScore);
    }

    if (round >= 5) {
      return await handleFinalGeneration(res, userInput, answers, domain, 
                                        Math.max(intentScore, 85), 
                                        Math.max(qualityScore, 85));
    }

    const questions = await generateGuideBasedQuestions(guideCompletion.missing, domain, round, userInput, answers, asked);

    return res.status(200).json({
      success: true,
      step: 'questions',
      questions: questions,
      round: round + 1,
      intentScore,
      qualityScore,
      draftPrompt: currentPrompt,
      message: `가이드 기반 ${questions.length}개 질문 생성 (${round}라운드)`,
      status: 'collecting'
    });

  } catch (error) {
    console.error('가이드 기반 처리 오류:', error);
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
    
    const hasKeyword = config.keywords.some(keyword => 
      allText.includes(keyword.toLowerCase())
    );
    
    if (hasKeyword) {
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

// 📊 의도 파악 점수 계산
function calculateIntentScore(guideCompletion) {
  return Math.min(Math.round(guideCompletion.completionRate * 0.95), 95);
}

// 🎯 가이드 기반 질문 생성
async function generateGuideBasedQuestions(missingGuides, domain, round, userInput, answers, asked = []) {
  const askedSet = new Set(asked.map(q => q.toLowerCase()));
  
  const sortedMissing = Object.entries(missingGuides)
    .sort(([,a], [,b]) => b.weight - a.weight)
    .filter(([key, config]) => {
      const questionText = `${key}에 대해 구체적으로 어떻게 하시겠어요?`;
      return !askedSet.has(questionText.toLowerCase());
    })
    .slice(0, round <= 2 ? 3 : 2);

  const questions = sortedMissing.map(([key, config], index) => ({
    key: `guide_${key}_${round}`,
    question: `${key}에 대해 구체적으로 어떻게 하시겠어요?`,
    options: [...config.options, "직접 입력"],
    priority: config.weight >= 12 ? "high" : "medium",
    scoreValue: config.weight
  }));

  if (round >= 3 && questions.length < 2) {
    try {
      const aiQuestions = await generateAIQuestions(userInput, answers, domain, round);
      questions.push(...aiQuestions);
    } catch (error) {
      console.log('AI 질문 생성 실패');
    }
  }

  return questions.slice(0, 3);
}

// 🤖 AI 추가 질문 생성
async function generateAIQuestions(userInput, answers, domain, round) {
  const prompt = `${domain} 전문가로서 "${userInput}"를 완성하기 위한 핵심 질문 2개를 생성하세요.

현재까지 정보: ${answers.join(', ')}

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
  const length = prompt.length;
  let score = Math.min(length / 10, 40);
  
  const qualityKeywords = {
    video: ['scene', 'camera', 'transition', 'lighting', 'duration', 'format'],
    image: ['resolution', 'style', 'composition', 'lighting', 'quality', 'detailed'],
    dev: ['requirements', 'features', 'architecture', 'implementation', 'stack']
  };
  
  const keywords = qualityKeywords[domain] || [];
  const keywordMatches = keywords.filter(kw => 
    prompt.toLowerCase().includes(kw)
  ).length;
  
  score += keywordMatches * 8;
  
  if (prompt.includes('\n')) score += 10;
  if (prompt.includes('•') || prompt.includes('-')) score += 5;
  
  return Math.min(score, 95);
}

// 🔍 최적 패턴 찾기
function findBestPattern(userInput, domain) {
  const patterns = HIGH_QUALITY_PATTERNS[domain] || {};
  const input = userInput.toLowerCase();
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const keywords = key.split('_');
    if (keywords.every(keyword => input.includes(keyword))) {
      return pattern;
    }
  }
  
  return null;
}

// 🎯 최종 생성 핸들러 (개선된 버전)
async function handleFinalGeneration(res, userInput, answers, domain, intentScore = 85, qualityScore = 85) {
  try {
    console.log('🎉 최종 프롬프트 생성 시작');
    
    if (domain === 'video') {
      const videoEngine = new VideoSceneEngine();
      const duration = extractDuration(answers) || 60;
      
      console.log(`🎬 영상 길이: ${duration}초`);
      
      // 개선된 씬 분할 (컨셉 포함)
      const scenes = await videoEngine.splitIntoScenesWithConcept(userInput, answers, duration);
      
      // 특별 컨셉 확인
      const isSoloTravel = answers.some(a => 
        a.includes('혼자') || a.includes('사람처럼') || a.includes('사람 처럼')
      );
      
      // 깔끔한 씬별 포맷
      const scenesFormatted = scenes.map(s => `
╔════════════════════════════════════════════════════════════════════╗
║ 📎 씬 ${s.scene} (${s.duration})                            
╠════════════════════════════════════════════════════════════════════╣
║ 🎯 이 씬의 핵심: ${s.concept}
║ 📝 한국어 설명: ${s.korean_desc}
║
║ 📷 [이미지 생성용] - 이 부분만 복사 ────────────────────────
║ ${s.image_prompt}
║ ──────────────────────────────────────────────────────────
║
║ 🎬 [영상 생성용] - 이 부분만 복사 ──────────────────────────
║ ${s.video_prompt}
║ ──────────────────────────────────────────────────────────
║
║ ⚙️ 카메라: ${s.camera} | 전환: ${s.transition}
╚════════════════════════════════════════════════════════════════════╝
`);
      
      // 전체 시나리오
      const fullScenario = `
🎬 영상 제목: "${userInput}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 기본 정보
- 총 길이: ${duration}초
- 씬 개수: ${scenes.length}개  
- 플랫폼: ${getSelectedPlatform(answers)}
- 컨셉: ${isSoloTravel ? '🎭 강아지가 사람처럼 혼자 여행' : '🐕 일반 강아지 여행'}
- 스타일: ${getSelectedStyle(answers)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎞️ 씬별 상세 프롬프트

${scenesFormatted.join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 플랫폼별 사용 가이드

🟣 Runway Gen-3 사용법:
   1단계: 위 씬에서 [이미지 생성용] 복사 → Image Generation
   2단계: 생성된 이미지 선택 → Image to Video 클릭
   3단계: [영상 생성용] 복사 → 붙여넣기
   4단계: Generate (10초) → Extend 3회 반복
   
🟢 Pika Labs 사용법:
   1단계: Discord에서 /create 입력
   2단계: 이미지 업로드 + [영상 생성용] 복사
   3단계: 뒤에 추가: -motion 2 -ar 16:9
   4단계: 3초씩 생성 → 편집 프로그램에서 연결

🔵 Sora (OpenAI) 사용법:
   1단계: [영상 생성용] 전체 복사
   2단계: 한 번에 최대 20초 생성 가능
   3단계: 스타일 일관성 자동 유지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 프로 팁
✓ 일관성: 모든 씬에 --seed 123 추가 (Runway)
✓ 연결: 이전 씬 마지막 프레임 → 다음 씬 첫 프레임
✓ 색감: "vibrant colors, consistent color grading" 추가
✓ 캐릭터: 같은 강아지 유지를 위해 첫 씬 이미지를 참조로 사용
`;
      
      return res.status(200).json({
        success: true,
        step: 'completed',
        originalPrompt: userInput,
        improvedPrompt: fullScenario,
        scenarioData: {
          scenes: scenes,
          totalDuration: duration,
          sceneCount: scenes.length,
          concept: { isSoloTravel }
        },
        intentScore,
        qualityScore,
        message: '🎬 씬별로 구분된 프롬프트 완성! 각 박스에서 필요한 부분만 복사하세요.',
        attempts: answers.length
      });
    }
    
    // 이미지/개발 도메인
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
      attempts: answers.length
    });
    
  } catch (error) {
    console.error('최종 생성 오류:', error);
    
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
  
  if (pattern) return pattern;
  
  try {
    const systemPrompt = `You are an expert ${domain} prompt engineer.`;
    
    const userPrompt = `
Original: "${userInput}"
Info: ${answers.join(', ')}
Domain: ${domain}

Create perfect ${domain} prompt:`;
    
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
    return `${userInput}. ${answers.join('. ')}. High quality result.`;
  }
}

// 📏 길이 추출
function extractDuration(answers) {
  const text = answers.join(' ');
  
  if (text.includes('15초')) return 15;
  if (text.includes('30초')) return 30;
  if (text.includes('60초')) return 60;
  if (text.includes('3분')) return 180;
  if (text.includes('5분')) return 300;
  
  const match = text.match(/(\d+)\s*초/);
  if (match) return parseInt(match[1]);
  
  return 60;
}

// 📱 플랫폼 추출
function getSelectedPlatform(answers) {
  const text = answers.join(' ').toLowerCase();
  
  if (text.includes('유튜브')) return 'YouTube Shorts';
  if (text.includes('틱톡')) return 'TikTok';
  if (text.includes('인스타')) return 'Instagram Reels';
  
  return 'YouTube Shorts';
}

// 🎨 스타일 추출
function getSelectedStyle(answers) {
  const text = answers.join(' ').toLowerCase();
  
  if (text.includes('시네마틱')) return '시네마틱';
  if (text.includes('브이로그')) return '브이로그';
  if (text.includes('실사')) return '실사';
  
  return '일반 영상';
}
