// 🎯 새로운 script.js - 단순하고 명확한 프론트엔드
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
  
  // 이벤트 리스너 등록
  $("startBtn").onclick = startImprovement;
  $("domain").onchange = (e) => {
    state.domain = e.target.value;
    console.log('📂 도메인 변경:', state.domain);
  };
});

// 🚀 메인: 프롬프트 개선 시작
async function startImprovement() {
  console.log('🚀 프롬프트 개선 시작');
  
  // 입력값 체크
  state.userInput = $("userInput").value.trim();
  if (!state.userInput) {
    showError('프롬프트를 입력해주세요.');
    return;
  }
  
  // 상태 초기화
  state.answers = [];
  state.currentQuestions = [];
  hideAllSections();
  showLoading('AI가 프롬프트를 분석하고 있습니다...');
  
  // API 호출
  await processImprovement();
}

// 🔄 프롬프트 개선 처리
async function processImprovement() {
  console.log('🔄 API 호출:', { 
    userInput: state.userInput, 
    answers: state.answers, 
    domain: state.domain 
  });
  
  if (state.isProcessing) {
    console.log('⚠️ 이미 처리 중');
    return;
  }
  
  state.isProcessing = true;
  
  try {
    const response = await fetch('/api/improve-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userInput: state.userInput,
        answers: state.answers,
        domain: state.domain
      })
    });
    
    console.log('📡 API 응답 상태:', response.status);
    
    const result = await response.json();
    console.log('📨 API 응답 데이터:', result);
    
    if (result.success) {
      // ✅ 성공 - 개선된 프롬프트 표시
      showSuccess(result);
    } else if (result.action === 'need_more_info') {
      // ❓ 정보 부족 - 추가 질문 표시
      showMoreQuestions(result);
    } else if (result.error) {
      // ❌ 오류 - 정직한 실패 안내
      showFailure(result);
    } else {
      // 예상치 못한 응답
      showError('예상치 못한 응답입니다.');
    }
    
  } catch (error) {
    console.error('❌ 네트워크 오류:', error);
    showNetworkError();
  } finally {
    state.isProcessing = false;
    hideLoading();
  }
}

// ✅ 성공 - 개선된 프롬프트 표시
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
        <p class="prompt-text original">${state.userInput}</p>
        ${state.answers.length > 0 ? `
          <div class="additional-info">
            <strong>추가 정보:</strong> ${state.answers.join(', ')}
          </div>
        ` : ''}
      </div>
      
      <div class="improved-prompt">
        <h3>✨ AI가 개선한 프롬프트</h3>
        <p class="prompt-text improved">${result.improved}</p>
        <div class="improvement-stats">
          <span class="stat">원본: ${result.originalLength || state.userInput.length}자</span>
          <span class="stat">개선: ${result.improvedLength || result.improved.length}자</span>
          <span class="stat">방법: ${result.method}</span>
        </div>
      </div>
      
      <div class="action-buttons">
        <button class="btn btn-primary" onclick="copyToClipboard()">
          📋 복사하기
        </button>
        <button class="btn btn-secondary" onclick="startNew()">
          🔄 새로 만들기
        </button>
        <button class="btn btn-tertiary" onclick="showDetails()">
          📊 상세보기
        </button>
      </div>
    </div>
  `;
  
  $("final").innerHTML = successHTML;
  $("final").classList.remove("hidden");
  
  // 결과 저장 (복사 기능용)
  window.lastImproved = result.improved;
}

// ❓ 추가 질문 표시
function showMoreQuestions(result) {
  console.log('❓ 추가 질문 표시:', result.questions);
  
  state.currentQuestions = result.questions;
  
  const questionsHTML = `
    <div class="questions-container">
      <div class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${result.completeness}%"></div>
        </div>
        <p class="progress-text">${result.message}</p>
      </div>
      
      <div class="questions-list">
        ${result.questions.map((q, index) => `
          <div class="question-item" data-key="${q.key}">
            <h4 class="question-title">${q.question}</h4>
            <p class="question-hint">${q.placeholder}</p>
            
            <div class="quick-options">
              ${q.options.map(option => `
                <button class="option-btn" data-value="${option}" onclick="selectOption('${q.key}', '${option}')">
                  ${option}
                </button>
              `).join('')}
            </div>
            
            <div class="custom-input" id="custom-${q.key}" style="display: none;">
              <input type="text" placeholder="${q.placeholder}" id="input-${q.key}" />
              <button class="btn btn-small" onclick="submitCustomAnswer('${q.key}')">확인</button>
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
  
  $("questions").innerHTML = questionsHTML;
  $("questions").classList.remove("hidden");
}

// 🎯 옵션 선택 처리
function selectOption(questionKey, selectedValue) {
  console.log('🎯 옵션 선택:', questionKey, selectedValue);
  
  if (selectedValue === '직접 입력') {
    // 커스텀 입력 필드 표시
    const customDiv = $(`custom-${questionKey}`);
    customDiv.style.display = 'block';
    $(`input-${questionKey}`).focus();
    
    // 다른 버튼들 비활성화
    const questionDiv = document.querySelector(`[data-key="${questionKey}"]`);
    const otherButtons = questionDiv.querySelectorAll('.option-btn');
    otherButtons.forEach(btn => {
      if (btn.dataset.value !== '직접 입력') {
        btn.disabled = true;
        btn.style.opacity = '0.5';
      }
    });
  } else {
    // 바로 답변으로 설정
    setAnswer(questionKey, selectedValue);
  }
}

// ✍️ 커스텀 답변 제출
function submitCustomAnswer(questionKey) {
  const inputValue = $(`input-${questionKey}`).value.trim();
