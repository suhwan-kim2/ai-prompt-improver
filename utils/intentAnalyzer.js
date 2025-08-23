// utils/intentAnalyzer.js - 의도 분석 엔진 (Node.js 호환 버전)

class IntentAnalyzer {
  constructor() {
    // 의도 슬롯 키워드 맵핑
    this.slotKeywords = {
      목표: {
        keywords: ["그림", "이미지", "영상", "웹사이트", "앱", "글", "문서", "로고", "포스터", "디자인"],
        weight: 25
      },
      대상: {
        keywords: ["아이", "어른", "학생", "고객", "사용자", "회사", "비즈니스", "개인", "포트폴리오"],
        weight: 20
      },
      제약: {
        keywords: ["초", "분", "px", "cm", "4k", "hd", "예산", "마감", "크기", "해상도"],
        weight: 15
      },
      스타일: {
        keywords: ["실사", "애니메이션", "3d", "일러스트", "사실적", "귀여운", "전문적", "심플한"],
        weight: 15
      },
      도구: {
        keywords: ["photoshop", "figma", "react", "vue", "python", "blender", "premiere"],
        weight: 10
      },
      용도: {
        keywords: ["광고", "교육", "홍보", "설명", "sns", "유튜브", "인스타그램", "발표"],
        weight: 10
      },
      톤: {
        keywords: ["전문적", "친근한", "간결한", "설득적", "공식적", "캐주얼"],
        weight: 5
      }
    };
  }

  // 의도 서명 추출
  extractIntentSignature(userInput, previousAnswers = []) {
    const input = userInput.toLowerCase();
    const allText = [userInput, ...previousAnswers].join(' ').toLowerCase();
    
    const signature = {};
    let totalFound = 0;
    
    // 각 슬롯별로 키워드 매칭
    Object.entries(this.slotKeywords).forEach(([slot, config]) => {
      const found = config.keywords.filter(keyword => 
        allText.includes(keyword.toLowerCase())
      );
      
      if (found.length > 0) {
        signature[slot] = found;
        totalFound += config.weight;
      } else {
        signature[slot] = null;
      }
    });

    // 추가 정보 추출
    signature.숫자정보 = this.extractNumbers(allText);
    signature.부정정보 = this.extractNegatives(allText);
    
    return {
      signature,
      totalFound,
      completeness: Math.min(100, totalFound)
    };
  }

  // 숫자 정보 추출 (크기, 시간, 수량 등)
  extractNumbers(text) {
    const patterns = [
      /(\d+)\s*(초|분|시간)/g,
      /(\d+)\s*(px|cm|mm|인치)/g,
      /(\d+)\s*(k|4k|8k|hd|fhd)/gi,
      /(\d+)\s*(개|장|편|권)/g,
      /(\d+)\s*(만원|원|달러)/g
    ];
    
    const numbers = [];
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        numbers.push(match[0]);
      }
    });
    
    return numbers;
  }

  // 부정/제외 정보 추출
  extractNegatives(text) {
    const negativePatterns = [
      /(제외|빼고|하지 말|금지|안 해|없이|말고)/g,
      /(~은 안|~는 안|~지 말)/g
    ];
    
    const negatives = [];
    negativePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        negatives.push(match[0]);
      }
    });
    
    return negatives;
  }

  // 의도 점수 계산
  calculateIntentScore(userInput, previousAnswers = []) {
    const analysis = this.extractIntentSignature(userInput, previousAnswers);
    const { signature, totalFound } = analysis;
    
    let score = 0;
    let details = {};
    
    // 기본 완성도 (70점)
    score += Math.min(70, totalFound * 0.7);
    
    // 보너스 점수 (30점)
    // 구체적 수치 정보 (+10점)
    if (signature.숫자정보.length > 0) {
      score += Math.min(10, signature.숫자정보.length * 3);
      details.숫자보너스 = true;
    }
    
    // 다양한 슬롯 커버 (+10점)
    const filledSlots = Object.values(signature).filter(v => v && Array.isArray(v) && v.length > 0).length;
    score += Math.min(10, filledSlots * 1.5);
    details.다양성보너스 = filledSlots;
    
    // 명확한 제약사항 (+10점)
    if (signature.제약 && signature.제약.length > 0) {
      score += 10;
      details.제약보너스 = true;
    }
    
    // 부정 정보로 감점 (-5점)
    if (signature.부정정보.length > 0) {
      score -= Math.min(5, signature.부정정보.length * 2);
      details.부정감점 = signature.부정정보.length;
    }
    
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));
    
    return {
      score: finalScore,
      signature: signature,
      details: details,
      missingSlots: this.getMissingSlots(signature)
    };
  }

  // 부족한 슬롯 분석
  getMissingSlots(signature) {
    const missing = [];
    const important = ['목표', '대상', '제약', '스타일'];
    
    important.forEach(slot => {
      if (!signature[slot] || !Array.isArray(signature[slot]) || signature[slot].length === 0) {
        missing.push(slot);
      }
    });
    
    return missing;
  }

  // 질문 전략 결정
  getQuestionStrategy(intentScore, missingSlots = []) {
    console.log('질문 전략 결정:', { intentScore, missingSlots });
    
    if (intentScore >= 90) {
      return {
        needMore: false,
        questionCount: 0,
        focus: "완료",
        message: "충분한 정보로 바로 개선하겠습니다!",
        confidence: "높음"
      };
    }
    
    if (intentScore >= 75) {
      return {
        needMore: true,
        questionCount: 3,
        focus: "마지막 디테일",
        message: "거의 완벽합니다. 마지막 몇 가지만 확인하겠습니다.",
        confidence: "높음"
      };
    }
    
    if (intentScore >= 50) {
      return {
        needMore: true,
        questionCount: 5,
        focus: "핵심 정보",
        message: "좋은 시작입니다. 몇 가지 더 구체화해보겠습니다.",
        confidence: "보통"
      };
    }
    
    return {
      needMore: true,
      questionCount: 8,
      focus: "기본 정보",
      message: "더 구체적인 정보가 필요합니다.",
      confidence: "낮음"
    };
  }

  // 질문 우선순위 계산
  calculateQuestionPriority(missingSlots) {
    const priorityMap = {
      목표: 10,    // 가장 중요
      대상: 9,     // 매우 중요  
      제약: 8,     // 중요
      스타일: 7,   // 중요
      용도: 6,     // 보통
      도구: 5,     // 보통
      톤: 4        // 낮음
    };
    
    return missingSlots
      .map(slot => ({ slot, priority: priorityMap[slot] || 1 }))
      .sort((a, b) => b.priority - a.priority);
  }

  // 종합 분석 리포트
  generateAnalysisReport(userInput, previousAnswers = []) {
    const analysis = this.calculateIntentScore(userInput, previousAnswers);
    const strategy = this.getQuestionStrategy(analysis.score, analysis.missingSlots);
    const priorities = this.calculateQuestionPriority(analysis.missingSlots);
    
    return {
      intentScore: analysis.score,
      signature: analysis.signature,
      strategy: strategy,
      priorities: priorities,
      details: analysis.details,
      recommendations: this.generateRecommendations(analysis, strategy)
    };
  }

  // 추천사항 생성
  generateRecommendations(analysis, strategy) {
    const recommendations = [];
    
    if (analysis.score < 50) {
      recommendations.push("기본적인 목적과 대상을 먼저 명확히 해주세요");
    }
    
    if (!analysis.signature.제약 || analysis.signature.제약.length === 0) {
      recommendations.push("크기, 시간, 예산 등 제약사항을 알려주세요");
    }
    
    if (!analysis.signature.스타일 || analysis.signature.스타일.length === 0) {
      recommendations.push("원하는 스타일이나 느낌을 구체적으로 설명해주세요");
    }
    
    if (analysis.signature.숫자정보.length === 0) {
      recommendations.push("구체적인 수치 정보(크기, 시간 등)를 포함해주세요");
    }
    
    return recommendations;
  }
}

// Node.js 환경에서 사용할 수 있도록 export
module.exports = { IntentAnalyzer };
