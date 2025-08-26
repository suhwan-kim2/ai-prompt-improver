// utils/evaluationSystem.js - 프롬프트 품질 평가 시스템

class EvaluationSystem {
  constructor() {
    console.log('📊 프롬프트 품질 평가 시스템 초기화');
  }
  
  // 🎯 메인 평가 함수
  evaluatePromptQuality(prompt, domain = 'visual_design') {
    try {
      console.log(`📊 프롬프트 품질 평가 시작: ${domain} 도메인`);
      
      if (domain === 'visual_design') {
        return this.evaluateImagePrompt(prompt);
      } else if (domain === 'video') {
        return this.evaluateVideoPrompt(prompt);
      } else if (domain === 'development') {
        return this.evaluateDevPrompt(prompt);
      } else {
        return this.evaluateGeneralPrompt(prompt);
      }
      
    } catch (error) {
      console.error('❌ 품질 평가 오류:', error);
      return { total: 75, details: {}, improvements: [] };
    }
  }
  
  // 🎨 이미지 프롬프트 평가 (12개 체크리스트)
  evaluateImagePrompt(prompt) {
    const checks = {
      주체구체화: this.checkSubjectSpecificity(prompt),      // 8점
      감정표정: this.checkEmotionDetails(prompt),           // 8점  
      포즈동작: this.checkPoseDetails(prompt),             // 8점
      배경설정: this.checkBackgroundDetails(prompt),        // 8점
      조명정보: this.checkLightingDetails(prompt),          // 8점
      카메라구도: this.checkCameraDetails(prompt),          // 8점
      예술스타일: this.checkArtStyleDetails(prompt),        // 8점
      색상팔레트: this.checkColorPalette(prompt),           // 8점
      품질지시어: this.checkQualityKeywords(prompt),        // 8점
      참고플랫폼: this.checkReferencePlatforms(prompt),     // 8점
      부정명령어: this.checkNegativePrompts(prompt),       // 8점
      기술스펙: this.checkTechnicalSpecs(prompt)           // 8점
    };
    
    const total = Object.values(checks).reduce((sum, score) => sum + score, 0);
    const improvements = this.generateImprovements(checks);
    
    console.log(`📊 이미지 품질 평가 완료: ${total}점/96점`);
    
    return {
      total: Math.round(total),
      details: checks,
      improvements: improvements,
      maxScore: 96
    };
  }
  
  // 개별 체크 함수들
  checkSubjectSpecificity(prompt) {
    let score = 0;
    const text = prompt.toLowerCase();
    
    // 구체적 품종/종류 (+4점)
    const specificTypes = ['골든리트리버', '포메라니안', '진돗개', '비글', '새끼', '성견'];
    if (specificTypes.some(type => text.includes(type))) score += 4;
    
    // 크기/나이 정보 (+2점)
    if (text.match(/(작은|큰|중간|새끼|성견|어린|나이든)/)) score += 2;
    
    // 특징적 외모 (+2점)
    if (text.match(/(털이|귀가|꼬리가|눈이)/)) score += 2;
    
    return Math.min(score, 8);
  }
  
  checkEmotionDetails(prompt) {
    let score = 0;
    const text = prompt.toLowerCase();
    
    // 구체적 표정 (+3점)
    const expressions = ['미소', '웃고', '호기심', '차분', '온순', '장난'];
    if (expressions.some(exp => text.includes(exp))) score += 3;
    
    // 눈빛/시선 (+3점)
    if (text.match(/(눈빛|시선|바라보는|응시)/)) score += 3;
    
    // 감정 형용사 (+2점)
    if (text.match(/(행복|즐거운|평화로운|활발한)/)) score += 2;
    
    return Math.min(score, 8);
  }
  
  checkPoseDetails(prompt) {
    let score = 0;
    const text = prompt.toLowerCase();
    
    // 구체적 자세 (+4점)
    const poses = ['앉아', '서서', '누워', '뛰어', '걷고', '달리는'];
    if (poses.some(pose => text.includes(pose))) score += 4;
    
    // 신체 부위 동작 (+2점)
    if (text.match(/(앞발|뒷발|꼬리|머리|귀)/)) score += 2;
    
    // 각도/방향 (+2점)
    if (text.match(/(정면|측면|뒤에서|3\/4|프로필)/)) score += 2;
    
    return Math.min(score, 8);
  }
  
  checkBackgroundDetails(prompt) {
    let score = 0;
    const text = prompt.toLowerCase();
    
    // 구체적 배경 (+4점)
    if (text.match(/(우주|성운|별|행성|은하|블랙홀)/)) score += 4;
    
    // 배경 요소 (+2점)
    if (text.match(/(배경|환경|장소|위치)/)) score += 2;
    
    // 분위기 설정 (+2점)
    if (text.match(/(깊은|밝은|어두운|신비로운|환상적)/)) score += 2;
    
    return Math.min(score, 8);
  }
  
  checkLightingDetails(prompt) {
    let score = 0;
    const text = prompt.toLowerCase();
    
    // 조명 키워드 (+4점)
    if (text.match(/(조명|빛|라이팅|lighting)/)) score += 4;
    
    // 구체적 조명 (+2점)
    if (text.match(/(황금|자연|스튜디오|림라이트|측면)/)) score += 2;
    
    // 그림자/하이라이트 (+2점)
    if (text.match(/(그림자|하이라이트|컨트라스트)/)) score += 2;
    
    return Math.min(score, 8);
  }
  
  checkCameraDetails(prompt) {
    let score = 0;
    const text = prompt.toLowerCase();
    
    // 카메라 각도 (+3점)
    if (text.match(/(클로즈업|풀샷|미디엄|하이앵글|로우앵글)/)) score += 3;
    
    // 구도 (+3점)
    if (text.match(/(3분할|중앙|좌우|대각선)/)) score += 3;
    
    // 심도 (+2점)
    if (text.match(/(얕은심도|깊은심도|보케|블러)/)) score += 2;
    
    return Math.min(score, 8);
  }
  
  checkArtStyleDetails(prompt) {
    let score = 0;
    const text = prompt.toLowerCase();
    
    // 예술 스타일 (+4점)
    if (text.match(/(사실적|포토리얼|hyperrealistic|photorealistic)/)) score += 4;
    
    // 예술 참조 (+2점)
    if (text.match(/(지브리|픽사|디즈니|아트스테이션)/)) score += 2;
    
    // 기법 언급 (+2점)
    if (text.match(/(수채화|유화|디지털아트|3d렌더링)/)) score += 2;
    
    return Math.min(score, 8);
  }
  
  checkColorPalette(prompt) {
    let score = 0;
    const text = prompt.toLowerCase();
    
    // 색상 조합 (+3점)
    if (text.match(/(파란|빨간|노란|초록|보라|주황|분홍)/)) score += 3;
    
    // 색감 설명 (+3점)
    if (text.match(/(따뜻한|차가운|비비드|파스텔|모노톤)/)) score += 3;
    
    // 색상 이론 (+2점)
    if (text.match(/(대비|조화|그라데이션|톤앤매너)/)) score += 2;
    
    return Math.min(score, 8);
  }
  
  checkQualityKeywords(prompt) {
    let score = 0;
    const text = prompt.toLowerCase();
    
    // 품질 키워드 (+2점씩)
    const qualityWords = ['detailed', 'professional', 'high quality', '고품질', 'masterpiece'];
    qualityWords.forEach(word => {
      if (text.includes(word)) score += 2;
    });
    
    return Math.min(score, 8);
  }
  
  checkReferencePlatforms(prompt) {
    let score = 0;
    const text = prompt.toLowerCase();
    
    // 플랫폼 참조 (+4점)
    if (text.match(/(artstation|behance|deviantart|pinterest)/)) score += 4;
    
    // 트렌딩 키워드 (+4점)
    if (text.match(/(trending|featured|popular|award)/)) score += 4;
    
    return Math.min(score, 8);
  }
  
  checkNegativePrompts(prompt) {
    let score = 0;
    const text = prompt.toLowerCase();
    
    // 필수 제외 항목 (+2점씩)
    const negatives = ['blurry', 'low quality', 'watermark', 'distorted'];
    negatives.forEach(neg => {
      if (text.includes(`--no ${neg}`) || text.includes(`no ${neg}`)) score += 2;
    });
    
    return Math.min(score, 8);
  }
  
  checkTechnicalSpecs(prompt) {
    let score = 0;
    const text = prompt.toLowerCase();
    
    // 해상도 (+3점)
    if (text.match(/(4k|8k|resolution|해상도)/)) score += 3;
    
    // 비율 (+3점)
    if (text.match(/(16:9|9:16|aspect ratio|1:1)/)) score += 3;
    
    // 기타 스펙 (+2점)
    if (text.match(/(dpi|color space|format)/)) score += 2;
    
    return Math.min(score, 8);
  }
  
  // 개선 제안 생성
  generateImprovements(checks) {
    const improvements = [];
    
    Object.entries(checks).forEach(([category, score]) => {
      if (score < 6) { // 6점 미만이면 개선 필요
        switch (category) {
          case '주체구체화':
            improvements.push('강아지 품종을 구체적으로 명시 (예: 골든리트리버 새끼)');
            break;
          case '감정표정':
            improvements.push('표정이나 감정 추가 (예: 행복한 미소, 호기심 가득한 눈빛)');
            break;
          case '포즈동작':
            improvements.push('구체적인 포즈 설명 (예: 앉아서 정면 응시, 앞발 들고 서있는)');
            break;
          case '배경설정':
            improvements.push('배경 디테일 추가 (예: 별들이 반짝이는 우주, 성운)');
            break;
          case '조명정보':
            improvements.push('조명 설정 추가 (예: 따뜻한 황금빛, 부드러운 조명)');
            break;
          case '품질지시어':
            improvements.push('품질 키워드 추가 (예: highly detailed, professional quality)');
            break;
          case '부정명령어':
            improvements.push('제외 항목 추가 (예: --no blurry, low quality, watermark)');
            break;
          case '기술스펙':
            improvements.push('기술 스펙 추가 (예: 4K resolution, 16:9 aspect ratio)');
            break;
        }
      }
    });
    
    return improvements;
  }
}

// ⭐ 핵심: 제대로 export
const evaluationSystem = new EvaluationSystem();

module.exports = {
  evaluationSystem,
  EvaluationSystem
};

// ES6 방식도 지원
if (typeof module === 'undefined') {
  window.EvaluationSystem = EvaluationSystem;
  window.evaluationSystem = evaluationSystem;
}
