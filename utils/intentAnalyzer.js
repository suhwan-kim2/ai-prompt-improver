// utils/intentAnalyzer.js
import { SlotSystem } from "./slotSystem.js";
import { MentionExtractor } from "./mentionExtractor.js";

class IntentAnalyzer {
  constructor(
    slotSystem = new SlotSystem(),
    mentionExtractor = new MentionExtractor()
  ) {
    this.slotSystem = slotSystem;
    this.mentionExtractor = mentionExtractor;
  }

  generateAnalysisReport(userInput, answers = [], domainInfo = { primary: "dev" }) {
    const text = [userInput, ...answers].join(" ").toLowerCase();
    const mentions = this.mentionExtractor.extract(text);
    const domain = domainInfo.primary || "dev";
    const defs = new SlotSystem().domainSlots[domain] || [];
    const weights = this.defaultWeights(domain);

    let total = 0;
    let covered = 0;
    const breakdown = {};
    defs.forEach((key) => {
      const w = weights[key] ?? 10;
      total += w;
      const filled = this.isFilled(key, mentions, text);
      if (filled) covered += w;
      breakdown[key] = { filled, weight: w };
    });

    const intentScore = total > 0 ? Math.round((covered / total) * 100) : 0;
    const requiredFilled = defs.every((k) => breakdown[k].filled);
    const isComplete = requiredFilled || intentScore >= 95;
    const missingSlots = defs.filter((k) => !breakdown[k].filled);

    return {
      intentScore,
      slots: breakdown,
      isComplete,
      needsMoreInfo: !isComplete,
      missingSlots,
    };
  }

  // 슬롯 충족 여부 판단(언더스코어/공백/콜론 표기 모두 허용)
  isFilled(key, mentions, text) {
    if (mentions[key]?.length) return true;
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const k1 = key; // audio_caption
    const k2 = key.replace(/_/g, " "); // audio caption
    const patterns = [
      new RegExp(`(?:^|\\s)${escape(k1)}\\s*:`, "i"),
      new RegExp(`(?:^|\\s)${escape(k2)}\\s*:`, "i"),
      new RegExp(escape(k1), "i"),
      new RegExp(escape(k2), "i"),
    ];
    return patterns.some((r) => r.test(text));
  }

  defaultWeights(domain) {
    const map = {
      image: {
        subject: 22,
        style: 20,
        ratio_size: 18,
        lighting_camera: 18,
        use_rights: 12,
        negatives: 10,
      },
      video: {
        purpose: 22,
        length: 18,
        style: 18,
        platform: 14,
        audio_caption: 14,
        rights: 14,
      },
      dev: {
        type: 20,
        core_features: 22,
        target_users: 16,
        tech_pref_constraints: 18,
        priority: 12,
        security_auth: 12,
      },
    };
    return map[domain] || {};
  }
}

export { IntentAnalyzer };
