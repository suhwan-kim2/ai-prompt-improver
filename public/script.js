// public/script.js - 직접 OpenAI 개선 방식
const $ = (id) => document.getElementById(id);

function debugLog(step, data) {
  console.log(`🔍 [DEBUG ${step}]`, data);
  console.trace();
}

const state = {
  domain: "dev",
  userInput: "",
  turns: 0,
  answers: [],
  askedKeys: [],         
  activeKeys: [],        
  intent: { intentScore: 0 },
  prompt: { total: 0 },
  draft: ""
};

$("startBtn").onclick = start;
$("domain").onchange = (e) => {
  state.domain = e.target.value;
  debugLog('DOMAIN_CHANGE', { newDomain: state.domain });
};

async function start() {
  debugLog('START_FUNCTION', { userInput: $("userInput").value });
  
  state.userInput = $("userInput").value.trim();
  if (!state.userInput) { 
    alert("프롬프트를 입력해 주세요."); 
    return; 
  }
  
  // 세션 초기화
  state.turns = 0; 
  state.answers = [];
  state.askedKeys = [];
  state.activeKeys = [];
  $("chat").innerHTML = "";
  $("final").classList.add("hidden");

  debugLog('STATE_INITIALIZED', state);

  addAI(`제가 이해한 의도: "${state.userInput.slice(0,80)}..." 맞나요? 부족한 핵심만 1~2개씩 여쭤볼게요.`);
  
  await nextLoop();
}

async function nextLoop() {
  debugLog('NEXT_LOOP_START', {
    turn: state.turns,
    domain: state.domain,
    answersCount: state.answers.length,
    askedKeys: state.askedKeys
  });

  try {
    console.log('🚀 API 호출 시작: /api/questions');
    console.log('📨 요청 데이터:', {
      domain: state.domain,
      userInput: state.userInput,
      answers: state.answers,
      askedKeys: state.askedKeys,
      promptScore: state.prompt.total
    });

    const r = await post("/api/questions", {
      domain: state.domain,
      userInput: state.userInput,
      answers: state.answers,
      askedKeys: state.askedKeys,
      promptScore: state.prompt.total
    });

    console.log('📥 API 응답 받음:', r);
    debugLog('API_RESPONSE', r);

    if (r.error) {
      console.error('❌ API 오류 발생:', r);
      addAI('오류가 발생했습니다: ' + (r.raw || r.error));
      return;
    }

    renderQuestions(r.questions || []);
    
  } catch (error) {
    console.error('❌ nextLoop 오류:', error);
    debugLog('NEXT_LOOP_ERROR', error);
    addAI('시스템 오류가 발생했습니다. 다시 시도해주세요.');
  }
}

function renderQuestions(questions) {
  debugLog('RENDER_QUESTIONS', { questionsCount: questions.length, questions });
  
  const box = $("questions");
  if (!questions.length) { 
    console.log('❌ 질문이 없어서 AI 개선으로 진행');
    box.classList.add("hidden");
    directImproveWithAI(); // ← 여기가 핵심 변경!
    return;
  }
  
  console.log('✅ 질문 렌더링:', questions);
  box.classList.remove("hidden");
  state.activeKeys = questions.map(q => q.key);

  const inputs = questions.map(q => `
    <div class="q-item">
      <div><b>${q.key}</b> — ${q.question}</div>
      <input data-key="${q.key}" placeholder="여기에 답변"/>
    </div>`).join("");

  box.innerHTML = `<h3>질문</h3>${inputs}
    <button id="submitAnswers">답변 제출</button>
    <button id="skipToAI" style="margin-left: 10px; background: #28a745;">지금 바로 AI 개선하기</button>`;
  
  $("submitAnswers").onclick = onSubmitAnswers;
  $("skipToAI").onclick = directImproveWithAI; // ← 건너뛰기 버튼 추가
}

async function onSubmitAnswers() {
  debugLog('SUBMIT_ANSWERS_START', {});
  
  const items = [...document.querySelectorAll('#questions input')];
  if (items.length === 0) { 
    addAI("질문이 없어요. AI 개선을 시작합니다."); 
    return directImproveWithAI(); 
  }

  const payload = {};
  for (const i of items) {
    payload[i.dataset.key] = i.value.trim();
  }
  
  const line = Object.entries(payload).map(([k,v]) => `${k}: ${v || '(빈)'}`).join(", ");
  debugLog('USER_ANSWERS', { payload, line });

  addMe(line);
  state.answers.push(line);

  if (Array.isArray(state.activeKeys)) {
    state.askedKeys.push(...state.activeKeys);
  }

  try {
    // 의도 점수만 간단히 계산
    const answerCount = state.answers.length;
    const estimatedScore = Math.min(20 + (answerCount * 25), 100);
    
    $("intentScore").textContent = estimatedScore;
    addAI(`업데이트 ▶ 의도 ${estimatedScore}점`);

    state.intent.intentScore = estimatedScore;

    // 95점 달성하거나 3라운드 이상이면 AI 개선으로
    if (estimatedScore >= 95 || state.turns >= 2) {
      console.log('🎉 조건 달성! AI 개선 시작');
      directImproveWithAI();
      return;
    }

    state.turns++;
    if (state.turns >= 10) {
      console.log('⚠️ 최대 턴수 도달');
      addAI("최대 턴수 도달. AI 개선을 시작합니다.");
      directImproveWithAI();
    } else {
      console.log('🔄 다음 라운드 진행');
      await nextLoop();
    }
    
  } catch (error) {
    console.error('❌ 답변 처리 오류:', error);
    debugLog('SUBMIT_ANSWERS_ERROR', error);
  }
}

// ★ 핵심: 직접 AI 개선 호출
async function directImproveWithAI() {
  console.log('🤖 직접 AI 개선 시작');
  debugLog('DIRECT_AI_IMPROVE_START', state);
  
  $("questions").classList.add("hidden");
  addAI('🤖 OpenAI로 프롬프트를 개선하고 있습니다... 잠시만 기다려주세요.');

  try {
    console.log('🚀 OpenAI API 호출: /api/improve-prompt');
    console.log('📨 요청 데이터:', {
      userInput: state.userInput,
      answers: state.answers,
      domain: state.domain
    });

    const response = await post('/api/improve-prompt', {
      userInput: state.userInput,
      answers: state.answers,
      domain: state.domain
    });

    console.log('📥 OpenAI 응답:', response);

    if (response.error) {
      console.error('❌ AI 개선 오류:', response);
      addAI('AI 개선 중 오류가 발생했습니다: ' + (response.message || response.error));
      finalizeFallback();
      return;
    }

    // 성공적으로 개선된 경우
    const improvedPrompt = response.draft || response.improvedPrompt || response.text;
    const intentScore = response.intentScore || state.intent.intentScore || 95;
    const qualityScore = response.promptScore || response.qualityScore || 95;

    console.log('✨ AI 개선 완료:', {
      improvedPrompt: improvedPrompt.slice(0, 100) + '...',
      intentScore,
      qualityScore
    });

    // 점수 업데이트
    $("intentScore").textContent = intentScore;
    $("promptScore").textContent = qualityScore;

    addAI(`🎉 AI 개선 완료! 의도 ${intentScore}점, 품질 ${qualityScore}점 달성`);

    // 최종 결과 표시
    finalizeWithAIResult(improvedPrompt, intentScore, qualityScore);

  } catch (error) {
    console.error('❌ AI 개선 중 오류:', error);
    addAI('AI 개선 중 오류가 발생했습니다. 기본 버전으로 완료합니다.');
    finalizeFallback();
  }
}

function finalizeWithAIResult(improvedPrompt, intentScore, qualityScore) {
  console.log('🏁 AI 개선 결과로 최종 완료');
  
  $("final").classList.remove("hidden");
  
  console.log('✨ 최종 AI 개선 프롬프트:', improvedPrompt);
  $("finalText").textContent = improvedPrompt;

  const payload = {
    version: "pc-0.3",
    intent: { domain: state.domain, intentScore: intentScore },
    prompt: { text: improvedPrompt, total: qualityScore, language: "ko", length_limit: 500 },
    meta: { 
      aiImproved: true,
      originalInput: state.userInput,
      answersUsed: state.answers,
      timestamp: new Date().toISOString() 
    }
  };
  
  console.log('📦 AI 개선 MCP JSON:', payload);
  $("finalJson").textContent = JSON.stringify(payload, null, 2);

  $("sendMcp").onclick = async () => {
    console.log('🚀 MCP 전송 시작');
    try {
      const r = await post("/api/mcp", payload);
      console.log('📥 MCP 응답:', r);
      $("mcpResult").textContent = JSON.stringify(r, null, 2);
    } catch (error) {
      console.error('❌ MCP 전송 오류:', error);
    }
  };
}

function finalizeFallback() {
  console.log('🏁 폴백으로 최종 완료');
  
  $("final").classList.remove("hidden");
  
  const fallbackPrompt = synthesizePrompt(state.userInput, state.answers, state.domain);
  console.log('✨ 폴백 프롬프트:', fallbackPrompt);
  
  $("finalText").textContent = fallbackPrompt;

  const payload = {
    version: "pc-0.3",
    intent: { domain: state.domain, intentScore: state.intent.intentScore || 80 },
    prompt: { text: fallbackPrompt, total: 85, language: "ko", length_limit: 500 },
    meta: { 
      aiImproved: false,
      fallback: true,
      timestamp: new Date().toISOString() 
    }
  };
  
  $("finalJson").textContent = JSON.stringify(payload, null, 2);
}

function synthesizePrompt(input, answers, domain) {
  const header = domain === "dev"
    ? "[시스템] 프롬프트 개선기 - "
    : domain === "image"
      ? "이미지 생성용: "
      : "영상 생성용: ";
      
  const body = [input, ...answers].join(" ").replace(/\s+/g, " ").trim();
  return refineKo(header + body);
}

function refineKo(text) {
  const t = text.replace(/\s+/g," ").trim();
  return t.length <= 500 ? t : t.slice(0, 498) + "…";
}

function addMe(t) { addMsg(t, "me"); }
function addAI(t) { addMsg(t, "ai"); }
function addMsg(t, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`; 
  div.textContent = t;
  $("chat").appendChild(div);
}

async function post(url, body) {
  console.log(`🌐 HTTP POST 요청: ${url}`);
  console.log('📤 요청 본문:', body);
  
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {})
    });
    
    console.log(`📡 HTTP 응답 상태: ${r.status} ${r.statusText}`);
    
    const text = await r.text();
    console.log('📥 원본 응답 텍스트:', text);
    
    if (!r.ok) {
      console.error("❌ HTTP 오류:", url, r.status, text);
      return { error: true, status: r.status, raw: text };
    }
    
    try { 
      const parsed = JSON.parse(text || "{}");
      console.log('✅ 파싱된 JSON:', parsed);
      return parsed;
    } catch (e) {
      console.error("❌ JSON 파싱 오류:", url, e, text);
      return { error: true, status: r.status, raw: text };
    }
    
  } catch (error) {
    console.error('❌ 네트워크 오류:', error);
    return { error: true, message: error.message };
  }
}
