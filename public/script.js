const $ = (id) => document.getElementById(id);

const state = {
  domain: "dev",
  userInput: "",
  turns: 0,
  answers: [],
  intent: { intentScore: 0 },
  prompt: { total: 0 },
  draft: ""
};

$("startBtn").onclick = start;
$("domain").onchange = (e)=> state.domain = e.target.value;

async function start(){
  state.userInput = $("userInput").value.trim();
  if(!state.userInput){ alert("프롬프트를 입력해 주세요."); return; }
  state.turns = 0; state.answers = [];
  $("chat").innerHTML = ""; $("final").classList.add("hidden");
  addAI(`제가 이해한 의도: "${state.userInput.slice(0,80)}..." 맞나요? 부족한 핵심만 1~2개씩 여쭤볼게요.`);
  await nextLoop();
}

async function nextLoop(){
  const r = await post("/api/questions", {
    domain: state.domain,
    userInput: state.userInput,
    answers: state.answers
  });
  renderQuestions(r.questions || []);
}

function renderQuestions(questions){
  const box = $("questions");
  box.classList.remove("hidden");
  const inputs = questions.map(q=>`
    <div class="q-item">
      <div><b>${q.key}</b> — ${q.question}</div>
      <input data-key="${q.key}" placeholder="여기에 답변"/>
    </div>`).join("");
  box.innerHTML = `<h3>질문</h3>${inputs}<button id="submitAnswers">답변 제출</button>`;
  $("submitAnswers").onclick = onSubmitAnswers; // 렌더마다 재바인딩
}

async function onSubmitAnswers(){
  const items = [...document.querySelectorAll('#questions input')];
  if(items.length === 0){ addAI("질문이 없어요. 지금까지 정보로 마무리합니다."); return finalize(); }

  const payload = {};
  for (const i of items) payload[i.dataset.key] = i.value.trim();
  const line = Object.entries(payload).map(([k,v])=>`${k}: ${v || '(빈)'}`).join(", ");

  addMe(line);
  state.answers.push(line);

  // 1) 의도 점수
  const intent = await post("/api/score/intent", {
    userInput: state.userInput,
    answers: state.answers,
    domain: state.domain
  });
  state.intent = intent;

  // 2) 중간 프롬프트 생성 → 점수
  state.draft = synthesizePrompt(state.userInput, state.answers, state.domain);
  const domainMap = state.domain === "image" ? "visual_design" : state.domain === "video" ? "video" : "development";
  const prompt = await post("/api/score/prompt", { prompt: state.draft, domain: domainMap });
  state.prompt = prompt;

  $("intentScore").textContent = intent.intentScore;
  $("promptScore").textContent = prompt.total;
  addAI(`업데이트 ▶ 의도 ${intent.intentScore} / 프롬프트 ${prompt.total}`);

  // 컷오프 체크
  if (intent.intentScore >= 95 && prompt.total >= 95) {
    finalize();
    return;
  }

  state.turns++;
  if (state.turns >= 10) {
    addAI("턴 상한(10) 도달. 현재 정보로 최종 프롬프트를 제시합니다.");
    finalize();
  } else {
    await nextLoop();
  }
}

function finalize(){
  $("questions").classList.add("hidden");
  $("final").classList.remove("hidden");
  const finalText = refineKo(state.draft);
  $("finalText").textContent = finalText;

  const payload = {
    version: "pc-0.3",
    intent: { domain: state.domain, intentScore: state.intent.intentScore },
    prompt: { text: finalText, total: state.prompt.total, language: "ko", length_limit: 500 },
    meta: { assumptions: [], warnings: [], notes: [], timestamp: new Date().toISOString() }
  };
  $("finalJson").textContent = JSON.stringify(payload, null, 2);

  $("sendMcp").onclick = async ()=>{
    const r = await post("/api/mcp", payload);
    $("mcpResult").textContent = JSON.stringify(r, null, 2);
  };
}

function synthesizePrompt(input, answers, domain){
  const header = domain === "dev"
    ? "[시스템] 당신은 프롬프트 개선기입니다. 95/95 달성 시 최종 출력.\n[사용자] "
    : domain === "image"
      ? "이미지 생성용 프롬프트(한국어, 500자 이내): "
      : "영상 생성용 프롬프트(한국어, 500자 이내): ";
  const body = [input, ...answers].join(" ").replace(/\s+/g, " ").trim();
  return refineKo(header + body);
}

function refineKo(text){
  const t = text.replace(/\s+/g," ").trim();
  return t.length <= 500 ? t : t.slice(0, 498) + "…";
}

function addMe(t){ addMsg(t, "me"); }
function addAI(t){ addMsg(t, "ai"); }
function addMsg(t, who){
  const div = document.createElement("div");
  div.className = `msg ${who}`; div.textContent = t;
  $("chat").appendChild(div);
}

async function post(url, body){
  const r = await fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body ?? {})
  });
  const text = await r.text();
  try { return JSON.parse(text || "{}"); } catch { return {}; }
}
