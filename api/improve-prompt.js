export default function handler(req, res) {
    console.log('API 호출됨:', req.method);
    
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        // 간단한 하드코딩 응답
        if (req.body?.step === 'questions') {
            return res.json({
                success: true,
                result: JSON.stringify({
                    questions: [
                        {
                            question: "어떤 스타일을 원하시나요?",
                            type: "choice",
                            options: ["현실적", "만화적", "3D", "기타"]
                        }
                    ]
                })
            });
        }
        
        return res.json({
            success: true,
            result: "간단한 테스트 응답입니다."
        });
        
    } catch (error) {
        console.error('API 오류:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
