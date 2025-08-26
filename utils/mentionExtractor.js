class MentionExtractor {
  extract(text){
    if (Array.isArray(text)) text = text.join(" ");
    text = (text || "").toLowerCase();
    const hits = {};
    const pairs = {
      subject:/\b(고양이|강아지|사람|제품|포스터|앱|웹사이트|api|영상|로고)\b/g,
      style:/\b(사실적|포토|애니|일러스트|3d|수채화|유화|모던|미니멀)\b/g,
      ratio_size:/\b(1:1|4:3|16:9|9:16|세로|가로|정사각형)\b/g,
      lighting_camera:/\b(자연광|림라이트|클로즈업|아이레벨|보케|심도)\b/g,
      use_rights:/\b(상업|비상업|라이선스|저작권)\b/g,
      negatives:/\b(no |--no |피하기|제외|blurry|watermark|왜곡)\b/g,
      purpose:/\b(광고|교육|홍보|튜토리얼|브랜딩)\b/g,
      length:/\b(\d+\s*분|\d+\s*초|숏폼|장편)\b/g,
      platform:/\b(유튜브|틱톡|인스타|tv|웹)\b/g,
      audio_caption:/\b(배경음|효과음|내레이션|자막)\b/g,
      rights:/\b(상업|비상업|라이선스|크레딧)\b/g,
      type:/\b(웹|모바일|데스크톱|api|백엔드)\b/g,
      core_features:/\b(의도|질문|점수|라우팅|로그|버전)\b/g,
      target_users:/\b(사용자|고객|직원|개발자|학생)\b/g,
      tech_pref_constraints:/\b(react|vue|python|java|node|claude|pika|nanobanana)\b/g,
      priority:/\b(정확성|속도|확장성|안정성|사용성)\b/g,
      security_auth:/\b(oauth|sso|jwt|보안|권한|인증)\b/g
    };
    Object.entries(pairs).forEach(([k,rgx])=>{
      const m = text.match(rgx);
      if(m && m.length) hits[k]=[...new Set(m)];
    });
    return hits;
  }
}
export { MentionExtractor };
