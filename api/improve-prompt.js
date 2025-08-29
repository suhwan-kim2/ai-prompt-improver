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

    // ✅ 라운드 1에서는 더 엄격한 기준 적용
    if (round === 1) {
      // 라운드 1에서는 최소 50% 이상 커버리지 필요
      if (coverage < 0.5) {
        const targetCount = mode === 'bulk' ? 5 : 3;
        const nextQuestions = await generateAIQuestions(userInput, answers, domain, mentions, round + 1, { draftPrompt, targetCount, asked, debug });
        
        return res.status(200).json({
          success: true,
          step: 'questions',
          questions: nextQuestions.length > 0 ? nextQuestions : await generateFallbackQuestions(domain),
          round: round + 1,
          intentScore,
          coverage: coveragePct,
          draftPrompt,
          ui: { language: 'ko', allowMulti: true, includeOther: true },
          progress: { intentScore, coverage: coveragePct },
          message: `기본 정보 수집 중입니다. (coverage ${coveragePct}%)`
        });
      }
    }

    // 일반 조건: 커버리지/라운드/점수 중 하나라도 통과하면 generate로 진행
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
      // ⭐ 라운드 2 이하에서는 fallback 질문 제공
      if (round <= 2) {
        const fallbackQuestions = await generateFallbackQuestions(domain);
        return res.status(200).json({
          success: true,
          step: 'questions',
          questions: fallbackQuestions,
          round: round + 1,
          intentScore,
          coverage: coveragePct,
          draftPrompt,
          ui: { language: 'ko', allowMulti: true, includeOther: true },
          progress: { intentScore, coverage: coveragePct },
          message: '핵심 정보 보강을 위해 추가 질문을 진행합니다.'
        });
      }
      
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

// api/improve-prompt.js의 handleGenerate 함수 수정
async function handleGenerate(res, userInput, answers, domain, asked, debug) {
  let attempts = 0;
  const maxAttempts = 4;
  let best = { text: '', score: -1 };
  
  // ⭐ 실제 의도 점수 계산 (95 하드코딩 제거)
  const mentions = mentionExtractor.extract([userInput, ...answers].join(' '));
  const checklist = DOMAIN_CHECKLISTS[domain] || DOMAIN_CHECKLISTS.video;
  const actualIntentScore = calculateDetailedIntentScore(userInput, answers, domain);

  while (attempts < maxAttempts) {
    attempts++;
    try {
      // 진행 상황 알림
      if (attempts === 1) {
        console.log(`🔄 프롬프트 개선 시도 ${attempts}/${maxAttempts}`);
      }
      
      const generatedPrompt = await generateAIPrompt(userInput, answers, domain, debug);
      const qualityScore = evaluationSystem.evaluatePromptQuality(generatedPrompt, domain);
      
      if (qualityScore.total > best.score) {
        best = { text: generatedPrompt, score: qualityScore.total };
      }

      if (qualityScore.total >= 95 && actualIntentScore >= 95) {
        return res.status(200).json({
          success: true,
          step: 'completed',
          originalPrompt: userInput,
          improvedPrompt: generatedPrompt,
          intentScore: actualIntentScore, // ⭐ 실제 점수 사용
          qualityScore: qualityScore.total,
          attempts,
          message: `🎉 완성! 의도 ${actualIntentScore}점, 품질 ${qualityScore.total}점 달성!`
        });
      }
      
      // ⭐ 점수가 부족하면 추가 질문 생성
      if (actualIntentScore < 95) {
        const targetedQuestions = await generateTargetedQuestions(
          userInput, answers, domain, actualIntentScore, debug
        );
        
        return res.status(200).json({
          success: true,
          step: 'questions',
          questions: targetedQuestions,
          round: attempts + 1,
          intentScore: actualIntentScore,
          qualityScore: qualityScore.total,
          status: 'improving', // ⭐ 진행 상황 표시
          message: `개선 중... 의도 점수를 올리기 위한 추가 정보가 필요합니다.`
        });
      }
    } catch (e) {
      console.error('Generate error:', e);
    }
  }
  
  // 최대 시도 후 최고 버전 반환
  return res.status(200).json({
    success: true,
    step: 'completed',
    originalPrompt: userInput,
    improvedPrompt: best.text,
    intentScore: actualIntentScore,
    qualityScore: best.score,
    attempts,
    message: `최선의 결과입니다. 의도 ${actualIntentScore}점, 품질 ${best.score}점`
  });
}

// ⭐ 새로운 함수: 상세한 의도 점수 계산
function calculateDetailedIntentScore(userInput, answers, domain) {
  const allText = [userInput, ...answers].join(' ').toLowerCase();
  let score = 10; // 기본 점수
  
  const scoreComponents = {
    video: {
      length: { weight: 15, keywords: ['초', '분', '시간', '길이'] },
      platform: { weight: 10, keywords: ['유튜브', '틱톡', '인스타', 'youtube'] },
      subject_detail: { weight: 20, keywords: ['품종', '크기', '색상', '외모'] },
      action_detail: { weight: 20, keywords: ['마술', '트릭', '동작', '행동'] },
      style: { weight: 10, keywords: ['실사', '애니메이션', '3d'] },
      audience: { weight: 10, keywords: ['성인', '아이', '가족', '모든'] },
      mood: { weight: 10, keywords: ['유머', '감동', '신나는', '차분한'] }
    },
    image: {
      subject_detail: { weight: 25, keywords: ['구체적', '상세', '특징'] },
      style: { weight: 20, keywords: ['스타일', '화풍', '기법'] },
      composition: { weight: 15, keywords: ['구도', '배치', '레이아웃'] },
      colors: { weight: 15, keywords: ['색상', '톤', '팔레트'] },
      resolution: { weight: 10, keywords: ['해상도', '크기', 'dpi'] },
      mood: { weight: 10, keywords: ['분위기', '느낌', '감정'] }
    }
  };
  
  const components = scoreComponents[domain] || scoreComponents.video;
  
  Object.entries(components).forEach(([key, config]) => {
    const hasKeyword = config.keywords.some(kw => allText.includes(kw));
    if (hasKeyword) {
      score += config.weight;
    }
  });
  
  // 답변 개수에 따른 보너스 (최대 10점)
  const answerBonus = Math.min(answers.length * 2, 10);
  score += answerBonus;
  
  return Math.min(score, 95);
}

// ⭐ 새로운 함수: 점수 향상을 위한 타겟 질문 생성
async function generateTargetedQuestions(userInput, answers, domain, currentScore, debug) {
  const missingScore = 95 - currentScore;
  
  // 어떤 정보가 부족한지 분석
  const missingInfo = analyzeMissingInfo(userInput, answers, domain);
  
  const prompt = `
You are helping improve a ${domain} prompt. Current intent score: ${currentScore}/95.
Missing score: ${missingScore} points.

Missing information categories:
${missingInfo.map(info => `- ${info.category}: ${info.description}`).join('\n')}

Generate 2-3 SPECIFIC questions in Korean that will help raise the score.
Focus on the most important missing details.

Each question should:
1. Target a specific missing piece of information
2. Include a text input field (not just options)
3. Be clear and specific

Return JSON:
{
  "questions": [
    {
      "question": "구체적인 질문",
      "category": "카테고리",
      "inputType": "text",
      "placeholder": "예시 답변",
      "scoreValue": 10
    }
  ]
}`;

  const raw = await callOpenAI(prompt, 0.3, debug);
  
  try {
    const parsed = JSON.parse(raw);
    return parsed.questions || [];
  } catch (e) {
    // 폴백 질문
    return [
      {
        question: "강아지의 품종이나 외모를 구체적으로 설명해주세요",
        inputType: "text",
        placeholder: "예: 골든 리트리버, 중형견, 갈색 털",
        scoreValue: 20
      },
      {
        question: "어떤 마술 트릭을 보여주면 좋을까요?",
        inputType: "text",
        placeholder: "예: 공 사라지게 하기, 간식 찾기",
        scoreValue: 20
      }
    ];
  }
}

// ⭐ 정보 부족 분석
function analyzeMissingInfo(userInput, answers, domain) {
  const allText = [userInput, ...answers].join(' ').toLowerCase();
  const missing = [];
  
  if (domain === 'video') {
    if (!allText.match(/\d+\s*(초|분)/)) {
      missing.push({ category: 'duration', description: '구체적인 영상 길이' });
    }
    if (!allText.includes('품종') && !allText.includes('골든') && !allText.includes('푸들')) {
      missing.push({ category: 'subject', description: '강아지 품종/외모' });
    }
    if (!allText.includes('트릭') && !allText.includes('마술')) {
      missing.push({ category: 'action', description: '구체적인 마술 내용' });
    }
    if (!allText.includes('유튜브') && !allText.includes('틱톡')) {
      missing.push({ category: 'platform', description: '업로드 플랫폼' });
    }
  }
  
  return missing;
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

// Fallback 질문 생성
async function generateFallbackQuestions(domain) {
  const fallbackQuestions = {
    video: [
      { question: "영상의 구체적인 목적은 무엇인가요?", options: ["교육", "홍보", "엔터테인먼트", "정보 전달"], key: "purpose" },
      { question: "타겟 시청자는 누구인가요?", options: ["10대", "20-30대", "40-50대", "모든 연령"], key: "audience" }
    ],
    image: [
      { question: "이미지의 주요 용도는 무엇인가요?", options: ["웹사이트", "인쇄물", "SNS", "프레젠테이션"], key: "usage" },
      { question: "원하는 스타일은 무엇인가요?", options: ["사실적", "일러스트", "미니멀", "복잡한"], key: "style" }
    ]
  };
  return fallbackQuestions[domain] || fallbackQuestions.video;
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

IMPORTANT CONSTRAINTS:
- Do NOT propose specific brand names, platform names, or overly specific examples
- Keep options generic and category-based
- Avoid suggesting "Vimeo", "rabbit from hat", or other specific props unless user mentioned them

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

// 최종 프롬프트 생성 (지어내기 방지 강화)
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

STRICT RULES:
- ONLY include details explicitly mentioned in the user input or answers
- Do NOT invent specific examples, brand names, or platforms (no Vimeo, no Facebook, etc.)
- Do NOT add specific props or examples (no "rabbit from hat", no specific tricks)
- If any required field is missing, write [TBD: field name] as placeholder
- Keep everything factual based only on provided information`,
    
    image: `Create a professional, production-ready image prompt in English from the following information:

${allAnswers}

Requirements:
- Clear subject and composition
- Style, lighting, lens/camera hints when relevant
- Background/setting and mood
- Negative constraints (what to avoid)
- Technical specs (size/aspect, quality)

STRICT RULES:
- ONLY include details explicitly mentioned in the user input or answers
- Do NOT invent specific elements, brands, or examples
- If any required field is missing, write [TBD: field name] as placeholder
- Keep everything factual based only on provided information`
  };

  const sys = `You are a world-class prompt engineer. You write concise but complete prompts that tools can execute.
NEVER add information not provided by the user. Use [TBD] placeholders for missing information.`;
  
  const prompt = domainPrompts[domain] || domainPrompts.video;
  const raw = await callOpenAIWithSystem(sys, prompt, 0.2, debug);
  const generated = (raw || '').trim();
  
  // sanitize 적용
  return sanitizeGenerated(generated, allAnswers);
}

// ========== sanitize 함수 추가 ==========
function sanitizeGenerated(text, facts) {
  try {
    const base = (facts || '').toLowerCase();
    const lines = (text || '').split(/\r?\n/);
    
    // 의심 단어들 (사용자가 언급하지 않은 것들)
    const suspicious = [
      'vimeo', 'facebook', 'instagram reels', 'tiktok', 'prime video', 'netflix',
      'pulling a rabbit', 'rabbit from a hat', 'rabbit from the hat', 'top hat',
      'disappearing act', 'card tricks'
    ];
    
    const cleaned = lines.map(line => {
      const low = line.toLowerCase();
      
      // 사실에 없는 의심 단어가 포함된 라인 처리
      for (const word of suspicious) {
        if (low.includes(word) && !base.includes(word)) {
          // 완전 제거보다는 일반화
          line = line
            .replace(/vimeo/gi, 'online platform')
            .replace(/facebook/gi, 'social media')
            .replace(/(pulling a rabbit|rabbit from a hat|rabbit from the hat)/gi, 'magic trick')
            .replace(/top hat/gi, 'prop')
            .replace(/disappearing act/gi, 'performance')
            .replace(/card tricks/gi, 'tricks');
        }
      }
      
      return line;
    });
    
    return cleaned.join('\n');
  } catch (e) {
    console.warn('sanitizeGenerated error:', e);
    return text || '';
  }
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

  const body = {model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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
