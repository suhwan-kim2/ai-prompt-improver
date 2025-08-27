// 🚀 배포용 완성된 /api/improve-prompt.js - 새 프론트엔드와 완벽 호환
import { readJson } from "./helpers.js";

// OpenAI API 키
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
  console.log('🚀 정직한 프롬프트 개선 API 시작');
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 요청 데이터 읽기
    const requestData = await readJson(req);
    console.log('📨 요청 데이터:', requestData);

    const { 
      userInput = "", 
      answers = [], 
      domain = "image" 
    } = requestData;

    // 1단계: 입력 검증
    if (!userInput.trim()) {
      return res.status(400).json({
        error: true,
        type: 'invalid_input',
        message: '프롬프트를 입력해주세요.'
      });
    }

    // 2단계: OpenAI API 키 확인
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-api-key-here') {
      console.error('❌ OpenAI API 키 없음');
      return res.status(503).json({
        error: true,
        type: 'service_unavailable',
        title: '🚫 서비스 일시 중단',
        message: 'AI 서비스 설정에 문제가 있습니다.',
        suggestion: '관리자에게 문의해주세요.',
        canRetry: false
      });
    }

    // 3단계: 입력 충분성 검사
    const sufficiency = checkInputSufficiency(userInput, answers, domain);
    console.log('📊 입력 충분성:', sufficiency);

    if (!sufficiency.sufficient) {
      // 정보 부족 → 더 많은 질문 필요
      const questions = generateQuestions(sufficiency, domain);
      
      return res.status(200).json({
        success: false,
        action: 'need_more_info',
        questions: questions,
        completeness: sufficiency.completeness,
        message: `${sufficiency.completeness}% 완성. AI가 완벽한 프롬프트를 만들기 위해 조금만 더 알려주세요!`,
        debug: sufficiency
      });
    }

    // 4단계: OpenAI로 진짜 개선 시도
    console.log('🤖 OpenAI 개선 시작');
    const aiResult = await attemptOpenAIImprovement(userInput, answers, domain);

    if (aiResult.success) {
      // ✅ 성공!
      console.log('✅ OpenAI 성공!');
      return res.status(200).json({
        success: true,
        improved: aiResult.prompt,
        score: 95,
        message: '✨ AI가 프롬프트를 완벽하게 개선했습니다!',
        method: 'openai_success',
        originalLength: userInput.length,
        improvedLength: aiResult.prompt.length
      });
      
    } else {
      // ❌ 실패 → 정직하게 실패 안내
      console.log('❌ OpenAI 실패:', aiResult.error.message);
      const failureResponse = handleFailureHonestly(aiResult.error);
      
      return res.status(503).json(failureResponse);
    }

  } catch (error) {
    console.error('❌ 전체 시스템 오류:', error);
    
    return res.status(500).json({
      error: true,
      type: 'system_error',
      title: '❓ 시스템 오류',
      message: '예상치 못한 문제가 발생했습니다.',
      suggestion: '페이지를 새로고침하고 다시 시도해주세요.',
      canRetry: true,
      timestamp: new Date().toISOString()
    });
  }
}

// 📊 입력 충분성 검사
function checkInputSufficiency(userInput, answers, domain) {
  const allText = [userInput, ...answers].join(' ').toLowerCase();
  console.log('🔍 분석 대상:', allText.slice(0, 100) + '...');
  
  // 도메인별 필수 키워드
  const requirements = {
    image: {
      주체: ['강아지', '고양이', '사람', '여자', '남자', '아이', '제품', '로고', '풍경', '건물', '자동차', '꽃', '나무'],
      스타일: ['사실적', '애니메이션', '3d', '일러스트', '사진', '그림', '만화', '수채화', '유화', '디지털'],
      최소_단어: 4
    },
    video: {
      목적: ['광고', '교육', '홍보', '설명', '튜토리얼', '소개', '리뷰', '뉴스'],
      길이: ['초', '분', '짧게', '길게', '숏폼', '장편'],
      최소_단어: 5
    },
    dev: {
      유형: ['웹', '웹사이트', '앱', '어플', '프로그램', 'api', '시스템', '사이트'],
      기능: ['로그인', '검색', '결제', '관리', '채팅', '업로드', '다운로드'],
      최소_단어: 6
    }
  };

  const reqs = requirements[domain] || requirements.image;
  let filledCount = 0;
  let missingAspects = [];
  let foundKeywords = [];

  // 각 필수 요소 체크
  Object.entries(reqs).forEach(([aspect, keywords]) => {
    if (aspect === '최소_단어') return;
    
    const matchedKeywords = keywords.filter(keyword => allText.includes(keyword));
    if (matchedKeywords.length > 0) {
      filledCount++;
      foundKeywords.push(...matchedKeywords);
    } else {
      missingAspects.push(aspect);
    }
  });

  // 단어 수 체크
  const words = allText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const minWords = reqs.최소_단어;

  // 충분성 판단
  const hasEnoughKeywords = filledCount >= 2; // 최소 2개 카테고리
  const hasEnoughWords = wordCount >= minWords;
  const sufficient = hasEnoughKeywords && hasEnoughWords;

  const totalCategories = Object.keys(reqs).length - 1; // 최소_단어 제외
  const completeness = Math.round((filledCount / totalCategories) * 100);

  return {
    sufficient,
    filledCount,
    totalCategories,
    missingAspects,
    wordCount,
    minWords,
    completeness,
    foundKeywords: [...new Set(foundKeywords)] // 중복 제거
  };
}

// ❓ 부족한 정보에 따른 질문 생성
function generateQuestions(sufficiency, domain) {
  const questionSets = {
    image: {
      주체: {
        question: '무엇을 그리고 싶으신가요?',
        placeholder: '예: 골든리트리버 강아지, 젊은 여성, 커피잔, 도시 야경',
        options: ['사람', '동물', '제품/물건', '풍경/배경', '캐릭터', '직접 입력']
      },
      스타일: {
        question: '어떤 스타일로 만드시겠어요?',
        placeholder: '예: 사실적인 사진, 디즈니 애니메이션, 수채화, 미니멀 일러스트',
        options: ['사실적 사진', '3D 렌더링', '애니메이션', '일러스트', '수채화/유화', '직접 입력']
      }
    },
    video: {
      목적: {
        question: '영상의 목적이 무엇인가요?',
        placeholder: '예: 제품 광고, 교육 콘텐츠, 유튜브 영상, 회사 홍보',
        options: ['광고/홍보', '교육/설명', '엔터테인먼트', '리뷰/소개', '뉴스/정보', '직접 입력']
      },
      길이: {
        question: '영상 길이는 어느 정도로?',
        placeholder: '예: 15초 숏폼, 2분 설명영상, 10분 튜토리얼',
        options: ['15초 (숏폼)', '1분 (SNS)', '3분 (설명)', '10분+ (긴 콘텐츠)', '직접 입력']
      }
    },
    dev: {
      유형: {
        question: '어떤 프로그램을 만드시나요?',
        placeholder: '예: 쇼핑몰 웹사이트, 배달 앱, 재고관리 시스템',
        options: ['웹사이트', '모바일 앱', 'API/백엔드', '데스크톱 프로그램', '직접 입력']
      },
      기능: {
        question: '가장 중요한 기능은 무엇인가요?',
        placeholder: '예: 사용자 로그인, 온라인 결제, 실시간 채팅, 파일 업로드',
        options: ['로그인/회원관리', '결제/쇼핑', '채팅/소통', '검색/필터링', '파일 관리', '직접 입력']
      }
    }
  };

  const domainQuestions = questionSets[domain] || questionSets.image;
  const questions = [];

  // 부족한 부분에 대한 질문만 생성
  sufficiency.missingAspects.forEach(aspect => {
    if (domainQuestions[aspect]) {
      questions.push({
        key: aspect,
        ...domainQuestions[aspect]
      });
    }
  });

  // 최대 2개까지만
  return questions.slice(0, 2);
}

// 🤖 OpenAI 개선 시도 (재시도 포함)
async function attemptOpenAIImprovement(userInput, answers, domain) {
  const maxRetries = 3;
  const retryDelay = 2000; // 2초
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 OpenAI 시도 ${attempt}/${maxRetries}`);
    
    try {
      const result = await callOpenAI(userInput, answers, domain);
      
      // 응답 품질 검증
      if (validateResponse(result, userInput)) {
        console.log('✅ OpenAI 응답 검증 통과');
        return { success: true, prompt: result };
      } else {
        console.log('⚠️ 응답 품질 부족, 재시도...');
        if (attempt < maxRetries) {
          await sleep(retryDelay);
        }
      }
      
    } catch (error) {
      console.log(`❌ 시도 ${attempt} 실패:`, error.message);
      
      if (attempt < maxRetries) {
        await sleep(retryDelay);
      } else {
        return { success: false, error };
      }
    }
  }
  
  return { 
    success: false, 
    error: new Error('최대 재시도 횟수 초과 - AI 서비스가 응답하지 않습니다') 
  };
}

// 🤖 실제 OpenAI API 호출
async function callOpenAI(userInput, answers, domain) {
  const allInput = [userInput, ...answers].join(' ');
  
  const prompts = {
    image: `다음을 Midjourney/DALL-E용 완벽한 영어 프롬프트로 개선해주세요:

"${allInput}"

요구사항:
- 주체, 스타일, 구도, 조명, 색감, 품질 키워드 모두 포함
- 전문적이고 구체적인 영어로 작성
- 고품질 키워드 추가 (high quality, detailed, masterpiece 등)
- 부정 프롬프트도 포함 (--no blurry, low quality, watermark)
- 500자 이내로 간결하게

완성된 영어 프롬프트만 출력하세요:`,

    video: `다음을 전문 영상 제작 기획서로 개선해주세요:

"${allInput}"

요구사항:
- 목적, 길이, 스타일, 대상, 구성 요소 모두 포함  
- 실제 제작팀이 바로 이해할 수 있는 구체적 내용
- 한국어로 작성
- 500자 이내로 간결하게

완성된 영상 기획서만 출력하세요:`,

    dev: `다음을 개발팀용 완벽한 요구사항으로 개선해주세요:

"${allInput}"

요구사항:
- 기능, 사용자, 기술스택, 우선순위 모두 포함
- 개발팀이 바로 착수할 수 있는 구체적 내용
- 한국어로 작성  
- 500자 이내로 간결하게

완성된 개발 요구사항만 출력하세요:`
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: '당신은 프롬프트 개선 전문가입니다. 사용자의 요청을 완벽하고 구체적인 프롬프트로 변환해주세요.'
        },
        {
          role: 'user', 
          content: prompts[domain] || prompts.image
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    }),
    signal: AbortSignal.timeout(15000) // 15초 타임아웃
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API 오류: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content?.trim();
  
  if (!content) {
    throw new Error('OpenAI가 빈 응답을 반환했습니다');
  }
  
  return content;
}

// 🔍 응답 품질 검증
function validateResponse(response, originalInput) {
  if (!response || typeof response !== 'string') {
    console.log('❌ 응답이 문자열이 아님');
    return false;
  }
  
  // 길이 검증
  if (response.length < 30) {
    console.log('❌ 응답이 너무 짧음:', response.length);
    return false;
  }
  
  if (response.length > 2000) {
    console.log('❌ 응답이 너무 김:', response.length);  
    return false;
  }
  
  // 원본과 너무 유사한지 검증
  const similarity = calculateSimilarity(originalInput.toLowerCase(), response.toLowerCase());
  if (similarity > 0.85) {
    console.log('❌ 원본과 너무 유사함:', similarity.toFixed(2));
    return false;
  }
  
  console.log('✅ 응답 품질 검증 통과 - 길이:', response.length, '유사도:', similarity.toFixed(2));
  return true;
}

// 💔 실패 시 정직한 안내
function handleFailureHonestly(error) {
  const errorMessage = error.message.toLowerCase();
  
  let errorType = 'unknown';
  let title = '❓ 알 수 없는 오류';
  let message = '예상치 못한 문제가 발생했습니다.';
  let suggestion = '잠시 후 다시 시도해주시거나, 브라우저를 새로고침해주세요.';
  let canRetry = true;

  if (errorMessage.includes('timeout') || errorMessage.includes('응답하지 않습니다')) {
    errorType = 'timeout';
    title = '⏰ 연결 시간 초과';
    message = 'AI 서비스가 응답하지 않고 있습니다.';
    suggestion = '네트워크 상태를 확인하고 1-2분 후 다시 시도해주세요.';
    canRetry = true;
  } else if (errorMessage.includes('quota') || errorMessage.includes('limit') || errorMessage.includes('usage')) {
    errorType = 'quota';
    title = '🚫 서비스 일시 중단';  
    message = 'AI 사용량이 일시적으로 초과되었습니다.';
    suggestion = '몇 시간 후 다시 이용해주시거나, 내일 다시 방문해주세요.';
    canRetry = false;
  } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
    errorType = 'network';
    title = '🌐 연결 오류';
    message = '인터넷 연결에 문제가 있습니다.';
    suggestion = '네트워크 연결을 확인하고 페이지를 새로고침해주세요.';
    canRetry = true;
  }

  return {
    error: true,
    type: errorType,
    title,
    message,
    suggestion,
    canRetry,
    timestamp: new Date().toISOString()
  };
}

// 🔧 유틸리티 함수들
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateSimilarity(str1, str2) {
  const words1 = str1.split(/\s+/).filter(w => w.length > 1);
  const words2 = str2.split(/\s+/).filter(w => w.length > 1);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(word => words2.includes(word));
  return commonWords.length / Math.max(words1.length, words2.length);
}
