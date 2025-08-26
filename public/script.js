// public/script.js - 95점 달성 대화형 시스템 (오류 방지 완전판)

console.log('🚀 AI 프롬프트 개선기 v2.0 로드 시작');

// =============================================================================
// 전역 변수
// =============================================================================
let isProcessing = false;
let currentStep = 0;
let originalInput = '';
let allAnswers = [];
let currentDomain = '';
let intentScore = 0;
let qualityScore = 0;
let conversationHistory = [];

// =============================================================================
// 페이지 로드 완료 시 초기화
// =============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 페이지 로드 완료');
    initializeApp();
});

function initializeApp() {
    try {
        // DOM 요소 확인
        const requiredElements = ['userPrompt', 'startBtn'];
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.error('❌ 필수 DOM 요소 누락:', missingElements);
            showStatus('페이지 로딩 오류가 발생했습니다.', 'error');
            return;
        }

        // 이벤트 리스너 등록
        setupEventListeners();
        
        // 초기 상태 설정
        resetConversation();
        
        console.log('✅ 앱 초기화 완료');
        
    } catch (error) {
        console.error('❌ 초기화 오류:', error);
        showStatus('초기화 중 오류가 발생했습니다.', 'error');
    }
}

// =============================================================================
// 이벤트 리스너 설정
// =============================================================================
function setupEventListeners() {
    try {
        // 시작 버튼
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            startBtn.addEventListener('click', startImprovement);
        }

        // 입력창 엔터 키
        const promptInput = document.getElementById('userPrompt');
        if (promptInput) {
            promptInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    startImprovement();
                }
            });
        }

        console.log('✅ 이벤트 리스너 설정 완료');
        
    } catch (error) {
        console.error('❌ 이벤트 리스너 설정 오류:', error);
    }
}

// =============================================================================
// 1. 개선 프로세스 시작
// =============================================================================
async function startImprovement() {
    try {
        console.log('🎯 프롬프트 개선 시작');

        // 중복 실행 방지
        if (isProcessing) {
            showStatus('이미 처리 중입니다. 잠시만 기다려주세요.', 'info');
            return;
        }

        // 입력값 검증
        const userInput = getUserInput();
        if (!userInput) {
            showStatus('개선하고 싶은 프롬프트를 입력해주세요.', 'error');
            return;
        }

        if (userInput.length < 2) {
            showStatus('최소 2글자 이상 입력해주세요.', 'error');
            return;
        }

        // 상태 초기화
        resetConversation();
        originalInput = userInput;
        isProcessing = true;
        
        // UI 업데이트
        showLoading(true);
        showConversationArea(true);
        updateStartButton(true);

        // API 호출 - 시작
        const result = await safeApiCall('/api/improve-prompt', {
            action: 'start',
            userInput: userInput
        });

        if (result && result.success) {
            // 성공적으로 시작
            currentDomain = result.domain;
            showQuestions(result.questions, result.message);
            updateScores(result.intentScore, result.qualityScore);
            
            addConversationMessage('user', userInput);
            addConversationMessage('ai', result.message);
            
        } else {
            throw new Error(result?.error || '서버 응답 오류');
        }

    } catch (error) {
        console.error('❌ 시작 오류:', error);
        showStatus('프로세스 시작 중 오류가 발생했습니다: ' + error.message, 'error');
        handleProcessingError();
    } finally {
        showLoading(false);
        isProcessing = false;
    }
}

// =============================================================================
// 2. 질문 답변 처리
// =============================================================================
async function handleAnswer(questionIndex, selectedAnswer, customAnswer = '') {
    try {
        console.log(`💬 답변 처리: Q${questionIndex}, A=${selectedAnswer}`);

        if (isProcessing) {
            return;
        }

        isProcessing = true;
        showLoading(true);

        // 답변 저장
        const finalAnswer = customAnswer || selectedAnswer;
        const answerData = {
            questionIndex: questionIndex,
            answer: finalAnswer,
            timestamp: Date.now()
        };
        
        allAnswers.push(answerData);
        currentStep++;

        // 대화에 답변 추가
        addConversationMessage('user', finalAnswer);

        // API 호출 - 답변 처리
        const result = await safeApiCall('/api/improve-prompt', {
            action: 'answer',
            userInput: originalInput,
            answers: allAnswers,
            currentStep: currentStep
        });

        if (result && result.success) {
            // 점수 업데이트
            updateScores(result.intentScore, result.qualityScore);
            
            // AI 응답 표시
            addConversationMessage('ai', result.message);

            if (result.needsMore && result.questions && result.questions.length > 0) {
                // 더 많은 질문 필요
                showQuestions(result.questions, result.message);
            } else {
                // 완료 단계로 이동
                await completeImprovement();
            }
        } else {
            throw new Error(result?.error || '답변 처리 오류');
        }

    } catch (error) {
        console.error('❌ 답변 처리 오류:', error);
        showStatus('답변 처리 중 오류가 발생했습니다: ' + error.message, 'error');
        // 오류 발생 시 완료로 진행 (Fallback)
        await completeImprovement();
    } finally {
        showLoading(false);
        isProcessing = false;
    }
}

// =============================================================================
// 3. 완료 처리
// =============================================================================
async function completeImprovement() {
    try {
        console.log('🎉 완료 처리 시작');

        showLoading(true);
        addConversationMessage('ai', '🤖 완벽한 프롬프트를 생성하고 있습니다...');

        // API 호출 - 완료
        const result = await safeApiCall('/api/improve-prompt', {
            action: 'complete',
            userInput: originalInput,
            answers: allAnswers
        });

        if (result && result.success) {
            // 최종 점수 업데이트
            updateScores(result.intentScore, result.qualityScore);
            
            // 결과 표시
            showFinalResult(result.originalPrompt, result.improvedPrompt);
            
            // 성공 메시지
            addConversationMessage('ai', result.message);
            showStatus('🎉 프롬프트 개선이 완료되었습니다!', 'success');
            
        } else {
            throw new Error(result?.error || '완료 처리 오류');
        }

    } catch (error) {
        console.error('❌ 완료 처리 오류:', error);
        
        // Fallback 결과 표시
        const fallbackPrompt = originalInput + ', high quality, detailed, professional';
        showFinalResult(originalInput, fallbackPrompt);
        showStatus('기본 개선이 완료되었습니다.', 'info');
        
    } finally {
        showLoading(false);
    }
}

// =============================================================================
// API 통신 함수 (안전한 호출)
// =============================================================================
async function safeApiCall(url, data) {
    try {
        console.log(`🌐 API 호출: ${url}`, data);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 timeout

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ API 응답 성공:', result);
        return result;

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('❌ API 호출 타임아웃:', url);
            throw new Error('서버 응답 시간이 초과되었습니다.');
        }
        
        console.error('❌ API 호출 실패:', error);
        throw error;
    }
}

// =============================================================================
// UI 업데이트 함수들
// =============================================================================
function showQuestions(questions, message) {
    try {
        const questionsArea = document.getElementById('questionsArea');
        if (!questionsArea) {
            console.error('questionsArea 요소를 찾을 수 없습니다');
            return;
        }

        // 기존 질문 제거
        questionsArea.innerHTML = '';

        // 메시지 표시
        if (message) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'ai-message';
            messageDiv.textContent = message;
            questionsArea.appendChild(messageDiv);
        }

        // 질문들 표시
        questions.forEach((questionObj, qIndex) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'question-container';
            
            const questionText = document.createElement('h3');
            questionText.className = 'question-text';
            questionText.textContent = questionObj.question;
            questionDiv.appendChild(questionText);

            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'options-container';

            // 선택지들
            questionObj.options.forEach((option, optIndex) => {
                const optionBtn = document.createElement('button');
                optionBtn.className = 'option-btn';
                optionBtn.textContent = option;
                optionBtn.onclick = () => selectOption(qIndex, optIndex, option);
                optionsDiv.appendChild(optionBtn);
            });

            // 기타 선택 시 커스텀 입력
            const customDiv = document.createElement('div');
            customDiv.className = 'custom-input-container';
            customDiv.style.display = 'none';
            customDiv.id = `custom-${qIndex}`;
            
            const customInput = document.createElement('input');
            customInput.type = 'text';
            customInput.className = 'custom-input';
            customInput.placeholder = '직접 입력해주세요...';
            
            const customBtn = document.createElement('button');
            customBtn.className = 'custom-submit-btn';
            customBtn.textContent = '제출';
            customBtn.onclick = () => submitCustomAnswer(qIndex, customInput.value);
            
            customDiv.appendChild(customInput);
            customDiv.appendChild(customBtn);

            questionDiv.appendChild(optionsDiv);
            questionDiv.appendChild(customDiv);
            questionsArea.appendChild(questionDiv);
        });

        // 질문 영역 표시
        questionsArea.style.display = 'block';
        
    } catch (error) {
        console.error('❌ 질문 표시 오류:', error);
    }
}

function selectOption(questionIndex, optionIndex, optionText) {
    try {
        console.log(`선택: Q${questionIndex}, Option${optionIndex}: ${optionText}`);

        // 선택된 버튼 하이라이트
        const questionContainer = document.querySelectorAll('.question-container')[questionIndex];
        if (questionContainer) {
            const buttons = questionContainer.querySelectorAll('.option-btn');
            buttons.forEach(btn => btn.classList.remove('selected'));
            buttons[optionIndex].classList.add('selected');
        }

        // "기타" 선택 시 커스텀 입력 표시
        if (optionText === '기타' || optionText.includes('기타')) {
            const customDiv = document.getElementById(`custom-${questionIndex}`);
            if (customDiv) {
                customDiv.style.display = 'block';
                customDiv.querySelector('.custom-input').focus();
            }
        } else {
            // 바로 답변 처리
            handleAnswer(questionIndex, optionText);
        }
        
    } catch (error) {
        console.error('❌ 옵션 선택 오류:', error);
    }
}

function submitCustomAnswer(questionIndex, customText) {
    try {
        if (!customText || customText.trim().length === 0) {
            showStatus('내용을 입력해주세요.', 'error');
            return;
        }

        console.log(`커스텀 답변: Q${questionIndex}: ${customText}`);
        handleAnswer(questionIndex, '기타', customText.trim());
        
    } catch (error) {
        console.error('❌ 커스텀 답변 제출 오류:', error);
    }
}

function updateScores(newIntentScore, newQualityScore) {
    try {
        intentScore = newIntentScore || intentScore;
        qualityScore = newQualityScore || qualityScore;

        // 점수 표시 업데이트
        const intentScoreEl = document.getElementById('intentScore');
        const qualityScoreEl = document.getElementById('qualityScore');

        if (intentScoreEl) {
            animateScore(intentScoreEl, intentScore);
        }
        
        if (qualityScoreEl) {
            animateScore(qualityScoreEl, qualityScore);
        }

        // 진행바 업데이트
        updateProgressBars(intentScore, qualityScore);
        
        console.log(`📊 점수 업데이트: 의도=${intentScore}, 품질=${qualityScore}`);
        
    } catch (error) {
        console.error('❌ 점수 업데이트 오류:', error);
    }
}

function animateScore(element, targetScore) {
    try {
        const currentScore = parseInt(element.textContent) || 0;
        const increment = targetScore > currentScore ? 1 : -1;
        const duration = Math.abs(targetScore - currentScore) * 20; // 20ms per point
        
        let current = currentScore;
        const timer = setInterval(() => {
            current += increment;
            element.textContent = current;
            
            if (current === targetScore) {
                clearInterval(timer);
                
                // 95점 달성 시 하이라이트
                if (targetScore >= 95) {
                    element.parentElement.classList.add('score-achieved');
                }
            }
        }, duration / Math.abs(targetScore - currentScore));
        
    } catch (error) {
        console.error('❌ 점수 애니메이션 오류:', error);
        element.textContent = targetScore;
    }
}

function updateProgressBars(intentScore, qualityScore) {
    try {
        const intentBar = document.querySelector('.progress-fill.intent');
        const qualityBar = document.querySelector('.progress-fill.quality');

        if (intentBar) {
            intentBar.style.width = `${Math.min(intentScore, 100)}%`;
        }
        
        if (qualityBar) {
            qualityBar.style.width = `${Math.min(qualityScore, 100)}%`;
        }
        
    } catch (error) {
        console.error('❌ 진행바 업데이트 오류:', error);
    }
}

function showFinalResult(originalPrompt, improvedPrompt) {
    try {
        // 결과 섹션 표시
        const resultSection = document.getElementById('resultSection');
        if (resultSection) {
            resultSection.style.display = 'block';
        }

        // 원본 프롬프트 표시
        const originalEl = document.getElementById('originalPrompt');
        if (originalEl) {
            originalEl.textContent = originalPrompt;
        }

        // 개선된 프롬프트 표시
        const improvedEl = document.getElementById('improvedPrompt');
        if (improvedEl) {
            improvedEl.textContent = improvedPrompt;
        }

        // 질문 영역 숨기기
        const questionsArea = document.getElementById('questionsArea');
        if (questionsArea) {
            questionsArea.style.display = 'none';
        }

        // 결과로 스크롤
        resultSection?.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('❌ 최종 결과 표시 오류:', error);
    }
}

function addConversationMessage(sender, message) {
    try {
        conversationHistory.push({ sender, message, timestamp: Date.now() });
        
        const conversationDiv = document.getElementById('conversation');
        if (!conversationDiv) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const senderLabel = document.createElement('div');
        senderLabel.className = 'message-sender';
        senderLabel.textContent = sender === 'user' ? '👤 사용자' : '🤖 AI';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = message;
        
        messageDiv.appendChild(senderLabel);
        messageDiv.appendChild(messageContent);
        conversationDiv.appendChild(messageDiv);
        
        // 자동 스크롤
        conversationDiv.scrollTop = conversationDiv.scrollHeight;
        
    } catch (error) {
        console.error('❌ 대화 메시지 추가 오류:', error);
    }
}

// =============================================================================
// 상태 관리 함수들
// =============================================================================
function showLoading(show) {
    try {
        const loadingElements = document.querySelectorAll('.loading, .loading-message');
        loadingElements.forEach(el => {
            el.style.display = show ? 'block' : 'none';
        });

        // 로딩 중일 때 버튼 비활성화
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.disabled = show;
        });
        
    } catch (error) {
        console.error('❌ 로딩 상태 표시 오류:', error);
    }
}

function showConversationArea(show) {
    try {
        const conversationArea = document.getElementById('conversationArea');
        if (conversationArea) {
            conversationArea.style.display = show ? 'block' : 'none';
        }

        const scoreSystem = document.getElementById('scoreSystem');
        if (scoreSystem) {
            scoreSystem.style.display = show ? 'block' : 'none';
        }
        
    } catch (error) {
        console.error('❌ 대화 영역 표시 오류:', error);
    }
}

function updateStartButton(processing) {
    try {
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            if (processing) {
                startBtn.textContent = '처리 중...';
                startBtn.disabled = true;
                startBtn.classList.add('processing');
            } else {
                startBtn.textContent = '🚀 개선하기';
                startBtn.disabled = false;
                startBtn.classList.remove('processing');
            }
        }
        
    } catch (error) {
        console.error('❌ 시작 버튼 업데이트 오류:', error);
    }
}

function showStatus(message, type = 'info') {
    try {
        // 기존 상태 메시지 제거
        const existingStatus = document.querySelector('.status-popup');
        if (existingStatus) {
            existingStatus.remove();
        }

        // 새 상태 메시지 생성
        const statusDiv = document.createElement('div');
        statusDiv.className = `status-popup status-${type}`;
        statusDiv.textContent = message;

        // 스타일 설정
        statusDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;

        // 타입별 배경색
        const colors = {
            success: '#48bb78',
            error: '#f56565',
            info: '#4299e1',
            warning: '#ed8936'
        };
        statusDiv.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(statusDiv);

        // 3초 후 자동 제거
        setTimeout(() => {
            statusDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => statusDiv.remove(), 300);
        }, 3000);

        console.log(`${type.toUpperCase()}: ${message}`);
        
    } catch (error) {
        console.error('❌ 상태 메시지 표시 오류:', error);
        // Fallback으로 alert 사용
        alert(`${type}: ${message}`);
    }
}

// =============================================================================
// 유틸리티 함수들
// =============================================================================
function getUserInput() {
    try {
        const input = document.getElementById('userPrompt');
        return input ? input.value.trim() : '';
    } catch (error) {
        console.error('❌ 사용자 입력 가져오기 오류:', error);
        return '';
    }
}

function resetConversation() {
    try {
        currentStep = 0;
        originalInput = '';
        allAnswers = [];
        currentDomain = '';
        intentScore = 0;
        qualityScore = 0;
        conversationHistory = [];

        // UI 초기화
        const questionsArea = document.getElementById('questionsArea');
        if (questionsArea) {
            questionsArea.innerHTML = '';
            questionsArea.style.display = 'none';
        }

        const conversation = document.getElementById('conversation');
        if (conversation) {
            conversation.innerHTML = '';
        }

        const resultSection = document.getElementById('resultSection');
        if (resultSection) {
            resultSection.style.display = 'none';
        }

        showConversationArea(false);
        updateScores(0, 0);
        updateStartButton(false);
        
        console.log('🔄 대화 상태 초기화 완료');
        
    } catch (error) {
        console.error('❌ 대화 초기화 오류:', error);
    }
}

function handleProcessingError() {
    try {
        isProcessing = false;
        showLoading(false);
        updateStartButton(false);
        showStatus('처리 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
        
    } catch (error) {
        console.error('❌ 오류 처리 중 오류:', error);
    }
}

// =============================================================================
// 결과 관련 함수들
// =============================================================================
function copyResult() {
    try {
        const improvedPrompt = document.getElementById('improvedPrompt');
        if (!improvedPrompt) {
            showStatus('복사할 내용이 없습니다.', 'error');
            return;
        }

        const text = improvedPrompt.textContent;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showStatus('프롬프트가 클립보드에 복사되었습니다!', 'success');
            }).catch(error => {
                console.error('클립보드 복사 실패:', error);
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
        
    } catch (error) {
        console.error('❌ 복사 오류:', error);
        showStatus('복사 중 오류가 발생했습니다.', 'error');
    }
}

function fallbackCopy(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showStatus('프롬프트가 복사되었습니다!', 'success');
    } catch (error) {
        showStatus('복사에 실패했습니다. 수동으로 복사해주세요.', 'error');
    }
}

function restartProcess() {
    try {
        if (confirm('새로 시작하시겠습니까? 현재 진행 상황이 초기화됩니다.')) {
            resetConversation();
            const userPrompt = document.getElementById('userPrompt');
            if (userPrompt) {
                userPrompt.value = '';
                userPrompt.focus();
            }
            showStatus('초기화되었습니다. 새로운 프롬프트를 입력해주세요.', 'info');
        }
    } catch (error) {
        console.error('❌ 재시작 오류:', error);
    }
}

// =============================================================================
// CSS 애니메이션 추가
// =============================================================================
function addDynamicStyles() {
    try {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            .score-achieved {
                animation: scoreGlow 0.5s ease;
            }
            
            @keyframes scoreGlow {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); box-shadow: 0 0 20px rgba(72, 187, 120, 0.5); }
                100% { transform: scale(1); }
            }
            
            .option-btn.selected {
                background: #48bb78 !important;
                color: white !important;
                transform: scale(1.05);
            }
            
            .processing {
                opacity: 0.7;
                cursor: not-allowed;
            }
        `;
        
        document.head.appendChild(style);
        
    } catch (error) {
        console.error('❌ 동적 스타일 추가 오류:', error);
    }
}

// 페이지 로드 시 동적 스타일 추가
addDynamicStyles();

console.log('✅ AI 프롬프트 개선기 스크립트 로드 완료!');
