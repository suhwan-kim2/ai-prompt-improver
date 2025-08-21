// 전역 변수들
let isExpertMode = false;
let currentQuestions = [];
let currentAnswers = {};
let currentRound = 0;
let maxRounds = 1; // 일반모드: 1, 전문가모드: 2-3
let originalUserInput = '';
let isProcessing = false;
let currentScore = 0;

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
    
    // 모달 외부 클릭시 닫기
    window.onclick = function(event) {
        const modal = document.getElementById('guideModal');
        if (modal && event.target === modal) {
            modal.style.display = 'none';
        }
    }
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
        description.textContent = '전문가급 심층 의도 파악 (2-3회차 질문)';
        guideTitle.textContent = '🎯 전문가모드 사용법';
        guideSteps.innerHTML = 
            '<div class="step">' +
                '<span class="step-number">1️⃣</span>' +
                '<span class="step-text">원하는 작업을 상세히 입력</span>' +
            '</div>' +
            '<div class="step">' +
                '<span class="step-number">2️⃣</span>' +
                '<span class="step-text">AI가 2-3회차 심층 질문</span>' +
            '</div>' +
            '<div class="step">' +
                '<span class="step-number">3️⃣</span>' +
                '<span class="step-text">의도 파악 후 전문가급 개선</span>' +
            '</div>';
        maxRounds = 3;
    } else {
        toggle.classList.remove('active');
        description.textContent = '빠르고 간편한 프롬프트 개선 (1-6개 질문)';
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
                '<span class="step-text">개선된 프롬프트 완성</span>' +
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
    
    try {
        showStatus('AI가 질문을 생성하고 있습니다...', 'processing');
        
        const questions = await generateAIQuestions(userInput, currentRound);
        
        if (questions && questions.length > 0) {
            displayAIQuestions(questions, currentRound);
            showStatus(`${isExpertMode ? '전문가모드' : '일반모드'} 질문이 생성되었습니다!`, 'success');
        } else {
            showStatus('바로 프롬프트를 개선하겠습니다...', 'processing');
            await directImprovePrompt(userInput);
        }
        
    } catch (error) {
        console.error('improvePrompt 오류:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
        
        try {
            await directImprovePrompt(userInput);
        } catch (fallbackError) {
            console.error('기본 개선도 실패:', fallbackError);
            showStatus('프롬프트 개선에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
        }
    } finally {
        isProcessing = false;
    }
}

// AI 질문 생성
async function generateAIQuestions(userInput, round) {
    try {
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'questions',
                userInput: userInput,
                isExpertMode: isExpertMode,
                round: round,
                previousAnswers: Object.values(currentAnswers).flat().join(', ')
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '추가 답변 기반 재개선 실패');
        }

        const reImprovedPrompt = data.result;
        
        // 결과 업데이트
        const improvedText = document.getElementById('improvedText');
        if (improvedText) improvedText.textContent = reImprovedPrompt;
        
        // 추가 질문 섹션 숨기기
        const additionalSection = document.getElementById('additionalQuestions');
        if (additionalSection) additionalSection.style.display = 'none';
        
        // 재평가
        const newQuality = await quickQualityCheck(reImprovedPrompt);
        currentScore = newQuality.score;
        
        showScoreImprovement(currentScore);
        showStatus(`추가 답변 기반 재개선 완료! ${currentScore}점 달성!`, 'success');
        
    } catch (error) {
        console.error('추가 답변 재개선 오류:', error);
        showStatus('추가 답변 재개선 중 오류가 발생했습니다.', 'error');
    } finally {
        isProcessing = false;
    }
}

// 추가 답변 포맷팅
function formatAdditionalAnswersForAPI() {
    if (!currentAnswers.additional) return '';
    
    return Object.entries(currentAnswers.additional)
        .map(function(entry) {
            const questionId = entry[0];
            const answerData = entry[1];
            const answerText = Array.isArray(answerData.answers) ? answerData.answers.join(', ') : answerData.answers;
            const requestText = answerData.request ? `\n요청사항: ${answerData.request}` : '';
            return `추가질문 ${questionId}: ${answerText}${requestText}`;
        })
        .join('\n\n');
}

// 추가 질문 취소
function cancelAdditionalQuestions() {
    const additionalSection = document.getElementById('additionalQuestions');
    const scoreSection = document.getElementById('scoreImprovement');
    
    if (additionalSection) additionalSection.style.display = 'none';
    if (scoreSection) scoreSection.style.display = 'block';
    
    // 추가 답변 초기화
    if (currentAnswers.additional) {
        delete currentAnswers.additional;
    }
    
    showStatus('추가 질문이 취소되었습니다.', 'success');
}

// 현재 결과 수락
function acceptCurrentResult() {
    const scoreSection = document.getElementById('scoreImprovement');
    if (scoreSection) scoreSection.style.display = 'none';
    
    showStatus(`현재 결과를 수락했습니다! (${currentScore}점)`, 'success');
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
            strengths: ["기본적인 개선 완료"],
            improvements: ["더 구체적인 요구사항 필요"],
            recommendation: "현재 수준에서 사용 가능"
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
    showStatus('초기화가 완료되었습니다.', 'success');
}

// 이전 결과 완전 초기화
function clearPreviousResults() {
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const improvedResultDiv = document.getElementById('improvedResult');
    const scoreSection = document.getElementById('scoreImprovement');
    const additionalSection = document.getElementById('additionalQuestions');
    const questionsContainer = document.getElementById('questionsContainer');
    
    if (aiQuestionsDiv) aiQuestionsDiv.style.display = 'none';
    if (improvedResultDiv) improvedResultDiv.style.display = 'none';
    if (scoreSection) scoreSection.style.display = 'none';
    if (additionalSection) additionalSection.style.display = 'none';
    if (questionsContainer) questionsContainer.innerHTML = '';
    
    currentQuestions = [];
    currentAnswers = {};
    currentRound = 0;
}

// 자세한 사용법 모달
function showDetailedGuide() {
    const modal = document.getElementById('guideModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalBody) return;
    
    modalTitle.textContent = `📖 AI 프롬프트 개선기 v5.0 사용법 - ${isExpertMode ? '전문가모드' : '일반모드'}`;
    
    const guideContent = isExpertMode ? getExpertModeGuide() : getNormalModeGuide();
    modalBody.innerHTML = guideContent;
    
    modal.style.display = 'block';
}

// 일반모드 가이드
function getNormalModeGuide() {
    return 
        '<div class="guide-section">' +
            '<h3>🚀 일반모드 특징</h3>' +
            '<ul>' +
                '<li>빠르고 간편한 프롬프트 개선</li>' +
                '<li>1-6개의 동적 질문 생성</li>' +
                '<li>질문 스킵 기능 제공</li>' +
                '<li>90점 미만시 자동 재개선</li>' +
            '</ul>' +
        '</div>' +
        
        '<div class="guide-section">' +
            '<h3>🎯 사용 흐름</h3>' +
            '<ol>' +
                '<li><strong>입력:</strong> 원하는 작업을 한글로 입력</li>' +
                '<li><strong>질문:</strong> AI가 1-6개 질문 생성 (복잡도에 따라)</li>' +
                '<li><strong>선택:</strong> 답변하거나 스킵 가능</li>' +
                '<li><strong>개선:</strong> AI가 프롬프트 개선</li>' +
                '<li><strong>평가:</strong> 90점 미만시 자동 재개선</li>' +
                '<li><strong>추가:</strong> 90점 이상시 추가 질문 옵션</li>' +
            '</ol>' +
        '</div>' +
        
        '<div class="guide-section">' +
            '<h3>💡 활용 팁</h3>' +
            '<ul>' +
                '<li>구체적일수록 더 정확한 질문 생성</li>' +
                '<li>급할 때는 질문 스킵 활용</li>' +
                '<li>만족하지 않으면 추가 질문 활용</li>' +
                '<li>"기타" 선택 후 직접 입력 가능</li>' +
            '</ul>' +
        '</div>';
}

// 전문가모드 가이드
function getExpertModeGuide() {
    return 
        '<div class="guide-section">' +
            '<h3>🎯 전문가모드 특징</h3>' +
            '<ul>' +
                '<li>2-3회차 심층 의도 파악</li>' +
                '<li>회차당 1-3개 정밀 질문</li>' +
                '<li>모든 질문에 요청사항 입력란</li>' +
                '<li>전문가급 프롬프트 완성도</li>' +
            '</ul>' +
        '</div>' +
        
        '<div class="guide-section">' +
            '<h3>🔍 사용 흐름</h3>' +
            '<ol>' +
                '<li><strong>입력:</strong> 상세한 작업 내용 입력</li>' +
                '<li><strong>1차 질문:</strong> 기본 정보 파악</li>' +
                '<li><strong>2차 질문:</strong> 심층 의도 분석</li>' +
                '<li><strong>3차 질문:</strong> 세부 요구사항 발굴</li>' +
                '<li><strong>개선:</strong> 모든 답변 종합하여 개선</li>' +
                '<li><strong>완성:</strong> 전문가급 프롬프트 완성</li>' +
            '</ol>' +
        '</div>' +
        
        '<div class="guide-section">' +
            '<h3>✨ 전문가모드 장점</h3>' +
            '<ul>' +
                '<li>창작자의 숨겨진 의도 발굴</li>' +
                '<li>업무 맥락과 목적 정확히 파악</li>' +
                '<li>전문 분야별 최적화된 질문</li>' +
                '<li>요청사항으로 세밀한 조정</li>' +
            '</ul>' +
        '</div>' +
        
        '<div class="guide-section">' +
            '<h3>📝 요청사항 활용법</h3>' +
            '<ul>' +
                '<li>숨겨진 의도나 배경 설명</li>' +
                '<li>특별히 강조하고 싶은 부분</li>' +
                '<li>피해야 할 요소나 제약사항</li>' +
                '<li>이상적인 결과물에 대한 구체적 설명</li>' +
            '</ul>' +
        '</div>';
}

// 모달 닫기
function closeDetailedGuide() {
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.style.display = 'none';
    }
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
} '질문 생성 실패');
        }

        let jsonStr = data.result.trim();
        
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/```json\s*/, '').replace(/```\s*$/, '');
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```\s*/, '').replace(/```\s*$/, '');
        }
        
        const parsed = JSON.parse(jsonStr);
        
        if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            return parsed.questions;
        } else {
            return [];
        }
        
    } catch (e) {
        console.error('질문 생성 실패:', e);
        return [];
    }
}

// AI 질문 표시
function displayAIQuestions(questions, round) {
    currentQuestions = questions;
    
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const questionsContainer = document.getElementById('questionsContainer');
    
    if (!questionsContainer || !aiQuestionsDiv) {
        console.error('질문 컨테이너를 찾을 수 없습니다');
        return;
    }
    
    // 새로운 라운드 추가
    const roundDiv = document.createElement('div');
    roundDiv.className = 'questions-round';
    roundDiv.innerHTML = `
        <div class="round-title">
            ${round === 0 ? '🎯 기본 질문' : `🔍 ${round}차 심층 질문`}
            ${isExpertMode ? '(전문가모드)' : ''}
        </div>
    `;
    
    let questionsHTML = '';
    
    questions.forEach(function(q, index) {
        const globalIndex = Object.keys(currentAnswers).length + index;
        
        questionsHTML += '<div class="question-item">';
        questionsHTML += '<div class="question-text">' + escapeHtml(q.question) + '</div>';
        questionsHTML += '<div class="question-options">';
        
        if (q.type === 'choice' && q.options) {
            q.options.forEach(function(option) {
                const safeOption = escapeHtml(option);
                questionsHTML += '<button class="option-button" onclick="selectOption(' + globalIndex + ', \'' + safeOption.replace(/'/g, '&apos;') + '\')">';
                questionsHTML += safeOption;
                questionsHTML += '</button>';
            });
        } else {
            questionsHTML += '<input type="text" class="text-input" placeholder="답변을 입력하세요..." onchange="selectOption(' + globalIndex + ', this.value)">';
        }
        
        questionsHTML += '</div>';
        
        // 요청사항 입력란 (전문가모드 또는 특정 조건에서)
        if (isExpertMode || round > 0) {
            questionsHTML += `
                <div class="request-input">
                    <label class="request-label">💡 추가 요청사항이나 의도를 자세히 설명해주세요:</label>
                    <textarea class="request-textarea" placeholder="예: 이 질문과 관련해서 특별히 고려해야 할 사항이나 숨겨진 의도가 있다면 적어주세요..." 
                        onchange="addRequestForQuestion(${globalIndex}, this.value)"></textarea>
                </div>
            `;
        }
        
        questionsHTML += '</div>';
    });
    
    roundDiv.innerHTML += questionsHTML;
    questionsContainer.appendChild(roundDiv);
    
    aiQuestionsDiv.style.display = 'block';
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
        // 다중 선택 지원
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
        
        // 기타 선택시 커스텀 입력 처리
        handleCustomInput(questionItem, questionIndex, answer);
    } else {
        // 텍스트 입력
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
            const customInputHTML = `
                <div class="custom-input" style="margin-top: 10px;">
                    <input type="text" class="text-input" placeholder="직접 입력해주세요..." 
                        onchange="addCustomAnswer(${questionIndex}, this.value)" 
                        style="width: 100%; padding: 8px; border: 2px solid #e9ecef; border-radius: 8px;">
                </div>
            `;
            questionItem.querySelector('.question-options').insertAdjacentHTML('beforeend', customInputHTML);
        }
    } else {
        if (customInputDiv) {
            customInputDiv.remove();
            // 커스텀 답변 제거
            const originalOptions = currentQuestions[questionIndex % currentQuestions.length]?.options || [];
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
        
        // 기존 커스텀 답변 제거 후 새로운 것 추가
        const originalOptions = currentQuestions[questionIndex % currentQuestions.length]?.options || [];
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
        await directImprovePrompt(originalUserInput);
    } catch (error) {
        console.error('Error:', error);
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
        currentRound++;
        
        // 전문가모드이고 더 질문할 라운드가 남았으면
        if (isExpertMode && currentRound < maxRounds) {
            showStatus(`AI가 ${currentRound + 1}차 심층 질문을 생성하고 있습니다...`, 'processing');
            
            const nextQuestions = await generateAIQuestions(originalUserInput, currentRound);
            
            if (nextQuestions && nextQuestions.length > 0) {
                displayAIQuestions(nextQuestions, currentRound);
                showStatus(`${currentRound + 1}차 심층 질문이 생성되었습니다!`, 'success');
                isProcessing = false;
                return;
            }
        }
        
        // 모든 질문 완료, 개선 진행
        showStatus('AI가 답변을 바탕으로 프롬프트를 개선하고 있습니다...', 'processing');
        
        const answersText = formatAnswersForAPI();
        await improvePromptWithAnswers(originalUserInput, answersText);
        
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
            const answerText = Array.isArray(answerData.answers) ? answerData.answers.join(', ') : answerData.answers;
            const requestText = answerData.request ? `\n요청사항: ${answerData.request}` : '';
            return `Q${parseInt(index) + 1}: ${answerText}${requestText}`;
        })
        .join('\n\n');
}

// 답변 기반 프롬프트 개선
async function improvePromptWithAnswers(originalPrompt, answersText) {
    try {
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'improve',
                userInput: originalPrompt,
                questions: currentQuestions,
                answers: answersText,
                isExpertMode: isExpertMode,
                rounds: currentRound + 1
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '프롬프트 개선 실패');
        }

        displayResult(originalPrompt, data.result);
        
    } catch (error) {
        console.error('답변 기반 개선 오류:', error);
        throw error;
    }
}

// 직접 프롬프트 개선
async function directImprovePrompt(originalPrompt) {
    try {
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'improve',
                userInput: originalPrompt,
                isExpertMode: isExpertMode
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '프롬프트 개선 실패');
        }

        displayResult(originalPrompt, data.result);
        
    } catch (error) {
        console.error('직접 개선 오류:', error);
        throw error;
    }
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
    
    showStatus('프롬프트 개선이 완료되었습니다! 품질을 검증하고 있습니다...', 'processing');
    
    // 품질 평가 후 90점 기준 처리
    setTimeout(function() {
        evaluateAndShowScore(improved);
    }, 1500);
}

// 품질 평가 및 점수 표시
async function evaluateAndShowScore(improvedPrompt) {
    try {
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'evaluate',
                userInput: improvedPrompt,
                originalInput: originalUserInput
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '품질 평가 실패');
        }

        const qualityData = parseQualityResponse(data.result);
        currentScore = qualityData.score;
        
        if (currentScore < 90) {
            // 90점 미만이면 AI가 자동 재개선
            showStatus(`현재 ${currentScore}점입니다. AI가 자동으로 재개선하고 있습니다...`, 'processing');
            await autoImprovePrompt(improvedPrompt);
        } else {
            // 90점 이상이면 추가 질문 옵션 제공
            showScoreImprovement(currentScore);
            showStatus(`완성! ${currentScore}점의 고품질 프롬프트입니다!`, 'success');
        }
        
    } catch (error) {
        console.error('품질 평가 오류:', error);
        showStatus('프롬프트 개선이 완료되었습니다!', 'success');
        showScoreImprovement(85); // 기본값
    }
}

// 자동 재개선 (90점 미만일 때)
async function autoImprovePrompt(currentPrompt) {
    try {
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'auto-improve',
                userInput: currentPrompt,
                originalInput: originalUserInput,
                currentScore: currentScore,
                isExpertMode: isExpertMode
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '자동 재개선 실패');
        }

        const reImprovedPrompt = data.result;
        
        // 결과 업데이트
        const improvedText = document.getElementById('improvedText');
        if (improvedText) improvedText.textContent = reImprovedPrompt;
        
        // 재평가
        const newQuality = await quickQualityCheck(reImprovedPrompt);
        currentScore = newQuality.score;
        
        showScoreImprovement(currentScore);
        showStatus(`자동 재개선 완료! ${currentScore}점 달성!`, 'success');
        
    } catch (error) {
        console.error('자동 재개선 오류:', error);
        showStatus('자동 재개선 중 오류가 발생했습니다.', 'error');
    }
}

// 빠른 품질 확인
async function quickQualityCheck(improvedPrompt) {
    try {
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'evaluate',
                userInput: improvedPrompt,
                quickMode: true
            })
        });

        const data = await response.json();
        const parsed = parseQualityResponse(data.result);
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

// 추가 질문 요청
async function requestAdditionalQuestions() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus('더 정밀한 개선을 위한 추가 질문을 생성하고 있습니다...', 'processing');
        
        const currentImproved = document.getElementById('improvedText').textContent;
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'additional-questions',
                userInput: originalUserInput,
                currentImproved: currentImproved,
                previousAnswers: formatAnswersForAPI(),
                isExpertMode: isExpertMode
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '추가 질문 생성 실패');
        }

        let jsonStr = data.result.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/```json\s*/, '').replace(/```\s*$/, '');
        }
        
        const parsed = JSON.parse(jsonStr);
        
        if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            displayAdditionalQuestions(parsed.questions);
            showStatus('추가 질문이 생성되었습니다!', 'success');
        } else {
            showStatus('추가 질문 생성에 실패했습니다.', 'error');
        }
        
    } catch (error) {
        console.error('추가 질문 생성 오류:', error);
        showStatus('추가 질문 생성 중 오류가 발생했습니다.', 'error');
    } finally {
        isProcessing = false;
    }
}

// 추가 질문 표시
function displayAdditionalQuestions(questions) {
    const additionalSection = document.getElementById('additionalQuestions');
    const container = document.getElementById('additionalQuestionsContainer');
    const scoreSection = document.getElementById('scoreImprovement');
    
    if (scoreSection) scoreSection.style.display = 'none';
    
    let questionsHTML = '';
    
    questions.forEach(function(q, index) {
        const globalIndex = 'additional_' + index;
        
        questionsHTML += '<div class="question-item">';
        questionsHTML += '<div class="question-text">' + escapeHtml(q.question) + '</div>';
        questionsHTML += '<div class="question-options">';
        
        if (q.type === 'choice' && q.options) {
            q.options.forEach(function(option) {
                const safeOption = escapeHtml(option);
                questionsHTML += '<button class="option-button" onclick="selectAdditionalOption(\'' + globalIndex + '\', \'' + safeOption.replace(/'/g, '&apos;') + '\')">';
                questionsHTML += safeOption;
                questionsHTML += '</button>';
            });
        } else {
            questionsHTML += '<input type="text" class="text-input" placeholder="답변을 입력하세요..." onchange="selectAdditionalOption(\'' + globalIndex + '\', this.value)">';
        }
        
        questionsHTML += '</div>';
        
        // 요청사항 입력란
        questionsHTML += 
            '<div class="request-input">' +
                '<label class="request-label">💡 이 질문과 관련된 추가 요청사항이나 의도:</label>' +
                '<textarea class="request-textarea" placeholder="더 구체적인 요구사항이나 숨겨진 의도가 있다면 자세히 설명해주세요..." ' +
                    'onchange="addAdditionalRequest(\'' + globalIndex + '\', this.value)"></textarea>' +
            '</div>';
        
        questionsHTML += '</div>';
    });
    
    if (container) container.innerHTML = questionsHTML;
    if (additionalSection) additionalSection.style.display = 'block';
}

// 추가 질문 옵션 선택
function selectAdditionalOption(questionId, answer) {
    if (!currentAnswers.additional) {
        currentAnswers.additional = {};
    }
    
    if (!currentAnswers.additional[questionId]) {
        currentAnswers.additional[questionId] = {
            answers: [],
            request: ''
        };
    }
    
    const answerIndex = currentAnswers.additional[questionId].answers.indexOf(answer);
    
    if (answerIndex === -1) {
        currentAnswers.additional[questionId].answers.push(answer);
    } else {
        currentAnswers.additional[questionId].answers.splice(answerIndex, 1);
    }
    
    // 버튼 스타일 업데이트
    const questionItems = document.querySelectorAll('#additionalQuestionsContainer .question-item');
    questionItems.forEach(function(item, index) {
        if (questionId === 'additional_' + index) {
            const buttons = item.querySelectorAll('.option-button');
            buttons.forEach(function(btn) {
                const btnText = btn.textContent.trim();
                if (currentAnswers.additional[questionId].answers.includes(btnText)) {
                    btn.classList.add('selected');
                } else {
                    btn.classList.remove('selected');
                }
            });
        }
    });
}

// 추가 요청사항 추가
function addAdditionalRequest(questionId, request) {
    if (!currentAnswers.additional) {
        currentAnswers.additional = {};
    }
    
    if (!currentAnswers.additional[questionId]) {
        currentAnswers.additional[questionId] = {
            answers: [],
            request: ''
        };
    }
    
    currentAnswers.additional[questionId].request = request.trim();
}

// 추가 답변으로 재개선
async function processAdditionalAnswers() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus('추가 답변을 바탕으로 재개선하고 있습니다...', 'processing');
        
        const currentImproved = document.getElementById('improvedText').textContent;
        const additionalAnswersText = formatAdditionalAnswersForAPI();
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'improve-with-additional',
                userInput: originalUserInput,
                currentImproved: currentImproved,
                additionalAnswers: additionalAnswersText,
                isExpertMode: isExpertMode
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error ||
