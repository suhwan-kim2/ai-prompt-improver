// utils/evaluationSystem.js - 95점+ 달성 가능한 평가 시스템 (Node.js 호환 버전)

function evaluatePrompt(prompt, originalInput, domainInfo = {}) {
  try {
    let totalScore = 0;
    const details = {};
    
    // 1. 정보 밀도 (30점) - 구체적 정보 vs 불필요한 수식어
    const informationDensity = calculateInformationDensity(prompt);
    const densityScore = Math.min(30, informationDensity * 30);
    totalScore += densityScore;
    details.informationDensity = {
      score: densityScore,
      ratio: informationDensity,
      description: informationDensity > 0.8 ? '매우 구체적' : informationDensity > 0.6 ? '구체적' : informationDensity > 0.4 ? '보통' : '모호함'
    };
    
    // 2. 완성도 (25점) - 필수 정보 포함 여부
    const completeness = calculateCompleteness(prompt, domainInfo);
    const completenessScore = Math.min(25, completeness * 25);
    totalScore += completenessScore;
    details.completeness = {
      score: completenessScore,
      ratio: completeness,
      description: completeness > 0.9 ? '완전함' : completeness > 0.7 ? '충분함' : completeness > 0.5 ? '보통' : '부족함'
    };
    
    // 3. 명확성 (20점) - 모호하지 않고 구체적
    const clarity = calculateClarity(prompt);
    const clarityScore = Math.min(20, clarity * 20);
    totalScore += clarityScore;
    details.clarity = {
      score: clarityScore,
      ratio: clarity,
      description: clarity > 0.8 ? '매우 명확' : clarity > 0.6 ? '명확' : clarity > 0.4 ? '보통' : '모호함'
    };
    
    // 4. 실행가능성 (15점) - AI가 이해하기 쉬움
    const executability = calculateExecutability(prompt);
    const executabilityScore = Math.min(15, executability * 15);
    totalScore += executabilityScore;
    details.executability = {
      score: executabilityScore,
      ratio: executability,
      description: executability > 0.8 ? '완벽히 실행 가능' : executability > 0.6 ? '실행 가능' : '실행 어려움'
    };
    
    // 5. 효율성 (10점) - 중복/불필요 내용 없음
    const efficiency = calculateEfficiency(prompt, originalInput);
    const efficiencyScore = Math.min(10, efficiency * 10);
    totalScore += efficiencyScore;
    details.efficiency = {
      score: efficiencyScore,
      ratio: efficiency,
      description: efficiency > 0.8 ? '매우 효율적' : efficiency > 0.6 ? '효율적' : '비효율적'
    };
    
    const finalScore = Math.round(totalScore);
    
    return {
      total: finalScore,
      grade: getGrade(finalScore),
      details: details,
      improvements: generateImprovements(details, finalScore)
    };
  } catch (error) {
    console.error('프롬프트 평가 중 오류:', error);
    // 안전한 폴백 점수
    return {
      total: 70,
      grade: 'B',
      details: {},
      improvements: ['평가 중 오류가 발생했습니다. 기본 점수를 적용합니다.']
    };
  }
}

// 1. 정보 밀도 계산
function calculateInformationDensity(prompt) {
  try {
    const words = prompt.split(/\s+/);
    const totalWords = words.length;
    
    if (totalWords === 0) return 0;
    
    // 구체적 정보 점수
    let concreteInfo = 0;
    
    // 수치 정보 (+0.2 per number)
    const numbers = prompt.match(/\d+/g) || [];
    concreteInfo += numbers.length * 0.2;
    
    // 단위 정보 (+0.15 per unit)
    const units = prompt.match(/(px|cm|mm|초|분|시간|KB|MB|GB|TB|K|4K|8K|HD|FHD|UHD)/gi) || [];
    concreteInfo += units.length * 0.15;
    
    // 색상 정보 (+0.1 per color)
    const colors = prompt.match(/(빨간|파란|노란|검은|흰|회색|갈색|초록|보라|분홍|주황|금색|은색|투명|#[0-9A-F]{6})/gi) || [];
    concreteInfo += colors.length * 0.1;
    
    // 재질/스타일 정보 (+0.1 per material)
    const materials = prompt.match(/(나무|금속|플라스틱|유리|천|가죽|고무|사실적|3D|애니메이션|일러스트|수채화|유화)/gi) || [];
    concreteInfo += materials.length * 0.1;
    
    // 불필요한 감정 표현 (-0.05 per emotion)
    const emotions = prompt.match(/(아름다운|감동적인|놀라운|환상적인|마법같은|웅장한|경이로운|멋진|좋은|나쁜)/gi) || [];
    concreteInfo -= emotions.length * 0.05;
    
    return Math.max(0, Math.min(1, concreteInfo / Math.max(totalWords / 10, 1)));
  } catch (error) {
    console.error('정보 밀도 계산 오류:', error);
    return 0.5;
  }
}

// 2. 완성도 계산
function calculateCompleteness(prompt, domainInfo = {}) {
  try {
    let completeness = 0.5; // 기본점수
    
    // 도메인별 필수 요소 체크
    const domain = domainInfo.primary || detectPrimaryDomain(prompt);
    
    switch(domain) {
      case 'visual_design':
        if (prompt.match(/(스타일|색상|크기|해상도|구도)/i)) completeness += 0.1;
        if (prompt.match(/\d+(px|cm|K|p)/)) completeness += 0.2; // 수치 포함
        if (prompt.match(/(배경|조명|각도)/i)) completeness += 0.15;
        break;
        
      case 'video':
        if (prompt.match(/(길이|시간|초|분)/i)) completeness += 0.2;
        if (prompt.match(/(해상도|fps|화질)/i)) completeness += 0.15;
        if (prompt.match(/(장면|구성|편집)/i)) completeness += 0.15;
        break;
        
      case 'development':
        if (prompt.match(/(기능|API|데이터베이스)/i)) completeness += 0.2;
        if (prompt.match(/(언어|프레임워크|라이브러리)/i)) completeness += 0.15;
        if (prompt.match(/(반응형|모바일|웹)/i)) completeness += 0.15;
        break;
        
      case 'text_language':
        if (prompt.match(/(톤|어조|분량|글자수)/i)) completeness += 0.2;
        if (prompt.match(/(대상|독자|목적)/i)) completeness += 0.15;
        if (prompt.match(/(구조|형식|스타일)/i)) completeness += 0.15;
        break;
      
      default:
        // 일반적인 완성도 체크
        if (prompt.match(/(목적|목표)/i)) completeness += 0.15;
        if (prompt.match(/(크기|사이즈)/i)) completeness += 0.1;
        if (prompt.match(/(스타일|방식)/i)) completeness += 0.1;
        break;
    }
    
    return Math.min(1, completeness);
  } catch (error) {
    console.error('완성도 계산 오류:', error);
    return 0.5;
  }
}

// 3. 명확성 계산
function calculateClarity(prompt) {
  try {
    let clarity = 0.6; // 기본점수
    
    // 명확한 지시사항 (+)
    const clearInstructions = prompt.match(/정확히|구체적으로|반드시|~해야|~로/g) || [];
    clarity += Math.min(0.1, clearInstructions.length * 0.02);
    
    // 수치 정보 포함 (+)
    const numbers = prompt.match(/\d+/g) || [];
    clarity += Math.min(0.2, numbers.length * 0.05);
    
    // 모호한 표현 (-)
    const vagueExpressions = prompt.match(/적당히|알아서|대충|좀|어느정도/g) || [];
    clarity -= vagueExpressions.length * 0.1;
    
    // 너무 복잡한 문장 (-)
    const sentences = prompt.split(/[.!?]/).filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
      if (avgLength > 100) clarity -= 0.1;
    }
    
    return Math.max(0, Math.min(1, clarity));
  } catch (error) {
    console.error('명확성 계산 오류:', error);
    return 0.6;
  }
}

// 4. 실행가능성 계산
function calculateExecutability(prompt) {
  try {
    let executability = 0.7; // 기본점수
    
    // 실행 가능한 도구/기술 언급 (+)
    if (prompt.match(/(Photoshop|Blender|React|Python|HTML|CSS|JavaScript)/gi)) executability += 0.1;
    
    // 현실적인 요구사항 (+)
    if (prompt.match(/(4K|HD|1080p|30fps|60fps)/gi)) executability += 0.1;
    
    // 비현실적 요구사항 (-)
    const unrealistic = prompt.match(/(완벽한|100%|절대|무조건|반드시)/gi) || [];
    executability -= Math.min(0.2, unrealistic.length * 0.05);
    
    // 모순되는 요구사항 (-)
    if (prompt.match(/(빠르게.*고품질|간단하게.*복잡한)/gi)) executability -= 0.2;
    
    return Math.max(0, Math.min(1, executability));
  } catch (error) {
    console.error('실행가능성 계산 오류:', error);
    return 0.7;
  }
}

// 5. 효율성 계산
function calculateEfficiency(prompt, originalInput) {
  try {
    let efficiency = 0.8; // 기본점수
    
    // 길이 체크 - 원본 대비 적절한 길이
    if (originalInput && originalInput.length > 0) {
      const lengthRatio = prompt.length / originalInput.length;
      if (lengthRatio > 5) efficiency -= 0.3; // 너무 김
      else if (lengthRatio > 3) efficiency -= 0.1; // 조금 김
      else if (lengthRatio < 1.5) efficiency -= 0.2; // 너무 짧음
    }
    
    // 중복 단어 체크
    const words = prompt.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    if (words.length > 0) {
      const uniqueWords = new Set(words);
      const duplicateRatio = 1 - (uniqueWords.size / words.length);
      if (duplicateRatio > 0.3) efficiency -= 0.2;
    }
    
    // 불필요한 접속사 체크
    const conjunctions = prompt.match(/(그리고|또한|또|그런데|하지만|그러나)/g) || [];
    if (conjunctions.length > 3) efficiency -= Math.min(0.2, conjunctions.length * 0.05);
    
    return Math.max(0, Math.min(1, efficiency));
  } catch (error) {
    console.error('효율성 계산 오류:', error);
    return 0.8;
  }
}

// 도메인 감지
function detectPrimaryDomain(prompt) {
  try {
    if (prompt.match(/(그림|이미지|사진|포스터|로고|디자인)/i)) return 'visual_design';
    if (prompt.match(/(영상|비디오|동영상|애니메이션)/i)) return 'video';
    if (prompt.match(/(웹사이트|앱|프로그램|코딩|개발)/i)) return 'development';
    if (prompt.match(/(글|텍스트|문서|기사|블로그)/i)) return 'text_language';
    return 'general';
  } catch (error) {
    console.error('도메인 감지 오류:', error);
    return 'general';
  }
}

// 점수 등급
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

// 개선 제안
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
    
    if (details.efficiency && details.efficiency.ratio < 0.6) {
      improvements.push('불필요한 중복을 제거하고 더 간결하게 작성해보세요');
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
    console.error('개선사항 생성 오류:', error);
    improvements.push('평가 분석에 오류가 있어 일반적인 조언을 제공합니다.');
  }
  
  return improvements;
}

// Node.js 환경에서 사용할 수 있도록 export
module.exports = {
  evaluatePrompt,
  calculateInformationDensity,
  calculateCompleteness,
  calculateClarity,
  calculateExecutability,
  calculateEfficiency,
  detectPrimaryDomain,
  getGrade,
  generateImprovements
};
