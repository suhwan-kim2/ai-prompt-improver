// script.js - API 없이 임시로 동작하는 버전

// 🔥 API 대신 클라이언트에서 직접 처리
async function callAPI(step, data) {
    console.log('=== 클라이언트 처리 ===');
    console.log('Step:', step);
    
    // API 호출 대신 클라이언트에서 직접 결과 생성
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 딜레이로 로딩 효과
    
    if (step === 'questions') {
        const userInput = data.userInput.toLowerCase();
        let questions = [];
        
        if (userInput.includes('그림') || userInput.includes('이미지')) {
            questions = [
                {
                    question: "어떤 스타일의 그림을 원하시나요?",
                    type: "choice",
                    options: ["사실적", "만화적", "3D", "수채화"]
                },
                {
                    question: "주요 색상을 선택해주세요.",
                    type: "choice",
                    options: ["밝은 톤", "어두운 톤", "무채색", "화려한 색상"]
                }
            ];
        } else if (userInput.includes('웹사이트') || userInput.includes('사이트')) {
            questions = [
                {
                    question: "웹사이트의 주요 목적은?",
                    type: "choice",
                    options: ["회사 소개", "쇼핑몰", "포트폴리오", "블로그"]
                },
                {
                    question: "디자인 스타일은?",
                    type: "choice",
                    options: ["모던", "클래식", "미니멀", "화려함"]
                }
            ];
        } else {
            questions = [
                {
                    question: "어떤 스타일을 원하시나요?",
                    type: "choice",
                    options: ["공식적", "친근한", "전문적", "창의적"]
                },
                {
                    question: "주요 목적은?",
                    type: "choice",
                    options: ["업무용", "개인용", "교육용", "상업용"]
                }
            ];
        }
        
        return questions;
        
    } else if (step === 'final-improve') {
        return `다음과 같이 "${data.userInput}"을 상세하게 구현해주세요:

주제: ${data.userInput}
요구사항: 고품질, 전문적인 결과물
세부사항: 사용자의 모든 답변을 반영한 완성도 높은 작품

${data.answers ? '사용자 답변 반영:\n' + data.answers : ''}

위 내용을 바탕으로 정확하고 완성도 높은 결과물을 제작해주세요.`;
        
    } else if (step === 'evaluate') {
        return {
            score: 85,
            strengths: ["구체적인 요구사항 포함", "사용자 답변 반영"],
            improvements: ["더 세부적인 기술 사양", "구체적인 수치 추가"],
            recommendation: "좋은 품질의 프롬프트입니다!"
        };
    }
    
    return "처리 완료";
}
