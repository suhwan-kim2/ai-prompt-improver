// utils/questionOptimizer.js - 완전 개선된 질문 최적화 시스템

class QuestionOptimizer {
  constructor() {
    this.similarityThreshold = 0.7; // 유사도 임계값
    this.maxQuestions = 8; // 기본 최대 질문 수
  }
  
  // =============================================================================
  // 🎯 메인 최적화 함수 (API에서 호출)
  // =============================================================================
  optimize(questions, mentionedInfo = {}, domainInfo = {}, maxCount = 8) {
    console.log('🔧 QuestionOptimizer: 최적화 시작', { 
      questionsCount: questions?.length, 
      maxCount,
      domain: domainInfo.primary 
    });
    
    try {
      // ✅ 입력 검증
      if (!Array.isArray(questions) || questions.length === 0) {
        console.log('⚠️ 유효하지 않은 질문 배열');
        return [];
      }
      
      // ✅ 1. 질문 형태 통일 (객체/문자열 혼재 처리)
      const normalizedQuestions = this.normalizeQuestionFormat(questions);
      
      // ✅ 2. 기본 유효성 검증
      const validQuestions = this.validateQuestions(normalizedQuestions);
      
      // ✅ 3. 중복 제거
      const uniqueQuestions = this.removeDuplicates(validQuestions);
      
      // ✅ 4. 이미 언급된 정보 기반 필터링
      const filteredQuestions = this.filterMentioned(uniqueQuestions, mentionedInfo);
      
      // ✅ 5. 우선순위 계산 및 정렬
      const prioritizedQuestions = this.prioritize(filteredQuestions, domainInfo, mentionedInfo);
      
      // ✅ 6. 최종 개수 조정
      const finalQuestions = this.adjustCount(prioritizedQuestions, maxCount);
      
      console.log(`✅ 최적화 완료: ${questions.length} → ${finalQuestions.length}개`);
      return finalQuestions;
      
    } catch (error) {
      console.error('❌ 질문 최적화 오류:', error);
      // 안전한 폴백: 원본 질문 중 일부만 반환
      return this.safeFallback(questions, maxCount);
    }
  }
  
  // =============================================================================
  // 🛠️ 최적화 단계별 함수들
  // =============================================================================
  
  // 1. 질문 형태 통일
  normalizeQuestionFormat(questions) {
    return questions.map(q => {
      // 객체 형태인 경우
      if (typeof q === 'object' && q !== null) {
        return {
          question: q.question || q.text || '',
          options: q.options || ["네", "아니오", "모르겠음", "기타"],
          type: q.type || 'enum',
          slotKey: q.slotKey || null
        };
      }
      
      // 문자열인 경우
      if (typeof q === 'string') {
        return {
          question: q,
          options: ["네", "아니오", "모르겠음", "기타"],
          type: 'enum',
          slotKey: null
        };
      }
      
      return null;
    }).filter(q => q !== null && q.question);
  }
  
  // 2. 기본 유효성 검증
  validateQuestions(questions) {
    return questions.filter(q => {
      if (!q.question || typeof q.question !== 'string') return false;
      if (q.question.trim().length < 5) return false; // 너무 짧음
      if (q.question.trim().length > 200) return false; // 너무 김
      
      // 질문 형태 체크
      const isQuestion = q.question.includes('?') || 
                        q.question.endsWith('요') || 
                        q.question.endsWith('까요') ||
                        q.question.endsWith('나요');
      
      return isQuestion;
    });
  }
  
  // 3. 중복 질문 제거
  removeDuplicates(questions) {
    const unique = [];
    const processed = new Set();
    
    questions.forEach(q => {
      const normalized = this.normalizeQuestionText(q.question);
      
      // 이미 처리된 질문과 유사도 체크
      let isDuplicate = false;
      for (const existing of processed) {
        if (this.calculateSimilarity(normalized, existing) > this.similarityThreshold) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        unique.push(q);
        processed.add(normalized);
      }
    });
    
    return unique;
  }
  
  // 질문 텍스트 정규화
  normalizeQuestionText(question) {
    return question
      .toLowerCase()
      .replace(/[?!.,]/g, '') // 구두점 제거
      .replace(/\s+/g, ' ') // 공백 정리
      .trim();
  }
  
  // 유사도 계산 (자카드 유사도)
  calculateSimilarity(str1, str2) {
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  // 4. 언급된 정보 기반 필터링
  filterMentioned(questions, mentionedInfo) {
    const keywordMap = {
      색상: ['색상', '색깔', '컬러', '색'],
      크기: ['크기', '사이즈', '규모', '비율'],
      스타일: ['스타일', '방식', '느낌', '타입'],
      해상도: ['해상도', '품질', '화질', '퀄리티'],
      시간: ['시간', '길이', '기간', '분량'],
      목적: ['목적', '용도', '목표', '이유'],
      대상: ['대상', '사용자', '타겟', '고객'],
      분위기: ['분위기', '느낌', '톤', '무드']
    };
    
    return questions.filter(q => {
      const questionLower = q.question.toLowerCase();
      
      // 언급된 정보와 관련된 질문인지 체크
      for (const [mentionedKey, mentionedValues] of Object.entries(mentionedInfo)) {
        if (Array.isArray(mentionedValues) && mentionedValues.length > 0) {
          const relatedKeywords = keywordMap[mentionedKey] || [mentionedKey];
          
          // 질문이 이미 언급된 정보에 대한 것인지 확인
          const isRelated = relatedKeywords.some(keyword => 
            questionLower.includes(keyword)
          );
          
          if (isRelated) {
            console.log(`질문 필터링 (이미 언급됨): ${q.question}`);
            return false;
          }
        }
      }
      
      return true;
    });
  }
  
  // 5. 우선순위 계산 및 정렬
  prioritize(questions, domainInfo, mentionedInfo) {
    const domain = domainInfo.primary || 'general';
    
    // 도메인별 키워드 가중치
    const priorityWeights = {
      visual_design: {
        '스타일': 10, '색상': 9, '표정': 8, '포즈': 8, '조명': 7,
        '배경': 6, '의상': 6, '크기': 5, '각도': 4, '품질': 7
      },
      video: {
        '목적': 10, '길이': 9, '스타일': 8, '오프닝': 7, '전환': 6,
        '음악': 6, '해상도': 5, '자막': 4, '색보정': 3
      },
      development: {
        '기능': 10, '기술': 9, '플랫폼': 8, '사용자': 7, '보안': 6,
        '성능': 5, '디자인': 4, '데이터베이스': 3
      },
      text_language: {
        '목적': 10, '대상': 9, '톤': 8, '분량': 7, '형식': 6,
        '구조': 5, '키워드': 4, '마감': 3
      },
      business: {
        '목표': 10, '대상': 9, '예산': 8, '기간': 7, '경쟁': 6
