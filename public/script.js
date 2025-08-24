// script.js - 완전히 새로운 프론트엔드 (문법 오류 없는 깔끔한 버전)

console.log('새로운 script.js 로드 완료!');

// =============================================================================
// 📱 전역 변수들
// =============================================================================
let isExpertMode = false;
let currentQuestions = [];
let currentAnswers = {};
let originalUserInput = '';
let isProcessing = false;
let currentScore = 0;
let analysisData = null;
let promptHistory = [];

// =============================================================================
// 🚀 페이지 초기화
// =============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('페이지 로드 완료!');
    
    // 동적 스타일 추가
    addDynamicStyles();
    
    // 입력창 이벤트 설정
    setupInputEvents();
    
    // 모달 이벤트 설정
    setupModalEvents();
    
    console.log('초기화 완료!');
});

// =============================================================================
// 🎯 핵심 기능들 (버튼 동작)
// =============================================================================

// 프롬프트 개선 메인 함수
function improvePrompt() {
    console.log('improvePrompt 실행!');
    
    const searchInput = document.getElementById('searchInput');
    const userInput = searchInput ? searchInput.value.trim() : '';
    
    // 입력값 검증
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
    
    // 서버에 요청
    callAPI('questions', { userInput: userInput })
        .then(result => {
            console.log('서버 응답:', result);
            
            if (result.questions && result.questions.length > 0) {
                displayQuestions(result.questions);
                showStatus(`질문이 생성되었습니다! (${result.questions.length}개)`, 'success');
            } else {
                // 질문 없으면 바로 개선
                finalImprove();
            }
        })
        .catch(error => {
            console.error('오류:', error);
            showStatus('처리 중 오류가 발생했습니다: ' + error.message, 'error');
            
            // 폴백: 기본 질문 제공
            const fallbackQuestions = [
                "구체적으로 어떤 결과물을 원하시나요?",
                "크기나 해상도 등 기술적 요구사항이 있나요?",
                "누가 사용하거나 볼 예정인가요?",
                "어떤 스타일이나 느낌을 선호하시나요?"
            ];
            displayQuestions(fallbackQuestions);
            showStatus('기본 질문으로 진행합니다.', 'success');
        })
        .finally(() => {
            isProcessing = false;
        });
}

// 모드 토글 함수
function toggleMode() {
    console.log('toggleMode 실행!');
    
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
    showStatus(`${isExpertMode ? '전문가' : '일반'}모드로 변경되었습니다.`, 'success');
}

// 결과 초기화 함수
function clearResults() {
    console.log('clearResults 실행!');
    
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
    
    if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
    }
}

// 가이드 모달 표시
function showDetailedGuide() {
    console.log('showDetailedGuide 실행!');
    
    const modal = document.getElementById('guideModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalBody) {
        showStatus('가이드 모달을 찾을 수 없습니다.', 'error');
        return;
    }
    
    modalTitle.textContent = 'AI 프롬프트 개선기 사용법 - ' + (isExpertMode ? '전문가모드' : '일반모드');
    
    const guideContent = isExpertMode ? getExpertModeGuide() : getNormalModeGuide();
    modalBody.innerHTML = guideContent;
    
    modal.style.display = 'block';
    
    const closeButton = modal.querySelector('.modal-close');
    if (closeButton) closeButton.focus();
}

// 가이드 모달 닫기
function closeDetailedGuide() {
    console.log('closeDetailedGuide 실행!');
    
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// =============================================================================
// 🌐 서버 API 통신
// =============================================================================

async function callAPI(step, data) {
    console.log('API 호출:', step, data);
    
    const requestBody = {
        step: step,
        userInput: data.userInput || originalUserInput,
        answers: data.answers || [],
        mode: isExpertMode ? 'expert' : 'normal',
        timestamp: Date.now()
    };
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`서버 오류 (${response.status})`);
        }
        
        const result = await response.json();
        console.log('API 응답 성공:', result);
        return result;
        
    } catch (error) {
        console.error('API 호출 실패:', error);
        
        if (error.name === 'AbortError') {
            throw new Error('요청 시간이 초과되었습니다.');
        } else {
            throw error;
        }
    }
}

// =============================================================================
// 📝 질문 시스템
// =============================================================================

function displayQuestions(questions) {
    console.log('질문 표시:', questions);
    
    if (!Array.isArray(questions) || questions.length === 0) {
        console.error('유효하지 않은 질문 데이터');
        finalImprove();
        return;
    }
    
    const validQuestions = questions.filter(q => 
        typeof q === 'string' && q.trim().length > 3
    );
    
    if (validQuestions.length === 0) {
        console.error('유효한 질문이 없음');
        finalImprove();
        return;
    }
    
    currentQuestions = validQuestions;
    
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const questionsContainer = document.getElementById('questionsContainer');
    
    if (!questionsContainer || !aiQuestionsDiv) {
        console.error('질문 컨테이너를 찾을 수 없습니다');
        return;
    }
    
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
                              oninput="saveAnswer(${index}, this.value)"
                              id="answer-${index}" 
                              rows="3"></textarea>
                </div>
            </div>
        `;
    });
    
    questionsHTML += `
        <div class="question-actions">
            <button onclick="proceedWithAnswers()" class="proceed-button">
                ✨ 답변 완료 - 프롬프트 개선하기
            </button>
            <button onclick="skipQuestions()" class="skip-button">
                ⏭️ 질문 건너뛰기
            </button>
        </div>
    `;
    questionsHTML += '</div>';
    
    questionsContainer.innerHTML = questionsHTML;
    aiQuestionsDiv.style.display = 'block';
    
    // 첫 번째 입력에 포커스
    setTimeout(() => {
        const firstTextarea = document.getElementById('answer-0');
        if (firstTextarea) firstTextarea.focus();
    }, 500);
}

function saveAnswer(questionIndex, answer) {
    if (typeof questionIndex !== 'number' || questionIndex < 0) {
        console.error('잘못된 질문 인덱스:', questionIndex);
        return;
    }
    
    const cleanAnswer = typeof answer === 'string' ? answer.trim() : '';
    console.log(`답변 저장: 질문 ${questionIndex}, 답변: "${cleanAnswer}"`);
    
    currentAnswers[questionIndex] = cleanAnswer;
    
    // UI 업데이트
    const questionItem = document.getElementById(`question-${questionIndex}`);
    if (questionItem) {
        if (cleanAnswer.length > 0) {
            questionItem.classList.add('answered');
        } else {
            questionItem.classList.remove('answered');
        }
    }
}

async function proceedWithAnswers() {
    console.log('답변으로 진행:', currentAnswers);
    
    const validAnswers = Object.values(currentAnswers).filter(answer => 
        answer && typeof answer === 'string' && answer.trim().length > 0
    );
    
    if (validAnswers.length === 0) {
        showStatus('최소 하나 이상의 질문에 답변해주세요.', 'error');
        return;
    }
    
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus(`${validAnswers.length}개 답변을 바탕으로 프롬프트를 개선하고 있습니다...`, 'processing');
        await finalImprove();
    } catch (error) {
        console.error('답변 처리 오류:', error);
        showStatus('답변 처리 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

async function skipQuestions() {
    console.log('질문 건너뛰기');
    
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus('질문을 건너뛰고 바로 개선하고 있습니다...', 'processing');
        currentAnswers = {};
        await finalImprove();
    } catch (error) {
        console.error('질문 건너뛰기 오류:', error);
        showStatus('처리 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// =============================================================================
// 🎯 최종 프롬프트 개선
// =============================================================================

async function finalImprove() {
    console.log('최종 프롬프트 개선 시작');
    
    try {
        // 답변을 배열로 변환
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
        let improvements = [];
        
        if (typeof result === 'string') {
            improvedPrompt = result;
            score = calculateFallbackScore(result, originalUserInput);
        } else if (result && result.improved_prompt) {
            improvedPrompt = result.improved_prompt;
            score = result.score || 0;
            improvements = result.improvements || [];
            
            if (score === 0) {
                score = calculateFallbackScore(improvedPrompt, originalUserInput);
            }
        } else {
            throw new Error('서버에서 올바른 개선 결과를 받지 못했습니다.');
        }
        
        // 결과 표시
        displayResult(originalUserInput, improvedPrompt);
        
        if (score > 0) {
            showScoreImprovement(score, improvements);
        }
        
        // 히스토리에 저장
        addToHistory(originalUserInput, improvedPrompt, score);
        
        showStatus('프롬프트 개선이 완료되었습니다!', 'success');
        
    } catch (error) {
        console.error('최종 개선 오류:', error);
        
        // 폴백 개선
        try {
            const fallbackPrompt = originalUserInput + '\n\n고품질로 제작해주세요.';
            const fallbackScore = calculateFallbackScore(fallbackPrompt, originalUserInput);
            
            displayResult(originalUserInput, fallbackPrompt);
            showScoreImprovement(fallbackScore, ['기본 품질 향상']);
            showStatus('기본 개선 시스템으로 처리되었습니다.', 'success');
        } catch (fallbackError) {
            console.error('폴백 개선 실패:', fallbackError);
            showStatus('프롬프트 개선 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    }
}

// =============================================================================
// 📊 결과 표시 시스템
// =============================================================================

function displayResult(original, improved) {
    console.log('결과 표시:', { original, improved });
    
    const aiQuestions = document.getElementById('aiQuestions');
    const originalText = document.getElementById('originalText');
    const improvedText = document.getElementById('improvedText');
    const improvedResult = document.getElementById('improvedResult');
    
    if (aiQuestions) aiQuestions.style.display = 'none';
    
    if (originalText) originalText.textContent = original;
    if (improvedText) improvedText.textContent = improved;
    if (improvedResult) {
        improvedResult.style.display = 'block';
        // 결과 영역으로 스크롤
        improvedResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function showScoreImprovement(score, improvements = []) {
    console.log('점수 표시:', score, improvements);
    
    const scoreSection = document.getElementById('scoreImprovement');
    const scoreDisplay = document.getElementById('currentScore');
    const scoreBadge = document.getElementById('scoreBadge');
    
    if (scoreDisplay) {
        animateScoreCounter(scoreDisplay, score);
    }
    
    if (scoreBadge) {
        scoreBadge.style.display = 'block';
        scoreBadge.textContent = `${score}점`;
        
        // 점수에 따른 색상 변경
        if (score >= 90) {
            scoreBadge.style.backgroundColor = '#34a853';
        } else if (score >= 75) {
            scoreBadge.style.backgroundColor = '#fbbc04';
        } else {
            scoreBadge.style.backgroundColor = '#ea4335';
        }
    }
    
    if (scoreSection) {
        scoreSection.style.display = 'block';
        
        // 개선사항 표시
        const improvementsList = scoreSection.querySelector('.improvements-list');
        if (improvementsList && improvements.length > 0) {
            improvementsList.innerHTML = improvements
                .map(imp => `<li>${escapeHtml(imp)}</li>`)
                .join('');
        }
    }
    
    currentScore = score;
}

// =============================================================================
// 🛠️ 유틸리티 함수들
// =============================================================================

function calculateFallbackScore(improvedPrompt, originalPrompt) {
    let score = 30; // 기본 점수
    
    // 길이 개선도
    const lengthRatio = improvedPrompt.length / originalPrompt.length;
    if (lengthRatio > 1.2 && lengthRatio < 3) {
        score += Math.min(20, (lengthRatio - 1) * 15);
    }
    
    // 구체성 점수
    const numbers = (improvedPrompt.match(/\d+/g) || []).length;
    const units = (improvedPrompt.match(/(px|cm|초|분|k|hd|4k)/gi) || []).length;
    score += Math.min(25, (numbers * 3) + (units * 4));
    
    // 답변 반영 보너스
    const answerCount = Object.keys(currentAnswers).length;
    score += Math.min(10, answerCount * 2);
    
    return Math.min(95, Math.round(score));
}

function animateScoreCounter(element, targetScore) {
    if (!element) return;
    
    let currentScore = 0;
    const increment = targetScore / 30;
    
    const animation = setInterval(() => {
        currentScore += increment;
        if (currentScore >= targetScore) {
            currentScore = targetScore;
            clearInterval(animation);
        }
        element.textContent = Math.round(currentScore);
    }, 33);
}

function addToHistory(original, improved, score) {
    const historyItem = {
        id: Date.now(),
        original: original,
        improved: improved,
        score: score,
        mode: isExpertMode ? '전문가' : '일반',
        date: new Date().toLocaleDateString('ko-KR'),
        timestamp: Date.now()
    };
    
    promptHistory.unshift(historyItem);
    
    // 최대 50개로 제한
    if (promptHistory.length > 50) {
        promptHistory = promptHistory.slice(0, 50);
    }
    
    // localStorage에 저장
    try {
        localStorage.setItem('prompt_history', JSON.stringify(promptHistory));
    } catch (e) {
        console.warn('히스토리 저장 실패:', e);
    }
}

// 클립보드 복사
async function copyToClipboard() {
    console.log('클립보드 복사');
    
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
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(textToCopy);
            showStatus('개선된 프롬프트가 클립보드에 복사되었습니다!', 'success');
        } else {
            // 폴백 방법
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
        showStatus('클립보드 복사에 실패했습니다.', 'error');
    }
}

// =============================================================================
// 🎨 UI 헬퍼 함수들
// =============================================================================

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
    
    currentQuestions = [];
    currentAnswers = {};
    analysisData = null;
}

function showStatus(message, type = 'info') {
    console.log(`상태 [${type}]:`, message);
    
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
}

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupInputEvents() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // Enter 키 처리
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                improvePrompt();
            }
        });
        
        // 입력시 오류 상태 제거
        searchInput.addEventListener('input', function(e) {
            const value = e.target.value.trim();
            if (value.length > 0) {
                searchInput.classList.remove('error');
            }
        });
    }
}

function setupModalEvents() {
    // 모달 클릭 이벤트
    window.onclick = function(event) {
        const modal = document.getElementById('guideModal');
        if (modal && event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

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
        
        .question-actions {
            margin-top: 20px;
            display: flex;
            gap: 10px;
            justify-content: center;
        }
        
        .proceed-button, .skip-button {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        .proceed-button {
            background: #4285f4;
            color: white;
        }
        
        .proceed-button:hover {
            background: #3367d6;
            transform: translateY(-1px);
        }
        
        .skip-button {
            background: #f8f9fa;
            color: #5f6368;
            border: 1px solid #dadce0;
        }
        
        .skip-button:hover {
            background: #e8f0fe;
            border-color: #4285f4;
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

// =============================================================================
// 📚 가이드 컨텐츠
// =============================================================================

function getNormalModeGuide() {
    return `
        <div class="guide-section">
            <h3>🚀 일반모드 특징</h3>
            <ul>
                <li>AI가 사용자 의도를 분석해서 맞춤 질문 생성</li>
                <li>빠르고 효율적인 프롬프트 개선</li>
                <li>일반적인 사용자에게 최적화</li>
            </ul>
        </div>
        
        <div class="guide-section">
            <h3>📝 사용 팁</h3>
            <ul>
                <li><strong>구체적으로 작성:</strong> "그림 그려줘" → "귀여운 강아지 캐릭터 일러스트"</li>
                <li><strong>목적 명시:</strong> "SNS 프로필용", "발표 자료용" 등</li>
                <li><strong>제약사항 포함:</strong> "A4 사이즈", "30초 이내" 등</li>
                <li><strong>대상 설정:</strong> "초등학생용", "전문가용" 등</li>
            </ul>
        </div>
        
        <div class="guide-section">
            <h3>💡 입력 예시</h3>
            <div class="example-box">
                <strong>좋은 예:</strong><br>
                "유튜브 썸네일용 밝고 귀여운 고양이 일러스트, 1920x1080 해상도"
            </div>
            <div class="example-box">
                <strong>나쁜 예:</strong><br>
                "예쁜 그림 만들어줘"
            </div>
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

// =============================================================================
// 🔧 전역 오류 처리
// =============================================================================

window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('전역 오류:', { msg, url, lineNo, columnNo, error });
    showStatus('예상치 못한 오류가 발생했습니다.', 'error');
    return false;
};

window.addEventListener('unhandledrejection', function(event) {
    console.error('Promise 거부:', event.reason);
    showStatus('비동기 작업 중 오류가 발생했습니다.', 'error');
    event.preventDefault();
});

// =============================================================================
// ✅ 스크립트 로드 완료 확인
// =============================================================================

console.log('🎉 완전히 새로운 script.js 로드 완료!');
console.log('📋 사용 가능한 함수들:', {
    improvePrompt: typeof improvePrompt,
    toggleMode: typeof toggleMode,
    clearResults: typeof clearResults,
    showDetailedGuide: typeof showDetailedGuide,
    closeDetailedGuide: typeof closeDetailedGuide,
    copyToClipboard: typeof copyToClipboard
});

// 디버깅용 전역 함수
window.debugInfo = function() {
    console.log('=== 디버그 정보 ===');
    console.log('전문가 모드:', isExpertMode);
    console.log('현재 질문들:', currentQuestions);
    console.log('현재 답변들:', currentAnswers);
    console.log('원본 입력:', originalUserInput);
    console.log('처리 중:', isProcessing);
    console.log('현재 점수:', currentScore);
    console.log('히스토리 개수:', promptHistory.length);
};

// script.js 맨 끝에 추가
function requestAdditionalQuestions() {
    console.log('추가 질문 요청됨');
    
    if (isProcessing) {
        showStatus('이미 처리 중입니다.', 'error');
        return;
    }
    
    isProcessing = true;
    
    // 현재 답변들을 서버로 전송해서 추가 질문 요청
    callAPI('additional-questions', {
        userInput: originalUserInput,
        answers: formatAnswersForAPI(currentAnswers)
    })
    .then(result => {
        if (result.questions && result.questions.length > 0) {
            // 기존 질문에 새 질문 추가
            currentQuestions = [...currentQuestions, ...result.questions];
            displayQuestions(currentQuestions);
            showStatus(`추가 질문 ${result.questions.length}개가 생성되었습니다!`, 'success');
        } else {
            showStatus('더 이상 필요한 질문이 없습니다.', 'info');
        }
    })
    .catch(error => {
        console.error('추가 질문 요청 실패:', error);
        showStatus('추가 질문 요청에 실패했습니다.', 'error');
    })
    .finally(() => {
        isProcessing = false;
    });
}


// script.js 맨 끝에 추가
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
