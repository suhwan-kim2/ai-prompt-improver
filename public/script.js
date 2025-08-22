// script.js - 최소한 API 테스트 버전

// 기본 변수들
let isExpertMode = false;
let currentQuestions = [];
let currentAnswers = {};
let originalUserInput = '';
let isProcessing = false;

// 페이지 로드
window.onload = function() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                improvePrompt();
            }
        });
    }
};

// 모드 토글
function toggleMode() {
    isExpertMode = !isExpertMode;
    const toggle = document.getElementById('modeToggle');
    const description = document.getElementById('modeDescription');
    
    if (isExpertMode) {
        toggle.classList.add('active');
        if (description) description.textContent = '전문가급 심층 개선';
    } else {
        toggle.classList.remove('active');
        if (description) description.textContent = '빠르고 간편한 개선';
    }
}

// 🔥 초간단 API 호출 함수
async function callAPI(step, data) {
    console.log('=== 초간단 API 테스트 ===');
    console.log('Step:', step);
    
    try {
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: step,
                userInput: data.userInput || '',
                isExpertMode: data.isExpertMode || false
            })
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log('API 결과:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'API 실패');
        }

        return result.result;
        
    } catch (error) {
        console.error('API 오류:', error);
        throw error;
    }
}

// 메인 함수
async function improvePrompt() {
    const userInput = document.getElementById('searchInput').value.trim();
    
    if (!userInput) {
        alert('텍스트를 입력해주세요!');
        return;
    }
    
    if (isProcessing) {
        alert('처리 중입니다...');
        return;
    }
    
    isProcessing = true;
    originalUserInput = userInput;
    
    try {
        showStatus('테스트 중...', 'processing');
        
        // 간단한 API 테스트
        const result = await callAPI('questions', {
            userInput: userInput,
            isExpertMode: isExpertMode
        });
        
        console.log('성공!', result);
        showStatus('API 테스트 성공!', 'success');
        
        // 간단한 결과 표시
        alert('API 연결 성공!\n결과: ' + result);
        
    } catch (error) {
        console.error('오류:', error);
        showStatus('API 연결 실패: ' + error.message, 'error');
        alert('오류: ' + error.message);
    } finally {
        isProcessing = false;
    }
}

// 상태 메시지
function showStatus(message, type) {
    console.log('Status:', message, type);
    
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;
    
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    statusDiv.className = 'status-message status-' + type;
    
    if (type !== 'processing') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
}

// 기타 함수들
function clearResults() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    showStatus('초기화 완료', 'success');
}

function skipQuestions() {
    alert('질문 건너뛰기 기능');
}

function proceedWithAnswers() {
    alert('답변 진행 기능');
}

// 나머지 함수들은 임시로 빈 함수
function selectOption() {}
function copyToClipboard() {}
function saveToFavorites() {}
