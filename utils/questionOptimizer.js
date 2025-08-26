// utils/questionOptimizer.js - 질문 최적화 시스템

class QuestionOptimizer {
  constructor() {
    console.log('🔧 질문 최적화 시스템 초기화');
  }
  
  // 🎯 메인 최적화 함수
  optimize(questions, mentionedInfo = {}, domainInfo = {}, maxCount = 8) {
    try {
      console.log(`🔧 질문 최적화 시작: ${questions.length}개 → 최대 ${maxCount}개`);
      
      if (!questions || questions.length === 0) {
        return this.generateFallbackQuestions();
      }
      
      // 1. 중복 제거
      const uniqueQuestions = this.removeDuplicates(questions);
      
      // 2. 우선순위 정렬
      const prioritizedQuestions = this.prioritize(uniqueQuestions, mentionedInfo, domainInfo);
      
      // 3. 개수 조정
      const finalQuestions = this.adjustCount(prioritizedQuestions, maxCount);
      
      console.log(`✅ 최적화 완료: ${finalQuestions.length}개 질문`);
      return finalQuestions;
      
    } catch (error) {
      console.error('❌ 질문 최적화 오류:', error);
      return this.generateFallbackQuestions();
    }
  }
  
  // 중복 제거
  removeDuplicates(questions) {
    const seen = new Set();
    return questions.filter(q => {
      const key = q.question ? q.question.substring(0, 20) : JSON.stringify(q).substring(0, 20);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  // 우선순위 정렬
  prioritize(questions, mentionedInfo, domainInfo) {
    return questions.map(q => {
      let priority = 5; // 기본 우선순위
      
      if (q.question) {
        const questionText = q.question.toLowerCase();
        
        // 구체적 질문 우선 (+3점)
        if (questionText.includes('구체적') || questionText.includes('세부')) {
          priority += 3;
        }
        
        // 필수 정보 질문 우선 (+2점)
        if (questionText.includes('스타일') || questionText.includes('크기') || questionText.includes('목적')) {
          priority += 2;
        }
        
        // 이미 언급된 정보면 우선순위 낮춤 (-2점)
        Object.values(mentionedInfo).forEach(mentions => {
          if (Array.isArray(mentions) && mentions.length > 0) {
            mentions.forEach(mention => {
              if (questionText.includes(mention.toLowerCase())) {
                priority -= 2;
              }
            });
          }
        });
      }
      
      return { ...q, priority };
    }).sort((a, b) => b.priority - a.priority);
  }
  
  // 개수 조정
  adjustCount(questions, maxCount) {
    return questions.slice(0, maxCount);
  }
  
  // 폴백 질문들
  generateFallbackQuestions() {
    return [
      {
        question: "더 구체적으로 어떤 특징을 원하시나요?",
        options: ["매우 상세하게", "적당한 수준", "간단하게", "상관없음", "기타"]
      },
      {
        question: "완성도나 품질 수준은?",
        options: ["최고급", "전문가급", "일반적", "빠른 제작", "기타"]
      },
      {
        question: "주요 용도나 목적이 있나요?",
        options: ["개인 사용", "업무/비즈니스", "교육/학습", "취미/재미", "기타"]
      }
    ];
  }
}

// ⭐ 핵심: 제대로 export
const questionOptimizer = new QuestionOptimizer();

module.exports = {
  questionOptimizer,
  QuestionOptimizer
};

// ES6 방식도 지원
if (typeof module === 'undefined') {
  window.QuestionOptimizer = QuestionOptimizer;
  window.questionOptimizer = questionOptimizer;
}
