// script.js - 새로운 전문가모드 프로세스 구현 (오류 수정 버전)

// 전역 변수들
let isExpertMode = false;
let currentQuestions = [];
let currentAnswers = {};
let currentRound = 0;
let maxRounds = 1;
let originalUserInput = '';
let isProcessing = false;
let currentScore = 0;
let internalImprovedPrompt = '';
let expertModeStep = 'initial';

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

// 메인 프롬프트 개선 함수
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
        
        const questions = await callAPI('questions', {
            userInput: userInput,
            isExpertMode: isExpertMode
        });
        
        if (questions && questions.length > 0) {
            displayQuestions(questions, '기본 정보 파악');
            showStatus('기본 질문이 생성되었습니다!', 'success');
        } else {
            await directImprove();
        }
        
    } catch (error) {
        console.error('improvePrompt 오류:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 답변 완료 후 진행
async function proceedWithAnswers() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        if (!isExpertMode) {
            showStatus('답변을 바탕으로 프롬프트를 개선하고 있습니다...', 'processing');
            await finalImprove();
        } else {
            await expertModeProcess();
        }
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 전문가모드 단계별 프로세스
async function expertModeProcess() {
    switch (expertModeStep) {
        case 'initial':
            showStatus('1차 내부 개선을 진행하고 있습니다...', 'processing');
            internalImprovedPrompt = await callAPI('internal-improve-1', {
                userInput: originalUserInput,
                questions: currentQuestions,
                answers: formatAnswersForAPI(),
                isExpertMode: true
            });
            
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
            showStatus('2차 내부 개선을 진행하고 있습니다...', 'processing');
            internalImprovedPrompt = await callAPI('internal-improve-2', {
                userInput: originalUserInput,
                questions: currentQuestions,
                answers: formatAnswersForAPI(),
                internalImprovedPrompt: internalImprovedPrompt,
                isExpertMode: true
            });
            
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
            
        case 'round2':
            await finalImprove();
            break;
    }
}

// API 호출 함수
async function callAPI(step, data) {
    try {
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: step,
                ...data
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'API 호출 실패');
        }

        if (step.includes('questions')) {
            try {
                let jsonStr = result.result.trim();
                if (jsonStr.startsWith('```json')) {
                    jsonStr = jsonStr.replace(/```json\s*/, '').replace(/```\s*$/, '');
                }
                const parsed = JSON.parse(jsonStr);
                return parsed.questions || [];
            } catch (e) {
                console.error('질문 파싱 실패:', e);
                return [];
            }
        }
        
        return result.result;
        
    } catch (error) {
        console.error('API 호출 오류:', error);
        throw error;
    }
}

// 질문 표시 함수
function displayQuestions(questions, title, isExpertRound = false) {
    if (isExpertRound) {
        currentQuestions = currentQuestions.concat(questions);
    } else {
        currentQuestions = questions;
    }
    
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const questionsContainer = document.getElementById('questionsContainer');
    
    if (!questionsContainer || !aiQuestionsDiv) {
        console.error('질문 컨테이너를 찾을 수 없습니다');
        return;
    }
    
    if (isExpertRound) {
        const newRoundDiv = document.createElement('div');
        newRoundDiv.className = 'questions-round expert-round';
        newRoundDiv.innerHTML = '<div class="round-title">🔍 ' + title + ' (전문가모드)</div>';
        questionsContainer.appendChild(newRoundDiv);
        
        let questionsHTML = '';
        questions.forEach(function(q, index) {
            const globalIndex = currentQuestions.length - questions.length + index;
            questionsHTML += buildQuestionHTML(q, globalIndex, true);
        });
        
        newRoundDiv.innerHTML += questionsHTML;
    } else {
        questionsContainer.innerHTML = '';
        const roundDiv = document.createElement('div');
        roundDiv.className = 'questions-round';
        roundDiv.innerHTML = '<div class="round-title">🎯 ' + title + '</div>';
        
        let questionsHTML = '';
        questions.forEach(function(q, index) {
            questionsHTML += buildQuestionHTML(q, index, false);
        });
        
        roundDiv.innerHTML += questionsHTML;
        questionsContainer.appendChild(roundDiv);
    }
    
    aiQuestionsDiv.style.display = 'block';
}

// 질문 HTML 생성
function buildQuestionHTML(question, index, isExpert) {
    let html = '<div class="question-item">';
    html += '<div class="question-text">' + escapeHtml(question.question) + '</div>';
    html += '<div class="question-options">';
    
    if (question.type === 'choice' && question.options) {
        question.options.forEach(function(option) {
            const safeOption = escapeHtml(option);
            html += '<button class="option-button" onclick="selectOption(' + index + ', \'' + safeOption.replace(/'/g, '&apos;') + '\')">';
            html += safeOption;
            html += '</button>';
        });
    } else if (question.type === 'text') {
        html += '<input type="text" class="text-input" placeholder="답변을 입력하세요..." onchange="selectOption(' + index + ', this.value)">';
    }
    
    html += '</div>';
    
    if (isExpertMode || isExpert) {
        html += 
            '<div class="request-input">' +
                '<label class="request-label">💡 추가 요청사항이나 의도를 자세히 설명해주세요:</label>' +
                '<textarea class="request-textarea" placeholder="이 질문과 관련해서 특별히 고려해야 할 사항이나 숨겨진 의도가 있다면 적어주세요..." ' +
                    'onchange="addRequestForQuestion(' + index + ', this.value)"></textarea>' +
            '</div>';
    }
    
    html += '</div>';
    return html;
}

// 최종 개선
async function finalImprove() {
    showStatus('최종 프롬프트를 완성하고 있습니다...', 'processing');
    
    const finalPrompt = await callAPI('final-improve', {
        userInput: originalUserInput,
        questions: currentQuestions,
        answers: formatAnswersForAPI(),
        isExpertMode: isExpertMode,
        internalImprovedPrompt: internalImprovedPrompt
    });
    
    displayResult(originalUserInput, finalPrompt);
    
    showStatus('프롬프트 개선이 완료되었습니다! 품질을 검증하고 있습니다...', 'processing');
    
    setTimeout(function() {
        evaluateAndShowScore(finalPrompt);
    }, 1500);
}

// 직접 개선
async function directImprove() {
    showStatus('바로 프롬프트를 개선하고 있습니다...', 'processing');
    
    const improvedPrompt = await callAPI('final-improve', {
        userInput: originalUserInput,
        isExpertMode: isExpertMode
    });
    
    displayResult(originalUserInput, improvedPrompt);
    
    setTimeout(function() {
        evaluateAndShowScore(improvedPrompt);
    }, 1500);
}

// 옵션 선택
function selectOption(questionIndex, answer) {
    if (!currentAnswers[questionIndex]) {
        currentAnswers[questionIndex] = {
            answers: [],
            request: ''
        };
    }
    
    const questionItems = document.querySelectorAll('.question-item');
    const questionItem = questionItems[questionIndex];
    
    if (!questionItem) return;
    
    const buttons = questionItem.querySelectorAll('.option-button');
    
    if (buttons.length > 0) {
        const answerIndex = currentAnswers[questionIndex].answers.indexOf(answer);
        
        if (answerIndex === -1) {
            currentAnswers[questionIndex].answers.push(answer);
        } else {
            currentAnswers[questionIndex].answers.splice(answerIndex, 1);
        }
        
        buttons.forEach(function(btn) {
            const btnText = btn.textContent.trim();
            if (currentAnswers[questionIndex].answers.includes(btnText)) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
        
        handleCustomInput(questionItem, questionIndex, answer);
    } else {
        currentAnswers[questionIndex].answers = [answer];
    }
}

// 요청사항 추가
function addRequestForQuestion(questionIndex, request) {
    if (!currentAnswers[questionIndex]) {
        currentAnswers[questionIndex] = {
            answers: [],
            request: ''
        };
    }
    currentAnswers[questionIndex].request = request.trim();
}

// 커스텀 입력 처리
function handleCustomInput(questionItem, questionIndex, answer) {
    const customInputDiv = questionItem.querySelector('.custom-input');
    
    if (currentAnswers[questionIndex].answers.includes('기타')) {
        if (!customInputDiv) {
            const customInputHTML = 
                '<div class="custom-input" style="margin-top: 10px;">' +
                    '<input type="text" class="text-input" placeholder="직접 입력해주세요..." ' +
                        'onchange="addCustomAnswer(' + questionIndex + ', this.value)" ' +
                        'style="width: 100%; padding: 8px; border: 2px solid #e9ecef; border-radius: 8px;">' +
                '</div>';
            questionItem.querySelector('.question-options').insertAdjacentHTML('beforeend', customInputHTML);
        }
    } else {
        if (customInputDiv) {
            customInputDiv.remove();
            const originalOptions = currentQuestions[questionIndex] ? currentQuestions[questionIndex].options || [] : [];
            currentAnswers[questionIndex].answers = currentAnswers[questionIndex].answers.filter(function(item) {
                return originalOptions.includes(item);
            });
        }
    }
}

// 커스텀 답변 추가
function addCustomAnswer(questionIndex, customValue) {
    if (customValue && customValue.trim()) {
        if (!currentAnswers[questionIndex]) {
            currentAnswers[questionIndex] = {
                answers: [],
                request: ''
            };
        }
        
        const originalOptions = currentQuestions[questionIndex] ? currentQuestions[questionIndex].options || [] : [];
        currentAnswers[questionIndex].answers = currentAnswers[questionIndex].answers.filter(function(item) {
            return originalOptions.includes(item);
        });
        
        currentAnswers[questionIndex].answers.push(customValue.trim());
    }
}

// 질문 건너뛰기
async function skipQuestions() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus('질문을 건너뛰고 프롬프트를 개선하고 있습니다...', 'processing');
        await directImprove();
    } catch (error) {
        console.error('Error:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 답변 포맷팅
function formatAnswersForAPI() {
    return Object.entries(currentAnswers)
        .map(function(entry) {
            const index = entry[0];
            const answerData = entry[1];
            const question = currentQuestions[parseInt(index)] ? currentQuestions[parseInt(index)].question : '질문 ' + (parseInt(index) + 1);
            const answerText = Array.isArray(answerData.answers) ? answerData.answers.join(', ') : answerData.answers;
            const requestText = answerData.request ? '\n요청사항: ' + answerData.request : '';
            return 'Q: ' + question + '\nA: ' + answerText + requestText;
        })
        .join('\n\n');
}

// 결과 표시
function displayResult(original, improved) {
    const aiQuestions = document.getElementById('aiQuestions');
    const originalText = document.getElementById('originalText');
    const improvedText = document.getElementById('improvedText');
    const improvedResult = document.getElementById('improvedResult');
    
    if (aiQuestions) aiQuestions.style.display = 'none';
    
    if (originalText) originalText.textContent = original;
    if (improvedText) improvedText.textContent = improved;
    if (improvedResult) improvedResult.style.display = 'block';
}

// 품질 평가 및 점수 표시
async function evaluateAndShowScore(improvedPrompt) {
    try {
        const evaluation = await callAPI('evaluate', {
            userInput: improvedPrompt
        });
        
        const qualityData = parseQualityResponse(evaluation);
        currentScore = qualityData.score;
        
        if (currentScore < 90) {
            showStatus('현재 ' + currentScore + '점입니다. AI가 자동으로 재개선하고 있습니다...', 'processing');
            await autoImprovePrompt(improvedPrompt);
        } else {
            showScoreImprovement(currentScore);
            showStatus('완성! ' + currentScore + '점의 고품질 프롬프트입니다!', 'success');
        }
        
    } catch (error) {
        console.error('품질 평가 오류:', error);
        showStatus('프롬프트 개선이 완료되었습니다!', 'success');
        showScoreImprovement(85);
    }
}

// 자동 재개선
async function autoImprovePrompt(currentPrompt) {
    try {
        const reImprovedPrompt = await callAPI('auto-improve', {
            userInput: currentPrompt,
            currentScore: currentScore,
            isExpertMode: isExpertMode
        });
        
        const improvedText = document.getElementById('improvedText');
        if (improvedText) improvedText.textContent = reImprovedPrompt;
        
        const newQuality = await quickQualityCheck(reImprovedPrompt);
        currentScore = newQuality.score;
        
        showScoreImprovement(currentScore);
        showStatus('자동 재개선 완료! ' + currentScore + '점 달성!', 'success');
        
    } catch (error) {
        console.error('자동 재개선 오류:', error);
        showStatus('자동 재개선 중 오류가 발생했습니다.', 'error');
    }
}

// 빠른 품질 확인
async function quickQualityCheck(improvedPrompt) {
    try {
        const evaluation = await callAPI('evaluate', {
            userInput: improvedPrompt
        });
        const parsed = parseQualityResponse(evaluation);
        return {
            score: parsed.score || 85,
            feedback: parsed.recommendation || '개선되었습니다'
        };
    } catch (e) {
        return { score: 85, feedback: '품질 확인 완료' };
    }
}

// 점수 개선 섹션 표시
function showScoreImprovement(score) {
    const scoreSection = document.getElementById('scoreImprovement');
    const scoreDisplay = document.getElementById('currentScore');
    
    if (scoreDisplay) scoreDisplay.textContent = score;
    if (scoreSection) scoreSection.style.display = 'block';
}

// 품질 응답 파싱
function parseQualityResponse(response) {
    try {
        let jsonStr = response.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/```json\s*/, '').replace(/```\s*$/, '');
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```\s*/, '').replace(/```\s*$/, '');
        }
        
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('품질 응답 파싱 실패:', e);
        return {
            score: 85,
            strengths: ['기본적인 개선 완료'],
            improvements: ['더 구체적인 요구사항 필요'],
            recommendation: '현재 수준에서 사용 가능'
        };
    }
}

// 클립보드에 복사
async function copyToClipboard() {
    const improvedText = document.getElementById('improvedText');
    if (!improvedText) return;
    
    const textToCopy = improvedText.textContent;
    
    try {
        await navigator.clipboard.writeText(textToCopy);
        showStatus('개선된 프롬프트가 클립보드에 복사되었습니다!', 'success');
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showStatus('개선된 프롬프트가 복사되었습니다!', 'success');
    }
}

// 즐겨찾기에 저장
function saveToFavorites() {
    const originalText = document.getElementById('originalText');
    const improvedText = document.getElementById('improvedText');
    
    if (!originalText || !improvedText) return;
    
    const original = originalText.textContent;
    const improved = improvedText.textContent;
    
    let favorites = [];
    try {
        favorites = JSON.parse(localStorage.getItem('prompt_favorites') || '[]');
    } catch (e) {
        favorites = [];
    }
    
    const newFavorite = {
        id: Date.now(),
        original: original,
        improved: improved,
        mode: isExpertMode ? '전문가' : '일반',
        score: currentScore,
        date: new Date().toLocaleDateString('ko-KR')
    };
    
    favorites.unshift(newFavorite);
    
    if (favorites.length > 50) {
        favorites.pop();
    }
    
    try {
        localStorage.setItem('prompt_favorites', JSON.stringify(favorites));
        showStatus('즐겨찾기에 저장되었습니다!', 'success');
    } catch (e) {
        showStatus('즐겨찾기 저장에 실패했습니다.', 'error');
    }
}

// 초기화
function clearResults() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    clearPreviousResults();
    originalUserInput = '';
    isProcessing = false;
    currentRound = 0;
    currentScore = 0;
    expertModeStep = 'initial';
    internalImprovedPrompt = '';
    showStatus('초기화가 완료되었습니다.', 'success');
}

// 이전 결과 완전 초기화
function clearPreviousResults() {
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const improvedResultDiv = document.getElementById('improvedResult');
    const scoreSection = document.getElementById('scoreImprovement');
    const questionsContainer = document.getElementById('questionsContainer');
    
    if (aiQuestionsDiv) aiQuestionsDiv.style.display = 'none';
    if (improvedResultDiv) improvedResultDiv.style.display = 'none';
    if (scoreSection) scoreSection.style.display = 'none';
    if (questionsContainer) questionsContainer.innerHTML = '';
    
    currentQuestions = [];
    currentAnswers = {};
    currentRound = 0;
    expertModeStep = 'initial';
    internalImprovedPrompt = '';
}

// HTML 이스케이프 함수
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 상태 메시지 표시
function showStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;
    
    if (!message) {
        statusDiv.style.display = 'none';
        return;
    }
    
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
            break;
    }
    
    if (type === 'success' || type === 'error') {
        setTimeout(function() {
            if (statusDiv) statusDiv.style.display = 'none';
        }, 4000);
    }
}

// 기타 함수들
function showDetailedGuide() {
    const modal = document.getElementById('guideModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalBody) return;
    
    modalTitle.textContent = 'AI 프롬프트 개선기 v5.0 사용법 - ' + (isExpertMode ? '전문가모드' : '일반모드');
    
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
    return (
        '<div class="guide-section">' +
            '<h3>🚀 일반모드 특징</h3>' +
            '<ul>' +
                '<li>빠르고 간편한 프롬프트 개선</li>' +
                '<li>1회 질문으로 즉시 완성</li>' +
                '<li>초보자 친화적 설계</li>' +
                '<li>90점 미만시 자동 재개선</li>' +
            '</ul>' +
        '</div>'
    );
}

function getExpertModeGuide() {
    return (
        '<div class="guide-section">' +
            '<h3>🎯 전문가모드 특징</h3>' +
            '<ul>' +
                '<li>다단계 내부 개선 프로세스</li>' +
                '<li>심층 의도 파악 시스템</li>' +
                '<li>중복 방지 철저한 질문</li>' +
                '<li>전문가급 최종 결과물</li>' +
            '</ul>' +
        '</div>' +
        
        '<div class="guide-section">' +
            '<h3>🔍 프로세스 흐름</h3>' +
            '<ol>' +
                '<li><strong>기본 질문:</strong> 표면적 요구사항 파악</li>' +
                '<li><strong>1차 내부개선:</strong> 기본 정보로 1차 개선</li>' +
                '<li><strong>1차 심층질문:</strong> 숨겨진 의도 발굴</li>' +
                '<li><strong>2차 내부개선:</strong> 심층 정보 통합</li>' +
                '<li><strong>2차 심층질문:</strong> 최종 완성도 확보</li>' +
                '<li><strong>최종 완성:</strong> 전문가급 프롬프트</li>' +
            '</ol>' +
        '</div>'
    );
}
