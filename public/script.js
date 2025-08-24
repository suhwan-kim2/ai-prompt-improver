// script.js - 객관식 질문 + 자동 반복 개선 시스템 완성!

console.log('🚀 완전 수정된 script.js 로드!');

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
let currentRound = 1; // 라운드 추가
let maxRounds = 3; // 최대 라운드

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
    console.log('🎯 improvePrompt 실행!');
    
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
    currentRound = 1;
    
    showStatus('🤖 AI가 맞춤 질문을 생성하고 있습니다...', 'processing');
    
    // 서버에 요청
    callAPI('questions', { userInput: userInput })
        .then(result => {
            console.log('📨 서버 응답:', result);
            
            if (result.questions && result.questions.length > 0) {
                displayQuestions(result.questions);
                showStatus(`✨ ${currentRound}라운드 질문이 생성되었습니다! (${result.questions.length}개)`, 'success');
            } else {
                // 질문 없으면 바로 개선
                showStatus('질문 없이 바로 개선합니다...', 'processing');
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
                    options: ["이미지/그림", "텍스트/글", "코드/프로그램", "영상/음성", "기타"]
                },
                {
                    question: "사용 목적이 무엇인가요?",
                    options: ["개인 사용", "비즈니스", "교육/학습", "창작활동", "기타"]
                }
            ];
            displayQuestions(fallbackQuestions);
            showStatus('기본 질문으로 진행합니다.', 'success');
        })
        .finally(() => {
            isProcessing = false;
        });
}

// =============================================================================
// 📝 객관식 질문 시스템 (완전 새로 구현!)
// =============================================================================

function displayQuestions(questions) {
    console.log('📝 질문 표시:', questions);
    
    if (!Array.isArray(questions) || questions.length === 0) {
        console.error('❌ 유효하지 않은 질문 데이터');
        finalImprove();
        return;
    }
    
    // 객관식/주관식 형태 자동 판별
    const processedQuestions = questions.map((q, index) => {
        if (typeof q === 'string') {
            // 기존 주관식 형태 → 객관식으로 변환
            return {
                id: index,
                question: q,
                options: ["예", "아니오", "모르겠음", "기타"],
                type: 'multiple_choice'
            };
        } else if (q.question && q.options) {
            // 이미 객관식 형태
            return {
                id: index,
                question: q.question,
                options: q.options,
                type: 'multiple_choice'
            };
        } else {
            console.warn('⚠️ 알 수 없는 질문 형태:', q);
            return {
                id: index,
                question: String(q),
                options: ["예", "아니오", "기타"],
                type: 'multiple_choice'
            };
        }
    });
    
    currentQuestions = processedQuestions;
    
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const questionsContainer = document.getElementById('questionsContainer');
    
    if (!questionsContainer || !aiQuestionsDiv) {
        console.error('❌ 질문 컨테이너를 찾을 수 없습니다');
        return;
    }
    
    let questionsHTML = '<div class="questions-round">';
    questionsHTML += `<div class="round-title">🎯 ${currentRound}라운드 질문 ${isExpertMode ? '(전문가모드)' : '(일반모드)'}</div>`;
    
    processedQuestions.forEach((questionData, index) => {
        const escapedQuestion = escapeHtml(questionData.question);
        questionsHTML += `
            <div class="question-item" id="question-${index}">
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
            <div class="request-input" id="custom-input-${index}" style="display: none;">
                <label class="request-label">구체적으로 어떤 내용인가요?</label>
                <textarea class="request-textarea" 
                          placeholder="자세히 설명해주세요..."
                          oninput="saveCustomAnswer(${index}, this.value)"
                          rows="3"></textarea>
            </div>
        `;
        
        questionsHTML += '</div>';
    });
    
    questionsHTML += `
        <div class="questions-actions">
            <button onclick="proceedWithAnswers()" class="action-btn proceed">
                ✨ 답변 완료 - 프롬프트 개선하기
            </button>
            <button onclick="skipQuestions()" class="action-btn skip">
                ⏭️ 질문 건너뛰기
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

// 객관식 선택지 클릭 처리
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
    
    // 질문 완료 상태 업데이트
    updateQuestionStatus(questionIndex);
}

// "기타" 선택시 커스텀 답변 저장
function saveCustomAnswer(questionIndex, customText) {
    console.log(`✏️ 커스텀 답변: 질문${questionIndex}, 텍스트: "${customText}"`);
    
    if (currentAnswers[questionIndex]) {
        currentAnswers[questionIndex].custom_text = customText.trim();
    }
    
    updateQuestionStatus(questionIndex);
}

// 질문 답변 상태 업데이트
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
}

// =============================================================================
// 🎯 최종 프롬프트 개선 (자동 반복 로직 추가!)
// =============================================================================

async function finalImprove() {
    console.log('🎯 최종 프롬프트 개선 시작 (라운드:', currentRound, ')');
    
    try {
        showStatus('🤖 AI가 프롬프트를 개선하고 있습니다...', 'processing');
        
        // 답변을 API 형태로 변환
        const formattedAnswers = formatAnswersForAPI(currentAnswers);
        
        console.log('📤 전송할 답변:', formattedAnswers);
        
        const result = await callAPI('final-improve', {
            userInput: originalUserInput,
            answers: formattedAnswers,
            analysis: analysisData,
            round: currentRound
        });
        
        console.log('📨 최종 개선 결과:', result);
        
        // 결과 처리
        let improvedPrompt = result.improved_prompt || result;
        let score = result.score || calculateFallbackScore(improvedPrompt, originalUserInput);
        let improvements = result.improvements || [];
        
        // 결과 표시
        displayResult(originalUserInput, improvedPrompt);
        showScoreImprovement(score, improvements);
        
        // ⭐ 핵심: 점수 체크 후 자동 반복 로직
        if (isExpertMode && score < 90 && currentRound < maxRounds) {
            console.log(`🔄 점수 ${score}점으로 90점 미만! 라운드 ${currentRound + 1} 자동 시작`);
            
            // 2초 후 자동으로 추가 질문 요청
            setTimeout(() => {
                autoRequestNextRound(score);
            }, 2000);
            
            showStatus(`현재 ${score}점입니다. 더 높은 점수를 위해 ${currentRound + 1}라운드를 자동 시작합니다...`, 'processing');
        } else {
            // 개선 완료
            if (score >= 90) {
                showStatus(`🎉 목표 달성! ${score}점의 고품질 프롬프트가 완성되었습니다!`, 'success');
            } else {
                showStatus(`프롬프트 개선이 완료되었습니다. (${score}점)`, 'success');
            }
        }
        
        // 히스토리에 저장
        addToHistory(originalUserInput, improvedPrompt, score);
        
    } catch (error) {
        console.error('❌ 최종 개선 오류:', error);
        
        // 폴백 개선
        try {
            const fallbackPrompt = originalUserInput + '\n\n고품질로 상세하게 제작해주세요.';
            const fallbackScore = calculateFallbackScore(fallbackPrompt, originalUserInput);
            
            displayResult(originalUserInput, fallbackPrompt);
            showScoreImprovement(fallbackScore, ['기본 품질 향상']);
            showStatus('기본 개선 시스템으로 처리되었습니다.', 'success');
        } catch (fallbackError) {
            console.error('❌ 폴백 개선 실패:', fallbackError);
            showStatus('프롬프트 개선 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    }
}

// 🔄 자동 다음 라운드 요청
async function autoRequestNextRound(currentScore) {
    console.log(`🔄 자동 라운드 ${currentRound + 1} 시작 (현재 점수: ${currentScore})`);
    
    if (isProcessing) return;
    
    currentRound++;
    isProcessing = true;
    
    try {
        showStatus(`🎯 ${currentRound}라운드: 더 정확한 분석을 위한 추가 질문을 생성합니다...`, 'processing');
        
        const result = await callAPI('additional-questions', {
            userInput: originalUserInput,
            answers: formatAnswersForAPI(currentAnswers),
            current_score: currentScore,
            round: currentRound
        });
        
        if (result.questions && result.questions.length > 0) {
            // 기존 답변 유지하고 새 질문 표시
            displayQuestions(result.questions);
            showStatus(`🚀 ${currentRound}라운드 질문이 생성되었습니다! (${result.questions.length}개)`, 'success');
        } else {
            // 추가 질문 없으면 현재 결과로 완료
            showStatus('더 이상 개선할 부분이 없습니다. 현재 결과로 완료합니다.', 'success');
        }
        
    } catch (error) {
        console.error(`❌ 라운드 ${currentRound} 오류:`, error);
        showStatus(`라운드 ${currentRound} 처리 중 오류: ${error.message}`, 'error');
    } finally {
        isProcessing = false;
    }
}

// 수동 추가 질문 요청 (기존 함수 개선)
async function requestAdditionalQuestions() {
    console.log('📝 수동 추가 질문 요청');
    
    if (isProcessing) {
        showStatus('이미 처리 중입니다.', 'error');
        return;
    }
    
    currentRound++;
    await autoRequestNextRound(currentScore);
}

// =============================================================================
// 🎨 결과 표시 및 상태 관리
// =============================================================================

async function proceedWithAnswers() {
    console.log('✅ 답변으로 진행:', currentAnswers);
    
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
        showStatus(`✨ ${validAnswers.length}개 답변을 바탕으로 프롬프트를 개선합니다...`, 'processing');
        await finalImprove();
    } catch (error) {
        console.error('❌ 답변 처리 오류:', error);
        showStatus('답변 처리 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

async function skipQuestions() {
    console.log('⏭️ 질문 건너뛰기');
    
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus('질문을 건너뛰고 바로 개선합니다...', 'processing');
        currentAnswers = {};
        await finalImprove();
    } catch (error) {
        console.error('❌ 질문 건너뛰기 오류:', error);
        showStatus('처리 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 답변을 API 형태로 변환
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
// 🌐 서버 API 통신
// =============================================================================

async function callAPI(step, data) {
    console.log('🌐 API 호출:', step, data);
    
    const requestBody = {
        step: step,
        userInput: data.userInput || originalUserInput,
        answers: data.answers || [],
        mode: isExpertMode ? 'expert' : 'normal',
        round: data.round || currentRound,
        current_score: data.current_score || currentScore,
        timestamp: Date.now()
    };
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000); // 35초 타임아웃
        
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
        console.log('✅ API 응답 성공:', result);
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

// =============================================================================
// 🎛️ 기타 기능들 (모드 토글, 초기화 등)
// =============================================================================

// 모드 토글 함수
function toggleMode() {
    console.log('🔄 toggleMode 실행!');
    
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
            description.textContent = '전문가급 의도 분석 시스템 (최대 3라운드 자동 개선)';
        } else {
            description.textContent = '빠르고 간편한 프롬프트 개선 (1회 질문)';
        }
    }
    
    console.log('✅ 모드 변경:', isExpertMode ? '전문가' : '일반');
    showStatus(`${isExpertMode ? '🎯 전문가' : '💨 일반'}모드로 변경되었습니다.`, 'success');
}

// 결과 초기화 함수
function clearResults() {
    console.log('🗑️ clearResults 실행!');
    
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
    currentRound = 1;
    
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
    analysisData = null;
}

// =============================================================================
// 📊 결과 표시 시스템
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
        // 결과 영역으로 스크롤
        improvedResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function showScoreImprovement(score, improvements = []) {
    console.log('📊 점수 표시:', score, improvements);
    
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
    
    currentScore = score;
}

// =============================================================================
// 🛠️ 유틸리티 함수들
// =============================================================================

function calculateFallbackScore(improvedPrompt, originalPrompt) {
    let score = 35; // 기본 점수 상향
    
    // 길이 개선도
    const lengthRatio = improvedPrompt.length / originalPrompt.length;
    if (lengthRatio > 1.2 && lengthRatio < 4) {
        score += Math.min(25, (lengthRatio - 1) * 20);
    }
    
    // 구체성 점수
    const numbers = (improvedPrompt.match(/\d+/g) || []).length;
    const units = (improvedPrompt.match(/(px|cm|초|분|개|명|k|hd|4k|mb|gb)/gi) || []).length;
    const specifics = (improvedPrompt.match(/(스타일|색상|크기|형식|방식|목적)/gi) || []).length;
    
    score += Math.min(30, (numbers * 4) + (units * 5) + (specifics * 3));
    
    // 답변 반영 보너스
    const answerCount = Object.keys(currentAnswers).length;
    score += Math.min(15, answerCount * 3);
    
    // 라운드 보너스 (여러 라운드 거칠수록 높은 점수)
    score += Math.min(10, currentRound * 3);
    
    return Math.min(95, Math.round(score));
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

// 클립보드 복사
async function copyToClipboard() {
    console.log('📋 클립보드 복사');
    
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
            showStatus('✅ 개선된 프롬프트가 클립보드에 복사되었습니다!', 'success');
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
                showStatus('✅ 개선된 프롬프트가 복사되었습니다!', 'success');
            } else {
                throw new Error('복사 실패');
            }
        }
    } catch (err) {
        console.error('❌ 클립보드 복사 실패:', err);
        showStatus('클립보드 복사에 실패했습니다.', 'error');
    }
}

// 즐겨찾기 저장 (새로운 기능)
function saveToFavorites() {
    console.log('⭐ 즐겨찾기 저장');
    
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
        date: new Date().toLocaleDateString('ko-KR'),
        mode: isExpertMode ? '전문가' : '일반'
    };
    
    try {
        let favorites = JSON.parse(localStorage.getItem('prompt_favorites') || '[]');
        favorites.unshift(favoriteItem);
        
        // 최대 20개로 제한
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

// 현재 결과 수락 (점수 낮아도 완료)
function acceptCurrentResult() {
    console.log('✅ 현재 결과 수락');
    
    const scoreSection = document.getElementById('scoreImprovement');
    if (scoreSection) scoreSection.style.display = 'none';
    
    showStatus(`현재 결과로 완료되었습니다. (${currentScore}점)`, 'success');
}

function addToHistory(original, improved, score) {
    const historyItem = {
        id: Date.now(),
        original: original,
        improved: improved,
        score: score,
        mode: isExpertMode ? '전문가' : '일반',
        round: currentRound,
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
        console.warn('❌ 히스토리 저장 실패:', e);
    }
}

// =============================================================================
// 🎨 UI 헬퍼 함수들
// =============================================================================

function showStatus(message, type = 'info') {
    console.log(`📢 상태 [${type}]:`, message);
    
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
        // Enter 키 처리 (Shift+Enter는 줄바꿈)
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
    
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('guideModal');
            if (modal && modal.style.display === 'block') {
                modal.style.display = 'none';
            }
        }
    });
}

// =============================================================================
// 📖 가이드 모달 시스템
// =============================================================================

function showDetailedGuide() {
    console.log('📖 showDetailedGuide 실행!');
    
    const modal = document.getElementById('guideModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalBody) {
        showStatus('가이드 모달을 찾을 수 없습니다.', 'error');
        return;
    }
    
    modalTitle.textContent = '📖 AI 프롬프트 개선기 사용법 - ' + (isExpertMode ? '🎯 전문가모드' : '💨 일반모드');
    
    const guideContent = isExpertMode ? getExpertModeGuide() : getNormalModeGuide();
    modalBody.innerHTML = guideContent;
    
    modal.style.display = 'block';
    
    const closeButton = modal.querySelector('.modal-close');
    if (closeButton) closeButton.focus();
}

function closeDetailedGuide() {
    console.log('❌ closeDetailedGuide 실행!');
    
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function getNormalModeGuide() {
    return `
        <div class="guide-section">
            <h3>💨 일반모드 특징</h3>
            <ul>
                <li>빠르고 간편한 1회 질문 시스템</li>
                <li>기본적인 프롬프트 개선 (70-85점 목표)</li>
                <li>초보자에게 최적화된 간단한 프로세스</li>
                <li>객관식 선택지로 쉽고 빠른 답변</li>
            </ul>
        </div>
        
        <div class="guide-section">
            <h3>📝 사용 방법</h3>
            <ol>
                <li><strong>프롬프트 입력:</strong> 하고 싶은 일을 한글로 간단히 입력</li>
                <li><strong>객관식 답변:</strong> AI 질문에 선택지 클릭으로 답변</li>
                <li><strong>즉시 완성:</strong> 개선된 프롬프트 바로 확인</li>
            </ol>
        </div>
        
        <div class="guide-section">
            <h3>💡 입력 예시</h3>
            <div class="example-box">
                <strong>좋은 예:</strong><br>
                "유튜브 썸네일 만들어줘"<br>
                "인스타 스토리용 이미지"<br>
                "회사 발표 PPT 템플릿"
            </div>
        </div>
    `;
}

function getExpertModeGuide() {
    return `
        <div class="guide-section">
            <h3>🎯 전문가모드 특징</h3>
            <ul>
                <li><strong>3라운드 자동 반복 시스템</strong></li>
                <li>90점 미만 시 자동으로 추가 질문 생성</li>
                <li>최종 95점+ 고품질 프롬프트 보장</li>
                <li>복잡한 요구사항도 완벽 분석</li>
            </ul>
        </div>
        
        <div class="guide-section">
            <h3>🔄 자동 개선 프로세스</h3>
            <ol>
                <li><strong>1라운드:</strong> 기본 의도 파악 질문</li>
                <li><strong>점수 체크:</strong> 90점 미만시 2라운드 자동 시작</li>
                <li><strong>2라운드:</strong> 심화 분석 질문</li>
                <li><strong>점수 체크:</strong> 90점 미만시 3라운드 자동 시작</li>
                <li><strong>3라운드:</strong> 최종 완성도 극대화</li>
                <li><strong>완성:</strong> 95점+ 전문가급 프롬프트</li>
            </ol>
        </div>
        
        <div class="guide-section">
            <h3>⚡ 전문가모드 장점</h3>
            <ul>
                <li><strong>자동화:</strong> 사용자가 계속 클릭할 필요 없음</li>
                <li><strong>품질 보장:</strong> 목표 점수 달성까지 자동 반복</li>
                <li><strong>완전 분석:</strong> 숨겨진 의도까지 파악</li>
                <li><strong>전문가급:</strong> 실제 업무에 바로 사용 가능</li>
            </ul>
        </div>
    `;
}

function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* 객관식 선택지 추가 스타일 */
        .question-item.answered {
            border-left: 4px solid #34a853;
            background-color: #f0f8f0;
        }
        
        .option-button.selected {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(66, 133, 244, 0.3);
        }
        
        .search-input.error {
            border-color: #ea4335 !important;
            box-shadow: 0 0 0 2px rgba(234, 67, 53, 0.2) !important;
        }
        
        /* 라운드 표시 스타일 */
        .round-title {
            position: relative;
        }
        
        .round-title::before {
            content: '';
            position: absolute;
            left: -4px;
            top: 0;
            bottom: 0;
            width: 4px;
            background: #4285f4;
            border-radius: 2px;
        }
        
        /* 자동 처리 중 애니메이션 */
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
        
        /* 점수 개선 애니메이션 */
        .score-improving {
            animation: scoreGlow 1s ease-in-out infinite alternate;
        }
        
        @keyframes scoreGlow {
            from { box-shadow: 0 0 5px rgba(66, 133, 244, 0.3); }
            to { box-shadow: 0 0 20px rgba(66, 133, 244, 0.6); }
        }
    `;
    
    document.head.appendChild(style);
}

// =============================================================================
// 🔧 전역 오류 처리
// =============================================================================

window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('🚨 전역 오류:', { msg, url, lineNo, columnNo, error });
    showStatus('예상치 못한 오류가 발생했습니다.', 'error');
    isProcessing = false; // 처리 상태 해제
    return false;
};

window.addEventListener('unhandledrejection', function(event) {
    console.error('🚨 Promise 거부:', event.reason);
    showStatus('비동기 작업 중 오류가 발생했습니다.', 'error');
    isProcessing = false; // 처리 상태 해제
    event.preventDefault();
});

// =============================================================================
// 🐛 디버깅 및 개발자 도구
// =============================================================================

// 디버깅용 전역 함수
window.debugInfo = function() {
    console.log('=== 🐛 디버그 정보 ===');
    console.log('전문가 모드:', isExpertMode);
    console.log('현재 라운드:', currentRound, '/', maxRounds);
    console.log('현재 질문들:', currentQuestions);
    console.log('현재 답변들:', currentAnswers);
    console.log('원본 입력:', originalUserInput);
    console.log('처리 중:', isProcessing);
    console.log('현재 점수:', currentScore);
    console.log('히스토리 개수:', promptHistory.length);
    console.log('==================');
};

// 강제 초기화 함수 (디버깅용)
window.forceReset = function() {
    console.log('🔄 강제 초기화 실행');
    isProcessing = false;
    currentRound = 1;
    clearResults();
    showStatus('강제 초기화 완료', 'success');
};

// 테스트 함수 (개발용)
window.testMode = function() {
    console.log('🧪 테스트 모드 실행');
    
    const testInput = "유튜브 썸네일 만들어줘";
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = testInput;
        improvePrompt();
    }
};

// =============================================================================
// ✅ 스크립트 로드 완료 확인
// =============================================================================

console.log('🎉 완전 수정된 script.js 로드 완료!');
console.log('📋 사용 가능한 주요 함수들:', {
    improvePrompt: typeof improvePrompt,
    displayQuestions: typeof displayQuestions,
    selectOption: typeof selectOption,
    autoRequestNextRound: typeof autoRequestNextRound,
    toggleMode: typeof toggleMode,
    clearResults: typeof clearResults,
    showDetailedGuide: typeof showDetailedGuide,
    copyToClipboard: typeof copyToClipboard
});

console.log('🎯 새로운 기능들:');
console.log('- ✅ 객관식 질문 처리');
console.log('- ✅ 자동 반복 개선 (90점 미만시)');
console.log('- ✅ 라운드 시스템 (최대 3라운드)');
console.log('- ✅ 전문가모드 완전 지원');
console.log('- ✅ 폴백 시스템 강화');

// 페이지 로드시 히스토리 복원
document.addEventListener('DOMContentLoaded', function() {
    try {
        const savedHistory = localStorage.getItem('prompt_history');
        if (savedHistory) {
            promptHistory = JSON.parse(savedHistory);
            console.log('📚 히스토리 복원됨:', promptHistory.length, '개');
        }
    } catch (e) {
        console.warn('⚠️ 히스토리 복원 실패:', e);
        promptHistory = [];
    }
});
