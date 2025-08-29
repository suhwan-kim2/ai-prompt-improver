// api/improve-prompt.js
// 한국어 강제 · 도메인 자동보정 · OpenAI 실패 폴백 · 항상 JSON 응답 · 중복질문 방지

export default async function handler(req, res) {
  try {
    const {
      step = 'start',
      userInput = '',
      answers = [],
      asked = [],
      domain: rawDomain = 'video',
      round = 1,
      mode = 'single',
      debug = false,
    } = (req.method === 'POST' ? req.body : req.query) || {};

    if (!userInput || typeof userInput !== 'string') {
      return res.status(400).json({ success: false, error: 'USER_INPUT_REQUIRED', message: 'userInput가 비어있습니다.' });
    }

    // 🔎 도메인 자동 보정(입력/답변에서 신호가 강하면 강제 전환)
    const domain = autoDetectDomain(userInput, answers, rawDomain);

    if (step === 'start') return await safeWrap(res, () => handleStart(res, userInput, domain, debug));
    if (step === 'questions') return await safeWrap(res, () => handleQuestions(res, userInput, Array.isArray(answers) ? answers : [], domain, Number(round) || 1, mode, asked, debug));
    if (step === 'generate') return await safeWrap(res, () => handleGenerate(res, userInput, Array.isArray(answers) ? answers : [], domain, asked, debug));

    return await safeWrap(res, () => handleStart(res, userInput, domain, debug));
  } catch (e) {
    const wrapped = wrap(e, 'UNHANDLED_API_ERROR');
    if (process.env.NODE_ENV !== 'production') console.error(wrapped);
    return res.status(500).json({ success: false, error: wrapped.code || 'UNKNOWN', message: String(wrapped.message || wrapped) });
  }
}

// 서버 핸들러 안전 래퍼: 항상 JSON으로 반환
async function safeWrap(res, fn) {
  try {
    return await fn();
  } catch (e) {
    const w = wrap(e, e.code || 'SERVER_ERROR');
    if (process.env.NODE_ENV !== 'production') console.error('[API ERROR]', w);
    return res.status(500).json({
      success: false,
      error: w.code,
      message: w.message || 'Internal Error',
      hint: '서버에서 예외가 발생했습니다. 잠시 후 다시 시도해주세요.'
    });
  }
}

// ========== 단계 핸들러들 ==========

async function handleStart(res, userInput, domain, debug) {
  const mentions = mentionExtractor.extract(userInput);
  let questions;
  try {
    questions = await generateAIQuestions(userInput, [], domain, mentions, 1, { draftPrompt: '', targetCount: 5, asked: [], debug });
  } catch (e) {
    // 🔁 OpenAI 실패 시 로컬 폴백 질문(한국어, 도메인별)
    questions = localFallbackQuestions(domain, 5);
  }

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
}

async function handleQuestions(res, userInput, answers, domain, round, mode, asked, debug) {
  const allText = [userInput, ...answers].join(' ');
  const mentions = mentionExtractor.extract(allText);
  const checklist = DOMAIN_CHECKLISTS[domain] || DOMAIN_CHECKLISTS.video;

  let draftPrompt = '';
  try {
    draftPrompt = await generateDraftPrompt(userInput, answers, domain, debug);
  } catch {
    // 조용히 무시 — 드래프트 없이도 진행 가능
  }

  const intentScore = intentAnalyzer.calculateIntentScore(userInput, answers, domain, checklist, mentions, draftPrompt);
  const coverage = getCoverageRatio(checklist, (allText + '\n' + draftPrompt).toLowerCase(), mentions);
  const coveragePct = Math.round(coverage * 100);

  // 충분 → 생성
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
  let nextQuestions = [];
  try {
    nextQuestions = await generateAIQuestions(userInput, answers, domain, mentions, round + 1, { draftPrompt, targetCount, asked, debug });
  } catch {
    nextQuestions = localFallbackQuestions(domain, Math.min(3, targetCount));
  }

  if (!nextQuestions || nextQuestions.length === 0) {
    // 라운드가 낮으면 조금 더 묻기
    if (round <= 1) {
      const fallback = localFallbackQuestions(domain, 2);
      if (fallback.length) {
        return res.status(200).json({
          success: true,
          step: 'questions',
          questions: fallback,
          round: round + 1,
          intentScore,
          coverage: coveragePct,
          draftPrompt,
          status: 'collecting',
          message: '핵심 정보 보강을 위해 추가 질문을 진행합니다.'
        });
      }
    }
    // 그래도 없으면 생성
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
      if (qualityScore.total > best.score) best = { text: generatedPrompt, score: qualityScore.total };

      if (qualityScore.total >= 95) {
        return res.status(200).json({
          success: true,
          step: 'completed',
          originalPrompt: userInput,
          improvedPrompt: generatedPrompt,
          intentScore: Math.max(80, qualityScore.intent || 80),
          qualityScore: qualityScore.total,
          attempts,
          status: 'done',
          message: `🎉 완성! AI가 ${attempts}번 만에 95점 품질 달성!`
        });
      }
    } catch (e) {
      // 검증 실패/모델 실패는 루프 계속
    }
  }

  // 품질 저조 → 보완 질문 회귀
  const mentions = mentionExtractor.extract([userInput, ...answers].join(' '));
  let followupQuestions = [];
  try {
    followupQuestions = await generateAIQuestions(userInput, answers, domain, mentions, 1, { draftPrompt: best.text || '', targetCount: 2, asked, debug });
  } catch {
    followupQuestions = localFallbackQuestions(domain, 2);
  }

  if (followupQuestions && followupQuestions.length > 0) {
    return res.status(200).json({
      success: true,
      step: 'questions',
      questions: followupQuestions,
      round: 1,
      intentScore: Math.max(60, best.score || 60),
      status: 'collecting',
      message: '출력이 불충분하여 꼭 필요한 정보만 이어서 질문합니다.'
    });
  }

  return res.status(200).json({
    success: true,
    step: 'completed',
    originalPrompt: userInput,
    improvedPrompt: (best.text || '프롬프트 생성이 원활하지 않았습니다. 목적/대상/스타일 등 핵심 정보를 조금만 더 구체적으로 입력해 주세요.'),
    intentScore: Math.max(60, best.score || 60),
    qualityScore: best.score >= 0 ? best.score : 40,
    attempts: maxAttempts,
    status: 'done',
    message: '핵심 정보가 부족해 완전한 결과를 만들지 못했습니다. 입력을 보강해 다시 시도해 주세요.'
  });
}

// ========== LLM 유틸 ==========

async function generateDraftPrompt(userInput, answers, domain, debug) {
  const allAnswers = [userInput, ...answers].join('\n');
  const map = {
    image: `Create an interim improved image prompt in Korean from the following facts.
Keep it concise but structured.

${allAnswers}

Return only the prompt text in Korean.`,
    writing: `Create a concise interim writing brief in Korean from the following facts.
Keep it structured with purpose, audience, tone, length, and outline.

${allAnswers}

Return only the brief text in Korean.`,
    daily: `Summarize the user's intent and produce a task-oriented brief in Korean from the following facts.
Include purpose, key constraints, and a short checklist.

${allAnswers}

Return only the brief text in Korean.`,
    dev: `Create a concise interim development brief in Korean from the following facts.
Include goal, scope, stack, deployment target, and constraints.

${allAnswers}

Return only the brief text in Korean.`,
    video: `Create an interim improved video prompt in Korean from the following facts.
Keep it concise but structured.

${allAnswers}

Return only the prompt text in Korean.`
  };
  const prompt = map[domain] || map.video;
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
    const keys = Array.isArray(item.keywords) ? item.keywords : [item.item, ...(item.keywords || [])];
    for (const k of keys) if (all.includes(String(k).toLowerCase())) answeredKW.add(String(k).toLowerCase());
  }
  // 사용자가 고른 값도 금지(중복 질문 방지)
  for (const ans of answers) {
    const parts = String(ans || '').split(':');
    if (parts.length >= 2) {
      const value = parts.slice(1).join(':').trim().toLowerCase();
      if (value) value.split(/\s+/).forEach(tok => answeredKW.add(tok));
    }
  }
  // 프론트에서 이미 보여준 질문(asked)도 금지
  asked.forEach(q => answeredKW.add((q || '').toLowerCase()));

  // 아직 부족한 항목
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
- For writing/daily/dev domains, you may use inputType 'text' with a short placeholder when options are too narrow.

Return JSON shape:
${baseSchema}`;

  // 🔐 OpenAI 실패 시 예외 → 상위 핸들러에서 폴백 사용
  const raw = await callOpenAI(prompt, 0.3, debug);
  let cleaned = (raw || '').trim().replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const first = cleaned.indexOf('{'), last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);

  const parsed = JSON.parse(cleaned);
  let qs = Array.isArray(parsed?.questions) ? parsed.questions : [];

  // 금지세트 기반 필터(중복 제거)
  const ban = new Set(Array.from(answeredKW).filter(Boolean));
  qs = qs.filter(q => {
    const bucket = [q?.question || '', ...(q?.options || [])].join(' ').toLowerCase();
    for (const k of ban) if (bucket.includes(k)) return false;
    return true;
  });

  // 동일 질문 텍스트 중복 제거
  const seen = new Set();
  qs = qs.filter(q => {
    const key = (q?.question || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (qs.length > targetCount) qs = qs.slice(0, targetCount);
  return qs;
}

async function generateAIPrompt(userInput, answers, domain, debug) {
  const allAnswers = [userInput, ...answers].join('\n');

  const domainPrompts = {
    video: `한국어로만 작성하세요. 아래 정보만 사용해 영상 프롬프트를 만드세요.

${allAnswers}

요구사항:
- 장면별 타임라인
- 주제/대상/플랫폼 적합성
- 촬영/카메라/편집 지시
- 음악/SFX/자막 가이드
- 기술 사양(해상도, 코덱, 프레임레이트)
- 길이 목표
- STRICT: 사용자 입력/답변에 있는 정보만 사용. 지어내지 말 것.
- 누락 시 [TBD: 항목] 표기(최종 노출은 서버에서 판단).`,
    image: `한국어로만 작성하세요. 아래 정보만 사용해 이미지 프롬프트를 만드세요.

${allAnswers}

요구사항:
- 목적/용도
- 주제(메인 대상)와 구도
- 스타일/무드, 조명
- 배경/세부 요소
- 네거티브(제외할 것)
- 기술 사양(크기/비율/품질)
- STRICT: 지어내지 말 것. 누락 시 [TBD: 항목]`,
    writing: `한국어로만 작성하세요. 아래 정보만 사용해 글쓰기 브리프를 만드세요.

${allAnswers}

산출물:
- 목적, 독자, 톤, 언어
- 목표 분량(글자/단어)
- 구조/아웃라인(불릿)
- 포함/제외할 핵심 포인트
- 제약(마감, 플랫폼, 스타일 가이드)
- STRICT: 지어내지 말 것. 누락 시 [TBD: 항목]`,
    daily: `한국어로만 작성하세요. 아래 정보만 사용해 실행 브리프를 만드세요.

${allAnswers}

산출물:
- 목적과 성공 기준
- 우선순위 체크리스트(3–7)
- 제약(시간/예산/도구)
- 필요 시 커뮤니케이션 템플릿
- STRICT: 지어내지 말 것. 누락 시 [TBD: 항목]`,
    dev: `한국어로만 작성하세요. 아래 정보만 사용해 개발 브리프를 만드세요.

${allAnswers}

산출물:
- 목표/범위, 주요 기능
- 기술 스택(프론트/백/DB)
- 배포 대상/환경
- 제약(성능/보안/예산/마감)
- 기본 페이지/엔드포인트 구조(불릿)
- STRICT: 지어내지 말 것. 누락 시 [TBD: 항목]`
  };

  const sys = `반드시 한국어로만 작성. 제공된 사실만 사용. 지어내지 말 것.`;
  const prompt = domainPrompts[domain] || domainPrompts.video;
  const raw = await callOpenAIWithSystem(sys, prompt, 0.2, debug);
  const generated = (raw || '').trim();

  // ✅ 최종 검증 — 빈/영어/섹션 누락/지어내기 징후
  const v = validateGenerated(generated, allAnswers, domain);
  if (!v.ok) {
    const err = new Error(`GENERATION_VALIDATION_FAILED: ${v.reason}`);
    err.code = 'GENERATION_VALIDATION_FAILED';
    throw err;
  }
  return sanitizeMinor(generated, allAnswers);
}

// ========== 체크리스트(도메인별) ==========

const DOMAIN_CHECKLISTS = {
  video: { items: [
    { item: 'goal', keywords: ['goal', 'objective', 'kpi', 'conversion', 'awareness', '엔터테인', '교육'] },
    { item: 'audience', keywords: ['audience', 'target', 'demographic', '성인', '가족', '아동', '모든 연령'] },
    { item: 'platform', keywords: ['youtube', '유튜브', 'tiktok', 'instagram', 'reels', 'shorts'] },
    { item: 'length', keywords: ['length', 'duration', '분', '초', '1-3 minutes'] },
    { item: 'style', keywords: ['style', 'tone', 'mood', '드라마', '코미디', '톤', '무드'] },
    { item: 'camera', keywords: ['촬영', '카메라', '클로즈업', '와이드', '쇼트'] },
    { item: 'audio', keywords: ['배경 음악', '효과음', '음악', '자막', '보이스오버'] },
    { item: 'subject', keywords: ['강아지', '시바견', '인물', '제품', '사람'] },
    { item: 'tech', keywords: ['해상도', '코덱', '프레임', '비율'] },
  ]},
  image: { items: [
    { item: 'purpose', keywords: ['목적', '용도', '포스터', '로고', '썸네일'] },
    { item: 'subject', keywords: ['주제', '대상', '캐릭터', '인물', '사물'] },
    { item: 'composition', keywords: ['구도', '정면', '측면', '상반신', '전신'] },
    { item: 'style', keywords: ['스타일', '무드', '픽셀', '레트로', '리얼', '미니멀'] },
    { item: 'lighting', keywords: ['조명', '노을', '드라마틱', '어둡', '밝'] },
    { item: 'background', keywords: ['배경', '도심', '자연', '실내', '폐허'] },
    { item: 'negative', keywords: ['제외', '네거티브'] },
    { item: 'tech', keywords: ['크기', '비율', '품질', 'dpi', '2000x2000'] },
  ]},
  writing: { items: [
    { item: 'purpose', keywords: ['목적', '설득', '정보', '홍보'] },
    { item: 'audience', keywords: ['독자', '타깃', '고객', '팀'] },
    { item: 'tone', keywords: ['톤', '문체', '격식', '친근', '전문'] },
    { item: 'language', keywords: ['언어', '한국어', '영어'] },
    { item: 'length', keywords: ['분량', '단어', '글자', '단락'] },
    { item: 'format', keywords: ['형식', '이메일', '블로그', '보고서'] },
    { item: 'outline', keywords: ['구성', '아웃라인', '목차'] },
    { item: 'constraints', keywords: ['마감', '플랫폼', '가이드'] },
  ]},
  daily: { items: [
    { item: 'goal', keywords: ['목표', '할일', 'todo'] },
    { item: 'deadline', keywords: ['마감', '오늘', '내일', '이번주'] },
    { item: 'priority', keywords: ['중요도', '우선순위'] },
    { item: 'constraints', keywords: ['예산', '시간', '도구', '제약'] },
    { item: 'deliverable', keywords: ['산출물', '요약', '메시지'] },
  ]},
  dev: { items: [
    { item: 'goal', keywords: ['목표', '요구사항', '기능'] },
    { item: 'stack', keywords: ['스택', '프론트', '백엔드', 'DB', '언어'] },
    { item: 'deployment', keywords: ['배포', '도메인', 'SSL', 'CDN'] },
    { item: 'constraints', keywords: ['마감', '예산', '성능', '보안'] },
    { item: 'pages', keywords: ['페이지', '라우팅', '엔드포인트'] },
  ]},
};

// ========== 검증/정규화/폴백/도메인 자동보정 ==========

function validateGenerated(text, facts, domain = 'image') {
  const out = (text || '').trim();
  if (!out) return { ok: false, reason: 'empty' };

  const hangul = (out.match(/[가-힣]/g) || []).length;
  const total  = out.replace(/\s+/g, '').length || 1;
  if (hangul / total < 0.2) return { ok: false, reason: 'not_korean' };

  if (out.length < 80) return { ok: false, reason: 'too_short' };

  const need = domain === 'image'
    ? [/목적|용도/i, /주제|대상/i, /구도|구성/i, /스타일|무드/i, /조명/i]
    : domain === 'video'
    ? [/목적|대상|플랫폼/i, /타임라인|장면|씬/i, /촬영|카메라|편집/i, /음악|효과음|자막|BGM/i]
    : domain === 'writing'
    ? [/목적|독자/i, /톤|문체/i, /분량|길이/i, /구성|아웃라인/i]
    : domain === 'daily'
    ? [/목적|성공/i, /체크리스트|우선순위/i]
    : [/목표|스택|배포|제약|페이지/i];

  if (!need.every(re => re.test(out))) return { ok: false, reason: 'missing_sections' };

  const base = (facts || '').toLowerCase();
  const suspicious = ['vimeo','instagram reels','tiktok','netflix','prime video','midjourney','stable diffusion','dalle','runway','capcut'];
  for (const s of suspicious) {
    if (out.toLowerCase().includes(s) && !base.includes(s)) return { ok: false, reason: 'hallucination_like' };
  }
  return { ok: true };
}

function sanitizeMinor(text, facts) {
  try {
    const base = (facts || '').toLowerCase();
    const map = [
      { re: /vimeo/ig, to: '온라인 동영상 플랫폼' },
      { re: /instagram reels/ig, to: '쇼트폼 플랫폼' },
      { re: /tiktok/ig, to: '쇼트폼 플랫폼' },
      { re: /midjourney|stable diffusion|dalle|runway|capcut/ig, to: '지정된 도구' }
    ];
    let out = text;
    for (const m of map) {
      if (m.re.test(out) && !base.includes(String(m.to).toLowerCase())) {
        out = out.replace(m.re, m.to);
      }
    }
    return out;
  } catch { return text || ''; }
}

function localFallbackQuestions(domain, n = 3) {
  // OpenAI 실패 시 즉석으로 뽑는 한국어 체크리스트 질문
  const pick = (arr) => arr.slice(0, n).map((q, i) => ({ key: `fb_${i}`, priority: 'medium', inputType: 'options', ...q }));
  const commonOther = ['직접 입력'];

  if (domain === 'image') {
    return pick([
      { question: '이미지의 주된 목적/용도는 무엇인가요?', options: ['유튜브 썸네일', 'SNS 게시물', '웹 배너', '인쇄물', ...commonOther] },
      { question: '주요 대상(주제)은 무엇인가요?', options: ['캐릭터', '인물', '사물', '배경 중심', ...commonOther] },
      { question: '원하는 구도는 무엇인가요?', options: ['정면', '측면', '상반신', '전신', '탑뷰', ...commonOther] },
      { question: '스타일/무드는 무엇에 가깝나요?', options: ['리얼', '픽셀', '레트로', '미니멀', '다크', ...commonOther] },
      { question: '크기/비율/품질은 어떻게 할까요?', options: ['정사각형', '16:9', '4:5', '2000x2000', ...commonOther] },
    ]);
  }
  if (domain === 'video') {
    return pick([
      { question: '영상의 목적은 무엇인가요?', options: ['오락', '정보전달', '교육', ...commonOther] },
      { question: '주 대상은 누구인가요?', options: ['모든 연령', '가족', '성인', '아동', ...commonOther] },
      { question: '게시 플랫폼은 어디인가요?', options: ['유튜브', '틱톡', '인스타', ...commonOther] },
      { question: '예상 길이는?', options: ['15초', '30초', '1-3분', '3-5분', ...commonOther] },
    ]);
  }
  if (domain === 'writing') {
    return pick([
      { question: '글의 목적은 무엇인가요?', options: ['설득', '정보', '홍보', ...commonOther] },
      { question: '독자/타깃은 누구인가요?', options: ['내부 팀', '고객', '대중', ...commonOther] },
      { question: '톤/문체는?', options: ['전문적', '친근', '캐주얼', ...commonOther] },
    ]);
  }
  if (domain === 'daily') {
    return pick([
      { question: '이번 작업의 핵심 목표는 무엇인가요?', options: ['보고서', '정리/요약', '연락/공지', ...commonOther] },
      { question: '마감/기한은?', options: ['오늘', '내일', '이번주', ...commonOther] },
    ]);
  }
  if (domain === 'dev') {
    return pick([
      { question: '어떤 종류의 웹앱/서비스인가요?', options: ['쇼핑몰', '블로그', '대시보드', 'API 백엔드', ...commonOther] },
      { question: '주요 기능/범위를 알려주세요.', options: ['회원/로그인', '결제', '게시글', '통계', ...commonOther] },
      { question: '배포 환경은 어떻게 할까요?', options: ['Vercel', 'Netlify', 'Docker', '온프리미스', ...commonOther] },
    ]);
  }
  return [];
}

function autoDetectDomain(userInput, answers, current) {
  const text = [userInput, ...(answers || [])].join(' ').toLowerCase();
  const isImage = /(이미지|사진|일러스트|썸네일|로고|포스터|픽셀|픽셀아트)/.test(text);
  const isVideo = /(영상|비디오|유튜브|촬영|편집|씬|장면)/.test(text);
  const isWriting = /(글|에세이|복사|카피|문장|기사|요약|브리프)/.test(text);
  const isDaily = /(체크리스트|할일|todo|메모|요약|정리)/.test(text);
  const isDev = /(웹앱|서비스|배포|도커|API|프론트|백엔드|DB|스택)/.test(text);

  if (isImage && !isVideo) return 'image';
  if (isVideo && !isImage) return 'video';
  if (isWriting) return 'writing';
  if (isDaily) return 'daily';
  if (isDev) return 'dev';
  return current;
}

function wrap(err, code = 'UNKNOWN') {
  const e = err instanceof Error ? err : new Error(String(err));
  e.code = code;
  return e;
}
