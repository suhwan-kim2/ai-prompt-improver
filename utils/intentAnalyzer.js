// 📊 utils/intentAnalyzer.js - 의도 파악 95점 시스템

class IntentAnalyzer {
  constructor() {
    // 🎯 7개 카테고리별 의도 분석 (총 95점)
    this.intentCategories = {
      목표명확도: {
        weight: 25,
        maxScore: 25,
        description: "최종 결과물의 목적과 용도가 명확한가?",
        keywords: ["목적", "용도", "목표", "의도", "활용", "사용", "위해", "만들기"]
      },
      대상정보: {
        weight: 20,
        maxScore: 20,
        description: "타겟 사용자나 시청자가 명확한가?",
        keywords: ["대상", "타겟", "사용자", "시청자", "고객", "연령", "나이", "세대"]
      },
      스타일선호: {
        weight: 20,
        maxScore: 20,
        description: "시각적/청각적 스타일 선호도가 명확한가?",
        keywords: ["스타일", "톤", "분위기", "느낌", "컨셉", "테마", "디자인", "색상"]
      },
      기술제약: {
        weight: 15,
        maxScore: 15,
        description: "기술적 요구사항이나 제약사항이 명확한가?",
        keywords: ["해상도", "크기", "길이", "품질", "플랫폼", "기술", "포맷", "사양"]
      },
      콘텐츠구성: {
        weight: 10,
        maxScore: 10,
        description: "내용 구성이나 구조가 고려되었는가?",
        keywords: ["구성", "구조", "순서", "흐름", "단계", "씬", "챕터", "섹션"]
      },
      감정표현: {
        weight: 5,
        maxScore: 5,
        description: "원하는 감정이나 메시지가 있는가?",
        keywords: ["감정", "메시지", "느낌", "인상", "이미지", "브랜딩", "전달", "표현"]
      }
    };
  }

  // 🎯 메인 의도 점수 계산 함수
  calculateIntentScore(userInput, answers = [], domain = "video") {
    console.log('📊 의도 분석 시작:', { userInput, answersCount: answers.length, domain });
    
    const allText = [userInput, ...answers].join(' ').toLowerCase();
    
    // 1단계: 각 카테고리별 점수 계산
    const categoryScores = {};
    let totalScore = 0;
    
    Object.entries(this.intentCategories).forEach(([categoryName, config]) => {
      const categoryScore = this.evaluateCategory(categoryName, config, allText, domain);
      categoryScores[categoryName] = {
        score: categoryScore,
        maxScore: config.maxScore,
        percentage: Math.round((categoryScore / config.maxScore) * 100),
        description: config.description
      };
      totalScore += categoryScore;
    });
    
    // 2단계: 도메인별 보정
    const adjustedScore = this.applyDomainAdjustment(totalScore, domain, allText);
    
    // 3단계: 부족한 영역 식별
    const missingAreas = this.identifyMissingAreas(categoryScores, domain);
    
    const result = {
      totalScore: Math.round(adjustedScore),
      maxScore: 95,
      isComplete: adjustedScore >= 95,
      needsMoreInfo: adjustedScore < 95,
      categoryBreakdown: categoryScores,
      missingAreas: missingAreas,
      recommendations: this.generateRecommendations(missingAreas, domain),
      domain: domain,
      analysisDepth: this.calculateAnalysisDepth(allText)
    };
    
    console.log('📊 의도 분석 완료:', result);
    return result;
  }

  // 📋 카테고리별 점수 평가
  evaluateCategory(categoryName, config, text, domain) {
    const keywords = config.keywords || [];
    let baseScore = 0;
    
    // 1. 키워드 매칭 점수
    const keywordMatches = keywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    ).length;
    const keywordRatio = keywordMatches / keywords.length;
    baseScore += (config.maxScore * 0.6) * keywordRatio;
    
    // 2. 카테고리별 특별 규칙
    const specialScore = this.applySpecialRules(categoryName, text, domain);
    baseScore += specialScore;
    
    // 3. 텍스트 길이 보정 (더 자세한 설명일수록 높은 점수)
    const lengthBonus = Math.min((text.length / 100) * 2, config.maxScore * 0.2);
    baseScore += lengthBonus;
    
    return Math.min(baseScore, config.maxScore);
  }

  // ⚡ 카테고리별 특별 규칙
  applySpecialRules(categoryName, text, domain) {
    const rules = {
      목표명확도: (text) => {
        let score = 0;
        // 구체적인 동작 동사가 있는가?
        if (/(만들|생성|제작|개발|디자인|촬영)/.test(text)) score += 5;
        // 결과물이 명시되어 있는가?
        if (/(영상|이미지|웹사이트|앱|프로그램)/.test(text)) score += 5;
        // 용도가 구체적인가?
        if (/(광고|교육|홍보|설명|판매|브랜딩)/.test(text)) score += 5;
        return score;
      },
      
      대상정보: (text) => {
        let score = 0;
        // 연령대가 구체적인가?
        if (/\d+대/.test(text)) score += 8;
        // 직업이나 특성이 있는가?
        if (/(학생|직장인|주부|전문가|초보자)/.test(text)) score += 6;
        // 성별이 명시되어 있는가?
        if (/(남성|여성|남자|여자)/.test(text)) score += 4;
        return score;
      },
      
      스타일선호: (text) => {
        let score = 0;
        // 시각적 스타일이 구체적인가?
        if (/(실사|애니메이션|3d|일러스트|미니멀|모던)/.test(text)) score += 8;
        // 색상이 언급되었는가?
        if (/(빨간|파란|노란|검은|흰|밝은|어두운)/.test(text)) score += 6;
        // 분위기가 구체적인가?
        if (/(따뜻한|차가운|친근한|전문적|역동적)/.test(text)) score += 6;
        return score;
      },
      
      기술제약: (text) => {
        let score = 0;
        // 구체적인 수치가 있는가?
        if (/\d+\s*(초|분|시간|px|mb|gb)/.test(text)) score += 8;
        // 해상도나 품질이 언급되었는가?
        if (/(4k|hd|고화질|저화질)/.test(text)) score += 5;
        // 플랫폼이 구체적인가?
        if (/(유튜브|인스타|웹|모바일|pc)/.test(text)) score += 5;
        return score;
      },
      
      콘텐츠구성: (text) => {
        let score = 0;
        // 구조적 키워드가 있는가?
        if (/(순서|단계|흐름|구성|나누어|섹션)/.test(text)) score += 5;
        // 시간적 순서가 있는가?
        if (/(먼저|다음|마지막|처음|끝)/.test(text)) score += 3;
        // 분할이나 구분이 언급되었는가?
        if (/(부분|파트|씬|챕터)/.test(text)) score += 2;
        return score;
      },
      
      감정표현: (text) => {
        let score = 0;
        // 감정적 키워드가 있는가?
        if (/(감동|재미|즐거움|신뢰|안정|흥미)/.test(text)) score += 3;
        // 브랜딩 관련 키워드가 있는가?
        if (/(브랜드|이미지|인상|느낌|메시지)/.test(text)) score += 2;
        return score;
      }
    };
    
    const rule = rules[categoryName];
    return rule ? rule(text) : 0;
  }

  // 🔧 도메인별 점수 보정
  applyDomainAdjustment(baseScore, domain, text) {
    const domainMultipliers = {
      video: {
        duration_bonus: (/\d+\s*(초|분)/.test(text)) ? 5 : 0,
        platform_bonus: (/(유튜브|인스타|틱톡)/.test(text)) ? 3 : 0,
        story_bonus: (/(스토리|씬|타임라인)/.test(text)) ? 4 : 0
      },
      image: {
        resolution_bonus: (/(4k|hd|\d+x\d+)/.test(text)) ? 5 : 0,
        style_bonus: (/(실사|애니|일러스트|3d)/.test(text)) ? 4 : 0,
        color_bonus: (/(색상|컬러|톤|팔레트)/.test(text)) ? 3 : 0
      },
      dev: {
        tech_bonus: (/(react|vue|python|java)/.test(text)) ? 5 : 0,
        feature_bonus: (/(기능|로그인|결제|검색)/.test(text)) ? 4 : 0,
        user_bonus: (/(사용자|유저|고객)/.test(text)) ? 3 : 0
      }
    };
    
    const bonuses = domainMultipliers[domain] || {};
    const totalBonus = Object.values(bonuses).reduce((sum, bonus) => sum + bonus, 0);
    
    return Math.min(baseScore + totalBonus, 95);
  }

  // 🔍 부족한 영역 식별
  identifyMissingAreas(categoryScores, domain) {
    const missing = [];
    
    Object.entries(categoryScores).forEach(([category, data]) => {
      if (data.percentage < 70) { // 70% 미만은 부족
        missing.push({
          category,
          currentScore: data.score,
          maxScore: data.maxScore,
          percentage: data.percentage,
          priority: data.percentage < 30 ? 'high' : 'medium',
          description: data.description
        });
      }
    });
    
    // 우선순위별 정렬
    return missing.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // 💡 개선 권장사항 생성
  generateRecommendations(missingAreas, domain) {
    const domainRecommendations = {
      video: {
        목표명확도: "영상의 구체적인 목적(광고, 교육, 홍보 등)을 명시해 주세요.",
        대상정보: "주요 시청자의 연령대나 특성을 구체적으로 알려주세요.",
        스타일선호: "원하는 영상 스타일(실사, 애니메이션 등)을 선택해 주세요.",
        기술제약: "영상 길이, 해상도, 플랫폼 등 기술적 요구사항을 명시해 주세요.",
        콘텐츠구성: "영상의 구성이나 흐름에 대한 아이디어를 공유해 주세요.",
        감정표현: "시청자에게 전달하고 싶은 감정이나 메시지를 알려주세요."
      },
      image: {
        목표명확도: "이미지의 용도(로고, 포스터, 일러스트 등)를 구체적으로 알려주세요.",
        대상정보: "이미지를 보게 될 사람들의 특성을 설명해 주세요.",
        스타일선호: "원하는 이미지 스타일이나 분위기를 구체적으로 묘사해 주세요.",
        기술제약: "필요한 해상도, 크기, 파일 형식 등을 명시해 주세요.",
        콘텐츠구성: "이미지의 구도나 레이아웃에 대한 선호도를 알려주세요.",
        감정표현: "이미지를 통해 표현하고 싶은 감정이나 메시지를 설명해 주세요."
      },
      dev: {
        목표명확도: "개발하려는 프로그램의 목적과 해결하려는 문제를 명확히 해주세요.",
        대상정보: "주요 사용자층과 그들의 특성을 구체적으로 설명해 주세요.",
        스타일선호: "UI/UX 디자인 선호도나 브랜딩 방향을 알려주세요.",
        기술제약: "선호하는 기술 스택이나 성능 요구사항을 명시해 주세요.",
        콘텐츠구성: "프로그램의 주요 기능과 사용자 플로우를 설명해 주세요.",
        감정표현: "사용자에게 주고 싶은 경험이나 브랜드 이미지를 알려주세요."
      }
    };
    
    const recommendations = domainRecommendations[domain] || domainRecommendations.video;
    
    return missingAreas.map(area => ({
      category: area.category,
      priority: area.priority,
      recommendation: recommendations[area.category] || `${area.description}에 대해 더 자세히 알려주세요.`,
      currentPercentage: area.percentage,
      targetImprovement: Math.max(70 - area.percentage, 20)
    }));
  }

  // 📊 분석 깊이 계산
  calculateAnalysisDepth(text) {
    const wordCount = text.split(' ').length;
    const uniqueWords = new Set(text.toLowerCase().split(' ')).size;
    const diversity = uniqueWords / wordCount;
    
    if (wordCount > 100 && diversity > 0.6) return 'deep';
    if (wordCount > 50 && diversity > 0.5) return 'medium';
    return 'shallow';
  }

  // 🎯 질문 우선순위 제안
  suggestQuestionPriorities(missingAreas, domain) {
    const priorities = {
      video: ['목표명확도', '대상정보', '기술제약', '스타일선호'],
      image: ['스타일선호', '목표명확도', '대상정보', '기술제약'],
      dev: ['목표명확도', '기술제약', '대상정보', '콘텐츠구성']
    };
    
    const domainPriorities = priorities[domain] || priorities.video;
    
    return missingAreas
      .sort((a, b) => {
        const aIndex = domainPriorities.indexOf(a.category);
        const bIndex = domainPriorities.indexOf(b.category);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      })
      .slice(0, 5); // 상위 5개만
  }

  // 📈 진행률 계산
  calculateProgress(currentScore, targetScore = 95) {
    return {
      percentage: Math.round((currentScore / targetScore) * 100),
      remaining: Math.max(targetScore - currentScore, 0),
      isComplete: currentScore >= targetScore,
      grade: this.getScoreGrade(currentScore)
    };
  }

  // 🏆 점수 등급 계산
  getScoreGrade(score) {
    if (score >= 95) return 'S';
    if (score >= 85) return 'A';
    if (score >= 75) return 'B';
    if (score >= 65) return 'C';
    if (score >= 55) return 'D';
    return 'F';
  }
}

export { IntentAnalyzer };
