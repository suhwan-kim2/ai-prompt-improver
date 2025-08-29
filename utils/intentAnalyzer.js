// utils/intentAnalyzer.js

export class IntentAnalyzer {
  /**
   * 의도 점수 계산
   * @param {string} userInput
   * @param {string[]} answers  - "q1: value" 형태
   * @param {string} domain
   * @param {object} checklist  - DOMAIN_CHECKLISTS[domain]
   * @param {object} mentions   - mentionExtractor.extract(...)
   * @param {string} draft      - (선택) 서버에서 만든 임시 프롬프트 초안
   * @returns {number} 0~100
   */
  calculateIntentScore(userInput, answers, domain, checklist, mentions, draft = "") {
    const text = [
      userInput || "",
      ...(answers || []),
      draft || ""
    ].join(" ").toLowerCase();

    // 체크리스트 각 항목 커버 여부
    let total = 0;
    let covered = 0;

    const extractItemKeywords = (item) => {
      const keywordMap = {
        '목적': ['목적','용도','목표'],
        '시청자': ['시청자','대상','타겟','성인','30대','20대','10대','모든 연령대'],
        '길이': ['길이','시간','분','초','1-2분','1~2분','1-3분','3분','1분','2분'],
        '플랫폼': ['플랫폼','유튜브','youtube','틱톡','tiktok','인스타','instagram','shorts','쇼츠'],
        '스토리': ['스토리','구성','흐름','시작','중간','끝','씬','타임라인'],
        '등장인물': ['등장인물','캐릭터','인물','강아지','주인공'],
        '카메라': ['카메라','촬영','앵글','줌','슬로우 모션','드론'],
        '음향': ['음향','음악','소리','효과음','BGM','자막']
      };
      for (const [k, arr] of Object.entries(keywordMap)) {
        if (String(item).includes(k)) return arr;
      }
      return String(item).split(' ').filter(w => w.length > 1);
    };

    const includes = (hay, needle) => hay.includes(String(needle).toLowerCase());

    Object.values(checklist || {}).forEach(items => {
      (items || []).forEach(item => {
        total++;
        const kws = extractItemKeywords(item);
        // 텍스트/멘션에 키워드가 얼마나 포착됐는지 간단 평가
        let hits = 0;
        kws.forEach(k => { if (includes(text, k)) hits++; });
        if (mentions) {
          Object.values(mentions).flat().forEach(m => {
            kws.forEach(k => { if (String(m || '').toLowerCase().includes(String(k).toLowerCase())) hits++; });
          });
        }
        const cov = kws.length ? Math.min(hits / kws.length, 1) : 0;
        if (cov >= 0.7) covered++;
      });
    });

    // 기본 커버리지 점수
    let score = total ? Math.round((covered / total) * 100) : 0;

    // 보정: 플랫폼/길이/대상 같은 핵심 축이 있으면 가산점
    const hasPlatform = /(유튜브|youtube|틱톡|tiktok|인스타|instagram|shorts|쇼츠)/.test(text);
    const hasLength   = /(분|초|1-2분|1~2분|1-3분|3분|1분|2분)/.test(text);
    const hasAudience = /(성인|모든 연령대|타겟|대상|10대|20대|30대)/.test(text);
    const hasStory    = /(시작|중간|끝|씬|타임라인|구성|스토리)/.test(text);

    [hasPlatform, hasLength, hasAudience, hasStory].forEach(ok => { if (ok) score += 5; });
    score = Math.min(score, 100);

    // 하한/상한 보정: 최소 정보라도 있으면 15 이상으로 띄움 (0 방지)
    if (score === 0 && (answers?.length || userInput)) score = 15;

    return score;
  }
}
