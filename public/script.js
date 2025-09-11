// ⚡ public/script.js - 8단계 플로우 프론트엔드 (FULL, dedupe + draft + multi + other + undo + status + text-input)

const $ = (id) => document.getElementById(id);

// 🎯 전역 상태 관리
const state = {
  domain: "video",
  userInput: "",
  answers: [],               // ["qKey: value", ...] 누적 (복수선택 허용)
  asked: [],                 // 이전 라운드까지 표시했던 질문 텍스트 (중복 방지용)
  currentQuestions: [],
  currentKeys: [],           // 이번 라운드 질문 key들
  currentStep: "start",
  round: 1,
  intentScore: 0,
  qualityScore: 0,
  isProcessing: false,
  maxRounds: 10,
  minRequired: 1,            // 이번 라운드 최소 답변 개수(동적 1~3)
  draftPrompt: "",           // 라운드별 드래프트 (서버에서 수신해 표시)
  ui: { language: "ko", allowMulti: true, includeOther: true }, // 서버 힌트
};

// 🚀 앱 초기화
document.addEventListener('DOMContentLoaded', function () {
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
    userInputField.addEventListener('keypress', function (e) {
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
    dev:   "💻 개발 프로젝트: 웹사이트, 앱, API 등",
    writing: "✍️ 글쓰기: 이메일, 보고서, 에세이, 블로그, 카피",
    daily:   "🗒️ 일상/범용: 할일/체크리스트, 요약, 메시지/이메일 초안"
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
  state.asked = [];
  state.currentQuestions = [];
  state.currentKeys = [];
  state.currentStep = "start";
  state.round = 1;
  state.intentScore = 0;
  state.qualityScore = 0;
  state.isProcessing = false;
  state.minRequired = 1;
  state.draftPrompt = "";
  state.ui = { language: "ko", allowMulti: true, includeOther: true };
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
      step,
      round: state.round,
      asked: state.asked,
    };

    console.log('📤 API 요청:', requestData);

    const response = await fetch('/api/improve-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    console.log('📡 API 응답 상태:', response.status);

    const ctype = response.headers.get('content-type') || '';
    let result;
    if (ctype.includes('application/json')) {
      result = await response.json();
    } else {
      const text = await response.text();
      console.warn('서버가 JSON이 아닌 응답을 반환했습니다:', text.slice(0, 500));
      return handleAPIError({
        title: '🧩 서버 응답 오류',
        message: '서버가 올바른 데이터 형식을 반환하지 않았습니다.',
        action: '잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의하세요.',
        canRetry: true
      });
    }

    console.log('📨 API 응답 데이터:', result);
    hideLoading();

    if (result.success) {
      handleAPIResponse(result);
    } else {
      handleAPIError(result);
    }
  } catch (error) {
    console.error('❌ 네트워크 오류:', error);
    hideLoading();
    handleNetworkError(error);
  } finally {
    state.isProcessing = false;
  }
}

// 🎯 API 응답 처리 (상태 배지 + 점수 즉시 반영 포함)
function handleAPIResponse(result) {
  state.currentStep = result.step;
  
  // ⭐ 진행 상황 표시
  if (result.status) {
    showProgressStatus(result.status, result.message || '');
  }

  // 서버 힌트 수용
  if (result.ui) state.ui = { ...state.ui, ...result.ui };

  // 라운드별 드래프트 표시
  if (typeof result.draftPrompt === 'string') {
    state.draftPrompt = result.draftPrompt;
    console.log(`✍️ 드래프트 v${state.round}:`, state.draftPrompt);
  }

  // ⭐ 실제 점수 사용 (하드코딩 제거)
  if (typeof result.intentScore === 'number') {
    state.intentScore = result.intentScore;
    updateScoreDisplay();
  }
  if (typeof result.qualityScore === 'number') {
    state.qualityScore = result.qualityScore;
    updateScoreDisplay();
  }

  // 추가 진행도 수용(백엔드가 progress 객체로 줄 수 있음)
  if (result.progress && typeof result.progress.intentScore === 'number') {
    state.intentScore = result.progress.intentScore;
    updateScoreDisplay();
  }

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

// ⭐ 새로운 함수: 진행 상황 표시 배지
function showProgressStatus(status, message) {
  const icon = status === 'improving' ? '🔄' : status === 'collecting' ? '📝' : '✅';
  const statusHTML = `
    <div class="status-indicator ${status}">
      <div class="status-icon">${icon}</div>
      <div class="status-text">${escapeHtml(message || '')}</div>
      <div class="progress-details">
        <div class="score-progress">
          <span>의도 파악: ${state.intentScore}/95</span>
          <div class="mini-progress"><div class="fill" style="width: ${(state.intentScore/95)*100}%"></div></div>
        </div>
        ${typeof state.qualityScore === 'number' && state.qualityScore > 0 ? `
          <div class="score-progress">
            <span>품질 점수: ${state.qualityScore}/95</span>
            <div class="mini-progress"><div class="fill" style="width: ${(state.qualityScore/95)*100}%"></div></div>
          </div>` : ''
        }
      </div>
    </div>
  `;
  
  const statusContainer = document.createElement('div');
  statusContainer.className = 'status-overlay';
  statusContainer.innerHTML = statusHTML;
  
  // 기존 상태 표시 제거
  const existing = document.querySelector('.status-overlay');
  if (existing) existing.remove();
  
  document.body.appendChild(statusContainer);
  
  // 3초 후 자동 제거(fade-out)
  setTimeout(() => {
    statusContainer.classList.add('fade-out');
    setTimeout(() => statusContainer.remove(), 500);
  }, 3000);
}

// ❓ 질문 응답 처리
function handleQuestionsResponse(result) {
  console.log(`📍 ${state.round}라운드 질문 표시`);

  // 서버 질문 수신
  const rawQuestions = result.questions || [];

  // 프론트 측에서도 중복 걸러내기(이미 asked에 있거나 동일 텍스트인 것은 제거)
  const seenAsked = new Set(state.asked.map(s => s.trim().toLowerCase()));
  const filtered = rawQuestions.filter(q => {
    const key = (q?.question || '').trim().toLowerCase();
    return key && !seenAsked.has(key);
  });

  state.currentQuestions = filtered;
  state.currentKeys = filtered.map((q, i) => (q.key ?? String(i)));
  state.round = result.round || state.round;

  updateScoreDisplay();

  // 질문 없으면 → 자동 생성으로
  if (state.currentQuestions.length === 0) {
    goGenerate();
    return;
  }

  // 이번 라운드에 표시한 질문을 asked에 누적 (중복질문 방지용)
  state.asked.push(...filtered.map(q => (q?.question || '').trim()).filter(Boolean));

  showQuestions(result);
}

// 🎯 5단계: 생성 응답 처리
function handleGenerateResponse(result) {
  console.log('📍 5단계: 프롬프트 생성 진행');

  if (typeof result.intentScore === 'number') {
    state.intentScore = result.intentScore;
    updateScoreDisplay();
  }

  showLoading('🤖 AI가 전문급 프롬프트를 생성하고 있습니다...');
  goGenerate();
}

// 🎉 최종 완료
function handleCompletedResponse(result) {
  console.log('📍 7-8단계: 완성!');

  if (typeof result.intentScore === 'number') state.intentScore = result.intentScore;
  if (typeof result.qualityScore === 'number') state.qualityScore = result.qualityScore;

  updateScoreDisplay();
  showFinalResult(result);
}

// ❓ 질문 표시 (텍스트 입력형 지원)
function showQuestions(result) {
  // 이번 라운드 최소 답변 개수(질문 수 기반 1~3)
  state.minRequired = Math.min(Math.max(state.currentKeys.length, 1), 3);

  const draftBox = state.draftPrompt
    ? `<div class="draft-box"><div class="draft-title">✍️ 현재 드래프트(v${state.round})</div><pre class="draft-body">${escapeHtml(state.draftPrompt)}</pre></div>`
    : '';

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
        ${draftBox}
      </div>

      <div class="questions-list">
        ${state.currentQuestions.map((q, index) => {
          const key = q.key || index;
          const inputType = q.inputType || 'options';
          const priority = q.priority || 'medium';
          const scoreValue = q.scoreValue;

          // ⭐ 텍스트 입력 타입 지원
          if (inputType === 'text') {
            return `
            <div class="question-item" data-key="${key}">
              <div class="question-header">
                <h4 class="question-title">${escapeHtml(q.question)}</h4>
                <span class="question-priority ${priority}">${getPriorityText(priority)}</span>
                ${scoreValue ? `<span class="score-value">+${scoreValue}점</span>` : ''}
              </div>
              <div class="text-input-wrapper">
                <textarea 
                  id="answer-${key}" 
                  placeholder="${escapeHtml(q.placeholder || '자유롭게 설명해주세요')}"
                  rows="3"
                ></textarea>
                <button class="btn btn-small" onclick="submitTextAnswer('${key}')">
                  입력 완료
                </button>
              </div>
              <div class="selected-list" id="selected-${key}"></div>
            </div>`;
          }

          // 기존 옵션 방식
          const opts = Array.isArray(q.options) ? q.options.slice() : [];

          // 서버가 includeOther true면 "직접 입력" 추가
          if (state.ui.includeOther && (!opts.includes("직접 입력"))) opts.push("직접 입력");

          return `
          <div class="question-item" data-key="${key}">
            <div class="question-header">
              <h4 class="question-title">${escapeHtml(q.question)}</h4>
              <span class="question-priority ${priority}">${getPriorityText(priority)}</span>
              ${scoreValue ? `<span class="score-value">+${scoreValue}점</span>` : ''}
            </div>

            ${opts.length > 0 ? `
              <div class="quick-options">
                ${opts.map(option => `
                  <button class="option-btn" data-value="${escapeHtml(option)}"
                          onclick="toggleOption('${key}', '${escapeHtml(option)}')">
                    ${escapeHtml(option)}
                  </button>
                `).join('')}
              </div>
            ` : `
              <div class="text-input-area">
                <textarea placeholder="답변을 입력해주세요..." id="answer-${key}" rows="3"></textarea>
                <button class="btn btn-small" onclick="submitTextAnswer('${key}')">확인</button>
              </div>
            `}

            <div class="custom-input" id="custom-${key}" style="display: none;">
              <input type="text" placeholder="직접 입력..." id="input-${key}" />
              <button class="btn btn-small" onclick="submitCustomAnswer('${key}')">확인</button>
            </div>

            <div class="selected-list" id="selected-${key}"></div>
          </div>`;
        }).join('')}
      </div>

      <div class="questions-footer">
        <button class="btn btn-primary" onclick="submitAllAnswers()" disabled id="submitBtn">
          답변 완료 (0/${state.minRequired})
        </button>
        <button class="btn btn-secondary" onclick="skipQuestions()">현재 정보로 진행</button>
        <button class="btn btn-tertiary" onclick="undoLast()">되돌리기</button>
      </div>
    </div>
  `;

  const questionsSection = $("questions");
  if (questionsSection) {
    questionsSection.innerHTML = questionsHTML;
    questionsSection.classList.remove("hidden");
    questionsSection.scrollIntoView({ behavior: 'smooth' });
  }

  // 이미 선택되어 있는 옵션 표시 동기화
  syncSelectedBadges();
}

// ✅ 옵션 토글(복수선택 허용)
function toggleOption(questionKey, selectedValue) {
  if (selectedValue === '직접 입력') {
    const customDiv = $(`custom-${questionKey}`);
    if (customDiv) {
      customDiv.style.display = 'block';
      const inputField = $(`input-${questionKey}`);
      if (inputField) inputField.focus();
    }
    return;
  }

  const token = `${questionKey}: ${selectedValue}`;
  const idx = state.answers.findIndex(a => a === token);

  // allowMulti: true면 토글, false면 단일 선택
  if (state.ui.allowMulti) {
    if (idx >= 0) {
      state.answers.splice(idx, 1); // 해제
    } else {
      state.answers.push(token);    // 선택
    }
  } else {
    // 단일 선택 모드: 기존 같은 key는 모두 제거 후 삽입
    state.answers = state.answers.filter(a => !a.startsWith(`${questionKey}:`));
    state.answers.push(token);
  }

  syncSelectedBadges();
  updateSubmitButton();
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
  setTextAnswer(questionKey, answer);
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
  setTextAnswer(questionKey, inputValue);

  // 입력창 닫기
  const customDiv = $(`custom-${questionKey}`);
  if (customDiv) customDiv.style.display = 'none';
}

function setTextAnswer(questionKey, value) {
  const token = `${questionKey}: ${value}`;
  if (state.ui.allowMulti) {
    // 중복만 제거하고 추가
    state.answers = state.answers.filter(a => a !== token);
    state.answers.push(token);
  } else {
    // 단일 선택 모드: 같은 key 모두 제거 후 삽입
    state.answers = state.answers.filter(a => !a.startsWith(`${questionKey}:`));
    state.answers.push(token);
  }
  syncSelectedBadges();
  updateSubmitButton();
}

// 🧹 선택 뱃지 UI 동기화
function syncSelectedBadges() {
  // 질문별로 선택된 항목 표시
  state.currentKeys.forEach((key) => {
    const selectedDiv = $(`selected-${key}`);
    if (!selectedDiv) return;
    const selected = state.answers
      .filter(a => a.startsWith(`${key}:`))
      .map(a => a.split(':').slice(1).join(':').trim());

    // 버튼 상태도 갱신
    const container = document.querySelector(`.question-item[data-key="${key}"]`);
    if (container) {
      container.querySelectorAll('.option-btn').forEach(btn => {
        const val = btn.getAttribute('data-value');
        if (selected.includes(val)) {
          btn.classList.add('selected');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.classList.remove('selected');
          btn.setAttribute('aria-pressed', 'false');
        }
      });
    }

    if (selected.length === 0) {
      selectedDiv.innerHTML = '';
      return;
    }
    selectedDiv.innerHTML = `
      <div class="selected-answer">
        <strong>선택됨:</strong> ${selected.map(escapeHtml).join(', ')}
      </div>`;
  });
}

// 🔄 제출 버튼 상태 업데이트(이번 라운드 기준 유효 키 수)
function updateSubmitButton() {
  const submitBtn = $("submitBtn");
  if (!submitBtn) return;

  const keySet = new Set(state.currentKeys);
  // 이번 라운드에서 최소 1개 이상 답변이 존재하는 key 수
  const keysAnswered = new Set(
    state.answers
      .map(a => a.split(":")[0].trim())
      .filter(k => keySet.has(k))
  );

  const count = keysAnswered.size;
  const need = state.minRequired || 1;
  submitBtn.disabled = count < need;
  submitBtn.textContent = `답변 완료 (${count}/${need})`;
}

// 📤 모든 답변 제출
async function submitAllAnswers() {
  console.log('📤 답변 제출:', state.answers);

  const keySet = new Set(state.currentKeys);
  const keysAnswered = new Set(
    state.answers.map(a => a.split(":")[0].trim()).filter(k => keySet.has(k))
  );

  if (keysAnswered.size < (state.minRequired || 1)) {
    alert(`최소 ${state.minRequired}개 질문에 답해주세요.`);
    return;
  }

  hideAllSections();
  await requestAIQuestions('questions');
}

// ⏮️ 되돌리기(가장 최근 선택/입력 취소)
function undoLast() {
  if (state.answers.length === 0) return;
  state.answers.pop();
  syncSelectedBadges();
  updateSubmitButton();
}

// ⏭️ 질문 건너뛰기 → 곧바로 generate
async function skipQuestions() {
  console.log('⏭️ 질문 건너뛰기');
  const confirmSkip = confirm(`현재 ${state.answers.length}개 답변으로 프롬프트를 생성하시겠습니까?\n더 많은 답변이 있으면 품질이 향상됩니다.`);
  if (!confirmSkip) return;
  hideAllSections();
  await requestAIQuestions('generate');
}

// ✅ 바로 generate 호출 (강화: content-type 검사/에러 처리)
async function goGenerate() {
  hideAllSections();
  const payload = {
    userInput: state.userInput,
    answers: state.answers,
    domain: state.domain,
    step: 'generate',
    round: state.round,
    asked: state.asked, // ⬅️ 중복 방지용
  };
  try {
    const res = await fetch('/api/improve-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const ctype = res.headers.get('content-type') || '';
    let data;
    if (ctype.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      console.warn('JSON이 아닌 응답:', text.slice(0, 500));
      return handleAPIError({
        title: '🧩 서버 응답 오류',
        message: '프롬프트 생성 중 비정상 응답을 받았습니다.',
        action: '잠시 후 다시 시도해주세요.',
        canRetry: true
      });
    }
    handleAPIResponse(data);
  } catch (e) {
    console.error('goGenerate 네트워크 오류:', e);
    handleNetworkError(e);
  }
}

// 🎉 최종 결과 표시 (개선: 씬 카드 포함, 안전한 복사 버튼, 모든 도메인 공통 렌더)
function showFinalResult(result) {
  console.log('🎉 최종 결과 표시');

  if (typeof result.intentScore === 'number') state.intentScore = result.intentScore;
  if (typeof result.qualityScore === 'number') state.qualityScore = result.qualityScore;
  updateScoreDisplay();

  const improved = (result.improvedPrompt || '').toString();
  const answersListHTML = state.answers.length > 0
    ? `
      <div class="additional-info">
        <h4>💬 추가된 정보 (${state.answers.length}개)</h4>
        <div class="answers-list">
          ${state.answers.map(a => `<div class="answer-item">${escapeHtml(a)}</div>`).join('')}
        </div>
      </div>`
    : '';

  // 씬 카드(비디오 도메인일 때만)
  let scenesSectionHTML = '';
  if (state.domain === 'video' && result.scenarioData && Array.isArray(result.scenarioData.scenes)) {
    const scenes = result.scenarioData.scenes || [];
    const scenesHTML = scenes.map(s => `
      <div class="scene-card">
        <div class="scene-header">
          <h4>📎 씬 ${escapeHtml(String(s.scene ?? ''))} (${escapeHtml(String(s.duration ?? ''))})</h4>
          <span class="scene-concept">${escapeHtml(String(s.concept || ''))}</span>
        </div>
        <div class="prompt-section image-prompt">
          <div class="prompt-label">
            📷 이미지 생성용
            <button class="copy-btn" onclick="copyText(this, '${encodeURIComponent(String(s.image_prompt || ''))}')">📋 복사</button>
          </div>
          <div class="prompt-content">${escapeHtml(String(s.image_prompt || ''))}</div>
        </div>
        <div class="prompt-section video-prompt">
          <div class="prompt-label">
            🎬 영상 생성용
            <button class="copy-btn" onclick="copyText(this, '${encodeURIComponent(String(s.video_prompt || ''))}')">📋 복사</button>
          </div>
          <div class="prompt-content">${escapeHtml(String(s.video_prompt || ''))}</div>
        </div>
        <div class="scene-settings">
          ⚙️ ${escapeHtml(String(s.camera || ''))} | ${escapeHtml(String(s.transition || ''))}
        </div>
      </div>
    `).join('');

    scenesSectionHTML = `
      <div class="scenes-section">
        <h3>🎬 씬별 프롬프트</h3>
        ${scenesHTML}
      </div>
    `;
  }

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
          ${answersListHTML}
        </div>

        <div class="improved-section">
          <h3>✨ AI가 개선한 전문급 프롬프트</h3>
          <div class="prompt-text improved">${escapeHtml(improved)}</div>
          <div class="improvement-stats">
            <span class="stat">원본: ${state.userInput.length}자</span>
            <span class="stat">개선: ${improved.length}자</span>
            <span class="stat">개선 시도: ${result.attempts || 1}회</span>
            <span class="stat">라운드: ${state.round}회</span>
          </div>
        </div>
      </div>

      ${scenesSectionHTML}

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

  window.lastImproved = improved;
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

// 📋 클립보드 복사 (최종 프롬프트)
async function copyToClipboard() {
  if (!window.lastImproved) return alert('복사할 내용이 없습니다.');
  try {
    await navigator.clipboard.writeText(window.lastImproved);
    const copyBtn = document.querySelector('.btn.btn-primary');
    if (copyBtn && copyBtn.textContent.includes('📋')) {
      const original = copyBtn.textContent;
      copyBtn.textContent = '✅ 복사 완료!';
      copyBtn.style.background = '#10b981';
      setTimeout(() => { copyBtn.textContent = original; copyBtn.style.background = ''; }, 1800);
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

// 🔤 씬 카드 내 텍스트 복사(버튼 인자 사용, UTF-8 안전)
window.copyText = function(btnEl, encodedText) {
  try {
    const text = decodeURIComponent(encodedText || '');
    navigator.clipboard.writeText(text).then(() => {
      if (btnEl) {
        const original = btnEl.textContent;
        btnEl.textContent = '✅ 복사됨!';
        btnEl.disabled = true;
        setTimeout(() => {
          btnEl.textContent = original || '📋 복사';
          btnEl.disabled = false;
        }, 2000);
      } else {
        alert('복사 완료!');
      }
    }).catch(() => {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('복사 완료!');
    });
  } catch (e) {
    console.error('복사 중 오류:', e);
    alert('복사에 실패했습니다.');
  }
};

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

// ❌ 상세 모달 닫기 (안정화)
function closeDetails() {
  const modal = $("detailsModal");
  if (modal && modal.parentElement) {
    modal.parentElement.remove(); // 컨테이너ごと 제거 (부모-자식 관계 안전)
  }
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
window.startImprovement = startImprovement;
window.toggleOption = toggleOption;
window.submitTextAnswer = submitTextAnswer;
window.submitCustomAnswer = submitCustomAnswer;
window.submitAllAnswers = submitAllAnswers;
window.skipQuestions = skipQuestions;
window.undoLast = undoLast;
window.copyToClipboard = copyToClipboard;
window.startNew = startNew;
window.showDetails = showDetails;
window.closeDetails = closeDetails;
window.retryCurrentStep = retryCurrentStep;

console.log('✅ 8단계 플로우 Script 로드 완료!');
