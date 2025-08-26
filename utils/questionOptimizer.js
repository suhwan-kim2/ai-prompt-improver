class QuestionOptimizer {
  pick(missingKeys = [], domain = "dev", max = 2){
    const priority = missingKeys.map(k => ({ key:k, p:this.weight(k,domain) }))
                                .sort((a,b)=>b.p-a.p)
                                .slice(0, max)
                                .map(x => this.toQuestion(x.key));
    return priority;
  }
  weight(k,domain){
    const map = {
      image: { subject:9, style:8, ratio_size:8, lighting_camera:7, use_rights:6, negatives:5 },
      video: { purpose:9, length:8, style:7, platform:6, audio_caption:6, rights:6 },
      dev:   { type:9, core_features:9, target_users:7, tech_pref_constraints:8, priority:6, security_auth:6 }
    };
    return (map[domain]||{})[k] || 5;
  }
  toQuestion(key){
    const map = {
      subject:"정확한 주제는 무엇인가요?",
      style:"어떤 스타일을 원하시나요?",
      ratio_size:"출력 비율/크기를 정해주세요(예: 16:9, 9:16, 1:1).",
      lighting_camera:"조명/구도 선호가 있나요?",
      use_rights:"용도/권리(상업/비상업)를 알려주세요.",
      negatives:"피하고 싶은 요소 1가지만 적어주세요.",
      purpose:"영상의 목적은 무엇인가요?",
      length:"길이는 어느 정도인가요? (~1분/1-5분/5-10분/10분+)",
      platform:"플랫폼은 어디인가요?(유튜브/틱톡/인스타 등)",
      audio_caption:"배경음/내레이션/자막 중 필요한 것은?",
      rights:"저작권/사용권 제약이 있나요?",
      type:"어떤 유형의 프로그램인가요?(웹/모바일/데스크톱/API)",
      core_features:"핵심 기능 1~3가지를 적어주세요.",
      target_users:"주요 사용자는 누구인가요?",
      tech_pref_constraints:"희망 스택/제약이 있나요?",
      priority:"우선순위는 무엇인가요?(정확성/속도/확장성 등)",
      security_auth:"보안/인증 요구가 있나요?"
    };
    return { key, question: map[key] || `${key}에 대해 알려주세요.` };
  }
}
export { QuestionOptimizer };
