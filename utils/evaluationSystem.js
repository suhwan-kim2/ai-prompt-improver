// 🏆 utils/evaluationSystem.js - 프롬프트 품질 95점 시스템

class EvaluationSystem {
  constructor() {
    // 📋 도메인별 품질 체크리스트 (각 8점씩, 총 96점 → 95점 기준)
    this.qualityChecklist = {
      // 🎬 영상 도메인 (12개 체크포인트)
      video: {
        목적명확성: {
          maxScore: 8,
          description: "영상의 목적과 용도가 구체적으로 명시되어 있는가?",
          checkPoints: [
            "구체적인 목적 명시 (광고, 교육, 홍보 등)",
            "타겟 시청자 정의",
            "배포 채널 및 플랫폼 명시"
          ]
        },
        기술사양: {
          maxScore: 8,
          description: "기술적 사양이 실행 가능한 수준으로 명시되어 있는가?",
          checkPoints: [
            "해상도 및 비율 명시 (4K, 16:9 등)",
            "영상 길이 구체적 명시",
            "프레임레이트 및 코덱 정보"
          ]
        },
        스토리구성: {
          maxScore: 8,
          description: "스토리 구성과 타임라인이 체계적으로 설계되어 있는가?",
          checkPoints: [
            "씬별 타임라인 구성",
            "스토리 흐름의 논리성",
            "인트로-본편-아웃트로 구조"
          ]
        },
        등장인물설정: {
          maxScore: 8,
          description: "등장인물이나 화자가 구체적으로 설정되어 있는가?",
          checkPoints: [
            "등장인물의 외모 및 의상",
            "캐릭터 성격 및 톤",
            "역할 및 등장 분량"
          ]
        },
        대사스크립트: {
          maxScore: 8,
          description: "대사나 내레이션이 실제 사용 가능한 수준인가?",
          checkPoints: [
            "구체적인 대사 내용",
            "내레이션 톤과 스타일",
            "타이밍 및 호흡 고려"
          ]
        },
        카메라워크: {
          maxScore: 8,
          description: "촬영 기법과 카메라 움직임이 명시되어 있는가?",
          checkPoints: [
            "샷 구성 (클로즈업, 미디엄 등)",
            "카메라 무브먼트",
            "앵글 및 구도 설정"
          ]
        },
        시각적스타일: {
          maxScore: 8,
          description: "일관된 시각적 스타일과 컨셉이 정의되어 있는가?",
          checkPoints: [
            "색감 및 톤 설정",
            "조명 스타일",
            "전체적인 비주얼 컨셉"
          ]
        },
        편집스타일: {
          maxScore: 8,
          description: "편집 방향과 전환 효과가 구체적으로 명시되어 있는가?",
          checkPoints: [
            "컷 편집 스타일",
            "전환 효과 및 타이밍",
            "텍스트/그래픽 삽입"
          ]
        },
        음향설계: {
          maxScore: 8,
          description: "오디오 요소가 체계적으로 계획되어 있는가?",
          checkPoints: [
            "배경음악 스타일 및 볼륨",
            "효과음 및 앰비언스",
            "음성/내레이션 품질"
          ]
        },
        자막브랜딩: {
          maxScore: 8,
          description: "자막과 브랜딩 요소가 명시되어 있는가?",
          checkPoints: [
            "자막 스타일 및 위치",
            "로고 및 브랜드 요소",
            "CTA 및 행동 유도"
          ]
        },
        실행가능성: {
          maxScore: 8,
          description: "프롬프트가 실제로 제작 가능한 수준인가?",
          checkPoints: [
            "예산 대비 실현 가능성",
            "기술적 구현 가능성",
            "일정 내 완성 가능성"
          ]
        },
        완성도: {
          maxScore: 7,
          description: "전체적인 완성도와 전문성이 보장되는가?",
          checkPoints: [
            "세부사항의 빠짐없는 포함",
            "전문 용어의 정확한 사용",
            "품질 표준 달성 가능성"
          ]
        }
      },

      // 🎨 이미지 도메인 (12개 체크포인트)
      image: {
        주체명확성: {
          maxScore: 8,
          description: "그릴 주체가 구체적으로 명시되어 있는가?",
          checkPoints: [
            "주체의 정확한 명칭",
            "외모 및 특징 상세 묘사",
            "포즈 및 표정 설정"
          ]
        },
        구도설정: {
          maxScore: 8,
          description: "구도와 레이아웃이 전문적으로 설계되어 있는가?",
          checkPoints: [
            "3분할법 등 구도 법칙",
            "주체의 위치 및 크기",
            "배경과의 균형"
          ]
        },
        색상팔레트: {
          maxScore: 8,
          description: "색상 구성이 체계적으로 계획되어 있는가?",
          checkPoints: [
            "주요 색상 및 보조 색상",
            "색상 온도 및 채도",
            "색상 조화 및 대비"
          ]
        },
        조명설정: {
          maxScore: 8,
          description: "조명과 그림자가 구체적으로 설정되어 있는가?",
          checkPoints: [
            "광원의 방향 및 종류",
            "그림자의 강도 및 위치",
            "전체적인 명암 대비"
          ]
        },
        배경환경: {
          maxScore: 8,
          description: "배경과 환경이 상세히 묘사되어 있는가?",
          checkPoints: [
            "배경의 구체적 설명",
            "환경적 요소들",
            "분위기 연출 요소"
          ]
        },
        질감디테일: {
          maxScore: 8,
          description: "질감과 세부 디테일이 명시되어 있는가?",
          checkPoints: [
            "표면 질감 설명",
            "재질 및 소재 명시",
            "미세한 디테일 요소"
          ]
        },
        스타일기법: {
          maxScore: 8,
          description: "예술적 스타일과 기법이 명확한가?",
          checkPoints: [
            "구체적 스타일 명시",
            "기법 및 테크닉",
            "참고 작가 또는 작품"
          ]
        },
        기술사양: {
          maxScore: 8,
          description: "기술적 사양이 명확히 설정되어 있는가?",
          checkPoints: [
            "해상도 및 크기",
            "파일 형식",
            "DPI 및 색상 모드"
          ]
        },
        분위기감정: {
          maxScore: 8,
          description: "분위기와 감정이 효과적으로 설정되어 있는가?",
          checkPoints: [
            "전달하려는 감정",
            "분위기 연출 방법",
            "시각적 임팩트"
          ]
        },
        브랜딩요소: {
          maxScore: 8,
          description: "브랜딩 및 아이덴티티 요소가 포함되어 있는가?",
          checkPoints: [
            "브랜드 컬러 반영",
            "로고 또는 심볼",
            "브랜드 톤앤매너"
          ]
        },
        금지요소: {
          maxScore: 8,
          description: "피해야 할 요소가 명확히 명시되어 있는가?",
          checkPoints: [
            "부정적 프롬프트",
            "금지 색상 또는 요소",
            "품질 기준 설정"
          ]
        },
        실행가능성: {
          maxScore: 7,
          description: "실제 제작 가능한 수준인가?",
          checkPoints: [
            "기술적 구현 가능성",
            "시간 대비 효율성",
            "품질 보장 가능성"
          ]
        }
      },

      // 💻 개발 도메인 (12개 체크포인트)
      dev: {
        프로젝트정의: {
          maxScore: 8,
          description: "프로젝트의 목적과 범위가 명확한가?",
          checkPoints: [
            "해결하려는 문제 정의",
            "프로젝트 목표 설정",
            "성공 지표 명시"
          ]
        },
        기능명세: {
          maxScore: 8,
          description: "핵심 기능들이 구체적으로 명세되어 있는가?",
          checkPoints: [
            "주요 기능 상세 설명",
            "사용자 시나리오",
            "기능 간 연관성"
          ]
        },
        사용자정의: {
          maxScore: 8,
          description: "타겟 사용자와 페르소나가 명확한가?",
          checkPoints: [
            "사용자 유형 분류",
            "사용자 니즈 분석",
            "사용 패턴 예측"
          ]
        },
        기술스택: {
          maxScore: 8,
          description: "기술 스택과 아키텍처가 적절한가?",
          checkPoints: [
            "프론트엔드 기술 선택",
            "백엔드 및 데이터베이스",
            "인프라 및 배포 환경"
          ]
        },
        UI디자인: {
          maxScore: 8,
          description: "UI/UX 설계가 체계적으로 계획되어 있는가?",
          checkPoints: [
            "와이어프레임 또는 프로토타입",
            "디자인 가이드라인",
            "사용자 경험 플로우"
          ]
        },
        데이터처리: {
          maxScore: 8,
          description: "데이터 구조와 처리 방식이 설계되어 있는가?",
          checkPoints: [
            "데이터베이스 스키마",
            "API 설계",
            "데이터 플로우"
          ]
        },
        보안설계: {
          maxScore: 8,
          description: "보안 요구사항이 적절히 고려되어 있는가?",
          checkPoints: [
            "인증 및 권한 관리",
            "데이터 보안 방안",
            "보안 취약점 대응"
          ]
        },
        성능최적화: {
          maxScore: 8,
          description: "성능 요구사항이 명시되고 최적화 계획이 있는가?",
          checkPoints: [
            "응답 시간 목표",
            "동시 사용자 처리",
            "확장성 고려사항"
          ]
        },
        통합연동: {
          maxScore: 8,
          description: "외부 시스템과의 연동이 계획되어 있는가?",
          checkPoints: [
            "API 연동 계획",
            "서드파티 서비스",
            "데이터 동기화"
          ]
        },
        테스트계획: {
          maxScore: 8,
          description: "테스트 전략이 체계적으로 수립되어 있는가?",
          checkPoints: [
            "단위 테스트 계획",
            "통합 테스트 시나리오",
            "사용자 테스트 방안"
          ]
        },
        배포운영: {
          maxScore: 8,
          description: "배포 및 운영 계획이 구체적인가?",
          checkPoints: [
            "배포 파이프라인",
            "모니터링 및 로깅",
            "유지보수 계획"
          ]
        },
        실행가능성: {
          maxScore: 7,
          description: "프로젝트가 실제 실행 가능한 수준인가?",
          checkPoints: [
            "개발 일정 현실성",
            "리소스 요구사항",
            "기술적 복잡도"
          ]
        }
      }
    };
  }

  // 🏆 메인 품질 평가 함수
  evaluatePromptQuality(prompt, domain = "video") {
    console.log('🏆 프롬프트 품질 평가 시작:', { domain, promptLength: prompt.length });
    
    const checklist = this.qualityChecklist[domain];
    if (!checklist) {
      throw new Error(`지원하지 않는 도메인: ${domain}`);
    }

    let totalScore = 0;
    let maxTotalScore = 0;
    const evaluationDetails = {};
    const improvements = [];

    // 각 체크포인트별 평가
    Object.entries(checklist).forEach(([checkName, config]) => {
      const checkScore = this.evaluateCheckpoint(prompt, checkName, config, domain);
      
      evaluationDetails[checkName] = {
        score: checkScore,
        maxScore: config.maxScore,
        percentage: Math.round((checkScore / config.maxScore) * 100),
        description: config.description,
        checkPoints: config.checkPoints
      };
      
      totalScore += checkScore;
      maxTotalScore += config.maxScore;
      
      // 개선 필요 영역 식별
      if (checkScore < config.maxScore * 0.7) { // 70% 미만
        improvements.push({
          checkpoint: checkName,
          currentScore: checkScore,
          maxScore: config.maxScore,
          priority: checkScore < config.maxScore * 0.3 ? 'high' : 'medium',
          suggestions: this.generateImprovementSuggestions(checkName, domain)
        });
      }
    });

    const finalScore = Math.round((totalScore / maxTotalScore) * 95); // 95점 만점으로 정규화

    const result = {
      total: finalScore,
      maxScore: 95,
      isQualified: finalScore >= 95,
      needsImprovement: finalScore < 95,
      evaluationDetails,
      improvements,
      domain,
      promptLength: prompt.length,
      qualityGrade: this.getQualityGrade(finalScore),
      improvementPlan: this.createImprovementPlan(improvements, domain)
    };

    console.log('🏆 품질 평가 완료:', { finalScore, improvements: improvements.length });
    return result;
  }

  // 📋 개별 체크포인트 평가
  evaluateCheckpoint(prompt, checkName, config, domain) {
    const text = prompt.toLowerCase();
    let score = 0;

    // 기본 점수 (키워드 기반)
    score += this.evaluateKeywords(text, checkName, domain);
    
    // 구조적 평가
    score += this.evaluateStructure(text, checkName, domain);
    
    // 완성도 평가
    score += this.evaluateCompleteness(text, checkName, config);
    
    return Math.min(score, config.maxScore);
  }

  // 🔍 키워드 기반 평가
  evaluateKeywords(text, checkName, domain) {
    const keywordSets = {
      video: {
        목적명확성: ['목적', '용도', '광고', '교육', '홍보', '브랜딩'],
        기술사양: ['해상도', '4k', 'hd', '길이', '분', '초', '비율'],
        스토리구성: ['씬', '구성', '타임라인', '흐름', '스토리', '구조'],
        등장인물설정: ['등장인물', '캐릭터', '인물', '출연자', '화자'],
        대사스크립트: ['대사', '내레이션', '스크립트', '멘트', '설명'],
        카메라워크: ['카메라', '촬영', '앵글', '클로즈업', '샷'],
        시각적스타일: ['스타일', '색감', '조명', '비주얼', '컨셉'],
        편집스타일: ['편집', '컷', '전환', '효과', '몽타주'],
        음향설계: ['음향', '음악', 'bgm', '효과음', '사운드'],
        자막브랜딩: ['자막', '브랜드', '로고', 'cta', '행동유도']
      },
      image: {
        주체명확성: ['주체', '대상', '인물', '객체', '캐릭터'],
        구도설정: ['구도', '구성', '레이아웃', '배치', '3분할'],
        색상팔레트: ['색상', '컬러', '팔레트', '톤', '색감'],
        조명설정: ['조명', '빛', '그림자', '명암', '라이팅'],
        배경환경: ['배경', '환경', '설정', '공간', '장소']
      },
      dev: {
        프로젝트정의: ['목적', '목표', '문제', '솔루션', '비전'],
        기능명세: ['기능', '피처', '요구사항', '스펙', '기능명세'],
        사용자정의: ['사용자', '유저', '고객', '타겟', '페르소나'],
        기술스택: ['기술', '스택', '프레임워크', '언어', '데이터베이스'],
        UI디자인: ['ui', 'ux', '디자인', '인터페이스', '사용성']
      }
    };

    const keywords = keywordSets[domain]?.[checkName] || [];
    const matches = keywords.filter(keyword => text.includes(keyword)).length;
    
    return Math.min((matches / Math.max(keywords.length, 1)) * 3, 3); // 최대 3점
  }

  // 🏗️ 구조적 평가
  evaluateStructure(text, checkName, domain) {
    let score = 0;
    
    // 문장 구조 평가
    if (text.length > 50) score += 1; // 기본 길이
    if (text.length > 200) score += 1; // 상세 설명
    
    // 구체적 수치 포함
    if (/\d+/.test(text)) score += 1;
    
    // 구조화된 설명
    if (/(첫째|둘째|셋째|1\.|2\.|3\.)/.test(text)) score += 1;
    
    return Math.min(score, 2); // 최대 2점
  }

  // ✅ 완성도 평가
  evaluateCompleteness(text, checkName, config) {
    const checkPoints = config.checkPoints || [];
    let coveredPoints = 0;
    
    checkPoints.forEach(point => {
      const keywords = this.extractCheckPointKeywords(point);
      if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
        coveredPoints++;
      }
    });
    
    const completenessRatio = coveredPoints / Math.max(checkPoints.length, 1);
    return Math.round(completenessRatio * 3); // 최대 3점
  }

  // 🔑 체크포인트 키워드 추출
  extractCheckPointKeywords(checkPoint) {
    // 체크포인트 텍스트에서 핵심 키워드 추출
    const cleanPoint = checkPoint.replace(/[()]/g, '');
    return cleanPoint.split(/[\s,]+/).filter(word => word.length > 1);
  }

  // 💡 개선 제안 생성
  generateImprovementSuggestions(checkName, domain) {
    const suggestions = {
      video: {
        목적명확성: ["구체적인 영상 목적을 명시하세요", "타겟 시청자를 구체적으로 정의하세요"],
        기술사양: ["해상도와 길이를 정확히 명시하세요", "플랫폼별 기술 요구사항을 추가하세요"],
        스토리구성: ["씬별 타임라인을 상세히 작성하세요", "스토리 흐름의 논리성을 강화하세요"],
        대사스크립트: ["실제 사용할 대사를 구체적으로 작성하세요", "내레이션 톤을 명시하세요"]
      },
      image: {
        주체명확성: ["그릴 대상을 더 구체적으로 묘사하세요", "포즈와 표정을 상세히 설명하세요"],
        구도설정: ["구도 법칙을 적용하세요", "주체의 위치와 크기를 명시하세요"],
        색상팔레트: ["주요 색상과 보조 색상을 정의하세요", "색상 온도를 설정하세요"]
      },
      dev: {
        프로젝트정의: ["해결하려는 문제를 명확히 정의하세요", "성공 지표를 구체적으로 설정하세요"],
        기능명세: ["핵심 기능을 상세히 설명하세요", "사용자 시나리오를 추가하세요"],
        기술스택: ["구체적인 기술 선택 이유를 명시하세요", "아키텍처 설계를 포함하세요"]
      }
    };
    
    return suggestions[domain]?.[checkName] || ["더 구체적이고 상세한 정보를 추가해주세요"];
  }

  // 📋 개선 계획 수립
  createImprovementPlan(improvements, domain) {
    if (improvements.length === 0) {
      return { message: "모든 체크포인트가 우수한 수준입니다!", steps: [] };
    }

    const plan = {
      priority: improvements.filter(i => i.priority === 'high').length,
      medium: improvements.filter(i => i.priority === 'medium').length,
      steps: improvements.map((improvement, index) => ({
        step: index + 1,
        checkpoint: improvement.checkpoint,
        priority: improvement.priority,
        currentScore: improvement.currentScore,
        targetScore: improvement.maxScore,
        suggestions: improvement.suggestions
      }))
    };

    return plan;
  }

  // 🏆 품질 등급 계산
  getQualityGrade(score) {
    if (score >= 95) return 'S+';
    if (score >= 90) return 'S';
    if (score >= 85) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    return 'D';
  }

  // 📊 품질 트렌드 분석
  analyzeQualityTrend(evaluations) {
    if (evaluations.length < 2) return null;
    
    const latest = evaluations[evaluations.length - 1];
    const previous = evaluations[evaluations.length - 2];
    
    const improvement = latest.total - previous.total;
    
    return {
      trend: improvement > 0 ? 'improving' : improvement < 0 ? 'declining' : 'stable',
      change: Math.abs(improvement),
      previousScore: previous.total,
      currentScore: latest.total,
      recommendation: improvement >= 0 ? 
        "품질이 향상되고 있습니다. 현재 방향을 유지하세요." :
        "품질이 하락했습니다. 이전 버전을 참고하여 개선하세요."
    };
  }
}

export { EvaluationSystem };
