// utils/mentionExtractor.js - 사용자 언급 정보 추출 (Node.js 호환 버전)

class MentionExtractor {
  constructor() {
    this.patterns = {
      색상: {
        keywords: ["빨간", "빨강", "파란", "파랑", "노란", "노랑", "검은", "검정", "흰", "하얀", "회색", "갈색", "초록", "녹색", "보라", "분홍", "주황", "금색", "은색", "투명"],
        regex: /(빨간|빨강|파란|파랑|노란|노랑|검은|검정|흰|하얀|회색|갈색|초록|녹색|보라|분홍|주황|금색|은색|투명|#[0-9A-F]{6})/gi
      },
      
      스타일: {
        keywords: ["3d", "애니메이션", "실사", "만화", "일러스트", "수채화", "유화", "사실적", "추상적", "미니멀"],
        regex: /(3d|애니메이션|실사|만화|일러스트|수채화|유화|사실적|추상적|미니멀|포토샵|블렌더)/gi
      },
      
      크기: {
        keywords: ["작은", "큰", "중간", "세로", "가로", "정사각형"],
        regex: /(작은|큰|중간|세로|가로|정사각형|(\d+)\s*(px|cm|mm|인치))/gi,
        numbers: /(\d+)\s*(px|cm|mm|인치|x|X)/g
      },
      
      해상도: {
        keywords: ["4k", "hd", "fhd", "uhd", "8k"],
        regex: /(4k|hd|fhd|uhd|8k|(\d+)p|(\d+)x(\d+))/gi
      },
      
      시간: {
        keywords: ["초", "분", "시간"],
        regex: /(\d+)\s*(초|분|시간)/g
      },
      
      목적: {
        keywords: ["광고", "교육", "홍보", "설명", "튜토리얼", "가이드"],
        regex: /(광고|교육|홍보|설명|튜토리얼|가이드|소개|안내)/gi
      },
      
      대상: {
        keywords: ["아이", "어른", "학생", "전문가", "일반인", "고객"],
        regex: /(아이|어른|학생|전문가|일반인|고객|유저|사용자)/gi
      },
      
      분위기: {
        keywords: ["밝은", "어두운", "차분한", "신나는", "슬픈", "웅장한", "따뜻한", "차가운"],
        regex: /(밝은|어두운|차분한|신나는|슬픈|웅장한|따뜻한|차가운|부드러운|강렬한)/gi
      },
      
      품질: {
        keywords: ["고품질", "고화질", "프리미엄", "전문적"],
        regex: /(고품질|고화질|프리미엄|전문적|퀄리티|품질)/gi
      },
      
      기술: {
        keywords: ["react", "vue", "python", "javascript", "html", "css"],
        regex: /(react|vue|angular|python|javascript|java|html|css|node|express|mongodb)/gi
      },
      
      플랫폼: {
        keywords: ["웹", "모바일", "앱", "pc", "맥", "윈도우"],
        regex: /(웹|모바일|앱|pc|맥|윈도우|안드로이드|아이폰|ios)/gi
      },
      
      수량: {
        keywords: ["개", "장", "편"],
        regex: /(\d+)\s*(개|장|편|권|부|점)/g
      }
    };
  }
  
  // 사용자 입력에서 정보 추출
  extract(userInput) {
    try {
      const mentioned = {};
      const input = userInput.toLowerCase();
      
      // 각 패턴별로 정보 추출
      Object.entries(this.patterns).forEach(([category, pattern]) => {
        const matches = this.extractCategory(input, pattern);
        if (matches.length > 0) {
          mentioned[category] = matches;
        }
      });
      
      // 복합 정보 추출
      const complexInfo = this.extractComplexInfo(input);
      if (Object.keys(complexInfo).length > 0) {
        mentioned.복합정보 = complexInfo;
      }
      
      // 컨텍스트 분석
      mentioned.컨텍스트 = this.analyzeContext(input);
      
      return mentioned;
    } catch (error) {
      console.error('정보 추출 중 오류:', error);
      return { 컨텍스트: { 복잡도: 0.5, 명확도: 0.5, 완성도: 0.3, 긴급도: 0.5 } };
    }
  }
  
  // 카테고리별 정보 추출
  extractCategory(input, pattern) {
    try {
      const matches = new Set();
      
      // 정규식 매칭
      if (pattern.regex) {
        const regexMatches = input.match(pattern.regex);
        if (regexMatches) {
          regexMatches.forEach(match => matches.add(match.toLowerCase()));
        }
      }
      
      // 숫자 패턴 매칭 (Node.js 호환성을 위해 while 루프 사용)
      if (pattern.numbers) {
        let match;
        const regex = new RegExp(pattern.numbers.source, pattern.numbers.flags);
        while ((match = regex.exec(input)) !== null) {
          matches.add(match[0]);
        }
      }
      
      // 키워드 매칭
      if (pattern.keywords && Array.isArray(pattern.keywords)) {
        pattern.keywords.forEach(keyword => {
          if (input.includes(keyword.toLowerCase())) {
            matches.add(keyword);
          }
        });
      }
      
      return Array.from(matches);
    } catch (error) {
      console.error(`카테고리 추출 오류 (${JSON.stringify(pattern)}):`, error);
      return [];
    }
  }
  
  // 복합 정보 추출 (여러 카테고리 결합)
  extractComplexInfo(input) {
    try {
      const complexInfo = {};
      
      // 크기 + 해상도 조합
      const sizeMatch = input.match(/(\d+)\s*x\s*(\d+)/);
      if (sizeMatch) {
        complexInfo.해상도 = `${sizeMatch[1]}x${sizeMatch[2]}`;
      }
      
      // 시간 + 길이 조합
      const durationMatch = input.match(/(\d+)\s*(초|분)\s*(길이|동안)/);
      if (durationMatch) {
        complexInfo.길이 = `${durationMatch[1]}${durationMatch[2]}`;
      }
      
      // 색상 + 스타일 조합
      const colorStyleMatch = input.match(/(빨간|파란|노란|검은|흰|회색)\s*(3d|애니메이션|실사)/);
      if (colorStyleMatch) {
        complexInfo.색상스타일 = `${colorStyleMatch[1]} ${colorStyleMatch[2]}`;
      }
      
      // 용도 + 대상 조합
      const purposeTargetMatch = input.match(/(아이|어른|학생|전문가)\s*(용|위한|대상)/);
      if (purposeTargetMatch) {
        complexInfo.대상용도 = `${purposeTargetMatch[1]}용`;
      }
      
      return complexInfo;
    } catch (error) {
      console.error('복합 정보 추출 오류:', error);
      return {};
    }
  }
  
  // 컨텍스트 분석
  analyzeContext(input) {
    try {
      const context = {
        복잡도: this.calculateComplexity(input),
        명확도: this.calculateClarity(input),
        완성도: this.calculateCompleteness(input),
        긴급도: this.calculateUrgency(input)
      };
      
      return context;
    } catch (error) {
      console.error('컨텍스트 분석 오류:', error);
      return { 복잡도: 0.5, 명확도: 0.5, 완성도: 0.3, 긴급도: 0.5 };
    }
  }
  
  // 복잡도 계산
  calculateComplexity(input) {
    try {
      const words = input.split(/\s+/).length;
      const sentences = input.split(/[.!?]/).filter(s => s.trim().length > 0).length;
      const specialChars = (input.match(/[,;:()]/g) || []).length;
      
      let complexity = 0;
      if (words > 20) complexity += 0.3;
      if (sentences > 3) complexity += 0.2;
      if (specialChars > 5) complexity += 0.2;
      
      const technicalTerms = (input.match(/(api|데이터베이스|알고리즘|프레임워크|라이브러리)/gi) || []).length;
      complexity += technicalTerms * 0.1;
      
      return Math.min(1, complexity);
    } catch (error) {
      console.error('복잡도 계산 오류:', error);
      return 0.5;
    }
  }
  
  // 명확도 계산
  calculateClarity(input) {
    try {
      let clarity = 0.5; // 기본값
      
      // 구체적 수치 포함시 +
      const numbers = (input.match(/\d+/g) || []).length;
      clarity += Math.min(0.3, numbers * 0.1);
      
      // 명확한 지시어 포함시 +
      if (input.match(/(정확히|구체적으로|반드시|꼭)/)) clarity += 0.2;
      
      // 모호한 표현 포함시 -
      if (input.match(/(대충|적당히|알아서|좀)/)) clarity -= 0.3;
      
      return Math.max(0, Math.min(1, clarity));
    } catch (error) {
      console.error('명확도 계산 오류:', error);
      return 0.5;
    }
  }
  
  // 완성도 계산
  calculateCompleteness(input) {
    try {
      let completeness = 0.3; // 기본값
      
      // 5W1H 요소 체크
      const elements = {
        what: /(무엇|뭘|어떤)/,
        when: /(언제|시간|기간)/,
        where: /(어디|장소|위치)/,
        who: /(누구|대상|사용자)/,
        why: /(왜|목적|이유)/,
        how: /(어떻게|방법|방식)/
      };
      
      Object.values(elements).forEach(pattern => {
        if (input.match(pattern)) completeness += 0.1;
      });
      
      // 도메인별 필수 요소 체크
      const domainElements = [
        /(스타일|색상|크기|해상도)/, // 비주얼
        /(기능|기술|플랫폼)/, // 개발
        /(길이|형식|톤)/, // 텍스트
        /(목적|대상|예산)/ // 비즈니스
      ];
      
      domainElements.forEach(pattern => {
        if (input.match(pattern)) completeness += 0.05;
      });
      
      return Math.min(1, completeness);
    } catch (error) {
      console.error('완성도 계산 오류:', error);
      return 0.3;
    }
  }
  
  // 긴급도 계산
  calculateUrgency(input) {
    try {
      let urgency = 0.5; // 기본값
      
      // 긴급 키워드
      if (input.match(/(급해|빨리|즉시|오늘|내일)/)) urgency += 0.3;
      if (input.match(/(여유|천천히|나중에)/)) urgency -= 0.2;
      
      return Math.max(0, Math.min(1, urgency));
    } catch (error) {
      console.error('긴급도 계산 오류:', error);
      return 0.5;
    }
  }
  
  // 언급된 정보를 질문에서 제외할지 판단
  shouldSkipQuestion(questionKey, mentionedInfo) {
    try {
      // 직접적으로 언급된 경우
      if (mentionedInfo[questionKey]) return true;
      
      // 유사한 정보가 언급된 경우
      const synonyms = {
        색상: ['색깔', '컬러'],
        스타일: ['느낌', '방식', '타입'],
        크기: ['사이즈', '규모'],
        목적: ['용도', '목표'],
        대상: ['타겟', '사용자']
      };
      
      if (synonyms[questionKey]) {
        return synonyms[questionKey].some(synonym => mentionedInfo[synonym]);
      }
      
      return false;
    } catch (error) {
      console.error('질문 스킵 판단 오류:', error);
      return false;
    }
  }
  
  // 언급 정보를 자연어로 변환
  formatMentioned(mentionedInfo) {
    try {
      const formatted = [];
      
      Object.entries(mentionedInfo).forEach(([category, values]) => {
        if (Array.isArray(values) && values.length > 0) {
          formatted.push(`${category}: ${values.join(', ')}`);
        } else if (typeof values === 'object' && values && Object.keys(values).length > 0) {
          const subItems = Object.entries(values).map(([k, v]) => `${k}=${v}`);
          formatted.push(`${category}: ${subItems.join(', ')}`);
        }
      });
      
      return formatted.join(' | ');
    } catch (error) {
      console.error('언급 정보 포매팅 오류:', error);
      return '';
    }
  }
  
  // 언급 정보의 완성도 평가
  evaluateCompleteness(mentionedInfo, targetDomain) {
    try {
      const domainRequirements = {
        visual_design: ['주제', '스타일'],
        video: ['목적', '길이'],
        development: ['프로젝트유형', '주요기능'],
        text_language: ['목적', '대상독자'],
        business: ['사업분야', '목표'],
        music_audio: ['장르', '분위기']
      };
      
      const required = domainRequirements[targetDomain] || ['목적'];
      const mentioned = Object.keys(mentionedInfo || {});
      
      if (required.length === 0) return 1;
      
      const coverage = required.filter(req => 
        mentioned.some(m => m.includes(req) || req.includes(m))
      ).length;
      
      return coverage / required.length;
    } catch (error) {
      console.error('완성도 평가 오류:', error);
      return 0.5;
    }
  }
  
  // 추가 유틸리티: 키워드 빈도 분석
  analyzeKeywordFrequency(input) {
    try {
      const words = input.toLowerCase()
        .replace(/[^\w\s가-힣]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1);
      
      const frequency = {};
      words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1;
      });
      
      return Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .reduce((obj, [word, count]) => {
          obj[word] = count;
          return obj;
        }, {});
    } catch (error) {
      console.error('키워드 빈도 분석 오류:', error);
      return {};
    }
  }
}

// Node.js 환경에서 사용할 수 있도록 export
module.exports = { MentionExtractor };
