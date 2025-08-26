// utils/intentAnalyzer.js - 의도 분석 시스템

class IntentAnalyzer {
  constructor() {
    // 의도 분석 카테고리 (총 100점)
    this.categories = {
      목표명확도: { weight: 25, maxScore: 25 },
      대상정보: { weight: 20, maxScore: 20 },
      기술제약: { weight: 15, maxScore: 15 },
      스타일선호: { weight: 15, maxScore: 15 },
      도구환경: { weight: 10, maxScore: 10 },
      용도맥락: { weight: 10, maxScore: 10 },
      기타정보: { weight: 5, maxScore: 5 }
    };
  }
  
  // 🎯 의도 분석 리포트 생성
  generateAnalysisReport(userInput, answers = []) {
    try {
      console.log('🎯 의도 분석 시작');
      
      const allText = [userInput, ...answers].join(' ').toLowerCase();
      
      // 기본 점수 계산
      let totalScore = 19; // 기본 점수
      
      // 답변 수에 따른 보너스 (답변 1개당 10-12점)
      const answerBonus = Math.min(answers.length * 12, 60); // 최대 60점
      totalScore += answerBonus;
      
      // 키워드 보너스
      const keywordBonus = this.calculateKeywordBonus(allText);
      totalScore += keywordBonus;
      
      // 구체성 보너스
      const specificityBonus = this.calculateSpecificityBonus(allText);
      totalScore += specificityBonus;
      
      // 최대 95점 제한
      const finalScore = Math.min(totalScore, 95);
      
      console.log(`📊 의도 점수 계산: 기본(${19}) + 답변(${answerBonus}) + 키워드(${keywordBonus}) + 구체성(${specificityBonus}) = ${finalScore}점`);
      
      return {
        intentScore: finalScore,
        breakdown: {
          base: 19,
          answers: answerBonus,
          keywords: keywordBonus,
          specificity: specificityBonus
        },
        isComplete: finalScore >= 85,
        needsMoreInfo: finalScore < 85
      };
      
    } catch (error) {
      console.error('❌ 의도 분석 오류:', error);
      return {
        intentScore: 50,
        breakdown: { base: 50 },
        isComplete: false,
        needsMoreInfo: true
      };
    }
  }
  
  // 키워드 보너스 계산
  calculateKeywordBonus(text) {
    let bonus = 0;
    
    // 구체적 명사 (+2점씩)
    const specificNouns = ['품종', '크기', '색상', '스타일', '배경', '조명', '각도'];
    specificNouns.forEach(noun => {
      if (text.includes(noun)) bonus += 2;
    });
    
    // 감정/표정 키워드 (+3점)
    const emotions = ['행복', '미소', '호기심', '차분', '온순', '장난'];
    if (emotions.some(emotion => text.includes(emotion))) {
      bonus += 3;
    }
    
    // 기술 스펙 (+2점씩)
    const techSpecs = ['4k', 'hd', '해상도', '고화질', '고품질'];
    techSpecs.forEach(spec => {
      if (text.includes(spec)) bonus += 2;
    });
    
    return Math.min(bonus, 15); // 최대 15점
  }
  
  // 구체성 보너스 계산
  calculateSpecificityBonus(text) {
    let bonus = 0;
    
    // 숫자 정보 (+1점씩)
    const numbers = text.match(/\d+/g) || [];
    bonus += Math.min(numbers.length, 5);
    
    // 형용사 (+1점씩)
    const adjectives = ['큰', '작은', '밝은', '어두운', '따뜻한', '차가운', '부드러운'];
    adjectives.forEach(adj => {
      if (text.includes(adj)) bonus += 1;
    });
    
    // 전문 용어 (+2점씩)
    const professionalTerms = ['렌더링', '포토리얼', '컴포지션', '라이팅'];
    professionalTerms.forEach(term => {
      if (text.includes(term)) bonus += 2;
    });
    
    return Math.min(bonus, 10); // 최대 10점
  }
  
  // 부족한 정보 분석
  getMissingInformation(userInput, answers) {
    const allText = [userInput, ...answers].join(' ').toLowerCase();
    const missing = [];
    
    // 핵심 정보 체크
    const essentials = {
      '주제/대상': ['강아지', '사람', '제품', '풍경'],
      '스타일': ['사실적', '애니메이션', '일러스트', '3d'],
      '용도': ['개인', '상업', '교육', '홍보'],
      '품질': ['고품질', '전문', '일반', '빠른']
    };
    
    Object.entries(essentials).forEach(([category, keywords]) => {
      const hasMention = keywords.some(keyword => allText.includes(keyword));
      if (!hasMention) {
        missing.push(category);
      }
    });
    
    return missing;
  }
}

// ⭐ 핵심: 제대로 export
const intentAnalyzer = new IntentAnalyzer();

module.exports = {
  intentAnalyzer,
  IntentAnalyzer
};

// ES6 방식도 지원
if (typeof module === 'undefined') {
  window.IntentAnalyzer = IntentAnalyzer;
  window.intentAnalyzer = intentAnalyzer;
}
