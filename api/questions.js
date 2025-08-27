// api/questions.js - 디버깅 강화 버전
import { SlotSystem } from "../utils/slotSystem.js";
import { IntentAnalyzer } from "../utils/intentAnalyzer.js";
import { MentionExtractor } from "../utils/mentionExtractor.js";
import { QuestionOptimizer } from "../utils/questionOptimizer.js";
import { readJson } from "./helpers.js";

const slots = new SlotSystem();
const analyzer = new IntentAnalyzer(slots, new MentionExtractor());
const qo = new QuestionOptimizer();

export default async function handler(req, res) {
  console.log('🚀 [API/QUESTIONS] 요청 시작');
  console.log('📨 요청 메소드:', req.method);
  console.log('📨 요청 헤더:', req.headers);
  
  try {
    if (req.method !== "POST") {
      console.log('❌ POST가 아닌 요청');
      return res.status(405).end();
    }

    console.log('📖 JSON 읽기 시작');
    const requestData = await readJson(req);
    console.log('📖 읽은 데이터:', requestData);

    const { 
      domain = "dev", 
      userInput = "", 
      answers = [], 
      askedKeys = [], 
      promptScore = 0 
    } = requestData;

    console.log('🔍 파라미터 추출:', {
      domain,
      userInput: userInput.slice(0, 50) + '...',
      answersCount: answers.length,
      askedKeysCount: askedKeys.length,
      promptScore
    });

    console.log('🎯 의도 분석 시작');
    const report = analyzer.generateAnalysisReport(userInput, answers, { primary: domain });
    console.log('📊 의도 분석 결과:', report);

    let missing = report.missingSlots || [];
    console.log('🔍 부족한 슬롯:', missing);
    
    const asked = new Set(Array.isArray(askedKeys) ? askedKeys : []);
    missing = missing.filter(k => !asked.has(k));
    console.log('🔍 아직 안 물어본 슬롯:', missing);

    // 질문 중단 조건 체크
    const shouldStop = (report.intentScore >= 95 && promptScore >= 95) || missing.length === 0;
    console.log('🛑 중단 조건 체크:', {
      intentScore: report.intentScore,
      promptScore,
      missingCount: missing.length,
      shouldStop
    });

    if (shouldStop) {
      console.log('🎉 질문 완료 - 중단');
      return res.status(200).json({ 
        questions: [], 
        missing, 
        intentScore: report.intentScore,
        message: '질문 완료! 프롬프트 생성 단계로 넘어갑니다.'
      });
    }

    // 질문 후보 생성
    console.log('❓ 질문 생성 시작');
    const candidates = slots.questionsFor(missing, domain, askedKeys);
    console.log('📝 질문 후보들:', candidates);

    const best = qo.optimize(candidates, {}, { primary: domain }, 2);
    console.log('🎯 최적화된 질문들:', best);

    const questions = (best || []).map(x => ({ 
      key: x.key, 
      question: x.question 
    }));

    console.log('✅ 최종 질문들:', questions);

    const response = {
      questions, 
      missing, 
      intentScore: report.intentScore,
      message: `${questions.length}개 질문 생성 완료`
    };

    console.log('📤 응답 데이터:', response);
    res.status(200).json(response);

  } catch (e) {
    console.error("❌ [API/QUESTIONS] 오류 발생:", e);
    console.error("❌ 오류 스택:", e.stack);
    
    res.status(500).json({ 
      error: String(e?.message || e),
      stack: e?.stack,
      timestamp: new Date().toISOString()
    });
  }
}
