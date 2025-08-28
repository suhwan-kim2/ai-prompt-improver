// 현재 구조를 유지하면서 제안된 개선사항 적용
const $ = (id) => document.getElementById(id);

// 전역 상태
const state = {
  domain: "image",
  userInput: "",
  answers: [],
  currentQuestions: [],
  isProcessing: false
};

// 🔥 제안된 공통 POST 유틸 (핵심)
async function postJSON(url, data, timeoutMs = 20000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",                         // ★ 반드시 POST
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    
    if (!res.ok) {
      // 서버가 JSON 에러를 주는 경우 파싱
      let err;
      try { 
        err = await res.json(); 
      } catch (_) {
        err = { message: `HTTP ${res.status}` };
      }
      throw new Error(err?.message || `HTTP ${res.status}`);
    }
    
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', function() {
  console.log('프롬프트 개선기 시작');
  initializeApp();
});

function initializeApp() {
  console.log('앱 초기화');
  
  const startBtn = $("startBtn");
  if (startBtn) {
    startBtn.onclick = startImprovement;
  }
  
  const domainSelect = $("domain");
  if (domainSelect) {
    domainSelect.onchange = (e) => {
      state.domain = e.target.value;
      console.log('도메인 변경:', state.domain);
    };
  }
  
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

// 🚀 개선된 메인 함수 - 2단계 프로세스 지원
async function startImprovement() {
  console.log('프롬프트 개선 시작');
  
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
  
  console.log('입력 정보:', {
    input: state.userInput,
    domain: state.domain
  });
  
  await processImprovement();
}

// 🔄 개선된 프롬프트 처리 - 2단계 지원
async function processImprovement() {
  console.log('API 호출 시작');
  
  if (state.isProcessing) {
    console.log('이미 처리 중');
    return;
  }
  
  state.isProcessing = true;
  showLoading('AI가 프롬프트를 분석하고 있습니다...');
  
  try {
    // API가 2단계를 지원하는지 확인 후 분기
    const apiSupports2Steps = await checkAPICapability();
    
    if (apiSupports2Steps) {
      await handle2StepProcess();
    } else {
      await handle1StepProcess();
    }
    
  } catch (error) {
    console.error('네트워크 오류:', error);
    hideLoading();
    
    if (error.name === 'AbortError') {
      showNetworkError('연결 시간 초과', '20초 이내에 응답을 받지 못했습니다.');
    } else {
      showNetworkError('연결 오류', error.message);
    }
  } finally {
    state.isProcessing = false;
  }
}

// API 지원 기능 확인
async function checkAPICapability() {
  // 간단한 테스트 호출로 API 버전 확인
  try {
    const testData = {
      step: "questions",
      domain: state.domain,
      userInput: "test",
      answers: []
    };
    
    // 아주 짧은 타임아웃으로 테스트
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1000);
    
    const response = await fetch('/api/improve-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData),
      signal: controller.signal
    });
    
    // step 파라미터를 이해하면 2단계 지원
    return response.status !== 400;
    
  } catch (error) {
    // 에러가 나면 1단계만 지원한다고 가정
    return false;
  }
}

// 2단계 프로세스 처리
async function handle2StepProcess() {
  console.log('2단계 프로세스 시작');
  
  try {
    // 1단계: 질문 생성
    const questionData = {
      step: "questions",
      domain: state.domain,
      userInput: state.userInput,
      answers: state.answers,
      askedKeys: []
    };
    
    const qRes = await postJSON("/api/improve-prompt", questionData);
    hideLoading();
    
    // 질문이 있으면 사용자 응답 대기
    if (Array.isArray(qRes?.questions) && qRes.questions.length > 0) {
      console.log('질문 단계:', qRes.questions.length + '개');
      showMoreQuestions(qRes);
      return;
    }
    
    // 질문이 없으면 바로 최종 단계
    if (qRes?.shouldProceedToFinal) {
      console.log('질문 생략하고 최종 단계로');
      await generateFinalPrompt();
      return;
    }
    
    // 예상치 못한 응답
    showError('예상치 못한 응답 형식입니다.');
    
  } catch (error) {
    hideLoading();
    handleAPIError(error);
  }
}

// 1단계 프로세스 처리 (기존 방식)
async function handle1StepProcess() {
  console.log('1단계 프로세스 시작');
  
  try {
    const requestData = {
      userInput: state.userInput,
      answers: state.answers,
      domain: state.domain
    };
    
    const result = await postJSON('/api/improve-prompt', requestData);
    hideLoading();
    
    if (result.success) {
      showSuccess(result);
    } else if (result.action === 'need_more_info') {
      showMoreQuestions(result);
    } else if (result.error) {
      showFailure(result);
    } else {
      showError('예상치 못한 응답 형식입니다.');
    }
    
  } catch (error) {
    hideLoading();
    handleAPIError(error);
  }
}

// 최종 프롬프트 생성 (2단계용)
async function generateFinalPrompt() {
  console.log('최종 프롬프트 생성');
  
  showLoading('최종 프롬프트를 생성하고 있습니다...');
  
  try {
    const finalData = {
      step: "final",
      domain: state.domain,
      userInput: state.userInput,
      answers: state.answers
    };
    
    const finalRes = await postJSON("/api/improve-prompt", finalData);
    hideLoading();
    
    if (finalRes.success) {
      showSuccess(finalRes);
    } else {
      showFailure(finalRes);
    }
    
  } catch (error) {
    hideLoading();
    handleAPIError(error);
  }
}

// 답변 제출 처리 (2단계용)
async function submitAllAnswers() {
  console.log('답변 제출:', state.answers);
  
  if (state.answers.length === 0) {
    alert('최소 1개 이상의 질문에 답변해주세요.');
    return;
  }
  
  hideAllSections();
  await generateFinalPrompt();
}

// 🎨 기존 UI 함수들 유지
function showSuccess(result) {
  console.log('성공 결과 표시');
  
  const successHTML = `
    <div class="success-container">
      <div class="success-header">
        <h2>🎉 완성!</h2>
        <div class="score-badge">점수: ${result.score || result.promptScore || 95}점</div>
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
    finalSection.scrollIntoView({ behavior: 'smooth' });
  }
  
  window.lastImproved = result.improved;
}

function showMoreQuestions(result) {
  console.log('추가 질문 표시:', result.questions);
  
  if (!result.questions || result.questions.length === 0) {
    showError('질문을 생성할 수 없습니다.');
    return;
  }
  
  state.currentQuestions = result.questions;
  
  const questionsHTML = `
    <div class="questions-container">
      <div class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${result.completeness || result.intentScore || 50}%"></div>
        </div>
        <p class="progress-text">${result.message || '추가 정보가 필요합니다'}</p>
      </div>
      
      <div class="questions-list">
        ${result.questions.map((q, index) => `
          <div class="question-item" data-key="${q.key || index}">
            <h4 class="question-title">${escapeHtml(q.question)}</h4>
            
            <div class="custom-input">
              <input type="text" placeholder="답변을 입력하세요" id="input-${q.key || index}" />
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

function submitCustomAnswer(questionKey) {
  const inputField = $(`input-${questionKey}`);
  if (!inputField) return;
  
  const inputValue = inputField.value.trim();
  if (!inputValue) {
    alert('답변을 입력해주세요.');
    inputField.focus();
    return;
  }
  
  console.log('커스텀 답변:', questionKey, inputValue);
  
  // 기존 답변 제거 후 새 답변 추가
  state.answers = state.answers.filter(a => !a.startsWith(`${questionKey}:`));
  state.answers.push(`${questionKey}: ${inputValue}`);
  
  // UI 업데이트
  const questionDiv = document.querySelector(`[data-key="${questionKey}"]`);
  if (questionDiv) {
    questionDiv.classList.add('answered');
    
    const existingAnswer = questionDiv.querySelector('.selected-answer');
    if (existingAnswer) existingAnswer.remove();
    
    const answerDisplay = document.createElement('div');
    answerDisplay.className = 'selected-answer';
    answerDisplay.innerHTML = `<strong>답변:</strong> ${escapeHtml(inputValue)} ✓`;
    questionDiv.appendChild(answerDisplay);
    
    const customInput = questionDiv.querySelector('.custom-input');
    if (customInput) customInput.style.display = 'none';
  }
  
  updateSubmitButton();
}

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

async function skipQuestions() {
  console.log('질문 건너뛰기');
  
  const confirmSkip = confirm('현재 정보만으로 프롬프트를 만드시겠습니까?');
  if (!confirmSkip) return;
  
  hideAllSections();
  await generateFinalPrompt();
}

// 에러 처리 개선
function handleAPIError(error) {
  console.error('API 오류:', error);
  
  let errorResult;
  
  if (error.name === 'AbortError') {
    errorResult = {
      title: '⏰ 연결 시간 초과',
      message: '20초 이내에 응답을 받지 못했습니다.',
      suggestion: '네트워크 상태를 확인하고 다시 시도해주세요.',
      canRetry: true
    };
  } else if (error.message.includes('401')) {
    errorResult = {
      title: '🔐 인증 오류',
      message: 'API 키에 문제가 있습니다.',
      suggestion: '관리자에게 문의해주세요.',
      canRetry: false
    };
  } else if (error.message.includes('429')) {
    errorResult = {
      title: '🚫 사용량 초과',
      message: 'API 사용량이 초과되었습니다.',
      suggestion: '잠시 후 다시 시도해주세요.',
      canRetry: true
    };
  } else {
    errorResult = {
      title: '🌐 연결 오류',
      message: error.message || '알 수 없는 오류가 발생했습니다.',
      suggestion: '네트워크 상태를 확인하고 다시 시도해주세요.',
      canRetry: true
    };
  }
  
  showFailure(errorResult);
}

// 기존 함수들 유지
function showFailure(result) {
  console.log('실패 결과 표시:', result);
  
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

function showNetworkError(title, message) {
  const errorResult = {
    title: title || '🌐 연결 오류',
    message: message || '네트워크 연결을 확인해주세요.',
    suggestion: '네트워크 상태를 확인하고 다시 시도해주세요.',
    canRetry: true
  };
  showFailure(errorResult);
}

async function retryImprovement() {
  console.log('재시도');
  hideAllSections();
  await processImprovement();
}

function goBack() {
  console.log('돌아가기');
  hideAllSections();
  
  const userInputField = $("userInput");
  if (userInputField) {
    userInputField.focus();
  }
  
  state.answers = [];
  state.currentQuestions = [];
}

function startNew() {
  console.log('새로 만들기');
  
  state.userInput = "";
  state.answers = [];
  state.currentQuestions = [];
  
  const userInputField = $("userInput");
  if (userInputField) {
    userInputField.value = "";
    userInputField.focus();
  }
  
  hideAllSections();
  window.lastImproved = null;
}

async function copyToClipboard() {
  if (!window.lastImproved) {
    alert('복사할 내용이 없습니다.');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(window.lastImproved);
    
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
    
    console.log('클립보드 복사 성공');
  } catch (error) {
    console.error('클립보드 복사 실패:', error);
    alert('복사에 실패했습니다. 텍스트를 직접 선택해서 복사해주세요.');
  }
}

// 유틸리티 함수들
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
  console.error('에러:', message);
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 디버깅용
if (typeof window !== 'undefined') {
  window.debugState = () => console.log('현재 상태:', state);
  window.state = state;
}

console.log('Script 로드 완료!');
