// 환경변수 문제 우회 테스트 버전
console.log('=== 파일 로드 시점 환경변수 체크 ===');
console.log('모든 환경변수 키들:', Object.keys(process.env).slice(0, 10));
console.log('OPENAI 관련 변수들:', Object.keys(process.env).filter(k => k.includes('OPEN')));

// 여러 방법으로 API 키 확인
const API_KEY_V1 = process.env.OPENAI_API_KEY;
const API_KEY_V2 = process.env['OPENAI_API_KEY'];

async function readJson(req) {
  try {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') return JSON.parse(req.body);
    
    if (req.readable) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString('utf-8');
      return body ? JSON.parse(body) : {};
    }
    return {};
  } catch (error) {
    console.error('JSON 파싱 오류:', error.message);
    return {};
  }
}

export default async function handler(req, res) {
  console.log('=== API 핸들러 실행 시작 ===');
  
  // 실행 시점의 환경변수 재확인
  console.log('실행 시점 환경변수:');
  console.log('- 전체 환경변수 개수:', Object.keys(process.env).length);
  console.log('- VERCEL 관련:', Object.keys(process.env).filter(k => k.includes('VERCEL')).length + '개');
  console.log('- NODE 관련:', Object.keys(process.env).filter(k => k.includes('NODE')).length + '개');
  console.log('- OPENAI_API_KEY (방법1):', !!API_KEY_V1);
  console.log('- OPENAI_API_KEY (방법2):', !!API_KEY_V2);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const requestData = await readJson(req);
    const { userInput = "", answers = [], domain = "image" } = requestData;

    console.log('입력 데이터:', { userInput: userInput.slice(0, 30), domain });

    if (!userInput?.trim()) {
      return res.status(400).json({
        error: true,
        message: '프롬프트를 입력해주세요.'
      });
    }

    // API 키 최종 확인 및 대안
    const finalApiKey = API_KEY_V1 || API_KEY_V2;
    
    if (!finalApiKey) {
      return res.status(503).json({
        error: true,
        title: '환경변수 문제',
        message: 'Vercel Functions에서 환경변수를 읽을 수 없습니다.',
        debug: {
          totalEnvVars: Object.keys(process.env).length,
          hasVercelVars: Object.keys(process.env).some(k => k.includes('VERCEL')),
          envSample: Object.keys(process.env).slice(0, 5),
          method1: !!API_KEY_V1,
          method2: !!API_KEY_V2
        }
      });
    }

    // 간단한 입력 검증
    const allText = [userInput, ...answers].join(' ');
    if (allText.length < 5) {
      return res.status(200).json({
        success: false,
        action: 'need_more_info',
        questions: [{
          question: '어떤 종류의 결과물을 원하시나요?',
          options: ['이미지/그림', '영상', '웹사이트/앱', '직접 입력']
        }],
        message: '더 구체적인 정보가 필요합니다.'
      });
    }

    // OpenAI API 호출
    console.log('OpenAI API 호출 시작...');
    
    const prompt = domain === 'image' 
      ? `Transform this Korean request into a detailed English image prompt: "${allText}". Include subject, style, composition, lighting. Maximum 300 words.`
      : `Improve this Korean request with specific details and requirements: "${allText}". Make it more professional and detailed. Maximum 300 words in Korean.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    console.log('OpenAI 응답 상태:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI 오류:', errorData);
      
      let errorMsg = 'AI 서비스 오류가 발생했습니다.';
      if (response.status === 401) errorMsg = 'API 키가 유효하지 않습니다.';
      if (response.status === 429) errorMsg = 'API 사용량을 초과했습니다.';
      
      return res.status(503).json({
        error: true,
        title: 'OpenAI API 오류',
        message: errorMsg,
        debug: { status: response.status, error: errorData }
      });
    }

    const data = await response.json();
    const improved = data.choices[0]?.message?.content?.trim();

    if (!improved) {
      throw new Error('OpenAI 응답이 비어있습니다.');
    }

    console.log('성공적으로 완료됨');

    return res.status(200).json({
      success: true,
      improved: improved,
      score: 95,
      message: 'AI가 프롬프트를 성공적으로 개선했습니다!',
      debug: {
        originalLength: userInput.length,
        improvedLength: improved.length,
        apiKeyFound: true
      }
    });

  } catch (error) {
    console.error('시스템 오류:', error);
    
    return res.status(500).json({
      error: true,
      title: '시스템 오류',
      message: error.message,
      debug: { stack: error.stack }
    });
  }
}
