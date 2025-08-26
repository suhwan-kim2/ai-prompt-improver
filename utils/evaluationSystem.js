class EvaluationSystem {
  evaluatePromptQuality(prompt, domain = "development"){
    const w = { clarity:20, specificity:25, format:20, executability:20, constraints_quality:15 };
    const s = {
      clarity: this.passClarity(prompt) ? w.clarity : 0,
      specificity: this.passSpecificity(prompt) ? w.specificity : 0,
      format: this.passFormat(prompt) ? w.format : 0,
      executability: this.passExec(prompt, domain) ? w.executability : 0,
      constraints_quality: this.passCQ(prompt, domain) ? w.constraints_quality : 0
    };
    const totalW = Object.values(w).reduce((a,b)=>a+b,0);
    const score = Math.round((Object.values(s).reduce((a,b)=>a+b,0)/totalW)*100);
    return { total: score, details: s, maxScore: 100, improvements: this.improve(prompt, domain, s) };
  }

  passClarity(t){ return !/(이것|그것|저것)\b/.test(t) && !/모호|애매/.test(t); }
  passSpecificity(t){ return /\d/.test(t) || /(비율|형식|길이|스펙|조건|상업|권리)/.test(t); }
  passFormat(t){ return t.length<=500 && /[가-힣]/.test(t); }
  passExec(t,_domain){ return !/불가능|미정/.test(t); }
  passCQ(t){ return /(no |--no |제외|금지|부정)/.test(t) || /(해상도|비율|스펙|권리|상업)/.test(t); }

  improve(_t,_d,s){
    const out = [];
    if(s.clarity===0) out.push("지시대명사 제거 및 한 문장 의도 요약 추가");
    if(s.specificity===0) out.push("수치/조건/비율/길이/권리 등 정량 정보 추가");
    if(s.format===0) out.push("한국어 500자 이내로 정리");
    if(s.executability===0) out.push("모델 범위 내로 요구사항 조정");
    if(s.constraints_quality===0) out.push("부정 프롬프트/권리/스펙/제약 명시");
    return out;
  }
}
export { EvaluationSystem };
