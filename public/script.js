// 🎯 완전히 수정된 script.js - 문법 오류 해결
const $ = (id) => document.getElementById(id);

// 전역 상태
const state = {
  domain: "image",
  userInput: "",
  answers: [],
  currentQuestions: [],
  isProcessing: false
};

// 🚀 초기화
document.addEventListener('DOMContentLoaded', function() {
  console.log('🎯 프롬프트 개선기 시작');
  initializeApp();
});

function initializeApp() {
  console.log('📱 앱 초기화');
  
  // 시작 버튼 이벤트
  const startBtn = $("startBtn");
  if (startBtn) {
    startBtn.onclick = startImprovement;
    console.log('✅ 시작 버튼 연결됨');
  } else {
    console.error('❌ 시작 버튼을 찾을 수 없음');
  }
  
  // 도메인 선택 이벤트
  const domainSelect = $("domain");
  if (domainSelect) {
    domainSelect.onchange = (e) => {
      state.domain = e.target.value;
      console.log('📂 도메인 변경:', state.domain);
    };
  }
  
  // 엔터키 이벤트
  const userInputField = $("userInput");
  if (userInputField) {
    userInputField.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        startImprovement();
      }
    });
  }
}

// 🚀 메인: 프롬프트 개선 시작
async function startImprovement() {
  console.log('🚀 프롬프트 개선 시작');
  
  // 입력값 체크
  const userInputField = $("userInput");
  if (!userInputField) {
    showError('입력 필드를 찾을 수 없습니다.');
    return;
  }
  
  state.userInput = userInputField.value.trim();
  if (!state.userInput) {
    showError('프롬프트를 입력해주세요.');
    userInputField.focus();
    return;
  }
  
  if (state.userInput.length < 2) {
    showError('최소 2글자 이상 입력해주세요.');
    return;
  }
  
  // 상태 초기화
  state.answers = [];
  state.currentQuestions = [];
  hideAllSections();
  
  console.log('📊 입력 정보:', {
    input: state.userInput,
    domain: state.domain
  });
  
  // API 호출
  await processImprovement();
}

// 🔄 프롬프트 개선 처리
async function processImprovement() {
  console.log('🔄 API 호출 시작');
  
  if (state.isProcessing) {
    console.log('⚠️ 이미 처리 중');
    return;
  }
  
  state.isProcessing = true;
  showLoading('AI가 프롬프트를 분석하고 있습니다...');
  
  try {
    const requestData = {
      userInput: state.userInput,
      answers: state.answers,
      domain: state.domain
    };
    
    console.log('📤 요청 데이터:', requestData);
    
    const response = await fetch('/api/improve-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    console.log('📡 API 응답 상태:', response.status);
    
    const result = await response.json();
    console.log('📨 API 응답 데이터:', result);
    
    hideLoading();
    
    if (result.success) {
      // ✅ 성공 - 개선된 프롬프트 표시
      showSuccess(result);
    } else if (result.action === 'need_more_info') {
      // ❓ 정보 부족 - 추가 질문 표시
      showMoreQuestions(result);
    } else if (result.error) {
      // ❌ 오류 - 실패 안내
      showFailure(result);
    } else {
      // 예상치 못한 응답
      showError('예상치 못한 응답 형식입니다.');
    }
    
  } catch (error) {
    console.error('❌ 네트워크 오류:', error);
    hideLoading();
    showNetworkError();
  } finally {
    state.isProcessing = false;
  }
}

// ✅ 성공 결과 표시
function showSuccess(result) {
  console.log('✅ 성공 결과 표시');
  
  const successHTML = `
    <div class="success-container">
      <div class="success-header">
        <h2>🎉 완성!</h2>
        <div class="score-badge">점수: ${result.score}점</div>
      </div>
      
      <div class="original-prompt">
        <h3>📝 원본 프롬프트</h3>
        <div class="prompt-text original">${escapeHtml(state.userInput)}</div>
        ${state.answers.length > 0 ? `
          <div class="additional-info">
            <strong>추가 정보:</strong> ${escapeHtml(state.answers.join(', '))}
          </div>
        ` : ''}
      </div>
      
      <div class="improved-prompt">
        <h3>✨ AI가 개선한 프롬프트</h3>
        <div class="prompt-text improved">${escapeHtml(result.improved)}</div>
        <div class="improvement-stats">
          <span class="stat">원본: ${state.userInput.length}자</span>
          <span class="stat">개선: ${result.improved.length}자</span>
          <span class="stat">${result.method || 'AI 개선'}</span>
        </div>
      </div>
      
      <div class="action-buttons">
        <button class="btn btn-primary" onclick="copyToClipboard()">
          📋 복사하기
        </button>
        <button class="btn btn-secondary" onclick="startNew()">
          🔄 새로 만들기
        </button>
      </div>
    </div>
  `;
  
  const finalSection = $("final");
  if (finalSection) {
    finalSection.innerHTML = successHTML;
    finalSection.classList.remove("hidden");
  }
  
  // 복사용 데이터 저장
  window.lastImproved = result.improved;
  
  // 자동 스크롤
  finalSection.scrollIntoView({ behavior: 'smooth' });
}

// ❓ 추가 질문 표시
function showMoreQuestions(result) {
  console.log('❓ 추가 질문 표시:', result.questions);
  
  if (!result.questions || result.questions.length === 0) {
    showError('질문을 생성할 수 없습니다.');
    return;
  }
  
  state.currentQuestions = result.questions;
  
  const questionsHTML = `
    <div class="questions-container">
      <div class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${result.completeness || 0}%"></div>
        </div>
        <p class="progress-text">${result.message || '추가 정보가 필요합니다'}</p>
      </div>
      
      <div class="questions-list">
        ${result.questions.map((q, index) => `
          <div class="question-item" data-key="${q.key || index}">
            <h4 class="question-title">${escapeHtml(q.question)}</h4>
            <p class="question-hint">${escapeHtml(q.placeholder || '')}</p>
            
            ${q.options ? `
              <div class="quick-options">
                ${q.options.map(option => `
                  <button class="option-btn" data-value="${escapeHtml(option)}" onclick="selectOption('${q.key || index}', '${escapeHtml(option)}')">
                    ${escapeHtml(option)}
                  </button>
                `).join('')}
              </div>
            ` : ''}
            
            <div class="custom-input" id="custom-${q.key || index}" style="display: none;">
              <input type="text" placeholder="${escapeHtml(q.placeholder || '답변을 입력하세요')}" id="input-${q.key || index}" />
              <button class="btn btn-small" onclick="submitCustomAnswer('${q.key || index}')">확인</button>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="questions-footer">
        <button class="btn btn-primary" onclick="submitAllAnswers()" disabled id="submitBtn">
          답변 완료
        </button>
        <button class="btn btn-secondary" onclick="skipQuestions()">
          현재 정보로 진행
        </button>
      </div>
    </div>
  `;
  
  const questionsSection = $("questions");
  if (questionsSection) {
    questionsSection.innerHTML = questionsHTML;
    questionsSection.classList.remove("hidden");
    questionsSection.scrollIntoView({ behavior: 'smooth' });
  }
}

// 🎯 옵션 선택 처리
function selectOption(questionKey, selectedValue) {
  console.log('🎯 옵션 선택:', questionKey, selectedValue);
  
  if (selectedValue === '직접 입력') {
    // 커스텀 입력 필드 표시
    const customDiv = $(`custom-${questionKey}`);
    if (customDiv) {
      customDiv.style.display = 'block';
      const inputField = $(`input-${questionKey}`);
      if (inputField) {
        inputField.focus();
      }
    }
  } else {
    // 바로 답변 설정
    setAnswer(questionKey, selectedValue);
  }
}

// ✍️ 커스텀 답변 제출
function submitCustomAnswer(questionKey) {
  const inputField = $(`input-${questionKey}`);
  if (!inputField) return;
  
  const inputValue = inputField.value.trim();
  if (!inputValue) {
    alert('답변을 입력해주세요.');
    inputField.focus();
    return;
  }
  
  console.log('✍️ 커스텀 답변:', questionKey, inputValue);
  setAnswer(questionKey, inputValue);
}

// 📝 답변 설정
function setAnswer(questionKey, answerValue) {
  console.log('📝 답변 설정:', questionKey, '=', answerValue);
  
  // 기존 답변 제거 후 새 답변 추가
  state.answers = state.answers.filter(a => !a.startsWith(`${questionKey}:`));
  state.answers.push(`${questionKey}: ${answerValue}`);
  
  // UI 업데이트 - 해당 질문을 완료 상태로 표시
  const questionDiv = document.querySelector(`[data-key="${questionKey}"]`);
  if (questionDiv) {
    questionDiv.classList.add('answered');
    
    // 기존 답변 표시 제거
    const existingAnswer = questionDiv.querySelector('.selected-answer');
    if (existingAnswer) {
      existingAnswer.remove();
    }
    
    // 새 답변 표시 추가
    const answerDisplay = document.createElement('div');
    answerDisplay.className = 'selected-answer';
    answerDisplay.innerHTML = `<strong>선택:</strong> ${escapeHtml(answerValue)} ✓`;
    questionDiv.appendChild(answerDisplay);
    
    // 옵션 버튼들 비활성화
    const optionButtons = questionDiv.querySelectorAll('.option-btn');
    optionButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
    });
    
    // 커스텀 입력 숨김
    const customInput = questionDiv.querySelector('.custom-input');
    if (customInput) {
      customInput.style.display = 'none';
    }
  }
  
  // 제출 버튼 활성화
  updateSubmitButton();
}

// 🔄 제출 버튼 상태 업데이트
function updateSubmitButton() {
  const submitBtn = $("submitBtn");
  if (!submitBtn) return;
  
  const answeredCount = state.answers.length;
  const totalQuestions = state.currentQuestions.length;
  
  if (answeredCount > 0) {
    submitBtn.disabled = false;
    submitBtn.textContent = `답변 완료 (${answeredCount}/${totalQuestions})`;
  } else {
    submitBtn.disabled = true;
    submitBtn.textContent = '답변 완료';
  }
}

// 📤 모든 답변 제출
async function submitAllAnswers() {
  console.log('📤 답변 제출:', state.answers);
  
  if (state.answers.length === 0) {
    alert('최소 1개 이상의 질문에 답변해주세요.');
    return;
  }
  
  hideAllSections();
  await processImprovement();
}

// ⏭️ 질문 건너뛰기
async function skipQuestions() {
  console.log('⏭️ 질문 건너뛰기');
  
  const confirmSkip = confirm('현재 정보만으로 프롬프트를 만드시겠습니까?\n완성도가 낮을 수 있습니다.');
  if (!confirmSkip) return;
  
  hideAllSections();
  await processImprovement();
}

// ❌ 실패 안내 표시
function showFailure(result) {
  console.log('❌ 실패 결과 표시:', result);
  
  const failureHTML = `
    <div class="failure-container">
      <div class="failure-icon">😞</div>
      <h2 class="failure-title">${result.title || '오류 발생'}</h2>
      <p class="failure-message">${result.message || '문제가 발생했습니다.'}</p>
      <p class="failure-suggestion">${result.suggestion || '잠시 후 다시 시도해주세요.'}</p>
      
      <div class="failure-actions">
        ${result.canRetry !== false ? `
          <button class="btn btn-primary" onclick="retryImprovement()">
            🔄 다시 시도
          </button>
        ` : ''}
        <button class="btn btn-secondary" onclick="goBack()">
          ← 돌아가기
        </button>
      </div>
      
      ${result.canRetry === false ? `
        <div class="wait-notice">
          <p>⏰ 보통 몇 시간 후에 다시 정상화됩니다</p>
        </div>
      ` : ''}
    </div>
  `;
  
  const finalSection = $("final");
  if (finalSection) {
    finalSection.innerHTML = failureHTML;
    finalSection.classList.remove("hidden");
  }
}

// 🌐 네트워크 오류 표시
function showNetworkError() {
  console.log('🌐 네트워크 오류 표시');
  
  const errorResult = {
    title: '🌐 연결 오류',
    message: '인터넷 연결을 확인해주세요.',
    suggestion: '네트워크 상태를 확인하고 다시 시도해주세요.',
    canRetry: true
  };
  
  showFailure(errorResult);
}

// 🔄 재시도
async function retryImprovement() {
  console.log('🔄 재시도');
  hideAllSections();
  await processImprovement();
}

// ← 돌아가기
function goBack() {
  console.log('← 돌아가기');
  hideAllSections();
  
  const userInputField = $("userInput");
  if (userInputField) {
    userInputField.focus();
  }
  
  // 부분 리셋 (사용자 입력은 유지)
  state.answers = [];
  state.currentQuestions = [];
}

// 🔄 새로 만들기
function startNew() {
  console.log('🔄 새로 만들기');
  
  // 전체 상태 리셋
  state.userInput = "";
  state.answers = [];
  state.currentQuestions = [];
  
  // UI 리셋
  const userInputField = $("userInput");
  if (userInputField) {
    userInputField.value = "";
    userInputField.focus();
  }
  
  hideAllSections();
  window.lastImproved = null;
}

// 📋 클립보드에 복사
async function copyToClipboard() {
  if (!window.lastImproved) {
    alert('복사할 내용이 없습니다.');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(window.lastImproved);
    
    // 성공 피드백
    const copyBtn = document.querySelector('.btn.btn-primary');
    if (copyBtn && copyBtn.textContent.includes('📋')) {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✅ 복사됨!';
      copyBtn.style.background = '#28a745';
      
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.background = '';
      }, 2000);
    }
    
    console.log('📋 클립보드 복사 성공');
  } catch (error) {
    console.error('📋 클립보드 복사 실패:', error);
    
    // 폴백: 텍스트 선택
    try {
      const textArea = document.createElement('textarea');
      textArea.value = window.lastImproved;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('클립보드에 복사되었습니다!');
    } catch (fallbackError) {
      console.error('폴백 복사도 실패:', fallbackError);
      alert('복사에 실패했습니다. 텍스트를 직접 선택해서 복사해주세요.');
    }
  }
}

// 🎨 UI 유틸리티 함수들
function hideAllSections() {
  const sections = ['questions', 'final'];
  sections.forEach(sectionId => {
    const section = $(sectionId);
    if (section) {
      section.classList.add('hidden');
    }
  });
}

function showLoading(message) {
  const loadingHTML = `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-message">${escapeHtml(message)}</p>
    </div>
  `;
  
  const questionsSection = $("questions");
  if (questionsSection) {
    questionsSection.innerHTML = loadingHTML;
    questionsSection.classList.remove("hidden");
  }
}

function hideLoading() {
  // 로딩은 다른 콘텐츠로 교체될 때 자동으로 숨겨짐
}

function showError(message) {
  alert(message);
  console.error('❌ 에러:', message);
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 디버깅용 함수 (개발 모드에서만)
if (typeof window !== 'undefined') {
  window.debugState = () => {
    console.log('🎯 현재 상태:', state);
  };
  window.state = state;
}

console.log('✅ Script 로드 완료!');
