// utils/mentionExtractor.js - 언급 정보 추출 시스템

class MentionExtractor {
  constructor() {
    // 🔍 패턴 매칭 시스템
    this.patterns = {
      색상: {
        keywords: ["빨간", "파란", "노란", "검은", "흰", "회색", "갈색", "초록", "보라", "분홍", "주황"],
        regex: /(빨간|빨강|파란|파랑|노란|노랑|검은|검정|흰|하얀|회색|갈색|초록|녹색|보라|분홍|주황|금색|은색)/gi
      },
      
      크기: {
        keywords: ["작은", "큰", "중간", "세로", "가로", "정사각형"],
        regex: /(작은|큰|중간|세로|가로|정사각형|(\d+)\s*(px|cm|mm))/gi
      },
      
      스타일: {
        keywords: ["사실적", "3d", "애니메이션", "만화", "일러스트", "수채화"],
        regex: /(사실적|실사|3d|애니메이션|만화|일러스트|수채화|유화|추상적)/gi
      },
      
      해상도: {
        keywords: ["4k", "hd", "고화질", "고품질"],
        regex: /(4k|hd|fhd|uhd|8k|고화질|고품질|(\d+)p)/gi
      },
      
      시간: {
        keywords: ["초", "분", "시간"],
        regex: /(\d+)\s*(초|분|시간)/g
      },
      
      목적: {
        keywords: ["광고", "교육", "홍보", "개인", "상업"],
        regex: /(광고|교육|홍보|개인|상업|비즈니스)/gi
      },
      
      대상: {
        keywords: ["아이", "어른", "학생", "전문가", "일반인"],
        regex: /(아이|어른|학생|전문가|일반인|고객|사용자)/gi
      },
      
      분위기: {
        keywords: ["밝은", "어두운", "따뜻한", "차가운", "부드러운"],
        regex: /(밝은|어두운|따뜻한|차가운|부드러운|강렬한|차분한)/gi
      },
      
      품질: {
        keywords: ["고품질", "전문적", "최고급"],
        regex: /(고품질|고화질|전문적|최고급|프리미엄)/gi
      },
      
      기술: {
        keywords: ["html", "css", "javascript", "react", "python"],
        regex: /(html|css|javascript|react|vue|python|java|node)/gi
      }
    };
  }
  
  // 🔍 메인 추출 함수
  extract(text) {
    try {
      console.log('🔍 언급 정보 추출 시작');
      
      if (Array.isArray(text)) {
        text = text.join(' ');
      }
      
      const extracted = {};
      
      Object.entries(this.patterns).forEach(([category, pattern]) => {
        extracted[category] = this.extractByPattern(text, pattern);
      });
      
      console.log('✅ 추출 완료:', extracted);
      return extracted;
      
    } catch (error) {
      console.error('❌ 추출 오류:', error);
      return {};
    }
  }
  
  // 패턴별 추출
  extractByPattern(text, pattern) {
    const matches = [];
    
    // 키워드 매칭
    if (pattern.keywords) {
      pattern.keywords.forEach(keyword => {
        if (text.toLowerCase().includes(keyword)) {
          matches.push(keyword);
        }
      });
    }
    
    // 정규식 매칭
    if (pattern.regex) {
      const regexMatches = text.match(pattern.regex) || [];
      matches.push(...regexMatches);
    }
    
    // 중복 제거
    return [...new Set(matches)];
  }
  
  // 언급 정보 통계
  getStats(extracted) {
    const stats = {
      totalCategories: Object.keys(extracted).length,
      filledCategories: 0,
      totalMentions: 0,
      mostMentioned: null
    };
    
    let maxMentions = 0;
    
    Object.entries(extracted).forEach(([category, mentions]) => {
      if (mentions && mentions.length > 0) {
        stats.filledCategories++;
        stats.totalMentions += mentions.length;
        
        if (mentions.length > maxMentions) {
          maxMentions = mentions.length;
          stats.mostMentioned = category;
        }
      }
    });
    
    return stats;
  }
}

// ⭐ 핵심: 제대로 export
const mentionExtractor = new MentionExtractor();

module.exports = {
  mentionExtractor,
  MentionExtractor
};

// ES6 방식도 지원
if (typeof module === 'undefined') {
  window.MentionExtractor = MentionExtractor;
  window.mentionExtractor = mentionExtractor;
}
