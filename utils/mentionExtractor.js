// 🔍 utils/mentionExtractor.js - 정확한 키워드 추출

class MentionExtractor {
  constructor() {
    // 📋 도메인별 정확한 패턴 매칭
    this.patterns = {
      // 🎬 영상 관련
      duration: {
        regex: /(\d+)\s*(초|분|시간|sec|min|hour)/gi,
        keywords: ['짧게', '길게', '숏폼', '장편', '클립']
      },
      
      platform: {
        regex: /(유튜브|youtube|인스타그램|instagram|틱톡|tiktok|페이스북|facebook|트위터|twitter|링크드인|linkedin)/gi,
        keywords: ['sns', '소셜미디어', '온라인', '웹사이트']
      },
      
      purpose: {
        regex: /(광고|홍보|교육|설명|튜토리얼|브랜딩|마케팅|프로모션)/gi,
        keywords: ['목적', '용도', '목표', '의도']
      },
      
      target_audience: {
        regex: /(\d+)대|(\d+)~(\d+)세|(어린이|청소년|성인|노인|학생|직장인|주부)/gi,
        keywords: ['대상', '타겟', '시청자', '고객', '사용자']
      },
      
      visual_style: {
        regex: /(실사|애니메이션|3d|일러스트|만화|사실적|추상적|모던|클래식|미니멀)/gi,
        keywords: ['스타일', '느낌', '분위기', '컨셉']
      },
      
      // 🎨 이미지 관련
      resolution: {
        regex: /(4k|8k|hd|fhd|uhd|\d+x\d+|\d+p)/gi,
        keywords: ['해상도', '화질', '고화질', '저화질']
      },
      
      aspect_ratio: {
        regex: /(\d+:\d+|세로|가로|정사각형|와이드|포트레이트|랜드스케이프)/gi,
        keywords: ['비율', '크기', '형태']
      },
      
      color_palette: {
        regex: /(빨간|파란|노란|검은|흰|회색|갈색|초록|보라|분홍|주황|금색|은색|무지개|컬러풀|모노톤|파스텔)/gi,
        keywords: ['색상', '컬러', '톤', '색감']
      },
      
      mood: {
        regex: /(밝은|어두운|차분한|신나는|슬픈|웅장한|따뜻한|차가운|부드러운|강렬한|드라마틱|로맨틱)/gi,
        keywords: ['분위기', '느낌', '감정', '톤']
      },
      
      // 💻 개발 관련
      tech_stack: {
        regex: /(react|vue|angular|python|java|javascript|html|css|node|express|django|flask|mysql|mongodb|postgresql)/gi,
        keywords: ['기술', '프레임워크', '언어', '데이터베이스']
      },
      
      project_type: {
        regex: /(웹사이트|모바일앱|데스크톱|api|백엔드|프론트엔드|풀스택)/gi,
        keywords: ['프로젝트', '앱', '시스템', '서비스']
      },
      
      // 🎵 오디오 관련
      audio_elements: {
        regex: /(배경음악|bgm|효과음|내레이션|보이스오버|자막|더빙)/gi,
        keywords: ['음향', '소리', '음성', '오디오']
      },
      
      // 📏 수치 정보
      numbers: {
        regex: /(\d+)\s*(개|장|편|회|번|명|시간|분|초|년|월|일)/g,
        keywords: ['수량', '개수', '횟수']
      },
      
      // 🎯 긴급도/우선순위
      urgency: {
        regex: /(급함|빨리|즉시|천천히|여유|나중에)/gi,
        keywords: ['시급', '마감', '일정']
      },
      
      // 💰 예산 관련
      budget: {
        regex: /(저예산|고예산|무료|유료|프리미엄|비용|가격)/gi,
        keywords: ['예산', '비용', '돈', '가격']
      }
    };
  }

  // 🎯 메인 추출 함수
  extract(text) {
    if (Array.isArray(text)) text = text.join(" ");
    text = (text || "").toLowerCase();
    
    const extractedData = {};
    
    // 각 패턴별로 추출
    Object.entries(this.patterns).forEach(([key, config]) => {
      const matches = this.extractPattern(text, config);
      if (matches.length > 0) {
        extractedData[key] = [...new Set(matches)]; // 중복 제거
      }
    });
    
    // 복합 정보 추출
    const complexInfo = this.extractComplexInfo(text);
    Object.assign(extractedData, complexInfo);
    
    // 컨텍스트 분석
    extractedData.context = this.analyzeContext(text);
    
    console.log('🔍 추출된 정보:', extractedData);
    return extractedData;
  }

  // 📋 패턴별 추출
  extractPattern(text, config) {
    const matches = [];
    
    // 정규식 매칭
    if (config.regex) {
      const regexMatches = text.match(config.regex);
      if (regexMatches) {
        matches.push(...regexMatches);
      }
    }
    
    // 키워드 매칭
    if (config.keywords) {
      config.keywords.forEach(keyword => {
        if (text.includes(keyword.toLowerCase())) {
          matches.push(keyword);
        }
      });
    }
    
    return matches.map(match => match.trim()).filter(match => match.length > 0);
  }

  // 🔄 복합 정보 추출
  extractComplexInfo(text) {
    const complex = {};
    
    // 시간 + 단위 조합
    const timeMatches = text.match(/(\d+)\s*(초|분|시간)/g);
    if (timeMatches) {
      complex.precise_duration = timeMatches;
    }
    
    // 해상도 + 비율 조합  
    const resolutionMatches = text.match(/(\d+x\d+|\d+:\d+|4k|hd)/gi);
    if (resolutionMatches) {
      complex.technical_specs = resolutionMatches;
    }
    
    // 색상 + 톤 조합
    const colorToneMatches = text.match(/(따뜻한|차가운|밝은|어두운)\s*(색|톤|느낌)/gi);
    if (colorToneMatches) {
      complex.color_mood = colorToneMatches;
    }
    
    // 나이 + 대상 조합
    const audienceMatches = text.match(/(\d+)대\s*(남성|여성|학생|직장인)/gi);
    if (audienceMatches) {
      complex.specific_audience = audienceMatches;
    }
    
    return complex;
  }

  // 🧠 컨텍스트 분석
  analyzeContext(text) {
    const context = {
      complexity: 'medium',
      tone: 'neutral', 
      urgency: 'normal',
      experience_level: 'intermediate'
    };
    
    // 복잡도 분석
    if (text.includes('전문적') || text.includes('고급') || text.includes('상세한')) {
      context.complexity = 'high';
    } else if (text.includes('간단') || text.includes('쉬운') || text.includes('기본적')) {
      context.complexity = 'low';
    }
    
    // 톤 분석
    if (text.includes('친근한') || text.includes('편안한') || text.includes('캐주얼')) {
      context.tone = 'casual';
    } else if (text.includes('공식적') || text.includes('비즈니스') || text.includes('전문적')) {
      context.tone = 'formal';
    } else if (text.includes('재밌는') || text.includes('유머') || text.includes('웃긴')) {
      context.tone = 'humorous';
    }
    
    // 긴급도 분석
    if (text.includes('급함') || text.includes('빨리') || text.includes('즉시')) {
      context.urgency = 'high';
    } else if (text.includes('천천히') || text.includes('여유') || text.includes('나중에')) {
      context.urgency = 'low';
    }
    
    // 경험 수준 분석
    if (text.includes('처음') || text.includes('초보') || text.includes('모르겠')) {
      context.experience_level = 'beginner';
    } else if (text.includes('전문가') || text.includes('고급') || text.includes('경험')) {
      context.experience_level = 'expert';
    }
    
    return context;
  }

  // 📊 완성도 평가
  evaluateCompleteness(domain, extractedData) {
    const domainRequirements = {
      video: ['duration', 'platform', 'purpose', 'target_audience', 'visual_style'],
      image: ['resolution', 'aspect_ratio', 'color_palette', 'mood', 'visual_style'],
      dev: ['tech_stack', 'project_type', 'target_audience']
    };
    
    const required = domainRequirements[domain] || domainRequirements.video;
    const filled = required.filter(key => extractedData[key] && extractedData[key].length > 0);
    
    return {
      completeness: Math.round((filled.length / required.length) * 100),
      filled: filled,
      missing: required.filter(key => !filled.includes(key)),
      total: required.length
    };
  }

  // 🔍 특정 정보 존재 여부 체크
  hasInformation(extractedData, category) {
    return extractedData[category] && extractedData[category].length > 0;
  }

  // 📈 키워드 빈도 분석
  analyzeKeywordFrequency(text) {
    const words = text.toLowerCase().split(/\s+/);
    const frequency = {};
    
    words.forEach(word => {
      if (word.length > 2) { // 2글자 이상만
        frequency[word] = (frequency[word] || 0) + 1;
      }
    });
    
    // 빈도순 정렬
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
  }

  // 🚫 질문 스킵 판단
  shouldSkipQuestion(questionKey, extractedData) {
    const skipRules = {
      duration: () => this.hasInformation(extractedData, 'duration') || 
                     this.hasInformation(extractedData, 'precise_duration'),
      platform: () => this.hasInformation(extractedData, 'platform'),
      purpose: () => this.hasInformation(extractedData, 'purpose'),
      target_audience: () => this.hasInformation(extractedData, 'target_audience') || 
                            this.hasInformation(extractedData, 'specific_audience'),
      resolution: () => this.hasInformation(extractedData, 'resolution') || 
                       this.hasInformation(extractedData, 'technical_specs'),
      color_palette: () => this.hasInformation(extractedData, 'color_palette') || 
                          this.hasInformation(extractedData, 'color_mood')
    };
    
    const rule = skipRules[questionKey];
    return rule ? rule() : false;
  }

  // 🎯 도메인별 우선순위 키워드
  getDomainPriorities(domain) {
    const priorities = {
      video: [
        { key: 'duration', weight: 10, description: '영상 길이' },
        { key: 'purpose', weight: 9, description: '영상 목적' },
        { key: 'platform', weight: 8, description: '배포 플랫폼' },
        { key: 'target_audience', weight: 8, description: '타겟 시청자' },
        { key: 'visual_style', weight: 7, description: '시각적 스타일' }
      ],
      image: [
        { key: 'visual_style', weight: 10, description: '이미지 스타일' },
        { key: 'color_palette', weight: 9, description: '색상 팔레트' },
        { key: 'resolution', weight: 8, description: '해상도/크기' },
        { key: 'mood', weight: 7, description: '분위기/감정' },
        { key: 'aspect_ratio', weight: 6, description: '비율/구도' }
      ],
      dev: [
        { key: 'project_type', weight: 10, description: '프로젝트 유형' },
        { key: 'tech_stack', weight: 9, description: '기술 스택' },
        { key: 'target_audience', weight: 8, description: '사용자 대상' },
        { key: 'purpose', weight: 7, description: '프로젝트 목적' }
      ]
    };
    
    return priorities[domain] || priorities.video;
  }

  // 📊 추출 결과 요약
  getSummary(extractedData, domain) {
    const completeness = this.evaluateCompleteness(domain, extractedData);
    const priorities = this.getDomainPriorities(domain);
    const keywordFreq = this.analyzeKeywordFrequency(
      Object.values(extractedData).flat().join(' ')
    );
    
    return {
      completeness,
      priorities,
      topKeywords: keywordFreq,
      context: extractedData.context,
      hasComplexInfo: !!(extractedData.precise_duration || 
                        extractedData.technical_specs || 
                        extractedData.color_mood),
      extractedCategories: Object.keys(extractedData).length
    };
  }
}

export { MentionExtractor };
