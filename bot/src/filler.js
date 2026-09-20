/* 신고서 페이지에서 실행돼 클립보드의 값을 각 항목에 넣는 코드.
 *
 * 사용자의 평소 브라우저에서 돌아간다. 자동화 브라우저에서는 본인인증(PASS)이
 * 막히는 경우가 많아, 입력만 대신하고 인증과 제출은 사용자의 브라우저에 맡긴다.
 * 제출은 하지 않는다. */
export const FILLER_SOURCE = `(function(){
function set(id,v){var e=document.getElementById(id);if(!e||v===undefined||v===null||v==='')return 0;
e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
e.style.outline='2px solid #22c55e';return 1;}
function tick(id){var e=document.getElementById(id);if(!e)return 0;if(!e.checked){e.click();}
if(!e.checked){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));}
e.style.outline='2px solid #22c55e';return 1;}
function fill(d){
if(!d||d.v!==1){alert('암표 신고 봇에서 복사한 데이터가 아닙니다.');return;}
var n=0;
n+=set('TITLE',d.TITLE);n+=set('SHOW_DT',d.SHOW_DT);n+=set('PAYMENT_ORG',d.PAYMENT_ORG);
n+=set('PAYMENT_USE',d.PAYMENT_USE);n+=set('INVALID_SEL_DT',d.INVALID_SEL_DT);
n+=set('SEAT_NUMBER',d.SEAT_NUMBER);n+=set('RESERVATION_NUMBER',d.RESERVATION_NUMBER);
n+=set('CONTENTS',d.CONTENTS);
if(d.showType)n+=tick('showType'+d.showType);
if(d.paySite)n+=tick('paySiteTypeCd'+d.paySite);
if(d.ticketSite)n+=tick('ticketSiteCd'+d.ticketSite);
if(d.sellerId){n+=tick('invalidInfoCd03');n+=set('invalidInfoCd03_item',d.sellerId);}
if(d.link){n+=tick('selInfoTypeCd04');n+=set('selInfoTypeCd04_item',d.link);}
var msg=n+'개 항목을 채웠습니다(초록 테두리).\\n\\n제출은 하지 않았습니다.\\n본인인증, 증빙파일 첨부, 제출은 직접 해주세요.';
if(d._skipped&&d._skipped.length)msg+='\\n\\n직접 입력해야 하는 항목:\\n· '+d._skipped.join('\\n· ');
alert(msg);
}
function parse(t){try{return JSON.parse(t);}catch(e){return null;}}
if(!document.getElementById('TITLE')){
alert('이 페이지는 암표 신고서 화면이 아닙니다.\\nent.kocca.kr/ticket/receive.do 를 먼저 여세요.');return;}
if(navigator.clipboard&&navigator.clipboard.readText){
navigator.clipboard.readText().then(function(t){var d=parse(t);
if(d)fill(d);else{var m=window.prompt('클립보드를 읽지 못했습니다. 봇 화면의 데이터를 붙여넣어 주세요.');if(m)fill(parse(m));}})
.catch(function(){var m=window.prompt('클립보드 읽기가 차단됐습니다. 봇 화면의 데이터를 붙여넣어 주세요.');if(m)fill(parse(m));});
}else{var m=window.prompt('봇 화면의 데이터를 붙여넣어 주세요.');if(m)fill(parse(m));}
})()`.replace(/\n/g, '');

export const BOOKMARKLET_HREF = 'javascript:' + encodeURIComponent(FILLER_SOURCE);

/** 북마크 바로 끌어다 놓을 수 있는 안내 페이지를 만든다. */
export function bookmarkletPage() {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>신고서 채우기 북마클릿</title>
<style>
 body{font-family:-apple-system,'Malgun Gothic','Noto Sans KR',sans-serif;
      max-width:680px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1f2937}
 h1{font-size:1.4rem}
 .box{border:2px dashed #3b82f6;border-radius:12px;padding:24px;text-align:center;
      background:#eff6ff;margin:24px 0}
 .bm{display:inline-block;padding:12px 24px;border-radius:10px;font-weight:700;
     background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;cursor:grab}
 ol{padding-left:22px} li{margin-bottom:10px}
 code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:.9em}
 .note{color:#6b7280;font-size:.9rem}
</style></head><body>
<h1>신고서 채우기 북마클릿</h1>
<p>아래 버튼을 <strong>북마크 바로 끌어다 놓으세요.</strong> 한 번만 하면 됩니다.
   (북마크 바가 안 보이면 <code>Ctrl+Shift+B</code>)</p>
<div class="box">
  <a class="bm" href="${BOOKMARKLET_HREF}" draggable="true">📝 신고서 채우기</a>
  <p class="note" style="margin-top:14px">← 이 버튼을 드래그</p>
</div>
<h2 style="font-size:1.1rem">쓰는 법</h2>
<ol>
  <li>봇에서 <strong>폼 데이터가 복사됐다</strong>는 안내가 나오면</li>
  <li>신고서 페이지를 엽니다 —
      <a href="https://ent.kocca.kr/ticket/receive.do" target="_blank" rel="noopener">공연분야 온라인 암표신고센터 ↗</a></li>
  <li>북마크 바의 <strong>「신고서 채우기」</strong>를 누릅니다</li>
  <li>클립보드 읽기를 허용하면 항목이 채워집니다 (초록 테두리)</li>
  <li><strong>본인인증 · 증빙파일 첨부 · 제출</strong>은 직접 하세요</li>
</ol>
<p class="note">제출 버튼은 누르지 않습니다. 신고는 신고인 명의로 접수되고,
   포상금도 신고인 명의로 지급됩니다.</p>
</body></html>`;
}
