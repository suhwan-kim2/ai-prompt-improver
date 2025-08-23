// utils/questionOptimizer.js - 질문 최적화 시스템 (Node.js 호환 버전)

class QuestionOptimizer {
  constructor() {
    this.similarityThreshold = 0.7; // 유사도 임계값
    this.maxQuestions = 8; // 기본 최대 질문 수
  }
  
  // 질문 최적화 메인 함수
  optimize(questions, mentionedInfo = {}, domainInfo = {}, maxCount = 8) {
    console.log('질문 최적화 시작:', { questions, mentionedInfo, domainInfo });
    
    try {
      // 1. 유효성 검증
      const validQuestions = this.validateQuestions(questions);
      
      // 2. 중복 제거
      const uniqueQuestions = this.removeDuplicates(validQuestions);
      
      // 3. 언급된 정보 기반 필터링
      const filteredQuestions = this.filterMentioned(uniqueQuestions, mentionedInfo);
      
      // 4. 우선순위 계산 및 정렬
      const prioritizedQuestions = this.prioritize(filteredQuestions, domainInfo, mentionedInfo);
      
      // 5. 최종 개수 조정
      const finalQuestions = this.adjustCount(prioritizedQuestions, maxCount);
      
      console.log('질문 최적화 완료:', finalQuestions);
      return finalQuestions;
    } catch (error) {
      console.error('질문 최적화 중 오류:', error);
      // 안전한 폴백: 원본 질문 중 일부만 반환
      return Array.isArray(questions) ? questions.slice(0, maxCount) : [];
    }
  }
  
  // 1. 질문 유효성 검증
  validateQuestions(questions) {
    if (!Array.isArray(questions)) {
      console.log('질문이 배열이 아님, 빈 배열 반환');
      return [];
    }
    
    return questions.filter(question => {
      if (!question || typeof question !== 'string') return false;
      if (question.trim().length < 5) return false; // 너무 짧은 질문 제외
      if (question.trim().length > 200) return false; // 너무 긴 질문 제외
      if (!question.includes('?') && !question.endsWith('요') && !question.endsWith('까요')) {
        return false; // 질문 형태가 아닌 것 제외
      }
      return true;
    }).map(q => q.trim());
  }
  
  // 2. 중복 질문 제거
  removeDuplicates(questions) {
    const unique = [];
    const processed = new Set();
    
    questions.forEach(question => {
      const normalized = this.normalizeQuestion(question);
      
      // 이미 처리된 질문과 유사도 체크
      let isDuplicate = false;
      for (const existing of processed) {
        if (this.calculateSimilarity(normalized, existing) > this.similarityThreshold) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        unique.push(question);
        processed.add(normalized);
      }
    });
    
    return unique;
  }
  
  // 질문 정규화
  normalizeQuestion(question) {
    return question
      .toLowerCase()
      .replace(/[?!.,]/g, '') // 구두점 제거
      .replace(/\s+/g, ' ') // 공백 정리
      .trim();
  }
  
  // 유사도 계산
  calculateSimilarity(str1, str2) {
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  // 3. 언급된 정보 기반 필터링
  filterMentioned(questions, mentionedInfo) {
    const keywordMap = {
      색상: ['색상', '색깔', '컬러', '색'],
      크기: ['크기', '사이즈', '규모', '비율'],
      스타일: ['스타일', '방식', '느낌', '타입'],
      해상도: ['해상도', '품질', '화질', '퀄리티'],
      시간: ['시간', '길이', '기간', '분량'],
      목적: ['목적', '용도', '목표', '이유'],
      대상: ['대상', '사용자', '타겟', '고객']
    };
    
    return questions.filter(question => {
      const questionLower = question.toLowerCase();
      
      // 언급된 정보와 관련된 질문인지 체크
      for (const [mentionedKey, mentionedValues] of Object.entries(mentionedInfo)) {
        if (Array.isArray(mentionedValues) && mentionedValues.length > 0) {
          const relatedKeywords = keywordMap[mentionedKey] || [mentionedKey];
          
          // 질문이 이미 언급된 정보에 대한 것인지 확인
          const isRelated = relatedKeywords.some(keyword => 
            questionLower.includes(keyword)
          );
          
          if (isRelated) {
            console.log(`질문 제외 (이미 언급됨): ${question}`);
            return false;
          }
        }
      }
      
      return true;
    });
  }
  
  // 4. 우선순위 계산 및 정렬
  prioritize(questions, domainInfo, mentionedInfo) {
    const priorityWeights = {
      visual_design: {
        '스타일': 10, '색상': 8, '크기': 7, '해상도': 6, '배경': 5,
        '조명': 4, '각도': 3, '분위기': 6, '품질': 7
      },
      video: {
        '목적': 10, '길이': 9, '스타일': 8, '해상도': 7, '음악': 6,
        '자막': 4, '편집': 5, '색보정': 3
      },
      development: {
        '기능': 10, '기술': 9, '플랫폼': 8, '대상': 7, '데이터': 6,
        '보안': 5, '성능': 4, '디자인': 3
      },
      text_language: {
        '목적': 10, '대상': 9, '분량': 8, '톤': 7, '형식': 6,
        '구조': 5, '키워드': 4, '마감': 3
      },
      business: {
        '목표': 10, '대상': 9, '예산': 8, '기간': 7, '경쟁': 6,
        '차별화': 5, '위험': 4, '방법': 3
      }
    };
    
    const domain = domainInfo.primary || 'general';
    const weights = priorityWeights[domain] || {};
    
    const scoredQuestions = questions.map(question => {
      let score = 5; // 기본 점수
      
      // 도메인 가중치 적용
      Object.entries(weights).forEach(([keyword, weight]) => {
        if (question.toLowerCase().includes(keyword)) {
          score += weight;
        }
      });
      
      // 엔트로피 계산 (불확실성이 높을수록 우선순위 높음)
      score += this.calculateEntropy(question, mentionedInfo);
      
      // 질문의 구체성 점수
      score += this.calculateSpecificity(question);
      
      return { question, score };
    });
    
    // 점수 순으로 정렬
    return scoredQuestions
      .sort((a, b) => b.score - a.score)
      .map(item => item.question);
  }
  
  // 엔트로피 계산 (정보 이론 기반)
  calculateEntropy(question, mentionedInfo) {
    let entropy = 5; // 기본 엔트로피
    
    try {
      // 이미 알려진 정보와 관련될수록 엔트로피 감소
      const questionWords = question.toLowerCase().split(' ');
      const mentionedWords = Object.keys(mentionedInfo).join(' ').toLowerCase().split(' ');
      
      const overlap = questionWords.filter(word => mentionedWords.includes(word)).length;
      entropy -= overlap * 2;
      
      // 구체적인 선택지가 있는 질문일수록 엔트로피 감소
      if (question.includes('아니면') || question.includes('또는')) entropy -= 1;
      
      return Math.max(0, entropy);
    } catch (error) {
      console.error('엔트로피 계산 오류:', error);
      return 5; // 안전한 기본값
    }
  }
  
  // 질문의 구체성 계산
  calculateSpecificity(question) {
    let specificity = 0;
    
    try {
      // 구체적인 단어 포함시 +
      const specificWords = ['정확히', '구체적으로', '어떤', '몇', '어느'];
      specificWords.forEach(word => {
        if (question.includes(word)) specificity += 1;
      });
      
      // 모호한 단어 포함시 -
      const vagueWords = ['적당히', '알아서', '대충', '좀'];
      vagueWords.forEach(word => {
        if (question.includes(word)) specificity -= 2;
      });
      
      // 선택지 제공시 +
      if (question.includes('(') && question.includes(')')) specificity += 2;
      
      return specificity;
    } catch (error) {
      console.error('구체성 계산 오류:', error);
      return 0;
    }
  }
  
  // 5. 최종 개수 조정
  adjustCount(questions, maxCount) {
    if (questions.length <= maxCount) {
      return questions;
    }
    
    // 상위 우선순위 질문들만 선택
    return questions.slice(0, maxCount);
  }
  
  // 질문 품질 검증
  validateQuality(questions) {
    const qualityChecks = {
      diversity: this.checkDiversity(questions),
      clarity: this.checkClarity(questions),
      relevance: this.checkRelevance(questions)
    };
    
    const scores = Object.values(qualityChecks);
    const overallQuality = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    return {
      quality: overallQuality,
      details: qualityChecks,
      isGood: overallQuality > 0.7
    };
  }
  
  // 다양성 체크
  checkDiversity(questions) {
    try {
      const questionTypes = questions.map(q => this.classifyQuestionType(q));
      const uniqueTypes = new Set(questionTypes);
      return uniqueTypes.size / Math.max(questionTypes.length, 1);
    } catch (error) {
      console.error('다양성 체크 오류:', error);
      return 0.5;
    }
  }
  
  // 질문 타입 분류
  classifyQuestionType(question) {
    const qLower = question.toLowerCase();
    
    if (qLower.includes('어떤') || qLower.includes('무엇')) return 'what';
    if (qLower.includes('언제') || qLower.includes('시간')) return 'when';
    if (qLower.includes('어디') || qLower.includes('위치')) return 'where';
    if (qLower.includes('누구') || qLower.includes('대상')) return 'who';
    if (qLower.includes('왜') || qLower.includes('이유')) return 'why';
    if (qLower.includes('어떻게') || qLower.includes('방법')) return 'how';
    if (qLower.includes('얼마나') || qLower.includes('정도')) return 'degree';
    
    return 'general';
  }
  
  // 명확성 체크
  checkClarity(questions) {
    try {
      const clarityScores = questions.map(q => {
        let score = 0.5;
        
        // 명확한 구조
        if (q.includes('?') || q.endsWith('요') || q.endsWith('까요')) score += 0.3;
        
        // 구체적 단어
        if (q.match(/(어떤|무엇|언제|어디|얼마나)/)) score += 0.2;
        
        // 너무 길거나 복잡한 문장
        if (q.length > 50) score -= 0.2;
        
        return Math.max(0, Math.min(1, score));
      });
      
      return clarityScores.reduce((sum, score) => sum + score, 0) / Math.max(clarityScores.length, 1);
    } catch (error) {
      console.error('명확성 체크 오류:', error);
      return 0.5;
    }
  }
  
  // 관련성 체크
  checkRelevance(questions) {
    try {
      // 모든 질문이 실제로 답변 가능한지 체크
      const relevantCount = questions.filter(q => {
        const qLower = q.toLowerCase();
        
        // 답변하기 어려운 질문들 제외
        const difficultPatterns = [
          /완벽한|최고의|절대적/,
          /모든|전체|다/,
          /반드시|무조건/
        ];
        
        return !difficultPatterns.some(pattern => qLower.match(pattern));
      }).length;
      
      return relevantCount / Math.max(questions.length, 1);
    } catch (error) {
      console.error('관련성 체크 오류:', error);
      return 0.5;
    }
  }
}

// Node.js 환경에서 사용할 수 있도록 export
module.exports = { QuestionOptimizer };
