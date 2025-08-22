// script.js - 새로운 전문가모드 프로세스 구현

// 전역 변수들
let isExpertMode = false;
let currentQuestions = [];
let currentAnswers = {};
let currentRound = 0;
let maxRounds = 1;
let originalUserInput = '';
let isProcessing = false;
let currentScore = 0;
let internalImprovedPrompt = ''; // 🆕 내부 개선 프롬프트 저장
let expertModeStep = 'initial'; // 🆕 전문가모드 단계 추적

// 페이지 로드시 초기화
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
    
    window.onclick = function(event) {
        const modal = document.getElementById('guideModal');
        if (modal && event.target === modal) {
            modal.style.display = 'none';
        }
    };
};

// 모드 토글 함수
function toggleMode() {
    isExpertMode = !isExpertMode;
    const toggle = document.getElementById('modeToggle');
    const description = document.getElementById('modeDescription');
    const guideTitle = document.getElementById('guideTitle');
    const guideSteps = document.getElementById('guideSteps');
    
    if (isExpertMode) {
        toggle.classList.add('active');
        description.textContent = '전문가급 심층 의도 파악 (다단계 내부 개선)';
        guideTitle.textContent = '🎯 전문가모드 사용법';
        guideSteps.innerHTML = 
            '<div class="step">' +
                '<span class="step-number">1️⃣</span>' +
                '<span class="step-text">원하는 작업을 상세히 입력</span>' +
            '</div>' +
            '<div class="step">' +
                '<span class="step-number">2️⃣</span>' +
                '<span class="step-text">기본 질문 → 1차 내부개선 → 심층질문1</span>' +
            '</div>' +
            '<div class="step">' +
                '<span class="step-number">3️⃣</span>' +
                '<span class="step-text">2차 내부개선 → 심층질문2 → 최종 전문가급 완성</span>' +
            '</div>';
        maxRounds = 3;
    } else {
        toggle.classList.remove('active');
        description.textContent = '빠르고 간편한 프롬프트 개선 (1회 질문)';
        guideTitle.textContent = '🚀 일반모드 사용법';
        guideSteps.innerHTML = 
            '<div class="step">' +
                '<span class="step-number">1️⃣</span>' +
                '<span class="step-text">원하는 작업을 한글로 입력</span>' +
            '</div>' +
            '<div class="step">' +
                '<span class="step-number">2️⃣</span>' +
                '<span class="step-text">AI 질문에 답변 (스킵 가능)</span>' +
            '</div>' +
            '<div class="step">' +
                '<span class="step-number">3️⃣</span>' +
                '<span class="step-text">개선된 프롬프트 바로 완성</span>' +
            '</div>';
        maxRounds = 1;
    }
}

// 🆕 메인 프롬프트 개선 함수 (새로운 프로세스)
async function improvePrompt() {
    const userInput = document.getElementById('searchInput').value.trim();
    
    if (!userInput) {
        showStatus('개선하고 싶은 프롬프트를 입력해주세요.', 'error');
        return;
    }
    
    if (isProcessing) {
        showStatus('이미 처리 중입니다. 잠시만 기다려주세요.', 'error');
        return;
    }
    
    clearPreviousResults();
    isProcessing = true;
    originalUserInput = userInput;
    currentRound = 0;
    expertModeStep = 'initial';
    internalImprovedPrompt = '';
    
    try {
        showStatus('AI가 기본 질문을 생성하고 있습니다...', 'processing');
        
        // 1단계: 기본 질문 생성 (모든 모드 공통)
        const questions = await callAPI('questions', {
            userInput: userInput,
            isExpertMode: isExpertMode
        });
        
        if (questions && questions.length > 0) {
            displayQuestions(questions, '기본 정보 파악');
            showStatus('기본 질문이 생성되었습니다!', 'success');
        } else {
            // 질문 없이 바로 개선
            await directImprove();
        }
        
    } catch (error) {
        console.error('improvePrompt 오류:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 🆕 답변 완료 후 진행 (새로운 프로세스)
async function proceedWithAnswers() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        if (!isExpertMode) {
            // 🚀 일반모드: 바로 최종 개선
            showStatus('답변을 바탕으로 프롬프트를 개선하고 있습니다...', 'processing');
            await finalImprove();
        } else {
            // 🎯 전문가모드: 단계별 프로세스
            await expertModeProcess();
        }
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 🆕 전문가모드 단계별 프로세스
async function expertModeProcess() {
    switch (expertModeStep) {
        case 'initial':
            // 1차 내부 개선
            showStatus('1차 내부 개선을 진행하고 있습니다...', 'processing');
            internalImprovedPrompt = await callAPI('internal-improve-1', {
                userInput: originalUserInput,
                questions: currentQuestions,
                answers: formatAnswersForAPI(),
                isExpertMode: true
            });
            
            // 1차 심층 질문 생성
            showStatus('1차 심층 질문을 생성하고 있습니다...', 'processing');
            const round1Questions = await callAPI('questions-round-1', {
                userInput: originalUserInput,
                internalImprovedPrompt: internalImprovedPrompt,
                questions: currentQuestions,
                isExpertMode: true
            });
            
            if (round1Questions && round1Questions.length > 0) {
                displayQuestions(round1Questions, '1차 심층 의도 파악', true);
                expertModeStep = 'round1';
                showStatus('1차 심층 질문이 생성되었습니다!', 'success');
            } else {
                await finalImprove();
            }
            break;
            
        case 'round1':
            // 2차 내부 개선
            showStatus('2차 내부 개선을 진행하고 있습니다...', 'processing');
            internalImprovedPrompt = await callAPI('internal-improve-2', {
                userInput: originalUserInput,
                questions: currentQuestions,
                answers: formatAnswersForAPI(),
                internalImprovedPrompt: internalImprovedPrompt,
                isExpertMode: true
            });
            
            // 2차 심층 질문 생성
            showStatus('2차 심층 질문을 생성하고 있습니다...', 'processing');
            const round2Questions = await callAPI('questions-round-2', {
                userInput: originalUserInput,
                internalImprovedPrompt: internalImprovedPrompt,
                questions: currentQuestions,
                isExpertMode: true
            });
            
            if (round2Questions && round2Questions.length > 0) {
                displayQuestions(round2Questions, '2차 심층 의도 파악', true);
                expertModeStep = 'round2';
                showStatus('2차 심층 질문이 생성되었습니다!', 'success');
            } else {
                await finalImprove();
            }
            break;
