// 독립형 API - helpers.js 의존성 완전 제거
// OpenAI API 키
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// JSON 파서 (helpers.js 대신 직접 구현)
async function readJson(req) {
  try {
    // Vercel에서는 보통 req.body가 이미 파싱되어 있음
    if (req.body && typeof req.body === 'object') {
      return req.body;
    }
    
    // 문자열인 경우 JSON 파싱
    if (typeof req.body === 'string') {
      return JSON.parse(req.body);
    }
    
    // 스트림인 경우 읽기
    if (req.readable) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString('utf-8');
      return body ? JSON.parse(body) : {};
    }
    
    return {};
  } catch (error) {
    console.error('JSON 파싱 오류:', error);
    return {};
  }
}

export default async function handler(req, res) {
  console.log('🚀 독립형 프롬프트 개선 API 시작');
  console.log('요청 메소드:', req.method);
  console.log('요청 헤더:', req.headers);
  
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    console.log('❌ POST가 아닌 요청:', req.method);
    return res.status(405).json({ 
      error: true,
      message: 'Method not allowed. Use POST.'
    });
  }

  try {
    // 요청 데이터 읽기
    const requestData = await readJson(req);
    console.log('📨 파싱된 요청 데이터:', requestData);

    const { 
      userInput = "", 
      answers = [], 
      domain = "image" 
    } = requestData;

    console.log('🔍 추출된 파라미터:', { 
      userInput: userInput.slice(0, 50) + '...', 
      answersCount: answers.length, 
      domain 
    });

    // 1단계: 입력 검증
    if (!userInput || !userInput.trim()) {
      console.log('❌ 빈 입력');
      return res.status(400).json({
        error: true,
        type: 'invalid_input',
        message: '프롬프트를 입력해주세요.'
      });
    }

    // 2단계: OpenAI API 키 확인
    console.log('🔑 API 키 확인:', !!OPENAI_API_KEY);
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-api-key-here') {
      console.error('❌ OpenAI API 키 없음');
      return res.status(503).json({
        error: true,
        type: 'service_unavailable',
        title: '🚫 서비스 일시 중단',
        message: 'AI 서비스 설정에 문제가 있습니다.',
        suggestion: 'OpenAI API 키를 확인해주세요.',
        canRetry: false
      });
    }

    // 3단계: 입력 충분성 검사
    const sufficiency = checkInputSufficiency(userInput, answers, domain);
    console.log('📊 입력 충분성 결과:', sufficiency);

    if (!sufficiency.sufficient) {
      // 정보 부족 → 질문 생성
      const questions = generateQuestions(sufficiency, domain);
      
      console.log('❓ 질문 생성됨:', questions.length, '개');
      return res.status(200).json({
        success: false,
        action: 'need_more_info',
        questions: questions,
        completeness: sufficiency.completeness,
        message: `${sufficiency.completeness}% 완성. AI가 완벽한 프롬프트를 만들기 위해 조금만 더 알려주세요!`
      });
    }

    // 4단계: OpenAI로 개선 시도
    console.log('🤖 OpenAI 개선 시작');
    const aiResult = await attemptOpenAIImprovement(userInput, answers, domain);

    if (aiResult.success) {
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
      console.log('❌ OpenAI 실패:', aiResult.error.message);
      const failureResponse = handleFailureHonestly(aiResult.error);
      return res.status(503).json(failureResponse);
    }

  } catch (error) {
    console.error('❌ 전체 시스템 오류:', error);
    console.error('오류 스택:', error.stack);
    
    return res.status(500).json({
      error: true,
      type: 'system_error',
      title: '❓ 시스템 오류',
      message: '서버에서 오류가 발생했습니다.',
      suggestion: '페이지를 새로고침하고 다시 시도해주세요.',
      canRetry: true,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// 📊 입력 충분성 검사
function checkInputSufficiency(userInput, answers, domain) {
  const allText = [userInput, ...answers].join(' ').toLowerCase();
  
  // 도메인별 키워드
  const requirements = {
    image: {
      주체: ['강아지', '고양이', '사람', '여자', '남자', '제품', '로고', '풍경'],
      스타일: ['사실적', '애니메이션', '3d', '일러스트', '사진', '그림'],
      최소_단어: 4
    },
    video: {
      목적: ['광고', '교육', '홍보', '설명', '튜토리얼'],
      길이: ['초', '분', '짧게', '길게'],
      최소_단어: 5  
    },
    dev: {
      유형: ['웹', '앱', '프로그램', 'api', '사이트'],
      기능: ['로그인', '검색', '결제', '관리'],
      최소_단어: 6
    }
  };

  const reqs = requirements[domain] || requirements.image;
  let filledCount = 0;
  let missingAspects = [];

  // 키워드 체크
  Object.entries(reqs).forEach(([aspect, keywords]) => {
    if (aspect === '최소_단어') return;
    
    const found = keywords.some(keyword => allText.includes(keyword));
    if (found) {
      filledCount++;
    } else {
      missingAspects.push(aspect);
    }
  });

  // 길이 체크
  const wordCount = allText.split(/\s+/).length;
  const sufficient = (filledCount >= 2) && (wordCount >= reqs.최소_단어);
  const totalCategories = Object.keys(reqs).length - 1;
  const completeness = Math.round((filledCount / totalCategories) * 100);

  return {
    sufficient,
    filledCount,
    totalCategories,
    missingAspects,
    wordCount,
    completeness
  };
}

// ❓ 질문 생성
function generateQuestions(sufficiency, domain) {
  const questionSets = {
    image: {
      주체: {
        question: '무엇을 그리고 싶으신가요?',
        placeholder: '예: 골든리트리버 강아지, 젊은 여성',
        options: ['사람', '동물', '제품/물건', '풍경', '직접 입력']
      },
      스타일: {
        question: '어떤 스타일로 만드시겠어요?',
        placeholder: '예: 사실적인 사진, 애니메이션',
        options: ['사실적 사진', '애니메이션', '일러스트', '3D', '직접 입력']
      }
    },
    video: {
      목적: {
        question: '영상의 목적이 무엇인가요?',
        placeholder: '예: 제품 광고, 교육 콘텐츠',
        options: ['광고', '교육', '홍보', '설명', '직접 입력']
      },
      길이: {
        question: '영상 길이는?',
        placeholder: '예: 30초, 2분',
        options: ['30초', '1분', '3분', '5분+', '직접 입력']
      }
    },
    dev: {
      유형: {
        question: '어떤 프로그램인가요?',
        placeholder: '예: 쇼핑몰, 배달앱',
        options: ['웹사이트', '모바일앱', 'API', '직접 입력']
      },
      기능: {
        question: '주요 기능은?',
        placeholder: '예: 로그인, 결제',
        options: ['로그인', '결제', '검색', '관리', '직접 입력']
      }
    }
  };

  const questions = questionSets[domain] || questionSets.image;
  return sufficiency.missingAspects
    .map(aspect => questions[aspect])
    .filter(q => q)
    .slice(0, 2);
}

// 🤖 OpenAI 시도
async function attemptOpenAIImprovement(userInput, answers, domain) {
  const maxRetries = 2;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 OpenAI 시도 ${attempt}/${maxRetries}`);
    
    try {
      const result = await callOpenAI(userInput, answers, domain);
      
      if (result && result.length > 20) {
        console.log('✅ OpenAI 성공');
        return { success: true, prompt: result };
      } else {
        console.log('⚠️ 응답 품질 부족');
      }
      
    } catch (error) {
      console.log(`❌ 시도 ${attempt} 실패:`, error.message);
      
      if (attempt === maxRetries) {
        return { success: false, error };
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return { success: false, error: new Error('최대 재시도 횟수 초과') };
}

// 🤖 OpenAI API 호출
async function callOpenAI(userInput, answers, domain) {
  const allInput = [userInput, ...answers].join(' ');
  
  const prompts = {
    image: `다음을 완벽한 영어 이미지 프롬프트로 개선하세요:
"${allInput}"
요구사항: 주체, 스타일, 구도, 조명 포함. 500자 이내.`,
    
    video: `다음을 영상 기획서로 개선하세요:
"${allInput}"
요구사항: 목적, 길이, 구성 포함. 한국어 500자 이내.`,
    
    dev: `다음을 개발 요구사항으로 개선하세요:
"${allInput}"
요구사항: 기능, 기술, 사용자 포함. 한국어 500자 이내.`
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: prompts[domain] || prompts.image
      }],
      temperature: 0.7,
      max_tokens: 500
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API 오류: ${response.status} - ${errorData.error?.message || 'Unknown'}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim();
}

// 💔 실패 처리
function handleFailureHonestly(error) {
  const msg = error.message.toLowerCase();
  
  if (msg.includes('timeout')) {
    return {
      error: true,
      title: '⏰ 연결 시간 초과',
      message: 'AI 서비스가 응답하지 않습니다.',
      suggestion: '1-2분 후 다시 시도해주세요.',
      canRetry: true
    };
  }
  
  if (msg.includes('quota') || msg.includes('limit')) {
    return {
      error: true,
      title: '🚫 사용량 초과',
      message: 'AI 사용량이 초과되었습니다.',
      suggestion: '몇 시간 후 다시 시도해주세요.',
      canRetry: false
    };
  }
  
  return {
    error: true,
    title: '❓ 서비스 오류',
    message: 'AI 서비스에 문제가 발생했습니다.',
    suggestion: '잠시 후 다시 시도해주세요.',
    canRetry: true
  };
}
