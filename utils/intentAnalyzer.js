// utils/intentAnalyzer.js
// 점수 = 체크리스트 충족률(%) 방식으로 단순/명확하게 계산

// ---- 내부 유틸 (의존성 없이 독립 동작) ----
function toFlatStringArray(val) {
  if (typeof val === "string") return [val];
  if (Array.isArray(val)) return val.flatMap(v => toFlatStringArray(v));
  if (val && typeof val === "object") return Object.values(val).flatMap(v => toFlatStringArray(v));
  return [];
}

function extractItemKeywords(item) {
  const str = String(item);
  const keywordMap = {
    "목적": ["목적", "용도", "목표"],
    "시청자": ["시청자", "대상", "타겟"],
    "길이": ["길이", "시간", "분", "초"],
    "플랫폼": ["플랫폼", "유튜브", "인스타", "틱톡", "릴스"],
    "스토리": ["스토리", "구성", "흐름"],
    "등장인물": ["등장인물", "캐릭터", "인물"],
    "카메라": ["카메라", "촬영", "앵글"],
    "음향": ["음향", "음악", "소리", "내레이션"]
  };
  for (const [key, arr] of Object.entries(keywordMap)) {
    if (str.includes(key)) return arr;
  }
  return str.split(/\s+/).filter(w => w.length > 1);
}

function checkItemCoverage(item, text, mentions) {
  const keywords = extractItemKeywords(item).map(s => s.toLowerCase());
  if (!keywords.length) return 0;

  const haystackText = String(text || "").toLowerCase();
  const mentionText = toFlatStringArray(mentions).map(s => String(s).toLowerCase()).join(" ");

  let matches = 0;
  for (const kw of keywords) {
    if (!kw) continue;
    if (haystackText.includes(kw) || mentionText.includes(kw)) matches++;
  }
  return Math.min(1, matches / keywords.length);
}

// ---- 공개 클래스 ----
export class IntentAnalyzer {
  /**
   * 점수 = 체크리스트 달성률(%)
   * @param {string} userInput 
   * @param {string[]} answers 
   * @param {string} domain 
   * @param {object} checklist  // DOMAIN_CHECKLISTS[domain]
   * @param {object} mentions   // mentionExtractor.extract(...) 결과
   * @returns {number} 0~100
   */
  calculateIntentScore(userInput, answers, domain, checklist, mentions = {}) {
    const items = Object.values(checklist || {}).flat();
    if (!items.length) return 0;

    const allText = [userInput, ...(Array.isArray(answers) ? answers : [])].join(" ");
    let covered = 0;
    for (const it of items) {
      const cov = checkItemCoverage(it, allText, mentions);
      if (cov >= 0.7) covered++;
    }
    const ratio = covered / items.length;
    return Math.round(ratio * 100);
  }
}

export default IntentAnalyzer;
