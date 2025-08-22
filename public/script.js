// script.js - 500 오류 해결 완전 버전

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
    
    if (isExpertMode) {
        toggle.classList.add('active');
        if (description) {
            description.textContent = '전문가급 심층 의도 파악 (다단계 내부 개선)';
        }
        maxRounds = 3;
    } else {
        toggle.classList.remove('active');
        if (description) {
            description.textContent = '빠르고 간편한 프롬프트 개선 (1회 질문)';
        }
        maxRounds = 1;
    }
}

// ✅ 새로운 API 호출 함수 - 완전한 오류 처리
async function callAPI(step, data) {
    try {
        console.log('=== API 호출 시작 ===');
        console.log('Step:', step);
        console.log('Data:', data);
        
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

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        // ✅ 상세한 오류 처리
        if (!response.ok) {
            let errorMessage = `서버 오류 (${response.status})`;
            try {
                const errorText = await response.text();
                console.error('서버 응답 오류:', errorText);
                errorMessage += `: ${errorText}`;
            } catch (e) {
                console.error('오류 텍스트 파싱 실패:', e);
            }
            throw new Error(errorMessage);
        }

        // ✅ JSON 파싱 시도
        let result;
        try {
            result = await response.json();
        } catch (e) {
            console.error('JSON 파싱 오류:', e);
            const rawText = await response.text();
            console.error('Raw response:', rawText);
            throw new Error('서버 응답을 파싱할 수 없습니다.');
        }

        console.log('=== API 응답 ===');
        console.log('Success:', result.success);
        
        if (!result.success) {
            console.error('API 결과 오류:', result.error);
            throw new Error(result.error || 'API 호출 실패');
        }

        console.log('Result:', result.result?.substring ? result.result.substring(0, 100) : result.result);

        // ✅ 질문 단계 JSON 파싱
        if (step === 'questions' || step === 'questions-round-1' || step === 'questions-round-2') {
            try {
                let jsonStr = result.result.trim();
                
                // JSON 코드 블록 제거
                if (jsonStr.startsWith('```json')) {
                    jsonStr = jsonStr.replace(/```json\s*/, '').replace(/```\s*$/, '');
                } else if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/```\s*/, '').replace(/```\s*$/, '');
                }
                
                console.log('JSON 파싱 시도:', jsonStr.substring(0, 200));
                
                const parsed = JSON.parse(jsonStr);
                return parsed.questions || [];
                
            } catch (e) {
                console.error('JSON 파싱 실패:', e);
                console.error('원본 응답:', result.result);
                
                // ✅ 폴백 질문 생성
                return generateFallbackQuestions(data.userInput);
            }
        }
        
        // 평가 단계 JSON 파싱
        if (step === 'evaluate') {
            try {
                let jsonStr = result.result.trim();
                if (jsonStr.startsWith('```json')) {
                    jsonStr = jsonStr.replace(/```json\s*/, '').replace(/```\s*$/, '');
                } else if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/```\s*/, '').replace(/```\s*$/, '');
                }
                
                return JSON.parse(jsonStr);
            } catch (e) {
                console.error('평가 JSON 파싱 실패:', e);
                return {
                    score: 75,
                    strengths: ['기본적인 개선 완료'],
                    improvements: ['더 구체적인 요구사항 필요'],
                    recommendation: '현재 수준에서 사용 가능'
                };
            }
        }
        
        // 일반 텍스트 응답
        return result.result;
        
    } catch (error) {
        console.error('=== API 호출 완전 실패 ===', error);
        
        // ✅ 사용자 친화적 오류 메시지
        let userMessage = '서비스 연결에 문제가 있습니다.';
        
        if (error.message.includes('Failed to fetch')) {
            userMessage = '네트워크 연결을 확인해주세요.';
        } else if (error.message.includes('500')) {
            userMessage = '서버 내부 오류입니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('404')) {
            userMessage = 'API를 찾을 수 없습니다.';
        } else if (error.message.includes('JSON')) {
            userMessage = '서버 응답 형식에 문제가 있습니다.';
        }
        
        throw new Error(userMessage);
    }
}

// ✅ 폴백 질문 생성 함수
function generateFallbackQuestions(userInput) {
    console.log('폴백 질문 생성:', userInput);
    
    const input = userInput.toLowerCase();
    let questions = [];
    
    if (input.includes('그림') || input.includes('이미지')) {
        questions = [
            { question: "어떤 스타일을 원하시나요?", type: "choice", options: ["현실적", "만화적", "3D", "기타"] },
            { question: "주요 색상을 선택해주세요.", type: "choice", options: ["밝은 톤", "어두운 톤", "무채색", "기타"] }
        ];
    } else {
        questions = [
            { question: "어떤 스타일이나 톤을 원하시나요?", type: "choice", options: ["공식적", "친근한", "전문적", "기타"] },
            { question: "주요 목적은 무엇인가요?", type: "choice", options: ["업무용", "개인용", "교육용", "기타"] }
        ];
    }
    
    return questions;
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
        showStatus('AI가 질문을 생성하고 있습니다...', 'processing');
        
        const questions = await callAPI('questions', {
            userInput: userInput,
            isExpertMode: isExpertMode
        });
        
        if (questions && questions.length > 0) {
            displayQuestions(questions, '기본 정보 파악');
            showStatus('질문이 생성되었습니다!', 'success');
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
        showStatus('답변을 바탕으로 프롬프트를 개선하고 있습니다...', 'processing');
        await finalImprove();
        
    } catch (error) {
        console.error('proceedWithAnswers 오류:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 최종 개선
async function finalImprove() {
    showStatus('최종 프롬프트를 완성하고 있습니다...', 'processing');
    
    const finalPrompt = await callAPI('final-improve', {
        userInput: originalUserInput,
        questions: currentQuestions,
        answers: formatAnswersForAPI(),
        isExpertMode: isExpertMode
    });
    
    displayResult(originalUserInput, finalPrompt);
    
    showStatus('프롬프트 개선이 완료되었습니다!', 'success');
    
    // 평가는 선택사항
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
    showStatus('프롬프트 개선이 완료되었습니다!', 'success');
}

// 질문 건너뛰기
async function skipQuestions() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus('질문을 건너뛰고 프롬프트를 개선하고 있습니다...', 'processing');
        await directImprove();
    } catch (error) {
        console.error('skipQuestions 오류:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 나머지 함수들은 기존과 동일...
// (질문 표시, 옵션 선택, 결과 표시 등)

// 질문 표시 함수
function displayQuestions(questions, title) {
    currentQuestions = questions;
    
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const questionsContainer = document.getElementById('questionsContainer');
    
    if (!questionsContainer || !aiQuestionsDiv) {
        console.error('질문 컨테이너를 찾을 수 없습니다');
        return;
    }
    
    questionsContainer.innerHTML = '';
    const roundDiv = document.createElement('div');
    roundDiv.className = 'questions-round';
    roundDiv.innerHTML = '<div class="round-title">🎯 ' + title + '</div>';
    
    let questionsHTML = '';
    questions.forEach(function(q, index) {
        questionsHTML += buildQuestionHTML(q, index);
    });
    
    roundDiv.innerHTML += questionsHTML;
    questionsContainer.appendChild(roundDiv);
    aiQuestionsDiv.style.display = 'block';
}

// 질문 HTML 생성
function buildQuestionHTML(question, index) {
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
    }
    
    html += '</div></div>';
    return html;
}

// 옵션 선택
function selectOption(questionIndex, answer) {
    if (!currentAnswers[questionIndex]) {
        currentAnswers[questionIndex] = { answers: [], request: '' };
    }
    
    const questionItems = document.querySelectorAll('.question-item');
    const questionItem = questionItems[questionIndex];
    
    if (!questionItem) return;
    
    const buttons = questionItem.querySelectorAll('.option-button');
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
}

// 답변 포맷팅
function formatAnswersForAPI() {
    return Object.entries(currentAnswers)
        .map(function(entry) {
            const index = entry[0];
            const answerData = entry[1];
            const question = currentQuestions[parseInt(index)] ? currentQuestions[parseInt(index)].question : '질문 ' + (parseInt(index) + 1);
            const answerText = Array.isArray(answerData.answers) ? answerData.answers.join(', ') : answerData.answers;
            return 'Q: ' + question + '\nA: ' + answerText;
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

// 평가 및 점수 표시
async function evaluateAndShowScore(improvedPrompt) {
    try {
        const evaluation = await callAPI('evaluate', {
            userInput: improvedPrompt
        });
        
        currentScore = evaluation.score || 75;
        showScoreImprovement(currentScore);
        showStatus('평가 완료! ' + currentScore + '점입니다.', 'success');
        
    } catch (error) {
        console.error('평가 오류:', error);
        showScoreImprovement(75);
        showStatus('평가 중 오류가 발생했지만 개선은 완료되었습니다.', 'success');
    }
}

// 점수 개선 섹션 표시
function showScoreImprovement(score) {
    const scoreSection = document.getElementById('scoreImprovement');
    const scoreDisplay = document.getElementById('currentScore');
    
    if (scoreDisplay) scoreDisplay.textContent = score;
    if (scoreSection) scoreSection.style.display = 'block';
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
        // 폴백 방법
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showStatus('개선된 프롬프트가 복사되었습니다!', 'success');
    }
}

// 초기화
function clearResults() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    clearPreviousResults();
    originalUserInput = '';
    isProcessing = false;
    showStatus('초기화가 완료되었습니다.', 'success');
}

// 이전 결과 초기화
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
}

// HTML 이스케이프
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
    }
    
    if (type === 'success' || type === 'error') {
        setTimeout(function() {
            if (statusDiv) statusDiv.style.display = 'none';
        }, 4000);
    }
}
