// 🚨 강화된 디버깅 버전 - 모든 단계에서 로그 출력
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 즉시 실행 로그 (파일 로드 확인)
console.log('🚀 API 파일 로드됨 - 새 버전 확인:', new Date().toISOString());
console.log('🔑 환경변수 체크:', {
  hasKey: !!OPENAI_API_KEY,
  keyStart: OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 7) + '...' : 'NONE',
  keyLength: OPENAI_API_KEY ? OPENAI_API_KEY.length : 0
});

async function readJson(req) {
  console.log('📖 JSON 읽기 시작');
  try {
    if (req.body && typeof req.body === 'object') {
      console.log('📖 body 객체로 읽음:', Object.keys(req.body));
      return req.body;
    }
    
    if (typeof req.body === 'string') {
      console.log('📖 body 문자열로 읽음, 길이:', req.body.length);
      return JSON.parse(req.body);
    }
    
    if (req.readable) {
      console.log('📖 스트림으로 읽기 시작');
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString('utf-8');
      console.log('📖 스트림 읽기 완료, 길이:', body.length);
      return body ? JSON.parse(body) : {};
    }
    
    console.log('📖 빈 객체 반환');
    return {};
  } catch (error) {
    console.error('📖 JSON 파싱 실패:', error.message);
    return {};
  }
}

export default async function handler(req, res) {
  const startTime = Date.now();
  console.log('🌟 === API 핸들러 시작 ===');
  console.log('🌟 요청 시간:', new Date().toISOString());
  console.log('🌟 메소드:', req.method);
  console.log('🌟 URL:', req.url);
  console.log('🌟 헤더:', JSON.stringify(req.headers, null, 2));
  
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    console.log('🌟 OPTIONS 요청 - CORS 응답');
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    console.log('🌟 POST가 아닌 요청:', req.method);
    return res.status(405).json({ 
      error: true,
      message: `Method ${req.method} not allowed. Use POST.`,
      timestamp: new Date().toISOString()
    });
  }

  try {
    // 1. 요청 데이터 파싱
    console.log('📝 1단계: 요청 데이터 파싱 시작');
    const requestData = await readJson(req);
    console.log('📝 파싱 결과:', JSON.stringify(requestData, null, 2));

    const { userInput = "", answers = [], domain = "image" } = requestData;
    console.log('📝 추출된 데이터:', { 
      userInput: `"${userInput}"`, 
      answersCount: answers.length, 
      domain,
      answers: answers 
    });

    // 2. 입력 검증
    console.log('✅ 2단계: 입력 검증');
    if (!userInput || !userInput.trim()) {
      console.log('✅ 입력이 비어있음');
      return res.status(400).json({
        error: true,
        type: 'invalid_input',
        message: '프롬프트를 입력해주세요.',
        received: { userInput, answers, domain }
      });
    }
    console.log('✅ 입력 검증 통과');

    // 3. API 키 검증 (상세히)
    console.log('🔐 3단계: API 키 검증 시작');
    console.log('🔐 환경변수들:', Object.keys(process.env).filter(k => k.includes('OPEN')));
    console.log('🔐 OPENAI_API_KEY 존재:', !!OPENAI_API_KEY);
    console.log('🔐 OPENAI_API_KEY 타입:', typeof OPENAI_API_KEY);
    console.log('🔐 OPENAI_API_KEY 길이:', OPENAI_API_KEY ? OPENAI_API_KEY.length : 0);
    console.log('🔐 OPENAI_API_KEY 시작:', OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 7) + '...' : 'null');
    
    if (!OPENAI_API_KEY) {
      console.log('🔐 API 키가 없음!');
      return res.status(503).json({
        error: true,
        type: 'no_api_key',
        title: '🚫 API 키 없음',
        message: 'OpenAI API 키가 설정되지 않았습니다.',
        debug: {
          envKeys: Object.keys(process.env).filter(k => k.includes('OPEN')),
          hasKey: !!OPENAI_API_KEY,
          keyType: typeof OPENAI_API_KEY
        }
      });
    }

    if (OPENAI_API_KEY === 'your-api-key-here' || OPENAI_API_KEY.length < 20) {
      console.log('🔐 API 키가 유효하지 않음!');
      return res.status(503).json({
        error: true,
        type: 'invalid_api_key',
        title: '🚫 잘못된 API 키',
        message: 'OpenAI API 키가 올바르지 않습니다.',
        debug: {
          keyLength: OPENAI_API_KEY.length,
          keyStart: OPENAI_API_KEY.slice(0, 10)
        }
      });
    }
    console.log('🔐 API 키 검증 통과!');

    // 4. 입력 충분성 검사
    console.log('📊 4단계: 입력 충분성 검사');
    const allText = [userInput, ...answers].join(' ').toLowerCase();
    console.log('📊 전체 텍스트:', allText);
    
    const wordCount = allText.split(/\s+/).length;
    const hasKeywords = /강아지|고양이|사람|그림|이미지|영상|앱|웹/.test(allText);
    console.log('📊 단어 수:', wordCount, '키워드 포함:', hasKeywords);

    if (wordCount < 3 || !hasKeywords) {
      console.log('📊 정보 부족 - 질문 생성');
      return res.status(200).json({
        success: false,
        action: 'need_more_info',
        questions: [{
          question: '구체적으로 어떤 것을 만들고 싶으신가요?',
          options: ['이미지/그림', '영상', '웹사이트/앱', '직접 입력']
        }],
        debug: { wordCount, hasKeywords, allText }
      });
    }
    console.log('📊 충분성 검사 통과');

    // 5. OpenAI API 호출 시작
    console.log('🤖 5단계: OpenAI API 호출 시작');
    
    const prompt = `다음 한국어 요청을 구체적이고 상세한 프롬프트로 개선해주세요:
"${allText}"

개선 요구사항:
- 더 구체적이고 상세하게
- 전문적인 용어 사용
- 500자 이내
- ${domain === 'image' ? '영어로' : '한국어로'} 작성`;

    console.log('🤖 사용할 프롬프트:', prompt);

    const requestBody = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    };
    console.log('🤖 OpenAI 요청 바디:', JSON.stringify(requestBody, null, 2));

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000)
    });

    console.log('🤖 OpenAI 응답 상태:', openaiResponse.status);
    console.log('🤖 OpenAI 응답 헤더:', Object.fromEntries(openaiResponse.headers));

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(e => {
        console.log('🤖 에러 데이터 파싱 실패:', e.message);
        return {};
      });
      console.log('🤖 OpenAI 에러 응답:', JSON.stringify(errorData, null, 2));
      
      throw new Error(`OpenAI API 오류: ${openaiResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('🤖 OpenAI 성공 응답:', JSON.stringify(openaiData, null, 2));

    const improvedPrompt = openaiData.choices[0]?.message?.content?.trim();
    console.log('🤖 추출된 개선 프롬프트:', improvedPrompt);

    if (!improvedPrompt || improvedPrompt.length < 10) {
      throw new Error('OpenAI 응답이 비어있거나 너무 짧음');
    }

    // 6. 성공 응답
    const processingTime = Date.now() - startTime;
    console.log('✨ 6단계: 성공! 처리 시간:', processingTime, 'ms');
    
    return res.status(200).json({
      success: true,
      improved: improvedPrompt,
      score: 95,
      message: '✨ AI가 프롬프트를 완벽하게 개선했습니다!',
      debug: {
        processingTime: processingTime + 'ms',
        originalLength: userInput.length,
        improvedLength: improvedPrompt.length,
        tokenUsage: openaiData.usage
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('💥 === 치명적 오류 발생 ===');
    console.error('💥 처리 시간:', processingTime, 'ms');
    console.error('💥 오류 메시지:', error.message);
    console.error('💥 오류 스택:', error.stack);
    console.error('💥 오류 타입:', error.constructor.name);
    
    let errorResponse;
    
    if (error.message.includes('timeout')) {
      errorResponse = {
        error: true,
        title: '⏰ 시간 초과',
        message: 'AI 서비스 응답이 너무 오래 걸립니다.',
        suggestion: '잠시 후 다시 시도해주세요.'
      };
    } else if (error.message.includes('401')) {
      errorResponse = {
        error: true,
        title: '🔐 인증 오류',
        message: 'OpenAI API 키가 유효하지 않습니다.',
        suggestion: 'API 키를 확인해주세요.'
      };
    } else if (error.message.includes('429')) {
      errorResponse = {
        error: true,
        title: '🚫 사용량 초과',
        message: 'API 사용량이 한도를 초과했습니다.',
        suggestion: '잠시 후 다시 시도해주세요.'
      };
    } else {
      errorResponse = {
        error: true,
        title: '💥 시스템 오류',
        message: '예상치 못한 오류가 발생했습니다.',
        suggestion: '페이지를 새로고침하고 다시 시도해주세요.'
      };
    }
    
    errorResponse.debug = {
      error: error.message,
      stack: error.stack,
      processingTime: processingTime + 'ms',
      timestamp: new Date().toISOString()
    };
    
    return res.status(500).json(errorResponse);
  }
}
