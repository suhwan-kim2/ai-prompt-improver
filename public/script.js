// script.js - 진짜 서버 API 연결 버전

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
    console.log('페이지 로드 완료 - 실제 API 버전');
    
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
    
    if (isExpertMode) {
        toggle.classList.add('active');
        if (description) {
            description.textContent = '전문가급 의도 분석 시스템 (3단계 질문)';
        }
    } else {
        toggle.classList.remove('active');
        if (description) {
            description.textContent = '빠르고 간편한 AI 질문 시스템 (동적 개수)';
        }
    }
}

// 🚀 진짜 서버 API 호출 함수
async function callAPI(step, data) {
    console.log('=== 서버 API 호출 ===');
    console.log('Step:', step);
    console.log('Data:', data);
    
    try {
        const requestBody = {
            step: step,
            userInput: data.userInput || originalUserInput,
            answers: data.answers || [],
            mode: isExpertMode ? 'expert' : 'normal',
            ...data
        };
        
        console.log('요청 데이터:', requestBody);
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('응답 상태:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('서버 오류:', errorText);
            throw new Error(`서버 오류 (${response.status}): ${errorText}`);
        }
        
        const result = await response.json();
        console.log('서버 응답:', result);
        
        return result;
        
    } catch (error) {
        console.error('API 호출 실패:', error);
        
        // 네트워크 오류시 사용자에게 알림
        showStatus('서버 연결에 실패했습니다: ' + error.message, 'error');
        
        // 폴백으로 간단한 응답 반환
        return getFallbackResponse(step, data);
    }
}

// 폴백 응답 (서버 연결 실패시)
function getFallbackResponse(step, data) {
    console.log('폴백 응답 생성:', step);
    
    if (step === 'questions') {
        return {
            questions: [
                "어떤 스타일을 원하시나요?",
                "크기나 해상도 요구사항이 있나요?",
                "주요 용도나 목적이 무엇인가요?"
            ],
            mode: 'fallback',
            analysis: {
                intentScore: 50,
                message: '서버 연결 실패로 기본 질문을 제공합니다.'
            }
        };
    } else if (step === 'final-improve') {
        const answers = Array.isArray(data.answers) ? data.answers.join(', ') : '답변 정보 없음';
        return `${data.userInput || originalUserInput}\n\n추가 정보: ${answers}\n\n고품질로 제작해주세요.`;
    }
    
    return '처리 완료 (폴백 모드)';
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
    
    try {
        showStatus('AI가 사용자 의도를 분석하고 질문을 생성하고 있습니다...', 'processing');
        
        const result = await callAPI('questions', {
            userInput: userInput,
            isExpertMode: isExpertMode
        });
        
        console.log('질문 생성 결과:', result);
        
        // 의도 분석 결과 저장
        if (result.analysis) {
            analysisData = result.analysis;
            
            // 의도 점수 표시
            if (result.analysis.intentScore !== undefined) {
                showIntentScore(result.analysis.intentScore, result.analysis.message);
            }
        }
        
        // 질문이 있으면 표시, 없으면 바로 개선
        if (result.questions && result.questions.length > 0) {
            displayQuestions(result.questions);
            
            const modeText = result.ai_mode ? 'AI 맞춤 질문' : 
                           result.mode === 'fallback' ? '기본 질문' : '질문';
            showStatus(`${modeText}이 생성되었습니다! (${result.questions.length}개)`, 'success');
        } else {
            // 질문 없이 바로 개선
            showStatus('충분한 정보로 바로 개선하겠습니다!', 'success');
            await finalImprove();
        }
        
    } catch (error) {
        console.error('improvePrompt 오류:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 의도 점수 표시
function showIntentScore(score, message) {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'intent-score-display';
    statusDiv.innerHTML = `
        <div class="intent-score-box">
            <div class="intent-score-number">${score}점</div>
            <div class="intent-score-label">의도 파악도</div>
            ${message ? `<div class="intent-score-message">${message}</div>` : ''}
        </div>
    `;
    
    // 기존 의도 점수 표시 제거
    const existingScore = document.querySelector('.intent-score-display');
    if (existingScore) {
        existingScore.remove();
    }
    
    // 상단에 의도 점수 표시
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(statusDiv, container.firstChild);
    }
}

// 질문 표시 함수
function displayQuestions(questions) {
    console.log('질문 표시:', questions);
    
    if (!Array.isArray(questions) || questions.length === 0) {
        console.error('유효하지 않은 질문 데이터:', questions);
        return;
    }
    
    // 문자열이 아닌 질문 필터링
    const validQuestions = questions.filter(q => typeof q === 'string' && q.trim().length > 0);
    
    if (validQuestions.length === 0) {
        console.error('유효한 질문이 없습니다:', questions);
        showStatus('질문 생성에 실패했습니다. 다시 시도해주세요.', 'error');
        return;
    }
    
    currentQuestions = validQuestions;
    
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const questionsContainer = document.getElementById('questionsContainer');
    
    if (!questionsContainer || !aiQuestionsDiv) {
        console.error('질문 컨테이너를 찾을 수 없습니다');
        return;
    }
    
    // 질문 HTML 생성
    let questionsHTML = '<div class="questions-round">';
    questionsHTML += '<div class="round-title">🎯 AI 맞춤 질문</div>';
    
    validQuestions.forEach((question, index) => {
        questionsHTML += `
            <div class="question-item" id="question-${index}">
                <div class="question-text">${escapeHtml(question)}</div>
                <div class="question-input">
                    <textarea class="answer-textarea" 
                              placeholder="답변을 입력해주세요..." 
                              onchange="saveAnswer(${index}, this.value)"
                              id="answer-${index}"></textarea>
                </div>
            </div>
        `;
    });
    
    questionsHTML += '</div>';
    questionsContainer.innerHTML = questionsHTML;
    aiQuestionsDiv.style.display = 'block';
}

// 답변 저장
function saveAnswer(questionIndex, answer) {
    console.log(`답변 저장: 질문 ${questionIndex}, 답변: ${answer}`);
    currentAnswers[questionIndex] = answer.trim();
}

// 답변 완료 후 진행
async function proceedWithAnswers() {
    if (isProcessing) return;
    
    console.log('답변 진행:', currentAnswers);
    
    // 답변이 하나라도 있는지 확인
    const hasAnswers = Object.values(currentAnswers).some(answer => answer && answer.trim().length > 0);
    
    if (!hasAnswers) {
        showStatus('최소 하나 이상의 질문에 답변해주세요.', 'error');
        return;
    }
    
    isProcessing = true;
    
    try {
        showStatus('답변을 바탕으로 프롬프트를 개선하고 있습니다...', 'processing');
        await finalImprove();
    } catch (error) {
        console.error('proceedWithAnswers 오류:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 최종 프롬프트 개선
async function finalImprove() {
    try {
        console.log('최종 개선 시작:', {
            originalUserInput,
            currentAnswers,
            analysisData
        });
        
        // 답변을 배열로 변환
        const answersArray = Object.entries(currentAnswers).map(([index, answer]) => {
            const question = currentQuestions[parseInt(index)] || `질문 ${parseInt(index) + 1}`;
            return `Q: ${question}\nA: ${answer}`;
        });
        
        const result = await callAPI('final-improve', {
            userInput: originalUserInput,
            answers: answersArray,
            analysis: analysisData
        });
        
        console.log('최종 개선 결과:', result);
        
        let improvedPrompt;
        let score = 0;
        
        if (typeof result === 'string') {
            improvedPrompt = result;
        } else if (result.improved_prompt) {
            improvedPrompt = result.improved_prompt;
            score = result.score || 0;
        } else {
            throw new Error('유효하지 않은 응답 형식');
        }
        
        // 결과 표시
        displayResult(originalUserInput, improvedPrompt);
        
        // 점수가 있으면 표시
        if (score > 0) {
            showScoreImprovement(score);
        }
        
        showStatus('프롬프트 개선이 완료되었습니다!', 'success');
        
    } catch (error) {
        console.error('finalImprove 오류:', error);
        showStatus('프롬프트 개선 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 질문 건너뛰기
async function skipQuestions() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus('질문을 건너뛰고 바로 프롬프트를 개선하고 있습니다...', 'processing');
        
        // 빈 답변으로 최종 개선
        currentAnswers = {};
        await finalImprove();
        
    } catch (error) {
        console.error('skipQuestions 오류:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
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
    
    // 의도 점수 표시 숨기기
    const intentScore = document.querySelector('.intent-score-display');
    if (intentScore) {
        intentScore.style.display = 'none';
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
    currentScore = 0;
    analysisData = null;
    
    showStatus('초기화가 완료되었습니다.', 'success');
}

// 이전 결과 완전 초기화
function clearPreviousResults() {
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const improvedResultDiv = document.getElementById('improvedResult');
    const scoreSection = document.getElementById('scoreImprovement');
    const questionsContainer = document.getElementById('questionsContainer');
    const intentScore = document.querySelector('.intent-score-display');
    
    if (aiQuestionsDiv) aiQuestionsDiv.style.display = 'none';
    if (improvedResultDiv) improvedResultDiv.style.display = 'none';
    if (scoreSection) scoreSection.style.display = 'none';
    if (questionsContainer) questionsContainer.innerHTML = '';
    if (intentScore) intentScore.remove();
    
    currentQuestions = [];
    currentAnswers = {};
    analysisData = null;
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

// 가이드 모달 관련 함수들
function showDetailedGuide() {
    const modal = document.getElementById('guideModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalBody) return;
    
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
};

console.log('script.js 로드 완료 - 실제 서버 API 버전');
