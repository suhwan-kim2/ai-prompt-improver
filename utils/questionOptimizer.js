// utils/questionOptimizer.js - 질문 최적화 시스템

/**
 * 질문 최적화: 중복 제거, 우선순위 계산, 개수 조절
 */

/**
 * 질문 유사도 계산
 */
export function calculateQuestionSimilarity(question1, question2) {
  const q1_keywords = extractQuestionKeywords(question1.question);
  const q2_keywords = extractQuestionKeywords(question2.question);
  
  if (q1_keywords.length === 0 || q2_keywords.length === 0) {
    return 0;
  }
  
  const commonKeywords = q1_keywords.filter(k => q2_keywords.includes(k));
  const totalKeywords = [...new Set([...q1_keywords, ...q2_keywords])].length;
  
  const similarity = commonKeywords.length / Math.max(1, totalKeywords);
  
  // 같은 카테고리면 유사도 증가
  if (question1.category === question2.category) {
    return Math.min(1, similarity * 1.5);
  }
  
  return similarity;
}

/**
 * 질문에서 핵심 키워드 추출
 */
function extractQuestionKeywords(questionText) {
  const text = questionText.toLowerCase();
  const keywords = [];
  
  // 주제어 추출
  const topics = [
    '색상', '색깔', '컬러',
    '크기', '사이즈', '길이',
    '스타일', '형태', '모양',
    '목적', '용도', '이유',
    '대상', '독자', '사용자',
    '톤', '분위기', '느낌',
    '형식', '구조', '타입',
    '해상도', '화질', '품질',
    '시간', '길이', '분량',
    '기술', '언어', '프레임워크'
  ];
  
  topics.forEach(topic => {
    if (text.includes(topic)) {
      keywords.push(topic);
    }
  });
  
  // 의문사 추출
  const questionWords = ['어떤', '무엇', '누구', '언제', '어디서', '왜', '어떻게'];
  questionWords.forEach(word => {
    if (text.includes(word)) {
      keywords.push(word);
    }
  });
  
  return keywords;
}

/**
 * 비슷한 질문들 합치기
 */
export function mergeSimilarQuestions(questions, threshold = 0.6) {
  const merged = [];
  const processed = new Set();
  
  console.log('=== 질문 합치기 시작 ===');
  console.log(`원본 질문 수: ${questions.length}, 임계값: ${threshold}`);
  
  questions.forEach((q1, i) => {
    if (processed.has(i)) return;
    
    const similar = [];
    
    // 현재 질문과 유사한 질문들 찾기
    questions.forEach((q2, j) => {
      if (i !== j && !processed.has(j)) {
        const similarity = calculateQuestionSimilarity(q1, q2);
        
        if (similarity > threshold) {
          similar.push({
            index: j,
            question: q2,
            similarity: similarity
          });
          processed.add(j);
        }
      }
    });
    
    if (similar.length > 0) {
      // 비슷한 질문들을 합쳐서 새로운 질문 생성
      const mergedQuestion = createMergedQuestion(q1, similar.map(s => s.question));
      merged.push(mergedQuestion);
      
      const similarTexts = similar.map(s => s.question.question.substring(0, 20)).join(', ');
      console.log(`✅ 질문 합침: "${q1.question.substring(0, 20)}" + [${similarTexts}]`);
    } else {
      merged.push(q1);
    }
    
    processed.add(i);
  });
  
  console.log(`합치기 완료: ${questions.length} → ${merged.length}`);
  return merged;
}

/**
 * 합쳐진 질문 생성
 */
function createMergedQuestion(mainQuestion, similarQuestions) {
  // 모든 옵션 수집
  const allOptions = [mainQuestion, ...similarQuestions]
    .map(q => q.options || [])
    .flat()
    .filter((option, index, array) => array.indexOf(option) === index); // 중복 제거
  
  // 질문 텍스트 개선 (더 포괄적으로)
  let improvedQuestion = mainQuestion.question;
  
  // 질문 텍스트 합치기 로직
  const questionCombinations = {
    '색상': '색상과 톤은 어떻게 할까요?',
    '크기': '크기나 길이는 어느 정도로 할까요?',
    '스타일': '스타일이나 형태는 어떻게 할까요?',
    '목적': '주요 목적이나 용도는 무엇인가요?',
    '대상': '대상 독자나 사용자는 누구인가요?'
  };
  
  // 카테고리 기반 질문 개선
  Object.entries(questionCombinations).forEach(([category, improvedText]) => {
    if (mainQuestion.category && mainQuestion.category.includes(category)) {
      improvedQuestion = improvedText;
    }
  });
  
  return {
    question: improvedQuestion,
    type: mainQuestion.type,
    options: allOptions.slice(0, 8), // 최대 8개 옵션
    category: mainQuestion.category,
    domain: mainQuestion.domain,
    priority: Math.max(
      mainQuestion.priority || 0,
      ...similarQuestions.map(q => q.priority || 0)
    ),
    merged: true,
    originalCount: similarQuestions.length + 1,
    weight: Math.max(
      mainQuestion.weight || 0,
      ...similarQuestions.map(q => q.weight || 0)
    )
  };
}

/**
 * 엔트로피 기반 우선순위 계산
 */
export function calculateEntropyPriority(question, mentionedInfo = {}) {
  let priority = question.weight || 5;
  
  // 이미 언급된 정보면 우선순위 0
  if (mentionedInfo[question.category]) {
    return 0;
  }
  
  // 필수 질문 가중치
  if (question.required) {
    priority *= 1.4;
  }
  
  // 엔트로피 계산 (선택지가 많을수록 불확실성 높음)
  let entropy = 0.5; // 기본값
  
  if (question.type === 'choice' && question.options) {
    const optionCount = question.options.length;
    if (optionCount > 1) {
      // 정규화된 엔트로피 (균등 분포 가정)
      entropy = Math.log(optionCount) / Math.log(8); // 8개 옵션을 최대로 정규화
      entropy = Math.min(1, entropy);
    }
  } else if (question.type === 'text') {
    entropy = 0.8; // 텍스트 입력은 높은 불확실성
  }
  
  // 도메인 가중치
  const domainWeights = {
    'visual_design': 1.2,
    'video': 1.1, 
    'development': 1.0,
    'text_language': 0.9,
    'presentation_education': 0.8,
    'analysis_marketing': 0.8,
    'music_audio': 0.7
  };
  
  const domainWeight = domainWeights[question.domain] || 1.0;
  
  // 최종 우선순위 = 기본점수 × (0.6 + 0.4 × 엔트로피) × 도메인가중치
  const finalPriority = priority * (0.6 + 0.4 * entropy) * domainWeight;
  
  return finalPriority;
}

/**
 * 질문 중요도 분석
 */
export function analyzeQuestionImportance(questions, userInput, mentionedInfo) {
  const analysis = {
    total: questions.length,
    required: 0,
    optional: 0,
    duplicates: 0,
    coverage: {}
  };
  
  // 도메인별 커버리지 분석
  questions.forEach(q => {
    if (q.required) {
      analysis.required++;
    } else {
      analysis.optional++;
    }
    
    if (!analysis.coverage[q.domain]) {
      analysis.coverage[q.domain] = 0;
    }
    analysis.coverage[q.domain]++;
  });
  
  // 중복도 분석
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const similarity = calculateQuestionSimilarity(questions[i], questions[j]);
      if (similarity > 0.7) {
        analysis.duplicates++;
      }
    }
  }
  
  return analysis;
}

/**
 * 동적 질문 개수 조절
 */
export function optimizeQuestionCount(questions, userInput, mentionedInfo, targetCount = 8) {
  console.log('=== 질문 개수 최적화 ===');
  console.log(`목표: ${targetCount}개, 현재: ${questions.length}개`);
  
  // 1. 우선순위 재계산
  const prioritizedQuestions = questions.map(q => ({
    ...q,
    calculatedPriority: calculateEntropyPriority(q, mentionedInfo)
  }));
  
  // 2. 우선순위 0인 질문들 제거 (이미 언급된 내용)
  const validQuestions = prioritizedQuestions.filter(q => q.calculatedPriority > 0);
  console.log(`언급된 내용 제거 후: ${validQuestions.length}개`);
  
  // 3. 우선순위 정렬
  validQuestions.sort((a, b) => b.calculatedPriority - a.calculatedPriority);
  
  // 4. 필수 질문은 무조건 포함
  const requiredQuestions = validQuestions.filter(q => q.required);
  const optionalQuestions = validQuestions.filter(q => !q.required);
  
  console.log(`필수 질문: ${requiredQuestions.length}개, 선택 질문: ${optionalQuestions.length}개`);
  
  // 5. 목표 개수에 맞춰 선택
  let selectedQuestions = [...requiredQuestions];
  
  const remainingSlots = Math.max(0, targetCount - requiredQuestions.length);
  const additionalQuestions = optionalQuestions.slice(0, remainingSlots);
  
  selectedQuestions = selectedQuestions.concat(additionalQuestions);
  
  console.log(`최종 선택: ${selectedQuestions.length}개`);
  console.log('선택된 질문들:');
  selectedQuestions.forEach((q, i) => {
    console.log(`  ${i+1}. [${q.domain}/${q.category}] ${q.question} (우선순위: ${q.calculatedPriority.toFixed(1)})`);
  });
  
  return selectedQuestions;
}

/**
 * 질문 품질 검증
 */
export function validateQuestionQuality(questions) {
  const issues = [];
  
  questions.forEach((q, index) => {
    // 질문 텍스트 검증
    if (!q.question || q.question.trim().length < 5) {
      issues.push(`질문 ${index + 1}: 질문 텍스트가 너무 짧습니다`);
    }
    
    // 옵션 검증 (choice 타입인 경우)
    if (q.type === 'choice') {
      if (!q.options || q.options.length < 2) {
        issues.push(`질문 ${index + 1}: 선택 옵션이 부족합니다`);
      }
      
      if (q.options && q.options.length > 10) {
        issues.push(`질문 ${index + 1}: 선택 옵션이 너무 많습니다`);
      }
    }
    
    // 카테고리 검증
    if (!q.category) {
      issues.push(`질문 ${index + 1}: 카테고리가 없습니다`);
    }
    
    // 도메인 검증
    if (!q.domain) {
      issues.push(`질문 ${index + 1}: 도메인이 없습니다`);
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues: issues,
    quality: issues.length === 0 ? 'excellent' : 
             issues.length <= 2 ? 'good' : 
             issues.length <= 5 ? 'fair' : 'poor'
  };
}

/**
 * 질문 다양성 보장
 */
export function ensureQuestionDiversity(questions, minDomainCoverage = 0.7) {
  console.log('=== 질문 다양성 검증 ===');
  
  // 도메인별 분포 확인
  const domainCounts = {};
  questions.forEach(q => {
    domainCounts[q.domain] = (domainCounts[q.domain] || 0) + 1;
  });
  
  console.log('도메인별 분포:', domainCounts);
  
  // 다양성 점수 계산
  const totalQuestions = questions.length;
  const domainCount = Object.keys(domainCounts).length;
  const diversityScore = domainCount / Math.max(1, totalQuestions / 3); // 이상적으로는 3개 질문당 1개 도메인
  
  const analysis = {
    diversityScore: Math.min(1, diversityScore),
    domainDistribution: domainCounts,
    recommendations: []
  };
  
  // 권장사항 생성
  if (analysis.diversityScore < minDomainCoverage) {
    analysis.recommendations.push('도메인 다양성이 부족합니다. 다른 분야의 질문을 추가해보세요.');
  }
  
  const maxDomainCount = Math.max(...Object.values(domainCounts));
  if (maxDomainCount > totalQuestions * 0.6) {
    analysis.recommendations.push('특정 도메인에 질문이 집중되어 있습니다. 균형을 맞춰보세요.');
  }
  
  console.log(`다양성 점수: ${analysis.diversityScore.toFixed(2)}`);
  
  return analysis;
}

/**
 * 통합 질문 최적화 함수
 */
export function optimizeQuestions(questions, userInput, mentionedInfo, options = {}) {
  const {
    maxQuestions = 8,
    minQuestions = 3,
    mergeSimilarity = 0.6,
    requireDiversity = true
  } = options;
  
  console.log('=== 통합 질문 최적화 시작 ===');
  console.log(`입력 질문 수: ${questions.length}`);
  console.log('옵션:', options);
  
  let optimizedQuestions = [...questions];
  
  // 1단계: 비슷한 질문 합치기
  if (optimizedQuestions.length > maxQuestions) {
    optimizedQuestions = mergeSimilarQuestions(optimizedQuestions, mergeSimilarity);
  }
  
  // 2단계: 질문 개수 조절
  optimizedQuestions = optimizeQuestionCount(
    optimizedQuestions, 
    userInput, 
    mentionedInfo, 
    maxQuestions
  );
  
  // 3단계: 최소 개수 보장
  if (optimizedQuestions.length < minQuestions) {
    console.log(`⚠️ 질문이 ${minQuestions}개보다 적습니다. 추가 질문 생성 필요`);
    // 여기서 추가 질문 생성 로직을 넣을 수 있음
  }
  
  // 4단계: 다양성 검증
  if (requireDiversity) {
    const diversityAnalysis = ensureQuestionDiversity(optimizedQuestions);
    if (diversityAnalysis.recommendations.length > 0) {
      console.log('다양성 권장사항:', diversityAnalysis.recommendations);
    }
  }
  
  // 5단계: 품질 검증
  const qualityCheck = validateQuestionQuality(optimizedQuestions);
  console.log(`품질 검증: ${qualityCheck.quality}`);
  
  if (!qualityCheck.isValid) {
    console.log('품질 이슈:', qualityCheck.issues);
  }
  
  console.log(`=== 최적화 완료: ${questions.length} → ${optimizedQuestions.length} ===`);
  
  return {
    questions: optimizedQuestions,
    analysis: {
      original: questions.length,
      optimized: optimizedQuestions.length,
      quality: qualityCheck.quality,
      diversity: ensureQuestionDiversity(optimizedQuestions).diversityScore,
      issues: qualityCheck.issues
    }
  };
}

/**
 * 질문 효과성 예측
 */
export function predictQuestionEffectiveness(questions, userInput) {
  let totalEffectiveness = 0;
  
  questions.forEach(q => {
    let effectiveness = q.weight || 5;
    
    // 질문 타입별 효과성
    if (q.type === 'choice') {
      effectiveness *= 1.2; // 선택형이 더 효과적
    } else if (q.type === 'text') {
      effectiveness *= 0.9; // 텍스트 입력은 약간 낮음
    }
    
    // 옵션 개수에 따른 효과성
    if (q.options) {
      const optionCount = q.options.length;
      if (optionCount >= 3 && optionCount <= 6) {
        effectiveness *= 1.1; // 적절한 옵션 수
      } else if (optionCount > 8) {
        effectiveness *= 0.8; // 너무 많은 옵션
      }
    }
    
    totalEffectiveness += effectiveness;
  });
  
  return {
    totalScore: totalEffectiveness,
    averageScore: totalEffectiveness / questions.length,
    prediction: totalEffectiveness > questions.length * 6 ? 'high' :
                totalEffectiveness > questions.length * 4 ? 'medium' : 'low'
  };
}

/**
 * 테스트 함수
 */
export function testQuestionOptimizer() {
  const mockQuestions = [
    { question: "색상은 어떻게 할까요?", type: "choice", options: ["빨강", "파랑", "노랑"], category: "색상", domain: "visual_design", weight: 8, required: true },
    { question: "주요 색조는?", type: "choice", options: ["따뜻한", "차가운"], category: "색상", domain: "visual_design", weight: 7, required: false },
    { question: "스타일은?", type: "choice", options: ["3D", "애니메이션"], category: "스타일", domain: "visual_design", weight: 9, required: true },
    { question: "길이는?", type: "choice", options: ["짧게", "길게"], category: "길이", domain: "video", weight: 8, required: true },
    { question: "목적은?", type: "choice", options: ["교육", "광고"], category: "목적", domain: "video", weight: 7, required: false }
  ];
  
  const userInput = "빨간색 강아지 3D 애니메이션 만들어줘";
  const mentionedInfo = { "색상": "빨간색", "스타일": "3D 애니메이션" };
  
  console.log('\n=== 질문 최적화 테스트 ===');
  
  const result = optimizeQuestions(mockQuestions, userInput, mentionedInfo, {
    maxQuestions: 3,
    minQuestions: 2,
    mergeSimilarity: 0.6
  });
  
  console.log('최적화 결과:');
  result.questions.forEach((q, i) => {
    console.log(`${i+1}. ${q.question} [${q.category}]`);
  });
  
  console.log('분석:', result.analysis);
}

export default {
  calculateQuestionSimilarity,
  mergeSimilarQuestions,
  calculateEntropyPriority,
  optimizeQuestionCount,
  validateQuestionQuality,
  ensureQuestionDiversity,
  optimizeQuestions,
  predictQuestionEffectiveness,
  testQuestionOptimizer
};
  
