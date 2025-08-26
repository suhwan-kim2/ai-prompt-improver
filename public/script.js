// public/script.js - AI 대화형 프롬프트 개선기 (완전 새 버전)

console.log('🚀 AI 대화형 프롬프트 개선기 시작!');

// =============================================================================
// 📱 전역 변수들
// =============================================================================
let isExpertMode = false;
let currentQuestions = [];
let currentAnswers = {};
let allAnswers = [];
let currentUserInput = '';
let isProcessing = false;
let intentScore = 0;
let qualityScore = 0;
let currentStep = 1;
let targetScore = 95;

// =============================================================================
// 🚀 페이지 초기화
// =============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 페이지 로드 완료');
    setupUI();
    updateScores(0, 0);
});

function setupUI() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                improvePrompt();
            }
        });
    }
}

// =============================================================================
// 🎯 메인 프롬프트 개선 함수
// =============================================================================
async function improvePrompt() {
    const searchInput = document.getElementById('searchInput');
    const userInput = searchInput?.value?.trim();
    
    if (!userInput || userInput.length < 2) {
        showStatus('개선하고 싶은 프롬프트를 입력해주세요 (최소 2글자)', 'error');
        return;
    }
    
    if (isProcessing) {
        showStatus('이미 처리 중입니다', 'error');
        return;
    }
    
    // 상태 초기화
    clearResults();
    isProcessing = true;
    currentUserInput = userInput;
    currentStep = 1;
    allAnswers = [];
    intentScore = 0;
    qualityScore = 0;
    
    console.log('🎯 AI 대화 시작:', userInput);
    
    try {
        showStatus('🤖 AI가 도메인을 분석하고 첫 질문을 준비하고 있습니다...', 'processing');
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                step: 'questions',
                userInput: userInput,
                mode: isExpertMode ? 'expert' : 'normal'
            })
        });

        if (!response.ok) {
            throw new Error(`API 오류: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.intentScore !== undefined) {
            intentScore = data.intentScore;
            updateScores(intentScore, qualityScore);
        }
        
        if (data.questions && data.questions.length > 0) {
            displayQuestions(data.questions);
            showStatus(`🎯 1단계: ${data.domain} 도메인 감지! 기본 정보를 파악하겠습니다`, 'success');
        } else {
            throw new Error('질문 생성 실패');
        }
        
    } catch (error) {
        console.error('❌ 프롬프트 개선 시작 오류:', error);
        showStatus('❌ AI 연결에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
        isProcessing = false;
    }
}

// =============================================================================
// 🤖 AI 동적 질문 요청
// =============================================================================
async function requestAdditionalQuestions(stepNumber) {
    try {
        console.log(`🤖 ${stepNumber}단계 AI 질문 요청`);
        
        showStatus(`🤖 AI가 ${stepNumber}단계 맞춤형 질문을 생성하고 있습니다...`, 'processing');
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                step: 'additional-questions',
                userInput: currentUserInput,
                answers: allAnswers,
                currentStep: stepNumber,
                mode: isExpertMode ? 'expert' : 'normal',
                targetScore: targetScore
            })
        });

        const data = await response.json();
        
        if (data.intentScore !== undefined) {
            intentScore = data.intentScore;
            updateScores(intentScore, qualityScore);
        }
        
        // 완료 조건
        if (data.shouldProceedToFinal || data.completed) {
            showStatus('🎯 AI가 완벽한 프롬프트를 생성하고 있습니다...', 'processing');
            await finalImprove();
            return;
        }
        
        // AI 생성 질문 표시
        if (data.questions && data.questions.length > 0) {
            displayQuestions(data.questions);
            currentStep = stepNumber;
            showStatus(`🤖 ${currentStep}단계: AI 맞춤 질문 생성 완료!`, 'success');
        } else {
            await finalImprove();
        }
        
    } catch (error) {
        console.error('❌ AI 질문 요청 오류:', error);
        await finalImprove();
    }
}

// =============================================================================
// 📝 질문 표시 (AI 대화형)
// =============================================================================
function displayQuestions(questions) {
    console.log(`🤖 AI 질문 표시: ${questions.length}개`);
    
    if (!questions || questions.length === 0) {
        finalImprove();
        return;
    }
    
    currentQuestions = questions;
    currentAnswers = {};
    
    const container = document.getElementById('questionsContainer');
    if (!container) return;
    
    let html = `
        <div class="ai-conversation">
            <div class="conversation-header">
                <h3>🤖 ${currentStep}단계: AI 맞춤 질문</h3>
                <div class="score-display">
                    <span class="score">의도파악: ${intentScore}점/${targetScore}점</span>
                    <div class="progress-bar">
                        <div class="progress" style="width: ${(intentScore/targetScore)*100}%"></div>
                    </div>
                </div>
            </div>
    `;
    
    questions.forEach((q, i) => {
        const question = q.question || q;
        const options = q.options || ["네", "아니오", "기타"];
        
        html += `
            <div class="question-card" id="q-${i}">
                <div class="question-text">Q${i+1}. ${question}</div>
                <div class="options">
        `;
        
        options.forEach((opt, j) => {
            html += `
                <button class="option-btn" onclick="selectOption(${i}, ${j}, '${opt}')">
                    ${opt}
                </button>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    html += `
            <div class="controls">
                <button class="btn-continue" onclick="continueConversation()">
                    📝 답변 완료 (${Object.keys(currentAnswers).length}/${questions.length})
                </button>
                <button class="btn-skip" onclick="skipToFinal()">⏭️ 바로 완성</button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    document.getElementById('aiQuestions').style.display = 'block';
}

// =============================================================================
// 🎯 질문 답변 처리
// =============================================================================
function selectOption(questionIndex, optionIndex, optionText) {
    console.log(`선택: Q${questionIndex+1} → ${optionText}`);
    
    // 이전 선택 해제
    document.querySelectorAll(`#q-${questionIndex} .option-btn`).forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // 현재 선택 표시
    const selectedBtn = document.querySelector(`#q-${questionIndex} .option-btn:nth-child(${optionIndex + 1})`);
    if (selectedBtn) {
        selectedBtn.classList.add('selected');
    }
    
    // 답변 저장
    currentAnswers[questionIndex] = optionText;
    
    // 진행 버튼 업데이트
    updateContinueButton();
}

function updateContinueButton() {
    const continueBtn = document.querySelector('.btn-continue');
    if (continueBtn) {
        const answered = Object.keys(currentAnswers).length;
        const total = currentQuestions.length;
        continueBtn.textContent = `📝 답변 완료 (${answered}/${total})`;
        continueBtn.disabled = answered === 0;
    }
}

// =============================================================================
// 🔄 대화 진행
// =============================================================================
async function continueConversation() {
    const answers = Object.values(currentAnswers);
    
    if (answers.length === 0) {
        showStatus('최소 1개 질문에는 답변해주세요', 'error');
        return;
    }
    
    console.log(`📝 ${currentStep}단계 답변:`, answers);
    
    allAnswers.push(...answers);
    showStatus(`📊 ${currentStep}단계 답변 처리 중...`, 'processing');
    
    // 다음 단계로
    if (intentScore >= targetScore) {
        await finalImprove();
    } else {
        currentStep++;
        await requestAdditionalQuestions(currentStep);
    }
}

async function skipToFinal() {
    console.log('⏭️ 바로 완성 요청');
    await finalImprove();
}

// =============================================================================
// 🎯 최종 AI 프롬프트 생성
// =============================================================================
async function finalImprove() {
    console.log('🎯 AI 최종 프롬프트 생성');
    
    try {
        showStatus('🤖 AI가 완벽한 프롬프트를 생성하고 있습니다...', 'processing');
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                step: 'final-improve',
                userInput: currentUserInput,
                answers: allAnswers,
                currentStep: currentStep,
                mode: isExpertMode ? 'expert' : 'normal'
            })
        });

        const data = await response.json();
        
        if (data.intentScore) intentScore = data.intentScore;
        if (data.qualityScore) qualityScore = data.qualityScore;
        
        updateScores(intentScore, qualityScore);
        displayResult(data);
        
        showStatus(`🎉 AI 대화 완료! ${currentStep}단계로 ${intentScore}점 달성!`, 'success');
        
    } catch (error) {
        console.error('❌ 최종 생성 오류:', error);
        showStatus('❌ AI 생성 실패', 'error');
    } finally {
        isProcessing = false;
    }
}

// =============================================================================
// 📋 결과 표시
// =============================================================================
function displayResult(data) {
    const originalDiv = document.getElementById('originalText');
    const improvedDiv = document.getElementById('improvedText');
    const resultDiv = document.getElementById('improvedResult');
    
    if (originalDiv) originalDiv.textContent = data.original;
    if (improvedDiv) improvedDiv.textContent = data.improved;
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.scrollIntoView({ behavior: 'smooth' });
    }
}

// =============================================================================
// 🎨 UI 함수들
// =============================================================================
function updateScores(intent, quality) {
    const intentSpan = document.getElementById('intentScore');
    const qualitySpan = document.getElementById('qualityScore');
    
    if (intentSpan) intentSpan.textContent = intent || 0;
    if (qualitySpan) qualitySpan.textContent = quality || 0;
}

function showStatus(message, type = 'info') {
    console.log(`📢 ${message}`);
    // 간단한 상태 표시 (기존 유지)
}

function clearResults() {
    const questionsDiv = document.getElementById('aiQuestions');
    const resultDiv = document.getElementById('improvedResult');
    
    if (questionsDiv) questionsDiv.style.display = 'none';
    if (resultDiv) resultDiv.style.display = 'none';
}

// 모드 토글
function toggleMode() {
    isExpertMode = !isExpertMode;
    const btn = document.getElementById('modeToggle');
    const desc = document.getElementById('modeDescription');
    
    if (btn) {
        btn.textContent = isExpertMode ? '일반 모드' : '전문가 모드';
    }
    if (desc) {
        desc.textContent = isExpertMode ? 
            '최대 20단계 심층 분석' : 
            '빠르고 간편한 개선';
    }
    
    targetScore = isExpertMode ? 95 : 85;
    console.log(`모드 변경: ${isExpertMode ? '전문가' : '일반'} (목표: ${targetScore}점)`);
}

// 결과 복사
async function copyToClipboard() {
    const improvedText = document.getElementById('improvedText');
    if (!improvedText) return;
    
    try {
        await navigator.clipboard.writeText(improvedText.textContent);
        showStatus('✅ 클립보드에 복사되었습니다!', 'success');
    } catch (err) {
        showStatus('❌ 복사 실패', 'error');
    }
}

// 즐겨찾기 저장
function saveToFavorites() {
    const improvedText = document.getElementById('improvedText');
    if (!improvedText) return;
    
    const favoriteItem = {
        id: Date.now(),
        original: currentUserInput,
        improved: improvedText.textContent,
        score: intentScore,
        date: new Date().toLocaleDateString('ko-KR')
    };
    
    try {
        let favorites = JSON.parse(localStorage.getItem('prompt_favorites') || '[]');
        favorites.unshift(favoriteItem);
        if (favorites.length > 10) favorites = favorites.slice(0, 10);
        localStorage.setItem('prompt_favorites', JSON.stringify(favorites));
        showStatus('⭐ 즐겨찾기에 저장되었습니다!', 'success');
    } catch (e) {
        showStatus('❌ 저장 실패', 'error');
    }
}

// HTML 이스케이프
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// CSS 동적 스타일 추가
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        .ai-conversation {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            padding: 20px;
            margin: 20px 0;
            color: white;
        }
        
        .conversation-header {
            text-align: center;
            margin-bottom: 25px;
        }
        
        .conversation-header h3 {
            margin: 0 0 15px 0;
            font-size: 1.5em;
        }
        
        .score-display {
            background: rgba(255,255,255,0.2);
            padding: 10px;
            border-radius: 8px;
        }
        
        .progress-bar {
            background: rgba(255,255,255,0.3);
            height: 8px;
            border-radius: 4px;
            margin: 10px 0;
            overflow: hidden;
        }
        
        .progress {
            background: linear-gradient(90deg, #00b894, #00cec9);
            height: 100%;
            transition: width 0.5s ease;
        }
        
        .question-card {
            background: rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 20px;
            margin: 15px 0;
            backdrop-filter: blur(10px);
        }
        
        .question-text {
            font-size: 1.1em;
            font-weight: bold;
            margin-bottom: 15px;
        }
        
        .options {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .option-btn {
            background: rgba(255,255,255,0.2);
            border: 2px solid transparent;
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: bold;
        }
        
        .option-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
        
        .option-btn.selected {
            background: linear-gradient(135deg, #00b894, #00cec9);
            border-color: white;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
        
        .controls {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 25px;
        }
        
        .btn-continue, .btn-skip {
            background: linear-gradient(135deg, #74b9ff, #0984e3);
            border: none;
            color: white;
            padding: 12px 25px;
            border-radius: 25px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .btn-continue:hover, .btn-skip:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(116, 185, 255, 0.4);
        }
        
        .btn-continue:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        
        .btn-skip {
            background: linear-gradient(135deg, #fd79a8, #e84393);
        }
        
        .btn-skip:hover {
            box-shadow: 0 5px 15px rgba(253, 121, 168, 0.4);
        }
        
        @media (max-width: 768px) {
            .options {
                flex-direction: column;
            }
            
            .option-btn {
                width: 100%;
                text-align: center;
            }
            
            .controls {
                flex-direction: column;
            }
        }
    `;
    document.head.appendChild(style);
});

console.log('✅ AI 대화형 프롬프트 개선기 로드 완료!');
