// 🔍 API 디버깅 코드 - /api/debug-openai.js 파일로 만들어서 테스트
import { readJson } from "./helpers.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
  console.log('🔍 OpenAI API 진단 시작');
  
  try {
    // 1. API 키 존재 여부
    console.log('1️⃣ API 키 확인');
    console.log('API 키 존재:', !!OPENAI_API_KEY);
    console.log('API 키 앞 10자:', OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 10) + '...' : 'null');
    
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-api-key-here') {
      return res.status(200).json({
        status: '❌ API 키 문제',
        issue: 'OpenAI API 키가 설정되지 않음',
        solution: 'Vercel 환경변수 OPENAI_API_KEY 설정 필요',
        apiKeyExists: false,
        timestamp: new Date().toISOString()
      });
    }
    
    // 2. OpenAI API 테스트 호출
    console.log('2️⃣ OpenAI API 테스트 호출');
    
    const testResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello! This is a test.' }
        ],
        max_tokens: 10
      })
    });
    
    console.log('OpenAI 응답 상태:', testResponse.status);
    console.log('OpenAI 응답 헤더:', Object.fromEntries(testResponse.headers));
    
    if (!testResponse.ok) {
      const errorData = await testResponse.json().catch(() => ({}));
      console.log('OpenAI 오류 데이터:', errorData);
      
      let issue, solution;
      
      if (testResponse.status === 401) {
        issue = 'API 키가 유효하지 않음';
        solution = 'OpenAI 대시보드에서 새 API 키를 생성하고 다시 설정';
      } else if (testResponse.status === 429) {
        issue = 'API 사용량 한도 초과 또는 요청 속도 제한';
        solution = 'OpenAI 대시보드에서 Usage 확인, 결제 정보 확인';
      } else if (testResponse.status === 402) {
        issue = '크레딧 부족 또는 결제 정보 문제';
        solution = 'OpenAI 대시보드 Billing 탭에서 크레딧 충전';
      } else {
        issue = `OpenAI API 오류: ${testResponse.status}`;
        solution = '잠시 후 다시 시도하거나 OpenAI 상태 페이지 확인';
      }
      
      return res.status(200).json({
        status: '❌ OpenAI API 문제',
        issue,
        solution,
        apiKeyExists: true,
        openaiStatus: testResponse.status,
        openaiError: errorData,
        timestamp: new Date().toISOString()
      });
    }
    
    // 3. 성공적인 응답 확인
    const responseData = await testResponse.json();
    console.log('OpenAI 성공 응답:', responseData);
    
    return res.status(200).json({
      status: '✅ 모든 것이 정상',
      message: 'OpenAI API가 정상적으로 작동합니다',
      apiKeyExists: true,
      openaiStatus: testResponse.status,
      testResponse: responseData.choices[0]?.message?.content || 'No content',
      usage: responseData.usage,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('진단 중 오류:', error);
    
    return res.status(200).json({
      status: '❌ 시스템 오류',
      issue: error.message,
      solution: '네트워크 연결 또는 서버 설정 확인 필요',
      errorType: error.constructor.name,
      timestamp: new Date().toISOString()
    });
  }
}
