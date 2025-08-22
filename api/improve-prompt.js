// api/improve-prompt.js - FUNCTION_INVOCATION_FAILED 해결 버전

export default async function handler(req, res) {
    console.log('API 함수 시작됨');
    
    try {
        // CORS 설정
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        // OPTIONS 요청 처리
        if (req.method === 'OPTIONS') {
            console.log('OPTIONS 요청 처리됨');
            return res.status(200).end();
        }
        
        // POST 요청이 아닌 경우
        if (req.method !== 'POST') {
            console.log('잘못된 메소드:', req.method);
            return res.status(405).json({
                success: false,
                error: 'Method not allowed'
            });
        }
        
        // 요청 데이터 로깅
        console.log('요청 바디:', req.body);
        
        // 성공 응답
        console.log('성공 응답 전송');
        return res.status(200).json({
            success: true,
            result: JSON.stringify({
                questions: [
                    {
                        question: "어떤 스타일을 원하시나요?",
                        type: "choice",
                        options: ["현실적", "만화적", "3D", "기타"]
                    },
                    {
                        question: "주요 색상을 선택해주세요.",
                        type: "choice",
                        options: ["밝은 톤", "어두운 톤", "무채색", "기타"]
                    }
                ]
            })
        });
        
    } catch (error) {
        console.error('API 오류:', error);
        return res.status(500).json({
            success: false,
            error: error.message || '서버 오류'
        });
    }
}
