// 전역 변수들
let currentQuestions = [];
let currentAnswers = {};
let originalUserInput = '';
let isProcessing = false;

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
};

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
        showStatus('AI가 더 나은 프롬프트를 위한 질문을 생성하고 있습니다...', 'processing');
        
        const questions = await generateAIQuestions(userInput);
        
        if (questions && questions.length > 0) {
            displayAIQuestions(questions);
            showStatus('질문이 생성되었습니다. 답변해주시면 더 정확한 개선이 가능해요!', 'success');
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

// 이전 결과 완전 초기화
function clearPreviousResults() {
    const aiQuestionsDiv = document.getElementById('aiQuestions');
    const improvedResultDiv = document.getElementById('improvedResult');
    
    if (aiQuestionsDiv) {
        aiQuestionsDiv.style.display = 'none';
    }
    if (improvedResultDiv) {
        improvedResultDiv.style.display = 'none';
    }
    
    if (improvedResultDiv) {
        const dynamicSections = improvedResultDiv.querySelectorAll(
            '.quality-section, .auto-system-section, .final-quality-section, .satisfaction-section'
        );
        dynamicSections.forEach(function(section) {
            section.remove();
        });
    }
    
    currentQuestions = [];
    currentAnswers = {};
    
    window.tempOriginal = null;
    window.tempImproved = null;
    window.tempQualityData = null;
}

// AI 질문 생성
async function generateAIQuestions(userInput) {
    try {
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'questions',
                userInput: userInput
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '질문 생성 실패');
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
function displayAIQuestions(questions) {
    currentQuestions = questions;
    currentAnswers = {};
    
    const questionsContainer = document.getElementById('questionsList');
    const aiMessage = document.getElementById('aiMessage');
    
    if (!questionsContainer || !aiMessage) {
        console.error('질문 컨테이너를 찾을 수 없습니다');
        return;
    }
    
    aiMessage.innerHTML = '더 좋은 프롬프트를 만들기 위해 몇 가지 질문에 답해주세요! (선택사항)';
    
    let questionsHTML = '';
    
    questions.forEach(function(q, index) {
        questionsHTML += '<div class="question-item">';
        questionsHTML += '<div class="question-text">' + escapeHtml(q.question) + '</div>';
        questionsHTML += '<div class="question-options">';
        
        if (q.type === 'choice' && q.options) {
            q.options.forEach(function(option) {
                const safeOption = escapeHtml(option);
                const safeIndex = index.toString();
                questionsHTML += '<button class="option-button" onclick="selectOption(' + safeIndex + ', \'' + safeOption.replace(/'/g, '&apos;') + '\')">';
                questionsHTML += safeOption;
                questionsHTML += '</button>';
            });
        } else {
            questionsHTML += '<input type="text" class="text-input" placeholder="답변을 입력하세요..." onchange="selectOption(' + index + ', this.value)">';
        }
        
        questionsHTML += '</div></div>';
    });
    
    questionsContainer.innerHTML = questionsHTML;
    
    const initialActions = document.getElementById('initialActions');
    const answerChoice = document.getElementById('answerChoice');
    const aiQuestions = document.getElementById('aiQuestions');
    
    if (initialActions) initialActions.style.display = 'flex';
    if (answerChoice) answerChoice.style.display = 'none';
    if (aiQuestions) aiQuestions.style.display = 'block';
}

// HTML 이스케이프 함수
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 옵션 선택
function selectOption(questionIndex, answer) {
    const questionItems = document.querySelectorAll('.question-item');
    if (!questionItems[questionIndex]) return;
    
    const questionItem = questionItems[questionIndex];
    const question = currentQuestions[questionIndex];
    
    if (!question) return;
    
    if (question.type === 'text') {
        currentAnswers[questionIndex] = answer;
        return;
    }
    
    if (!currentAnswers[questionIndex]) {
        currentAnswers[questionIndex] = [];
    }
    
    const buttons = questionItem.querySelectorAll('.option-button');
    const answerIndex = currentAnswers[questionIndex].indexOf(answer);
    
    if (answerIndex === -1) {
        currentAnswers[questionIndex].push(answer);
    } else {
        currentAnswers[questionIndex].splice(answerIndex, 1);
    }
    
    buttons.forEach(function(btn) {
        const btnText = btn.textContent.trim();
        if (currentAnswers[questionIndex].includes(btnText)) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    
    const customInputDiv = questionItem.querySelector('.custom-input');
    
    if (currentAnswers[questionIndex].includes('기타')) {
        if (!customInputDiv) {
            const customInputHTML = '<div class="custom-input" style="margin-top: 10px;">' +
                '<input type="text" class="text-input" placeholder="직접 입력해주세요..." ' +
                'onchange="addCustomAnswer(' + questionIndex + ', this.value)" ' +
                'style="width: 100%; padding: 8px; border: 2px solid #e9ecef; border-radius: 8px;">' +
                '</div>';
            questionItem.querySelector('.question-options').insertAdjacentHTML('beforeend', customInputHTML);
        }
    } else {
        if (customInputDiv) {
            customInputDiv.remove();
            currentAnswers[questionIndex] = currentAnswers[questionIndex].filter(function(item) {
                return item === '기타' || (question.options && question.options.includes(item));
            });
        }
    }
}

// 기타 입력 처리
function addCustomAnswer(questionIndex, customValue) {
    if (customValue && customValue.trim()) {
        if (!currentAnswers[questionIndex]) {
            currentAnswers[questionIndex] = [];
        }
        
        const question = currentQuestions[questionIndex];
        if (question) {
            currentAnswers[questionIndex] = currentAnswers[questionIndex].filter(function(item) {
                return item === '기타' || (question.options && question.options.includes(item));
            });
            
            currentAnswers[questionIndex].push(customValue.trim());
        }
    }
}

// 답변 완료 선택지 표시
function showAnswerChoice() {
    const initialActions = document.getElementById('initialActions');
    const answerChoice = document.getElementById('answerChoice');
    
    if (initialActions) initialActions.style.display = 'none';
    if (answerChoice) answerChoice.style.display = 'block';
}

// 현재 답변으로 진행
async function proceedWithCurrentAnswers() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus('AI가 답변을 바탕으로 프롬프트를 개선하고 있습니다...', 'processing');
        
        const answersText = Object.entries(currentAnswers)
            .map(function(entry) {
                const index = entry[0];
                const answers = entry[1];
                const question = currentQuestions[index] ? currentQuestions[index].question : '';
                const answerText = Array.isArray(answers) ? answers.join(', ') : answers;
                return 'Q' + (parseInt(index) + 1) + ': ' + question + '\nA: ' + answerText;
            })
            .join('\n\n');
        
        await improvePromptWithAnswers(originalUserInput, answersText);
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 더 자세한 질문 요청
async function requestMoreQuestions() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus('AI가 더 자세한 질문을 생성하고 있습니다...', 'processing');
        
        const currentAnswersText = Object.entries(currentAnswers)
            .map(function(entry) {
                const index = entry[0];
                const answers = entry[1];
                const question = currentQuestions[index] ? currentQuestions[index].question : '';
                const answerText = Array.isArray(answers) ? answers.join(', ') : answers;
                return 'Q: ' + question + '\nA: ' + answerText;
            })
            .join('\n\n');
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'additional-questions',
                userInput: originalUserInput,
                previousQuestions: currentQuestions,
                previousAnswers: currentAnswersText
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
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```\s*/, '').replace(/```\s*$/, '');
        }
        
        const parsed = JSON.parse(jsonStr);
        
        if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            const startIndex = currentQuestions.length;
            currentQuestions = currentQuestions.concat(parsed.questions);
            
            const questionsContainer = document.getElementById('questionsList');
            if (questionsContainer) {
                let newQuestionsHTML = '';
                
                parsed.questions.forEach(function(q, index) {
                    const realIndex = startIndex + index;
                    const safeQuestion = escapeHtml(q.question);
                    
                    newQuestionsHTML += '<div class="question-item new-question">';
                    newQuestionsHTML += '<div class="question-text">' + safeQuestion + '</div>';
                    newQuestionsHTML += '<div class="question-options">';
                    
                    if (q.type === 'choice' && q.options) {
                        q.options.forEach(function(option) {
                            const safeOption = escapeHtml(option);
                            newQuestionsHTML += '<button class="option-button" onclick="selectOption(' + realIndex + ', \'' + safeOption.replace(/'/g, '&apos;') + '\')">';
                            newQuestionsHTML += safeOption;
                            newQuestionsHTML += '</button>';
                        });
                    } else {
                        newQuestionsHTML += '<input type="text" class="text-input" placeholder="답변을 입력하세요..." onchange="selectOption(' + realIndex + ', this.value)">';
                    }
                    
                    newQuestionsHTML += '</div></div>';
                });
                
                questionsContainer.insertAdjacentHTML('beforeend', newQuestionsHTML);
            }
            
            const answerChoice = document.getElementById('answerChoice');
            const initialActions = document.getElementById('initialActions');
            
            if (answerChoice) answerChoice.style.display = 'none';
            if (initialActions) initialActions.style.display = 'flex';
            
            showStatus('추가 질문이 생성되었습니다! 더 자세히 답변해주세요.', 'success');
        } else {
            showStatus('추가 질문 생성에 실패했습니다. 현재 답변으로 개선을 진행하겠습니다.', 'processing');
            await proceedWithCurrentAnswers();
        }
        
    } catch (error) {
        console.error('추가 질문 생성 오류:', error);
        showStatus('추가 질문 생성 중 오류가 발생했습니다. 현재 답변으로 진행하겠습니다.', 'processing');
        await proceedWithCurrentAnswers();
    } finally {
        isProcessing = false;
    }
}

// 질문 건너뛰기
async function skipAllQuestions() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus('프롬프트를 개선하고 있습니다...', 'processing');
        await directImprovePrompt(originalUserInput);
    } catch (error) {
        console.error('Error:', error);
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 기존 함수 호환성
async function skipAIQuestions() {
    await skipAllQuestions();
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
                answers: answersText
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
                userInput: originalPrompt
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
    
    if (improvedResult) {
        const dynamicSections = improvedResult.querySelectorAll('.satisfaction-section');
        dynamicSections.forEach(function(section) {
            section.remove();
        });
    }
    
    showStatus('프롬프트 개선이 완료되었습니다! 품질을 검증하고 있습니다...', 'processing');
    
    setTimeout(function() {
        autoQualityCheck(original, improved);
    }, 1500);
}

// 자동 품질 검증
async function autoQualityCheck(original, improved) {
    try {
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'evaluate',
                userInput: improved,
                originalInput: original
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '품질 검증 실패');
        }

        const qualityData = parseQualityResponse(data.result);
        displayQualityResult(qualityData, original, improved);
        
    } catch (error) {
        console.error('품질 검증 오류:', error);
        showStatus('프롬프트 개선이 완료되었습니다! (품질 검증 오류)', 'success');
        setTimeout(function() {
            askSatisfaction();
        }, 1000);
    }
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
            score: 70,
            strengths: ["기본적인 개선 완료"],
            improvements: ["더 구체적인 요구사항 필요"],
            needsReimprovement: false,
            recommendation: "현재 수준에서 사용 가능"
        };
    }
}

// 품질 결과 표시 (중첩 템플릿 리터럴 문제 해결)
function displayQualityResult(qualityData, original, improved) {
    const resultDiv = document.getElementById('improvedResult');
    if (!resultDiv) return;
    
    let scoreColor = '#28a745';
    if (qualityData.score < 85) scoreColor = '#ffc107';
    if (qualityData.score < 70) scoreColor = '#dc3545';
    
    // 강점 HTML 생성
    let strengthsHTML = '';
    if (qualityData.strengths && Array.isArray(qualityData.strengths)) {
        qualityData.strengths.forEach(function(strength) {
            strengthsHTML += '<p style="margin: 4px 0; font-size: 14px;">• ' + escapeHtml(strength) + '</p>';
        });
    }
    
    // 개선점 HTML 생성
    let improvementsHTML = '';
    if (qualityData.improvements && Array.isArray(qualityData.improvements)) {
        qualityData.improvements.forEach(function(improvement) {
            improvementsHTML += '<p style="margin: 4px 0; font-size: 14px;">• ' + escapeHtml(improvement) + '</p>';
        });
    }
    
    const qualityHTML = 
        '<div class="quality-section" style="margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 15px; border: 2px solid ' + scoreColor + ';">' +
            '<h4 style="color: #333; text-align: center; margin-bottom: 15px;">' +
                '🎯 AI 품질 평가: <span style="color: ' + scoreColor + '; font-size: 24px;">' + qualityData.score + '/100점</span>' +
            '</h4>' +
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">' +
                '<div style="background: white; padding: 15px; border-radius: 10px; border-left: 4px solid #28a745;">' +
                    '<h5 style="color: #28a745; margin-bottom: 8px;">✅ 강점</h5>' +
                    strengthsHTML +
                '</div>' +
                '<div style="background: white; padding: 15px; border-radius: 10px; border-left: 4px solid #ffc107;">' +
                    '<h5 style="color: #ffc107; margin-bottom: 8px;">🔧 개선점</h5>' +
                    improvementsHTML +
                '</div>' +
            '</div>' +
            '<div style="background: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">' +
                '<h5 style="color: #667eea; margin-bottom: 8px;">💡 개선 권장사항</h5>' +
                '<p style="margin: 0; font-size: 14px;">' + escapeHtml(qualityData.recommendation || '') + '</p>' +
            '</div>' +
        '</div>';
    
    resultDiv.insertAdjacentHTML('beforeend', qualityHTML);
    
    if (qualityData.score < 95) {
        showAutoFullSystem(original, improved, qualityData);
    } else {
        showStatus('완벽한 품질입니다! (' + qualityData.score + '/100점)', 'success');
        setTimeout(function() {
            askSatisfaction();
        }, 500);
    }
}

// 완전 자동화 시스템 표시
function showAutoFullSystem(original, improved, qualityData) {
    const resultDiv = document.getElementById('improvedResult');
    if (!resultDiv) return;
    
    window.tempOriginal = original;
    window.tempImproved = improved;
    window.tempQualityData = qualityData;
    
    const autoSystemHTML = 
        '<div class="auto-system-section" style="text-align: center; margin-top: 15px; padding: 20px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 15px; color: white;">' +
            '<h4 style="margin-bottom: 15px; color: white;">🤖 완전 자동화 시스템</h4>' +
            '<p style="margin-bottom: 15px; opacity: 0.9;">현재 ' + qualityData.score + '점입니다. AI가 95점 이상까지 자동으로 개선하겠습니다!</p>' +
            '<div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">' +
                '<button class="search-button" onclick="startFullAutoImprovement();" style="background: #28a745;">' +
                    '🚀 AI 완전 자동 개선 (재질문 + 다중 개선)' +
                '</button>' +
                '<button class="search-button" onclick="startQuickAutoImprovement();" style="background: #ffc107; color: #212529;">' +
                    '⚡ 빠른 자동 개선 (1회 개선)' +
                '</button>' +
                '<button class="search-button" onclick="proceedWithCurrent();" style="background: #6c757d;">' +
                    '✋ 현재 버전 사용' +
                '</button>' +
            '</div>' +
        '</div>';
    
    resultDiv.insertAdjacentHTML('beforeend', autoSystemHTML);
}

// 완전 자동 개선
async function startFullAutoImprovement() {
    if (isProcessing) return;
    
    const original = window.tempOriginal;
    const improved = window.tempImproved; 
    const qualityData = window.tempQualityData;
    
    if (!original || !improved || !qualityData) {
        showStatus('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
        return;
    }
    
    isProcessing = true;
    let currentImproved = improved;
    let attempts = 0;
    const maxAttempts = 3;
    
    try {
        removeAutoSections();
        
        showStatus('🤖 AI가 완전 자동 모드로 95점급 프롬프트를 만들고 있습니다...', 'processing');
        
        while (attempts < maxAttempts) {
            attempts++;
            
            showStatus('🔄 자동 개선 ' + attempts + '회차: AI가 스스로 재질문하고 개선 중...', 'processing');
            
            const response = await fetch('/api/improve-prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    step: 'auto-improve',
                    userInput: currentImproved,
                    originalInput: original,
                    currentScore: qualityData.score,
                    attempt: attempts
                })
            });

            if (!response.ok) {
                throw new Error('서버 오류: ' + response.status);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || '자동 개선 실패');
            }

            currentImproved = data.result;
            
            const newQuality = await quickQualityCheck(original, currentImproved);
            
            showStatus('🎯 ' + attempts + '회차 완료: ' + newQuality.score + '/100점 달성', 'processing');
            
            if (newQuality.score >= 95) {
                showStatus('🎉 ' + attempts + '회차만에 95점 달성! 완전 자동 개선 완료!', 'success');
                
                const improvedText = document.getElementById('improvedText');
                if (improvedText) improvedText.textContent = currentImproved;
                
                await showFinalQualityResult(original, currentImproved, newQuality, attempts);
                break;
            }
            
            if (attempts >= maxAttempts) {
                showStatus('⚡ ' + maxAttempts + '회 개선 완료: 최종 ' + newQuality.score + '/100점', 'success');
                const improvedText = document.getElementById('improvedText');
                if (improvedText) improvedText.textContent = currentImproved;
                await showFinalQualityResult(original, currentImproved, newQuality, attempts);
            }
        }
        
    } catch (error) {
        console.error('완전 자동 개선 오류:', error);
        showStatus('완전 자동 개선 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 빠른 자동 개선
async function startQuickAutoImprovement() {
    if (isProcessing) return;
    
    const original = window.tempOriginal;
    const improved = window.tempImproved;
    const qualityData = window.tempQualityData;
    
    if (!original || !improved || !qualityData) {
        showStatus('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
        return;
    }
    
    isProcessing = true;
    
    try {
        removeAutoSections();
        
        showStatus('⚡ AI가 빠른 자동 개선을 실행 중입니다...', 'processing');
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'auto-improve',
                userInput: improved,
                originalInput: original,
                currentScore: qualityData.score,
                quickMode: true
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '빠른 개선 실패');
        }

        const quickImproved = data.result;
        
        const improvedText = document.getElementById('improvedText');
        if (improvedText) improvedText.textContent = quickImproved;
        
        const finalQuality = await quickQualityCheck(original, quickImproved);
        
        showStatus('🎉 빠른 자동 개선 완료: ' + finalQuality.score + '/100점 달성!', 'success');
        
        await showFinalQualityResult(original, quickImproved, finalQuality, 1);
        
    } catch (error) {
        console.error('빠른 자동 개선 오류:', error);
        showStatus('빠른 자동 개선 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// 빠른 품질 확인
async function quickQualityCheck(original, improved) {
    try {
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'evaluate',
                userInput: improved,
                originalInput: original,
                quickMode: true
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '품질 확인 실패');
        }

        const parsed = parseQualityResponse(data.result);
        return {
            score: parsed.score || 70,
            feedback: parsed.feedback || parsed.recommendation || '개선되었습니다'
        };
    } catch (e) {
        return { score: 70, feedback: '품질 확인 완료' };
    }
}

// 최종 품질 결과 표시
async function showFinalQualityResult(original, finalImproved, qualityData, attempts) {
    const resultDiv = document.getElementById('improvedResult');
    if (!resultDiv) return;
    
    const finalHTML = 
        '<div class="final-quality-section" style="text-align: center; margin-top: 15px; padding: 20px; background: linear-gradient(135deg, #28a745, #20c997); border-radius: 15px; color: white;">' +
            '<h4 style="color: white; margin-bottom: 15px;">' +
                '🏆 자동 개선 완료: ' + qualityData.score + '/100점 (' + attempts + '회차)' +
            '</h4>' +
            '<p style="margin: 0; opacity: 0.9;">' + escapeHtml(qualityData.feedback || '') + '</p>' +
            '<p style="margin-top: 10px; font-size: 14px; opacity: 0.8;">AI가 스스로 재질문하고 개선한 결과입니다!</p>' +
        '</div>';
    
    resultDiv.insertAdjacentHTML('beforeend', finalHTML);
    
    setTimeout(function() {
        askSatisfaction();
    }, 1000);
}

// 자동화 섹션들 제거
function removeAutoSections() {
    const resultDiv = document.getElementById('improvedResult');
    if (!resultDiv) return;
    
    const sectionsToRemove = resultDiv.querySelectorAll('.auto-system-section, .final-quality-section');
    sectionsToRemove.forEach(function(section) {
        section.remove();
    });
}

// 현재 버전으로 진행
function proceedWithCurrent() {
    const autoSection = document.querySelector('#improvedResult .auto-system-section');
    if (autoSection) {
        autoSection.remove();
    }
    
    showStatus('현재 프롬프트를 사용합니다!', 'success');
    askSatisfaction();
}

// 만족도 질문 표시
function askSatisfaction() {
    const resultDiv = document.getElementById('improvedResult');
    if (!resultDiv) return;
    
    const existingSatisfaction = resultDiv.querySelector('.satisfaction-section');
    if (existingSatisfaction) {
        existingSatisfaction.remove();
    }
    
    const satisfactionHTML = 
        '<div class="satisfaction-section" style="text-align: center; margin-top: 20px; padding: 20px; background: #f0f8ff; border-radius: 10px;">' +
            '<h4 style="color: #333; margin-bottom: 15px;">🤔 개선된 프롬프트가 만족스러우신가요?</h4>' +
            '<button class="search-button" onclick="satisfied()" style="background: #28a745; margin: 0 10px;">😊 만족해요!</button>' +
            '<button class="search-button" onclick="requestReimprovement()" style="background: #ffc107; color: #212529; margin: 0 10px;">🔄 다시 개선해주세요</button>' +
        '</div>';
    
    resultDiv.insertAdjacentHTML('beforeend', satisfactionHTML);
}

// 만족 처리
function satisfied() {
    showStatus('감사합니다! 개선된 프롬프트를 잘 활용해보세요! 🎉', 'success');
    
    const satisfactionDiv = document.querySelector('#improvedResult .satisfaction-section');
    if (satisfactionDiv) {
        satisfactionDiv.remove();
    }
}

// 재개선 요청
async function requestReimprovement() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        showStatus('더 나은 프롬프트로 다시 개선하고 있습니다...', 'processing');
        
        const improvedText = document.getElementById('improvedText');
        const currentImproved = improvedText ? improvedText.textContent : '';
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                step: 'auto-improve',
                userInput: currentImproved,
                originalInput: originalUserInput,
                reImprove: true
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류: ' + response.status);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '재개선 실패');
        }

        const reImprovedPrompt = data.result;
        
        if (improvedText) improvedText.textContent = reImprovedPrompt;
        
        const satisfactionDiv = document.querySelector('#improvedResult .satisfaction-section');
        if (satisfactionDiv) {
            satisfactionDiv.remove();
        }
        
        showStatus('새로운 버전으로 재개선이 완료되었습니다!', 'success');
        
        setTimeout(function() {
            askSatisfaction();
        }, 1000);
        
    } catch (error) {
        console.error('재개선 오류:', error);
        showStatus('재개선 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        isProcessing = false;
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
    showStatus('초기화가 완료되었습니다.', 'success');
}

// 사용법 가이드 모달 함수들
function showDetailedGuide() {
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeDetailedGuide() {
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 모달 외부 클릭시 닫기
window.onclick = function(event) {
    const modal = document.getElementById('guideModal');
    if (modal && event.target === modal) {
        modal.style.display = 'none';
    }
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
    
    statusDiv.className = '';
    
    switch(type) {
        case 'success':
            statusDiv.className = 'status-message status-success';
            break;
        case 'error':
            statusDiv.className = 'status-message status-error';
            break;
        case 'processing':
            statusDiv.className = 'status-message';
            statusDiv.style.background = '#e3f2fd';
            statusDiv.style.color = '#1976d2';
            statusDiv.style.border = '1px solid #bbdefb';
            break;
        default:
            statusDiv.className = 'status-message';
    }
    
    if (type === 'success' || type === 'error') {
        setTimeout(function() {
            if (statusDiv) statusDiv.style.display = 'none';
        }, 3000);
    }
}
