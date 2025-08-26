// utils/questionOptimizer.js  (ESM 버전)

class QuestionOptimizer {
  constructor() {}

  // 메인 최적화: 중복 제거 → 우선순위 정렬 → 상위 N개
  optimize(questions = [], mentionedInfo = {}, domainInfo = {}, maxCount = 8) {
    try {
      if (!Array.isArray(questions) || questions.length === 0) {
        return this.generateFallbackQuestions().slice(0, maxCount);
      }
      const unique = this.removeDuplicates(questions);
      const prioritized = this.prioritize(unique, mentionedInfo, domainInfo);
      return prioritized.slice(0, maxCount);
    } catch (e) {
      console.error("QuestionOptimizer.optimize error:", e);
      return this.generateFallbackQuestions().slice(0, maxCount);
    }
  }

  // 호환을 위해 별칭 제공
  pick(missingKeys = [], domain = "general", maxCount = 2) {
    const qs = (missingKeys || []).map(k => ({ key: k, question: `${k}에 대해 알려주세요.` }));
    return this.optimize(qs, {}, { primary: domain }, maxCount);
  }

  removeDuplicates(questions) {
    const seen = new Set();
    return questions.filter(q => {
      const key = (q.key || "") + "|" + (q.question || "").slice(0, 24);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  prioritize(questions, mentionedInfo, domainInfo) {
    const domain = (domainInfo && domainInfo.primary) || "general";
    const must = {
      image: ["subject","style","ratio_size","lighting_camera"],
      video: ["purpose","length","style","platform"],
      development: ["type","core_features","target_users","tech_pref_constraints"],
      general: ["목표","대상","제약","스타일"]
    }[domain] || [];

    const mentionedFlat = new Set(
      Object.values(mentionedInfo || {})
        .flat()
        .map(s => String(s || "").toLowerCase())
    );

    return questions
      .map(q => {
        const key = String(q.key || "").toLowerCase();
        let p = 5;
        if (must.includes(q.key)) p += 4;
        if (/스타일|크기|목적|길이|플랫폼/.test(q.question || "")) p += 2;
        if (mentionedFlat.has(key)) p -= 3; // 이미 언급된 건 후순위
        return { ...q, priority: p };
      })
      .sort((a,b) => b.priority - a.priority);
  }

  generateFallbackQuestions() {
    return [
      { key: "목표", question: "구체적으로 어떤 결과물을 원하시나요?" },
      { key: "대상", question: "누가 사용하거나 볼 예정인가요?" },
      { key: "품질", question: "완성도/품질 수준은 어느 정도가 좋나요?" }
    ];
  }
}

// ESM export
export { QuestionOptimizer };
// 편의용 인스턴스도 함께 내보내기
export const questionOptimizer = new QuestionOptimizer();
