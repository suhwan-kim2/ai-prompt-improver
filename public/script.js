// script.js - 새로운 API 경로로 테스트

async function improvePrompt() {
    const userInput = document.getElementById('searchInput').value.trim();
    
    if (!userInput) {
        alert('텍스트를 입력해주세요!');
        return;
    }
    
    console.log('=== 새로운 API 테스트 시작 ===');
    
    try {
        // 🔥 새로운 API 경로들을 순차적으로 시도
        const apiPaths = [
            '/api/index',           // 새로운 경로 1
            '/api',                 // 새로운 경로 2  
            '/api/improve-prompt'   // 기존 경로
        ];
        
        let success = false;
        let lastError = null;
        
        for (const apiPath of apiPaths) {
            try {
                console.log('시도 중인 API 경로:', apiPath);
                
                const response = await fetch(apiPath, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        step: 'questions',
                        userInput: userInput,
                        isExpertMode: isExpertMode || false
                    })
                });
                
                console.log(`${apiPath} 응답:`, response.status, response.statusText);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log(`${apiPath} 성공!`, result);
                    
                    alert(`API 연결 성공!\n경로: ${apiPath}\n응답: ${JSON.stringify(result, null, 2)}`);
                    success = true;
                    break;
                    
                } else {
                    const errorText = await response.text();
                    console.log(`${apiPath} 실패:`, response.status, errorText);
                    lastError = `${apiPath}: ${response.status} ${errorText}`;
                }
                
            } catch (error) {
                console.log(`${apiPath} 오류:`, error);
                lastError = `${apiPath}: ${error.message}`;
            }
        }
        
        if (!success) {
            throw new Error(`모든 API 경로 실패:\n${lastError}`);
        }
        
    } catch (
