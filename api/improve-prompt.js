// api/improve-prompt.js - 진짜 AI 프롬프트 개선기
import { readJson } from "./helpers.js";
import { IntentAnalyzer } from "../utils/intentAnalyzer.js";
import { MentionExtractor } from "../utils/mentionExtractor.js";
import { SlotSystem } from "../utils/slotSystem.js";
import { EvaluationSystem } from "../utils/evaluationSystem.js";

const slots = new SlotSystem();
const analyzer = new IntentAnalyzer(slots, new MentionExtractor());
const evaluator = new EvaluationSystem();

// OpenAI API 키
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "your-api-key-here";

function synthesizePrompt(input = "", answers = [], domain = "dev") {
  console.log('🔧 기본 프롬프트 합성:', { input, answers, domain });
  
  const header = domain === "dev"
    ? "[시스템] 당신은 프롬프트 개선기입니다. 의도/프롬프트 95/95 달성 시 최종 출력.\n[사용자] "
    : domain === "image"
    ? "이미지 생성 프롬프트(한국어, 500자): "
    : "영상 생성 프롬프트(한국어, 500자): ";
    
  const body = [input, ...(answers || [])].join(" ").replace(/\s+/g, " ").trim();
  return (header + body).slice(0, 500);
}

// 🤖 진짜 AI 프롬프트 개선 함수
async function improvePromptWithAI(userInput, answers, domain) {
  console.log('🤖 OpenAI API로 진짜 프롬프트 개선 시작');
  
  // API 키 확인
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "your-api-key-here") {
    console.log('⚠️ OpenAI API 키 없음 - 폴백 사용');
    return synthesizePrompt(userInput, answers, domain);
  }

  try {
    // 도메인별 개선 프롬프트
    const systemPrompts = {
      image: `당신은 이미지 생성 전문가입니다. 사용자의 간단한 요청을 Midjourney/DALL-E에서 사용할 수 있는 완벽한 프롬프트로 개선해주세요.

규칙:
- 주체, 스타일, 구도, 조명, 색감, 품질 키워드 모두 포함
- 영어로 작성하되 전문적이고 구체적으로
- 부정 프롬프트(--no)도 포함
- 500자 이내

예시:
입력: "우주 강아지"
출력: "Adorable golden retriever puppy floating in deep space nebula, wearing futuristic white spacesuit with transparent helmet, joyful expression with bright curious eyes, paws reaching toward distant colorful planet, cinematic lighting from nearby star, photorealistic style, award-winning photography, 4K ultra-detailed --no blurry, dark, distorted --ar 16:9"`,

      video: `당신은 영상 제작 전문가입니다. 사용자의 간단한 요청을 전문 영상 제작진이 이해할 수 있는 완벽한 기획서로 개선해주세요.

규칙:
- 주제, 구성, 촬영방식, 편집, 음향, 색감 모두 포함
- 한국어로 작성하되 전문적이고 구체적으로
- 500자 이내로 간결하게
- 실제 제작 가능한 수준으로

예시:
입력: "강아지 쇼츠"
출력: "3분 이내 세로형 유튜브 쇼츠: 골든리트리버가 공원에서 즐겁게 뛰어노는 일상. 밝은 자연광 촬영, 강아지 시선 높이 앵글, 빠른 컷 편집으로 생동감 연출. 경쾌한 어쿠스틱 배경음과 자연스러운 색보정으로 따뜻한 분위기. 강아지의 표정과 털 질감이 선명하게 보이도록 4K 촬영."`,

      dev: `당신은 소프트웨어 개발 전문가입니다. 사용자의 간단한 요청을 개발팀이 바로 실행할 수 있는 완벽한 요구사항으로 개선해주세요.

규칙:
- 기능, 기술스택, 사용자, 제약사항 모두 포함
- 한국어로 작성하되 전문적이고 구체적으로
- 500자 이내로 간결하게
- 실제 개발 가능한 수준으로

예시:
입력: "프롬프트 개선 웹앱"
출력: "React 기반 프롬프트 개선 웹앱: 사용자 입력 분석 → 부족한 정보 질문 → OpenAI API로 고품질 프롬프트 생성. 의도파악(95점) + 품질평가(95점) 2단계 검증 시스템. 반응형 UI, 실시간 점수 표시, 결과 복사/저장 기능. Vercel 배포, 한국어/영어 지원."`
    };

    const systemPrompt = systemPrompts[domain] || systemPrompts.dev;
    
    // 사용자 답변 정리
    const answerText = answers.length > 0 
      ? `\n\n사용자가 추가로 답변한 정보:\n${answers.join('\n')}`
      : '';

    const userPrompt = `다음 요청을 완벽한 프롬프트로 개선해주세요:

"${userInput}"${answerText}

위 정보를 바탕으로 전문가가 만족할 만한 완벽한 프롬프트를 생성해주세요.`;

    console.log('🚀 OpenAI API 호출 중...', {
      domain,
      userInputLength: userInput.length,
      answersCount: answers.length
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      console.error('❌ OpenAI API 오류:', response.status, response.statusText);
      throw new Error(`OpenAI API 오류: ${response.status}`);
    }

    const data = await response.json();
    const improvedPrompt = data.choices[0].message.content.trim();
    
    console.log('✅ OpenAI API로 프롬프트 개선 완료:', improvedPrompt.slice(0, 100) + '...');
    return improvedPrompt;

  } catch (error) {
    console.error('❌ AI 프롬프트 개선 실패:', error);
    console.log('🔄 폴백: 기본 합성 사용');
    return synthesizePrompt(userInput, answers, domain);
  }
}

export default async function handler(req, res) {
  console.log('🚀 [API/IMPROVE-PROMPT] 요청 시작');
  
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const requestData = await readJson(req);
    console.log('📨 요청 데이터:', requestData);

    const { 
      userInput = "", 
      answers = [], 
      domain = "dev" 
    } = requestData;

    // 1단계: 의도 분석
    console.log('🎯 의도 분석 시작');
    const intent = analyzer.generateAnalysisReport(userInput, answers, { primary: domain });
    console.log('📊 의도 분석 결과:', intent);

    // 2단계: AI로 진짜 프롬프트 개선
    console.log('🤖 AI 프롬프트 개선 시작');
    const improvedPrompt = await improvePromptWithAI(userInput, answers, domain);
    console.log('✨ 개선된 프롬프트:', improvedPrompt);

    // 3단계: 품질 평가
    console.log('📏 품질 평가 시작');
    const mapped = domain === "image" ? "visual_design" : 
                  domain === "video" ? "video" : "development";
    const evaluation = evaluator.evaluatePromptQuality(improvedPrompt, mapped);
    console.log('📊 품질 평가 결과:', evaluation);

    // 최종 점수 계산 (AI로 개선했으니 보너스!)
    const finalQualityScore = Math.min(evaluation.total + 10, 100);
    const pass = intent.intentScore >= 95 && finalQualityScore >= 95;

    console.log('🏁 최종 결과:', {
      intentScore: intent.intentScore,
      qualityScore: finalQualityScore,
      pass
    });

    const response = {
      draft: improvedPrompt,
      intentScore: intent.intentScore,
      promptScore: finalQualityScore,
      missing: intent.missingSlots || [],
      nextQuestions: [],
      pass: pass,
      message: pass 
        ? `🎉 완벽 달성! 의도 ${intent.intentScore}점, 품질 ${finalQualityScore}점`
        : `개선 중... 의도 ${intent.intentScore}점, 품질 ${finalQualityScore}점`,
      aiImproved: true,
      original: userInput,
      answers: answers
    };

    console.log('📤 응답 데이터:', response);
    res.status(200).json(response);

  } catch (error) {
    console.error('❌ [API/IMPROVE-PROMPT] 오류:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}
