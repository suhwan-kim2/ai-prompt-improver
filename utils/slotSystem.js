// utils/slotSystem.js - 완전 개선된 슬롯 기반 질문 시스템

class SlotSystem {
  constructor() {
    // 6개 도메인별 슬롯 시스템 (확장됨)
    this.domainSlots = {
      visual_design: {
        주제: { 
          required: true, weight: 10, type: "text", 
          question: "정확히 어떤 주제로 그림을 만들고 싶으신가요?",
          step1: true
        },
        스타일: { 
          required: true, weight: 9, type: "enum", 
          options: ["사실적", "3D렌더링", "애니메이션", "일러스트", "수채화", "유화", "기타"],
          question: "어떤 스타일로 제작하고 싶으신가요?",
          step1: true
        },
        색상: { 
          required: false, weight: 8, type: "enum", 
          options: ["따뜻한톤", "차가운톤", "모노톤", "비비드", "파스텔", "기타"],
          question: "선호하는 색상 톤이 있나요?",
          step1: true
        },
        크기: { 
          required: false, weight: 7, type: "enum", 
          options: ["정사각형(1:1)", "가로형(16:9)", "세로형(9:16)", "A4용지", "상관없음", "기타"],
          question: "어떤 크기나 비율로 만들까요?",
          step1: true
        },
        
        // 2-3단계 전문 질문들
        표정: {
          required: false, weight: 9, type: "enum",
          options: ["밝고 긍정적", "진지하고 집중", "신비롭고 몽환적", "역동적이고 열정적", "무표정/중립", "기타"],
          question: "주인공의 표정이나 감정 표현은 어떻게 할까요?",
          step2: true
        },
        포즈: {
          required: false, weight: 8, type: "enum",
          options: ["정면 직립", "측면 프로필", "역동적 동작", "앉아있는 자세", "자유로운 포즈", "기타"],
          question: "구체적인 포즈나 동작이 있나요?",
          step2: true
        },
        의상: {
          required: false, weight: 7, type: "enum",
          options: ["현대적/일상복", "전통적/클래식", "미래적/SF", "판타지/코스튬", "없음", "기타"],
          question: "의상이나 액세서리는 어떻게 할까요?",
          step2: true
        },
        조명: { 
          required: false, weight: 6, type: "enum", 
          options: ["밝고 화사한", "어둡고 드라마틱", "부드럽고 몽환적", "강렬한 명암", "자연광", "기타"],
          question: "조명과 분위기는 어떻게 설정할까요?",
          step2: true
        },
        배경: { 
          required: false, weight: 6, type: "text", 
          question: "배경 환경을 자세히 설명해주세요 (예: 우주 성운, 숲 속, 도시 등)",
          step2: true
        },
        
        // 4-10단계 디테일 질문들  
        각도: { 
          required: false, weight: 5, type: "enum", 
          options: ["정면", "측면", "위에서", "아래서", "3/4 각도", "기타"],
          question: "어떤 카메라 각도나 구도를 원하시나요?",
          step3: true
        },
        품질: {
          required: false, weight: 4, type: "enum",
          options: ["초고품질/8K", "고품질/4K", "일반품질/HD", "빠른 제작용", "기타"],
          question: "품질과 디테일 수준은 어느 정도로 할까요?",
          step3: true
        },
        소품: {
          required: false, weight: 3, type: "text",
          question: "손에 들고 있거나 주변에 있었으면 하는 소품이나 도구가 있나요?",
          step3: true
        }
      },
      
      video: {
        목적: { 
          required: true, weight: 10, type: "enum", 
          options: ["광고/홍보", "교육/설명", "엔터테인먼트", "기록/다큐", "소셜미디어", "기타"],
          question: "영상의 주요 목적이 무엇인가요?",
          step1: true
        },
        길이: { 
          required: true, weight: 9, type: "enum", 
          options: ["15초 이하", "30초-1분", "1-3분", "5분 이상", "정해지지 않음", "기타"],
          question: "영상 길이는 대략 어느 정도인가요?",
          step1: true
        },
        스타일: { 
          required: true, weight: 8, type: "enum", 
          options: ["실사촬영", "애니메이션", "모션그래픽", "슬라이드쇼", "혼합", "기타"],
          question: "어떤 스타일의 영상을 원하시나요?",
          step1: true
        },
        
        // 2-3단계
        오프닝: {
          required: false, weight: 7, type: "enum",
          options: ["페이드인", "강렬한 시작", "로고/타이틀", "내레이션 시작", "액션 장면", "기타"],
          question: "오프닝 장면은 어떻게 시작할까요?",
          step2: true
        },
        전환: {
          required: false, weight: 6, type: "enum",
          options: ["부드러운 전환", "컷 편집", "특수효과 전환", "매치컷", "디졸브", "기타"],
          question: "주요 장면 전환은 어떻게 처리할까요?",
          step2: true
        },
        음악: { 
          required: false, weight: 6, type: "enum", 
          options: ["업비트/경쾌한", "감성적/잔잔한", "웅장한/오케스트라", "일렉트로닉", "음악 없음", "기타"],
          question: "배경음악 스타일은 어떻게 할까요?",
          step2: true
        }
      },
      
      development: {
        프로젝트유형: { 
          required: true, weight: 10, type: "enum", 
          options: ["웹사이트", "모바일앱", "데스크톱앱", "게임", "API/백엔드", "기타"],
          question: "어떤 종류의 개발 프로젝트인가요?",
          step1: true
        },
        주요기능: { 
          required: true, weight: 9, type: "text", 
          question: "가장 중요한 기능이나 목적이 무엇인가요?",
          step1: true
        },
        대상사용자: { 
          required: false, weight: 8, type: "enum", 
          options: ["일반 소비자", "기업/비즈니스", "개발자", "학생/교육", "전문가", "기타"],
          question: "주요 사용자층은 누구인가요?",
          step1: true
        },
        기술스택: { 
          required: false, weight: 7, type: "enum", 
          options: ["React/Vue", "HTML/CSS/JS", "Python", "Java", "상관없음", "기타"],
          question: "선호하는 기술 스택이 있나요?",
          step1: true
        }
      },
      
      text_language: {
        종류: {
          required: true, weight: 10, type: "enum",
          options: ["비즈니스 문서", "창작 글쓰기", "기술 문서", "마케팅 카피", "교육 자료", "기타"],
          question: "어떤 종류의 텍스트인가요?",
          step1: true
        },
        대상독자: {
          required: true, weight: 9, type: "enum", 
          options: ["일반인", "전문가", "학생", "고객", "팀원/동료", "기타"],
          question: "대상 독자는 누구인가요?",
          step1: true
        },
        톤: {
          required: false, weight: 8, type: "enum",
          options: ["격식있게", "친근하게", "전문적으로", "창의적으로", "간결하게", "기타"],
          question: "글의 톤은 어떻게 하고 싶으신가요?",
          step1: true
        }
      },
      
      business: {
        분야: {
          required: true, weight: 10, type: "enum",
          options: ["IT/테크", "마케팅/광고", "교육", "헬스케어", "금융", "기타"],
          question: "어떤 분야의 비즈니스인가요?",
          step1: true
        },
        목표: { 
          required: true, weight: 9, type: "enum", 
          options: ["매출 증대", "브랜딩", "고객 확보", "효율성 개선", "혁신", "기타"],
          question: "주요 목표가 무엇인가요?",
          step1: true
        },
        예산: { 
          required: false, weight: 7, type: "enum", 
          options: ["제한적", "적당함", "충분함", "대규모", "미정", "기타"],
          question: "예산 규모는 어느 정도인가요?",
          step1: true
        }
      },
      
      music_audio: {
        장르: {
          required: true, weight: 10, type: "enum",
          options: ["팝", "록", "클래식", "재즈", "일렉트로닉", "기타"],
          question: "어떤 장르의 음악인가요?",
          step1: true
        },
        분위기: { 
          required: true, weight: 9, type: "enum", 
          options: ["밝고 경쾌한", "차분하고 잔잔한", "웅장하고 드라마틱", "어둡고 미스테리한", "기타"],
          question: "음악의 분위기는 어떻게 하고 싶으신가요?",
          step1: true
        },
        용도: { 
          required: false, weight: 8, type: "enum", 
          options: ["배경음악", "주제곡", "효과음", "광고음악", "기타"],
          question: "음악의 용도가 무엇인가요?",
          step1: true
        }
      }
    };
    
    // 도메인 감지용 키워드
    this.domainKeywords = {
      visual_design: ["그림", "이미지", "사진", "포스터", "로고", "디자인", "일러스트", "드로잉", "페인팅"],
      video: ["영상", "비디오", "동영상", "애니메이션", "영화", "광고", "편집", "촬영"],
      development: ["웹사이트", "앱", "프로그램", "시스템", "코딩", "개발", "소프트웨어", "플랫폼"],
      text_language: ["글", "텍스트", "문서", "기사", "블로그", "내용", "작성", "번역"],
      business: ["사업", "비즈니스", "전략", "마케팅", "브랜딩", "매출", "고객", "시장"],
      music_audio: ["음악", "소리", "오디오", "노래", "멜로디", "사운드", "작곡"]
    };
  }
  
  // =============================================================================
  // 🎯 핵심 질문 생성 함수들 (API에서 호출)
  // =============================================================================
  
  // 1단계: 기본 질문 생성
  generateStep1Questions(domainInfo, mentionedInfo = {}) {
    console.log('🔍 SlotSystem: 1단계 질문 생성', { domain: domainInfo.primary });
    
    try {
      const domain = domainInfo.primary || 'visual_design';
      const slots = this.domainSlots[domain] || this.domainSlots.visual_design;
      
      const step1Questions = [];
      
      // step1: true인 슬롯들만 가져오기
      Object.entries(slots)
        .filter(([key, slot]) => slot.step1 && !mentionedInfo[key])
        .sort(([,a], [,b]) => b.weight - a.weight) // 가중치 순
        .slice(0, 4) // 최대 4개
        .forEach(([key, slot]) => {
          step1Questions.push({
            question: slot.question,
            options: slot.options || ["네", "아니오", "모르겠음", "기타"],
            type: slot.type,
            slotKey: key
          });
        });
      
      console.log(`✅ ${domain} 도메인 1단계 질문 ${step1Questions.length}개 생성`);
      return step1Questions;
      
    } catch (error) {
      console.error('❌ 1단계 질문 생성 오류:', error);
      return this.generateFallbackQuestions();
    }
  }
  
  // 2-3단계: 전문 질문 생성
  generateStep2_3Questions(domainInfo, mentionedInfo = {}, currentStep = 2) {
    console.log('🔍 SlotSystem: 2-3단계 질문 생성', { domain: domainInfo.primary, step: currentStep });
    
    try {
      const domain = domainInfo.primary || 'visual_design';
      const slots = this.domainSlots[domain] || this.domainSlots.visual_design;
      
      const step2Questions = [];
      
      // step2: true인 슬롯들만 가져오기
      Object.entries(slots)
        .filter(([key, slot]) => slot.step2 && !mentionedInfo[key])
        .sort(([,a], [,b]) => b.weight - a.weight) // 가중치 순
        .slice(0, 5) // 최대 5개
        .forEach(([key, slot]) => {
          step2Questions.push({
            question: slot.question,
            options: slot.options || ["네", "아니오", "모르겠음", "기타"],
            type: slot.type,
            slotKey: key
          });
        });
      
      console.log(`✅ ${domain} 도메인 2-3단계 질문 ${step2Questions.length}개 생성`);
      return step2Questions;
      
    } catch (error) {
      console.error('❌ 2-3단계 질문 생성 오류:', error);
      return this.generateFallbackQuestions();
    }
  }
  
  // 4-10단계: 디테일 질문 생성
  generateDetailQuestions(domainInfo, mentionedInfo = {}, currentStep = 4) {
    console.log('🔍 SlotSystem: 디테일 질문 생성', { domain: domainInfo.primary, step: currentStep });
    
    try {
      const domain = domainInfo.primary || 'visual_design';
      const slots = this.domainSlots[domain] || this.domainSlots.visual_design;
      
      const detailQuestions = [];
      
      // step3: true인 슬롯들 + 아직 안 물어본 것들
      Object.entries(slots)
        .filter(([key, slot]) => (slot.step3 || !slot.step1 && !slot.step2) && !mentionedInfo[key])
        .sort(([,a], [,b]) => b.weight - a.weight)
        .slice(0, 3) // 최대 3개
        .forEach(([key, slot]) => {
          detailQuestions.push({
            question: slot.question,
            options: slot.options || ["네", "아니오", "모르겠음", "기타"],
            type: slot.type,
            slotKey: key
          });
        });
      
      // 부족하면 일반 질문 추가
      if (detailQuestions.length < 2) {
        detailQuestions.push({
          question: "특별히 강조하고 싶은 부분이나 요소가 있나요?",
          options: ["주제/캐릭터", "배경/환경", "색상/분위기", "디테일/질감", "전체 조화", "기타"],
          type: "enum"
        });
      }
      
      console.log(`✅ ${domain} 도메인 디테일 질문 ${detailQuestions.length}개 생성`);
      return detailQuestions;
      
    } catch (error) {
      console.error('❌ 디테일 질문 생성 오류:', error);
      return this.generateFallbackQuestions();
    }
  }
  
  // =============================================================================
  // 🛠️ 기존 함수들 (유지)
  // =============================================================================
  
  // 도메인 감지
  detectDomains(userInput) {
    try {
      const input = userInput.toLowerCase();
      const domainScores = {};
      
      // 각 도메인별 키워드 매칭
      Object.entries(this.domainKeywords).forEach(([domain, keywords]) => {
        domainScores[domain] = 0;
        keywords.forEach(keyword => {
          if (input.includes(keyword)) {
            domainScores[domain] += 1;
          }
        });
      });
      
      // 점수 기반 정렬
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
  
  // 폴백 질문 생성
  generateFallbackQuestions() {
    return [
      {
        question: "구체적으로 어떤 결과물을 원하시나요?",
        options: ["이미지/그림", "영상/동영상", "텍스트/문서", "프로그램/앱", "기획/전략", "기타"],
        type: "enum"
      },
      {
        question: "누가 주로 사용하거나 볼 예정인가요?",
        options: ["나 혼자", "팀/동료", "고객/클라이언트", "일반 대중", "전문가", "기타"],
        type: "enum"
      },
      {
        question: "어떤 스타일이나 느낌을 선호하시나요?",
        options: ["심플하고 깔끔한", "화려하고 역동적인", "전문적이고 격식있는", "친근하고 따뜻한", "상관없음", "기타"],
        type: "enum"
      }
    ];
  }
  
  // 슬롯 정보 가져오기
  getSlots(domain) {
    return this.domainSlots[domain] || this.domainSlots.visual_design;
  }
  
  // 11-20단계: 고급 질문 생성
  generateAdvancedQuestions(domainInfo, mentionedInfo = {}, currentStep = 11) {
    console.log('🔍 SlotSystem: 고급 질문 생성', { domain: domainInfo.primary, step: currentStep });
    
    try {
      const domain = domainInfo.primary || 'visual_design';
      
      // 아직 안 물어본 모든 슬롯들
      const allSlots = this.domainSlots[domain] || this.domainSlots.visual_design;
      const remainingSlots = Object.entries(allSlots)
        .filter(([key, slot]) => !mentionedInfo[key])
        .sort(([,a], [,b]) => b.weight - a.weight);
      
      const advancedQuestions = [];
      
      // 남은 슬롯이 있으면 활용
      if (remainingSlots.length > 0) {
        remainingSlots.slice(0, 2).forEach(([key, slot]) => {
          advancedQuestions.push({
            question: slot.question,
            options: slot.options || ["네", "아니오", "모르겠음", "기타"],
            type: slot.type,
            slotKey: key
          });
        });
      }
      
      // 고급 메타 질문들 추가
      const metaQuestions = [
        {
          question: "현재까지의 설정에서 더 강조하고 싶은 부분이 있나요?",
          options: ["주요 주제", "스타일/분위기", "기술적 품질", "사용자 경험", "독창성", "기타"],
          type: "enum"
        },
        {
          question: "완성도와 디테일 수준은 어느 정도로 할까요?",
          options: ["최고급/완벽", "고급/세밀", "일반/적당", "빠른 제작", "기타"],
          type: "enum"
        },
        {
          question: "참고하거나 피하고 싶은 스타일이 있나요?",
          options: ["특정 브랜드 스타일", "유명 작품 스타일", "트렌드 스타일", "피하고 싶은 것", "없음", "기타"],
          type: "enum"
        }
      ];
      
      // 부족하면 메타 질문 추가
      while (advancedQuestions.length < 3 && metaQuestions.length > 0) {
        advancedQuestions.push(metaQuestions.shift());
      }
      
      console.log(`✅ 고급 질문 ${advancedQuestions.length}개 생성`);
      return advancedQuestions;
      
    } catch (error) {
      console.error('❌ 고급 질문 생성 오류:', error);
      return this.generateFallbackQuestions();
    }
  }
}

// Node.js 환경에서 사용할 수 있도록 export
const slotSystem = new SlotSystem();
module.exports = { SlotSystem, slotSystem };
