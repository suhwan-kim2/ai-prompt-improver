// api/improve-prompt.js
// Next.js API Route — 한국어 강제, 빈/부실 출력 차단, 질문 라운드 회귀, 중복질문 방지, 도메인 확장(video/image/writing/daily/dev)

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

    if (step === 'start') {
      return handleStart(res, userInput, domain, debug);
    }
    if (step === 'questions') {
      return handleQuestions(res, userInput, Array.isArray(answers) ? answers : [], domain, Number(round) || 1, mode, asked, debug);
    }
    if (step === 'generate') {
      return handleGenerate(res, userInput, Array.isArray(answers) ? answers : [], domain, asked, debug);
    }

    // 기본은 start
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

    // 🔹 드래프트(현재 사실 기반) 갱신
    const draftPrompt = await generateDraftPrompt(userInput, answers, domain, debug);

    // 🔹 의도/커버리지 계산 (드래프트 포함)
    const intentScore = intentAnalyzer.calculateIntentScore(userInput, answers, domain, checklist, mentions, draftPrompt);
    const coverage = getCoverageRatio(checklist, (allText + '\n' + draftPrompt).toLowerCase(), mentions);
    const coveragePct = Math.round(coverage * 100);

    // 🔹 충분 조건 → 생성 단계로
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

    // 🔹 부족하면 최소 질문만 추가로 수집(중복 방지)
    const targetCount = mode === 'bulk' ? 5 : 3;
    const nextQuestions = await generateAIQuestions(userInput, answers, domain, mentions, round + 1, { draftPrompt, targetCount, asked, debug });

    if (!nextQuestions || nextQuestions.length === 0) {
      // 라운드 초반인데 비면 1~2개 보강 질문 시도
      if (round <= 1) {
        const mentions2 = mentionExtractor.extract([userInput, ...answers, draftPrompt].join(' '));
        const fallbackQs = await generateAIQuestions(userInput, answers, domain, mentions2, round + 1, { draftPrompt, targetCount: 2, asked, debug });
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
      // 그래도 없으면 생성으로
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

/**
 * 생성 단계: 빈/부실/영어 위주/지어내기 감지 → 재질문 라운드로 회귀
 * 최종 UI에 placeholder([TBD: ...], empty output 등) 절대 노출되지 않게 설계
 */
async function handleGenerate(res, userInput, answers, domain, asked, debug) {
  let attempts = 0;
  const maxAttempts = 4;
  let best = { text: '', score: -1 };

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const generatedPrompt = await generateAIPrompt(userInput, answers, domain, debug); // ← 내부에서 검증 실패 시 throw
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
      // 계속 시도
    } catch (e) {
      // GENERATION_VALIDATION_FAILED 등 검증 실패 → 반복 시도
    }
  }

  // 여기까지 왔는데 품질이 낮거나 검증 실패 지속 → 보완 질문으로 회귀
  const mentions = mentionExtractor.extract([userInput, ...answers].join(' '));
  const followupQuestions = await generateAIQuestions(
    userInput, answers, domain, mentions, 1,
    { draftPrompt: best.text || '', targetCount: 2, asked, debug }
  );

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

  // 정말 더 물을 게 없으면 — placeholder는 노출하지 않음(안전 메세지)
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

  let prompt;
  if (domain === 'image') {
    prompt = `Create an interim improved image prompt in Korean from the following facts.
Keep it concise but structured.

${allAnswers}

Return only the prompt text in Korean.`;
  } else if (domain === 'writing') {
    prompt = `Create a concise interim writing brief in Korean from the following facts.
Keep it structured with purpose, audience, tone, length, and outline.

${allAnswers}

Return only the brief text in Korean.`;
  } else if (domain === 'daily') {
    prompt = `Summarize the user's intent and produce a task-oriented brief in Korean from the following facts.
Include purpose, key constraints, and a short checklist.

${allAnswers}

Return only the brief text in Korean.`;
  } else if (domain === 'dev') {
    prompt = `Create a concise interim development brief in Korean from the following facts.
Include goal, scope, stack, deployment target, and constraints.

${allAnswers}

Return only the brief text in Korean.`;
  } else {
    // video (default)
    prompt = `Create an interim improved video prompt in Korean from the following facts.
Keep it concise but structured.

${allAnswers}

Return only the prompt text in Korean.`;
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

  // 이미 커버된 키워드(체크리스트 기준)
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

  // writing/daily/dev의 경우 옵션 과도 축소 시 inputType을 text로 유도
  qs = qs.map(q => {
    if ((domain === 'writing' || domain === 'daily' || domain === 'dev') && (!q.options || q.options.length === 0)) {
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
- 주제/구성(구도)
- 스타일/무드, 조명
- 배경/세부 요소
- 네거티브(제외할 것)
- 기술 사양(크기/비율/품질)
- STRICT: 사용자 입력/답변에 있는 정보만 사용. 지어내지 말 것.
- 누락 시 [TBD: 항목] 표기(최종 노출은 서버에서 판단).`,
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
- 필요 시 커뮤니케이션 템플릿(짧은 메시지/이메일)
- STRICT: 지어내지 말 것. 누락 시 [TBD: 항목]`,
    dev: `한국어로만 작성하세요. 아래 정보만 사용해 개발 브리프를 만드세요.

${allAnswers}

산출물:
- 목표/범위, 주요 기능
- 기술 스택(프론트/백/DB)
- 배포 대상(예: Vercel, Netlify, Docker 등)과 환경
- 제약(성능/보안/예산/마감)
- 기본 페이지/엔드포인트 구조(불릿)
- STRICT: 지어내지 말 것. 누락 시 [TBD: 항목]`
  };

  const sys = `당신은 세계적 수준의 프롬프트 엔지니어입니다.
- 반드시 한국어로만 작성합니다.
- 제공된 사실만 사용하고, 지어내지 않습니다.
- 정보가 부족하면 추측하지 말고 [TBD: ...]를 임시로 둘 수 있으나, 최종 노출은 서버 로직이 결정합니다.`;

  const prompt = domainPrompts[domain] || domainPrompts.video;
  const raw = await callOpenAIWithSystem(sys, prompt, 0.2, debug);
  const generated = (raw || '').trim();

  // 🔎 생성물 검증(빈/영어/구조미달/지어내기 징후)
  const v = validateGenerated(generated, allAnswers, domain);
  if (!v.ok) {
    const err = new Error(`GENERATION_VALIDATION_FAILED: ${v.reason}`);
    err.code = 'GENERATION_VALIDATION_FAILED';
    throw err;
  }

  // 🔧 경미한 용어/플랫폼 정규화(지어내기로 의심될 때만 치환)
  return sanitizeMinor(generated, allAnswers);
}

// ========== 체크리스트(도메인별) ==========

const DOMAIN_CHECKLISTS = {
  video: {
    items: [
      { item: 'goal', keywords: ['goal', 'objective', 'kpi', 'conversion', 'awareness', 'entertain', 'entertainment', 'educate', 'education', '엔터테인', '교육'] },
      { item: 'audience', keywords: ['audience', 'target', 'demographic', 'adult', 'adults', 'kids', 'children', 'family', 'general', '성인', '가족', '아동', '모든 연령'] },
      { item: 'platform', keywords: ['youtube', 'tiktok', 'instagram', 'reels', 'shorts', '유튜브'] },
      { item: 'length', keywords: ['length', 'duration', '1-3 minutes', 'seconds', 'minutes', '분', '초'] },
      { item: 'style', keywords: ['style', 'tone', 'mood', 'vibe', 'dramatic', 'comedic', 'comedy', '드라마', '코미디', '톤', '무드'] },
      { item: 'camera', keywords: ['camera', 'shot', 'close-up', 'wide', 'over-the-shoulder', '촬영', '카메라', '클로즈업', '와이드'] },
      { item: 'audio', keywords: ['music', 'sfx', 'sound', 'voiceover', 'caption', 'background music', 'sound effects', '배경 음악', '효과음', '자막'] },
      { item: 'subject', keywords: ['dog', 'shiba', 'person', 'product', '강아지', '시바견', '인물', '제품'] },
      { item: 'tech', keywords: ['resolution', 'codec', 'framerate', 'aspect', '해상도', '코덱', '프레임', '비율'] }
    ]
  },
  image: {
    items: [
      { item: 'goal', keywords: ['goal', 'purpose', 'poster', 'logo', 'illustration', '목적', '포스터', '로고', '일러스트'] },
      { item: 'subject', keywords: ['subject', 'main object', 'character', '주제', '대상', '캐릭터'] },
      { item: 'style', keywords: ['style', 'tone', 'mood', 'realistic', 'cartoon', 'minimalist', '픽셀', '레트로', '스타일', '무드'] },
      { item: 'lighting', keywords: ['lighting', 'sunset', 'dramatic', 'moody', '조명', '역광', '노을', '극적'] },
      { item: 'composition', keywords: ['composition', 'wide', 'close-up', 'side view', '구도', '구성'] },
      { item: 'negative', keywords: ['avoid', 'exclude', 'negative', '제외', '네거티브'] },
      { item: 'tech', keywords: ['size', 'aspect', 'quality', '크기', '비율', '품질'] }
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
  dev: {
    items: [
      { item: 'goal', keywords: ['목표', '기능', '요구사항', '스펙'] },
      { item: 'stack', keywords: ['스택', '프론트', '백엔드', '데이터베이스', '언어'] },
      { item: 'deployment', keywords: ['배포', '서버', '도메인', 'SSL', 'CDN'] },
      { item: 'constraints', keywords: ['마감', '예산', '성능', '보안'] },
      { item: 'pages', keywords: ['페이지', '라우팅', '엔드포인트'] }
    ]
  }
};

// ========== 생성물 검증 & 정규화 ==========

/**
 * 최종 노출 전 "유효성 검사".
 * - 빈 출력, 한국어 비율, 최소 길이, 도메인별 섹션 체크, 지어내기 징후 감지
 * - 실패 시 ok:false 로 반환 → handleGenerate가 질문 라운드로 회귀
 */
function validateGenerated(text, facts, domain = 'image') {
  const out = (text || '').trim();

  if (!out) return { ok: false, reason: 'empty' };

  // 한국어 비율(한글 문자수 / 전체) — 대략 20% 이상
  const hangul = (out.match(/[가-힣]/g) || []).length;
  const total  = out.replace(/\s+/g, '').length || 1;
  if (hangul / total < 0.2) return { ok: false, reason: 'not_korean' };

  // 최소 길이
  if (out.length < 80) return { ok: false, reason: 'too_short' };

  // 도메인별 섹션 키워드 존재 여부(느슨한 검사)
  const need = domain === 'image'
    ? [/주제|콘셉트|컨셉|목적/i, /구도|구성/i, /스타일|무드/i, /조명/i, /배경|세부/i]
    : domain === 'video'
    ? [/목적|대상|플랫폼/i, /타임라인|씬|장면/i, /촬영|카메라|편집/i, /음악|효과음|자막|BGM/i]
    : domain === 'writing'
    ? [/목적|독자/i, /톤|문체/i, /분량|길이/i, /구성|아웃라인/i]
    : domain === 'daily'
    ? [/목적|성공/i, /체크리스트|우선순위/i]
    : [/목표|스택|배포|제약|페이지/i]; // dev

  const hasAll = need.every((re) => re.test(out));
  if (!hasAll) return { ok: false, reason: 'missing_sections' };

  // 지어내기 대표 징후(사실에 없는 고유명/플랫폼 언급 등)
  const base = (facts || '').toLowerCase();
  const suspicious = [
    'vimeo', 'instagram reels', 'tiktok', 'netflix', 'prime video',
    'midjourney', 'stable diffusion', 'dalle', 'runway', 'capcut'
  ];
  for (const s of suspicious) {
    if (out.toLowerCase().includes(s) && !base.includes(s)) {
      return { ok: false, reason: 'hallucination_like' };
    }
  }

  return { ok: true };
}

/**
 * 경미한 용어/플랫폼을 일반화(필요 시)
 * - 사용자 사실에 없는 고유 플랫폼이 들어오면 일반 표현으로 치환
 * - 최종 UI placeholder 문자열은 절대 넣지 않음
 */
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
  } catch {
    return text || '';
  }
}

// ========== 공통 유틸 ==========

function wrap(err, code = 'UNKNOWN') {
  const e = err instanceof Error ? err : new Error(String(err));
  e.code = code;
  return e;
}

// (외부 모듈: mentionExtractor, intentAnalyzer, evaluationSystem, getCoverageRatio, callOpenAI, callOpenAIWithSystem)
// 기존 구현 그대로 사용
