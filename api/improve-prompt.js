// api/improve-prompt.js
// Next.js API Route — self-contained drop-in version
// NOTE: If your project already has utils (mentionExtractor, intentAnalyzer, evaluationSystem, callOpenAI, DOMAIN_CHECKLISTS),
// you can remove the inline shims below and import your own. The logic reflects diff + 중복질문 방지 + 한국어 질문 + 라운드별 드래프트 개선 반영.

export default async function handler(req, res) {
  try {
    const {
      step = 'start',
      userInput = '',
      answers = [],
      domain = 'video', // 'video' | 'image'
      round = 1,
      mode = 'single', // 'single' | 'bulk'
      asked = [],       // 👈 프론트에서 지금까지 물어본 질문 텍스트 배열
      debug = false,
    } = (req.method === 'POST' ? req.body : req.query) || {};

    if (!userInput || typeof userInput !== 'string') {
      return res.status(400).json({ success: false, error: 'USER_INPUT_REQUIRED' });
    }

    if (step === 'start') return handleStart(res, userInput, domain, asked, debug);
    if (step === 'questions') return handleQuestions(res, userInput, Array.isArray(answers) ? answers : [], domain, Number(round) || 1, mode, asked, debug);
    if (step === 'generate') return handleGenerate(res, userInput, Array.isArray(answers) ? answers : [], domain, asked, debug);

    // default: begin flow
    return handleStart(res, userInput, domain, asked, debug);
  } catch (e) {
    const wrapped = wrap(e, 'UNHANDLED_API_ERROR');
    if (process.env.NODE_ENV !== 'production') console.error(wrapped);
    return res.status(500).json({ success: false, error: wrapped.code || 'UNKNOWN', detail: String(wrapped.message || wrapped) });
  }
}

// ========== 단계 핸들러들 ==========

async function handleStart(res, userInput, domain, asked, debug) {
  try {
    const mentions = mentionExtractor.extract(userInput);
    const questions = await generateAIQuestions(userInput, [], domain, mentions, 1, { draftPrompt: '', targetCount: 5, asked, debug });
    const draftPrompt = await generateDraftPrompt(userInput, [], domain, debug);
    return res.status(200).json({
      success: true,
      step: 'questions',
      questions,
      round: 1,
      mentions,
      draftPrompt,
      ui: { language: 'ko', allowMulti: true, includeOther: true },
      progress: { intentScore: 0, coverage: 0 },
      message: 'AI가 체크리스트를 분석해서 질문을 생성했습니다.'
    });
  } catch (e) {
    throw wrap(e, 'AI_QUESTION_GENERATION_FAILED');
  }
}

async function handleQuestions(res, userInput, answers, domain, round, mode, asked, debug) {
  try {
    const allText = [userInput, ...answers].join(' ');
    const mentions = mentionExtractor.extract(allText);
    const checklist = DOMAIN_CHECKLISTS[domain] || DOMAIN_CHECKLISTS.video;

    // 임시 개선(영문) → 이번 라운드 기준선
    const draftPrompt = await generateDraftPrompt(userInput, answers, domain, debug);

    // 의도/커버리지(초안까지 포함해 점수 상승 유도)
    const intentScore = intentAnalyzer.calculateIntentScore(
      userInput, answers, domain, checklist, mentions, draftPrompt
    );
    const coverage = getCoverageRatio(checklist, (allText + '\n' + draftPrompt).toLowerCase(), mentions);
    const coveragePct = Math.round(coverage * 100);

    // ✅ 조건: 커버리지/라운드/점수 중 하나라도 통과하면 generate로 진행
    if (coverage >= 0.65 || (round >= 3 && coverage >= 0.55) || intentScore >= 80) {
      return res.status(200).json({
        success: true,
        step: 'generate',
        intentScore,
        coverage: coveragePct,
        draftPrompt,
        ui: { language: 'ko', allowMulti: true, includeOther: true },
        progress: { intentScore, coverage: coveragePct },
        message: `충분한 정보가 수집되었습니다. (coverage ${coveragePct}%) 프롬프트를 생성합니다.`
      });
    }

    // 부족하면 정말 부족한 것만 소수 질문 (중복 방지)
    const targetCount = mode === 'bulk' ? 5 : 3;
    const nextQuestions = await generateAIQuestions(userInput, answers, domain, mentions, round + 1, { draftPrompt, targetCount, asked, debug });

    if (!nextQuestions || nextQuestions.length === 0) {
      return res.status(200).json({
        success: true,
        step: 'generate',
        intentScore,
        coverage: coveragePct,
        draftPrompt,
        ui: { language: 'ko', allowMulti: true, includeOther: true },
        progress: { intentScore, coverage: coveragePct },
        message: '더 물어볼 핵심 정보가 없어 최종 프롬프트를 생성합니다.'
      });
    }

    return res.status(200).json({
      success: true,
      step: 'questions',
      questions: nextQuestions,
      round: round + 1,
      intentScore,
      coverage: coveragePct,
      draftPrompt,
      ui: { language: 'ko', allowMulti: true, includeOther: true },
      progress: { intentScore, coverage: coveragePct },
      message: `현재 coverage ${coveragePct}%. 부족 정보만 이어서 질문합니다.`
    });
  } catch (e) {
    throw wrap(e, 'INTENT_ANALYSIS_FAILED');
  }
}

async function handleGenerate(res, userInput, answers, domain, asked, debug) {
  let attempts = 0;
  const maxAttempts = 4;
  let best = { text: '', score: -1 };

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const generatedPrompt = await generateAIPrompt(userInput, answers, domain, debug);
      const qualityScore = evaluationSystem.evaluatePromptQuality(generatedPrompt, domain);
      if (qualityScore.total > best.score) {
        best = { text: generatedPrompt, score: qualityScore.total };
      }

      if (qualityScore.total >= 95) {
        return res.status(200).json({
          success: true,
          step: 'completed',
          originalPrompt: userInput,
          improvedPrompt: generatedPrompt,
          intentScore: 95,
          qualityScore: qualityScore.total,
          attempts,
          message: `🎉 완성! AI가 ${attempts}번 만에 95점 품질 달성!`
        });
      } else {
        if (attempts >= maxAttempts) {
          // ✅ 95 미만이어도 최고 점수 버전을 우선 반환(완결)
          if (best.text) {
            return res.status(200).json({
              success: true,
              step: 'completed',
              originalPrompt: userInput,
              improvedPrompt: best.text,
              intentScore: 95,
              qualityScore: best.score,
              attempts,
              message: `최대 시도 도달. 현재 최고 품질 ${best.score}점으로 완료합니다.`
            });
          }
        }
        // continue loop
      }
    } catch (e) {
      if (attempts >= maxAttempts) {
        // 실패해도 최고 버전 있으면 완결
        if (best.text) {
          return res.status(200).json({
            success: true,
            step: 'completed',
            originalPrompt: userInput,
            improvedPrompt: best.text,
            intentScore: 95,
            qualityScore: best.score,
            attempts,
            message: `생성 반복 실패. 현재 최고 품질 ${best.score}점으로 완료합니다.`
          });
        }
        // 정말 아무 것도 없으면 최소 질문 1~2개만
        const mentions = mentionExtractor.extract([userInput, ...answers].join(' '));
        const fallbackQuestions = await generateAIQuestions(
          userInput, answers, domain, mentions, 1, { draftPrompt: '', targetCount: 2, asked, debug }
        );
        return res.status(200).json({
          success: true,
          step: 'questions',
          questions: fallbackQuestions || [],
          round: 1,
          intentScore: 95,
          message: '생성에 실패하여 꼭 필요한 최소 질문을 제시합니다.'
        });
      }
    }
  }
}

// ========== LLM 유틸 ==========

// 임시 개선 프롬프트(영문)
async function generateDraftPrompt(userInput, answers, domain, debug) {
  const allAnswers = [userInput, ...answers].join('\n');
  const prompt =
    domain === 'image'
      ? `Create an interim improved image prompt in English from the following facts.
Keep it concise but structured.

${allAnswers}

Return only the prompt text.`
      : `Create an interim improved video prompt in English from the following facts.
Keep it concise but structured.

${allAnswers}

Return only the prompt text.`;

  const text = await callOpenAI(prompt, 0.2, debug);
  return (text || '').trim();
}

// 질문 생성기
async function generateAIQuestions(userInput, answers, domain, mentions, round, opts = {}) {
  const { draftPrompt = '', targetCount = 3, asked = [], debug = false } = opts;
  const checklist = DOMAIN_CHECKLISTS[domain] || DOMAIN_CHECKLISTS.video;
  const all = [userInput, ...answers, draftPrompt].join(' ').toLowerCase();
  const answeredKW = new Set();
  const safeMentions = Array.from(new Set([...(mentions || [])].map(String))).slice(0, 30).join(', ');

  // 어떤 키워드가 이미 언급/커버되었는지 간단 체크
  for (const item of checklist.items) {
    if (!item) continue;
    const keys = Array.isArray(item.keywords) ? item.keywords : [item.item, ...(item.keywords || [])];
    for (const k of keys) {
      if (!k) continue;
      if (all.includes(String(k).toLowerCase())) {
        answeredKW.add(String(k).toLowerCase());
      }
    }
  }
  // 이미 선택한 답변을 금지 목록에 추가하여 중복 질문 방지
  for (const ans of answers) {
    if (!ans) continue;
    const parts = String(ans).split(':');
    if (parts.length >= 2) {
      const value = parts.slice(1).join(':').trim().toLowerCase();
      if (value) {
        answeredKW.add(value);
        value.split(/[\s,]+/).forEach(tok => { if (tok) answeredKW.add(tok); });
      }
    }
  }
  // 과거에 물어봤던 질문 텍스트를 금지(동일·유사 질문 방지)
  for (const q of Array.isArray(asked) ? asked : []) {
    const ql = String(q || '').toLowerCase();
    if (!ql) continue;
    answeredKW.add(ql);
    ql.split(/[\s,]+/).forEach(tok => { if (tok) answeredKW.add(tok); });
  }

  // 미싱 토픽 계산
  const missingItems = checklist.items
    .map((x) => ({ item: x.item, keywords: x.keywords || [] }))
    .filter((x) => {
      const bucket = [x.item, ...(x.keywords || [])].filter(Boolean).join(' ').toLowerCase();
      for (const k of answeredKW) if (bucket.includes(k)) return false;
      return true;
    })
    .slice(0, Math.max(3, targetCount * 2));

  const baseSchema = JSON.stringify(
    {
      questions: [
        {
          question: 'string (concise, ask about one missing topic)',
          options: ['optional multi-choice when it helps consistency'],
          rationale: 'why this helps intent/coverage'
        }
      ]
    },
    null,
    2
  );

  const prompt = `You are an expert prompt engineer.
Goal: ask only the minimum decisive questions needed to complete a strong ${domain} prompt.
Avoid duplicates and avoid anything already covered.
Limit to ${targetCount} questions max.

Return all questions and options in Korean. Use concise Korean wording.

Current draft prompt (established facts):
${draftPrompt ? draftPrompt.slice(0, 1200) : '(none)'}

User input: ${userInput.slice(0, 400)}
Answers so far: ${(answers.join(' | ') || 'none').slice(0, 400)}
Extracted mentions:
${safeMentions || '(none)'}

BANNED keywords (already covered or previously asked):
${Array.from(answeredKW).join(', ') || '(none)'}

MISSING topics (ask ONLY about these; merge if < ${targetCount}):
${missingItems.map((x) => `- ${String(x.item)}`).join('\n')}

Return JSON matching this example shape:
${baseSchema}
`;

  const raw = await callOpenAI(prompt, 0.3, debug);
  let cleaned = (raw || '').trim().replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const first = cleaned.indexOf('{'), last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    if (debug) console.warn('JSON parse failed, returning fallback single question. Raw:', cleaned);
    return [
      { question: '최적화해야 하는 주요 목표와 타깃은 무엇인가요?', options: ['인지도', '참여도', '전환', '교육'], rationale: '우선순위를 명확히 해 구조와 톤을 결정합니다.' }
    ];
  }

  let qs = Array.isArray(parsed?.questions) ? parsed.questions : [];

  // 이미 언급된 키워드 포함 질문/옵션 제거
  const ban = new Set(Array.from(answeredKW).filter(Boolean));
  qs = qs.filter((q) => {
    const bucket = [q?.question || '', ...(q?.options || [])].join(' ').toLowerCase();
    for (const k of ban) { if (k && bucket.includes(k)) return false; }
    return true;
  });

  // dedupe + slice
  const seen = new Set();
  qs = qs.filter((q) => {
    const key = (q?.question || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (qs.length > targetCount) qs = qs.slice(0, targetCount);
  return qs;
}

// 최종 프롬프트 생성
async function generateAIPrompt(userInput, answers, domain, debug) {
  const allAnswers = [userInput, ...answers].join('\n');
  const domainPrompts = {
    video: `Create a professional, production-ready video prompt in English from the following information:

${allAnswers}

Requirements:
- Scene-by-scene timeline
- Clear subject + audience + platform fit
- Camera work and editing directions
- Music/SFX and captions guidance
- Technical specs (resolution, codec)
- Length target
 - Only include details explicitly mentioned in the user input or answers; do not invent new scenes, actions, or specifics beyond the provided facts.`,
    image: `Create a professional, production-ready image prompt in English from the following information:

${allAnswers}

Requirements:
- Clear subject and composition
- Style, lighting, lens/camera hints when relevant
- Background/setting and mood
- Negative constraints (what to avoid)
 - Technical specs (size/aspect, quality)
 - Only include details explicitly mentioned in the user input or answers; do not invent new elements beyond the provided facts.`
  };

  const sys = `You are a world-class prompt engineer. You write concise but complete prompts that tools can execute.`;
  const prompt = domainPrompts[domain] || domainPrompts.video;
  const raw = await callOpenAIWithSystem(sys, prompt, 0.2, debug);
  return (raw || '').trim();
}

// ========== 평가/의도/체크리스트/멘션 — 간단한 SHIMS ==========

const DOMAIN_CHECKLISTS = {
  video: {
    items: [
      // goal 관련 키워드 확장
      { item: 'goal', keywords: ['goal', 'objective', 'kpi', 'conversion', 'awareness', 'entertain', 'entertainment', 'educate', 'education'] },
      // audience 관련 키워드 확장
      { item: 'audience', keywords: ['audience', 'target', 'demographic', 'adult', 'adults', 'kids', 'children', 'general'] },
      // style 관련 키워드 확장
      { item: 'style', keywords: ['style', 'tone', 'mood', 'vibe', 'dramatic', 'comedic', 'comedy'] },
      // audio 관련 키워드 확장
      { item: 'audio', keywords: ['music', 'sfx', 'sound', 'voiceover', 'caption', 'background music', 'sound effects'] },
      { item: 'platform', keywords: ['youtube', 'shorts', 'tiktok', 'instagram', 'platform'] },
      { item: 'length', keywords: ['seconds', 'minutes', 'length', 'duration'] },
      { item: 'visuals', keywords: ['camera', 'shot', 'b-roll', 'scene', 'timeline'] },
      { item: 'tech', keywords: ['resolution', 'codec', 'fps', 'aspect'] }
    ]
  },
  image: {
    items: [
      { item: 'subject', keywords: ['subject', 'character', 'object'] },
      { item: 'composition', keywords: ['framing', 'rule of thirds', 'composition'] },
      { item: 'style', keywords: ['style', 'realistic', 'painterly', 'anime', 'photoreal', 'cartoonish', 'minimalist', 'abstract', 'photorealistic'] },
      { item: 'lighting', keywords: ['lighting', 'hdr', 'sunset', 'twilight', 'dim', 'dramatic shadows', 'studio light'] },
      { item: 'background', keywords: ['background', 'setting', 'environment', 'ruins', 'ruined cityscape', 'natural landscape', 'wildlife', 'neon signs'] },
      { item: 'mood', keywords: ['dark', 'moody', 'menacing', 'harsh', 'dramatic'] },
      { item: 'view', keywords: ['panoramic', 'side view'] },
      { item: 'activity', keywords: ['survivor camps', 'survivors', 'foraging', 'mutated creatures', 'makeshift equipment', 'survivor activities'] },
      { item: 'negative', keywords: ['avoid', 'no', 'exclude', 'banned', 'overly populated areas'] },
      { item: 'tech', keywords: ['size', 'aspect', 'quality', 'dpi'] }
    ]
  }
};

const mentionExtractor = {
  extract(text = '') {
    const m = new Set();
    const regexTags = /[#@]([\p{L}\p{N}_-]{2,})/gu;
    const words = (text || '').toLowerCase().split(/[^\p{L}\p{N}_-]+/u);
    for (const w of words) if (w && w.length > 3) m.add(w);
    let mt;
    while ((mt = regexTags.exec(text))) m.add(mt[1]);
    return Array.from(m).slice(0, 50);
  }
};

const intentAnalyzer = {
  calculateIntentScore(userInput, answers, domain, checklist, mentions, draftPrompt = '') {
    const text = [userInput, ...answers, draftPrompt].join(' ').toLowerCase();
    const items = checklist?.items || [];
    let hit = 0;
    for (const it of items) {
      const keys = [it.item, ...(it.keywords || [])].filter(Boolean);
      if (keys.some((k) => text.includes(String(k).toLowerCase()))) hit++;
    }
    const coverage = items.length ? hit / items.length : 0;
    const mentionBoost = Math.min(0.1, (mentions?.length || 0) / 100);
    return Math.round(Math.min(1, coverage + mentionBoost) * 100);
  }
};

const evaluationSystem = {
  evaluatePromptQuality(text, domain) {
    const t = (text || '').trim();
    const lenScore = Math.max(0, Math.min(20, Math.floor(t.length / 100))); // 0~20
    const hasBullets = /[-•\n]{2,}/.test(t) ? 15 : 0; // 0 or 15
    const hasTech = /(resolution|codec|aspect|dpi|lens|camera|fps)/i.test(t) ? 20 : 0;
    const hasStructure = /(scene|timeline|shot|subject|background|style|lighting)/i.test(t) ? 25 : 0;
    const clarity = /avoid|do not|negative/i.test(t) ? 10 : 5;
    const domainBonus = domain === 'video' ? (/music|sfx|caption|editing/i.test(t) ? 10 : 0) : (/composition|mood/i.test(t) ? 10 : 0);
    const total = Math.min(100, lenScore + hasBullets + hasTech + hasStructure + clarity + domainBonus);
    return { total };
  }
};

function getCoverageRatio(checklist, text, mentions = []) {
  const items = checklist?.items || [];
  if (!items.length) return 0;
  let covered = 0;
  for (const it of items) {
    const keys = [it.item, ...(it.keywords || [])].filter(Boolean).map((x) => String(x).toLowerCase());
    const any = keys.some((k) => (text || '').includes(k));
    if (any) covered++;
  }
  const base = covered / items.length;
  const mentionBoost = Math.min(0.1, (mentions?.length || 0) / 100);
  return Math.min(1, base + mentionBoost);
}

// ========== OpenAI helpers ==========

async function callOpenAI(prompt, temperature = 0.3, debug = false) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');

  const body = {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a terse, reliable assistant. Return only what is asked.' },
      { role: 'user', content: prompt }
    ],
    temperature,
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const msg = await resp.text();
    if (debug) console.warn('OpenAI error:', msg);
    throw new Error(`OPENAI_HTTP_${resp.status}`);
  }

  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callOpenAIWithSystem(system, user, temperature = 0.2, debug = false) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');

  const body = {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature,
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const msg = await resp.text();
    if (debug) console.warn('OpenAI error:', msg);
    throw new Error(`OPENAI_HTTP_${resp.status}`);
  }

  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ========== utils ==========

function wrap(err, code = 'UNKNOWN') {
  const e = err instanceof Error ? err : new Error(String(err));
  e.code = code;
  return e;
}
