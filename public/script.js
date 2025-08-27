// public/script.js - 디버깅 강화 버전
const $ = (id) => document.getElementById(id);

// 🔍 디버깅 로그 함수
function debugLog(step, data) {
  console.log(`🔍 [DEBUG ${step}]`, data);
  console.trace(); // 호출 스택도 표시
}

// 🎯 상태 추적
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
    console.log('❌ 질문이 없어서 종료');
    box.classList.add("hidden");
    finalize();
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

  box.innerHTML = `<h3>질문</h3>${inputs}<button id="submitAnswers">답변 제출</button>`;
  $("submitAnswers").onclick = onSubmitAnswers;
}

async function onSubmitAnswers() {
  debugLog('SUBMIT_ANSWERS_START', {});
  
  const items = [...document.querySelectorAll('#questions input')];
  if (items.length === 0) { 
    addAI("질문이 없어요. 지금까지 정보로 마무리합니다."); 
    return finalize(); 
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
    // 1) 의도 점수 계산
    console.log('🎯 의도 점수 계산 시작');
    const intent = await post("/api/score/intent", {
      userInput: state.userInput,
      answers: state.answers,
      domain: state.domain
    });
    
    console.log('📊 의도 점수 결과:', intent);
    state.intent = intent;

    // 2) 임시 프롬프트 생성 및 품질 점수
    state.draft = synthesizePrompt(state.userInput, state.answers, state.domain);
    console.log('📝 임시 프롬프트:', state.draft);
    
    const domainMap = state.domain === "image" ? "visual_design" : 
                     state.domain === "video" ? "video" : "development";
    
    console.log('🔧 품질 점수 계산 시작');
    const prompt = await post("/api/score/prompt", { 
      prompt: state.draft, 
      domain: domainMap 
    });
    
    console.log('📊 품질 점수 결과:', prompt);
    state.prompt = prompt;

    // 점수 업데이트
    $("intentScore").textContent = intent.intentScore;
    $("promptScore").textContent = prompt.total;
    addAI(`업데이트 ▶ 의도 ${intent.intentScore} / 프롬프트 ${prompt.total}`);

    debugLog('SCORES_UPDATED', {
      intentScore: intent.intentScore,
      promptScore: prompt.total,
      shouldFinalize: intent.intentScore >= 95 && prompt.total >= 95
    });

    // 컷오프 완료 체크
    if (intent.intentScore >= 95 && prompt.total >= 95) {
      console.log('🎉 95점 달성! 최종 완료');
      finalize();
      return;
    }

    state.turns++;
    if (state.turns >= 10) {
      console.log('⚠️ 최대 턴수 도달');
      addAI("턴 상한(10) 도달. 현재 정보로 최종 프롬프트를 제시합니다.");
      finalize();
    } else {
      console.log('🔄 다음 라운드 진행');
      await nextLoop();
    }
    
  } catch (error) {
    console.error('❌ 답변 처리 오류:', error);
    debugLog('SUBMIT_ANSWERS_ERROR', error);
  }
}

function finalize() {
  console.log('🏁 최종 완료 시작');
  debugLog('FINALIZE_START', state);
  
  $("questions").classList.add("hidden");
  $("final").classList.remove("hidden");
  
  const finalText = refineKo(state.draft);
  console.log('✨ 최종 프롬프트:', finalText);
  
  $("finalText").textContent = finalText;

  const payload = {
    version: "pc-0.3",
    intent: { domain: state.domain, intentScore: state.intent.intentScore },
    prompt: { text: finalText, total: state.prompt.total, language: "ko", length_limit: 500 },
    meta: { assumptions: [], warnings: [], notes: [], timestamp: new Date().toISOString() }
  };
  
  console.log('📦 MCP JSON 페이로드:', payload);
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

function synthesizePrompt(input, answers, domain) {
  console.log('🔧 프롬프트 합성:', { input, answers, domain });
  
  const header = domain === "dev"
    ? "[시스템] 당신은 프롬프트 개선기입니다. 95/95 달성 시 최종 출력.\n[사용자] "
    : domain === "image"
      ? "이미지 생성용 프롬프트(한국어, 500자 이내): "
      : "영상 생성용 프롬프트(한국어, 500자 이내): ";
      
  const body = [input, ...answers].join(" ").replace(/\s+/g, " ").trim();
  const result = refineKo(header + body);
  
  console.log('✅ 합성된 프롬프트:', result);
  return result;
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
