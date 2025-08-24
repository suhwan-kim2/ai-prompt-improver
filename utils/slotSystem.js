// utils/slotSystem.js - 슬롯 기반 질문 시스템 (Node.js 호환 버전)

class SlotSystem {
  constructor() {
    this.domainSlots = {
      visual_design: {
        주제: { required: true, weight: 10, type: "text", question: "정확히 어떤 주제로 그림을 만들고 싶으신가요?" },
        스타일: { required: true, weight: 9, type: "enum", options: ["사실적", "3D", "애니메이션", "일러스트", "수채화", "유화"], question: "어떤 스타일로 제작하고 싶으신가요?" },
        색상: { required: false, weight: 7, type: "enum", options: ["따뜻한톤", "차가운톤", "모노톤", "비비드", "파스텔"], question: "선호하는 색상 톤이 있나요?" },
        크기: { required: false, weight: 6, type: "enum", options: ["정사각형", "가로형", "세로형", "4K", "HD"], question: "어떤 크기나 비율로 만들까요?" },
        해상도: { required: false, weight: 5, type: "enum", options: ["HD", "4K", "8K", "인쇄용"], question: "해상도나 품질 요구사항이 있나요?" },
        배경: { required: false, weight: 6, type: "text", question: "배경은 어떻게 구성하고 싶으신가요?" },
        조명: { required: false, weight: 4, type: "enum", options: ["자연광", "스튜디오", "어두운", "밝은"], question: "조명이나 분위기는 어떻게 설정할까요?" },
        각도: { required: false, weight: 3, type: "enum", options: ["정면", "측면", "위에서", "아래서"], question: "어떤 각도에서 촬영한 느낌을 원하시나요?" }
      },
      
      video: {
        목적: { required: true, weight: 10, type: "enum", options: ["광고", "교육", "엔터테인먼트", "홍보", "튜토리얼"], question: "영상의 주요 목적이 무엇인가요?" },
        길이: { required: true, weight: 9, type: "enum", options: ["짧게(15초)", "중간(1-3분)", "길게(3분+)", "장편(10분+)"], question: "영상 길이는 어느 정도로 생각하고 계신가요?" },
        스타일: { required: true, weight: 8, type: "enum", options: ["실사", "애니메이션", "3D", "타임랩스", "슬로우모션"], question: "어떤 스타일의 영상을 원하시나요?" },
        해상도: { required: false, weight: 7, type: "enum", options: ["HD", "4K", "8K"], question: "해상도 요구사항이 있나요?" },
        프레임레이트: { required: false, weight: 5, type: "enum", options: ["24fps", "30fps", "60fps"], question: "특별한 프레임레이트 요구사항이 있나요?" },
        음악: { required: false, weight: 6, type: "enum", options: ["배경음악", "내레이션", "효과음", "무음"], question: "음향이나 음악은 어떻게 구성할까요?" },
        자막: { required: false, weight: 4, type: "enum", options: ["한글자막", "영문자막", "자막없음"], question: "자막이 필요한가요?" },
        색보정: { required: false, weight: 3, type: "enum", options: ["자연스럽게", "비비드하게", "영화같이", "밝게"], question: "색감이나 보정 스타일이 있나요?" }
      },
      
      development: {
        프로젝트유형: { required: true, weight: 10, type: "enum", options: ["웹사이트", "모바일앱", "API", "데스크톱", "게임"], question: "어떤 종류의 프로그램을 만들고 싶으신가요?" },
        주요기능: { required: true, weight: 9, type: "text", question: "가장 중요한 기능이나 목적이 무엇인가요?" },
        기술스택: { required: false, weight: 7, type: "enum", options: ["React", "Vue", "Angular", "Python", "Java", "Node.js"], question: "선호하는 기술이나 언어가 있나요?" },
        대상사용자: { required: false, weight: 8, type: "enum", options: ["일반사용자", "관리자", "개발자", "전문가"], question: "누가 주로 사용할 프로그램인가요?" },
        플랫폼: { required: false, weight: 6, type: "enum", options: ["웹", "모바일", "데스크톱", "크로스플랫폼"], question: "어떤 플랫폼에서 동작해야 하나요?" },
        데이터베이스: { required: false, weight: 5, type: "enum", options: ["MySQL", "MongoDB", "PostgreSQL", "Firebase"], question: "데이터 저장이 필요한가요?" },
        보안: { required: false, weight: 4, type: "enum", options: ["로그인", "권한관리", "암호화", "기본보안"], question: "보안 요구사항이 있나요?" },
        성능: { required: false, weight: 3, type: "enum", options: ["빠른속도", "대용량처리", "실시간", "일반"], question: "성능상 특별한 요구사항이 있나요?" }
      },
      
      text_language: {
        목적: { required: true, weight: 10, type: "enum", options: ["정보전달", "설득", "감정표현", "교육", "홍보"], question: "글의 주요 목적이 무엇인가요?" },
        대상독자: { required: true, weight: 9, type: "enum", options: ["전문가", "일반인", "학생", "고객", "동료"], question: "누가 읽을 글인가요?" },
        분량: { required: false, weight: 7, type: "enum", options: ["짧게(500자)", "중간(1000자)", "길게(2000자+)"], question: "대략 어느 정도 분량으로 작성할까요?" },
        톤: { required: false, weight: 8, type: "enum", options: ["공식적", "친근한", "전문적", "유머러스", "진지한"], question: "어떤 톤으로 작성하고 싶으신가요?" },
        형식: { required: false, weight: 6, type: "enum", options: ["기사", "블로그", "보고서", "이메일", "SNS"], question: "어떤 형식의 글인가요?" },
        구조: { required: false, weight: 5, type: "enum", options: ["서론-본론-결론", "리스트형", "스토리텔링", "Q&A"], question: "글의 구조나 형태가 정해져 있나요?" },
        키워드: { required: false, weight: 4, type: "text", question: "꼭 포함해야 할 키워드나 내용이 있나요?" },
        마감: { required: false, weight: 3, type: "enum", options: ["급함", "보통", "여유있음"], question: "언제까지 필요한 글인가요?" }
      },
      
      business: {
        사업분야: { required: true, weight: 10, type: "text", question: "어떤 분야의 사업인가요?" },
        목표: { required: true, weight: 9, type: "enum", options: ["매출증대", "브랜딩", "고객확보", "효율성", "혁신"], question: "주요 목표가 무엇인가요?" },
        대상고객: { required: false, weight: 8, type: "text", question: "주요 고객층이 누구인가요?" },
        예산: { required: false, weight: 7, type: "enum", options: ["제한적", "적당함", "충분함", "무제한"], question: "예산 규모는 어느 정도인가요?" },
        기간: { required: false, weight: 6, type: "enum", options: ["단기(1개월)", "중기(3개월)", "장기(6개월+)"], question: "목표 달성 기간은 어느 정도로 생각하시나요?" },
        경쟁사: { required: false, weight: 5, type: "text", question: "주요 경쟁사나 벤치마킹 대상이 있나요?" },
        차별화: { required: false, weight: 4, type: "text", question: "다른 곳과 차별화할 포인트가 있나요?" },
        위험요소: { required: false, weight: 3, type: "text", question: "우려되는 위험 요소가 있나요?" }
      },
      
      music_audio: {
        장르: { required: true, weight: 10, type: "enum", options: ["팝", "록", "클래식", "재즈", "일렉트로닉", "힙합"], question: "어떤 장르의 음악인가요?" },
        분위기: { required: true, weight: 9, type: "enum", options: ["밝은", "어두운", "차분한", "신나는", "슬픈", "웅장한"], question: "어떤 분위기를 원하시나요?" },
        길이: { required: false, weight: 7, type: "enum", options: ["짧게(30초)", "중간(2-3분)", "길게(5분+)"], question: "음악 길이는 어느 정도인가요?" },
        악기: { required: false, weight: 6, type: "text", question: "특별히 포함하고 싶은 악기가 있나요?" },
        용도: { required: false, weight: 8, type: "enum", options: ["배경음악", "주제곡", "효과음", "광고음악"], question: "어디에 사용할 음악인가요?" },
        템포: { required: false, weight: 5, type: "enum", options: ["느림", "보통", "빠름", "매우빠름"], question: "템포는 어떻게 설정할까요?" },
        보컬: { required: false, weight: 4, type: "enum", options: ["남성보컬", "여성보컬", "인스트루멘탈", "코러스"], question: "보컬이 필요한가요?" },
        음질: { required: false, weight: 3, type: "enum", options: ["스튜디오급", "일반", "로파이"], question: "음질 요구사항이 있나요?" }
      },
      
      general: {
        분야: { required: true, weight: 10, type: "text", question: "어떤 분야에 대한 요청인가요?" },
        목적: { required: true, weight: 9, type: "text", question: "최종적으로 무엇을 얻고 싶으신가요?" },
        우선순위: { required: false, weight: 7, type: "text", question: "가장 중요하게 생각하는 부분이 무엇인가요?" },
        제약사항: { required: false, weight: 6, type: "text", question: "특별한 제약이나 조건이 있나요?" },
        참고자료: { required: false, weight: 5, type: "text", question: "참고하고 싶은 예시나 자료가 있나요?" },
        수준: { required: false, weight: 4, type: "enum", options: ["초급", "중급", "고급", "전문가"], question: "어느 수준으로 제작하면 될까요?" },
        스타일: { required: false, weight: 3, type: "text", question: "선호하는 스타일이나 방향성이 있나요?" },
        기타: { required: false, weight: 2, type: "text", question: "추가로 고려해야 할 사항이 있나요?" }
      }
    };
    
    this.domainKeywords = {
      visual_design: ["그림", "이미지", "사진", "포스터", "로고", "디자인", "일러스트", "드로잉", "페인팅"],
      video: ["영상", "비디오", "동영상", "애니메이션", "영화", "광고", "편집", "촬영"],
      development: ["웹사이트", "앱", "프로그램", "시스템", "코딩", "개발", "소프트웨어", "플랫폼"],
      text_language: ["글", "텍스트", "문서", "기사", "블로그", "내용", "작성", "번역"],
      business: ["사업", "비즈니스", "전략", "마케팅", "브랜딩", "매출", "고객", "시장"],
      music_audio: ["음악", "소리", "오디오", "노래", "멜로디", "사운드", "작곡"],
      general: []
    };
  }
  
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
        return { primary: 'general', secondary: [], confidence: 0.5 };
      }
      
      const primary = sortedDomains[0][0];
      const secondary = sortedDomains.slice(1, 3).map(([domain]) => domain);
      const confidence = Math.min(1, sortedDomains[0][1] / 3);
      
      return { primary, secondary, confidence };
    } catch (error) {
      console.error('도메인 감지 오류:', error);
      return { primary: 'general', secondary: [], confidence: 0.5 };
    }
  }
  
  // 폴백 질문 생성 (AI 없이 동작)
  generateFallbackQuestions(domainInfo, mentionedInfo = {}) {
    try {
      const domain = domainInfo.primary || 'general';
      const slots = this.domainSlots[domain] || this.domainSlots.general;
      
      const questions = [];
      
      // 필수 슬롯부터 처리
      Object.entries(slots)
        .filter(([key, slot]) => slot.required && !mentionedInfo[key])
        .sort(([,a], [,b]) => b.weight - a.weight)
        .forEach(([key, slot]) => {
          if (slot.question && questions.length < 8) {
            questions.push(slot.question);
          }
        });
      
      // 선택 슬롯 추가 (필요한 만큼만)
      Object.entries(slots)
        .filter(([key, slot]) => !slot.required && !mentionedInfo[key])
        .sort(([,a], [,b]) => b.weight - a.weight)
        .slice(0, Math.max(0, 8 - questions.length))
        .forEach(([key, slot]) => {
          if (slot.question && questions.length < 8) {
            questions.push(slot.question);
          }
        });
      
      // 부족하면 일반 질문 추가
      const generalQuestions = [
        "어떤 스타일을 원하시나요?",
        "크기나 규모는 어느 정도로 생각하고 계신가요?",
        "특별히 중요하게 생각하는 부분이 있나요?",
        "참고하고 싶은 예시가 있나요?",
        "완성도는 어느 수준으로 원하시나요?",
        "용도나 목적이 정해져 있나요?",
        "제약 사항이나 조건이 있나요?",
        "기타 추가로 고려할 사항이 있나요?"
      ];
      
      while (questions.length < 8 && questions.length < 8) {
        const remainingQuestions = generalQuestions.filter(q => !questions.includes(q));
        if (remainingQuestions.length === 0) break;
        
        questions.push(remainingQuestions[0]);
      }
      
      return questions.slice(0, 8);
    } catch (error) {
      console.error('폴백 질문 생성 오류:', error);
      // 안전한 기본 질문들
      return [
        "구체적으로 어떤 결과물을 원하시나요?",
        "어떤 스타일이나 느낌을 선호하시나요?",
        "크기나 규모는 어느 정도인가요?",
        "누가 사용하거나 볼 예정인가요?",
        "특별한 요구사항이나 제약이 있나요?",
        "참고하고 싶은 예시가 있나요?"
      ];
    }
  }
  
  // 슬롯 정보 가져오기
  getSlots(domain) {
    try {
      return this.domainSlots[domain] || this.domainSlots.general;
    } catch (error) {
      console.error('슬롯 정보 가져오기 오류:', error);
      return this.domainSlots.general;
    }
  }
  
  // 도메인 정보 가져오기
  getDomainInfo(domain) {
    try {
      return {
        name: domain,
        slots: this.getSlots(domain),
        keywords: this.domainKeywords[domain] || []
      };
    } catch (error) {
      console.error('도메인 정보 가져오기 오류:', error);
      return {
        name: 'general',
        slots: this.domainSlots.general,
        keywords: []
      };
    }
  }
  
  // 슬롯 기반 질문 우선순위 계산
  calculateSlotPriority(domain, mentionedInfo = {}) {
    try {
      const slots = this.getSlots(domain);
      const priorities = [];
      
      Object.entries(slots).forEach(([key, slot]) => {
        if (!mentionedInfo[key]) {
          priorities.push({
            key: key,
            weight: slot.weight,
            required: slot.required,
            question: slot.question,
            type: slot.type,
            options: slot.options || null
          });
        }
      });
      
      // 필수 슬롯 먼저, 그 다음 가중치 순
      return priorities.sort((a, b) => {
        if (a.required !== b.required) {
          return b.required - a.required; // 필수가 먼저
        }
        return b.weight - a.weight; // 가중치 높은 순
      });
    } catch (error) {
      console.error('슬롯 우선순위 계산 오류:', error);
      return [];
    }
  }
}

// Node.js 환경에서 사용할 수 있도록 export
module.exports = { SlotSystem };
