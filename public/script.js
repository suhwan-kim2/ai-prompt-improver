// ⚡ public/script.js - 8단계 플로우 프론트엔드

const $ = (id) => document.getElementById(id);

// 🎯 전역 상태 관리
const state = {
  domain: "video",
  userInput: "",
  answers: [],
  currentQuestions: [],
  currentKeys: [],        // ⬅️ 이번 라운드 질문 key들
  currentStep: "start",
  round: 1,
  intentScore: 0,
  qualityScore: 0,
  isProcessing: false,
  maxRounds: 10,
  minRequired: 1          // ⬅️ 라운드별 최소 답변 개수
};

// 🚀 앱 초기화
document.addEventListener('DOMContentLoaded', function() {
  console.log('🎯 AI 프롬프트 개선기 시작');
  initializeApp();
});

function initializeApp() {
  console.log('📱 앱 초기화');
  
  // 시작 버튼 이벤트
  const startBtn = $("startBtn");
  if (startBtn) {
    startBtn.onclick = startImprovement;
    console.log('✅ 시작 버튼 연결됨');
  }
  
  // 도메인 선택 이벤트
  const domainSelect = $("domain");
  if (domainSelect) {
    domainSelect.onchange = (e) => {
      state.domain = e.target.value;
      console.log('📂 도메인 변경:', state.domain);
      updateDomainDescription();
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

  updateDomainDescription();
}

// 🎨 도메인 설명 업데이트
function updateDomainDescription() {
  const descriptions = {
    video: "📹 영상 제작: 유튜브, 광고, 교육 영상 등",
    image: "🎨 이미지 생성: 포스터, 로고, 일러스트 등", 
    dev: "💻 개발 프로젝트: 웹사이트, 앱, API 등"
  };
  
  const descElement = $("domainDescription");
  if (descElement) {
    descElement.textContent = descriptions[state.domain] || descriptions.video;
  }
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
  
  // 질문 없으면 → 자동으로 generate 단계
  if (state.currentQuestions.length === 0) {
    goGenerate();
    return;
  }
  
  showQuestions(result);
}

// 🎯 질문 표시
function showQuestions(result) {
  // 이번 라운드 질문 key들 저장
  state.currentKeys = (result.questions || []).map((q, i) => (q.key ?? String(i)));
  
  // 이번 라운드 최소 답변 개수 (질문 수 1~3 범위)
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
        <p class="progress-text">${result.message || 'AI가 전문 질문을 생성했습니다.'}</p>
      </div>
      
      <div class="questions-list">
        ${state.currentQuestions.map((q, index) => `
          <div class="question-item" data-key="${q.key || index}">
            <h4 class="question-title">${escapeHtml(q.question)}</h4>
            ${q.options && q.options.length > 0 ? `
              <div class="quick-options">
                ${q.options.map(option => `
                  <button class="option-btn" data-value="${escapeHtml(option)}" 
                          onclick="selectOption('${q.key || index}', '${escapeHtml(option)}')">
                    ${escapeHtml(option)}
                  </button>
                `).join('')}
              </div>
            ` : `<textarea id="answer-${q.key || index}"></textarea>`}
          </div>
        `).join('')}
      </div>
      
      <div class="questions-footer">
        <button class="btn btn-primary" onclick="submitAllAnswers()" disabled id="submitBtn">
          답변 완료 (0/${state.minRequired})
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
  }
}

// 🔄 제출 버튼 업데이트
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

// ⏭️ 질문 없이 generate로 넘어가기
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
