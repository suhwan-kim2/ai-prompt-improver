// utils/videoSceneEngine.js - 영상 씬 분할 전문 엔진

export class VideoSceneEngine {
  constructor() {
    // 플랫폼별 제한사항
    this.PLATFORM_LIMITS = {
      runway: { maxDuration: 10, extension: 3, format: 'image+text' },
      pika: { fixedDuration: 3, motionRange: '0-4', format: 'image+text' },
      sora: { maxDuration: 20, resolution: '1920x1080', format: 'text' },
      stable_video: { maxFrames: 25, fps: 6, format: 'image_only' }
    };
  }

  /**
   * 사용자 입력을 씬으로 자동 분할
   * @param {string} userInput - "고양이가 스프를 만드는 쇼츠"
   * @param {number} targetDuration - 목표 길이 (초)
   * @returns {Array} 씬 배열
   */
  async splitIntoScenes(userInput, targetDuration = 60) {
    // 1. 최적 씬 개수 계산
    const sceneCount = this.calculateOptimalScenes(targetDuration);
    
    // 2. 스토리 구조 분석
    const storyStructure = this.analyzeStoryStructure(userInput);
    
    // 3. 씬 생성
    const scenes = this.generateSceneBreakdown(storyStructure, sceneCount);
    
    // 4. 각 씬별 상세 프롬프트 생성
    return scenes.map((scene, index) => this.createDetailedScene(scene, index));
  }

  /**
   * 최적 씬 개수 계산
   */
  calculateOptimalScenes(duration) {
    if (duration <= 15) return 3;  // 쇼츠: 3개
    if (duration <= 30) return 5;  // 릴스: 5개
    if (duration <= 60) return 8;  // 1분: 8개
    return Math.ceil(duration / 8); // 8초당 1씬
  }

  /**
   * 스토리 구조 분석
   */
  analyzeStoryStructure(userInput) {
    // 고양이 셰프 예시 기반 구조
    const structures = {
      요리: {
        acts: ['등장', '재료준비', '조리과정', '완성', '마무리'],
        mood: 'cheerful',
        pace: 'dynamic'
      },
      여행: {
        acts: ['출발', '이동', '도착', '탐험', '귀환'],
        mood: 'adventurous',
        pace: 'flowing'
      },
      튜토리얼: {
        acts: ['문제제시', '해결방법', '단계별설명', '결과', '정리'],
        mood: 'educational',
        pace: 'steady'
      }
    };

    // 키워드 기반 구조 선택
    if (userInput.includes('요리') || userInput.includes('만드')) {
      return structures.요리;
    } else if (userInput.includes('여행') || userInput.includes('탐험')) {
      return structures.여행;
    } else {
      return structures.튜토리얼;
    }
  }

  /**
   * 씬 분해 생성
   */
  generateSceneBreakdown(structure, sceneCount) {
    const scenes = [];
    const actsPerScene = Math.ceil(structure.acts.length / sceneCount);
    
    for (let i = 0; i < sceneCount; i++) {
      const actIndex = Math.min(i * actsPerScene, structure.acts.length - 1);
      scenes.push({
        act: structure.acts[actIndex],
        mood: structure.mood,
        pace: structure.pace,
        duration: this.calculateSceneDuration(i, sceneCount)
      });
    }
    
    return scenes;
  }

  /**
   * 씬 길이 계산
   */
  calculateSceneDuration(index, total) {
    // 첫 씬과 마지막 씬은 짧게
    if (index === 0 || index === total - 1) {
      return { start: index * 5, end: index * 5 + 3 };
    }
    // 중간 씬들은 길게
    return { start: index * 5, end: index * 5 + 5 };
  }

  /**
   * 상세 씬 생성 (고양이 셰프 예시 스타일)
   */
  createDetailedScene(scene, index) {
    const sceneNumber = index + 1;
    
    // 카메라 워크 옵션
    const cameraWorks = [
      'Static shot',
      'Slow zoom in',
      'Pan left to right',
      'Tracking shot',
      'Close-up',
      'Wide angle'
    ];
    
    // 전환 효과
    const transitions = [
      'Cut to',
      'Fade in',
      'Cross dissolve',
      'Wipe transition',
      'Match cut'
    ];

    return {
      scene: sceneNumber,
      duration: `${scene.duration.start}-${scene.duration.end}초`,
      act: scene.act,
      
      // 이미지 프롬프트 (첫 프레임)
      image_prompt: this.generateImagePrompt(scene, sceneNumber),
      
      // 비디오 프롬프트 (동작)
      video_prompt: this.generateVideoPrompt(scene, sceneNumber),
      
      // 기술적 설정
      camera: cameraWorks[index % cameraWorks.length],
      transition: transitions[index % transitions.length],
      
      // 플랫폼별 가이드
      platform_guide: this.generatePlatformGuide(scene)
    };
  }

  /**
   * 이미지 프롬프트 생성 (첫 프레임용)
   */
  generateImagePrompt(scene, sceneNumber) {
    const templates = {
      등장: "A cheerful chef cat wearing white chef hat and apron, standing confidently in modern kitchen, professional lighting, 4K quality",
      재료준비: "Close-up of cat paws organizing fresh vegetables on cutting board, warm kitchen lighting, shallow depth of field",
      조리과정: "Side view of cat stirring large pot on stove, steam rising, golden hour lighting through window",
      완성: "Top-down view of completed soup in elegant bowl, cat paw placing garnish, studio lighting",
      마무리: "Happy chef cat tasting soup with satisfied expression, warm smile, cozy kitchen atmosphere"
    };
    
    return templates[scene.act] || `Scene ${sceneNumber}: ${scene.act} moment, cinematic quality`;
  }

  /**
   * 비디오 프롬프트 생성 (동작용)
   */
  generateVideoPrompt(scene, sceneNumber) {
    const templates = {
      등장: "The cat slowly nods with confidence, adjusts chef hat, camera slowly zooms in on proud expression",
      재료준비: "Cat's paws skillfully chop vegetables in rhythm, ingredients fly into pot in smooth motion",
      조리과정: "Cat stirs pot in circular motion, steam swirls upward, ingredients blend together",
      완성: "Camera circles around finished dish, cat adds final garnish with flourish",
      마무리: "Cat takes a sip, eyes light up with joy, gives thumbs up to camera"
    };
    
    return templates[scene.act] || `Scene ${sceneNumber}: ${scene.act} action sequence`;
  }

  /**
   * 플랫폼별 사용 가이드 생성
   */
  generatePlatformGuide(scene) {
    return {
      runway: {
        설정: `--camera ${scene.camera || 'static'} --duration ${scene.duration.end - scene.duration.start}`,
        사용법: "1. Image to Video 선택 → 2. 이미지 업로드 → 3. 프롬프트 입력 → 4. Generate"
      },
      pika: {
        설정: `-motion 2 -ar 16:9 -fps 24`,
        사용법: "1. /create 명령 → 2. 이미지 첨부 → 3. 프롬프트 + 설정 입력"
      },
      sora: {
        설정: `--duration ${scene.duration.end - scene.duration.start}s --style cinematic`,
        사용법: "1. 텍스트만 입력 → 2. Generate Video → 3. 품질 선택"
      }
    };
  }

  /**
   * 전체 씬 시나리오 생성 (최종 출력)
   */
  generateFullScenario(scenes, userInput) {
    return {
      title: userInput,
      total_duration: scenes[scenes.length - 1].duration.split('-')[1],
      scene_count: scenes.length,
      scenes: scenes,
      
      // 사용 안내
      instructions: {
        step1: "각 씬의 image_prompt로 첫 프레임 생성",
        step2: "생성된 이미지를 video_prompt와 함께 영상 AI에 입력",
        step3: "플랫폼별 설정값 적용",
        step4: "생성된 클립들을 편집 프로그램에서 연결",
        tip: "씬 간 연속성을 위해 이전 씬 마지막 프레임을 다음 씬 시작에 활용"
      }
    };
  }
}

// 테스트용 함수
export async function testSceneEngine() {
  const engine = new VideoSceneEngine();
  const scenes = await engine.splitIntoScenes("고양이가 스프를 만드는 쇼츠", 60);
  return engine.generateFullScenario(scenes, "고양이가 스프를 만드는 쇼츠");
}
