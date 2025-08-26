class MentionExtractor {
  extract(text){
    if (Array.isArray(text)) text = text.join(" ");
    text = (text || "").toLowerCase();
    const hits = {};
    const pairs = {
      subject: /(고양이|강아지|사람|제품|포스터|앱|웹사이트|api|영상|로고)/g,
      style: /(사실적|포토|애니|일러스트|3d|수채화|유화|모던|미니멀)/g,
      ratio_size: /(1:1|4:3|16:9|9:16|세로|가로|정사각형)/g,
      lighting_camera: /(자연광|림라이트|클로즈업|아이레벨|보케|심도)/g,
      use_rights: /(상업|비상업|라이선스|저작권)/g,
      // 오타/영문 포함
      negatives: /(no |--no |피하기|제외|bl러리|blurry|워터마크|watermark|왜곡)/g,
      purpose: /(광고|교육|홍보|튜토리얼|브랜딩)/g,
      length: /(\d+\s*분|\d+\s*초|숏폼|장편)/g,
      platform: /(유튜브|틱톡|인스타|tv|웹|youtube|tiktok|instagram)/g,
      // 내레이션/자막 변형들
      audio_caption: /(배경음|bgm|효과음|내레이션|나레이션|자막|caption|subtitle)/g,
      // 권리 없음도 인식
      rights: /(상업|비상업|라이선스|크레딧|없음|없어요|무권리|제한없음)/g,
      type: /(웹|모바일|데스크톱|api|백엔드)/g,
      core_features: /(의도|질문|점수|라우팅|로그|버전)/g,
      target_users: /(사용자|고객|직원|개발자|학생)/g,
      tech_pref_constraints: /(react|vue|python|java|node|claude|pika|nanobanana)/g,
      priority: /(정확성|속도|확장성|안정성|사용성)/g,
      security_auth: /(oauth|sso|jwt|보안|권한|인증)/g
    };
    Object.entries(pairs).forEach(([k,rgx])=>{
      const m = text.match(rgx);
      if(m && m.length) hits[k]=[...new Set(m)];
    });
    return hits;
  }
}
export { MentionExtractor };
