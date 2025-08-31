// api/improve-prompt.js - 체크리스트 기반 완벽 중복 방지
import { readJson } from './helpers.js';
import { MentionExtractor } from '../utils/mentionExtractor.js';

const mentionExtractor = new MentionExtractor();

// ========== 도메인별 MUST 체크리스트 ==========
const DOMAIN_MUST_CHECKLIST = {
  video: {
    목표플랫폼: { 
      required: true, 
      keywords: ['유튜브', '틱톡', '인스타', '광고', '교육'],
      question: "어느 플랫폼용 영상인가요?",
      options: ["유튜브", "틱톡/쇼츠", "인스타 릴스", "광고", "교육용"]
    },
    정확한길이: { 
      required: true, 
      keywords: ['초', '분', '길이', '러닝타임'],
      question: "영상 길이는 정확히 몇 초인가요?",
      options: ["15초", "30초", "60초", "180초", "300초 이상"]
    },
    타겟시청자: { 
      required: true, 
      keywords: ['시청자', '대상', '연령', '타겟'],
      question: "주 시청자층은 누구인가요?",
      options: ["10대", "20-30대", "40-50대", "전연령", "전문가"]
    },
    화면스펙: { 
      required: true, 
      keywords: ['해상도', '비율', '16:9', '9:16', 'fps'],
      question: "화면 비율과 해상도는?",
      options: ["16:9 FHD", "9:16 세로", "1:1 정사각형", "4K", "기타"]
    },
    씬구성: { 
      required: true, 
      keywords: ['씬', '장면', '구성', '시퀀스'],
      question: "주요 장면 구성은 어떻게 되나요?",
      options: ["단일 씬", "3-5개 씬", "5-10개 씬", "10개 이상", "몽타주"]
    }
  },
  
  image: {
    목적매체: { 
      required: true, 
      keywords: ['썸네일', '포스터', '배너', '용도'],
      question: "이미지의 용도는 무엇인가요?",
      options: ["유튜브 썸네일", "SNS 포스트", "웹 배너", "인쇄물", "NFT/아트"]
    },
    스타일: { 
      required: true, 
      keywords: ['스타일', '화풍', '실사', '일러스트', '3D'],
      question: "어떤 스타일로 제작하시겠어요?",
      options: ["실사/포토", "일러스트", "3D 렌더", "미니멀", "빈티지"]
    },
    해상도비율: { 
      required: true, 
      keywords: ['해상도', '크기', '비율', 'px'],
      question: "정확한 해상도와 비율은?",
      options: ["1920x1080", "1080x1080", "1080x1920", "4K", "커스텀"]
    },
    색상팔레트: { 
      required: true, 
      keywords: ['색상', '컬러', '톤', '팔레트'],
      question: "주요 색상 톤은?",
      options: ["밝고 화사한", "어둡고 무거운", "파스텔톤", "모노톤", "네온/비비드"]
    }
  },
  
  dev: {
    문제정의: { 
      required: true, 
      keywords: ['목표', '문제', '해결', '구현'],
      question: "해결하려는 핵심 문제는?",
      inputType: "text"
    },
    기술스택: { 
      required: true, 
      keywords: ['언어', '프레임워크', 'react', 'node', 'python'],
      question: "사용할 기술 스택은?",
      options: ["React+Node", "Vue+Django", "Next.js", "Python", "기타"]
    },
    입출력스키마: { 
      required: true, 
      keywords: ['입력', '출력', 'API', '스키마', 'JSON'],
      question: "입출력 데이터 형식은?",
      inputType: "text"
    }
  },
  
  general: {
    목적: { 
      required: true, 
      keywords: ['목적', '용도', '왜', '이유'],
      question: "이 글의 목적은 무엇인가요?",
      options: ["정보 전달", "설득", "자기소개", "리포트", "스토리텔링"]
    },
    대상독자: { 
      required: true, 
      keywords: ['독자', '대상', '읽는이'],
      question: "주요 독자는 누구인가요?",
      options: ["일반 대중", "전문가", "팀 내부", "고객", "투자자"]
    },
    분량: { 
      required: true, 
      keywords: ['길이', '분량', '글자', '단어'],
      question: "전체 분량은?",
      options: ["200자 이내", "500자", "1000자", "2000자 이상", "A4 1장"]
    }
  }
};

// ========== 메인 핸들러 ==========
export default async function handler(req, res) {
  try {
    const body = await readJson(req);
    const {
      userInput = '',
      answers = [],
      domain = 'video',
      round = 1,
      filledChecklist = {},
      currentPrompt = ''
    } = body;

    console.log(`📥 라운드 ${round}`);
    console.log('이미 채워진 항목:', Object.keys(filledChecklist));

    if (!userInput) {
      return res.status(400).json({ 
        success: false, 
        message: '프롬프트를 입력해주세요.' 
      });
    }

    if (round > 5) {
      return await finalizePrompt(res, userInput, answers, domain, currentPrompt, filledChecklist);
    }

    return await processRound(res, userInput, answers, domain, round, filledChecklist, currentPrompt);
    
  } catch (error) {
    console.error('❌ 오류:', error);
    return res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
}

// ========== 라운드 처리 ==========
async function processRound(res, userInput, answers, domain, round, filledChecklist, previousPrompt) {
  try {
    // 1️⃣ 현재까지 모든 정보 추출
    const allText = [userInput, ...answers].join(' ');
    const mentions = mentionExtractor.extract(allText);
    
    // 2️⃣ 체크리스트 업데이트 (입력과 답변에서 자동 추출)
    const updatedChecklist = updateChecklistFromText(
      filledChecklist, 
      allText, 
      domain,
      mentions
    );
    
    // 3️⃣ 프롬프트 개선
    let improvedPrompt = previousPrompt || userInput;
    if (answers.length > 0) {
      improvedPrompt = await buildPromptFromChecklist(
        userInput, 
        updatedChecklist, 
        domain
      );
    }
    
    // 4️⃣ 점수 계산
    const { intentScore, qualityScore } = calculateScores(
      updatedChecklist, 
      improvedPrompt, 
      domain
    );
    
    console.log(`📊 의도: ${intentScore}/95, 품질: ${qualityScore}/100`);
    
    // 5️⃣ 목표 달성 체크
    if (intentScore >= 95 && qualityScore >= 100) {
      return res.status(200).json({
        success: true,
        step: 'completed',
        originalPrompt: userInput,
        improvedPrompt,
        intentScore: 95,
        qualityScore: 100,
        message: '🎉 완벽한 프롬프트 완성!'
      });
    }
    
    // 6️⃣ 부족한 항목만 질문 생성
    const questions = generateQuestionsForMissing(
      updatedChecklist, 
      domain, 
      round
    );
    
    if (!questions || questions.length === 0) {
      return await finalizePrompt(res, userInput, answers, domain, improvedPrompt, updatedChecklist);
    }
    
    return res.status(200).json({
      success: true,
      step: 'questions',
      questions,
      round: round + 1,
      intentScore,
      qualityScore,
      currentPrompt: improvedPrompt,
      draftPrompt: improvedPrompt,
      filledChecklist: updatedChecklist,
      message: `라운드 ${round}: 필수 항목 ${Object.keys(updatedChecklist).length}/${Object.keys(DOMAIN_MUST_CHECKLIST[domain]).length}개 완료`
    });
    
  } catch (error) {
    console.error('processRound 오류:', error);
    throw error;
  }
}

// ========== 텍스트에서 체크리스트 자동 채우기 ==========
function updateChecklistFromText(currentChecklist, text, domain, mentions) {
  const checklist = { ...currentChecklist };
  const mustItems = DOMAIN_MUST_CHECKLIST[domain] || DOMAIN_MUST_CHECKLIST.general;
  const textLower = text.toLowerCase();
  
  // 각 MUST 항목 체크
  Object.entries(mustItems).forEach(([key, config]) => {
    // 이미 채워진 항목은 스킵
    if (checklist[key]) return;
    
    // 키워드 매칭으로 자동 감지
    const hasKeyword = config.keywords.some(keyword => 
      textLower.includes(keyword.toLowerCase())
    );
    
    if (hasKeyword) {
      // 구체적인 값 추출 시도
      let value = null;
      
      // 숫자 관련 (길이, 해상도 등)
      if (key === '정확한길이') {
        const match = text.match(/(\d+)\s*초/);
        if (match) value = `${match[1]}초`;
      }
      else if (key === '해상도비율') {
        const match = text.match(/(\d+)\s*[x×]\s*(\d+)/);
        if (match) value = `${match[1]}×${match[2]}`;
      }
      // 플랫폼
      else if (key === '목표플랫폼') {
        if (textLower.includes('유튜브')) value = '유튜브';
        else if (textLower.includes('틱톡')) value = '틱톡';
        else if (textLower.includes('인스타')) value = '인스타그램';
      }
      // 시청자
      else if (key === '타겟시청자') {
        const ageMatch = text.match(/(\d+)[-~]?(\d+)?대/);
        if (ageMatch) value = ageMatch[0];
      }
      
      if (value) {
        checklist[key] = value;
        console.log(`✅ 자동 감지: ${key} = ${value}`);
      }
    }
  });
  
  return checklist;
}

// ========== 부족한 항목만 질문 생성 ==========
function generateQuestionsForMissing(filledChecklist, domain, round) {
  const mustItems = DOMAIN_MUST_CHECKLIST[domain] || DOMAIN_MUST_CHECKLIST.general;
  const questions = [];
  
  // MUST 항목 중 빈 것만 찾기
  Object.entries(mustItems).forEach(([key, config]) => {
    if (!filledChecklist[key]) {
      questions.push({
        question: config.question,
        options: config.options,
        inputType: config.inputType,
        key: key,
        priority: "high",
        reason: `필수 항목: ${key}`
      });
    }
  });
  
  // 라운드별 질문 수 제한
  const maxQuestions = round <= 2 ? 5 : 3;
  
  // 우선순위: MUST 항목 먼저
  return questions.slice(0, maxQuestions);
}

// ========== 점수 계산 ==========
function calculateScores(filledChecklist, prompt, domain) {
  const mustItems = DOMAIN_MUST_CHECKLIST[domain] || DOMAIN_MUST_CHECKLIST.general;
  const totalMust = Object.keys(mustItems).length;
  const filledMust = Object.keys(filledChecklist).length;
  
  // 의도 파악 점수 (Must 항목 충족도)
  const intentScore = Math.round((filledMust / totalMust) * 95);
  
  // 품질 점수 (구체성 체크)
  let qualityScore = 60; // 기본 점수
  
  // 구체적 수치 포함 체크
  if (/\d+/.test(prompt)) qualityScore += 10;
  if (/\d+초|\d+분/.test(prompt)) qualityScore += 10;
  if (/\d+x\d+|\d+×\d+/.test(prompt)) qualityScore += 10;
  if (prompt.length > 200) qualityScore += 10;
  
  // 모호어 체크 (감점)
  const vagueWords = ['적당히', '대충', '예쁘게', '깔끔하게', '좋게'];
  vagueWords.forEach(word => {
    if (prompt.includes(word)) qualityScore -= 10;
  });
  
  return {
    intentScore: Math.min(intentScore, 95),
    qualityScore: Math.min(Math.max(qualityScore, 0), 100)
  };
}

// ========== 체크리스트 기반 프롬프트 생성 ==========
async function buildPromptFromChecklist(userInput, checklist, domain) {
  const templates = {
    video: `
[영상 제작 요청]
원본 요청: ${userInput}

목표/플랫폼: ${checklist.목표플랫폼 || '미정'}
시청자: ${checklist.타겟시청자 || '미정'}  
길이: ${checklist.정확한길이 || '미정'}
화면 스펙: ${checklist.화면스펙 || '미정'}
씬 구성: ${checklist.씬구성 || '미정'}`,
    
    image: `
[이미지 생성 요청]
원본 요청: ${userInput}

목적/매체: ${checklist.목적매체 || '미정'}
스타일: ${checklist.스타일 || '미정'}
해상도/비율: ${checklist.해상도비율 || '미정'}
색상 팔레트: ${checklist.색상팔레트 || '미정'}`,
    
    dev: `
[개발 프로젝트]
원본 요청: ${userInput}

문제 정의: ${checklist.문제정의 || '미정'}
기술 스택: ${checklist.기술스택 || '미정'}
입출력 스키마: ${checklist.입출력스키마 || '미정'}`,
    
    general: `
[문서 작성 요청]
원본 요청: ${userInput}

목적: ${checklist.목적 || '미정'}
대상 독자: ${checklist.대상독자 || '미정'}
분량: ${checklist.분량 || '미정'}`
  };
  
  return templates[domain] || templates.general;
}

// ========== 최종 완성 ==========
async function finalizePrompt(res, userInput, answers, domain, currentPrompt, filledChecklist) {
  const finalPrompt = await buildPromptFromChecklist(userInput, filledChecklist, domain);
  const { intentScore, qualityScore } = calculateScores(filledChecklist, finalPrompt, domain);
  
  return res.status(200).json({
    success: true,
    step: 'completed',
    originalPrompt: userInput,
    improvedPrompt: finalPrompt,
    intentScore: Math.max(intentScore, 85),
    qualityScore: Math.max(qualityScore, 85),
    filledChecklist,
    message: '프롬프트 완성!'
  });
}
