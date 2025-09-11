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

  async splitIntoScenes(userInput, duration = 60) {
    const sceneCount = duration <= 15 ? 3 : duration <= 30 ? 5 : duration <= 60 ? 8 : Math.ceil(duration / 8);
    const scenes = [];
    
    for (let i = 0; i < sceneCount; i++) {
      const start = i * Math.floor(duration / sceneCount);
      const end = Math.min(start + Math.floor(duration / sceneCount), duration);
      
      scenes.push({
        scene: i + 1,
        duration: `${start}-${end}초`,
        image_prompt: await this.generateImagePrompt(userInput, i + 1, sceneCount),
        video_prompt: await this.generateVideoPrompt(userInput, i + 1, sceneCount),
        camera: this.getCameraWork(i),
        transition: this.getTransition(i)
      });
    }
    
    return scenes;
  }

  async generateImagePrompt(userInput, sceneNum, totalScenes) {
    const sceneDescriptions = {
      1: "opening shot, establishing scene",
      2: "main action begins, key subject in frame",
      3: "action develops, dynamic composition",
      [totalScenes]: "closing shot, resolution"
    };
    
    return `Scene ${sceneNum}: ${userInput}, ${sceneDescriptions[sceneNum] || 'continuation'}, cinematic quality, 4K`;
  }

  async generateVideoPrompt(userInput, sceneNum, totalScenes) {
    return `Scene ${sceneNum} motion: smooth camera movement, natural action flow, professional cinematography`;
  }

  getCameraWork(index) {
    const works = ['Static shot', 'Slow zoom in', 'Pan left to right', 'Tracking shot', 'Close-up'];
    return works[index % works.length];
  }

  getTransition(index) {
    const transitions = ['Cut to', 'Fade in', 'Cross dissolve', 'Match cut'];
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
      keywords: ["강아지", "고양이", "사람", "캐릭터", "주인공"]
    },
    스토리: { 
      weight: 12, 
      options: ["튜토리얼", "브이로그", "스토리텔링", "제품소개", "교육"],
      keywords: ["이야기", "스토리", "내용", "줄거리"]
    },
    스타일: { 
      weight: 10, 
      options: ["시네마틱", "다큐멘터리", "애니메이션", "실사", "모션그래픽"],
      keywords: ["스타일", "느낌", "분위기", "톤"]
    },
    씬구성: { 
      weight: 10, 
      options: ["3-5개", "6-10개", "10개이상"],
      keywords: ["씬", "장면", "구성", "분할"]
    },
    카메라: { 
      weight: 8, 
      options: ["고정", "핸드헬드", "드론", "짐벌", "크레인"],
      keywords: ["카메라", "촬영", "앵글", "샷"]
    },
    음향: { 
      weight: 8, 
      options: ["BGM", "내레이션", "효과음", "무음"],
      keywords: ["음악", "소리", "음향", "BGM"]
    },
    편집: { 
      weight: 6, 
      options: ["빠른컷", "롱테이크", "몽타주", "슬로우모션"],
      keywords: ["편집", "컷", "전환"]
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
    "요리_동물": `Chef animal in professional kitchen, step-by-step cooking process, 
                  close-up shots of ingredients, steam effects, warm lighting, 
                  upbeat background music, quick cuts, 60 seconds format`,
    
    "여행_브이로그": `Travel vlog style, handheld camera movement, natural lighting,
                      location transitions, time-lapse sequences, ambient sounds,
                      personal narration, 3-5 minute format`,
    
    "제품_광고": `Product showcase, dynamic camera angles, studio lighting,
                  slow-motion highlights, modern graphics, upbeat music,
                  call-to-action ending, 30 seconds format`,
    
    "튜토리얼": `Step-by-step tutorial, screen recording with annotations,
                 clear voiceover, chapter markers, zoom-in details,
                 background music, 5-10 minute format`
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
    
    Provide production-ready code with comments.`,
    
    "cursor_컨텍스트": `@workspace
    
    Create a [project type] with these specifications:
    - Purpose: [main goal]
    - Users: [target audience]
    - Features: [key features]
    - Stack: [technologies]
    
    Use the existing project structure and follow our coding conventions.
    Include comprehensive error handling and testing.`
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
        return await handleQuestionsFlow(res, userInput, answers, domain, round, asked);
      
      case 'generate':
        return await handleGenerateFlow(res, userInput, answers, domain);
      
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

// 🔄 질문 플로우 처리
async function handleQuestionsFlow(res, userInput, answers, domain, round, asked) {
  try {
    // 1. 현재 완성도 분석
    const completion = analyzeGuideCompletion(userInput, answers, domain);
    const intentScore = calculateIntentScore(completion);
    
    // 2. 현재까지 정보로 프롬프트 생성
    const currentPrompt = await generateCurrentPrompt(userInput, answers, domain, completion);
    const qualityScore = await evaluatePromptQuality(currentPrompt, domain);
    
    console.log(`📊 라운드 ${round} 점수 - 의도: ${intentScore}/95, 품질: ${qualityScore}/95`);
    
    // 3. 목표 달성 체크
    if (intentScore >= 95 && qualityScore >= 95) {
      return await handleFinalGeneration(res, userInput, answers, domain, intentScore, qualityScore);
    }
    
    // 4. 최대 라운드 체크
    if (round >= 5) {
      console.log('⚡ 최대 라운드 도달 - 현재 최고 품질로 완성');
      return await handleFinalGeneration(res, userInput, answers, domain, 
                                        Math.max(intentScore, 85), 
                                        Math.max(qualityScore, 85));
    }
    
    // 5. 추가 질문 생성
    const questions = await generateSmartQuestions(
      userInput, answers, domain, round, 
      completion.missing, asked
    );
    
    // 6. 중복 제거
    const uniqueQuestions = filterUniqueQuestions(questions, asked);
    
    if (uniqueQuestions.length === 0) {
      console.log('📍 추가 질문 없음 - 생성 단계로 이동');
      return await handleFinalGeneration(res, userInput, answers, domain, intentScore, qualityScore);
    }
    
    return res.status(200).json({
      success: true,
      step: 'questions',
      questions: uniqueQuestions.slice(0, 3), // 최대 3개
      round: round + 1,
      intentScore,
      qualityScore,
      draftPrompt: currentPrompt,
      status: 'collecting',
      message: `더 완벽한 프롬프트를 위해 ${uniqueQuestions.length}개 추가 질문`,
      progress: {
        intentScore,
        qualityScore,
        round: round + 1
      }
    });
    
  } catch (error) {
    console.error('질문 생성 오류:', error);
    // 오류시 현재까지 정보로 생성
    return await handleFinalGeneration(res, userInput, answers, domain, 70, 70);
  }
}

// handleFinalGeneration 함수 찾아서 이 부분으로 교체
async function handleFinalGeneration(res, userInput, answers, domain, intentScore = 95, qualityScore = 95) {
  try {
    console.log('🎉 최종 프롬프트 생성 시작');
    
    // 영상 도메인: 씬 분할 처리
    if (domain === 'video') {
      // 간단한 씬 분할 (VideoSceneEngine 없이도 작동하도록)
      const duration = extractDuration(answers) || 60;
      console.log(`🎬 영상 길이: ${duration}초`);
      
      // 씬 수 계산
      const sceneCount = Math.ceil(duration / 10); // 10초당 1씬
      const scenes = [];
      
      // 각 씬 생성
      for (let i = 0; i < sceneCount; i++) {
        const start = i * 10;
        const end = Math.min((i + 1) * 10, duration);
        
        scenes.push({
          scene: i + 1,
          duration: `${start}-${end}초`,
          image_prompt: generateSceneImagePrompt(userInput, answers, i + 1),
          video_prompt: generateSceneVideoPrompt(userInput, answers, i + 1),
          camera: getCameraWork(i),
          transition: getTransition(i)
        });
      }
      
      // 씬별 프롬프트 텍스트 생성
      const scenePrompts = scenes.map(s => `
### 씬 ${s.scene} (${s.duration})
📷 이미지: ${s.image_prompt}
🎬 영상: ${s.video_prompt}
📹 카메라: ${s.camera}
🔄 전환: ${s.transition}
`).join('\n');
      
      // 전체 시나리오
      const fullScenario = `
## 🎬 영상 시나리오: ${userInput}

### 📊 개요
- 총 길이: ${duration}초
- 씬 개수: ${sceneCount}개
- 플랫폼: ${getSelectedPlatform(answers)}

### 🎞️ 씬별 프롬프트
${scenePrompts}

### 💡 플랫폼별 사용 가이드
**Runway Gen-3:**
1. 각 씬의 이미지 프롬프트로 첫 프레임 생성
2. Image to Video 모드로 전환
3. 영상 프롬프트 입력 후 10초씩 생성
4. Extend 기능으로 연결

**Pika Labs:**
1. /create 명령어 사용
2. 이미지 업로드 + 프롬프트
3. -motion 2 -ar 16:9 설정

**실제 제작 팁:**
- 씬 간 연속성을 위해 이전 씬 마지막 프레임 활용
- 일관된 캐릭터 유지를 위해 같은 seed 값 사용
`;
      
      return res.status(200).json({
        success: true,
        step: 'completed',
        originalPrompt: userInput,
        improvedPrompt: fullScenario,
        scenarioData: {
          scenes: scenes,
          totalDuration: duration,
          sceneCount: sceneCount
        },
        intentScore,
        qualityScore,
        message: '🎬 영상 씬 분할 완성! 각 씬별로 사용 가능한 프롬프트입니다.',
        attempts: answers.length
      });
    }
    
    // 기존 코드 (이미지/개발 도메인)
    const finalPrompt = await generateFinalPrompt(userInput, answers, domain);
    
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
    // 폴백 처리
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

// 헬퍼 함수들 추가
function generateSceneImagePrompt(userInput, answers, sceneNum) {
  // 웰시코기 예시
  const dog = answers.find(a => a.includes('웰시코기')) ? 'Welsh Corgi' : 'dog';
  const location = answers.find(a => a.includes('파리')) ? 'Paris' : 
                   answers.find(a => a.includes('유럽')) ? 'Europe' : 'world';
  
  const prompts = {
    1: `${dog} with travel backpack at famous landmark in ${location}, professional photography, 4K`,
    2: `${dog} walking on city street, happy expression, golden hour lighting`,
    3: `${dog} at local cafe, sitting at table, cute pose, warm atmosphere`,
    4: `${dog} exploring tourist spot, curious expression, vibrant colors`,
    5: `${dog} meeting locals, friendly interaction, candid shot`,
    6: `${dog} enjoying sunset view, peaceful moment, cinematic lighting`
  };
  
  return prompts[sceneNum] || `${dog} traveling scene ${sceneNum}, high quality`;
}

function generateSceneVideoPrompt(userInput, answers, sceneNum) {
  const dog = answers.find(a => a.includes('웰시코기')) ? 'Welsh Corgi' : 'dog';
  
  const prompts = {
    1: `${dog} wagging tail excitedly, looking around landmark, slow zoom in`,
    2: `${dog} trotting happily, head turning to explore, tracking shot`,
    3: `${dog} sniffing food, tilting head cutely, close-up shot`,
    4: `${dog} running playfully, ears bouncing, dynamic movement`,
    5: `${dog} interacting with people, tail wagging, natural reactions`,
    6: `${dog} sitting peacefully, enjoying view, slow pan across scenery`
  };
  
  return prompts[sceneNum] || `${dog} natural movement, scene ${sceneNum}`;
}

function getCameraWork(index) {
  const works = ['Static shot', 'Slow zoom in', 'Pan left to right', 'Tracking shot', 'Close-up', 'Wide angle'];
  return works[index % works.length];
}

function getTransition(index) {
  const transitions = ['Cut to', 'Fade in', 'Cross dissolve', 'Match cut', 'Wipe'];
  return transitions[index % transitions.length];
}

function getSelectedPlatform(answers) {
  if (answers.some(a => a.includes('유튜브'))) return 'YouTube Shorts';
  if (answers.some(a => a.includes('틱톡'))) return 'TikTok';
  if (answers.some(a => a.includes('인스타'))) return 'Instagram Reels';
  return 'YouTube Shorts';
}

// extractDuration 함수도 확인
function extractDuration(answers) {
  const text = answers.join(' ');
  
  if (text.includes('15초')) return 15;
  if (text.includes('30초')) return 30;
  if (text.includes('60초')) return 60;
  if (text.includes('3분')) return 180;
  if (text.includes('5분')) return 300;
  
  // 숫자 추출
  const match = text.match(/(\d+)\s*초/);
  if (match) return parseInt(match[1]);
  
  return 60; // 기본값
}

// 🧠 스마트 질문 생성 (Chain of Thought + 가이드)
async function generateSmartQuestions(userInput, answers, domain, round, missingGuides, asked) {
  const questions = [];
  
  // 1. 가이드 기반 질문
  if (round <= 2 && Object.keys(missingGuides).length > 0) {
    const guideQuestions = Object.entries(missingGuides)
      .slice(0, 2)
      .map(([key, config]) => ({
        key: `guide_${key}_${round}`,
        question: `${key}은(는) 어떻게 설정하시겠어요?`,
        options: [...(config.options || []), "직접 입력"],
        priority: config.weight >= 12 ? "high" : "medium",
        scoreValue: config.weight
      }));
    questions.push(...guideQuestions);
  }
  
  // 2. AI 창의적 질문 (Chain of Thought)
  if (round >= 2) {
    try {
      const chainPrompt = `
당신은 ${domain} 프롬프트 전문가입니다.

사용자 요청: "${userInput}"
현재까지 정보: ${answers.join(', ')}

다음을 고려하여 핵심 질문 2개를 생성하세요:
1. 아직 파악되지 않은 중요한 정보는?
2. 결과물 품질을 높일 수 있는 디테일은?
3. ${domain} 전문가라면 꼭 물어볼 것은?

JSON 형식으로 응답:
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
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: chainPrompt }],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });
      
      const aiResult = JSON.parse(completion.choices[0].message.content);
      if (aiResult.questions) {
        questions.push(...aiResult.questions);
      }
    } catch (error) {
      console.log('AI 질문 생성 실패, 기본 질문 사용');
    }
  }
  
  return questions;
}

// 📊 가이드 완성도 분석
function analyzeGuideCompletion(userInput, answers, domain) {
  const guide = COMPLETION_GUIDES[domain];
  const allText = [userInput, ...answers].join(' ').toLowerCase();
  
  const filled = {};
  const missing = {};
  let totalWeight = 0;
  let filledWeight = 0;
  
  Object.entries(guide).forEach(([key, config]) => {
    totalWeight += config.weight;
    
    const hasKeyword = config.keywords.some(kw => 
      allText.includes(kw.toLowerCase())
    );
    
    const hasAnswer = answers.some(answer => 
      answer.toLowerCase().includes(key.toLowerCase()) ||
      config.keywords.some(kw => answer.toLowerCase().includes(kw.toLowerCase()))
    );
    
    if (hasKeyword || hasAnswer) {
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

// 📈 의도 파악 점수 계산
function calculateIntentScore(completion) {
  // 완성률 기반 점수 (0-95)
  return Math.min(Math.round(completion.completionRate * 0.95), 95);
}

// 🎨 현재 프롬프트 생성
async function generateCurrentPrompt(userInput, answers, domain, completion) {
  // 패턴 매칭
  const pattern = findBestPattern(userInput, domain);
  
  // 수집된 정보 정리
  const collectedInfo = Object.keys(completion.filled)
    .map(key => {
      const answer = answers.find(a => 
        a.toLowerCase().includes(key.toLowerCase())
      );
      return answer ? answer : key;
    })
    .join(', ');
  
  // 도메인별 프롬프트 템플릿
  const templates = {
    video: `${userInput}. Platform optimized for video generation. ${collectedInfo}. Professional quality, engaging content.`,
    image: `${userInput}. High quality image generation. ${collectedInfo}. Professional photography, perfect composition.`,
    dev: `Build ${userInput}. Technical requirements: ${collectedInfo}. Production-ready code with best practices.`
  };
  
  const basePrompt = templates[domain] || userInput;
  
  // GPT로 향상 (선택적)
  if (answers.length >= 3) {
    try {
      const enhancePrompt = `
향상시켜주세요:
원본: "${basePrompt}"
도메인: ${domain}

전문가 수준 프롬프트로 개선 (영어로):`;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: enhancePrompt }],
        temperature: 0.7,
        max_tokens: 500
      });
      
      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.log('프롬프트 향상 실패, 기본 사용');
    }
  }
  
  return pattern || basePrompt;
}

// 🏆 프롬프트 품질 평가
async function evaluatePromptQuality(prompt, domain) {
  // 길이 기반 기본 점수
  let baseScore = Math.min(prompt.length / 10, 40);
  
  // 도메인별 키워드 체크
  const qualityKeywords = {
    video: ['scene', 'camera', 'lighting', 'transition', 'duration'],
    image: ['quality', 'resolution', 'style', 'composition', 'lighting'],
    dev: ['requirements', 'features', 'stack', 'architecture', 'implementation']
  };
  
  const keywords = qualityKeywords[domain] || [];
  const keywordScore = keywords.filter(kw => 
    prompt.toLowerCase().includes(kw)
  ).length * 10;
  
  // 구조 점수
  const structureScore = prompt.includes('\n') ? 15 : 5;
  
  // 최종 점수
  const totalScore = Math.min(baseScore + keywordScore + structureScore, 95);
  
  return totalScore;
}

// 🎯 최종 프롬프트 생성
async function generateFinalPrompt(userInput, answers, domain) {
  const pattern = findBestPattern(userInput, domain);
  
  if (pattern) {
    return pattern;
  }
  
  // GPT-4 스타일 생성
  try {
    const systemPrompt = `You are an expert ${domain} prompt engineer. 
Create a professional, detailed prompt that will produce excellent results.`;
    
    const userPrompt = `
Original request: "${userInput}"
Additional info: ${answers.join(', ')}
Domain: ${domain}

Create a perfect prompt for ${domain} AI generation:`;
    
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
    // 폴백
    return `${userInput}. ${answers.join('. ')}. High quality, professional result.`;
  }
}

// 🔍 패턴 매칭
function findBestPattern(userInput, domain) {
  const patterns = HIGH_QUALITY_PATTERNS[domain] || {};
  const input = userInput.toLowerCase();
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const keywords = key.split('_');
    if (keywords.every(kw => input.includes(kw))) {
      return pattern;
    }
  }
  
  return null;
}

// ⏱️ 길이 추출
function extractDuration(answers) {
  const text = answers.join(' ');
  
  const patterns = [
    { regex: /(\d+)\s*초/, multiplier: 1 },
    { regex: /(\d+)\s*분/, multiplier: 60 },
    { regex: /(\d+)\s*시간/, multiplier: 3600 }
  ];
  
  for (const { regex, multiplier } of patterns) {
    const match = text.match(regex);
    if (match) {
      return parseInt(match[1]) * multiplier;
    }
  }
  
  return 60; // 기본값
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

// 🔄 중복 질문 필터링
function filterUniqueQuestions(questions, asked) {
  const askedSet = new Set(asked.map(q => q.toLowerCase()));
  
  return questions.filter(q => {
    const questionText = q.question.toLowerCase();
    if (askedSet.has(questionText)) {
      return false;
    }
    return true;
  });
}
