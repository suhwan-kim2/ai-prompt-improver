// utils/evaluationSystem.js - 모듈화된 평가 시스템

/**
 * 프롬프트 품질 평가 시스템
 * 5개 축으로 종합 평가: 정보밀도, 완성도, 명확성, 실행가능성, 효율성
 */

// 도메인별 요구사항 정의
const DOMAIN_REQUIREMENTS = {
    visual_design: {
        required: ['주제', '스타일'],
        preferred: ['색상', '크기', '해상도', '구도', '조명'],
        technical: ['해상도', '포맷', '렌더링 방식']
    },
    video: {
        required: ['내용', '길이'],
        preferred: ['스타일', '해상도', '음향', '편집'],
        technical: ['fps', '코덱', '해상도']
    },
    text_language: {
        required: ['목적', '내용'],
        preferred: ['톤', '길이', '대상독자', '형식'],
        technical: ['문체', '구조', '키워드']
    },
    development: {
        required: ['기능', '플랫폼'],
        preferred: ['기술스택', '디자인', '성능'],
        technical: ['프레임워크', 'API', '데이터베이스']
    },
    data_analysis: {
        required: ['데이터', '목적'],
        preferred: ['방법론', '시각화', '결과형식'],
        technical: ['도구', '통계방법', '검증']
    }
};

/**
 * 메인 평가 함수
 */
export function evaluatePrompt(prompt, originalInput, domainInfo = null) {
    const results = {
        totalScore: 0,
        breakdown: {},
        strengths: [],
        improvements: [],
        recommendation: '',
        debugInfo: {}
    };

    try {
        // 1. 정보밀도 평가 (30점)
        const density = calculateInformationDensity(prompt, originalInput);
        results.breakdown.informationDensity = Math.round(density * 30);
        
        // 2. 완성도 평가 (25점)
        const completeness = calculateCompleteness(prompt, domainInfo);
        results.breakdown.completeness = Math.round(completeness * 25);
        
        // 3. 명확성 평가 (20점)
        const clarity = calculateClarity(prompt);
        results.breakdown.clarity = Math.round(clarity * 20);
        
        // 4. 실행가능성 평가 (15점)
        const executability = calculateExecutability(prompt);
        results.breakdown.executability = Math.round(executability * 15);
        
        // 5. 효율성 평가 (10점)
        const efficiency = calculateEfficiency(prompt, originalInput);
        results.breakdown.efficiency = Math.round(efficiency * 10);
        
        // 총점 계산
        results.totalScore = Object.values(results.breakdown).reduce((sum, score) => sum + score, 0);
        
        // 강점과 개선점 생성
        generateFeedback(results, { density, completeness, clarity, executability, efficiency });
        
        // 디버그 정보
        results.debugInfo = {
            promptLength: prompt.length,
            originalLength: originalInput.length,
            expansionRatio: prompt.length / originalInput.length,
            domainDetected: domainInfo?.primary || 'unknown'
        };
        
    } catch (error) {
        console.error('평가 시스템 오류:', error);
        // 기본값 반환
        results.totalScore = 70;
        results.breakdown = { informationDensity: 21, completeness: 18, clarity: 14, executability: 11, efficiency: 6 };
        results.improvements = ['평가 중 오류가 발생했습니다.'];
    }
    
    return results;
}

/**
 * 1. 정보밀도 계산 (구체적 정보 vs 불필요한 수식어 비율)
 */
function calculateInformationDensity(prompt, originalInput) {
    let score = 0.5; // 기본 점수
    
    // 구체적 정보 요소들
    const specificElements = {
        numbers: (prompt.match(/\d+/g) || []).length * 0.05, // 숫자
        units: (prompt.match(/(?:px|cm|mm|초|분|시간|KB|MB|GB|fps|Hz)/g) || []).length * 0.03, // 단위
        colors: (prompt.match(/(?:빨간|파란|노란|검은|흰|회색|보라|초록|주황|분홍)/g) || []).length * 0.03, // 색상
        sizes: (prompt.match(/(?:크|작|큰|작은|거대|미니|소형|대형)/g) || []).length * 0.02, // 크기
        technical: (prompt.match(/(?:4K|HD|API|JSON|CSS|HTML|RGB|CMYK|벡터|래스터)/g) || []).length * 0.04 // 기술용어
    };
    
    const specificScore = Math.min(0.4, Object.values(specificElements).reduce((sum, val) => sum + val, 0));
    score += specificScore;
    
    // 불필요한 수식어 감점
    const fluffWords = prompt.match(/(?:아름다운|멋진|놀라운|환상적|마법같은|경이로운|특별한|독특한)/g) || [];
    const fluffPenalty = Math.min(0.3, fluffWords.length * 0.05);
    score -= fluffPenalty;
    
    // 적절한 확장 비율 보너스
    const expansionRatio = prompt.length / originalInput.length;
    if (expansionRatio >= 2 && expansionRatio <= 5) {
        score += 0.1;
    } else if (expansionRatio > 8) {
        score -= 0.2; // 너무 장황함
    }
    
    return Math.max(0, Math.min(1, score));
}

/**
 * 2. 완성도 계산 (필수 정보 포함 여부)
 */
function calculateCompleteness(prompt, domainInfo) {
    if (!domainInfo || !domainInfo.primary) {
        return 0.6; // 기본 점수
    }
    
    const domain = domainInfo.primary;
    const requirements = DOMAIN_REQUIREMENTS[domain];
    
    if (!requirements) {
        return 0.6;
    }
    
    let score = 0;
    
    // 필수 요소 확인 (70% 가중치)
    const requiredFound = requirements.required.filter(req => 
        checkForRequirement(prompt, req)
    ).length;
    score += (requiredFound / requirements.required.length) * 0.7;
    
    // 선호 요소 확인 (20% 가중치)
    const preferredFound = requirements.preferred.filter(pref => 
        checkForRequirement(prompt, pref)
    ).length;
    score += (preferredFound / requirements.preferred.length) * 0.2;
    
    // 기술 요소 확인 (10% 가중치)
    const technicalFound = requirements.technical.filter(tech => 
        checkForRequirement(prompt, tech)
    ).length;
    score += (technicalFound / requirements.technical.length) * 0.1;
    
    return Math.max(0, Math.min(1, score));
}

/**
 * 3. 명확성 계산 (모호하지 않고 구체적)
 */
function calculateClarity(prompt) {
    let score = 0.5;
    
    // 모호한 표현 감점
    const vague = prompt.match(/(?:적당히|대충|좀|좀더|약간|살짝|어느정도|적절히)/g) || [];
    score -= Math.min(0.3, vague.length * 0.05);
    
    // 구체적 지시 가점
    const specific = prompt.match(/(?:정확히|명확히|구체적으로|세부적으로|상세히)/g) || [];
    score += Math.min(0.2, specific.length * 0.05);
    
    // 단계별 구조 가점
    if (prompt.includes('1.') || prompt.includes('첫째') || prompt.includes('단계')) {
        score += 0.1;
    }
    
    // 조건문 사용 가점
    if (prompt.includes('만약') || prompt.includes('경우') || prompt.includes('조건')) {
        score += 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
}

/**
 * 4. 실행가능성 계산 (AI가 이해하고 수행 가능)
 */
function calculateExecutability(prompt) {
    let score = 0.6;
    
    // 실행 불가능한 요소 감점
    const impossible = prompt.match(/(?:실제로|진짜로|완벽하게|100%|절대|무조건)/g) || [];
    score -= Math.min(0.2, impossible.length * 0.03);
    
    // 측정 가능한 기준 가점
    const measurable = prompt.match(/(?:\d+%|\d+점|\d+개|\d+번|이상|이하|보다)/g) || [];
    score += Math.min(0.2, measurable.length * 0.02);
    
    // 출력 형식 명시 가점
    if (prompt.match(/(?:형식|포맷|확장자|크기|해상도)/)) {
        score += 0.1;
    }
    
    // 제약 조건 명시 가점
    if (prompt.match(/(?:제한|조건|규칙|기준)/)) {
        score += 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
}

/**
 * 5. 효율성 계산 (중복/불필요 내용 없음)
 */
function calculateEfficiency(prompt, originalInput) {
    let score = 0.7;
    
    // 중복 문장 감점
    const sentences = prompt.split(/[.!?]/).filter(s => s.trim().length > 10);
    const uniqueSentences = [...new Set(sentences)];
    if (sentences.length > uniqueSentences.length) {
        score -= (sentences.length - uniqueSentences.length) * 0.05;
    }
    
    // 과도한 길이 감점
    const expansionRatio = prompt.length / originalInput.length;
    if (expansionRatio > 6) {
        score -= (expansionRatio - 6) * 0.05;
    }
    
    // 간결한 표현 가점
    const concise = prompt.match(/(?:간단히|요약하면|핵심은|결론적으로)/g) || [];
    score += Math.min(0.1, concise.length * 0.05);
    
    return Math.max(0, Math.min(1, score));
}

/**
 * 요구사항 확인 헬퍼 함수
 */
function checkForRequirement(prompt, requirement) {
    const keywords = {
        '주제': ['주제', '내용', '소재', '대상'],
        '스타일': ['스타일', '방식', '기법', '톤'],
        '색상': ['색', '컬러', '빨간', '파란', '노란', '검은', '흰'],
        '크기': ['크기', '사이즈', '해상도', 'px', 'cm'],
        '길이': ['길이', '시간', '분', '초'],
        '목적': ['목적', '용도', '이유', '위해'],
        '대상독자': ['대상', '독자', '사용자', '고객'],
        '기능': ['기능', '역할', '작업', '처리'],
        '플랫폼': ['플랫폼', '환경', '시스템', '브라우저']
    };
    
    const reqKeywords = keywords[requirement] || [requirement];
    return reqKeywords.some(keyword => prompt.includes(keyword));
}

/**
 * 피드백 생성
 */
function generateFeedback(results, scores) {
    const { density, completeness, clarity, executability, efficiency } = scores;
    
    // 강점 찾기
    if (density > 0.7) results.strengths.push('구체적이고 상세한 정보 포함');
    if (completeness > 0.7) results.strengths.push('필요한 요소들이 잘 포함됨');
    if (clarity > 0.7) results.strengths.push('명확하고 이해하기 쉬운 지시사항');
    if (executability > 0.7) results.strengths.push('실행 가능한 현실적 요구사항');
    if (efficiency > 0.7) results.strengths.push('간결하고 효율적인 구성');
    
    // 개선점 찾기
    if (density < 0.5) results.improvements.push('더 구체적인 수치와 세부사항 필요');
    if (completeness < 0.5) results.improvements.push('필수 정보가 부족함');
    if (clarity < 0.5) results.improvements.push('모호한 표현을 구체적으로 수정 필요');
    if (executability < 0.5) results.improvements.push('실행 가능한 형태로 요구사항 조정 필요');
    if (efficiency < 0.5) results.improvements.push('불필요한 내용 제거 및 간소화 필요');
    
    // 총합 추천
    if (results.totalScore >= 90) {
        results.recommendation = '🎉 훌륭한 품질의 프롬프트입니다! 바로 사용하세요.';
    } else if (results.totalScore >= 75) {
        results.recommendation = '👍 좋은 품질입니다. 약간의 개선으로 더 나아질 수 있습니다.';
    } else if (results.totalScore >= 60) {
        results.recommendation = '⚠️ 보통 수준입니다. 위 개선사항을 반영하면 훨씬 좋아집니다.';
    } else {
        results.recommendation = '❌ 개선이 많이 필요합니다. 더 구체적이고 명확한 정보를 추가하세요.';
    }
}

// 기본 export
export default { evaluatePrompt };
