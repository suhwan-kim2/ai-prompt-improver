// script.js - 20단계 95점 자동 달성 시스템

console.log('🚀 AI 프롬프트 개선기 v2.0 - 20단계 자동 시스템');

// =============================================================================
// 📱 전역 변수들
// =============================================================================
let isExpertMode = false;
let currentQuestions = [];
let currentAnswers = {};
let allAnswers = []; // 모든 단계의 답변 저장
let originalUserInput = '';
let isProcessing = false;
let currentScore = 0;
let intentScore = 0;
let qualityScore = 0;
let currentStep = 1; // 라운드 → 단계로 변경
let maxSteps = 20; // 최대 20단계
let targetScore = 95; // 목표 점수

// =============================================================================
// 🚀 페이지 초기화
// =============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 페이지 로드 완료!');
    
    // 동적 스타일 추가
    addDynamicStyles();
    
    // 입력창 이벤트 설정
    setupInputEvents();
    
    // 모달 이벤트 설정
    setupModalEvents();
    
    // 초기 상태 표시
    updateProgressDisplay();
    
    console.log('✅ 초기화 완료!');
});

// =============================================================================
// 🎯 핵심 기능들
// =============================================================================

// 프롬프트 개선 메인 함수
function improvePrompt() {
    console.log('🎯 프롬프트 개선 시작!');
    
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
    currentStep = 1;
    allAnswers = [];
    intentScore = 0;
    qualityScore = 0;
    
    // 모드에 따른 최대 단계 설정
    maxSteps = isExpertMode ? 20 : 3;
    
    showStatus(`🤖 AI가 ${maxSteps}단계에 걸쳐 완벽한 프롬프트를 만들어드립니다...`, 'processing');
    updateProgressDisplay();
    
    // 서버에 1단계 질문 요청
    callAPI('questions', { userInput: userInput })
        .then(result => {
            console.log('📨 1단계 응답:', result);
            
            if (result.intentScore) {
                intentScore = result.intentScore;
                updateScoreDisplay();
            }
            
            if (result.questions && result.questions.length > 0) {
                displayQuestions(result.questions, 1);
                showStatus(`📝 1단계: 기본 정보를 파악하겠습니다 (의도 파악: ${intentScore}점)`, 'success');
            } else {
                // 질문 없이 바로 개선
                showStatus('충분한 정보로 바로 개선합니다...', 'processing');
                finalImprove();
            }
        })
        .catch(error => {
            console.error('❌ 오류:', error);
            showStatus('처리 중 오류가 발생했습니다: ' + error.message, 'error');
            
            // 폴백: 기본 질문 제공
            const fallbackQuestions = [
                {
                    question: "어떤 종류의 결과물을 원하시나요?",
                    options: ["이미지/그림", "영상/비디오", "웹/앱", "문서/텍스트", "기타"]
                }
            ];
            displayQuestions(fallbackQuestions, 1);
            showStatus('기본 질문으로 진행합니다.', 'success');
        })
        .finally(() => {
            isProcessing = false;
        });
}

// =============================================================================
// 📝 질문 표시 시스템 (단계별)
// =============================================================================

function displayQuestions(questions, stepNumber) {
    console.log(`📝 ${stepNumber}단계 질문 표시:`, questions);
    
    if (!Array.isArray(questions) || questions.length === 0) {
        console.log('❌ 유효하지 않은 질문 데이터');
        
        // 질문이 없으면 다음 단계로 자동 진행 또는 완료
        if (intentScore >= targetScore || stepNumber >= maxSteps) {
            finalImprove();
        } else {
            autoRequestNextStep();
        }
        return;
    }
    
    // 객관식 형태로 변환
    const processedQuestions = questions.map((q, index) => {
        if (typeof q === 'string') {
            return {
                id: index,
                question: q,
                options: ["예", "아니오", "모르겠음", "기타"],
                type: 'multiple_choice'
            };
        } else if (q.question && q.options) {
            return {
                id: index,
                question: q.question,
                options: q.options,
                type: 'multiple_choice'
            };
        } else {
            return {
                id: index,
                question: String(q),
                options: ["예", "아니오", "기타"],
                type: 'multiple_choice'
            };
        }
    });
    
    currentQuestions = processedQuestions;
    currentAnswers = {}; // 현재 단계 답변 초기화
    
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const questionsContainer = document.getElementById('questionsContainer');
    
    if (!questionsContainer || !aiQuestionsDiv) {
        console.error('❌ 질문 컨테이너를 찾을 수 없습니다');
        return;
    }
    
    let questionsHTML = '<div class="questions-step">';
    questionsHTML += `
        <div class="step-header">
            <div class="step-title">🎯 ${stepNumber}단계 질문 ${isExpertMode ? '(전문가모드)' : '(일반모드)'}</div>
            <div class="step-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(stepNumber / maxSteps) * 100}%"></div>
                </div>
                <span class="progress-text">${stepNumber} / ${maxSteps} 단계</span>
            </div>
        </div>
    `;
    
    processedQuestions.forEach((questionData, index) => {
        const escapedQuestion = escapeHtml(questionData.question);
        questionsHTML += `
            <div class="question-item" id="question-${index}">
                <div class="question-number">Q${index + 1}</div>
                <div class="question-text">${escapedQuestion}</div>
                <div class="question-options">
        `;
        
        // 객관식 선택지 생성
        questionData.options.forEach((option, optionIndex) => {
            const escapedOption = escapeHtml(option);
            questionsHTML += `
                <button class="option-button" 
                        onclick="selectOption(${index}, ${optionIndex}, '${escapedOption}')"
                        id="option-${index}-${optionIndex}">
                    ${escapedOption}
                </button>
            `;
        });
        
        questionsHTML += '</div>';
        
        // "기타" 선택시 추가 입력창
        questionsHTML += `
            <div class="custom-input" id="custom-input-${index}" style="display: none;">
                <label class="custom-label">구체적으로 설명해주세요:</label>
                <textarea class="custom-textarea" 
                          placeholder="자세한 내용을 입력해주세요..."
                          oninput="saveCustomAnswer(${index}, this.value)"
                          rows="3"></textarea>
            </div>
        `;
        
        questionsHTML += '</div>';
    });
    
    questionsHTML += `
        <div class="questions-actions">
            <button onclick="proceedWithAnswers()" class="action-btn proceed">
                ✨ 답변 완료 - 다음 단계로
            </button>
            <button onclick="skipQuestions()" class="action-btn skip">
                ⏭️ 이 단계 건너뛰기
            </button>
        </div>
    `;
    questionsHTML += '</div>';
    
    questionsContainer.innerHTML = questionsHTML;
    aiQuestionsDiv.style.display = 'block';
    
    // 질문 영역으로 스크롤
    setTimeout(() => {
        aiQuestionsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// 옵션 선택 처리
function selectOption(questionIndex, optionIndex, optionText) {
    console.log(`🎯 선택: 질문${questionIndex}, 옵션${optionIndex}, 텍스트: "${optionText}"`);
    
    // 기존 선택 해제
    const questionDiv = document.getElementById(`question-${questionIndex}`);
    if (questionDiv) {
        const allOptions = questionDiv.querySelectorAll('.option-button');
        allOptions.forEach(btn => btn.classList.remove('selected'));
    }
    
    // 현재 선택 활성화
    const selectedButton = document.getElementById(`option-${questionIndex}-${optionIndex}`);
    if (selectedButton) {
        selectedButton.classList.add('selected');
    }
    
    // 답변 저장
    currentAnswers[questionIndex] = {
        type: 'multiple_choice',
        selected_option: optionText,
        option_index: optionIndex,
        custom_text: null
    };
    
    // "기타" 선택시 추가 입력창 표시
    const customInput = document.getElementById(`custom-input-${questionIndex}`);
    if (customInput) {
        if (optionText === '기타' || optionText.includes('기타')) {
            customInput.style.display = 'block';
            const textarea = customInput.querySelector('textarea');
            if (textarea) setTimeout(() => textarea.focus(), 100);
        } else {
            customInput.style.display = 'none';
            currentAnswers[questionIndex].custom_text = null;
        }
    }
    
    updateQuestionStatus(questionIndex);
}

// 커스텀 답변 저장
function saveCustomAnswer(questionIndex, customText) {
    console.log(`✏️ 커스텀 답변: 질문${questionIndex}, 텍스트: "${customText}"`);
    
    if (currentAnswers[questionIndex]) {
        currentAnswers[questionIndex].custom_text = customText.trim();
    }
    
    updateQuestionStatus(questionIndex);
}

// 질문 상태 업데이트
function updateQuestionStatus(questionIndex) {
    const questionItem = document.getElementById(`question-${questionIndex}`);
    if (!questionItem) return;
    
    const answer = currentAnswers[questionIndex];
    const isAnswered = answer && answer.selected_option && 
        (answer.selected_option !== '기타' || (answer.custom_text && answer.custom_text.length > 0));
    
    if (isAnswered) {
        questionItem.classList.add('answered');
    } else {
        questionItem.classList.remove('answered');
    }
    
    // 모든 질문 답변 여부 체크
    checkAllQuestionsAnswered();
}

// 모든 질문 답변 여부 체크
function checkAllQuestionsAnswered() {
    const totalQuestions = currentQuestions.length;
    const answeredQuestions = Object.values(currentAnswers).filter(answer => 
        answer && answer.selected_option && 
        (answer.selected_option !== '기타' || (answer.custom_text && answer.custom_text.length > 0))
    ).length;
    
    const proceedButton = document.querySelector('.action-btn.proceed');
    if (proceedButton) {
        if (answeredQuestions === totalQuestions) {
            proceedButton.classList.add('ready');
            proceedButton.textContent = `✅ 모든 답변 완료 - ${currentStep + 1}단계로 진행`;
        } else {
            proceedButton.classList.remove('ready');
            proceedButton.textContent = `✨ 답변 완료 (${answeredQuestions}/${totalQuestions}) - 다음 단계로`;
        }
    }
}

// =============================================================================
// 🔄 자동 진행 시스템 (핵심!)
// =============================================================================

async function proceedWithAnswers() {
    console.log(`✅ ${currentStep}단계 답변 완료:`, currentAnswers);
    
    const validAnswers = Object.values(currentAnswers).filter(answer => 
        answer && answer.selected_option && answer.selected_option.length > 0
    );
    
    if (validAnswers.length === 0) {
        showStatus('최소 하나 이상의 질문에 답변해주세요.', 'error');
        return;
    }
    
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        // 답변을 전체 답변 배열에 추가
        const formattedAnswers = formatAnswersForAPI(currentAnswers);
        allAnswers.push(...formattedAnswers);
        
        showStatus(`📊 ${currentStep}단계 답변 분석 중...`, 'processing');
        
        // 다음 단계 결정
        if (currentStep >= maxSteps) {
            // 최대 단계 도달 - 최종 개선
            showStatus(`🏁 ${maxSteps}단계 완료! 최종 프롬프트를 생성합니다...`, 'processing');
            await finalImprove();
        } else if (intentScore >= targetScore) {
            // 목표 점수 달성 - 최종 개선
            showStatus(`🎉 ${intentScore}점 달성! 완벽한 프롬프트를 생성합니다...`, 'processing');
            await finalImprove();
        } else {
            // 다음 단계로 자동 진행
            currentStep++;
            await autoRequestNextStep();
        }
        
    } catch (error) {
        console.error('❌ 답변 처리 오류:', error);
        showStatus('답변 처리 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 🔄 자동으로 다음 단계 요청
async function autoRequestNextStep() {
    console.log(`🔄 자동 ${currentStep}단계 진행 (현재 점수: ${intentScore})`);
    
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus(`🎯 ${currentStep}단계: 더 정확한 분석을 위한 추가 질문을 생성합니다...`, 'processing');
        
        const result = await callAPI('additional-questions', {
            userInput: originalUserInput,
            answers: allAnswers,
            currentStep: currentStep
        });
        
        console.log(`📨 ${currentStep}단계 응답:`, result);
        
        // 점수 업데이트
        if (result.intentScore) {
            intentScore = result.intentScore;
            updateScoreDisplay();
        }
        
        // 완료 체크
        if (result.completed || intentScore >= targetScore) {
            showStatus(`🎉 목표 달성! (${intentScore}점) 최종 프롬프트를 생성합니다...`, 'processing');
            await finalImprove();
        } else if (result.questions && result.questions.length > 0) {
            // 다음 단계 질문 표시
            displayQuestions(result.questions, currentStep);
            showStatus(`📝 ${currentStep}단계: 추가 정보 파악 중 (현재 ${intentScore}점 → 목표 ${targetScore}점)`, 'success');
        } else {
            // 질문이 없으면 최종 개선
            await finalImprove();
        }
        
    } catch (error) {
        console.error(`❌ ${currentStep}단계 오류:`, error);
        showStatus(`${currentStep}단계 처리 중 오류: ${error.message}`, 'error');
        
        // 오류 시에도 최종 개선 시도
        await finalImprove();
    } finally {
        isProcessing = false;
    }
}

// 질문 건너뛰기
async function skipQuestions() {
    console.log(`⏭️ ${currentStep}단계 건너뛰기`);
    
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus(`${currentStep}단계를 건너뛰고 다음으로 진행합니다...`, 'processing');
        
        if (currentStep >= maxSteps || intentScore >= targetScore) {
            await finalImprove();
        } else {
            currentStep++;
            await autoRequestNextStep();
        }
        
    } catch (error) {
        console.error('❌ 건너뛰기 오류:', error);
        showStatus('처리 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// =============================================================================
// 🎯 최종 프롬프트 개선
// =============================================================================

async function finalImprove() {
    console.log(`🎯 최종 프롬프트 개선 시작 (${currentStep}단계 완료)`);
    
    try {
        showStatus('🤖 AI가 완벽한 프롬프트를 생성하고 있습니다...', 'processing');
        
        const result = await callAPI('final-improve', {
            userInput: originalUserInput,
            answers: allAnswers,
            currentStep: currentStep
        });
        
        console.log('📨 최종 개선 결과:', result);
        
        // 점수 업데이트
        if (result.intentScore) intentScore = result.intentScore;
        if (result.qualityScore) qualityScore = result.qualityScore;
        const finalScore = result.score || Math.round((intentScore + qualityScore) / 2);
        
        // 결과 표시
        displayResult(originalUserInput, result.improved_prompt || result);
        showScoreImprovement(finalScore, result.improvements || []);
        updateScoreDisplay();
        
        // 성공 메시지
        const successMessage = `🎉 ${currentStep}단계 만에 완성! 의도파악 ${intentScore}점, 품질 ${qualityScore}점 달성!`;
        showStatus(successMessage, 'success');
        
        // 히스토리에 저장
        addToHistory(originalUserInput, result.improved_prompt || result, finalScore);
        
    } catch (error) {
        console.error('❌ 최종 개선 오류:', error);
        
        // 폴백 개선
        const fallbackPrompt = originalUserInput + '\n\n고품질로 상세하게 제작해주세요.';
        displayResult(originalUserInput, fallbackPrompt);
        showScoreImprovement(75, ['기본 품질 향상']);
        showStatus('기본 개선 시스템으로 처리되었습니다.', 'success');
    }
}

// =============================================================================
// 🎨 결과 표시
// =============================================================================

function displayResult(original, improved) {
    console.log('📊 결과 표시:', { original, improved });
    
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
    
    // 단계 정보 표시
    const stepInfo = document.createElement('div');
    stepInfo.className = 'step-info';
    stepInfo.innerHTML = `
        <span class="step-badge">총 ${currentStep}단계 진행</span>
        <span class="score-badge">의도 ${intentScore}점</span>
        <span class="score-badge">품질 ${qualityScore}점</span>
    `;
    
    const resultHeader = improvedResult?.querySelector('.result-header');
    if (resultHeader && !resultHeader.querySelector('.step-info')) {
        resultHeader.appendChild(stepInfo);
    }
}

function showScoreImprovement(score, improvements = []) {
    console.log('📊 점수 표시:', score, improvements);
    
    currentScore = score;
    
    const scoreDisplay = document.getElementById('currentScore');
    const scoreBadge = document.getElementById('scoreBadge');
    
    if (scoreDisplay) {
        animateScoreCounter(scoreDisplay, score);
    }
    
    if (scoreBadge) {
        scoreBadge.style.display = 'block';
        scoreBadge.textContent = `${score}점`;
        
        // 점수에 따른 색상
        if (score >= 95) {
            scoreBadge.style.backgroundColor = '#34a853';
        } else if (score >= 90) {
            scoreBadge.style.backgroundColor = '#fbbc04';
        } else if (score >= 80) {
            scoreBadge.style.backgroundColor = '#4285f4';
        } else {
            scoreBadge.style.backgroundColor = '#ea4335';
        }
    }
}

// =============================================================================
// 📊 진행 상황 표시
// =============================================================================

function updateProgressDisplay() {
    console.log(`📊 진행 상황: ${currentStep}/${maxSteps} 단계`);
    
    // 진행률 계산
    const progress = (currentStep / maxSteps) * 100;
    
    // 진행 바 업데이트
    const progressFills = document.querySelectorAll('.progress-fill');
    progressFills.forEach(fill => {
        fill.style.width = `${progress}%`;
    });
    
    // 진행 텍스트 업데이트
    const progressTexts = document.querySelectorAll('.progress-text');
    progressTexts.forEach(text => {
        text.textContent = `${currentStep} / ${maxSteps} 단계`;
    });
}

function updateScoreDisplay() {
    console.log(`📊 점수 업데이트: 의도 ${intentScore}점, 품질 ${qualityScore}점`);
    
    // 의도 점수 표시
    const intentScoreElements = document.querySelectorAll('.intent-score-value');
    intentScoreElements.forEach(el => {
        if (el) el.textContent = intentScore;
    });
    
    // 품질 점수 표시
    const qualityScoreElements = document.querySelectorAll('.quality-score-value');
    qualityScoreElements.forEach(el => {
        if (el) el.textContent = qualityScore;
    });
    
    // 점수 바 업데이트
    const intentBar = document.querySelector('.intent-score-bar');
    if (intentBar) {
        intentBar.style.width = `${(intentScore / 100) * 100}%`;
        if (intentScore >= targetScore) {
            intentBar.classList.add('achieved');
        }
    }
    
    const qualityBar = document.querySelector('.quality-score-bar');
    if (qualityBar) {
        qualityBar.style.width = `${(qualityScore / 100) * 100}%`;
        if (qualityScore >= targetScore) {
            qualityBar.classList.add('achieved');
        }
    }
}

// =============================================================================
// 🌐 서버 API 통신
// =============================================================================

async function callAPI(step, data) {
    console.log('🌐 API 호출:', step, data);
    
    const requestBody = {
        step: step,
        userInput: data.userInput || originalUserInput,
        answers: data.answers || [],
        mode: isExpertMode ? 'expert' : 'normal',
        currentStep: data.currentStep || currentStep,
        timestamp: Date.now()
    };
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);
        
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
            throw new Error(`서버 오류 (${response.status}): ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('✅ API 응답:', result);
        return result;
        
    } catch (error) {
        console.error('❌ API 호출 실패:', error);
        
        if (error.name === 'AbortError') {
            throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.');
        } else {
            throw error;
        }
    }
}

// 답변 포매팅
function formatAnswersForAPI(answers) {
    const formatted = [];
    Object.entries(answers).forEach(([index, answer]) => {
        if (answer && answer.selected_option) {
            const questionIndex = parseInt(index);
            const question = currentQuestions[questionIndex]?.question || `질문 ${questionIndex + 1}`;
            
            let answerText = answer.selected_option;
            if (answer.custom_text && answer.custom_text.length > 0) {
                answerText += `: ${answer.custom_text}`;
            }
            
            formatted.push(`Q: ${question}\nA: ${answerText}`);
        }
    });
    return formatted;
}

// =============================================================================
// 🎛️ 모드 토글 및 기타 기능
// =============================================================================

function toggleMode() {
    console.log('🔄 모드 전환');
    
    isExpertMode = !isExpertMode;
    maxSteps = isExpertMode ? 20 : 3;
    
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
            description.textContent = `전문가급 의도 분석 시스템 (최대 ${maxSteps}단계 자동 개선)`;
        } else {
            description.textContent = `빠르고 간편한 프롬프트 개선 (${maxSteps}단계)`;
        }
    }
    
    console.log(`✅ 모드 변경: ${isExpertMode ? '전문가' : '일반'} (최대 ${maxSteps}단계)`);
    showStatus(`${isExpertMode ? '🎯 전문가' : '💨 일반'}모드로 변경되었습니다. (최대 ${maxSteps}단계)`, 'success');
}

// 초기화
function clearResults() {
    console.log('🗑️ 초기화');
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.classList.remove('error');
    }
    
    clearPreviousResults();
    originalUserInput = '';
    isProcessing = false;
    currentScore = 0;
    intentScore = 0;
    qualityScore = 0;
    currentStep = 1;
    allAnswers = [];
    
    updateProgressDisplay();
    updateScoreDisplay();
    
    showStatus('초기화가 완료되었습니다.', 'success');
    
    if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
    }
}

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
}

// =============================================================================
// 🛠️ 유틸리티 함수들
// =============================================================================

function showStatus(message, type = 'info') {
    console.log(`📢 상태 [${type}]:`, message);
    
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;
    
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    statusDiv.className = 'status-message';
    
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
    }
    
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

function animateScoreCounter(element, targetScore) {
    if (!element) return;
    
    let currentScore = 0;
    const increment = targetScore / 40;
    
    const animation = setInterval(() => {
        currentScore += increment;
        if (currentScore >= targetScore) {
            currentScore = targetScore;
            clearInterval(animation);
        }
        element.textContent = Math.round(currentScore);
    }, 25);
}

async function copyToClipboard() {
    const improvedText = document.getElementById('improvedText');
    if (!improvedText) {
        showStatus('복사할 텍스트를 찾을 수 없습니다.', 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(improvedText.textContent);
        showStatus('✅ 개선된 프롬프트가 클립보드에 복사되었습니다!', 'success');
    } catch (err) {
        console.error('❌ 클립보드 복사 실패:', err);
        showStatus('클립보드 복사에 실패했습니다.', 'error');
    }
}

function saveToFavorites() {
    const improvedText = document.getElementById('improvedText');
    if (!improvedText || !improvedText.textContent.trim()) {
        showStatus('저장할 프롬프트가 없습니다.', 'error');
        return;
    }
    
    const favoriteItem = {
        id: Date.now(),
        original: originalUserInput,
        improved: improvedText.textContent,
        score: currentScore,
        intentScore: intentScore,
        qualityScore: qualityScore,
        steps: currentStep,
        date: new Date().toLocaleDateString('ko-KR'),
        mode: isExpertMode ? '전문가' : '일반'
    };
    
    try {
        let favorites = JSON.parse(localStorage.getItem('prompt_favorites') || '[]');
        favorites.unshift(favoriteItem);
        
        if (favorites.length > 20) {
            favorites = favorites.slice(0, 20);
        }
        
        localStorage.setItem('prompt_favorites', JSON.stringify(favorites));
        showStatus('⭐ 즐겨찾기에 저장되었습니다!', 'success');
    } catch (e) {
        console.warn('❌ 즐겨찾기 저장 실패:', e);
        showStatus('즐겨찾기 저장에 실패했습니다.', 'error');
    }
}

function addToHistory(original, improved, score) {
    const historyItem = {
        id: Date.now(),
        original: original,
        improved: improved,
        score: score,
        intentScore: intentScore,
        qualityScore: qualityScore,
        mode: isExpertMode ? '전문가' : '일반',
        steps: currentStep,
        date: new Date().toLocaleDateString('ko-KR'),
        timestamp: Date.now()
    };
    
    try {
        let history = JSON.parse(localStorage.getItem('prompt_history') || '[]');
        history.unshift(historyItem);
        
        if (history.length > 50) {
            history = history.slice(0, 50);
        }
        
        localStorage.setItem('prompt_history', JSON.stringify(history));
    } catch (e) {
        console.warn('❌ 히스토리 저장 실패:', e);
    }
}

// =============================================================================
// 🎨 UI 초기화 함수들
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
        
        searchInput.addEventListener('input', function(e) {
            const value = e.target.value.trim();
            if (value.length > 0) {
                searchInput.classList.remove('error');
            }
        });
    }
}

function setupModalEvents() {
    window.onclick = function(event) {
        const modal = document.getElementById('guideModal');
        if (modal && event.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('guideModal');
            if (modal && modal.style.display === 'block') {
                modal.style.display = 'none';
            }
        }
    });
}

function showDetailedGuide() {
    const modal = document.getElementById('guideModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalBody) return;
    
    modalTitle.textContent = `📖 AI 프롬프트 개선기 사용법 - ${isExpertMode ? '🎯 전문가모드' : '💨 일반모드'}`;
    
    const guideContent = isExpertMode ? 
        `<div class="guide-section">
            <h3>🎯 전문가모드 특징</h3>
            <ul>
                <li><strong>최대 20단계</strong> 자동 반복 시스템</li>
                <li><strong>95점 목표</strong> - 완벽한 의도 파악</li>
                <li>단계별 진행 상황 실시간 표시</li>
                <li>의도 점수 + 품질 점수 2중 평가</li>
            </ul>
        </div>
        <div class="guide-section">
            <h3>🔄 자동 개선 프로세스</h3>
            <ol>
                <li><strong>1-3단계:</strong> 기본 정보 파악</li>
                <li><strong>4-10단계:</strong> 세부 디테일 확인</li>
                <li><strong>11-20단계:</strong> 초정밀 분석</li>
                <li><strong>95점 달성시:</strong> 자동 완료</li>
            </ol>
        </div>` :
        `<div class="guide-section">
            <h3>💨 일반모드 특징</h3>
            <ul>
                <li><strong>최대 3단계</strong>로 빠른 완성</li>
                <li>핵심 정보만 간단히 파악</li>
                <li>초보자 친화적 인터페이스</li>
                <li>5분 내 완료 목표</li>
            </ul>
        </div>`;
    
    modalBody.innerHTML = guideContent;
    modal.style.display = 'block';
}

function closeDetailedGuide() {
    const modal = document.getElementById('guideModal');
    if (modal) modal.style.display = 'none';
}

function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* 단계별 진행 상황 */
        .step-header {
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px 8px 0 0;
            margin-bottom: 20px;
        }
        
        .step-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .step-progress {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .progress-bar {
            flex: 1;
            height: 8px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: white;
            border-radius: 4px;
            transition: width 0.5s ease;
        }
        
        .progress-text {
            font-size: 14px;
            font-weight: 500;
            white-space: nowrap;
        }
        
        /* 질문 상태 */
        .question-item.answered {
            border-left: 4px solid #34a853;
            background-color: #f0f8f0;
        }
        
        .question-number {
            display: inline-block;
            background: #4285f4;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            margin-right: 10px;
        }
        
        /* 선택된 옵션 */
        .option-button.selected {
            background: #4285f4;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(66, 133, 244, 0.3);
        }
        
        /* 커스텀 입력 */
        .custom-input {
            margin-top: 15px;
            padding: 15px;
            background: #fff3e0;
            border-radius: 8px;
            border-left: 4px solid #fbbc04;
        }
        
        .custom-label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: #e37400;
            margin-bottom: 8px;
        }
        
        .custom-textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #fbbc04;
            border-radius: 4px;
            font-size: 14px;
            resize: vertical;
            min-height: 60px;
        }
        
        /* 액션 버튼 준비 상태 */
        .action-btn.proceed.ready {
            background: linear-gradient(135deg, #34a853 0%, #0f9d58 100%);
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        /* 점수 표시 */
        .step-info {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }
        
        .step-badge, .score-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }
        
        .score-badge.achieved {
            background: #34a853;
        }
        
        /* 점수 바 */
        .score-bars {
            display: flex;
            gap: 20px;
            margin: 20px 0;
        }
        
        .score-bar-container {
            flex: 1;
        }
        
        .score-bar-label {
            font-size: 12px;
            color: #5f6368;
            margin-bottom: 5px;
        }
        
        .score-bar-track {
            height: 20px;
            background: #e8eaed;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
        }
        
        .intent-score-bar, .quality-score-bar {
            height: 100%;
            background: linear-gradient(90deg, #ea4335 0%, #fbbc04 50%, #34a853 100%);
            border-radius: 10px;
            transition: width 0.5s ease;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 8px;
        }
        
        .score-bar-value {
            color: white;
            font-size: 11px;
            font-weight: bold;
        }
        
        /* 에러 상태 */
        .search-input.error {
            border-color: #ea4335 !important;
            box-shadow: 0 0 0 2px rgba(234, 67, 53, 0.2) !important;
        }
        
        /* 자동 진행 애니메이션 */
        .auto-processing {
            position: relative;
            overflow: hidden;
        }
        
        .auto-processing::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(66, 133, 244, 0.1), transparent);
            animation: autoScan 2s infinite;
        }
        
        @keyframes autoScan {
            0% { left: -100%; }
            100% { left: 100%; }
        }
    `;
    
    document.head.appendChild(style);
}
