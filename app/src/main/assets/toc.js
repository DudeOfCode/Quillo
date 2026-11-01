/* Quillo – automatic table of contents (like Word / WPS "Automatic Table")
   Built from Heading 1-6 paragraphs; entries have dot leaders and right-aligned page numbers that follow the
   page numbering of each section (1,2,3 / i,ii,iii / I,II,III). Tap an entry to jump, tap the title to edit. */
(function(){
const $=s=>document.querySelector(s);
const DEF={title:'Table of Contents',levels:3,nums:true,right:true,leader:'dots',smart:true};
let busy=false,lastSig='',uid=0,timer=null;
const css=document.createElement('style');css.textContent=`
#ed p.toc-title{margin:0;padding:0 0 8px;font:700 21.33px/1.25 Calibri,Carlito,sans-serif;color:#2f5496;user-select:none;cursor:pointer;text-align:left;text-indent:0}
#ed p.toc-e{margin-right:0;padding:0 0 6.67px;display:flex;align-items:baseline;font:14.67px/1.3 Calibri,Carlito,sans-serif;color:#000;user-select:none;cursor:pointer;white-space:normal;text-align:left;text-indent:0;margin-top:0;margin-bottom:0}
.toc-t{flex:0 1 auto;min-width:0}.toc-n{flex:none}
.toc-d{flex:1 1 24px;min-width:18px;margin:0 4px;align-self:baseline;height:0;border-bottom:1.5px dotted #222}
.toc-d[data-l=dash]{border-bottom:1.5px dashed #222}.toc-d[data-l=line]{border-bottom:1px solid #222}.toc-d[data-l=none]{border-bottom:0}.toc-d.toc-gap{flex:0 0 12px}
/* contents links never change colour: not on tap, not when visited */
#ed p.toc-e,#ed p.toc-e *,#ed p.toc-e:active,#ed p.toc-e:focus,#ed p.toc-e:visited{color:#000!important;text-decoration:none!important;-webkit-tap-highlight-color:transparent;outline:0}
#ed .toc-flash{background-color:rgba(255,226,64,.65);transition:background-color .5s}
#ed p.toc-empty{color:#667;font-style:italic;display:block}
#tocdlg{position:fixed;inset:0;background:#000a;z-index:62;display:none;align-items:center;justify-content:center;padding:12px}#tocdlg.on{display:flex}
#tocdlg .card{background:#fff;color:#111;border-radius:18px;padding:16px;width:min(100%,380px);max-height:96vh;overflow:auto;box-shadow:0 14px 40px #0008;font:14px system-ui,sans-serif}
#tocdlg h3{margin:0 0 10px;font:700 17px system-ui}#tocdlg .pre{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
#tocdlg .pre button{border:1.5px solid #cdd3df;background:#f6f8fc;border-radius:12px;padding:8px;text-align:left;color:#111;font:12px system-ui}
#tocdlg .pre b{display:block;color:#2f5496;font-size:14px;margin-bottom:4px}#tocdlg .pre i{display:block;font-style:normal;color:#333;line-height:1.5}
#tocdlg .pre i em{float:right;font-style:normal}
#tocdlg label{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:7px 0}#tocdlg input[type=text],#tocdlg select{width:58%;height:34px;border:1px solid #cdd3df;border-radius:8px;padding:0 8px;font:14px system-ui;color:#111;background:#fff}
#tocdlg input[type=checkbox]{width:20px;height:20px}#tocdlg .btns{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
#tocdlg .btns button{flex:1;min-width:80px;height:40px;border-radius:10px;border:1px solid #cdd3df;background:#f3f5fa;font:600 14px system-ui;color:#111}#tocdlg .btns .pri{background:#2f6fed;border-color:#2f6fed;color:#fff}#tocdlg .btns .dng{color:#c0392b}`;
document.head.appendChild(css);

const tocEls=()=>[...ed.children].filter(e=>e.dataset&&e.dataset.toc);
const getOpts=()=>{const t=tocEls().find(e=>e.dataset.opts);try{return t?JSON.parse(t.dataset.opts):null}catch(e){return null}};
/* ---------- smart heading detection: real headings + "CHAPTER ONE", "1. Title", "1.1 Title", "1.1.1 Title", "A. Title", ABSTRACT, REFERENCES ... ---------- */
const NUMW='one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty';
const reCh=new RegExp('^(chapter|part|unit)\\s+([0-9]+|[ivxlc]+|'+NUMW+')\\b[\\s:.\\u2013\\u2014-]*(.*)$','i');
const reKey=/^(abstract|acknowledg(?:e)?ments?|declaration|certification|dedication|references|bibliography|appendix(?:es)?(?:\s+[a-z0-9]+)?|list of (?:tables|figures|abbreviations|plates|symbols))\s*$/i;
const reMulti=/^(\d+(?:\.\d+)+)\.?\s*(\S.*)$/,reSingle=/^(\d+)[.)]\s*(\S.*)$/,reLetter=/^([A-Z])[.)]\s*(\S.*)$/;
const txtOf=el=>el.textContent.replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
function emph(el,t){const L=t.replace(/[^A-Za-z]/g,''),caps=L.length>2&&L===L.toUpperCase();let bold=false;const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;
 while(n=w.nextNode()){if(n.textContent.trim()){bold=+getComputedStyle(n.parentElement).fontWeight>=600;break}}return{caps,bold}}
const isBlk=b=>b&&/^(P|DIV)$/.test(b.tagName)&&!b.dataset.toc&&!b.classList.contains('sb')&&!b.classList.contains('pb');
function sib(b,dir){let n=dir<0?b.previousElementSibling:b.nextElementSibling;while(n&&isBlk(n)&&!txtOf(n)&&!n.querySelector('img'))n=dir<0?n.previousElementSibling:n.nextElementSibling;return n}
function collect(lv,smart){const items=[];
 ed.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h=>{if(h.closest('[data-toc]')||h.dataset.notoc)return;const t=txtOf(h);if(t&&+h.tagName[1]<=6)items.push({el:h,lv:+h.tagName[1],text:t})});
 if(smart){const skip=new Set();
  [...ed.children].filter(isBlk).forEach(b=>{if(skip.has(b)||b.querySelector('table,img'))return;const t=txtOf(b);if(!t||t.length>150)return;const words=t.split(' ').length,sent=/[.;,]$/.test(t);let m;
   if(m=t.match(reCh)){if(words>16)return;let text=t.replace(/\s*[:\-–—]\s*$/,'');
    if(!m[3]){const nx=sib(b,1);if(isBlk(nx)){const u=txtOf(nx);if(u&&u.split(' ').length<=10&&!/[.;,]$/.test(u)&&!reMulti.test(u)&&!reSingle.test(u)&&!reCh.test(u)){const e=emph(nx,u);if(e.caps||e.bold){text=text+': '+u;skip.add(nx)}}}}
    items.push({el:b,lv:1,text,smart:1});return}
   if(reKey.test(t)&&words<=5){items.push({el:b,lv:1,text:t,smart:1});return}
   if(m=t.match(reMulti)){if(words>18||sent)return;const e=emph(b,t);if(!(e.caps||e.bold||words<=12))return;items.push({el:b,lv:Math.min(6,m[1].split('.').length),text:t,smart:1});return}
   if(m=t.match(reSingle)){if(words>14||sent)return;const e=emph(b,t);if(!(e.caps||e.bold))return;const p=sib(b,-1),n=sib(b,1);
    if((isBlk(p)&&reSingle.test(txtOf(p)))||(isBlk(n)&&reSingle.test(txtOf(n))))return; /* consecutive 1. 2. 3. lines are a list, not headings */
    items.push({el:b,lv:1,text:t,smart:1});return}
   if(m=t.match(reLetter)){if(words>10||sent)return;const e=emph(b,t);if(!e.bold)return;const p=sib(b,-1),n=sib(b,1);
    if((isBlk(p)&&reLetter.test(txtOf(p)))||(isBlk(n)&&reLetter.test(txtOf(n))))return;items.push({el:b,lv:0,text:t,smart:1,letter:1});return}
   /* unnumbered titles: a short BOLD or ALL-CAPS line standing right above a body paragraph */
   if(!sent&&!/[:?!]$/.test(t)&&words<=10&&!/^(table|figure|fig\.?|plate|equation|eq\.?)\s*\d/i.test(t)&&!/^(table of )?contents?$/i.test(t)){
    const e=emph(b,t);if(e.caps||e.bold){const n=sib(b,1);if(isBlk(n)&&txtOf(n).split(' ').length>=20&&!reSingle.test(txtOf(n))&&!reMulti.test(txtOf(n)))items.push({el:b,lv:e.caps?1:2,text:t,smart:1,unn:1})}}})}
 items.sort((a,b)=>a.el.compareDocumentPosition(b.el)&4?-1:1);
 let prev=null,seen1=false;items.forEach(it=>{if(it.letter)it.lv=Math.min(6,(prev?prev.lv:1)+1);else{if(it.unn&&it.lv==2&&!seen1)it.lv=1;prev=it}if(it.lv==1)seen1=true});
 return items.filter(it=>it.lv<=lv)}
const headings=lv=>collect(lv,true).map(i=>i.el);
function pageOf(el){const PR=paper.getBoundingClientRect(),k=PR.width/paper.offsetWidth,H=dim()[1],r=el.getBoundingClientRect();return Math.max(0,Math.floor(((r.top-PR.top)/k+2)/H))}
const label=p=>(window.__pgLabels&&window.__pgLabels[p])||String(p+1);
const mk=(tag,cls)=>{const e=document.createElement(tag);e.className=cls;e.dataset.toc='1';e.contentEditable='false';return e};
function build(o,nums){const out=[],t=mk('p','toc-title');t.dataset.opts=JSON.stringify(o);t.dataset.kn='1';t.textContent=o.title||'Table of Contents';out.push(t);
 ed.querySelectorAll('[data-hlv]').forEach(e=>e.removeAttribute('data-hlv'));
 const hs=collect(o.levels,o.smart!==false);
 if(!hs.length){const e=mk('p','toc-e toc-empty');e.dataset.lv='1';e.textContent='No table of contents entries found. Apply Heading styles, or number your titles (CHAPTER ONE, 1.1, 1.1.1), then tap here and choose Update.';out.push(e)}
 hs.forEach(it=>{const h=it.el,id=h.dataset.hid||(h.dataset.hid='h'+(++uid)+Math.random().toString(36).slice(2,6)),lv=it.lv,e=mk('p','toc-e');if(it.smart)h.dataset.hlv=lv;
  e.dataset.t=id;e.dataset.lv=lv;e.dataset.leader=o.leader;e.style.marginLeft=((lv-1)*14.67)+'px';
  const s=document.createElement('span');s.className='toc-t';s.textContent=it.text;e.appendChild(s);
  if(o.nums){const d=document.createElement('span');d.className='toc-d';d.dataset.l=o.right?o.leader:'none';if(!o.right)d.classList.add('toc-gap');e.appendChild(d);
   const n=document.createElement('span');n.className='toc-n';n.textContent=nums[id]||'0';e.appendChild(n)}
  out.push(e)});
 return out}
function setNums(){let ch=false;tocEls().forEach(e=>{if(!e.dataset.t)return;const h=ed.querySelector('[data-hid="'+e.dataset.t+'"]'),n=e.querySelector('.toc-n');if(!h||!n)return;
 const lab=label(pageOf(h));if(n.textContent!==lab){n.textContent=lab;ch=true}});return ch}
const sig=o=>JSON.stringify(collect(o.levels,o.smart!==false).map(i=>[i.lv,i.text,label(pageOf(i.el))]));
function refresh(o,quiet){if(busy)return;busy=true;
 try{const old=tocEls(),nums={};old.forEach(e=>{if(e.dataset.t){const n=e.querySelector('.toc-n');if(n)nums[e.dataset.t]=n.textContent}});
  const els=build(o,nums);
  if(old.length){old[0].before(...els);old.forEach(e=>e.remove())}
  else{restore();const b=curBlock();if(b)b.after(...els);else ed.prepend(...els)}
  layout();for(let i=0;i<4;i++){if(!setNums())break;layout()}
  lastSig=sig(o);if(!quiet)toast('Table of contents updated')}
 finally{busy=false}}
/* keep page numbers right while the document changes */
const _layout=window.layout;
window.layout=function(){const r=_layout.apply(this,arguments);if(!busy&&tocEls().length){clearTimeout(timer);timer=setTimeout(()=>{const o=getOpts();if(o&&!busy&&sig(o)!==lastSig)refresh(o,true)},1300)}return r};
for(const n of['expDocx','expPdf']){const f=window[n];if(typeof f=='function')window[n]=async function(){const o=getOpts();if(o&&!busy)refresh(o,true);return f.apply(this,arguments)}}

/* ---------- dialog ---------- */
const dlg=document.createElement('div');dlg.id='tocdlg';
dlg.innerHTML=`<div class="card"><h3>Table of contents</h3>
<div class="pre"><button data-p="Contents"><b>Automatic Table 1</b><i>Contents</i><i>Heading 1<em>1</em></i><i>&nbsp;&nbsp;Heading 2<em>2</em></i></button><button data-p="Table of Contents"><b>Automatic Table 2</b><i>Table of Contents</i><i>Heading 1<em>1</em></i><i>&nbsp;&nbsp;Heading 2<em>2</em></i></button></div>
<label>Title<input type="text" id="toc-title"></label>
<label>Show levels<select id="toc-lv">${[1,2,3,4,5,6].map(n=>`<option>${n}</option>`).join('')}</select></label>
<label>Smart titles (CHAPTER, 1.1, 1.1.1)<input type="checkbox" id="toc-smart"></label>
<label>Show page numbers<input type="checkbox" id="toc-num"></label>
<label>Right-align page numbers<input type="checkbox" id="toc-right"></label>
<label>Tab leader<select id="toc-leader"><option value="dots">Dots ........</option><option value="dash">Dashes - - - -</option><option value="line">Line ________</option><option value="none">None</option></select></label>
<div class="btns"><button id="toc-x">Close</button><button id="toc-rm" class="dng">Remove</button><button id="toc-up">Update</button><button id="toc-ok" class="pri">Insert</button></div></div>`;
document.body.appendChild(dlg);
const f=id=>document.getElementById(id);
function fill(o){f('toc-title').value=o.title;f('toc-lv').value=o.levels;f('toc-num').checked=o.nums;f('toc-smart').checked=o.smart!==false;f('toc-right').checked=o.right;f('toc-leader').value=o.leader}
const read=()=>({title:f('toc-title').value.trim()||'Table of Contents',levels:+f('toc-lv').value,nums:f('toc-num').checked,smart:f('toc-smart').checked,right:f('toc-right').checked,leader:f('toc-leader').value});
function open(){const o=getOpts(),has=tocEls().length>0;fill(o||DEF);f('toc-rm').style.display=has?'':'none';f('toc-up').style.display=has?'':'none';f('toc-ok').textContent=has?'Apply':'Insert';dlg.classList.add('on')}
dlg.querySelectorAll('.pre button').forEach(b=>b.onclick=()=>{fill({...DEF,title:b.dataset.p});refresh(read());dlg.classList.remove('on')});
f('toc-ok').onclick=()=>{refresh(read());dlg.classList.remove('on')};
f('toc-up').onclick=()=>{refresh(read());dlg.classList.remove('on')};
f('toc-rm').onclick=()=>{tocEls().forEach(e=>e.remove());layout();dlg.classList.remove('on');toast('Table of contents removed')};
f('toc-x').onclick=()=>dlg.classList.remove('on');
dlg.addEventListener('mousedown',e=>{if(!/INPUT|SELECT/.test(e.target.tagName))e.preventDefault()});
/* tap an entry = jump to the heading (like a Word contents list), tap the title = options */
function goTo(en){let h=ed.querySelector('[data-hid="'+en.dataset.t+'"]');
 if(!h){const t=(en.querySelector('.toc-t')||en).textContent.trim();h=headings(6).find(x=>x.textContent.trim().replace(/\s+/g,' ')===t)}
 if(!h){toast('Heading not found – update the table');return}
 const w=document.getElementById('wrap');
 /* let the engine do the scrolling (correct under any zoom), then fine-tune until the heading sits at the top */
 h.scrollIntoView({block:'start',behavior:'auto'});
 let n=0,last=1e9;(function fix(){const d=h.getBoundingClientRect().top-w.getBoundingClientRect().top-18;if(Math.abs(d)>3&&Math.abs(d)<last&&n++<14){last=Math.abs(d);w.scrollTop+=d;requestAnimationFrame(fix)}})();
 h.classList.add('toc-flash');setTimeout(()=>h.classList.remove('toc-flash'),1500)}
let tap=null,lastGo=0;
const hit=e=>e.target.closest&&e.target.closest('.toc-e');
function act(e){const en=hit(e),ti=e.target.closest&&e.target.closest('.toc-title');
 if(ti){open();return true}
 if(en&&en.dataset.t){if(Date.now()-lastGo>400){lastGo=Date.now();goTo(en)}return true}
 if(en&&en.classList.contains('toc-empty')){open();return true}return false}
ed.addEventListener('pointerdown',e=>{tap=hit(e)||(e.target.closest&&e.target.closest('.toc-title'))?{x:e.clientX,y:e.clientY,t:Date.now()}:null});
ed.addEventListener('pointerup',e=>{if(!tap)return;const m=Math.hypot(e.clientX-tap.x,e.clientY-tap.y),d=Date.now()-tap.t;tap=null;if(m<12&&d<700)act(e)});
ed.addEventListener('click',e=>{act(e)});
/* Insert tab button + heading 4 in the style list */
const anchor=document.getElementById('iPaste')||document.getElementById('iBlank');
if(anchor){const b=document.createElement('button');b.id='iToc';b.title='Automatic table of contents';
 b.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 6h10M4 12h10M4 18h10M17 6h3M17 12h3M17 18h3"/></svg>Contents';anchor.after(b);b.onclick=open}
const blk=document.getElementById('blk');if(blk)['h4','h5','h6'].forEach(v=>{if(![...blk.options].some(o=>o.value==v))blk.add(new Option('Heading '+v[1],v))});
/* Word export: entries become paragraphs with a right tab + leader */
window.tocLinks=(pdf,p,H)=>{const PR=paper.getBoundingClientRect(),k=PR.width/paper.offsetWidth;
 tocEls().forEach(e=>{if(!e.dataset.t)return;const h=ed.querySelector('[data-hid="'+e.dataset.t+'"]');if(!h)return;const r=e.getBoundingClientRect(),y=(r.top-PR.top)/k;
  if(y<p*H||y>=(p+1)*H)return;try{pdf.link((r.left-PR.left)/k,y-p*H,r.width/k,r.height/k,{pageNumber:pageOf(h)+1})}catch(x){}})};
window.tocPara=c=>{const D=window.docx;
 if(c.classList.contains('toc-title'))return new D.Paragraph({children:[new D.TextRun({text:c.textContent.trim(),bold:true,size:32,color:'2F5496'})],spacing:{after:200}});
 const lv=+c.dataset.lv||1,t=c.querySelector('.toc-t'),n=c.querySelector('.toc-n'),txt=t?t.textContent:c.textContent;
 const anchor=c.dataset.t?'_Toc'+c.dataset.t:null,link=kids=>anchor?[new D.InternalHyperlink({anchor,children:kids})]:kids;
 const run=o=>new D.TextRun({style:'Hyperlink',...o});
 /* Word-native layout: the entries sit inside one TOC field (begin ... end), so Word / WPS / Polaris treat them as a real table of contents */
 const ents=tocEls().filter(e=>e.dataset.t),first=ents[0]===c,last=ents[ents.length-1]===c,o=getOpts()||DEF;
 const X=s=>{const c=D.ImportedXmlComponent.fromXmlString(s);return(c.root&&c.root[0])?c.root[0]:c};let head=[];
 if(first&&anchor){try{head=[X('<w:r><w:fldChar w:fldCharType="begin"/></w:r>'),X('<w:r><w:instrText xml:space="preserve"> TOC \\o "1-'+o.levels+'" \\h \\z \\u </w:instrText></w:r>'),X('<w:r><w:fldChar w:fldCharType="separate"/></w:r>')]}catch(e){head=[]}}
 let p;
 if(!n)p=new D.Paragraph({indent:{left:(lv-1)*220},spacing:{after:100},children:head.concat(link([run({text:txt})]))});
 else{
  const lead={dots:D.LeaderType.DOT,dash:D.LeaderType.HYPHEN,line:D.LeaderType.UNDERSCORE,none:D.LeaderType.NONE}[c.dataset.leader||'dots'];
  const right=c.querySelector('.toc-d')&&!c.querySelector('.toc-d').classList.contains('toc-gap');
  p=new D.Paragraph({indent:{left:(lv-1)*220},spacing:{after:100},tabStops:right?[{type:D.TabStopType.RIGHT,position:Math.round((paper.offsetWidth-mg.l-mg.r)*15),leader:lead}]:[],
   children:head.concat(link(right?[run({text:txt}),run({children:[new D.Tab(),n.textContent]})]:[run({text:txt+'  '+n.textContent})]))})}
 if(last&&anchor){try{return[p,new D.Paragraph({children:[X('<w:r><w:fldChar w:fldCharType="end"/></w:r>')]})]}catch(e){}}
 return p};
window.openToc=open;
})();
