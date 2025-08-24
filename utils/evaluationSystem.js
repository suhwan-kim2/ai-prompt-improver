// utils/evaluationSystem.js - 도메인별 전문 평가 시스템 (기존 파일 수정)

function evaluatePrompt(prompt, originalInput, domainInfo = {}) {
  try {
    const domain = domainInfo.primary || detectPrimaryDomain(prompt);
    console.log('🔍 평가 도메인:', domain);
    
    // 🎨 이미지 도메인 전용 평가
    if (domain === 'visual_design') {
      return evaluateImagePrompt(prompt, originalInput, domainInfo);
    }
    
    // 기존 일반 평가 (다른 도메인용)
    return evaluateGeneralPrompt(prompt, originalInput, domainInfo);
    
  } catch (error) {
    console.error('프롬프트 평가 중 오류:', error);
    return {
      total: 70,
      grade: 'B',
      details: {},
      improvements: ['평가 중 오류가 발생했습니다. 기본 점수를 적용합니다.']
    };
  }
}

// =============================================================================
// 🎨 이미지 도메인 전문 평가 시스템
// =============================================================================

function evaluateImagePrompt(prompt, originalInput, domainInfo = {}) {
  console.log('🎨 이미지 전문 평가 시작:', prompt);
  
  let totalScore = 0;
  const checkResults = {};
  const maxScore = 96; // 12개 체크리스트 × 8점
  
  // ✅ 1. 주체 구체화 (8점)
  const subjectScore = checkSubjectSpecificity(prompt);
  totalScore += subjectScore;
  checkResults.주체구체화 = {
    score: subjectScore,
    max: 8,
    description: getSubjectDescription(subjectScore)
  };
  
  // ✅ 2. 감정/표정 상세화 (8점)
  const emotionScore = checkEmotionDetails(prompt);
  totalScore += emotionScore;
  checkResults.감정표정 = {
    score: emotionScore,
    max: 8,
    description: getEmotionDescription(emotionScore)
  };
  
  // ✅ 3. 구체적 포즈/동작 (8점)
  const poseScore = checkPoseDetails(prompt);
  totalScore += poseScore;
  checkResults.포즈동작 = {
    score: poseScore,
    max: 8,
    description: getPoseDescription(poseScore)
  };
  
  // ✅ 4. 상세 배경 설정 (8점)
  const backgroundScore = checkBackgroundDetails(prompt);
  totalScore += backgroundScore;
  checkResults.배경설정 = {
    score: backgroundScore,
    max: 8,
    description: getBackgroundDescription(backgroundScore)
  };
  
  // ✅ 5. 조명 정보 (8점)
  const lightingScore = checkLightingDetails(prompt);
  totalScore += lightingScore;
  checkResults.조명정보 = {
    score: lightingScore,
    max: 8,
    description: getLightingDescription(lightingScore)
  };
  
  // ✅ 6. 카메라 설정/구도 (8점)
  const cameraScore = checkCameraDetails(prompt);
  totalScore += cameraScore;
  checkResults.카메라구도 = {
    score: cameraScore,
    max: 8,
    description: getCameraDescription(cameraScore)
  };
  
  // ✅ 7. 예술 스타일 명시 (8점)
  const styleScore = checkArtStyleDetails(prompt);
  totalScore += styleScore;
  checkResults.예술스타일 = {
    score: styleScore,
    max: 8,
    description: getStyleDescription(styleScore)
  };
  
  // ✅ 8. 색상 팔레트 (8점)
  const colorScore = checkColorPalette(prompt);
  totalScore += colorScore;
  checkResults.색상팔레트 = {
    score: colorScore,
    max: 8,
    description: getColorDescription(colorScore)
  };
  
  // ✅ 9. 품질 지시어 (8점)
  const qualityScore = checkQualityKeywords(prompt);
  totalScore += qualityScore;
  checkResults.품질지시어 = {
    score: qualityScore,
    max: 8,
    description: getQualityDescription(qualityScore)
  };
  
  // ✅ 10. 참고 플랫폼 (8점)
  const platformScore = checkReferencePlatforms(prompt);
  totalScore += platformScore;
  checkResults.참고플랫폼 = {
    score: platformScore,
    max: 8,
    description: getPlatformDescription(platformScore)
  };
  
  // ✅ 11. 부정 명령어 (8점)
  const negativeScore = checkNegativePrompts(prompt);
  totalScore += negativeScore;
  checkResults.부정명령어 = {
    score: negativeScore,
    max: 8,
    description: getNegativeDescription(negativeScore)
  };
  
  // ✅ 12. 기술 스펙 (8점)
  const techScore = checkTechnicalSpecs(prompt);
  totalScore += techScore;
  checkResults.기술스펙 = {
    score: techScore,
    max: 8,
    description: getTechDescription(techScore)
  };
  
  const finalScore = Math.round(totalScore);
  
  return {
    total: finalScore,
    grade: getImageGrade(finalScore),
    details: checkResults,
    improvements: generateImageImprovements(checkResults, finalScore),
    domain: 'visual_design',
    isImagePrompt: true
  };
}

// =============================================================================
// 🎯 이미지 체크리스트 함수들
// =============================================================================

// 1. 주체 구체화 체크
function checkSubjectSpecificity(prompt) {
  let score = 0;
  
  // 기본 주체 (+2점)
  if (prompt.match(/(dog|cat|person|animal|character|bird|fish)/i)) score += 2;
  
  // 구체적 품종/종류 (+3점)
  if (prompt.match(/(golden retriever|siamese cat|corgi|husky|persian cat)/i)) score += 3;
  
  // 세부 특징 (+3점)  
  if (prompt.match(/(floppy ears|curly tail|blue eyes|brown fur|white paws)/i)) score += 3;
  
  return Math.min(8, score);
}

// 2. 감정/표정 체크
function checkEmotionDetails(prompt) {
  let score = 0;
  
  // 기본 감정 (+2점)
  if (prompt.match(/(happy|sad|cute|angry|playful)/i)) score += 2;
  
  // 구체적 표정 (+3점)
  if (prompt.match(/(smiling|curious eyes|gentle expression|bright eyes)/i)) score += 3;
  
  // 미묘한 감정 (+3점)
  if (prompt.match(/(mischievous|contemplative|serene|joyful expression)/i)) score += 3;
  
  return Math.min(8, score);
}

// 3. 포즈/동작 체크  
function checkPoseDetails(prompt) {
  let score = 0;
  
  // 기본 포즈 (+2점)
  if (prompt.match(/(sitting|standing|lying|running|jumping)/i)) score += 2;
  
  // 구체적 자세 (+3점)
  if (prompt.match(/(sitting with|standing on|lying down with)/i)) score += 3;
  
  // 세부 동작 (+3점)
  if (prompt.match(/(head tilted|paws crossed|tail wagging|ears perked)/i)) score += 3;
  
  return Math.min(8, score);
}

// 4. 배경 설정 체크
function checkBackgroundDetails(prompt) {
  let score = 0;
  
  // 기본 배경 (+2점)
  if (prompt.match(/(background|park|room|outdoor|indoor|garden)/i)) score += 2;
  
  // 구체적 장소 (+3점)
  if (prompt.match(/(sunny park|cozy room|flower garden|beach)/i)) score += 3;
  
  // 배경 디테일 (+3점)
  if (prompt.match(/(cherry blossoms|wooden bench|soft grass|blue sky)/i)) score += 3;
  
  return Math.min(8, score);
}

// 5. 조명 정보 체크
function checkLightingDetails(prompt) {
  let score = 0;
  
  // 기본 조명 (+2점)
  if (prompt.match(/(bright|dark|lighting|light|illuminated)/i)) score += 2;
  
  // 구체적 조명 (+3점)
  if (prompt.match(/(golden hour|soft light|warm lighting|natural light)/i)) score += 3;
  
  // 전문적 조명 (+3점)
  if (prompt.match(/(rim light|ambient lighting|studio lighting|dramatic lighting)/i)) score += 3;
  
  return Math.min(8, score);
}

// 6. 카메라 설정 체크
function checkCameraDetails(prompt) {
  let score = 0;
  
  // 기본 구도 (+2점)
  if (prompt.match(/(close-up|wide shot|medium shot|portrait)/i)) score += 2;
  
  // 카메라 설정 (+3점)
  if (prompt.match(/(depth of field|bokeh|focus|shallow focus)/i)) score += 3;
  
  // 전문적 구도 (+3점)
  if (prompt.match(/(rule of thirds|leading lines|symmetrical|composition)/i)) score += 3;
  
  return Math.min(8, score);
}

// 7. 예술 스타일 체크
function checkArtStyleDetails(prompt) {
  let score = 0;
  
  // 기본 스타일 (+2점)
  if (prompt.match(/(anime|realistic|cartoon|3d|illustration)/i)) score += 2;
  
  // 구체적 스타일 (+3점)
  if (prompt.match(/(kawaii anime|studio ghibli|pixar style|disney style)/i)) score += 3;
  
  // 예술가/기법 언급 (+3점)
  if (prompt.match(/(miyazaki|watercolor|oil painting|digital art)/i)) score += 3;
  
  return Math.min(8, score);
}

// 8. 색상 팔레트 체크
function checkColorPalette(prompt) {
  let score = 0;
  
  // 기본 색상 (+2점)
  if (prompt.match(/(red|blue|green|yellow|pink|purple|color)/i)) score += 2;
  
  // 색상 톤 (+3점)
  if (prompt.match(/(pastel|vivid|monochrome|warm tone|cool tone)/i)) score += 3;
  
  // 구체적 팔레트 (+3점)
  if (prompt.match(/(pink and cream|blue and gold|palette|color scheme)/i)) score += 3;
  
  return Math.min(8, score);
}

// 9. 품질 지시어 체크
function checkQualityKeywords(prompt) {
  let score = 0;
  
  // 기본 품질 (+2점)
  if (prompt.match(/(high quality|detailed|good quality)/i)) score += 2;
  
  // 전문 품질 (+3점)
  if (prompt.match(/(masterpiece|studio quality|professional|premium)/i)) score += 3;
  
  // 최고급 품질 (+3점)
  if (prompt.match(/(award winning|trending|featured|gallery quality)/i)) score += 3;
  
  return Math.min(8, score);
}

// 10. 참고 플랫폼 체크
function checkReferencePlatforms(prompt) {
  let score = 0;
  
  // 플랫폼 언급 (+4점)
  if (prompt.match(/(artstation|deviantart|pixiv|behance)/i)) score += 4;
  
  // 트렌딩 언급 (+4점)
  if (prompt.match(/(trending|featured|popular|viral)/i)) score += 4;
  
  return Math.min(8, score);
}

// 11. 부정 명령어 체크
function checkNegativePrompts(prompt) {
  let score = 0;
  
  // 부정 명령어 존재 (+3점)
  if (prompt.includes('--no') || prompt.includes('avoid')) score += 3;
  
  // 구체적 제외 요소 (+3점)
  if (prompt.match(/(blurry|low quality|watermark|dark)/i)) score += 3;
  
  // 다양한 제외 요소 (+2점)
  const negativeItems = (prompt.match(/--no\s+[^,\s]+/gi) || []).length;
  if (negativeItems >= 3) score += 2;
  
  return Math.min(8, score);
}

// 12. 기술 스펙 체크
function checkTechnicalSpecs(prompt) {
  let score = 0;
  
  // 해상도 (+3점)
  if (prompt.match(/(4K|8K|HD|UHD|resolution)/i)) score += 3;
  
  // 비율/포맷 (+3점)
  if (prompt.match(/(16:9|4:3|aspect ratio|PNG|JPG)/i)) score += 3;
  
  // 전문 스펙 (+2점)
  if (prompt.match(/(300 DPI|CMYK|sRGB|color space)/i)) score += 2;
  
  return Math.min(8, score);
}

// =============================================================================
// 🎯 이미지 평가 설명 함수들
// =============================================================================

function getSubjectDescription(score) {
  if (score >= 7) return "완벽한 주체 구체화";
  if (score >= 5) return "좋은 주체 구체화"; 
  if (score >= 3) return "기본 주체 명시";
  return "주체가 모호함";
}

function getEmotionDescription(score) {
  if (score >= 7) return "완벽한 감정 표현";
  if (score >= 5) return "좋은 감정 표현";
  if (score >= 3) return "기본 감정 표현";
  return "감정 표현 부족";
}

function getPoseDescription(score) {
  if (score >= 7) return "완벽한 포즈 설정";
  if (score >= 5) return "좋은 포즈 설정";
  if (score >= 3) return "기본 포즈 설정";
  return "포즈 설정 부족";
}

function getBackgroundDescription(score) {
  if (score >= 7) return "완벽한 배경 설정";
  if (score >= 5) return "좋은 배경 설정";
  if (score >= 3) return "기본 배경 설정";
  return "배경 설정 부족";
}

function getLightingDescription(score) {
  if (score >= 7) return "완벽한 조명 설정";
  if (score >= 5) return "좋은 조명 설정";
  if (score >= 3) return "기본 조명 설정";
  return "조명 설정 부족";
}

function getCameraDescription(score) {
  if (score >= 7) return "완벽한 카메라 설정";
  if (score >= 5) return "좋은 카메라 설정";
  if (score >= 3) return "기본 구도 설정";
  return "카메라 설정 부족";
}

function getStyleDescription(score) {
  if (score >= 7) return "완벽한 스타일 명시";
  if (score >= 5) return "좋은 스타일 명시";
  if (score >= 3) return "기본 스타일 명시";
  return "스타일 명시 부족";
}

function getColorDescription(score) {
  if (score >= 7) return "완벽한 색상 팔레트";
  if (score >= 5) return "좋은 색상 설정";
  if (score >= 3) return "기본 색상 정보";
  return "색상 정보 부족";
}

function getQualityDescription(score) {
  if (score >= 7) return "완벽한 품질 지시어";
  if (score >= 5) return "좋은 품질 지시어";
  if (score >= 3) return "기본 품질 지시어";
  return "품질 지시어 부족";
}

function getPlatformDescription(score) {
  if (score >= 5) return "참고 플랫폼 포함";
  return "참고 플랫폼 없음";
}

function getNegativeDescription(score) {
  if (score >= 7) return "완벽한 부정 명령어";
  if (score >= 5) return "좋은 부정 명령어";
  if (score >= 3) return "기본 부정 명령어";
  return "부정 명령어 없음";
}

function getTechDescription(score) {
  if (score >= 7) return "완벽한 기술 스펙";
  if (score >= 5) return "좋은 기술 스펙";
  if (score >= 3) return "기본 기술 스펙";
  return "기술 스펙 부족";
}

// 이미지 등급 시스템
function getImageGrade(score) {
  if (score >= 90) return 'S+ (전문가급)';
  if (score >= 80) return 'S (우수)';
  if (score >= 70) return 'A+ (좋음)';
  if (score >= 60) return 'A (보통)';
  if (score >= 50) return 'B+ (기초)';
  if (score >= 40) return 'B (미흡)';
  return 'C (부족)';
}

// 이미지 개선사항 생성
function generateImageImprovements(checkResults, finalScore) {
  const improvements = [];
  
  // 점수별 총평
  if (finalScore >= 90) {
    improvements.push("🏆 전문가급 이미지 프롬프트 완성!");
  } else if (finalScore >= 80) {
    improvements.push("🎯 거의 완벽! 몇 가지만 더 보완하면 전문가급!");
  } else if (finalScore >= 70) {
    improvements.push("👍 좋은 시작! 디테일을 더 추가해보세요.");
  } else if (finalScore >= 60) {
    improvements.push("📝 기본기는 갖춰짐. 구체적 정보가 더 필요합니다.");
  } else {
    improvements.push("🚨 많은 개선이 필요합니다. 더 구체적으로 작성해주세요.");
  }
  
  // 체크리스트별 개선사항 (점수 낮은 것만)
  Object.entries(checkResults).forEach(([key, result]) => {
    if (result.score < 6) {
      switch(key) {
        case '주체구체화':
          improvements.push("🐕 주체 구체화: 정확한 품종, 크기, 특징 추가 필요");
          break;
        case '감정표정':
          improvements.push("😊 감정 표현: 구체적 표정, 눈빛, 미묘한 감정 추가");
          break;
        case '포즈동작':
          improvements.push("🤸 포즈 디테일: 정확한 자세, 각도, 세부 동작 명시");
          break;
        case '배경설정':
          improvements.push("🌳 배경 상세화: 구체적 환경, 소품, 분위기 추가");
          break;
        case '조명정보':
          improvements.push("💡 조명 전문화: 조명 종류, 방향, 강도 명시");
          break;
        case '카메라구도':
          improvements.push("📷 카메라 설정: 구도, 초점, 앵글 추가");
          break;
        case '예술스타일':
          improvements.push("🎨 스타일 구체화: 작가, 스튜디오, 세부 기법");
          break;
        case '색상팔레트':
          improvements.push("🌈 색상 정확화: 구체적 색상 조합, 톤 설정");
          break;
        case '품질지시어':
          improvements.push("⭐ 품질 강화: masterpiece, studio quality 추가");
          break;
        case '참고플랫폼':
          improvements.push("🔥 플랫폼 추가: trending on ArtStation 포함");
          break;
        case '부정명령어':
          improvements.push("🚫 부정 명령어: --no blurry, watermark 추가");
          break;
        case '기술스펙':
          improvements.push("⚙️ 기술 스펙: 해상도, 비율, 포맷 명시");
          break;
      }
    }
  });
  
  return improvements;
}

// =============================================================================
// 📊 기존 일반 평가 시스템 (다른 도메인용)
// =============================================================================

function evaluateGeneralPrompt(prompt, originalInput, domainInfo = {}) {
  // 기존 평가 로직 유지
  let totalScore = 0;
  const details = {};
  
  // 1. 정보 밀도 (30점)
  const informationDensity = calculateInformationDensity(prompt);
  const densityScore = Math.min(30, informationDensity * 30);
  totalScore += densityScore;
  details.informationDensity = {
    score: densityScore,
    ratio: informationDensity,
    description: informationDensity > 0.8 ? '매우 구체적' : informationDensity > 0.6 ? '구체적' : '보통'
  };
  
  // 2. 완성도 (25점)
  const completeness = calculateCompleteness(prompt, domainInfo);
  const completenessScore = Math.min(25, completeness * 25);
  totalScore += completenessScore;
  details.completeness = {
    score: completenessScore,
    ratio: completeness,
    description: completeness > 0.9 ? '완전함' : completeness > 0.7 ? '충분함' : '보통'
  };
  
  // 3. 명확성 (20점)
  const clarity = calculateClarity(prompt);
  const clarityScore = Math.min(20, clarity * 20);
  totalScore += clarityScore;
  details.clarity = {
    score: clarityScore,
    ratio: clarity,
    description: clarity > 0.8 ? '매우 명확' : '보통'
  };
  
  // 4. 실행가능성 (15점)
  const executability = calculateExecutability(prompt);
  const executabilityScore = Math.min(15, executability * 15);
  totalScore += executabilityScore;
  details.executability = {
    score: executabilityScore,
    ratio: executability,
    description: '실행 가능'
  };
  
  // 5. 효율성 (10점)
  const efficiency = calculateEfficiency(prompt, originalInput);
  const efficiencyScore = Math.min(10, efficiency * 10);
  totalScore += efficiencyScore;
  details.efficiency = {
    score: efficiencyScore,
    ratio: efficiency,
    description: '효율적'
  };
  
  const finalScore = Math.round(totalScore);
  
  return {
    total: finalScore,
    grade: getGrade(finalScore),
    details: details,
    improvements: generateImprovements(details, finalScore),
    domain: domainInfo.primary || 'general'
  };
}

// =============================================================================
// 🔧 기존 함수들 (유지)
// =============================================================================

function calculateInformationDensity(prompt) {
  try {
    const words = prompt.split(/\s+/);
    const totalWords = words.length;
    
    if (totalWords === 0) return 0;
    
    let concreteInfo = 0;
    
    const numbers = prompt.match(/\d+/g) || [];
    concreteInfo += numbers.length * 0.2;
    
    const units = prompt.match(/(px|cm|mm|초|분|시간|KB|MB|GB|TB|K|4K|8K|HD|FHD|UHD)/gi) || [];
    concreteInfo += units.length * 0.15;
    
    const colors = prompt.match(/(빨간|파란|노란|검은|흰|회색|갈색|초록|보라|분홍|주황|금색|은색|투명|#[0-9A-F]{6})/gi) || [];
    concreteInfo += colors.length * 0.1;
    
    const materials = prompt.match(/(나무|금속|플라스틱|유리|천|가죽|고무|사실적|3D|애니메이션|일러스트|수채화|유화)/gi) || [];
    concreteInfo += materials.length * 0.1;
    
    return Math.max(0, Math.min(1, concreteInfo / Math.max(totalWords / 10, 1)));
  } catch (error) {
    console.error('정보 밀도 계산 오류:', error);
    return 0.5;
  }
}

function calculateCompleteness(prompt, domainInfo = {}) {
  try {
    let completeness = 0.5;
    const domain = domainInfo.primary || detectPrimaryDomain(prompt);
    
    switch(domain) {
      case 'visual_design':
        if (prompt.match(/(style|color|size|resolution)/i)) completeness += 0.1;
        if (prompt.match(/\d+(px|cm|K|p)/)) completeness += 0.2;
        if (prompt.match(/(background|lighting|angle)/i)) completeness += 0.15;
        break;
      default:
        if (prompt.match(/(목적|목표)/i)) completeness += 0.15;
        break;
    }
    
    return Math.min(1, completeness);
  } catch (error) {
    return 0.5;
  }
}

function calculateClarity(prompt) {
  try {
    let clarity = 0.6;
    
    const clearInstructions = prompt.match(/정확히|구체적으로|반드시|~해야|~로/g) || [];
    clarity += Math.min(0.1, clearInstructions.length * 0.02);
    
    const numbers = prompt.match(/\d+/g) || [];
    clarity += Math.min(0.2, numbers.length * 0.05);
    
    const vagueExpressions = prompt.match(/적당히|알아서|대충|좀|어느정도/g) || [];
    clarity -= vagueExpressions.length * 0.1;
    
    return Math.max(0, Math.min(1, clarity));
  } catch (error) {
    return 0.6;
  }
}

function calculateExecutability(prompt) {
  try {
    let executability = 0.7;
    
    if (prompt.match(/(Photoshop|Blender|React|Python|HTML)/gi)) executability += 0.1;
    if (prompt.match(/(4K|HD|1080p|30fps|60fps)/gi)) executability += 0.1;
    
    const unrealistic = prompt.match(/(완벽한|100%|절대|무조건)/gi) || [];
    executability -= Math.min(0.2, unrealistic.length * 0.05);
    
    return Math.max(0, Math.min(1, executability));
  } catch (error) {
    return 0.7;
  }
}

function calculateEfficiency(prompt, originalInput) {
  try {
    let efficiency = 0.8;
    
    if (originalInput && originalInput.length > 0) {
      const lengthRatio = prompt.length / originalInput.length;
      if (lengthRatio > 5) efficiency -= 0.3;
      else if (lengthRatio < 1.5) efficiency -= 0.2;
    }
    
    return Math.max(0, Math.min(1, efficiency));
  } catch (error) {
    return 0.8;
  }
}

function detectPrimaryDomain(prompt) {
  try {
    if (prompt.match(/(그림|이미지|사진|포스터|로고|디자인|create|illustration|image)/i)) return 'visual_design';
    if (prompt.match(/(영상|비디오|동영상|애니메이션|video)/i)) return 'video';
    if (prompt.match(/(웹사이트|앱|프로그램|코딩|개발|website|app)/i)) return 'development';
    if (prompt.match(/(글|텍스트|문서|기사|블로그|write|text)/i)) return 'text_language';
    if (prompt.match(/(사업|비즈니스|전략|마케팅|business)/i)) return 'business';
    if (prompt.match(/(음악|소리|오디오|노래|music|audio)/i)) return 'music_audio';
    return 'general';
  } catch (error) {
    return 'general';
  }
}

function getGrade(score) {
  if (score >= 95) return 'S+';
  if (score >= 90) return 'S';
  if (score >= 85) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  return 'D';
}

function generateImprovements(details, score) {
  const improvements = [];
  
  try {
    if (details.informationDensity && details.informationDensity.ratio < 0.6) {
      improvements.push('구체적인 수치, 크기, 색상 정보를 추가해보세요');
    }
    
    if (details.completeness && details.completeness.ratio < 0.7) {
      improvements.push('필수 요소(스타일, 크기, 품질 등)를 더 포함해보세요');
    }
    
    if (details.clarity && details.clarity.ratio < 0.6) {
      improvements.push('모호한 표현을 피하고 더 명확한 지시사항을 사용해보세요');
    }
    
    if (score >= 95) {
      improvements.push('완벽합니다! 전문가급 프롬프트입니다.');
    } else if (score >= 85) {
      improvements.push('매우 좋습니다! 조금만 더 구체화하면 완벽해집니다.');
    } else if (score >= 70) {
      improvements.push('좋은 시작입니다! 몇 가지 요소를 더 추가해보세요.');
    } else {
      improvements.push('더 구체적인 정보와 명확한 지시사항이 필요합니다.');
    }
  } catch (error) {
    improvements.push('평가 분석에 오류가 있어 일반적인 조언을 제공합니다.');
  }
  
  return improvements;
}

// Node.js 환경에서 사용할 수 있도록 export
module.exports = {
  evaluatePrompt,
  evaluateImagePrompt,
  calculateInformationDensity,
  calculateCompleteness,
  calculateClarity,
  calculateExecutability,
  calculateEfficiency,
  detectPrimaryDomain,
  getGrade,
  generateImprovements,
  // 이미지 전용 함수들
  checkSubjectSpecificity,
  checkEmotionDetails,
  checkPoseDetails,
  checkBackgroundDetails,
  checkLightingDetails,
  checkCameraDetails,
  checkArtStyleDetails,
  checkColorPalette,
  checkQualityKeywords,
  checkReferencePlatforms,
  checkNegativePrompts,
  checkTechnicalSpecs,
  getImageGrade,
  generateImageImprovements
};
