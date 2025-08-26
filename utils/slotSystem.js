// utils/slotSystem.js - AI 대화형 시스템 (기본 틀만 제공)

class SlotSystem {
  constructor() {
    // 🎯 1단계 기본 질문만 (도메인 파악용)
    this.step1Questions = {
      visual_design: [
        {
          question: "어떤 스타일로 만들고 싶으신가요?",
          options: ["사실적", "3D렌더링", "애니메이션", "일러스트", "수채화", "기타"]
        },
        {
          question: "주요 색상 톤은 어떻게 할까요?",
          options: ["따뜻한톤", "차가운톤", "모노톤", "비비드", "파스텔", "기타"]
        },
        {
          question: "이미지 크기나 비율이 정해져 있나요?",
          options: ["정사각형(1:1)", "가로형(16:9)", "세로형(9:16)", "A4용지", "상관없음", "기타"]
        },
        {
          question: "해상도나 품질 요구사항이 있나요?",
          options: ["일반 웹용", "고화질(4K)", "인쇄용", "모바일용", "상관없음", "기타"]
        }
      ],
      
      video: [
        {
          question: "영상의 주요 목적이 무엇인가요?",
          options: ["광고/홍보", "교육/설명", "엔터테인먼트", "기록/다큐", "소셜미디어", "기타"]
        },
        {
          question: "영상 길이는 대략 어느 정도인가요?",
          options: ["15초 이하", "30초-1분", "1-3분", "5분 이상", "정해지지 않음", "기타"]
        },
        {
          question: "어떤 스타일의 영상을 원하시나요?",
          options: ["실사촬영", "애니메이션", "모션그래픽", "슬라이드쇼", "혼합", "기타"]
        }
      ],
      
      development: [
        {
          question: "어떤 종류의 개발 프로젝트인가요?",
          options: ["웹사이트", "모바일앱", "데스크톱앱", "게임", "API/백엔드", "기타"]
        },
        {
          question: "주요 사용자층은 누구인가요?",
          options: ["일반 소비자", "기업/비즈니스", "개발자", "학생/교육", "전문가", "기타"]
        },
        {
          question: "선호하는 기술 스택이 있나요?",
          options: ["React/Vue", "HTML/CSS/JS", "Python", "Java", "상관없음", "기타"]
        }
      ],
      
      text_language: [
        {
          question: "어떤 종류의 텍스트인가요?",
          options: ["비즈니스 문서", "창작 글쓰기", "기술 문서", "마케팅 카피", "교육 자료", "기타"]
        },
        {
          question: "대상 독자는 누구인가요?",
          options: ["일반인", "전문가", "학생", "고객", "팀원/동료", "기타"]
        },
        {
          question: "글의 톤은 어떻게 하고 싶으신가요?",
          options: ["격식있게", "친근하게", "전문적으로", "창의적으로", "간결하게", "기타"]
        }
      ],
      
      business: [
        {
          question: "어떤 분야의 비즈니스인가요?",
          options: ["IT/테크", "마케팅/광고", "교육", "헬스케어", "금융", "기타"]
        },
        {
          question: "주요 목표가 무엇인가요?",
          options: ["매출 증대", "브랜딩", "고객 확보", "효율성 개선", "혁신", "기타"]
        },
        {
          question: "예산 규모는 어느 정도인가요?",
          options: ["제한적", "적당함", "충분함", "대규모", "미정", "기타"]
        }
      ],
      
      music_audio: [
        {
          question: "어떤 장르의 음악인가요?",
          options: ["팝", "록", "클래식", "재즈", "일렉트로닉", "기타"]
        },
        {
          question: "음악의 분위기는 어떻게 하고 싶으신가요?",
          options: ["밝고 경쾌한", "차분하고 잔잔한", "웅장하고 드라마틱", "어둡고 미스테리한", "기타"]
        },
        {
          question: "음악의 용도가 무엇인가요?",
          options: ["배경음악", "주제곡", "효과음", "광고음악", "기타"]
        }
      ]
    };
    
    // 도메인 감지용 키워드 (변경 없음)
    this.domainKeywords = {
      visual_design: ["그림", "이미지", "사진", "포스터", "로고", "디자인", "일러스트", "드로잉", "페인팅"],
      video: ["영상", "비디오", "동영상", "애니메이션", "영화", "광고", "편집", "촬영"],
      development: ["웹사이트", "앱", "프로그램", "시스템", "코딩", "개발", "소프트웨어", "플랫폼"],
      text_language: ["글", "텍스트", "문서", "기사", "블로그", "내용", "작성", "번역"],
      business: ["사업", "비즈니스", "전략", "마케팅", "브랜딩", "매출", "고객", "시장"],
      music_audio: ["음악", "소리", "오디오", "노래", "멜로디", "사운드", "작곡"]
    };
    
    // 🤖 AI 질문 생성용 도메인별 컨텍스트 (중요!)
    this.domainContext = {
      visual_design: {
        focusAreas: ["주체 특징", "감정/표정", "포즈/동작", "의상/소품", "배경 환경", "조명/분위기", "카메라 구도", "색상 디테일", "예술 스타일", "기술 사양"],
        expertTerms: ["composition", "lighting", "depth of field", "color palette", "art style", "resolution", "aspect ratio"],
        commonMistakes: ["모호한 주체", "불분명한 스타일", "부족한 디테일", "기술 사양 누락"]
      },
      
      video: {
        focusAreas: ["스토리라인", "캐릭터", "장면 구성", "카메라워크", "편집 스타일", "음향", "색보정", "자막"],
        expertTerms: ["cinematography", "color grading", "frame rate", "aspect ratio", "audio mix"],
        commonMistakes: ["unclear narrative", "missing audio", "no editing style", "resolution not specified"]
      },
      
      development: {
        focusAreas: ["핵심 기능", "사용자 인터페이스", "데이터 구조", "보안", "성능", "확장성", "호환성"],
        expertTerms: ["user experience", "API design", "database schema", "responsive design", "security"],
        commonMistakes: ["vague requirements", "missing user stories", "no tech stack", "unclear scope"]
      }
    };
  }
  
  // =============================================================================
  // 🎯 1단계: 기본 도메인 질문만 (나머지는 AI가)
  // =============================================================================
  generateStep1Questions(domainInfo, mentionedInfo = {}) {
    console.log('🔍 SlotSystem: 1단계 기본 질문 생성', { domain: domainInfo.primary });
    
    try {
      const domain = domainInfo.primary || 'visual_design';
      const baseQuestions = this.step1Questions[domain] || this.step1Questions.visual_design;
      
      // 이미 언급된 정보 필터링
      const filteredQuestions = baseQuestions.filter(q => {
        return !this.isAlreadyMentioned(q.question, mentionedInfo);
      });
      
      console.log(`✅ ${domain} 도메인 1단계 질문 ${filteredQuestions.length}개 생성`);
      return filteredQuestions.slice(0, 4); // 최대 4개
      
    } catch (error) {
      console.error('❌ 1단계 질문 생성 오류:', error);
      return this.generateFallbackQuestions();
    }
  }
  
  // =============================================================================
  // 🤖 AI 질문 생성용 컨텍스트 제공
  // =============================================================================
  
  // AI에게 줄 도메인 컨텍스트
  getAIContext(domain) {
    return this.domainContext[domain] || this.domainContext.visual_design;
  }
  
  // AI 질문 생성을 위한 현재 상태 분석
  analyzeCurrentState(userInput, answers, intentScore) {
    const analysis = {
      originalRequest: userInput,
      conversationLength: answers.length,
      currentScore: intentScore,
      missingAspects: this.identifyMissingAspects(userInput, answers),
      nextFocusArea: this.suggestNextFocus(answers, intentScore),
      urgency: this.calculateUrgency(intentScore)
    };
    
    return analysis;
  }
  
  // 부족한 측면 식별
  identifyMissingAspects(userInput, answers) {
    const domain = this.detectDomains(userInput).primary;
    const context = this.getAIContext(domain);
    
    const mentioned = [userInput, ...answers].join(' ').toLowerCase();
    
    return context.focusAreas.filter(area => {
      const areaKeywords = this.getAreaKeywords(area);
      return !areaKeywords.some(keyword => mentioned.includes(keyword.toLowerCase()));
    });
  }
  
  // 영역별 키워드
  getAreaKeywords(area) {
    const keywordMap = {
      "주체 특징": ["품종", "나이", "크기", "특징"],
      "감정/표정": ["표정", "감정", "눈빛", "미소"],
      "포즈/동작": ["포즈", "자세", "동작", "움직임"],
      "배경 환경": ["배경", "환경", "장소", "위치"],
      "조명/분위기": ["조명", "빛", "분위기", "무드"],
      "카메라 구도": ["각도", "구도", "시점", "거리"]
    };
    
    return keywordMap[area] || [area];
  }
  
  // 다음 집중 영역 제안
  suggestNextFocus(answers, intentScore) {
    if (intentScore < 50) return "기본 정보";
    if (intentScore < 75) return "디테일";
    return "완성도";
  }
  
  // 긴급도 계산
  calculateUrgency(intentScore) {
    if (intentScore >= 95) return "완료";
    if (intentScore >= 80) return "마무리";
    if (intentScore >= 60) return "보통";
    return "높음";
  }
  
  // =============================================================================
  // 🛠️ 기존 함수들 (유지)
  // =============================================================================
  
  // 도메인 감지
  detectDomains(userInput) {
    try {
      const input = userInput.toLowerCase();
      const domainScores = {};
      
      Object.entries(this.domainKeywords).forEach(([domain, keywords]) => {
        domainScores[domain] = 0;
        keywords.forEach(keyword => {
          if (input.includes(keyword)) {
            domainScores[domain] += 1;
          }
        });
      });
      
      const sortedDomains = Object.entries(domainScores)
        .filter(([domain, score]) => score > 0)
        .sort(([,a], [,b]) => b - a);
      
      if (sortedDomains.length === 0) {
        return { primary: 'visual_design', secondary: [], confidence: 0.5 };
      }
      
      const primary = sortedDomains[0][0];
      const secondary = sortedDomains.slice(1, 3).map(([domain]) => domain);
      const confidence = Math.min(1, sortedDomains[0][1] / 3);
      
      return { primary, secondary, confidence };
    } catch (error) {
      console.error('도메인 감지 오류:', error);
      return { primary: 'visual_design', secondary: [], confidence: 0.5 };
    }
  }
  
  // 폴백 질문 (안전장치)
  generateFallbackQuestions() {
    return [
      {
        question: "구체적으로 어떤 결과물을 원하시나요?",
        options: ["이미지/그림", "영상/동영상", "텍스트/문서", "프로그램/앱", "기획/전략", "기타"]
      },
      {
        question: "누가 주로 사용하거나 볼 예정인가요?",
        options: ["나 혼자", "팀/동료", "고객/클라이언트", "일반 대중", "전문가", "기타"]
      },
      {
        question: "어떤 스타일이나 느낌을 선호하시나요?",
        options: ["심플하고 깔끔한", "화려하고 역동적인", "전문적이고 격식있는", "친근하고 따뜻한", "상관없음", "기타"]
      }
    ];
  }
  
  // 이미 언급된 정보인지 체크
  isAlreadyMentioned(question, mentionedInfo) {
    const questionLower = question.toLowerCase();
    const mentionedText = Object.values(mentionedInfo)
      .flat()
      .join(' ')
      .toLowerCase();
    
    // 간단한 키워드 매칭
    const questionKeywords = questionLower.match(/\b\w{3,}\b/g) || [];
    return questionKeywords.some(keyword => mentionedText.includes(keyword));
  }
}

// Export
const slotSystem = new SlotSystem();
module.exports = { SlotSystem, slotSystem };
