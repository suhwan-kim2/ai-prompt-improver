class SlotSystem {
  constructor(){
    this.domainSlots = {
      image: ["subject","style","ratio_size","lighting_camera","use_rights","negatives"],
      video: ["purpose","length","style","platform","audio_caption","rights"],
      dev:   ["type","core_features","target_users","tech_pref_constraints","priority","security_auth"]
    };
    this.questionMap = {
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
  }
  questionsFor(missing, domain){
    const keys = (missing.length ? missing : this.domainSlots[domain] || []);
    return keys.map(k=>({key:k, question:this.questionMap[k] || `${k}에 대해 알려주세요.`}));
  }
}
export { SlotSystem };
