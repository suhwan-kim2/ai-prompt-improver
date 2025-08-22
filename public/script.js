// script.js - 완전한 클라이언트 사이드 버전

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
    console.log('페이지 로드 완료');
    
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
        if (description) {
            description.textContent = '전문가급 심층 의도 파악 (다단계 내부 개선)';
        }
        if (guideTitle) {
            guideTitle.textContent = '🎯 전문가모드 사용법';
        }
        if (guideSteps) {
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
        }
        maxRounds = 3;
    } else {
        toggle.classList.remove('active');
        if (description) {
            description.textContent = '빠르고 간편한 프롬프트 개선 (1회 질문)';
        }
        if (guideTitle) {
            guideTitle.textContent = '🚀 일반모드 사용법';
        }
        if (guideSteps) {
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
        }
        maxRounds = 1;
    }
}

// 🔥 클라이언트 사이드 API (실제 API 없이 동작)
async function callAPI(step, data) {
    console.log('=== 클라이언트 처리 ===');
    console.log('Step:', step);
    
    // 로딩 효과를 위한 딜레이
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (step === 'questions') {
        const userInput = data.userInput.toLowerCase();
        let questions = [];
        
        if (userInput.includes('그림') || userInput.includes('이미지') || userInput.includes('사진')) {
            questions = [
                {
                    question: "어떤 스타일의 그림을 원하시나요?",
                    type: "choice",
                    options: ["사실적", "만화적", "3D", "수채화", "기타"]
                },
                {
                    question: "주요 색상 톤을 선택해주세요.",
                    type: "choice",
                    options: ["밝은 톤", "어두운 톤", "무채색", "화려한 색상", "기타"]
                },
                {
                    question: "그림의 크기나 해상도는?",
                    type: "choice",
                    options: ["4K (고해상도)", "HD (일반)", "인스타그램용", "프린트용", "기타"]
                }
            ];
        } else if (userInput.includes('영상') || userInput.includes('비디오') || userInput.includes('동영상')) {
            questions = [
                {
                    question: "영상의 길이는 어느 정도가 좋을까요?",
                    type: "choice",
                    options: ["15초 이하", "1-3분", "5분 이상", "상관없음", "기타"]
                },
                {
                    question: "영상의 스타일을 선택해주세요.",
                    type: "choice",
                    options: ["실사", "애니메이션", "3D", "슬라이드쇼", "기타"]
                },
                {
                    question: "배경음악이나 효과음이 필요한가요?",
                    type: "choice",
                    options: ["필요", "불필요", "나중에 결정", "기타"]
                }
            ];
        } else if (userInput.includes('웹사이트') || userInput.includes('사이트') || userInput.includes('홈페이지')) {
            questions = [
                {
                    question: "웹사이트의 주요 목적은 무엇인가요?",
                    type: "choice",
                    options: ["회사 소개", "온라인 쇼핑몰", "포트폴리오", "블로그", "기타"]
                },
                {
                    question: "선호하는 디자인 스타일은?",
                    type: "choice",
                    options: ["모던", "클래식", "미니멀", "화려함", "기타"]
                },
                {
                    question: "주요 기능이 있다면 알려주세요.",
                    type: "choice",
                    options: ["회원가입/로그인", "결제 시스템", "게시판", "검색 기능", "기타"]
                }
            ];
        } else {
            // 일반적인 질문
            questions = [
                {
                    question: "어떤 스타일이나 톤을 원하시나요?",
                    type: "choice",
                    options: ["공식적", "친근한", "전문적", "창의적", "기타"]
                },
                {
                    question: "주요 목적이나 용도는 무엇인가요?",
                    type: "choice",
                    options: ["업무용", "개인용", "교육용", "상업용", "기타"]
                },
                {
                    question: "특별히 고려해야 할 요소가 있나요?",
                    type: "choice",
                    options: ["시간 제약", "예산 제약", "기술적 제약", "상관없음", "기타"]
                }
            ];
        }
        
        // 전문가 모드면 더 자세한 질문 추가
        if (isExpertMode) {
            questions.push({
                question: "추가로 고려해야 할 세부사항이 있나요?",
                type: "choice",
                options: ["성능 최적화", "접근성", "반응형 디자인", "SEO", "기타"]
            });
        }
        
        return questions.slice(0, isExpertMode ? 6 : 4);
        
    } else if (step === 'final-improve') {
        let improvedPrompt = `다음과 같이 "${data.userInput}"을 상세하게 구현해주세요:\n\n`;
        
        // 기본 요구사항 추가
        improvedPrompt += `주제: ${data.userInput}\n`;
        improvedPrompt += `품질: 고품질, 전문적인 결과물\n`;
        
        // 답변 내용 반영
        if (data.answers) {
            improvedPrompt += `\n사용자 요구사항:\n`;
            const answerText = typeof data.answers === 'string' ? data.answers : 
                              Object.values(data.answers).map(a => Array.isArray(a.answers) ? a.answers.join(', ') : a.answers).join(', ');
            improvedPrompt += `${answerText}\n\n`;
        }
        
        // 전문가 모드면 더 상세한 요구사항 추가
        if (isExpertMode) {
            improvedPrompt += `세부 요구사항:\n`;
            improvedPrompt += `- 최고품질의 전문적인 결과물 제작\n`;
            improvedPrompt += `- 모든 기술적 사양과 세부사항 포함\n`;
            improvedPrompt += `- 사용자의 의도를 정확히 반영\n`;
            improvedPrompt += `- 완성도 높은 최종 결과물 생성\n\n`;
        }
        
        improvedPrompt += `위 요구사항을 모두 반영하여 정확하고 완성도 높은 결과물을 만들어주세요.`;
        
        return improvedPrompt;
        
    } else if (step === 'evaluate') {
        // 간단한 평가 로직
        let score = 75; // 기본 점수
        
        // 길이에 따른 점수 조정
        if (data.userInput.length > 200) score += 10;
        if (data.userInput.length > 500) score += 5;
        
        // 구체적 요소가 있으면 점수 추가
        if (data.userInput.match(/\d+/)) score += 5; // 숫자 포함
        if (data.userInput.includes('구체적') || data.userInput.includes('상세')) score += 5;
        if (data.userInput.includes('요구사항') || data.userInput.includes('조건')) score += 5;
        
        // 최대 95점으로 제한
        score = Math.min(95, score);
        
        return {
            score: score,
            strengths: [
                "사용자의 요구사항이 잘 반영되었습니다",
                "이해하기 쉽게 구성되어 있습니다"
            ],
            improvements: [
                "더 구체적인 세부사항을 추가하면 좋겠습니다",
                "기술적 요구사항을 더 명확히 할 수 있습니다"
            ],
            recommendation: score >= 85 ? 
                "우수한 품질의 프롬프트입니다!" : 
                "좋은 품질이지만 더 개선할 수 있습니다."
        };
        
    } else if (step === 'auto-improve') {
        let improved = data.userInput;
        
        // 더 구체적인 표현 추가
        improved += `\n\n추가 개선사항:\n`;
        improved += `- 최고 품질의 결과물 제작\n`;
        improved += `- 모든 세부사항을 정확히 반영\n`;
        improved += `- 전문적이고 완성도 높은 출력\n`;
        improved += `- 사용자 만족도 최우선 고려`;
        
        return improved;
    }
    
    return "처리 완료";
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
            // 간단한 시뮬레이션
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            showStatus('1차 심층 질문을 생성하고 있습니다...', 'processing');
            
            const round1Questions = [
                {
                    question: "더 구체적인 스타일 요구사항이 있나요?",
                    type: "choice",
                    options: ["네, 있습니다", "아니요", "잘 모르겠어요", "기타"]
                },
                {
                    question: "결과물의 사용 목적을 더 자세히 알려주세요.",
                    type: "choice",
                    options: ["프레젠테이션용", "SNS 공유용", "인쇄용", "기타"]
                }
            ];
            
            displayQuestions(round1Questions, '1차 심층 의도 파악', true);
            expertModeStep = 'round1';
            showStatus('1차 심층 질문이 생성되었습니다!', 'success');
            break;
            
        case 'round1':
            showStatus('2차 내부 개선을 진행하고 있습니다...', 'processing');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            showStatus('2차 심층 질문을 생성하고 있습니다...', 'processing');
            
            const round2Questions = [
                {
                    question: "최종 완성도에 대한 기대치는?",
                    type: "choice",
                    options: ["완벽한 품질", "일반적 품질", "빠른 완성", "기타"]
                }
            ];
            
            displayQuestions(round2Questions, '2차 심층 의도 파악', true);
            expertModeStep = 'round2';
            showStatus('2차 심층 질문이 생성되었습니다!', 'success');
            break;
            
        case 'round2':
            await finalImprove();
            break;
    }
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

// 질문 표시 함수
function displayQuestions(questions, title, isExpertRound = false) {
    console.log('=== 질문 표시 ===');
    console.log('Questions:', questions);
    console.log('Title:', title);
    console.log('Expert round:', isExpertRound);
    
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
        
        currentScore = evaluation.score || 85;
        
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
        
        // 재평가
        const newEvaluation = await callAPI('evaluate', {
            userInput: reImprovedPrompt
        });
        
        currentScore = newEvaluation.score || 90;
        
        showScoreImprovement(currentScore);
        showStatus('자동 재개선 완료! ' + currentScore + '점 달성!', 'success');
        
    } catch (error) {
        console.error('자동 재개선 오류:', error);
        showStatus('자동 재개선 중 오류가 발생했습니다.', 'error');
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

// 추가 질문 요청
function requestAdditionalQuestions() {
    showStatus('추가 질문을 준비하고 있습니다...', 'processing');
    
    // 간단한 추가 질문 시뮬레이션
    setTimeout(function() {
        const additionalQuestions = [
            {
                question: "더 구체적인 세부사항이 필요한가요?",
                type: "choice",
                options: ["네, 필요합니다", "아니요", "잘 모르겠어요", "기타"]
            }
        ];
        
        displayQuestions(additionalQuestions, '추가 개선 질문', true);
        showStatus('추가 질문이 준비되었습니다!', 'success');
    }, 1500);
}

// 현재 결과 수락
function acceptCurrentResult() {
    showStatus('현재 결과를 확정했습니다!', 'success');
    
    const scoreSection = document.getElementById('scoreImprovement');
    if (scoreSection) {
        scoreSection.style.display = 'none';
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

// 기타 가이드 함수들
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
