// utils/mentionExtractor.js - 사용자 언급 정보 추출 시스템

/**
 * 사용자 입력에서 이미 언급된 정보를 자동으로 추출
 * 재질문을 방지하고 컨텍스트를 보존하는 역할
 */

// 추출 가능한 정보 카테고리별 키워드 매핑
const EXTRACTION_PATTERNS = {
  
  // 색상 정보
  색상: {
    keywords: [
      '빨간', '빨강', '레드', '적색',
      '파란', '파랑', '블루', '청색',
      '노란', '노랑', '옐로우', '황색',
      '검은', '검정', '블랙', '흑색',
      '흰', '하얀', '화이트', '백색',
      '초록', '녹색', '그린',
      '보라', '퍼플', '자주',
      '분홍', '핑크', '장밋빛',
      '갈색', '브라운', '갈색',
      '회색', '그레이', '은색',
      '황금', '골드', '금색',
      '오렌지', '주황'
    ],
    processor: (input, keyword) => {
      if (keyword.includes('빨간') || keyword.includes('빨강')) return '빨간색';
      if (keyword.includes('파란') || keyword.includes('파랑')) return '파란색';
      if (keyword.includes('노란') || keyword.includes('노랑')) return '노란색';
      if (keyword.includes('검은') || keyword.includes('검정')) return '검은색';
      if (keyword.includes('흰') || keyword.includes('하얀')) return '흰색';
      if (keyword.includes('초록') || keyword.includes('녹색')) return '초록색';
      if (keyword.includes('보라') || keyword.includes('퍼플')) return '보라색';
      if (keyword.includes('
