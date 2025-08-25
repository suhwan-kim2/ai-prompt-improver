// script.js - 20단계 95점 자동 달성 시스템 (완성본)

console.log('🚀 AI 프롬프트 개선기 v2.0 - 20단계 자동 시스템');

// =============================================================================
// 📱 전역 변수들
// =============================================================================
let isExpertMode = false;
let currentQuestions = [];
let currentAnswers = {};
let allAnswers = []; 
let originalUserInput = '';
let currentUserInput = ''; // 추가
let isProcessing = false;
let currentScore = 0;
let intentScore = 0;
let qualityScore = 0;
let currentStep = 1;
let currentRound = 1; // 추가
let maxSteps = 20;
let targetScore = 95;

// =============================================================================
// 🚀 페이지 초기화
// =============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 페이지 로드 완료!');
    addDynamicStyles();
    setupInputEvents();
    setupModalEvents();
    updateProgressDisplay();
    updateScores(0, 0); // 추가
    console.log('✅ 초기화 완료!');
});

// =============================================================================
// 🎯 핵심 기능들
// =============================================================================

// 프롬프트 개선 메인 함수
async function improvePrompt() {
    console.log('🎯 프롬프트 개선 시작!');
    
    const searchInput = document.getElementById('searchInput');
    const userInput = searchInput ? searchInput.value.trim() : '';
    
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
    currentUserInput = userInput; // 추가
    currentStep = 1;
    currentRound = 1; // 추가
    allAnswers = [];
    intentScore = 0;
    qualityScore = 0;
    
    maxSteps = isExpertMode ? 20 : 3;
    
    showStatus(`🤖 AI가 ${maxSteps}단계에 걸쳐 완벽한 프롬프트를 만들어드립니다...`, 'processing');
    updateProgressDisplay();
    
    try {
        // 1단계 질문 요청
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                step: 'questions',
                userInput: userInput,
                mode: isExpertMode ? 'expert' : 'normal'
            })
        });

        if (!response.ok) {
            throw new Error(`서버 오류: ${response.status}`);
        }

        const result = await response.json();
        console.log('📨 1단계 응답:', result);
        
        if (result.intentScore) {
            intentScore = result.intentScore;
            updateScores(intentScore, 0);
        }
        
        if (result.questions && result.questions.length > 0) {
            displayQuestions(result.questions);
            showStatus(`📝 1단계: 기본 정보를 파악하겠습니다 (의도 파악: ${intentScore}점)`, 'success');
        } else {
            showStatus('충분한 정보로 바로 개선합니다...', 'processing');
            await finalImprove();
        }
    } catch (error) {
        console.error('❌ 오류:', error);
        showStatus('처리 중 오류가 발생했습니다: ' + error.message, 'error');
        
        // 폴백 질문
        const fallbackQuestions = [
            {
                question: "어떤 종류의 결과물을 원하시나요?",
                options: ["이미지/그림", "영상/비디오", "웹/앱", "문서/텍스트", "기타"]
            }
        ];
        displayQuestions(fallbackQuestions);
    } finally {
        isProcessing = false;
    }
}

// =============================================================================
// 📝 질문 표시 시스템
// =============================================================================

function displayQuestions(questions) {
    console.log(`📝 ${currentStep}단계 질문 표시:`, questions);
    
    if (!Array.isArray(questions) || questions.length === 0) {
        console.log('❌ 유효하지 않은 질문 데이터');
        if (intentScore >= targetScore || currentStep >= maxSteps) {
            finalImprove();
        } else {
            requestAdditionalQuestions(currentStep + 1);
        }
        return;
    }
    
    currentQuestions = questions;
    currentAnswers = {};
    
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const questionsContainer = document.getElementById('questionsContainer');
    
    if (!questionsContainer || !aiQuestionsDiv) {
        console.error('❌ 질문 컨테이너를 찾을 수 없습니다');
        return;
    }
    
    let questionsHTML = '<div class="questions-step">';
    questionsHTML += `
        <div class="step-header">
            <div class="step-title">🎯 ${currentStep}단계 질문 ${isExpertMode ? '(전문가모드)' : '(일반모드)'}</div>
            <div class="step-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(currentStep / maxSteps) * 100}%"></div>
                </div>
                <span class="progress-text">${currentStep} / ${maxSteps} 단계</span>
            </div>
        </div>
    `;
    
    questions.forEach((q, index) => {
        const question = q.question || q;
        const options = q.options || ["예", "아니오", "모르겠음", "기타"];
        
        questionsHTML += `
            <div class="question-item" id="question-${index}">
                <div class="question-number">Q${index + 1}</div>
                <div class="question-text">${escapeHtml(question)}</div>
                <div class="question-options">
        `;
        
        options.forEach((option, optionIndex) => {
            questionsHTML += `
                <button class="option-button" 
                        onclick="selectOption(${index}, ${optionIndex}, '${escapeHtml(option)}')"
                        id="option-${index}-${optionIndex}">
                    ${escapeHtml(option)}
                </button>
            `;
        });
        
        questionsHTML += `
                </div>
                <div class="custom-input" id="custom-input-${index}" style="display: none;">
                    <label class="custom-label">구체적으로 설명해주세요:</label>
                    <textarea class="custom-textarea" 
                              placeholder="자세한 내용을 입력해주세요..."
                              oninput="saveCustomAnswer(${index}, this.value)"
                              rows="3"></textarea>
                </div>
            </div>
        `;
    });
    
    questionsHTML += `
        <div class="questions-actions">
            <button onclick="submitAnswers()" class="action-btn proceed">
                ✨ 답변 완료 - 다음 단계로
            </button>
            <button onclick="skipQuestions()" class="action-btn skip">
                ⏭️ 이 단계 건너뛰기
            </button>
        </div>
    </div>`;
    
    questionsContainer.innerHTML = questionsHTML;
    aiQuestionsDiv.style.display = 'block';
    
    setTimeout(() => {
        aiQuestionsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// 옵션 선택
function selectOption(questionIndex, optionIndex, optionText) {
    console.log(`🎯 선택: 질문${questionIndex}, 옵션: ${optionText}`);
    
    const questionDiv = document.getElementById(`question-${questionIndex}`);
    if (questionDiv) {
        const allOptions = questionDiv.querySelectorAll('.option-button');
        allOptions.forEach(btn => btn.classList.remove('selected'));
    }
    
    const selectedButton = document.getElementById(`option-${questionIndex}-${optionIndex}`);
    if (selectedButton) {
        selectedButton.classList.add('selected');
    }
    
    currentAnswers[questionIndex] = optionText;
    
    const customInput = document.getElementById(`custom-input-${questionIndex}`);
    if (customInput) {
        if (optionText === '기타' || optionText.includes('기타')) {
            customInput.style.display = 'block';
            const textarea = customInput.querySelector('textarea');
            if (textarea) setTimeout(() => textarea.focus(), 100);
        } else {
            customInput.style.display = 'none';
        }
    }
}

// 커스텀 답변 저장
function saveCustomAnswer(questionIndex, customText) {
    if (customText.trim()) {
        currentAnswers[questionIndex] = `기타: ${customText.trim()}`;
    }
}

// =============================================================================
// 🔄 답변 제출 및 자동 진행
// =============================================================================

async function submitAnswers() {
    console.log(`✅ ${currentStep}단계 답변 완료:`, currentAnswers);
    
    const answersArray = Object.values(currentAnswers).filter(a => a && a.length > 0);
    if (answersArray.length === 0) {
        showStatus('최소 하나 이상의 질문에 답변해주세요.', 'error');
        return;
    }
    
    allAnswers.push(...answersArray);
    currentRound++;
    
    showStatus(`📊 ${currentStep}단계 답변 분석 중...`, 'processing');
    
    if (currentStep >= maxSteps || intentScore >= targetScore) {
        await finalImprove();
    } else {
        currentStep++;
        await requestAdditionalQuestions(currentStep);
    }
}

// 추가 질문 요청 (2-20단계)
async function requestAdditionalQuestions(stepNumber) {
    try {
        console.log(`📝 ${stepNumber}단계 추가 질문 요청 중...`);
        console.log('요청 데이터:', {
            step: 'additional-questions',
            userInput: currentUserInput,
            answers: allAnswers,
            currentStep: stepNumber
        });
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                step: 'additional-questions',
                userInput: currentUserInput,
                answers: allAnswers,
                currentStep: stepNumber,
                mode: isExpertMode ? 'expert' : 'normal'
            })
        });

        if (!response.ok) {
            throw new Error(`API 오류: ${response.status}`);
        }

        const text = await response.text();
        console.log('원본 응답:', text);
        
        if (!text) {
            throw new Error('빈 응답');
        }
        
        const data = JSON.parse(text);
        console.log('파싱된 데이터:', data);
        
        // 점수 업데이트
        if (data.intentScore) {
            intentScore = data.intentScore;
            updateScores(intentScore, qualityScore);
        }
        
        // 질문 표시 또는 완료
        if (data.questions && data.questions.length > 0) {
            displayQuestions(data.questions);
            currentStep = stepNumber;
            updateProgressDisplay();
            showStatus(`📝 ${currentStep}단계: 추가 정보 파악 중 (현재 ${intentScore}점 → 목표 ${targetScore}점)`, 'success');
        } else if (data.completed || intentScore >= targetScore) {
            await finalImprove();
        } else {
            console.error('예상치 못한 응답:', data);
            await finalImprove();
        }
        
    } catch (error) {
        console.error('❌ 추가 질문 요청 오류:', error);
        console.error('상세 오류:', error.message, error.stack);
        
        // 오류 시 최종 개선으로
        await finalImprove();
    }
}

// 질문 건너뛰기
async function skipQuestions() {
    console.log(`⏭️ ${currentStep}단계 건너뛰기`);
    
    if (currentStep >= maxSteps || intentScore >= targetScore) {
        await finalImprove();
    } else {
        currentStep++;
        await requestAdditionalQuestions(currentStep);
    }
}

// =============================================================================
// 🎯 최종 프롬프트 개선
// =============================================================================

async function finalImprove() {
    console.log(`🎯 최종 프롬프트 개선 시작 (${currentStep}단계 완료)`);
    
    try {
        showStatus('🤖 AI가 완벽한 프롬프트를 생성하고 있습니다...', 'processing');
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                step: 'final-improve',
                userInput: currentUserInput,
                answers: allAnswers,
                currentStep: currentStep,
                mode: isExpertMode ? 'expert' : 'normal'
            })
        });

        if (!response.ok) {
            throw new Error(`서버 오류: ${response.status}`);
        }

        const result = await response.json();
        console.log('📨 최종 개선 결과:', result);
        
        if (result.intentScore) intentScore = result.intentScore;
        if (result.qualityScore) qualityScore = result.qualityScore;
        
        updateScores(intentScore, qualityScore);
        displayResult(originalUserInput, result.improved_prompt || result);
        
        const successMessage = `🎉 ${currentStep}단계 만에 완성! 의도파악 ${intentScore}점, 품질 ${qualityScore}점 달성!`;
        showStatus(successMessage, 'success');
        
    } catch (error) {
        console.error('❌ 최종 개선 오류:', error);
        
        const fallbackPrompt = originalUserInput + '\n\n고품질로 상세하게 제작해주세요.';
        displayResult(originalUserInput, fallbackPrompt);
        showStatus('기본 개선 시스템으로 처리되었습니다.', 'success');
    }
}

// =============================================================================
// 🎨 결과 표시
// =============================================================================

function displayResult(original, improved) {
    console.log('📊 결과 표시');
    
    const aiQuestions = document.getElementById('aiQuestions');
    const originalText = document.getElementById('originalText');
    const improvedText = document.getElementById('improvedText');
    const improvedResult = document.getElementById('improvedResult');
    
    if (aiQuestions) aiQuestions.style.display = 'none';
    if (originalText) originalText.textContent = original;
    if (improvedText) improvedText.textContent = improved;
    if (improvedResult) {
        improvedResult.style.display = 'block';
        improvedResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// 점수 업데이트
function updateScores(intent, quality) {
    intentScore = intent;
    qualityScore = quality;
    
    // 여기에 점수 표시 UI 업데이트 로직 추가 가능
    console.log(`📊 점수 업데이트: 의도 ${intentScore}점, 품질 ${qualityScore}점`);
}

// 진행 상황 업데이트
function updateProgressDisplay() {
    console.log(`📊 진행 상황: ${currentStep}/${maxSteps} 단계`);
    
    const progress = (currentStep / maxSteps) * 100;
    const progressFills = document.querySelectorAll('.progress-fill');
    progressFills.forEach(fill => {
        if (fill) fill.style.width = `${progress}%`;
    });
}

// =============================================================================
// 🎛️ 모드 전환
// =============================================================================

function toggleMode() {
    isExpertMode = !isExpertMode;
    maxSteps = isExpertMode ? 20 : 3;
    
    const toggle = document.getElementById('modeToggle');
    const description = document.getElementById('modeDescription');
    
    if (toggle) {
        toggle.classList.toggle('active', isExpertMode);
    }
    
    if (description) {
        description.textContent = isExpertMode ? 
            `전문가급 의도 분석 시스템 (최대 ${maxSteps}단계)` : 
            `빠르고 간편한 프롬프트 개선 (${maxSteps}단계)`;
    }
    
    showStatus(`${isExpertMode ? '🎯 전문가' : '💨 일반'}모드로 변경되었습니다.`, 'success');
}

// =============================================================================
// 🛠️ 유틸리티 함수들
// =============================================================================

function clearPreviousResults() {
    const elements = ['aiQuestions', 'improvedResult'];
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
    
    const questionsContainer = document.getElementById('questionsContainer');
    if (questionsContainer) questionsContainer.innerHTML = '';
    
    currentQuestions = [];
    currentAnswers = {};
}

function showStatus(message, type = 'info') {
    console.log(`📢 [${type}]: ${message}`);
    
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;
    
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    statusDiv.className = 'status-message';
    
    if (type === 'success') statusDiv.classList.add('status-success');
    else if (type === 'error') statusDiv.classList.add('status-error');
    else if (type === 'processing') statusDiv.classList.add('status-processing');
    
    if (type !== 'processing') {
        setTimeout(() => {
            if (statusDiv) statusDiv.style.display = 'none';
        }, 5000);
    }
}

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function copyToClipboard() {
    const improvedText = document.getElementById('improvedText');
    if (!improvedText) {
        showStatus('복사할 텍스트를 찾을 수 없습니다.', 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(improvedText.textContent);
        showStatus('✅ 클립보드에 복사되었습니다!', 'success');
    } catch (err) {
        showStatus('클립보드 복사 실패', 'error');
    }
}

function saveToFavorites() {
    const improvedText = document.getElementById('improvedText');
    if (!improvedText) return;
    
    const favoriteItem = {
        id: Date.now(),
        original: originalUserInput,
        improved: improvedText.textContent,
        score: intentScore,
        date: new Date().toLocaleDateString('ko-KR')
    };
    
    try {
        let favorites = JSON.parse(localStorage.getItem('prompt_favorites') || '[]');
        favorites.unshift(favoriteItem);
        if (favorites.length > 20) favorites = favorites.slice(0, 20);
        localStorage.setItem('prompt_favorites', JSON.stringify(favorites));
        showStatus('⭐ 즐겨찾기에 저장되었습니다!', 'success');
    } catch (e) {
        showStatus('저장 실패', 'error');
    }
}

function showDetailedGuide() {
    alert(`📖 사용법\n\n${isExpertMode ? '전문가' : '일반'}모드 (최대 ${maxSteps}단계)\n\n1. 프롬프트 입력\n2. 질문에 답변\n3. 자동으로 개선 완료!`);
}

function closeDetailedGuide() {
    // 모달 닫기
}

// =============================================================================
// 🎨 UI 초기화
// =============================================================================

function setupInputEvents() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                improvePrompt();
            }
        });
        
        searchInput.addEventListener('input', function() {
            this.classList.remove('error');
        });
    }
}

function setupModalEvents() {
    // 모달 이벤트 설정
}

function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .step-header {
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px 8px 0 0;
            margin-bottom: 20px;
        }
        
        .option-button.selected {
            background: #4285f4;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(66, 133, 244, 0.3);
        }
        
        .custom-input {
            margin-top: 15px;
            padding: 15px;
            background: #fff3e0;
            border-radius: 8px;
        }
        
        .search-input.error {
            border-color: #ea4335 !important;
        }
    `;
    document.head.appendChild(style);
}

console.log('✅ Script loaded successfully!');
