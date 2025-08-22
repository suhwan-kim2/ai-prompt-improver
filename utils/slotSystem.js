// utils/slotSystem.js - 슬롯 기반 질문 시스템

/**
 * 도메인별 슬롯 정의
 * 각 슬롯은 required(필수여부), weight(중요도), type(형태), options(선택지) 속성을 가짐
 */
export const DOMAIN_SLOTS = {
  
  // 텍스트/언어 도메인 (글쓰기, 번역, 스토리)
  "text_language": {
    keywords: ["글", "텍스트", "써줘", "작성", "보고서", "이메일", "블로그", "번역", "스토리"],
    slots: {
      목적: {
        required: true, 
        weight: 10, 
        type: "enum", 
        options: ["정보전달", "설득/논증", "감정표현", "교육/설명", "엔터테인먼트", "번역", "기타"],
        question: "이 글의 주요 목적은 무엇인가요?"
      },
      대상독자: {
        required: true, 
        weight: 9, 
        type: "enum", 
        options: ["전문가", "일반인", "학생", "고객", "동료", "어린이", "기타"],
        question: "주요 대상 독자나 사용자는 누구인가요?"
      },
      분량: {
        required: false, 
        weight: 7, 
        type: "enum", 
        options: ["짧게(1-2페이지)", "중간(3-10페이지)", "길게(10페이지 이상)", "자유", "기타"],
        question: "대략적인 분량이나 길이는 어느 정도로 할까요?"
      },
      톤: {
        required: false, 
        weight: 8, 
        type: "enum", 
        options: ["공식적/정중한", "친근한/편안한", "전문적/기술적", "유머러스", "감정적", "기타"],
        question: "어떤 톤이나 느낌으로 작성할까요?"
      },
      형식: {
        required: false, 
        weight: 6, 
        type: "enum", 
        options: ["에세이", "보고서", "이메일", "블로그글", "논문", "소설", "시나리오", "기타"],
        question: "글의 형식이나 구조는 어떻게 할까요?"
      }
    }
  },

  // 개발/프로그래밍 도메인
  "development": {
    keywords: ["웹사이트", "앱", "프로그램", "코드", "개발", "만들어", "시스템", "API"],
    slots: {
      프로젝트유형: {
        required: true, 
        weight: 10, 
        type: "enum", 
        options: ["웹사이트", "모바일앱", "데스크톱앱", "API/백엔드", "게임", "기타"],
        question: "어떤 종류의 프로젝트인가요?"
      },
      주요기능: {
        required: true, 
        weight: 9, 
        type: "text", 
        placeholder: "예: 로그인, 게시판, 결제, 검색 등",
        question: "핵심적으로 필요한 기능들을 알려주세요"
      },
      기술스택: {
        required: false, 
        weight: 7, 
        type: "text", 
        placeholder: "예: React, Node.js, Python, MongoDB 등",
        question: "선호하는 기술이나 프레임워크가 있나요?"
      },
      사용자규모: {
        required: false, 
        weight: 6, 
        type: "enum", 
        options: ["개인용", "소규모(~100명)", "중규모(~1,000명)", "대규모(1,000명+)", "모름", "기타"],
        question: "예상 사용자 규모는 어느 정도인가요?"
      },
      디자인스타일: {
        required: false, 
        weight: 5, 
        type: "enum", 
        options: ["미니멀", "모던", "클래식", "화려한", "상관없음", "기타"],
        question: "디자인 스타일 선호도가 있나요?"
      }
    }
  },

  // 비주얼 디자인 도메인 (이미지, 사진, 로고, UI)
  "visual_design": {
    keywords: ["이미지", "그림", "사진", "로고", "디자인", "그려", "UI", "UX", "그래픽"],
    slots: {
      주제: {
        required: true, 
        weight: 10, 
        type: "text", 
        placeholder: "예: 강아지, 우주, 로고, 캐릭터 등",
        question: "구체적으로 어떤 주제나 내용인가요?"
      },
      스타일: {
        required: true, 
        weight: 9, 
        type: "enum", 
        options: ["사실적/포토리얼", "3D렌더링", "애니메이션", "일러스트", "수채화", "만화", "픽셀아트", "기타"],
        question: "어떤 스타일로 만들까요?"
      },
      색상: {
        required: false, 
        weight: 7, 
        type: "enum", 
        options: ["따뜻한 톤", "차가운 톤", "모노톤", "화려한/네온", "파스텔", "자연색", "기타"],
        question: "색상이나 색조는 어떻게 할까요?"
      },
      용도: {
        required: false, 
        weight: 8, 
        type: "enum", 
        options: ["개인용", "상업용", "포트폴리오", "SNS용", "인쇄물", "웹사이트", "기타"],
        question: "어떤 용도로 사용하실 건가요?"
      },
      해상도: {
        required: false, 
        weight: 5, 
        type: "enum", 
        options: ["HD(1080p)", "4K", "인쇄용 고해상도", "웹용", "상관없음", "기타"],
        question: "해상도나 화질은 어느 정도로 할까요?"
      },
      구도: {
        required: false, 
        weight: 6, 
        type: "enum", 
        options: ["클로즈업", "전신", "상반신", "풍경", "패턴", "추상", "기타"],
        question: "구도나 레이아웃은 어떻게 할까요?"
      }
    }
  },

  // 영상 도메인
  "video": {
    keywords: ["영상", "비디오", "동영상", "애니메이션", "촬영", "무비", "클립"],
    slots: {
      목적: {
        required: true, 
        weight: 10, 
        type: "enum", 
        options: ["광고/홍보", "교육/튜토리얼", "엔터테인먼트", "소개/프레젠테이션", "뮤직비디오", "기타"],
        question: "영상의 주요 목적은 무엇인가요?"
      },
      길이: {
        required: true, 
        weight: 9, 
        type: "enum", 
        options: ["짧게(15초 이하)", "숏폼(1분 이하)", "중간(1-5분)", "길게(5분 이상)", "기타"],
        question: "영상 길이는 어느 정도로 할까요?"
      },
      스타일: {
        required: true, 
        weight: 8, 
        type: "enum", 
        options: ["실사촬영", "3D애니메이션", "2D애니메이션", "모션그래픽", "스톱모션", "혼합", "기타"],
        question: "영상 스타일은 어떻게 할까요?"
      },
      플랫폼: {
        required: false, 
        weight: 7, 
        type: "enum", 
        options: ["YouTube", "TikTok/숏츠", "Instagram", "웹사이트", "TV/극장", "기타"],
        question: "주로 어떤 플랫폼에서 사용하실 건가요?"
      },
      화질: {
        required: false, 
        weight: 5, 
        type: "enum", 
        options: ["HD(1080p)", "4K", "8K", "상관없음", "기타"],
        question: "화질이나 해상도는 어느 정도로 할까요?"
      },
      구성: {
        required: false, 
        weight: 8, 
        type: "text", 
        placeholder: "예: 인트로 → 메인 내용 → 아웃트로",
        question: "영상의 구성이나 흐름을 간단히 설명해주세요"
      }
    }
  },

  // 발표/교육 도메인 (PPT, 강의자료)
  "presentation_education": {
    keywords: ["PPT", "발표", "프레젠테이션", "교육", "강의", "슬라이드", "세미나"],
    slots: {
      목적: {
        required: true, 
        weight: 10, 
        type: "enum", 
        options: ["업무발표", "교육/강의", "세일즈피치", "학술발표", "제안서", "기타"],
        question: "발표의 주요 목적은 무엇인가요?"
      },
      청중: {
        required: true, 
        weight: 9, 
        type: "enum", 
        options: ["동료/팀원", "상급자/임원", "고객", "학생", "일반인", "전문가", "기타"],
        question: "주요 청중은 누구인가요?"
      },
      분량: {
        required: false, 
        weight: 7, 
        type: "enum", 
        options: ["짧게(5-10슬라이드)", "중간(10-20슬라이드)", "길게(20슬라이드 이상)", "기타"],
        question: "슬라이드 수는 대략 어느 정도로 할까요?"
      },
      시간: {
        required: false, 
        weight: 6, 
        type: "enum", 
        options: ["짧게(5-10분)", "중간(10-30분)", "길게(30분 이상)", "기타"],
        question: "발표 시간은 얼마나 될 예정인가요?"
      },
      스타일: {
        required: false, 
        weight: 5, 
        type: "enum", 
        options: ["미니멀", "비즈니스", "창의적", "학술적", "상관없음", "기타"],
        question: "디자인 스타일은 어떻게 할까요?"
      }
    }
  },

  // 분석/마케팅 도메인
  "analysis_marketing": {
    keywords: ["분석", "데이터", "마케팅", "광고", "카피", "통계", "차트", "캠페인"],
    slots: {
      목적: {
        required: true, 
        weight: 10, 
        type: "enum", 
        options: ["데이터분석", "마케팅전략", "광고기획", "카피라이팅", "시장조사", "기타"],
        question: "주요 목적은 무엇인가요?"
      },
      대상: {
        required: true, 
        weight: 9, 
        type: "text", 
        placeholder: "예: 20-30대 여성, B2B 기업, 스타트업 등",
        question: "타겟 고객이나 분석 대상을 알려주세요"
      },
      목표: {
        required: false, 
        weight: 8, 
        type: "text", 
        placeholder: "예: 매출 증가, 브랜드 인지도 향상 등",
        question: "구체적인 목표나 KPI가 있나요?"
      },
      형태: {
        required: false, 
        weight: 7, 
        type: "enum", 
        options: ["보고서", "차트/그래프", "캠페인", "카피", "전략문서", "기타"],
        question: "원하는 결과물 형태는 무엇인가요?"
      },
      톤: {
        required: false, 
        weight: 6, 
        type: "enum", 
        options: ["전문적", "친근한", "공격적", "보수적", "혁신적", "기타"],
        question: "어떤 톤이나 접근 방식을 원하시나요?"
      }
    }
  },

  // 음악/오디오 도메인
  "music_audio": {
    keywords: ["음악", "사운드", "오디오", "작곡", "소리", "BGM", "효과음", "노래"],
    slots: {
      유형: {
        required: true, 
        weight: 10, 
        type: "enum", 
        options: ["작곡/멜로디", "BGM/배경음악", "효과음", "사운드디자인", "오디오편집", "기타"],
        question: "어떤 종류의 오디오 작업인가요?"
      },
      장르: {
        required: false, 
        weight: 8, 
        type: "enum", 
        options: ["클래식", "팝", "록", "전자음악", "재즈", "힙합", "앰비언트", "기타"],
        question: "음악 장르나 스타일은 어떻게 할까요?"
      },
      길이: {
        required: false, 
        weight: 7, 
        type: "enum", 
        options: ["짧게(30초 이하)", "중간(1-3분)", "길게(3분 이상)", "루프", "기타"],
        question: "음악 길이는 어느 정도로 할까요?"
      },
      용도: {
        required: false, 
        weight: 8, 
        type: "enum", 
        options: ["영상BGM", "게임음악", "광고", "개인감상", "공연", "기타"],
        question: "어떤 용도로 사용하실 건가요?"
      },
      분위기: {
        required: false, 
        weight: 7, 
        type: "enum", 
        options: ["밝고경쾌한", "차분한", "긴장감있는", "슬픈", "웅장한", "로맨틱", "기타"],
        question: "어떤 분위기나 감정을 표현하고 싶나요?"
      }
    }
  }
};

/**
 * 도메인 감지 함수
 */
export function detectDomains(userInput) {
  const detectedDomains = [];
  const input = userInput.toLowerCase();
  
  for (const [domainKey, domainConfig] of Object.entries(DOMAIN_SLOTS)) {
    const matchCount = domainConfig.keywords.filter(keyword => 
      input.includes(keyword)
    ).length;
    
    if (matchCount > 0) {
      const confidence = matchCount / domainConfig.keywords.length;
      detectedDomains.push({
        domain: domainKey,
        confidence: confidence,
        matchCount: matchCount,
        slots: domainConfig.slots
      });
    }
  }
  
  // 신뢰도 순으로 정렬
  return detectedDomains.sort((a, b) => b.confidence - a.confidence);
}

/**
 * 슬롯 우선순위 계산 (엔트로피 기반)
 */
export function calculateSlotPriority(slot, domainWeight = 1.0, mentionedInfo = {}) {
  // 이미 언급된 슬롯은 우선순위 0
  if (mentionedInfo[slot.name]) {
    return 0;
  }
  
  let priority = slot.weight * domainWeight;
  
  // 필수 슬롯 가중치
  if (slot.required) {
    priority *= 1.5;
  }
  
  // 엔트로피 가중치 (선택지가 많을수록 불확실성 높음)
  if (slot.type === 'enum' && slot.options) {
    const entropy = Math.log(slot.options.length) / Math.log(7); // 정규화 (7개 기준)
    priority *= (0.7 + 0.3 * entropy);
  } else if (slot.type === 'text') {
    priority *= 0.9; // 텍스트 입력은 약간 낮은 우선순위
  }
  
  return priority;
}

/**
 * 슬롯에서 질문 생성
 */
export function generateQuestionFromSlot(slotName, slotConfig, domainName) {
  return {
    question: slotConfig.question,
    type: slotConfig.type,
    options: slotConfig.options,
    placeholder: slotConfig.placeholder,
    category: slotName,
    domain: domainName,
    required: slotConfig.required,
    weight: slotConfig.weight
  };
}

/**
 * 스마트 질문 생성 메인 함수
 */
export function generateSmartQuestions(userInput, maxQuestions = 8) {
  // 1. 도메인 감지
  const detectedDomains = detectDomains(userInput);
  
  if (detectedDomains.length === 0) {
    return generateFallbackQuestions();
  }
  
  console.log('감지된 도메인:', detectedDomains.map(d => `${d.domain}(${d.confidence.toFixed(2)})`));
  
  // 2. 사용자 언급 정보 추출 (다음 모듈에서 구현)
  const mentionedInfo = extractMentionedInfoBasic(userInput);
  console.log('언급된 정보:', mentionedInfo);
  
  // 3. 모든 슬롯 수집 및 우선순위 계산
  const allSlots = [];
  
  detectedDomains.forEach((domainInfo, index) => {
    const domainWeight = index === 0 ? 1.0 : 0.6; // 주 도메인 vs 부 도메인
    
    Object.entries(domainInfo.slots).forEach(([slotName, slotConfig]) => {
      const priority = calculateSlotPriority(
        { ...slotConfig, name: slotName }, 
        domainWeight, 
        mentionedInfo
      );
      
      if (priority > 0) { // 우선순위가 0보다 큰 것만 포함
        allSlots.push({
          name: slotName,
          domain: domainInfo.domain,
          config: slotConfig,
          priority: priority
        });
      }
    });
  });
  
  // 4. 우선순위 정렬 및 상위 선택
  allSlots.sort((a, b) => b.priority - a.priority);
  const selectedSlots = allSlots.slice(0, maxQuestions);
  
  console.log('선택된 슬롯들:', selectedSlots.map(s => `${s.name}(${s.priority.toFixed(1)})`));
  
  // 5. 질문 생성
  return selectedSlots.map(slot => 
    generateQuestionFromSlot(slot.name, slot.config, slot.domain)
  );
}

/**
 * 기본 언급 정보 추출 (간단한 버전)
 */
function extractMentionedInfoBasic(userInput) {
  const mentioned = {};
  const input = userInput.toLowerCase();
  
  // 색상 추출
  const colors = ['빨간', '파란', '노란', '검은', '흰', '초록', '보라', '분홍', '갈색', '회색', '황금', '은색'];
  colors.forEach(color => {
    if (input.includes(color)) {
      mentioned['색상'] = color + '색';
    }
  });
  
  // 스타일 추출
  const styles = ['3d', '애니메이션', '실사', '만화', '일러스트', '수채화'];
  styles.forEach(style => {
    if (input.includes(style)) {
      mentioned['스타일'] = style;
    }
  });
  
  // 크기/길이 추출
  const sizes = ['짧은', '긴', '작은', '큰', '소형', '대형', '미니'];
  sizes.forEach(size => {
    if (input.includes(size)) {
      mentioned['크기'] = size;
    }
  });
  
  // 목적 추출
  const purposes = ['교육', '광고', '홍보', '발표', '개인용', '상업용'];
  purposes.forEach(purpose => {
    if (input.includes(purpose)) {
      mentioned['목적'] = purpose;
    }
  });
  
  return mentioned;
}

/**
 * 기본 질문 (도메인 감지 실패시)
 */
function generateFallbackQuestions() {
  return [
    {
      question: "어떤 종류의 작업을 원하시나요?",
      type: "choice",
      options: ["글쓰기/텍스트", "개발/프로그래밍", "이미지/디자인", "영상", "발표자료", "분석/마케팅", "음악/오디오", "기타"],
      category: "기본분류",
      domain: "general"
    }
  ];
}

/**
 * 슬롯 완성도 체크
 */
export function checkSlotCompleteness(answers, domainSlots) {
  const completeness = {
    total: 0,
    filled: 0,
    required: 0,
    requiredFilled: 0,
    missing: []
  };
  
  Object.entries(domainSlots).forEach(([slotName, slotConfig]) => {
    completeness.total++;
    
    if (slotConfig.required) {
      completeness.required++;
    }
    
    if (answers[slotName] && answers[slotName] !== '') {
      completeness.filled++;
      if (slotConfig.required) {
        completeness.requiredFilled++;
      }
    } else {
      completeness.missing.push({
        name: slotName,
        required: slotConfig.required,
        weight: slotConfig.weight,
        question: slotConfig.question
      });
    }
  });
  
  completeness.fillRate = completeness.filled / completeness.total;
  completeness.requiredFillRate = completeness.required > 0 ? 
    completeness.requiredFilled / completeness.required : 1;
  
  return completeness;
}

// 테스트 함수
export function testSlotSystem() {
  const testCases = [
    "빨간색 강아지 그림 그려줘",
    "웹사이트 만들어줘",
    "3분짜리 요리 영상 만들어줘",
    "비즈니스 발표 PPT 만들어줘",
    "마케팅 전략 보고서 써줘"
  ];
  
  testCases.forEach(testInput => {
    console.log(`\n=== 테스트: "${testInput}" ===`);
    const questions = generateSmartQuestions(testInput, 5);
    questions.forEach((q, i) => {
      console.log(`${i+1}. [${q.domain}/${q.category}] ${q.question}`);
    });
  });
}

export default {
  DOMAIN_SLOTS,
  detectDomains,
  generateSmartQuestions,
  calculateSlotPriority,
  checkSlotCompleteness,
  testSlotSystem
};
