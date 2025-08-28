// ⚡ public/script.js - 8단계 플로우 프론트엔드 (FULL)

const $ = (id) => document.getElementById(id);

// 🎯 전역 상태 관리
const state = {
  domain: "video",
  userInput: "",
  answers: [],               // ["q1: ...", "q2: ..."] 누적
  currentQuestions: [],
  currentKeys: [],           // 이번 라운드 질문 key들
  currentStep: "start",
  round: 1,
  intentScore: 0,
  qualityScore: 0,
  isProcessing: false,
  maxRounds: 10,
  minRequired: 1             // 이번 라운드 최소 답변 개수(동적 1~3)
};

// 🚀 앱 초기화
document.addEventListener('DOMContentLoaded', function() {
  console.log('🎯 AI 프롬프트 개선기 시작');
  initializeApp();
});

function initializeApp() {
  console.log('📱 앱 초기화');

  const startBtn = $("startBtn");
  if (startBtn) {
    startBtn.onclick = startImprovement;
    console.log('✅ 시작 버튼 연결됨');
  }

  const domainSelect = $("domain");
  if (domainSelect) {
    domainSelect.onchange = (e) => {
      state.domain = e.target.value;
      console.log('📂 도메인 변경:', state.domain);
      updateDomainDescription();
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

  updateDomainDescription();
}

// 🎨 도메인 설명 업데이트
function updateDomainDescription() {
  const descriptions = {
    video: "📹 영상 제작: 유튜브, 광고, 교육 영상 등",
    image: "🎨 이미지 생성: 포스터, 로고, 일러스트 등",
    dev:   "💻 개발 프로젝트: 웹사이트, 앱, API 등"
  };
  const el = $("domainDescription");
  if (el) el.textContent = descriptions[state.domain] || descriptions.video;
}

// 🚀 1단계: 프롬프트 개선 시작
async function startImprovement() {
  console.log('🚀 1단계: 사용자 입력 처리');

  const userInputField = $("userInput");
  if (!userInputField) return showError('입력 필드를 찾을 수 없습니다.');

  state.userInput = userInputField.value.trim();
  if (!state.userInput) return showError('프롬프트를 입력해주세요.');
  if (state.userInput.length < 5) return showError('최소 5글자 이상 입력해주세요.');

  resetState();
  hideAllSections();

  console.log('📊 시작 정보:', { input: state.userInput, domain: state.domain });

  await requestAIQuestions('start');
}

// 🔄 상태 초기화
function resetState() {
  state.answers = [];
  state.currentQuestions = [];
  state.currentKeys = [];
  state.currentStep = "start";
  state.round = 1;
  state.intentScore = 0;
  state.qualityScore = 0;
  state.isProcessing = false;
  state.minRequired = 1;
  updateScoreDisplay();
}

// 📡 API 요청
async function requestAIQuestions(step) {
  if (state.isProcessing) return;
  state.isProcessing = true;

  showLoading(`🤖 AI가 ${state.domain} 전문 질문을 생성하고 있습니다...`);

  try {
    const requestData = {
      userInput: state.userInput,
      answers: state.answers,
      domain: state.domain,
      step: step,
      round: state.round
    };

    console.log('📤 API 요청:', requestData);

    const response = await fetch('/api/improve-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    console.log('📡 API 응답 상태:', response.status);

    const result = await response.json();
    console.log('📨 API 응답 데이터:', result);

    hideLoading();

    if (result.success) {
      handleAPIResponse(result);
    } else if (result.error) {
      handleAPIError(result);
    } else {
      showError('예상치 못한 응답 형식입니다.');
    }
  } catch (error) {
    console.error('❌ 네트워크 오류:', error);
    hideLoading();
    handleNetworkError(error);
  } finally {
    state.isProcessing = false;
  }
}

// 🎯 API 응답 처리
function handleAPIResponse(result) {
  state.currentStep = result.step;

  switch (result.step) {
    case 'questions':
      handleQuestionsResponse(result);
      break;
    case 'generate':
      handleGenerateResponse(result);
      break;
    case 'completed':
      handleCompletedResponse(result);
      break;
    default:
      showError(`알 수 없는 단계: ${result.step}`);
  }
}

// ❓ 질문 응답 처리
function handleQuestionsResponse(result) {
  console.log(`📍 ${state.round}라운드 질문 표시`);

  state.currentQuestions = result.questions || [];
  state.round = result.round || state.round;
  state.intentScore = result.intentScore || 0;
  updateScoreDisplay();

  // 질문 없으면 → 더 물을 게 없음 → 자동 생성 단계
  if (state.currentQuestions.length === 0) {
    goGenerate();
    return;
  }

  showQuestions(result);
}

// 🎯 5단계: 생성 응답 처리
function handleGenerateResponse(result) {
  console.log('📍 5단계: 프롬프트 생성 진행');
  state.intentScore = result.intentScore || 95;
  showLoading('🤖 AI가 전문급 프롬프트를 생성하고 있습니다...');

  // 서버 generate를 바로 호출(폴링/대기 불필요)
  goGenerate();
}

// 🎉 최종 완료
function handleCompletedResponse(result) {
  console.log('📍 7-8단계: 완성!');
  state.intentScore = result.intentScore || 95;
  state.qualityScore = result.qualityScore || 95;
  updateScoreDisplay();
  showFinalResult(result);
}

// ❓ 질문 표시
function showQuestions(result) {
  // 이번 라운드 질문 key들 저장
  state.currentKeys = (result.questions || []).map((q, i) => (q.key ?? String(i)));

  // 이번 라운드 최소 답변 개수(질문 수 기반 1~3)
  state.minRequired = Math.min(Math.max(state.currentKeys.length, 1), 3);

  const questionsHTML = `
    <div class="questions-container">
      <div class="progress-section">
        <div class="round-info">
          <span class="round-badge">라운드 ${state.round}</span>
          <span class="score-info">의도 파악: ${state.intentScore}점/95점</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${Math.round((state.intentScore / 95) * 100)}%"></div>
        </div>
        <p class="progress-text">${escapeHtml(result.message || 'AI가 전문 질문을 생성했습니다.')}</p>
      </div>

      <div class="questions-list">
        ${state.currentQuestions.map((q, index) => `
          <div class="question-item" data-key="${q.key || index}">
            <div class="question-header">
              <h4 class="question-title">${escapeHtml(q.question)}</h4>
              <span class="question-priority ${q.priority || 'medium'}">${getPriorityText(q.priority)}</span>
            </div>

            ${q.options && q.options.length > 0 ? `
              <div class="quick-options">
                ${q.options.map(option => `
                  <button class="option-btn" data-value="${escapeHtml(option)}"
                          onclick="selectOption('${q.key || index}', '${escapeHtml(option)}')">
                    ${escapeHtml(option)}
                  </button>
                `).join('')}
              </div>
            ` : `
              <div class="text-input-area">
                <textarea placeholder="답변을 입력해주세요..." id="answer-${q.key || index}" rows="3"></textarea>
                <button class="btn btn-small" onclick="submitTextAnswer('${q.key || index}')">확인</button>
              </div>
            `}

            <div class="custom-input" id="custom-${q.key || index}" style="display: none;">
              <input type="text" placeholder="직접 입력..." id="input-${q.key || index}" />
              <button class="btn btn-small" onclick="submitCustomAnswer('${q.key || index}')">확인</button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="questions-footer">
        <button class="btn btn-primary" onclick="submitAllAnswers()" disabled id="submitBtn">
          답변 완료 (0/${state.minRequired})
        </button>
        <button class="btn btn-secondary" onclick="skipQuestions()">현재 정보로 진행</button>
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
    const customDiv = $(`custom-${questionKey}`);
    if (customDiv) {
      customDiv.style.display = 'block';
      const inputField = $(`input-${questionKey}`);
      if (inputField) inputField.focus();
    }
  } else {
    setAnswer(questionKey, selectedValue);
  }
}

// ✍️ 텍스트 답변 제출
function submitTextAnswer(questionKey) {
  const textarea = $(`answer-${questionKey}`);
  if (!textarea) return;

  const answer = textarea.value.trim();
  if (!answer) {
    alert('답변을 입력해주세요.');
    textarea.focus();
    return;
  }
  console.log('✍️ 텍스트 답변:', questionKey, answer);
  setAnswer(questionKey, answer);
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

// 📝 답변 설정(이번 라운드 기준으로 버튼 활성화)
function setAnswer(questionKey, answerValue) {
  console.log('📝 답변 설정:', questionKey, '=', answerValue);

  // 기존 동일 key 제거 후 재삽입
  state.answers = state.answers.filter(a => !a.startsWith(`${questionKey}:`));
  state.answers.push(`${questionKey}: ${answerValue}`);

  // UI 표시 업데이트
  const questionDiv = document.querySelector(`[data-key="${questionKey}"]`);
  if (questionDiv) {
    questionDiv.classList.add('answered');
    const existing = questionDiv.querySelector('.selected-answer');
    if (existing) existing.remove();

    const answerDisplay = document.createElement('div');
    answerDisplay.className = 'selected-answer';
    answerDisplay.innerHTML = `<strong>선택:</strong> ${escapeHtml(answerValue)} ✅`;
    questionDiv.appendChild(answerDisplay);

    // 옵션 버튼/입력 비활성화
    questionDiv.querySelectorAll('.option-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
    });
    const textArea = questionDiv.querySelector('textarea');
    if (textArea) { textArea.disabled = true; textArea.style.opacity = '0.5'; }
    const customInput = questionDiv.querySelector('.custom-input');
    if (customInput) customInput.style.display = 'none';
  }

  updateSubmitButton();
}

// 🔄 제출 버튼 상태 업데이트(이번 라운드만 카운트)
function updateSubmitButton() {
  const submitBtn = $("submitBtn");
  if (!submitBtn) return;

  const keySet = new Set(state.currentKeys);
  const answeredCount = state.answers.filter(a => {
    const key = a.split(":")[0].trim();
    return keySet.has(key);
  }).length;

  const need = state.minRequired || 1;
  submitBtn.disabled = answeredCount < need;
  submitBtn.textContent = `답변 완료 (${answeredCount}/${need})`;
}

// 📤 모든 답변 제출
async function submitAllAnswers() {
  console.log('📤 답변 제출:', state.answers);

  // 이번 라운드 최소 개수 충족 여부 확인
  const keySet = new Set(state.currentKeys);
  const answeredCount = state.answers.filter(a => {
    const key = a.split(":")[0].trim();
    return keySet.has(key);
  }).length;

  if (answeredCount < (state.minRequired || 1)) {
    alert(`최소 ${state.minRequired}개 이상 답변해주세요.`);
    return;
  }

  hideAllSections();
  await requestAIQuestions('questions');
}

// ⏭️ 질문 건너뛰기 → 곧바로 generate
async function skipQuestions() {
  console.log('⏭️ 질문 건너뛰기');
  const confirmSkip = confirm(`현재 ${state.answers.length}개 답변으로 프롬프트를 생성하시겠습니까?\n더 많은 답변이 있으면 품질이 향상됩니다.`);
  if (!confirmSkip) return;
  hideAllSections();
  await requestAIQuestions('generate');
}

// ✅ 바로 generate 호출
async function goGenerate() {
  hideAllSections();
  const payload = {
    userInput: state.userInput,
    answers: state.answers,
    domain: state.domain,
    step: 'generate',
    round: state.round
  };
  const res = await fetch('/api/improve-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  handleAPIResponse(data);
}

// 🎉 최종 결과 표시
function showFinalResult(result) {
  console.log('🎉 최종 결과 표시');

  const finalHTML = `
    <div class="final-container">
      <div class="final-header">
        <h2>🎉 AI 프롬프트 개선 완료!</h2>
        <div class="final-scores">
          <div class="score-badge intent">의도 파악: ${state.intentScore}점</div>
          <div class="score-badge quality">품질 점수: ${state.qualityScore}점</div>
        </div>
      </div>

      <div class="result-comparison">
        <div class="original-section">
          <h3>📝 원본 프롬프트</h3>
          <div class="prompt-text original">${escapeHtml(state.userInput)}</div>
          ${state.answers.length > 0 ? `
            <div class="additional-info">
              <h4>💬 추가된 정보 (${state.answers.length}개)</h4>
              <div class="answers-list">
                ${state.answers.map(a => `<div class="answer-item">${escapeHtml(a)}</div>`).join('')}
              </div>
            </div>` : ''}
        </div>

        <div class="improved-section">
          <h3>✨ AI가 개선한 전문급 프롬프트</h3>
          <div class="prompt-text improved">${escapeHtml(result.improvedPrompt)}</div>
          <div class="improvement-stats">
            <span class="stat">원본: ${state.userInput.length}자</span>
            <span class="stat">개선: ${result.improvedPrompt.length}자</span>
            <span class="stat">개선 시도: ${result.attempts || 1}회</span>
            <span class="stat">라운드: ${state.round}회</span>
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <button class="btn btn-primary" onclick="copyToClipboard()">📋 개선된 프롬프트 복사</button>
        <button class="btn btn-secondary" onclick="startNew()">🔄 새 프롬프트 만들기</button>
        <button class="btn btn-tertiary" onclick="showDetails()">📊 상세 분석 보기</button>
      </div>

      <div class="success-message">
        <p>${escapeHtml(result.message || '완벽한 프롬프트가 완성되었습니다!')}</p>
      </div>
    </div>
  `;

  const finalSection = $("final");
  if (finalSection) {
    finalSection.innerHTML = finalHTML;
    finalSection.classList.remove("hidden");
    finalSection.scrollIntoView({ behavior: 'smooth' });
  }

  window.lastImproved = result.improvedPrompt;
}

// 📊 점수 표시 업데이트
function updateScoreDisplay() {
  const intentScoreEl = $("intentScore");
  const qualityScoreEl = $("qualityScore");

  if (intentScoreEl) {
    intentScoreEl.textContent = state.intentScore;
    intentScoreEl.className = getScoreClass(state.intentScore);
  }
  if (qualityScoreEl) {
    qualityScoreEl.textContent = state.qualityScore;
    qualityScoreEl.className = getScoreClass(state.qualityScore);
  }
}

// 🎨 점수별 CSS 클래스
function getScoreClass(score) {
  if (score >= 95) return 'score-excellent';
  if (score >= 85) return 'score-good';
  if (score >= 70) return 'score-average';
  return 'score-low';
}

// 🎯 우선순위 텍스트
function getPriorityText(priority) {
  const map = { high: '🔥 중요', medium: '📋 보통', low: '📝 선택' };
  return map[priority] || '📋 보통';
}

// 📋 클립보드 복사
async function copyToClipboard() {
  if (!window.lastImproved) return alert('복사할 내용이 없습니다.');
  try {
    await navigator.clipboard.writeText(window.lastImproved);
    const copyBtn = document.querySelector('.btn.btn-primary');
    if (copyBtn && copyBtn.textContent.includes('📋')) {
      const original = copyBtn.textContent;
      copyBtn.textContent = '✅ 복사 완료!';
      copyBtn.style.background = '#10b981';
      setTimeout(() => { copyBtn.textContent = original; copyBtn.style.background = ''; }, 2000);
    }
    console.log('📋 클립보드 복사 성공');
  } catch (e) {
    console.error('📋 클립보드 복사 실패:', e);
    const ta = document.createElement('textarea');
    ta.value = window.lastImproved;
    document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    alert('클립보드에 복사되었습니다!');
  }
}

// 🔄 새 프롬프트 만들기
function startNew() {
  console.log('🔄 새 프롬프트 만들기');
  resetState();
  const userInputField = $("userInput");
  if (userInputField) { userInputField.value = ""; userInputField.focus(); }
  hideAllSections();
  window.lastImproved = null;
}

// 📊 상세 분석 보기
function showDetails() {
  const detailsHTML = `
    <div class="details-modal" id="detailsModal">
      <div class="details-content">
        <h3>📊 프롬프트 개선 상세 분석</h3>
        <div class="analysis-sections">
          <div class="analysis-item">
            <h4>🎯 의도 파악 분석</h4>
            <p>점수: ${state.intentScore}/95점</p>
            <p>라운드: ${state.round}회</p>
            <p>수집된 답변: ${state.answers.length}개</p>
          </div>
          <div class="analysis-item">
            <h4>🏆 품질 평가 분석</h4>
            <p>점수: ${state.qualityScore}/95점</p>
            <p>도메인: ${state.domain}</p>
            <p>등급: ${getQualityGrade(state.qualityScore)}</p>
          </div>
          <div class="analysis-item">
            <h4>⚡ 성능 지표</h4>
            <p>원본 길이: ${state.userInput.length}자</p>
            <p>개선 후 길이: ${window.lastImproved ? window.lastImproved.length : 0}자</p>
            <p>향상률: ${window.lastImproved ? Math.round(((window.lastImproved.length / state.userInput.length - 1) * 100)) : 0}%</p>
          </div>
        </div>
        <button class="btn btn-secondary" onclick="closeDetails()">닫기</button>
      </div>
    </div>
  `;
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = detailsHTML;
  document.body.appendChild(modalContainer);
}

// 🏆 품질 등급
function getQualityGrade(score) {
  if (score >= 95) return 'S급 (완벽)';
  if (score >= 85) return 'A급 (우수)';
  if (score >= 75) return 'B급 (양호)';
  if (score >= 65) return 'C급 (보통)';
  return 'D급 (개선 필요)';
}

// ❌ 상세 모달 닫기
function closeDetails() {
  const modal = $("detailsModal");
  if (modal) document.body.removeChild(modal);
}

// 🎨 UI 유틸
function hideAllSections() {
  const sections = ['questions', 'final'];
  sections.forEach(id => {
    const el = $(id);
    if (el) el.classList.add('hidden');
  });
}

function showLoading(message) {
  const loadingHTML = `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-message">${escapeHtml(message)}</p>
    </div>
  `;
  const sec = $("questions");
  if (sec) { sec.innerHTML = loadingHTML; sec.classList.remove("hidden"); }
}

function hideLoading() {
  // 다른 콘텐츠로 교체될 때 자동 숨김
}

// ❌ 에러 처리
function handleAPIError(errorResult) {
  console.log('❌ API 에러:', errorResult);

  const errorHTML = `
    <div class="error-container">
      <div class="error-icon">🤖💔</div>
      <h2 class="error-title">${escapeHtml(errorResult.title || '🚫 AI 서비스 오류')}</h2>
      <p class="error-message">${escapeHtml(errorResult.message || 'AI 서비스에 문제가 발생했습니다.')}</p>
      <p class="error-action">${escapeHtml(errorResult.action || '잠시 후 다시 시도해주세요.')}</p>

      ${errorResult.canRetry !== false ? `
        <div class="retry-section">
          <button class="btn btn-primary" onclick="retryCurrentStep()">🔄 다시 시도</button>
        </div>
      ` : `
        <div class="no-retry-section">
          <p class="final-message">현재 AI 서비스를 이용할 수 없습니다.</p>
          <button class="btn btn-secondary" onclick="window.location.reload()">🔄 페이지 새로고침</button>
        </div>
      `}
      <div class="error-details"><small>발생 시각: ${new Date().toLocaleString()}</small></div>
    </div>
  `;

  const sec = $("questions");
  if (sec) { sec.innerHTML = errorHTML; sec.classList.remove("hidden"); }
}

function handleNetworkError(error) {
  console.log('🌐 네트워크 오류:', error);
  handleAPIError({
    title: '🌐 연결 오류',
    message: '인터넷 연결을 확인해주세요.',
    action: '네트워크 상태를 확인하고 다시 시도해주세요.',
    canRetry: true
  });
}

// 🔄 현재 단계 재시도
async function retryCurrentStep() {
  console.log('🔄 현재 단계 재시도:', state.currentStep);
  hideAllSections();
  await requestAIQuestions(state.currentStep);
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

// 디버깅용
if (typeof window !== 'undefined') {
  window.debugState = () => console.log('🎯 현재 상태:', state);
  window.state = state;
}

// 🎯 전역 함수 exports
window.startImprovement   = startImprovement;
window.selectOption       = selectOption;
window.submitTextAnswer   = submitTextAnswer;
window.submitCustomAnswer = submitCustomAnswer;
window.submitAllAnswers   = submitAllAnswers;
window.skipQuestions      = skipQuestions;
window.copyToClipboard    = copyToClipboard;
window.startNew           = startNew;
window.showDetails        = showDetails;
window.closeDetails       = closeDetails;
window.retryCurrentStep   = retryCurrentStep;

console.log('✅ 8단계 플로우 Script 로드 완료!');
