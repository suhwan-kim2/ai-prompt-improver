// api/improve-prompt.js
// Next.js API Route — video/image + writing/daily 확장, 한국어 질문/중복 방지/드래프트 진행/지어내기 금지 강화

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

    if (step === 'start') return handleStart(res, userInput, domain, debug);
    if (step === 'questions') return handleQuestions(res, userInput, Array.isArray(answers) ? answers : [], domain, Number(round) || 1, mode, asked, debug);
    if (step === 'generate') return handleGenerate(res, userInput, Array.isArray(answers) ? answers : [], domain, debug);

    return handleStart(res, userInput, domain, debug);
  } catch (e) {
    const wrapped = wrap(e, 'UNHANDLED_API_ERROR');
    if (process.env.NODE_ENV !== 'production') console.error(wrapped);
    return res.status(500).json({ success: false, error: wrapped.code || 'UNKNOWN', detail: String(wrapped.message || wrapped) });
  }
}

// ========== 단계 핸들러들 ==========

async function handleStart(res, userInput, domain, debug) {
  try {
    const mentions = mentionExtractor.extract(userInput);
    const questions = await generateAIQuestions(userInput, [], domain, mentions, 1, { draftPrompt: '', targetCount: 5, asked: [], debug });
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
    throw wrap(e, 'AI_QUESTION_GENERATION_FAILED');
  }
}

async function handleQuestions(res, userInput, answers, domain, round, mode, asked, debug) {
  try {
    const allText = [userInput, ...answers].join(' ');
    const mentions = mentionExtractor.extract(allText);
    const checklist = DOMAIN_CHECKLISTS[domain] || DOMAIN_CHECKLISTS.video;

    const draftPrompt = await generateDraftPrompt(userInput, answers, domain, debug);

    const intentScore = intentAnalyzer.calculateIntentScore(userInput, answers, domain, checklist, mentions, draftPrompt);
    const coverage = getCoverageRatio(checklist, (allText + '\n' + draftPrompt).toLowerCase(), mentions);
    const coveragePct = Math.round(coverage * 100);

    // 충분 조건
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
    const nextQuestions = await generateAIQuestions(userInput, answers, domain, mentions, round + 1, { draftPrompt, targetCount, asked, debug });

    // ⛔ round 1에서 질문이 비면 최소 1~2개 더 묻기 (조기 generate 방지)
    if (!nextQuestions || nextQuestions.length === 0) {
      if (round <= 1) {
        const mentions2 = mentionExtractor.extract([userInput, ...answers, draftPrompt].join(' '));
        const fallbackQs = await generateAIQuestions(
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
    throw wrap(e, 'INTENT_ANALYSIS_FAILED');
  }
}

async function handleGenerate(res, userInput, answers, domain, debug) {
  let attempts = 0;
  const maxAttempts = 4;
  let best = { text: '', score: -1 };

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const generatedPrompt = await generateAIPrompt(userInput, answers, domain, debug);
      const qualityScore = evaluationSystem.evaluatePromptQuality(generatedPrompt, domain);
      if (qualityScore.total > best.score) best = { text: generatedPrompt, score: qualityScore.total };

      if (qualityScore.total >= 95) {
        return res.status(200).json({
          success: true,
          step: 'completed',
          originalPrompt: userInput,
          improvedPrompt: generatedPrompt,
          intentScore: 95,
          qualityScore: qualityScore.total,
          attempts,
          status: 'done',
          message: `🎉 완성! AI가 ${attempts}번 만에 95점 품질 달성!`
        });
      } else if (attempts >= maxAttempts && best.text) {
        return res.status(200).json({
          success: true,
          step: 'completed',
          originalPrompt: userInput,
          improvedPrompt: best.text,
          intentScore: 95,
          qualityScore: best.score,
          attempts,
          status: 'done',
          message: `최대 시도 도달. 현재 최고 품질 ${best.score}점으로 완료합니다.`
        });
      }
    } catch (e) {
      if (attempts >= maxAttempts && best.text) {
        return res.status(200).json({
          success: true,
          step: 'completed',
          originalPrompt: userInput,
          improvedPrompt: best.text,
          intentScore: 95,
          qualityScore: best.score,
          attempts,
          status: 'done',
          message: `생성 반복 실패. 현재 최고 품질 ${best.score}점으로 완료합니다.`
        });
      }
    }
  }
}

// ========== LLM 유틸 ==========

async function generateDraftPrompt(userInput, answers, domain, debug) {
  const allAnswers = [userInput, ...answers].join('\n');

  let prompt;
  if (domain === 'image') {
    prompt = `Create an interim improved image prompt in English from the following facts.
Keep it concise but structured.

${allAnswers}

Return only the prompt text.`;
  } else if (domain === 'writing') {
    // ✍️ 글쓰기용 임시 드래프트
    prompt = `Create a concise interim writing brief in English from the following facts.
Keep it structured with purpose, audience, tone, length, and outline.

${allAnswers}

Return only the brief text.`;
  } else if (domain === 'daily') {
    // 🗒️ 일상/범용 임시 드래프트
    prompt = `Summarize the user's intent and produce a task-oriented brief in English from the following facts.
Include purpose, key constraints, and a short checklist.

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

async function generateAIQuestions(userInput, answers, domain, mentions, round, opts = {}) {
  const { draftPrompt = '', targetCount = 3, asked = [], debug = false } = opts;
  const checklist = DOMAIN_CHECKLISTS[domain] || DOMAIN_CHECKLISTS.video;
  const all = [userInput, ...answers, draftPrompt].join(' ').toLowerCase();
  const answeredKW = new Set();
  const safeMentions = Array.from(new Set([...(mentions || [])].map(String))).slice(0, 30).join(', ');

  // 이미 커버된 키워드
  for (const item of checklist.items) {
    if (!item) continue;
    const keys = Array.isArray(item.keywords) ? item.keywords : [item.item, ...(item.keywords || [])];
    for (const k of keys) if (all.includes(String(k).toLowerCase())) answeredKW.add(String(k).toLowerCase());
  }
  // 사용자가 고른 값도 금지 세트에 추가 (중복질문 방지)
  for (const ans of answers) {
    if (!ans) continue;
    const parts = String(ans).split(':');
    if (parts.length >= 2) {
      const value = parts.slice(1).join(':').trim().toLowerCase();
      if (value) value.split(/\s+/).forEach(tok => answeredKW.add(tok));
    }
  }
  // 프론트에서 이미 보여준 질문(asked)도 금지
  asked.forEach(q => answeredKW.add(q.toLowerCase()));

  // 아직 부족한 항목 추출
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
- Do NOT propose brand/platform names or very specific examples unless already present in user input/answers/draft.
- Prefer category-style options (예: '플랫폼', '길이 범위', '톤/무드', '언어', '형식', '마감일').
- For writing/daily domains, you may use inputType 'text' with a short placeholder when options are too narrow.

Return JSON shape:
${baseSchema}`;

  const raw = await callOpenAI(prompt, 0.3, debug);
  let cleaned = (raw || '').trim().replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const first = cleaned.indexOf('{'), last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);

  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { return []; }
  let qs = Array.isArray(parsed?.questions) ? parsed.questions : [];

  // 금지세트 기반 필터 (중복 제거)
  const ban = new Set(Array.from(answeredKW).filter(Boolean));
  qs = qs.filter(q => {
    const bucket = [q?.question || '', ...(q?.options || [])].join(' ').toLowerCase();
    for (const k of ban) if (bucket.includes(k)) return false;
    return true;
  });

  // 동일 질문 텍스트 제거
  const seen = new Set();
  qs = qs.filter(q => {
    const key = (q?.question || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // writing/daily의 경우 옵션 과도 축소 시 inputType을 text로 유도
  qs = qs.map(q => {
    if ((domain === 'writing' || domain === 'daily') && (!q.options || q.options.length === 0)) {
      return {
        ...q,
        inputType: 'text',
        placeholder: q.placeholder || '간단히 입력해주세요'
      };
    }
    return q;
  });

  if (qs.length > targetCount) qs = qs.slice(0, targetCount);
  return qs;
}

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
  // ✍️ 글쓰기 도메인
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
  // 🗒️ 일상/범용 도메인
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

// ========== 공통 유틸(예: callOpenAI...) ==========
function wrap(err, code = 'UNKNOWN') {
  const e = err instanceof Error ? err : new Error(String(err));
  e.code = code;
  return e;
}

// 나머지: mentionExtractor, intentAnalyzer, evaluationSystem, getCoverageRatio, callOpenAI, callOpenAIWithSystem
// (기존 코드 그대로 사용)
