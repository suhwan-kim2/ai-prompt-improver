// utils/mentionExtractor.js - 사용자 언급 정보 추출 시스템

/**
 * 사용자 입력에서 이미 언급된 정보를 자동으로 추출
 * 재질문을 방지하고 컨텍스트를 보존하는 역할
 */

// 추출 가능한 정보 카테고리별 키워드 매핑
const EXTRACTION_PATTERNS = {
  
  // 색상 정보
  색상: {
    keywords: [
      '빨간', '빨강', '레드', '적색',
      '파란', '파랑', '블루', '청색',
      '노란', '노랑', '옐로우', '황색',
      '검은', '검정', '블랙', '흑색',
      '흰', '하얀', '화이트', '백색',
      '초록', '녹색', '그린',
      '보라', '퍼플', '자주',
      '분홍', '핑크', '장밋빛',
      '갈색', '브라운', '갈색',
      '회색', '그레이', '은색',
      '황금', '골드', '금색',
      '오렌지', '주황'
    ],
    processor: (input, keyword) => {
      if (keyword.includes('빨간') || keyword.includes('빨강')) return '빨간색';
      if (keyword.includes('파란') || keyword.includes('파랑')) return '파란색';
      if (keyword.includes('노란') || keyword.includes('노랑')) return '노란색';
      if (keyword.includes('검은') || keyword.includes('검정')) return '검은색';
      if (keyword.includes('흰') || keyword.includes('하얀')) return '흰색';
      if (keyword.includes('초록') || keyword.includes('녹색')) return '초록색';
      if (keyword.includes('보라') || keyword.includes('퍼플')) return '보라색';
      if (keyword.includes('분홍') || keyword.includes('핑크')) return '분홍색';
      if (keyword.includes('갈색') || keyword.includes('브라운')) return '갈색';
      if (keyword.includes('회색') || keyword.includes('그레이')) return '회색';
      if (keyword.includes('황금') || keyword.includes('골드')) return '황금색';
      if (keyword.includes('오렌지') || keyword.includes('주황')) return '주황색';
      return keyword + '색';
    }
  },

  // 스타일 정보
  스타일: {
    keywords: [
      '3d', '3차원', '입체',
      '애니메이션', '애니', '만화',
      '실사', '사진', '포토',
      '일러스트', '일러', '그림',
      '수채화', '유화', '아크릴',
      '스케치', '드로잉', '연필',
      '픽셀아트', '픽셀', '도트',
      '벡터', '미니멀', '추상',
      '현실적', '사실적', '리얼'
    ],
    processor: (input, keyword) => {
      if (keyword.includes('3d')) return '3D 렌더링';
      if (keyword.includes('애니')) return '애니메이션';
      if (keyword.includes('실사') || keyword.includes('사진')) return '실사/포토';
      if (keyword.includes('일러')) return '일러스트';
      if (keyword.includes('수채화')) return '수채화';
      if (keyword.includes('만화')) return '만화/카툰';
      if (keyword.includes('스케치')) return '스케치';
      if (keyword.includes('픽셀')) return '픽셀아트';
      if (keyword.includes('현실적') || keyword.includes('사실적')) return '사실적';
      return keyword;
    }
  },

  // 크기/길이 정보
  크기: {
    keywords: [
      '작은', '소형', '미니', '작게',
      '큰', '대형', '거대한', '크게',
      '중간', '보통', '적당한',
      '짧은', '짧게', '길은', '길게',
      '긴', '장시간', '오래',
      '15초', '30초', '1분', '3분', '5분',
      '초', '분', '시간'
    ],
    processor: (input, keyword) => {
      // 시간 관련
      if (/\d+초/.test(input)) {
        const match = input.match(/(\d+)초/);
        return match ? `${match[1]}초` : keyword;
      }
      if (/\d+분/.test(input)) {
        const match = input.match(/(\d+)분/);
        return match ? `${match[1]}분` : keyword;
      }
      
      // 크기 관련
      if (keyword.includes('작은') || keyword.includes('소형')) return '작은 크기';
      if (keyword.includes('큰') || keyword.includes('대형')) return '큰 크기';
      if (keyword.includes('중간') || keyword.includes('보통')) return '중간 크기';
      if (keyword.includes('짧은') || keyword.includes('짧게')) return '짧은 길이';
      if (keyword.includes('긴') || keyword.includes('길게')) return '긴 길이';
      
      return keyword;
    }
  },

  // 해상도/품질 정보
  해상도: {
    keywords: [
      '4k', '4K', 'UHD',
      'hd', 'HD', '1080p', '720p',
      '고화질', '고해상도', '선명한',
      '저화질', '낮은화질',
      '웹용', '인쇄용', '출력용'
    ],
    processor: (input, keyword) => {
      if (keyword.includes('4k') || keyword.includes('4K')) return '4K';
      if (keyword.includes('hd') || keyword.includes('HD') || keyword.includes('1080p')) return 'HD/1080p';
      if (keyword.includes('고화질') || keyword.includes('고해상도')) return '고화질';
      if (keyword.includes('웹용')) return '웹용 해상도';
      if (keyword.includes('인쇄용')) return '인쇄용 고해상도';
      return keyword;
    }
  },

  // 목적/용도 정보
  목적: {
    keywords: [
      '교육', '강의', '튜토리얼', '학습',
      '광고', '홍보', '마케팅', '세일즈',
      '발표', '프레젠테이션', 'ppt',
      '개인용', '개인', '취미',
      '상업용', '비즈니스', '업무',
      '포트폴리오', '작품집',
      '웹사이트', '블로그', 'sns'
    ],
    processor: (input, keyword) => {
      if (keyword.includes('교육') || keyword.includes('강의')) return '교육/강의용';
      if (keyword.includes('광고') || keyword.includes('홍보')) return '광고/홍보용';
      if (keyword.includes('발표') || keyword.includes('프레젠테이션')) return '발표용';
      if (keyword.includes('개인')) return '개인용';
      if (keyword.includes('상업') || keyword.includes('비즈니스')) return '상업용';
      if (keyword.includes('포트폴리오')) return '포트폴리오용';
      if (keyword.includes('웹사이트') || keyword.includes('블로그')) return '웹사이트용';
      return keyword;
    }
  },

  // 대상독자 정보
  대상독자: {
    keywords: [
      '어린이', '아이들', '유아',
      '학생', '대학생', '고등학생',
      '성인', '어른', '일반인',
      '전문가', '개발자', '디자이너',
      '고객', '클라이언트', '사용자',
      '동료', '팀원', '직장인',
      '상사', '임원', '경영진'
    ],
    processor: (input, keyword) => {
      if (keyword.includes('어린이') || keyword.includes('아이')) return '어린이';
      if (keyword.includes('학생')) return '학생';
      if (keyword.includes('성인') || keyword.includes('일반인')) return '일반인';
      if (keyword.includes('전문가')) return '전문가';
      if (keyword.includes('고객') || keyword.includes('클라이언트')) return '고객';
      if (keyword.includes('동료') || keyword.includes('팀원')) return '동료';
      if (keyword.includes('상사') || keyword.includes('임원')) return '상급자';
      return keyword;
    }
  },

  // 톤/분위기 정보
  톤: {
    keywords: [
      '공식적', '정중한', '격식',
      '친근한', '편안한', '캐주얼',
      '전문적', '기술적', '전문',
      '유머러스', '재미있는', '유머',
      '감정적', '감성적', '따뜻한',
      '차가운', '냉정한', '객관적',
      '밝은', '경쾌한', '활발한',
      '차분한', '조용한', '안정적'
    ],
    processor: (input, keyword) => {
      if (keyword.includes('공식') || keyword.includes('정중')) return '공식적/정중한';
      if (keyword.includes('친근') || keyword.includes('편안')) return '친근한/편안한';
      if (keyword.includes('전문')) return '전문적/기술적';
      if (keyword.includes('유머')) return '유머러스';
      if (keyword.includes('감정') || keyword.includes('감성')) return '감정적';
      if (keyword.includes('밝은') || keyword.includes('경쾌')) return '밝고 경쾌한';
      if (keyword.includes('차분') || keyword.includes('조용')) return '차분한';
      return keyword;
    }
  },

  // 형식/구조 정보
  형식: {
    keywords: [
      '에세이', '보고서', '논문',
      '이메일', '편지', '메시지',
      '블로그', '포스트', '기사',
      '소설', '시나리오', '스토리',
      '리스트', '목록', '정리',
      '가이드', '매뉴얼', '설명서'
    ],
    processor: (input, keyword) => {
      return keyword;
    }
  },

  // 기술스택 정보 (개발 관련)
  기술스택: {
    keywords: [
      'react', 'vue', 'angular', 'javascript', 'js',
      'python', 'java', 'c++', 'c#', 'php',
      'node', 'nodejs', 'express', 'spring',
      'mongodb', 'mysql', 'postgresql', 'redis',
      'aws', 'gcp', 'azure', 'docker',
      'html', 'css', 'bootstrap', 'tailwind'
    ],
    processor: (input, keyword) => {
      const techMap = {
        'react': 'React',
        'vue': 'Vue.js',
        'angular': 'Angular',
        'javascript': 'JavaScript',
        'js': 'JavaScript',
        'python': 'Python',
        'java': 'Java',
        'node': 'Node.js',
        'nodejs': 'Node.js',
        'mongodb': 'MongoDB',
        'mysql': 'MySQL'
      };
      
      return techMap[keyword.toLowerCase()] || keyword;
    }
  }
};

/**
 * 메인 추출 함수
 */
export function extractMentionedInfo(userInput) {
  const mentioned = {};
  const input = userInput.toLowerCase();
  
  console.log('=== 언급 정보 추출 시작 ===');
  console.log('입력:', userInput);
  
  // 각 카테고리별로 키워드 검색
  Object.entries(EXTRACTION_PATTERNS).forEach(([category, config]) => {
    const foundKeywords = config.keywords.filter(keyword => 
      input.includes(keyword.toLowerCase())
    );
    
    if (foundKeywords.length > 0) {
      // 가장 구체적인 키워드 선택 (긴 키워드 우선)
      const bestKeyword = foundKeywords.sort((a, b) => b.length - a.length)[0];
      const processedValue = config.processor(input, bestKeyword);
      
      mentioned[category] = processedValue;
      console.log(`✅ ${category}: ${processedValue} (from: ${bestKeyword})`);
    }
  });
  
  // 숫자 정보 추출
  extractNumbers(input, mentioned);
  
  // 브랜드/고유명사 추출
  extractBrands(input, mentioned);
  
  console.log('최종 추출 결과:', mentioned);
  return mentioned;
}

/**
 * 숫자 정보 추출 (크기, 시간, 해상도 등)
 */
function extractNumbers(input, mentioned) {
  // 시간 관련 숫자
  const timePatterns = [
    /(\d+)\s*초/g,
    /(\d+)\s*분/g,
    /(\d+)\s*시간/g
  ];
  
  timePatterns.forEach(pattern => {
    const matches = [...input.matchAll(pattern)];
    if (matches.length > 0) {
      const timeValue = matches[0][0]; // 첫 번째 매칭된 전체 문자열
      mentioned['길이'] = timeValue;
      console.log(`✅ 길이: ${timeValue} (숫자 추출)`);
    }
  });
  
  // 해상도 관련 숫자
  const resolutionPatterns = [
    /4k|4K/g,
    /(\d+)p/g,
    /(\d+)\s*x\s*(\d+)/g
  ];
  
  resolutionPatterns.forEach(pattern => {
    const matches = [...input.matchAll(pattern)];
    if (matches.length > 0) {
      const resValue = matches[0][0];
      mentioned['해상도'] = resValue;
      console.log(`✅ 해상도: ${resValue} (숫자 추출)`);
    }
  });
  
  // 크기 관련 숫자 (cm, px, % 등)
  const sizePatterns = [
    /(\d+)\s*(cm|px|%|inch|인치)/g
  ];
  
  sizePatterns.forEach(pattern => {
    const matches = [...input.matchAll(pattern)];
    if (matches.length > 0) {
      const sizeValue = matches[0][0];
      mentioned['크기'] = sizeValue;
      console.log(`✅ 크기: ${sizeValue} (숫자 추출)`);
    }
  });
}

/**
 * 브랜드/고유명사 추출
 */
function extractBrands(input, mentioned) {
  const brandKeywords = {
    '애플': 'Apple',
    '구글': 'Google',
    '마이크로소프트': 'Microsoft',
    '삼성': 'Samsung',
    'lg': 'LG',
    '넷플릭스': 'Netflix',
    '유튜브': 'YouTube',
    '인스타그램': 'Instagram',
    '페이스북': 'Facebook',
    '트위터': 'Twitter',
    '틱톡': 'TikTok'
  };
  
  Object.entries(brandKeywords).forEach(([keyword, brand]) => {
    if (input.includes(keyword.toLowerCase())) {
      mentioned['브랜드'] = brand;
      console.log(`✅ 브랜드: ${brand} (from: ${keyword})`);
    }
  });
}

/**
 * 특정 슬롯과 언급된 정보 매칭 체크
 */
export function isSlotAlreadyMentioned(slotName, slotConfig, mentionedInfo) {
  // 직접 매칭 (슬롯명이 언급된 정보에 있는지)
  if (mentionedInfo[slotName]) {
    console.log(`🚫 슬롯 "${slotName}" 건너뛰기: 이미 언급됨 (${mentionedInfo[slotName]})`);
    return true;
  }
  
  // 유사 매칭 (관련 정보가 언급되었는지)
  const relatedMappings = {
    '색상': ['색상'],
    '스타일': ['스타일'],
    '크기': ['크기', '길이'],
    '해상도': ['해상도'],
    '목적': ['목적', '용도'],
    '대상독자': ['대상독자'],
    '톤': ['톤'],
    '형식': ['형식'],
    '기술스택': ['기술스택'],
    '길이': ['길이', '크기'],
    '용도': ['목적', '용도']
  };
  
  const relatedKeys = relatedMappings[slotName] || [slotName];
  
  for (const key of relatedKeys) {
    if (mentionedInfo[key]) {
      console.log(`🚫 슬롯 "${slotName}" 건너뛰기: 관련 정보 이미 언급됨 (${key}: ${mentionedInfo[key]})`);
      return true;
    }
  }
  
  return false;
}

/**
 * 고급 컨텍스트 분석
 */
export function analyzeContext(userInput, mentionedInfo) {
  const context = {
    complexity: 'simple', // simple, medium, complex
    specificity: 'low',   // low, medium, high
    completeness: 0,      // 0-1
    suggestions: []
  };
  
  // 복잡도 분석
  const wordCount = userInput.split(/\s+/).length;
  const mentionedCount = Object.keys(mentionedInfo).length;
  
  if (wordCount > 20 || mentionedCount > 5) {
    context.complexity = 'complex';
  } else if (wordCount > 10 || mentionedCount > 2) {
    context.complexity = 'medium';
  }
  
  // 구체성 분석
  const hasNumbers = /\d/.test(userInput);
  const hasTechnicalTerms = /3d|4k|hd|api|css|html|react|python/.test(userInput.toLowerCase());
  const hasSpecificColors = mentionedInfo['색상'] && !['색상', '컬러'].includes(mentionedInfo['색상']);
  
  if ((hasNumbers && hasTechnicalTerms) || hasSpecificColors) {
    context.specificity = 'high';
  } else if (hasNumbers || hasTechnicalTerms || mentionedCount > 3) {
    context.specificity = 'medium';
  }
  
  // 완성도 점수 (언급된 정보 / 예상 필요 정보)
  const expectedCategories = ['주제', '스타일', '목적', '색상', '크기'];
  const mentionedCategories = Object.keys(mentionedInfo);
  context.completeness = mentionedCategories.length / expectedCategories.length;
  
  // 제안사항 생성
  if (context.specificity === 'low') {
    context.suggestions.push('더 구체적인 정보를 제공하면 더 정확한 결과를 얻을 수 있어요');
  }
  
  if (context.completeness < 0.5) {
    context.suggestions.push('몇 가지 추가 질문을 통해 더 완성도 높은 결과를 만들어드릴게요');
  }
  
  return context;
}

/**
 * 언급된 정보를 자연스러운 문장으로 변환
 */
export function mentionedInfoToText(mentionedInfo) {
  if (Object.keys(mentionedInfo).length === 0) {
    return '언급된 구체적 정보 없음';
  }
  
  const parts = [];
  
  Object.entries(mentionedInfo).forEach(([category, value]) => {
    switch (category) {
      case '색상':
        parts.push(`${value}으로`);
        break;
      case '스타일':
        parts.push(`${value} 스타일로`);
        break;
      case '크기':
      case '길이':
        parts.push(`${value}으로`);
        break;
      case '목적':
        parts.push(`${value}으로 사용할`);
        break;
      case '대상독자':
        parts.push(`${value}을 대상으로 한`);
        break;
      default:
        parts.push(`${value}`);
    }
  });
  
  return parts.join(' ');
}

/**
 * 테스트 함수
 */
export function testMentionExtractor() {
  const testCases = [
    "빨간색 골든 리트리버가 우주에서 3D 애니메이션으로 15초 영상 만들어줘",
    "4K 해상도로 파란색 로고 디자인해줘",
    "React로 쇼핑몰 웹사이트 개발해줘",
    "교육용 PPT 10분 발표자료 만들어줘",
    "친근한 톤으로 블로그 글 써줘"
  ];
  
  testCases.forEach(testInput => {
    console.log(`\n=== 테스트: "${testInput}" ===`);
    const mentioned = extractMentionedInfo(testInput);
    const context = analyzeContext(testInput, mentioned);
    const textSummary = mentionedInfoToText(mentioned);
    
    console.log('언급 정보:', mentioned);
    console.log('컨텍스트:', context);
    console.log('요약:', textSummary);
  });
}

export default {
  extractMentionedInfo,
  isSlotAlreadyMentioned,
  analyzeContext,
  mentionedInfoToText,
  testMentionExtractor
};
