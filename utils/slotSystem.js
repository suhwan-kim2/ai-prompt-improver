// utils/slotSystem.js - 완전 수정된 버전

class SlotSystem {
  constructor() {
    // 🎯 도메인별 슬롯 시스템
    this.domainSlots = {
      visual_design: {
        주제: { required: true, weight: 10, type: "text", question: "정확히 어떤 주제로 그림을 만들고 싶으신가요?" },
        스타일: { required: true, weight: 9, type: "enum", options: ["사실적", "3D", "애니메이션", "일러스트", "수채화", "유화"], question: "어떤 스타일로 제작하고 싶으신가요?" },
        색상: { required: false, weight: 7, type: "enum", options: ["따뜻한톤", "차가운톤", "모노톤", "비비드", "파스텔"], question: "주요 색상 톤은 어떻게 설정할까요?" },
        크기: { required: false, weight: 6, type: "enum", options: ["정사각형", "가로형", "세로형", "4K", "HD"], question: "크기나 비율은 어떻게 하시겠어요?" },
        해상도: { required: false, weight: 5, type: "enum", options: ["HD", "4K", "8K", "인쇄용"], question: "해상도는 어떻게 설정할까요?" },
        배경: { required: false, weight: 6, type: "text", question: "배경은 어떻게 구성하고 싶으신가요?" },
        분위기: { required: false, weight: 4, type: "text", question: "어떤 분위기나 느낌을 원하시나요?" },
        용도: { required: false, weight: 3, type: "text", question: "어디에 사용하실 예정인가요?" }
      },
      
      video: {
        목적: { required: true, weight: 10, type: "enum", options: ["광고", "교육", "엔터테인먼트", "홍보", "튜토리얼"], question: "영상의 주요 목적이 무엇인가요?" },
        길이: { required: true, weight: 8, type: "enum", options: ["숏폼(~1분)", "중간(1-5분)", "긴편(5-10분)", "장편(10분+)"], question: "영상 길이는 어느 정도로 계획하시나요?" },
        스타일: { required: true, weight: 7, type: "enum", options: ["실사", "2D애니", "3D애니", "모션그래픽"], question: "어떤 스타일로 제작하고 싶나요?" },
        타겟: { required: false, weight: 6, type: "enum", options: ["유튜브", "인스타그램", "틱톡", "TV"], question: "주요 타겟 플랫폼은?" },
        음악: { required: false, weight: 5, type: "text", question: "배경음악은 어떤 스타일로?" },
        자막: { required: false, weight: 4, type: "enum", options: ["한국어", "영어", "다국어", "없음"], question: "자막은 어떻게 할까요?" }
      },
      
      development: {
        유형: { required: true, weight: 10, type: "enum", options: ["웹사이트", "모바일앱", "데스크톱", "API"], question: "어떤 종류의 프로그램을 만드시나요?" },
        사용자: { required: true, weight: 9, type: "enum", options: ["일반대중", "기업", "전문가", "학생"], question: "주요 사용자는 누구인가요?" },
        기능: { required: true, weight: 8, type: "text", question: "핵심 기능은 무엇인가요?" },
        기술: { required: false, weight: 7, type: "enum", options: ["React", "Vue", "Python", "Java"], question: "선호하는 기술이 있나요?" },
        우선순위: { required: false, weight: 6, type: "enum", options: ["속도", "안정성", "확장성", "사용성"], question: "개발 우선순위는?" }
      },
      
      general: {
        목표: { required: true, weight: 10, type: "text", question: "구체적으로 어떤 결과물을 원하시나요?" },
        대상: { required: false, weight: 8, type: "text", question: "누가 사용하거나 볼 예정인가요?" },
        제약: { required: false, weight: 7, type: "text", question: "특별한 제약이나 조건이 있나요?" },
        스타일: { required: false, weight: 6, type: "text", question: "선호하는 스타일이나 방향성이 있나요?" }
      }
    };
    
    // 🔍 도메인 감지용 키워드
    this.domainKeywords = {
      visual_design: ["그림", "이미지", "사진", "포스터", "로고", "디자인", "일러스트", "그려"],
      video: ["영상", "비디오", "동영상", "애니메이션", "영화", "광고", "편집"],
      development: ["웹사이트", "앱", "프로그램", "시스템", "코딩", "개발", "사이트"],
      text_language: ["글", "텍스트", "문서", "기사", "작성"],
      business: ["사업", "비즈니스", "전략", "마케팅"],
      music_audio: ["음악", "소리", "오디오", "노래"]
    };
  }
  
  // 🔍 도메인 감지
  detectDomains(userInput) {
    try {
      const input = userInput.toLowerCase();
      let bestDomain = 'general';
      let maxScore = 0;
      
      Object.entries(this.domainKeywords).forEach(([domain, keywords]) => {
        let score = 0;
        keywords.forEach(keyword => {
          if (input.includes(keyword)) {
            score += 1;
          }
        });
        
        if (score > maxScore) {
          maxScore = score;
          bestDomain = domain;
        }
      });
      
      return {
        primary: bestDomain,
        confidence: maxScore > 0 ? 0.8 : 0.5
      };
    } catch (error) {
      console.error('도메인 감지 오류:', error);
      return { primary: 'general', confidence: 0.5 };
    }
  }
  
  // 🎯 1단계 질문 생성
  generateStep1Questions(domainInfo, mentionedInfo = {}) {
    const domain = domainInfo.primary;
    
    // 도메인별 1단계 기본 질문들
    const step1Questions = {
      visual_design: [
        {
          question: "어떤 스타일로 제작하고 싶으신가요?",
          options: ["사실적/포토", "3D 렌더링", "애니메이션/만화", "일러스트/아트", "수채화/유화", "기타"]
        },
        {
          question: "주요 색상 톤은 어떻게 설정할까요?",
          options: ["따뜻한 톤", "차가운 톤", "모노톤/흑백", "비비드/선명한", "파스텔/부드러운", "기타"]
        },
        {
          question: "크기나 비율은 어떻게 하시겠어요?",
          options: ["정사각형(1:1)", "가로형(16:9)", "세로형(9:16)", "4K/고해상도", "HD/일반", "기타"]
        },
        {
          question: "배경 설정은 어떻게 할까요?",
          options: ["단색/그라데이션", "자연/야외", "실내/인테리어", "판타지/상상", "투명/없음", "기타"]
        }
      ],
      
      video: [
        {
          question: "영상의 주요 목적이 무엇인가요?",
          options: ["광고/마케팅", "교육/강의", "엔터테인먼트", "홍보/소개", "튜토리얼", "기타"]
        },
        {
          question: "영상 길이는 어느 정도로?",
          options: ["숏폼(~1분)", "중간(1-5분)", "긴편(5-10분)", "장편(10분+)", "상관없음", "기타"]
        },
        {
          question: "제작 스타일은?",
          options: ["실사 촬영", "2D 애니메이션", "3D 애니메이션", "모션그래픽", "혼합형", "기타"]
        },
        {
          question: "타겟 플랫폼은?",
          options: ["유튜브", "인스타그램", "틱톡", "TV/방송", "웹사이트", "기타"]
        }
      ],
      
      development: [
        {
          question: "어떤 프로그램을 만드시나요?",
          options: ["웹사이트", "모바일 앱", "데스크톱", "API/백엔드", "게임", "기타"]
        },
        {
          question: "주요 사용자는?",
          options: ["일반 대중", "기업/비즈니스", "전문가", "학생/교육", "내부용", "기타"]
        },
        {
          question: "핵심 기능은?",
          options: ["정보 제공", "상거래/결제", "커뮤니티", "데이터 관리", "도구/유틸", "기타"]
        },
        {
          question: "개발 우선순위는?",
          options: ["빠른 개발", "안정성", "확장성", "사용성", "보안", "기타"]
        }
      ],
      
      general: [
        {
          question: "구체적으로 어떤 결과물을 원하시나요?",
          options: ["창작물", "비즈니스 도구", "교육 자료", "개인 용도", "상관없음", "기타"]
        },
        {
          question: "누가 주로 사용하거나 볼 예정인가요?",
          options: ["나 혼자", "가족/친구", "동료/팀", "고객/대중", "상관없음", "기타"]
        },
        {
          question: "완성도나 품질 수준은?",
          options: ["최고급", "전문가급", "일반적", "빠른 제작", "상관없음", "기타"]
        }
      ]
    };
    
    return step1Questions[domain] || step1Questions.general;
  }
  
  // 🎯 2단계 전문 질문 생성 (도메인별 확장)
  generateStep2Questions(userInput, answers, domain) {
    console.log(`🔧 ${domain} 도메인 2단계 전문 질문 생성`);
    
    const answersText = answers.join(' ').toLowerCase();
    
    // 🎨 이미지 도메인 - 세부 디테일 질문들
    if (domain === 'visual_design') {
      return [
        {
          question: "강아지의 구체적인 품종이나 크기는?",
          options: ["골든리트리버 새끼", "포메라니안 성견", "진돗개 중형", "비글 소형", "대형견", "기타"]
        },
        {
          question: "어떤 표정이나 감정을 표현하고 싶나요?",
          options: ["행복한 미소", "호기심 가득한", "차분하고 온순한", "장난스러운", "졸린 표정", "기타"]
        },
        {
          question: "포즈나 자세는 어떻게?",
          options: ["앉아서 정면", "옆으로 누워있는", "서서 앞발 든", "뛰어가는", "장난감과 노는", "기타"]
        },
        {
          question: "우주 배경은 어떻게 표현할까요?",
          options: ["별들 반짝이는", "성운과 은하수", "행성들 보이는", "어둡고 깊은", "밝고 환상적", "기타"]
        },
        {
          question: "조명이나 빛의 분위기는?",
          options: ["따뜻한 황금빛", "자연스러운 햇빛", "부드러운 조명", "드라마틱한", "밝고 균등한", "기타"]
        },
        {
          question: "우주복이나 장비를 입히나요?",
          options: ["흰색 우주복", "투명 헬멧", "산소통", "장갑과 부츠", "없음/자연스럽게", "기타"]
        }
      ];
    }
    
    // 🎬 비디오 도메인
    else if (domain === 'video') {
      return [
        {
          question: "주인공은 누구인가요?",
          options: ["사람", "동물", "캐릭터", "제품", "풍경", "기타"]
        },
        {
          question: "주요 장면은 어떻게?",
          options: ["실내 촬영", "야외 촬영", "스튜디오", "특수 배경", "애니메이션", "기타"]
        },
        {
          question: "카메라 워크는?",
          options: ["고정샷", "패닝", "줌인/아웃", "핸드헬드", "드론샷", "기타"]
        },
        {
          question: "음향은 어떻게?",
          options: ["배경음악만", "내레이션", "효과음", "무음", "라이브음성", "기타"]
        }
      ];
    }
    
    // 🔧 개발 도메인
    else if (domain === 'development') {
      return [
        {
          question: "어떤 기술로 만들고 싶나요?",
          options: ["HTML/CSS/JS", "React/Vue", "Python", "Java", "상관없음", "기타"]
        },
        {
          question: "데이터베이스가 필요한가요?",
          options: ["간단한 저장", "복잡한 DB", "클라우드", "없음", "모르겠음", "기타"]
        },
        {
          question: "사용자 로그인이 필요한가요?",
          options: ["필요함", "선택사항", "없음", "소셜로그인", "모르겠음", "기타"]
        },
        {
          question: "모바일 지원이 중요한가요?",
          options: ["필수", "중요함", "보통", "상관없음", "PC만", "기타"]
        }
      ];
    }
    
    // 기본값
    return [
      {
        question: "더 구체적으로 어떤 특징을 원하시나요?",
        options: ["매우 상세하게", "적당한 수준", "간단하게", "상관없음", "기타"]
      },
      {
        question: "완성도나 품질 수준은?",
        options: ["최고급", "전문가급", "일반적", "빠른 제작", "기타"]
      }
    ];
  }
}

// ⭐ 핵심: 제대로 export하기
const slotSystem = new SlotSystem();

module.exports = {
  slotSystem,
  SlotSystem
};

// ES6 방식도 지원
if (typeof module === 'undefined') {
  window.SlotSystem = SlotSystem;
  window.slotSystem = slotSystem;
}
