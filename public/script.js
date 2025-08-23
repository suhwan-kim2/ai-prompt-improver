// script.js - 개선된 프론트엔드 (오류 처리 강화)

// 전역 변수들
let isExpertMode = false;
let currentQuestions = [];
let currentAnswers = {};
let originalUserInput = '';
let isProcessing = false;
let currentScore = 0;
let analysisData = null;

// 페이지 로드시 초기화
window.onload = function() {
    console.log('페이지 로드 완료 - 개선된 API 버전');
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                improvePrompt();
            }
        });
        
        // 입력시 실시간 유효성 검사
        searchInput.addEventListener('input', function(e) {
            const value = e.target.value.trim();
            if (value.length > 0) {
                searchInput.classList.remove('error');
            }
        });
    }
    
    // 모달 클릭 이벤트
    window.onclick = function(event) {
        const modal = document.getElementById('guideModal');
        if (modal && event.target === modal) {
            modalTitle.textContent = 'AI 프롬프트 개선기 사용법 - ' + (isExpertMode ? '전문가모드' : '일반모드');
    
    const guideContent = isExpertMode ? getExpertModeGuide() : getNormalModeGuide();
    modalBody.innerHTML = guideContent;
    
    modal.style.display = 'block';
}

function closeDetailedGuide() {
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function getNormalModeGuide() {
    return `
        <div class="guide-section">
            <h3>🚀 일반모드 특징</h3>
            <ul>
                <li>AI가 사용자 의도를 분석해서 맞춤 질문 생성</li>
                <li>의도 파악 점수에 따라 동적 질문 개수 조절</li>
                <li>90점+ 의도 파악시 질문 생략하고 바로 개선</li>
                <li>빠르고 효율적인 프롬프트 개선</li>
            </ul>
        </div>
        
        <div class="guide-section">
            <h3>📝 사용 팁</h3>
            <ul>
                <li><strong>구체적으로 작성:</strong> "그림 그려줘" → "귀여운 강아지 캐릭터 일러스트"</li>
                <li><strong>목적 명시:</strong> "SNS 프로필용", "발표 자료용" 등</li>
                <li><strong>제약사항 포함:</strong> "A4 사이즈", "30초 이내" 등</li>
            </ul>
        </div>
    `;
}

function getExpertModeGuide() {
    return `
        <div class="guide-section">
            <h3>🎯 전문가모드 특징</h3>
            <ul>
                <li>3단계 의도 파악 시스템</li>
                <li>사용자의 숨겨진 의도까지 완전 분석</li>
                <li>전문가급 95점 이상 프롬프트 생성</li>
                <li>복잡한 요구사항도 완벽하게 처리</li>
            </ul>
        </div>
        
        <div class="guide-section">
            <h3>🔍 프로세스 흐름</h3>
            <ol>
                <li><strong>1차 의도 분석:</strong> 기본 요구사항 파악</li>
                <li><strong>1차 질문:</strong> 부족한 정보 수집</li>
                <li><strong>2차 의도 분석:</strong> 심층 의도 파악</li>
                <li><strong>2차 질문:</strong> 숨겨진 요구사항 발굴</li>
                <li><strong>3차 의도 분석:</strong> 완전한 의도 파악</li>
                <li><strong>최종 개선:</strong> 전문가급 프롬프트 완성</li>
            </ol>
        </div>
        
        <div class="guide-section">
            <h3>⚡ 전문가모드 활용법</h3>
            <ul>
                <li><strong>복잡한 프로젝트:</strong> 웹사이트, 앱 개발, 영상 제작</li>
                <li><strong>비즈니스 용도:</strong> 마케팅, 브랜딩, 전략 수립</li>
                <li><strong>기술적 요구사항:</strong> 구체적 스펙, 고급 기능</li>
                <li><strong>창작 작업:</strong> 소설, 시나리오, 음악 등</li>
            </ul>
        </div>
    `;
}

// 디버깅을 위한 전역 함수들
window.debugInfo = function() {
    console.log('=== 디버그 정보 ===');
    console.log('현재 질문들:', currentQuestions);
    console.log('현재 답변들:', currentAnswers);
    console.log('분석 데이터:', analysisData);
    console.log('전문가 모드:', isExpertMode);
    console.log('처리 중:', isProcessing);
    console.log('원본 입력:', originalUserInput);
    console.log('현재 점수:', currentScore);
};

window.clearAllData = function() {
    if (confirm('모든 데이터를 초기화하시겠습니까?')) {
        localStorage.clear();
        clearResults();
        console.log('모든 데이터가 초기화되었습니다.');
    }
};

window.exportFavorites = function() {
    try {
        const favorites = JSON.parse(localStorage.getItem('prompt_favorites') || '[]');
        const dataStr = JSON.stringify(favorites, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `prompt_favorites_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('즐겨찾기 데이터를 내보냈습니다.');
    } catch (error) {
        console.error('즐겨찾기 내보내기 실패:', error);
    }
};

// 추가 유틸리티 함수들
function validateInput(input) {
    if (!input || typeof input !== 'string') return false;
    if (input.trim().length < 2) return false;
    if (input.length > 1000) return false;
    return true;
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/\s+/g, ' ').slice(0, 1000);
}

function formatAnswersForAPI(answers) {
    const formatted = [];
    Object.entries(answers).forEach(([index, answer]) => {
        if (answer && answer.trim().length > 0) {
            const questionIndex = parseInt(index);
            const question = currentQuestions[questionIndex] || `질문 ${questionIndex + 1}`;
            formatted.push(`Q: ${question}\nA: ${answer.trim()}`);
        }
    });
    return formatted;
}

// 성능 모니터링
function logPerformance(operation, startTime) {
    const duration = Date.now() - startTime;
    console.log(`성능: ${operation} - ${duration}ms`);
    if (duration > 3000) {
        console.warn(`느린 작업 감지: ${operation} (${duration}ms)`);
    }
}

// 에러 분석 및 리포팅
function analyzeError(error) {
    const errorInfo = {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        context: {
            isExpertMode,
            isProcessing,
            questionsCount: currentQuestions.length,
            answersCount: Object.keys(currentAnswers).length
        }
    };
    
    console.group('🔍 오류 분석');
    console.error('오류 정보:', errorInfo);
    console.groupEnd();
    
    // 개발 환경에서만 상세 정보 표시
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('vercel')) {
        window.lastError = errorInfo;
    }
    
    return errorInfo;
}

// CSS 추가 (동적으로 스타일 개선)
function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .answer-textarea {
            transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        
        .answer-textarea:focus {
            outline: none;
            border-color: #4285f4;
            box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
        }
        
        .question-item.answered {
            border-left: 4px solid #34a853;
            background-color: #f0f8f0;
        }
        
        .search-input.error {
            border-color: #ea4335;
            box-shadow: 0 0 0 2px rgba(234, 67, 53, 0.2);
        }
        
        .intent-score-display {
            animation: slideInRight 0.5s ease-out;
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .status-processing {
            position: relative;
            overflow: hidden;
        }
        
        .status-processing::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            animation: shimmer 1.5s infinite;
        }
        
        @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
        }
    `;
    
    document.head.appendChild(style);
}

// 초기화시 스타일 적용
document.addEventListener('DOMContentLoaded', function() {
    addDynamicStyles();
    
    // 브라우저 호환성 체크
    if (!window.fetch) {
        showStatus('이 브라우저는 지원되지 않습니다. 최신 브라우저를 사용해주세요.', 'error');
    }
    
    // localStorage 지원 체크
    try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
    } catch (e) {
        console.warn('localStorage를 사용할 수 없습니다. 즐겨찾기 기능이 제한됩니다.');
    }
});

console.log('개선된 script.js 로드 완료 - 오류 처리 강화 버전');.style.display = 'none';
        }
    };
    
    // 오류 리포팅 시스템
    window.onerror = function(msg, url, lineNo, columnNo, error) {
        console.error('전역 오류 발생:', { msg, url, lineNo, columnNo, error });
        showStatus('예상치 못한 오류가 발생했습니다. 새로고침 후 다시 시도해주세요.', 'error');
        return false;
    };
};

// 모드 토글 함수 (개선됨)
function toggleMode() {
    isExpertMode = !isExpertMode;
    const toggle = document.getElementById('modeToggle');
    const description = document.getElementById('modeDescription');
    
    if (toggle) {
        if (isExpertMode) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    }
    
    if (description) {
        if (isExpertMode) {
            description.textContent = '전문가급 의도 분석 시스템 (3단계 질문)';
        } else {
            description.textContent = '빠르고 간편한 AI 질문 시스템 (동적 개수)';
        }
    }
    
    console.log('모드 변경:', isExpertMode ? '전문가' : '일반');
}

// 🚀 개선된 서버 API 호출 함수
async function callAPI(step, data) {
    console.log('=== 서버 API 호출 ===');
    console.log('Step:', step);
    console.log('Data:', data);
    
    // 입력값 사전 검증
    if (step === 'questions' && (!data.userInput || data.userInput.trim().length < 2)) {
        throw new Error('사용자 입력이 너무 짧습니다. 최소 2글자 이상 입력해주세요.');
    }
    
    try {
        const requestBody = {
            step: step,
            userInput: data.userInput || originalUserInput,
            answers: Array.isArray(data.answers) ? data.answers : [],
            mode: isExpertMode ? 'expert' : 'normal',
            timestamp: Date.now(), // 디버깅용
            ...data
        };
        
        console.log('요청 데이터:', requestBody);
        
        // 타임아웃 설정
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45초 타임아웃
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('응답 상태:', response.status);
        console.log('응답 헤더:', Object.fromEntries(response.headers));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('서버 오류 응답:', errorText);
            
            // 구체적인 오류 메시지 생성
            let errorMessage = `서버 오류 (${response.status})`;
            
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error) {
                    errorMessage = errorJson.error;
                } else if (errorJson.message) {
                    errorMessage = errorJson.message;
                }
            } catch (parseError) {
                // JSON이 아닌 경우 기본 메시지 사용
                if (response.status === 500) {
                    errorMessage = '서버 내부 오류가 발생했습니다.';
                } else if (response.status === 400) {
                    errorMessage = '잘못된 요청입니다. 입력을 확인해주세요.';
                } else if (response.status === 429) {
                    errorMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
                }
            }
            
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log('서버 응답 성공:', result);
        
        // 응답 데이터 검증
        if (!result) {
            throw new Error('서버에서 빈 응답을 받았습니다.');
        }
        
        return result;
        
    } catch (error) {
        console.error('API 호출 실패:', error);
        
        // 네트워크 오류 타입별 처리
        if (error.name === 'AbortError') {
            throw new Error('요청 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.');
        } else if (error.message.includes('fetch')) {
            throw new Error('서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
        } else {
            throw error;
        }
    }
}

// 개선된 폴백 응답 (서버 연결 실패시)
function getFallbackResponse(step, data) {
    console.log('폴백 응답 생성:', step);
    
    if (step === 'questions') {
        const basicQuestions = [
            "구체적으로 어떤 결과물을 원하시나요?",
            "크기나 해상도 등 기술적 요구사항이 있나요?",
            "누가 사용하거나 볼 예정인가요?",
            "어떤 스타일이나 느낌을 선호하시나요?"
        ];
        
        return {
            questions: basicQuestions,
            mode: 'fallback',
            analysis: {
                intentScore: 40,
                message: '서버 연결 실패로 기본 질문을 제공합니다.'
            }
        };
    } else if (step === 'final-improve') {
        const answers = Array.isArray(data.answers) ? data.answers.join(', ') : '';
        const improvedText = data.userInput || originalUserInput;
        
        return {
            improved_prompt: `${improvedText}${answers ? `\n\n추가 요구사항: ${answers}` : ''}\n\n고품질로 제작해주세요.`,
            score: 65,
            improvements: ['기본 품질 향상', '사용자 답변 반영'],
            mode: 'fallback'
        };
    }
    
    return { error: '처리할 수 없는 요청입니다.' };
}

// 메인 프롬프트 개선 함수 (개선됨)
async function improvePrompt() {
    const searchInput = document.getElementById('searchInput');
    const userInput = searchInput ? searchInput.value.trim() : '';
    
    // 입력값 검증 강화
    if (!userInput) {
        showStatus('개선하고 싶은 프롬프트를 입력해주세요.', 'error');
        if (searchInput) {
            searchInput.focus();
            searchInput.classList.add('error');
        }
        return;
    }
    
    if (userInput.length < 2) {
        showStatus('최소 2글자 이상 입력해주세요.', 'error');
        if (searchInput) searchInput.classList.add('error');
        return;
    }
    
    if (userInput.length > 1000) {
        showStatus('입력이 너무 깁니다. 1000자 이내로 입력해주세요.', 'error');
        return;
    }
    
    if (isProcessing) {
        showStatus('이미 처리 중입니다. 잠시만 기다려주세요.', 'error');
        return;
    }
    
    // 상태 초기화
    clearPreviousResults();
    isProcessing = true;
    originalUserInput = userInput;
    
    try {
        showStatus('AI가 사용자 의도를 분석하고 질문을 생성하고 있습니다...', 'processing');
        
        const result = await callAPI('questions', {
            userInput: userInput,
            isExpertMode: isExpertMode
        });
        
        console.log('질문 생성 결과:', result);
        
        // 의도 분석 결과 저장 및 표시
        if (result.analysis) {
            analysisData = result.analysis;
            
            if (result.analysis.intentScore !== undefined) {
                showIntentScore(result.analysis.intentScore, result.analysis.message);
            }
        }
        
        // 질문 처리 로직
        if (result.skipToImprovement || (result.questions && result.questions.length === 0)) {
            showStatus('충분한 정보로 바로 개선하겠습니다!', 'success');
            await finalImprove();
        } else if (result.questions && Array.isArray(result.questions) && result.questions.length > 0) {
            displayQuestions(result.questions);
            
            const modeText = result.ai_mode ? 'AI 맞춤 질문' : 
                           result.mode === 'fallback' ? '기본 질문' : '질문';
            showStatus(`${modeText}이 생성되었습니다! (${result.questions.length}개)`, 'success');
        } else {
            // 예상치 못한 응답 구조
            console.warn('예상치 못한 응답 구조:', result);
            showStatus('질문 생성에 실패했습니다. 다시 시도해주세요.', 'error');
        }
        
    } catch (error) {
        console.error('improvePrompt 오류:', error);
        
        // 사용자 친화적 오류 메시지
        let errorMessage = error.message;
        if (errorMessage.includes('fetch')) {
            errorMessage = '서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.';
        } else if (errorMessage.includes('timeout')) {
            errorMessage = '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.';
        }
        
        showStatus(errorMessage, 'error');
        
        // 폴백 시스템 작동
        try {
            const fallbackResult = getFallbackResponse('questions', { userInput });
            if (fallbackResult.questions) {
                displayQuestions(fallbackResult.questions);
                showStatus('기본 질문으로 진행합니다.', 'success');
            }
        } catch (fallbackError) {
            console.error('폴백 시스템도 실패:', fallbackError);
        }
        
    } finally {
        isProcessing = false;
    }
}

// 의도 점수 표시 (개선됨)
function showIntentScore(score, message) {
    // 기존 점수 표시 제거
    const existingScore = document.querySelector('.intent-score-display');
    if (existingScore) {
        existingScore.remove();
    }
    
    const statusDiv = document.createElement('div');
    statusDiv.className = 'intent-score-display';
    
    // 점수에 따른 색상 결정
    let scoreColor = '#ea4335'; // 빨간색 (낮음)
    if (score >= 80) scoreColor = '#34a853'; // 초록색 (높음)
    else if (score >= 60) scoreColor = '#fbbc04'; // 노란색 (보통)
    
    statusDiv.innerHTML = `
        <div class="intent-score-box">
            <div class="intent-score-number" style="color: ${scoreColor}">${score}점</div>
            <div class="intent-score-label">의도 파악도</div>
            ${message ? `<div class="intent-score-message">${message}</div>` : ''}
        </div>
    `;
    
    // 스타일 추가
    statusDiv.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
        min-width: 150px;
        text-align: center;
        border-left: 4px solid ${scoreColor};
    `;
    
    document.body.appendChild(statusDiv);
    
    // 5초 후 자동 제거
    setTimeout(() => {
        if (statusDiv && statusDiv.parentNode) {
            statusDiv.remove();
        }
    }, 5000);
}

// 질문 표시 함수 (개선됨)
function displayQuestions(questions) {
    console.log('질문 표시 시작:', questions);
    
    // 입력값 검증 강화
    if (!Array.isArray(questions)) {
        console.error('questions가 배열이 아닙니다:', typeof questions, questions);
        showStatus('질문 데이터 형식이 올바르지 않습니다.', 'error');
        return;
    }
    
    if (questions.length === 0) {
        console.log('질문이 없어서 바로 개선 단계로 진행');
        finalImprove();
        return;
    }
    
    // 유효한 질문만 필터링
    const validQuestions = questions.filter(q => {
        if (typeof q !== 'string') {
            console.warn('문자열이 아닌 질문 제외:', typeof q, q);
            return false;
        }
        if (q.trim().length < 3) {
            console.warn('너무 짧은 질문 제외:', q);
            return false;
        }
        return true;
    }).map(q => q.trim());
    
    if (validQuestions.length === 0) {
        console.error('유효한 질문이 없습니다. 원본:', questions);
        showStatus('유효한 질문을 생성하지 못했습니다. 다시 시도해주세요.', 'error');
        return;
    }
    
    currentQuestions = validQuestions;
    console.log('유효한 질문들:', currentQuestions);
    
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const questionsContainer = document.getElementById('questionsContainer');
    
    if (!questionsContainer || !aiQuestionsDiv) {
        console.error('질문 컨테이너를 찾을 수 없습니다');
        showStatus('페이지 구조 오류가 발생했습니다.', 'error');
        return;
    }
    
    // 질문 HTML 생성 (보안 강화)
    let questionsHTML = '<div class="questions-round">';
    questionsHTML += '<div class="round-title">🎯 AI 맞춤 질문</div>';
    
    validQuestions.forEach((question, index) => {
        const escapedQuestion = escapeHtml(question);
        questionsHTML += `
            <div class="question-item" id="question-${index}">
                <div class="question-text">${escapedQuestion}</div>
                <div class="question-input">
                    <textarea class="answer-textarea" 
                              placeholder="답변을 입력해주세요..." 
                              onchange="saveAnswer(${index}, this.value)"
                              oninput="saveAnswer(${index}, this.value)"
                              id="answer-${index}"
                              rows="2"></textarea>
                </div>
            </div>
        `;
    });
    
    questionsHTML += '</div>';
    
    try {
        questionsContainer.innerHTML = questionsHTML;
        aiQuestionsDiv.style.display = 'block';
        
        // 첫 번째 질문에 포커스
        setTimeout(() => {
            const firstTextarea = document.getElementById('answer-0');
            if (firstTextarea) {
                firstTextarea.focus();
            }
        }, 500);
        
    } catch (error) {
        console.error('HTML 렌더링 실패:', error);
        showStatus('질문 표시 중 오류가 발생했습니다.', 'error');
    }
}

// 답변 저장 (개선됨)
function saveAnswer(questionIndex, answer) {
    if (typeof questionIndex !== 'number' || questionIndex < 0) {
        console.error('잘못된 질문 인덱스:', questionIndex);
        return;
    }
    
    const cleanAnswer = typeof answer === 'string' ? answer.trim() : '';
    console.log(`답변 저장: 질문 ${questionIndex}, 답변: "${cleanAnswer}"`);
    
    // 답변 저장
    currentAnswers[questionIndex] = cleanAnswer;
    
    // UI 업데이트 (선택적)
    const questionItem = document.getElementById(`question-${questionIndex}`);
    if (questionItem) {
        if (cleanAnswer.length > 0) {
            questionItem.classList.add('answered');
        } else {
            questionItem.classList.remove('answered');
        }
    }
}

// 답변 완료 후 진행 (개선됨)
async function proceedWithAnswers() {
    if (isProcessing) {
        showStatus('이미 처리 중입니다.', 'error');
        return;
    }
    
    console.log('답변 진행 시작:', currentAnswers);
    
    // 답변 검증
    const validAnswers = Object.values(currentAnswers).filter(answer => 
        answer && typeof answer === 'string' && answer.trim().length > 0
    );
    
    if (validAnswers.length === 0) {
        showStatus('최소 하나 이상의 질문에 답변해주세요.', 'error');
        
        // 첫 번째 빈 질문에 포커스
        for (let i = 0; i < currentQuestions.length; i++) {
            if (!currentAnswers[i] || currentAnswers[i].trim().length === 0) {
                const textarea = document.getElementById(`answer-${i}`);
                if (textarea) {
                    textarea.focus();
                    textarea.style.borderColor = '#ea4335';
                    setTimeout(() => {
                        if (textarea) textarea.style.borderColor = '';
                    }, 3000);
                }
                break;
            }
        }
        return;
    }
    
    isProcessing = true;
    
    try {
        showStatus(`${validAnswers.length}개 답변을 바탕으로 프롬프트를 개선하고 있습니다...`, 'processing');
        await finalImprove();
    } catch (error) {
        console.error('proceedWithAnswers 오류:', error);
        showStatus('답변 처리 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 최종 프롬프트 개선 (개선됨)
async function finalImprove() {
    try {
        console.log('최종 개선 시작:', {
            originalUserInput,
            currentAnswers,
            analysisData
        });
        
        // 답변을 구조화된 형태로 변환
        const answersArray = [];
        Object.entries(currentAnswers).forEach(([index, answer]) => {
            if (answer && answer.trim().length > 0) {
                const questionIndex = parseInt(index);
                const question = currentQuestions[questionIndex] || `질문 ${questionIndex + 1}`;
                answersArray.push(`Q: ${question}\nA: ${answer.trim()}`);
            }
        });
        
        console.log('구조화된 답변:', answersArray);
        
        const result = await callAPI('final-improve', {
            userInput: originalUserInput,
            answers: answersArray,
            analysis: analysisData
        });
        
        console.log('최종 개선 결과:', result);
        
        // 결과 처리
        let improvedPrompt;
        let score = 0;
        
        if (typeof result === 'string') {
            improvedPrompt = result;
        } else if (result && result.improved_prompt) {
            improvedPrompt = result.improved_prompt;
            score = result.score || 0;
        } else {
            throw new Error('서버에서 올바른 개선 결과를 받지 못했습니다.');
        }
        
        // 결과 표시
        displayResult(originalUserInput, improvedPrompt);
        
        // 점수 표시
        if (score > 0) {
            showScoreImprovement(score);
        }
        
        showStatus('프롬프트 개선이 완료되었습니다!', 'success');
        
        // 성공 로그
        console.log('개선 완료:', {
            original: originalUserInput,
            improved: improvedPrompt,
            score: score,
            answersCount: answersArray.length
        });
        
    } catch (error) {
        console.error('finalImprove 오류:', error);
        
        // 폴백 개선 시도
        try {
            const fallbackResult = getFallbackResponse('final-improve', {
                userInput: originalUserInput,
                answers: Object.values(currentAnswers).filter(a => a && a.trim())
            });
            
            if (fallbackResult && fallbackResult.improved_prompt) {
                displayResult(originalUserInput, fallbackResult.improved_prompt);
                showStatus('기본 개선 시스템으로 처리되었습니다.', 'success');
            } else {
                throw new Error('폴백 개선도 실패했습니다.');
            }
        } catch (fallbackError) {
            console.error('폴백 개선 실패:', fallbackError);
            showStatus('프롬프트 개선 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    }
}

// 나머지 함수들은 기존과 동일하지만 오류 처리 강화...
// (질문 건너뛰기, 결과 표시, 클립보드 복사 등)

// 질문 건너뛰기 (개선됨)
async function skipQuestions() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus('질문을 건너뛰고 바로 개선하고 있습니다...', 'processing');
        currentAnswers = {}; // 빈 답변으로 초기화
        await finalImprove();
    } catch (error) {
        console.error('skipQuestions 오류:', error);
        showStatus('질문 건너뛰기 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 결과 표시 (기존 유지)
function displayResult(original, improved) {
    const aiQuestions = document.getElementById('aiQuestions');
    const originalText = document.getElementById('originalText');
    const improvedText = document.getElementById('improvedText');
    const improvedResult = document.getElementById('improvedResult');
    
    if (aiQuestions) aiQuestions.style.display = 'none';
    
    if (originalText) originalText.textContent = original;
    if (improvedText) improvedText.textContent = improved;
    if (improvedResult) improvedResult.style.display = 'block';
    
    // 의도 점수 표시 숨기기
    const intentScore = document.querySelector('.intent-score-display');
    if (intentScore) {
        intentScore.remove();
    }
    
    // 결과 영역으로 스크롤
    if (improvedResult) {
        improvedResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// 점수 개선 섹션 표시
function showScoreImprovement(score) {
    const scoreSection = document.getElementById('scoreImprovement');
    const scoreDisplay = document.getElementById('currentScore');
    
    if (scoreDisplay) scoreDisplay.textContent = score;
    if (scoreSection) scoreSection.style.display = 'block';
    
    currentScore = score;
}

// 클립보드 복사 (오류 처리 강화)
async function copyToClipboard() {
    const improvedText = document.getElementById('improvedText');
    if (!improvedText) {
        showStatus('복사할 텍스트를 찾을 수 없습니다.', 'error');
        return;
    }
    
    const textToCopy = improvedText.textContent;
    if (!textToCopy || textToCopy.trim().length === 0) {
        showStatus('복사할 내용이 없습니다.', 'error');
        return;
    }
    
    try {
        // 최신 브라우저의 Clipboard API 사용
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(textToCopy);
            showStatus('개선된 프롬프트가 클립보드에 복사되었습니다!', 'success');
        } else {
            // 폴백: 구식 방법
            const textArea = document.createElement('textarea');
            textArea.value = textToCopy;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                showStatus('개선된 프롬프트가 복사되었습니다!', 'success');
            } else {
                throw new Error('복사 실패');
            }
        }
    } catch (err) {
        console.error('클립보드 복사 실패:', err);
        showStatus('클립보드 복사에 실패했습니다. 수동으로 복사해주세요.', 'error');
        
        // 텍스트 선택으로 사용자가 수동 복사할 수 있게 도움
        if (improvedText) {
            const range = document.createRange();
            range.selectNodeContents(improvedText);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

// 즐겨찾기 저장 (오류 처리 강화)
function saveToFavorites() {
    const originalText = document.getElementById('originalText');
    const improvedText = document.getElementById('improvedText');
    
    if (!originalText || !improvedText) {
        showStatus('저장할 데이터를 찾을 수 없습니다.', 'error');
        return;
    }
    
    const original = originalText.textContent;
    const improved = improvedText.textContent;
    
    if (!original || !improved) {
        showStatus('저장할 내용이 없습니다.', 'error');
        return;
    }
    
    try {
        let favorites = [];
        try {
            const stored = localStorage.getItem('prompt_favorites');
            favorites = stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.warn('기존 즐겨찾기 데이터 로드 실패:', e);
            favorites = [];
        }
        
        const newFavorite = {
            id: Date.now(),
            original: original,
            improved: improved,
            mode: isExpertMode ? '전문가' : '일반',
            score: currentScore,
            date: new Date().toLocaleDateString('ko-KR'),
            timestamp: Date.now()
        };
        
        favorites.unshift(newFavorite);
        
        // 최대 50개로 제한
        if (favorites.length > 50) {
            favorites = favorites.slice(0, 50);
        }
        
        localStorage.setItem('prompt_favorites', JSON.stringify(favorites));
        showStatus('즐겨찾기에 저장되었습니다!', 'success');
        
    } catch (e) {
        console.error('즐겨찾기 저장 실패:', e);
        if (e.name === 'QuotaExceededError') {
            showStatus('저장 공간이 부족합니다. 기존 즐겨찾기를 정리해주세요.', 'error');
        } else {
            showStatus('즐겨찾기 저장에 실패했습니다.', 'error');
        }
    }
}

// 초기화 (개선됨)
function clearResults() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.classList.remove('error');
    }
    
    clearPreviousResults();
    originalUserInput = '';
    isProcessing = false;
    currentScore = 0;
    analysisData = null;
    
    showStatus('초기화가 완료되었습니다.', 'success');
    
    // 입력창에 포커스
    if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
    }
}

// 이전 결과 완전 초기화
function clearPreviousResults() {
    const elements = [
        'aiQuestions',
        'improvedResult', 
        'scoreImprovement'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
    
    const questionsContainer = document.getElementById('questionsContainer');
    if (questionsContainer) questionsContainer.innerHTML = '';
    
    const intentScore = document.querySelector('.intent-score-display');
    if (intentScore) intentScore.remove();
    
    currentQuestions = [];
    currentAnswers = {};
    analysisData = null;
}

// HTML 이스케이프 (보안 강화)
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 상태 메시지 표시 (개선됨)
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;
    
    if (!message) {
        statusDiv.style.display = 'none';
        return;
    }
    
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    
    // 기존 클래스 제거
    statusDiv.className = 'status-message';
    
    // 타입별 클래스 추가
    switch(type) {
        case 'success':
            statusDiv.classList.add('status-success');
            break;
        case 'error':
            statusDiv.classList.add('status-error');
            break;
        case 'processing':
            statusDiv.classList.add('status-processing');
            break;
        default:
            statusDiv.classList.add('status-info');
            break;
    }
    
    // 자동 숨기기 (처리 중이 아닌 경우만)
    if (type !== 'processing') {
        setTimeout(() => {
            if (statusDiv) statusDiv.style.display = 'none';
        }, type === 'error' ? 6000 : 4000);
    }
    
    console.log(`상태 메시지 [${type}]:`, message);
}

// 가이드 모달 함수들 (기존 유지)
function showDetailedGuide() {
    const modal = document.getElementById('guideModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalBody) return;
    
    modal
