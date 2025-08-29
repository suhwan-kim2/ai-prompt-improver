// api/improve-prompt.js
// Next.js API Route — video/image + writing/daily/dev 확장
// 한국어 질문, 중복 방지, 드래프트 진행, 지어내기 금지, 안전한 에러 처리

export default async function handler(req, res) {
  try {
    const {
      step = 'start',
      userInput = '',
      answers = [],
      asked = [],
      domain = 'video',
      round = 1,
      mode = 'single',
      debug = false,
    } = (req.method === 'POST' ? req.body : req.query) || {};

    if (!userInput || typeof userInput !== 'string') {
      return res.status(400).json({ success: false, error: 'USER_INPUT_REQUIRED' });
    }

    // 지원 안 되는 도메인 방지: 기본 video로 폴백
    const dom = DOMAIN_CHECKLISTS[domain] ? domain : 'video';

    if (step === 'start') return handleStart(res, userInput, dom, debug);
    if (step === 'questions') return handleQuestions(res, userInput, Array.isArray(answers) ? answers : [], dom, Number(round) || 1, mode, asked, debug);
    if (step === 'generate') return handleGenerate(res, userInput, Array.isArray(answers) ? answers : [], dom, debug);

    return handleStart(res, userInput, dom, debug);
  } catch (e) {
    const wrapped = wrap(e, 'UNHANDLED_API_ERROR');
    if (process.env.NODE_ENV !== 'production') console.error(wrapped);
    // 항상 JSON으로 응답
    return res.status(500).json({ success: false, error: wrapped.code || 'UNKNOWN', detail: String(wrapped.message || wrapped) });
  }
}

// ========== 단계 핸들러들 ==========

async function handleStart(res, userInput, domain, debug) {
  try {
    const mentions = mentionExtractor.extract(userInput);
    const questions = await safeGenerateAIQuestions(userInput, [], domain, mentions, 1, { draftPrompt: '', targetCount: 5, asked: [], debug });
    return res.status(200).json({
      success: true,
      step: 'questions',
      questions,
      round: 1,
      mentions,
      draftPrompt: '',
      status: 'collecting',
      message: 'AI가 체크리스트를 분석해서 질문을 생성했습니다.'
    });
  } catch (e) {
    return res.status(200).json({
      success: true,
      step: 'questions',
      questions: fallbackQuestionsFor(domain),
      round: 1,
      draftPrompt: '',
      status: 'collecting',
      message: '일부 오류가 있었지만 질문을 시작합니다.'
    });
  }
}

async function handleQuestions(res, userInput, answers, domain, round, mode, asked, debug) {
  try {
    const allText = [userInput, ...answers].join(' ');
    const mentions = mentionExtractor.extract(allText);
    const checklist = DOMAIN_CHECKLISTS[domain];

    const draftPrompt = await safeGenerateDraftPrompt(userInput, answers, domain, debug);

    const intentScore = safeIntentScore(userInput, answers, domain, checklist, mentions, draftPrompt);
    const coverage = safeCoverage(checklist, (allText + '\n' + draftPrompt).toLowerCase(), mentions);
    const coveragePct = Math.round(coverage * 100);

    if (coverage >= 0.65 || (round >= 3 && coverage >= 0.55) || intentScore >= 80) {
      return res.status(200).json({
        success: true,
        step: 'generate',
        intentScore,
        coverage: coveragePct,
        draftPrompt,
        status: 'improving',
        message: `충분한 정보가 수집되었습니다. (coverage ${coveragePct}%) 프롬프트를 생성합니다.`
      });
    }

    const targetCount = mode === 'bulk' ? 5 : 3;
    const nextQuestions = await safeGenerateAIQuestions(userInput, answers, domain, mentions, round + 1, { draftPrompt, targetCount, asked, debug });

    if (!nextQuestions || nextQuestions.length === 0) {
      if (round <= 1) {
        const mentions2 = mentionExtractor.extract([userInput, ...answers, draftPrompt].join(' '));
        const fallbackQs = await safeGenerateAIQuestions(
          userInput, answers, domain, mentions2, round + 1,
          { draftPrompt, targetCount: 2, asked, debug }
        );
        if (fallbackQs && fallbackQs.length > 0) {
          return res.status(200).json({
            success: true,
            step: 'questions',
            questions: fallbackQs,
            round: round + 1,
            intentScore,
            coverage: coveragePct,
            draftPrompt,
            status: 'collecting',
            message: '핵심 정보 보강을 위해 추가 질문을 진행합니다.'
          });
        }
      }
      return res.status(200).json({
        success: true,
        step: 'generate',
        intentScore,
        coverage: coveragePct,
        draftPrompt,
        status: 'improving',
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
      status: 'collecting',
      message: `현재 coverage ${coveragePct}%. 부족 정보만 이어서 질문합니다.`
    });
  } catch (e) {
    // 여기서도 절대 500 내지 말고 안전한 다음 단계로
    return res.status(200).json({
      success: true,
      step: 'questions',
      questions: fallbackQuestionsFor(domain),
      round: round + 1,
      intentScore: 0,
      coverage: 0,
      draftPrompt: '',
      status: 'collecting',
      message: '임시 오류로 간단 질문을 이어갑니다.'
    });
  }
}

async function handleGenerate(res, userInput, answers, domain, debug) {
  let attempts = 0;
  const maxAttempts = 4;
  let best = { text: '', score: -1 };

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const generatedPrompt = await safeGenerateAIPrompt(userInput, answers, domain, debug);
      const qualityScore = safeEvaluate(generatedPrompt, domain);
      if (qualityScore > best.score) best = { text: generatedPrompt, score: qualityScore };

      if (qualityScore >= 95) {
        return res.status(200).json({
          success: true,
          step: 'completed',
          originalPrompt: userInput,
          improvedPrompt: generatedPrompt,
          intentScore: Math.max(90, best.score - 2), // 보여주기용, 과도한 95 고정 제거
          qualityScore,
          attempts,
          status: 'done',
          message: `🎉 완성! AI가 ${attempts}번 만에 고품질을 달성했습니다.`
        });
      }
    } catch (e) {
      // 계속 재시도
    }
  }

  // 최종 폴백
  if (best.text) {
    return res.status(200).json({
      success: true,
      step: 'completed',
      originalPrompt: userInput,
      improvedPrompt: best.text,
      intentScore: Math.max(80, best.score - 5),
      qualityScore: best.score,
      attempts: maxAttempts,
      status: 'done',
      message: `최대 시도 도달. 현재 최고 품질 ${best.score}점으로 완료합니다.`
    });
  }

  // 정말 실패 시에도 JSON
  return res.status(200).json({
    success: true,
    step: 'completed',
    originalPrompt: userInput,
    improvedPrompt: `[TBD: could not generate prompt safely for domain "${domain}"]`,
    intentScore: 0,
    qualityScore: 0,
    attempts: maxAttempts,
    status: 'done',
    message: '생성에 실패하여 임시 결과를 반환합니다.'
  });
}

// ========== LLM 유틸 (안전 래퍼) ==========

async function safeGenerateDraftPrompt(userInput, answers, domain, debug) {
  try {
    return await generateDraftPrompt(userInput, answers, domain, debug);
  } catch {
    return '';
  }
}

async function safeGenerateAIQuestions(userInput, answers, domain, mentions, round, opts) {
  try {
    const qs = await generateAIQuestions(userInput, answers, domain, mentions, round, opts);
    if (Array.isArray(qs)) return qs;
  } catch {}
  return fallbackQuestionsFor(domain);
}

async function safeGenerateAIPrompt(userInput, answers, domain, debug) {
  try {
    const out = await generateAIPrompt(userInput, answers, domain, debug);
    return (out || '').trim() || `[TBD: empty output for ${domain}]`;
  } catch {
    return `[TBD: failed to generate for ${domain}]`;
  }
}

function safeIntentScore(userInput, answers, domain, checklist, mentions, draftPrompt) {
  try {
    return intentAnalyzer.calculateIntentScore(userInput, answers, domain, checklist, mentions, draftPrompt);
  } catch { return 0; }
}

function safeCoverage(checklist, text, mentions) {
  try {
    return getCoverageRatio(checklist, text, mentions);
  } catch { return 0; }
}

function safeEvaluate(text, domain) {
  try {
    const q = evaluationSystem.evaluatePromptQuality(text, domain);
    return Math.max(0, Math.min(100, q?.total ?? 0));
  } catch { return 0; }
}

// ========== 드래프트 생성 ==========

async function generateDraftPrompt(userInput, answers, domain, debug) {
  const allAnswers = [userInput, ...answers].join('\n');

  let prompt;
  if (domain === 'image') {
    prompt = `Create an interim improved image prompt in English from the following facts.
Keep it concise but structured.

${allAnswers}

Return only the prompt text.`;
  } else if (domain === 'writing') {
    prompt = `Create a concise interim writing brief in English from the following facts.
Keep it structured with purpose, audience, tone, length, and outline.

${allAnswers}

Return only the brief text.`;
  } else if (domain === 'daily') {
    prompt = `Summarize the user's intent and produce a task-oriented brief in English from the following facts.
Include purpose, key constraints, and a short checklist.

${allAnswers}

Return only the brief text.`;
  } else if (domain === 'dev') {
    // ✅ dev용 임시 드래프트
    prompt = `Create a concise interim web app development brief in English from the following facts.
Include goal, target users, key features, tech/platform preferences (if any), deployment target, and constraints.

${allAnswers}

Return only the brief text.`;
  } else {
    // video (default)
    prompt = `Create an interim improved video prompt in English from the following facts.
Keep it concise but structured.

${allAnswers}

Return only the prompt text.`;
  }

  const text = await callOpenAI(prompt, 0.2, debug);
  return (text || '').trim();
}

// ========== 질문 생성 ==========

async function generateAIQuestions(userInput, answers, domain, mentions, round, opts = {}) {
  const { draftPrompt = '', targetCount = 3, asked = [], debug = false } = opts;
  const checklist = DOMAIN_CHECKLISTS[domain];
  const all = [userInput, ...answers, draftPrompt].join(' ').toLowerCase();
  const answeredKW = new Set();
  const safeMentions = Array.from(new Set([...(mentions || [])].map(String))).slice(0, 30).join(', ');

  for (const item of checklist.items) {
    if (!item) continue;
    const keys = Array.isArray(item.keywords) ? item.keywords : [item.item, ...(item.keywords || [])];
    for (const k of keys) if (all.includes(String(k).toLowerCase())) answeredKW.add(String(k).toLowerCase());
  }
  for (const ans of answers) {
    if (!ans) continue;
    const parts = String(ans).split(':');
    if (parts.length >= 2) {
      const value = parts.slice(1).join(':').trim().toLowerCase();
      if (value) value.split(/\s+/).forEach(tok => answeredKW.add(tok));
    }
  }
  asked.forEach(q => answeredKW.add(q.toLowerCase()));

  const missingItems = checklist.items
    .map(x => ({ item: x.item, keywords: x.keywords || [] }))
    .filter(x => {
      const bucket = [x.item, ...(x.keywords || [])].filter(Boolean).join(' ').toLowerCase();
      for (const k of answeredKW) if (bucket.includes(k)) return false;
      return true;
    })
    .slice(0, Math.max(3, targetCount * 2));

  const baseSchema = JSON.stringify({
    questions: [
      { question: 'string (한국어로 작성, 간결)', options: ['선택지1', '선택지2'], inputType: 'options', priority: 'medium', rationale: '왜 필요한지' }
    ]
  }, null, 2);

  const prompt = `You are an expert prompt engineer.
Goal: ask only the minimum decisive questions needed to complete a strong ${domain} prompt.
Avoid duplicates and anything already covered.
Limit to ${targetCount} questions max.
Return all questions and options in Korean.

Current draft prompt:
${draftPrompt ? draftPrompt.slice(0, 1200) : '(none)'}

User input: ${userInput.slice(0, 400)}
Answers so far: ${(answers.join(' | ') || 'none').slice(0, 400)}
Extracted mentions:
${safeMentions || '(none)'}

BANNED keywords:
${Array.from(answeredKW).join(', ') || '(none)'}

MISSING topics:
${missingItems.map(x => `- ${String(x.item)}`).join('\n')}

Constraints:
- Do NOT propose brand/tool names or very specific examples unless already present in user input/answers/draft.
- Prefer category-style options (예: 플랫폼/호스팅, 기능 범주, 프런트/백엔드 스택, 인증/데이터/배포/테스트/일정).
- For writing/daily/dev domains, you may use inputType 'text' with a short placeholder when options are too narrow.

Return JSON shape:
${baseSchema}`;

  const raw = await callOpenAI(prompt, 0.3, debug);
  let cleaned = (raw || '').trim().replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const first = cleaned.indexOf('{'), last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);

  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { return []; }
  let qs = Array.isArray(parsed?.questions) ? parsed.questions : [];

  const ban = new Set(Array.from(answeredKW).filter(Boolean));
  qs = qs.filter(q => {
    const bucket = [q?.question || '', ...(q?.options || [])].join(' ').toLowerCase();
    for (const k of ban) if (bucket.includes(k)) return false;
    return true;
  });

  const seen = new Set();
  qs = qs.filter(q => {
    const key = (q?.question || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if ((domain === 'writing' || domain === 'daily' || domain === 'dev')) {
    qs = qs.map(q => {
      if (!q.options || q.options.length === 0) {
        return {
          ...q,
          inputType: 'text',
          placeholder: q.placeholder || '간단히 입력해주세요'
        };
      }
      return q;
    });
  }

  if (qs.length > targetCount) qs = qs.slice(0, targetCount);
  return qs;
}

// ========== 최종 프롬프트 생성 ==========

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
- STRICT: Use only details explicitly present in the user input or answers. Do NOT invent specific examples (brand names, platforms, props, exact times) unless provided.
- If any required field is missing, write a placeholder like [TBD: field] instead of guessing.`,
    image: `Create a professional, production-ready image prompt in English from the following information:

${allAnswers}

Requirements:
- Clear subject and composition
- Style, lighting, lens/camera hints when relevant
- Background/setting and mood
- Negative constraints (what to avoid)
- Technical specs (size/aspect, quality)
- STRICT: Use only details explicitly present in the user input or answers. Do NOT invent specific examples or elements.
- If any required field is missing, write a placeholder like [TBD: field].`,
    writing: `Create a professional, production-ready writing brief in English from the following information.

${allAnswers}

Deliver:
- Purpose, audience, tone, language
- Target length (words or characters)
- Structure/outline with bullet points
- Key points to include and to avoid
- Constraints (deadline, platform, style guide)
- STRICT: Use only details explicitly present in the user input or answers. Do NOT invent sources, quotes, names, or data.
- If information is missing, leave [TBD: field] placeholders.
- Output the final brief only.`,
    daily: `Create a concise, actionable task brief in English from the following information.

${allAnswers}

Deliver:
- Purpose and success criteria
- A prioritized checklist (3–7 items)
- Constraints (time, budget, tools)
- Communication template if relevant (e.g., short message/email draft)
- STRICT: Use only details explicitly present in the user input or answers. Do NOT invent contacts, accounts, or tools unless provided.
- If information is missing, leave [TBD: field] placeholders.
- Output the final brief only.`,
    dev: `Create a professional, production-ready web app delivery brief in English from the following information.

${allAnswers}

Deliver:
- Summary (goal, target users, value proposition)
- Functional scope (features grouped by modules)
- Architecture (frontend, backend, API, data flow)
- Tech stack (constraints or [TBD])
- Data model (key entities, fields) and persistence
- Authentication/authorization strategy
- Deployment & hosting plan (environments, CI/CD)
- Non-functional requirements (performance, scalability, availability, cost)
- Security & privacy notes
- Testing plan (unit/e2e), monitoring/logging
- Milestones & timeline
- STRICT: Use only details explicitly present in the user input or answers. Do NOT invent vendor names, accounts, or credentials.
- If information is missing, leave [TBD: field] placeholders.
- Output the final brief only.`
  };

  const sys = `You are a world-class prompt engineer. You write concise, complete outputs only from provided facts.`;
  const prompt = domainPrompts[domain] || domainPrompts.video;
  const raw = await callOpenAIWithSystem(sys, prompt, 0.2, debug);
  const generated = (raw || '').trim();
  return sanitizeGenerated(generated, allAnswers);
}

// ========== 체크리스트(도메인별) ==========

const DOMAIN_CHECKLISTS = {
  video: {
    items: [
      { item: 'goal', keywords: ['goal', 'objective', 'kpi', 'conversion', 'awareness', 'entertain', 'entertainment', 'educate', 'education'] },
      { item: 'audience', keywords: ['audience', 'target', 'demographic', 'adult', 'adults', 'kids', 'children', 'family', 'general'] },
      { item: 'platform', keywords: ['youtube', 'tiktok', 'instagram', 'reels', 'shorts'] },
      { item: 'length', keywords: ['length', 'duration', '1-3 minutes', 'seconds', 'minutes'] },
      { item: 'style', keywords: ['style', 'tone', 'mood', 'vibe', 'dramatic', 'comedic', 'comedy'] },
      { item: 'camera', keywords: ['camera', 'shot', 'close-up', 'wide', 'over-the-shoulder'] },
      { item: 'audio', keywords: ['music', 'sfx', 'sound', 'voiceover', 'caption', 'background music', 'sound effects'] },
      { item: 'subject', keywords: ['dog', 'shiba', 'person', 'product'] },
      { item: 'tech', keywords: ['resolution', 'codec', 'framerate', 'aspect'] }
    ]
  },
  image: {
    items: [
      { item: 'goal', keywords: ['goal', 'purpose', 'poster', 'logo', 'illustration'] },
      { item: 'subject', keywords: ['subject', 'main object', 'character'] },
      { item: 'style', keywords: ['style', 'tone', 'mood', 'realistic', 'cartoon', 'minimalist'] },
      { item: 'lighting', keywords: ['lighting', 'sunset', 'dramatic', 'moody'] },
      { item: 'composition', keywords: ['composition', 'wide', 'close-up', 'side view'] },
      { item: 'negative', keywords: ['avoid', 'exclude', 'negative'] },
      { item: 'tech', keywords: ['size', 'aspect', 'quality'] }
    ]
  },
  writing: {
    items: [
      { item: 'purpose', keywords: ['purpose', 'goal', '목적', '설득', '정보', '홍보'] },
      { item: 'audience', keywords: ['audience', 'target', '독자', '고객', '관리자', '팀', '학생'] },
      { item: 'tone', keywords: ['tone', 'voice', '격식', '친근', '전문적', '유머'] },
      { item: 'language', keywords: ['language', '언어', 'ko', 'en', '한국어', '영어'] },
      { item: 'length', keywords: ['length', '분량', '단락', '글자', '단어'] },
      { item: 'format', keywords: ['형식', '이메일', '에세이', '블로그', '보고서', '카피'] },
      { item: 'outline', keywords: ['outline', '구성', '목차', '섹션'] },
      { item: 'constraints', keywords: ['deadline', '마감', '플랫폼', '스타일 가이드'] },
      { item: 'sources', keywords: ['자료', '출처', '링크', '인용'] }
    ]
  },
  daily: {
    items: [
      { item: 'goal', keywords: ['목표', '해야 할 일', '할일', 'todo', 'purpose'] },
      { item: 'deadline', keywords: ['마감', '오늘', '내일', '이번주', 'date'] },
      { item: 'priority', keywords: ['중요도', '우선순위', 'P0', 'P1'] },
      { item: 'constraints', keywords: ['예산', '시간', '도구', '제약', 'budget', 'time'] },
      { item: 'deliverable', keywords: ['결과물', '산출물', '보고', '메시지', '요약'] },
      { item: 'stakeholders', keywords: ['수신자', '받는사람', '팀', '고객', '상사'] },
      { item: 'format', keywords: ['메모', '요약', '메시지', '이메일', '체크리스트'] }
    ]
  },
  // ✅ dev 도메인(웹앱)
  dev: {
    items: [
      { item: 'goal', keywords: ['goal', '목표', '서비스 목적', '가치제안'] },
      { item: 'target-users', keywords: ['user', '사용자', '타깃', '페르소나'] },
      { item: 'features', keywords: ['기능', 'MVP', '필수', '선택', '모듈'] },
      { item: 'frontend', keywords: ['frontend', 'react', 'next', 'vue', 'svelte', 'tailwind'] },
      { item: 'backend', keywords: ['backend', 'node', 'python', 'fastapi', 'nest', 'spring'] },
      { item: 'api', keywords: ['api', 'rest', 'graphql', 'websocket'] },
      { item: 'data', keywords: ['db', 'database', 'postgres', 'mysql', 'mongodb', 'schema'] },
      { item: 'auth', keywords: ['auth', '인증', '인가', 'oauth', 'jwt', 'session'] },
      { item: 'deployment', keywords: ['배포', 'hosting', 'vercel', 'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'ci/cd'] },
      { item: 'nfr', keywords: ['성능', '확장성', '가용성', '비용', '보안'] },
      { item: 'monitoring', keywords: ['로깅', '모니터링', '알림', 'observability'] },
      { item: 'testing', keywords: ['테스트', 'unit', 'e2e', 'coverage'] },
      { item: 'timeline', keywords: ['일정', '마일스톤', '스프린트', '마감'] },
      { item: 'constraints', keywords: ['제약', '예산', '시간', '리소스'] }
    ]
  }
};

// ========== sanitize ==========
function sanitizeGenerated(text, facts) {
  try {
    const base = (facts || '').toLowerCase();
    const lines = (text || '').split(/\r?\n/);
    const suspicious = [
      'vimeo', 'facebook', 'instagram reels', 'tiktok', 'prime video', 'netflix',
      'pulling a rabbit', 'rabbit from a hat', 'top hat',
      'midjourney', 'stable diffusion', 'dalle', 'runway', 'capcut'
    ];
    const cleaned = lines.map(line => {
      const low = line.toLowerCase();
      if (suspicious.some(w => low.includes(w)) && !base.includes(low)) {
        return line
          .replace(/vimeo/ig, 'online video platform')
          .replace(/instagram reels/ig, 'short-form platform')
          .replace(/tiktok/ig, 'short-form platform')
          .replace(/(pulling a rabbit|rabbit from a hat|top hat)/ig, 'a signature trick')
          .replace(/midjourney|stable diffusion|dalle|runway|capcut/ig, 'the chosen tool');
      }
      return line;
    });
    return cleaned.join('\n');
  } catch {
    return text || '';
  }
}

// ========== 공통 유틸 (프로젝트 기존 것 사용) ==========
function wrap(err, code = 'UNKNOWN') {
  const e = err instanceof Error ? err : new Error(String(err));
  e.code = code;
  return e;
}

// mentionExtractor, intentAnalyzer, evaluationSystem, getCoverageRatio, callOpenAI, callOpenAIWithSystem
// 는 기존 구현을 그대로 사용하세요.
