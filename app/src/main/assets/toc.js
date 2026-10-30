/* Quillo – automatic table of contents (like Word / WPS "Automatic Table")
   Built from Heading 1-6 paragraphs; entries have dot leaders and right-aligned page numbers that follow the
   page numbering of each section (1,2,3 / i,ii,iii / I,II,III). Tap an entry to jump, tap the title to edit. */
(function(){
const $=s=>document.querySelector(s);
const DEF={title:'Table of Contents',levels:3,nums:true,right:true,leader:'dots'};
let busy=false,lastSig='',uid=0,timer=null;
const css=document.createElement('style');css.textContent=`
#ed p.toc-title{margin:0;padding:0 0 8px;font:700 21.33px/1.25 Calibri,Carlito,sans-serif;color:#2f5496;user-select:none;cursor:pointer;text-align:left;text-indent:0}
#ed p.toc-e{margin-right:0;padding:0 0 6.67px;display:flex;align-items:baseline;font:14.67px/1.3 Calibri,Carlito,sans-serif;color:#000;user-select:none;cursor:pointer;white-space:normal;text-align:left;text-indent:0;margin-top:0;margin-bottom:0}
.toc-t{flex:0 1 auto;min-width:0}.toc-n{flex:none}
.toc-d{flex:1 1 24px;min-width:18px;margin:0 4px;align-self:baseline;height:0;border-bottom:1.5px dotted #222}
.toc-d[data-l=dash]{border-bottom:1.5px dashed #222}.toc-d[data-l=line]{border-bottom:1px solid #222}.toc-d[data-l=none]{border-bottom:0}.toc-d.toc-gap{flex:0 0 12px}
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
const headings=lv=>[...ed.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h=>!h.closest('[data-toc]')&&!h.dataset.notoc&&+h.tagName[1]<=lv&&h.textContent.trim());
function pageOf(el){const PR=paper.getBoundingClientRect(),k=PR.width/paper.offsetWidth,H=dim()[1],r=el.getBoundingClientRect();return Math.max(0,Math.floor(((r.top-PR.top)/k+2)/H))}
const label=p=>(window.__pgLabels&&window.__pgLabels[p])||String(p+1);
const mk=(tag,cls)=>{const e=document.createElement(tag);e.className=cls;e.dataset.toc='1';e.contentEditable='false';return e};
function build(o,nums){const out=[],t=mk('p','toc-title');t.dataset.opts=JSON.stringify(o);t.dataset.kn='1';t.textContent=o.title||'Table of Contents';out.push(t);
 const hs=headings(o.levels);
 if(!hs.length){const e=mk('p','toc-e toc-empty');e.dataset.lv='1';e.textContent='No table of contents entries found. Apply Heading 1–3 styles to your titles, then tap here and choose Update.';out.push(e)}
 hs.forEach(h=>{const id=h.dataset.hid||(h.dataset.hid='h'+(++uid)+Math.random().toString(36).slice(2,6)),lv=+h.tagName[1],e=mk('p','toc-e');
  e.dataset.t=id;e.dataset.lv=lv;e.dataset.leader=o.leader;e.style.marginLeft=((lv-1)*14.67)+'px';
  const s=document.createElement('span');s.className='toc-t';s.textContent=h.textContent.trim().replace(/\s+/g,' ');e.appendChild(s);
  if(o.nums){const d=document.createElement('span');d.className='toc-d';d.dataset.l=o.right?o.leader:'none';if(!o.right)d.classList.add('toc-gap');e.appendChild(d);
   const n=document.createElement('span');n.className='toc-n';n.textContent=nums[id]||'0';e.appendChild(n)}
  out.push(e)});
 return out}
function setNums(){let ch=false;tocEls().forEach(e=>{if(!e.dataset.t)return;const h=ed.querySelector('[data-hid="'+e.dataset.t+'"]'),n=e.querySelector('.toc-n');if(!h||!n)return;
 const lab=label(pageOf(h));if(n.textContent!==lab){n.textContent=lab;ch=true}});return ch}
const sig=o=>JSON.stringify(headings(o.levels).map(h=>[h.tagName,h.textContent.trim(),label(pageOf(h))]));
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
<label>Show page numbers<input type="checkbox" id="toc-num"></label>
<label>Right-align page numbers<input type="checkbox" id="toc-right"></label>
<label>Tab leader<select id="toc-leader"><option value="dots">Dots ........</option><option value="dash">Dashes - - - -</option><option value="line">Line ________</option><option value="none">None</option></select></label>
<div class="btns"><button id="toc-x">Close</button><button id="toc-rm" class="dng">Remove</button><button id="toc-up">Update</button><button id="toc-ok" class="pri">Insert</button></div></div>`;
document.body.appendChild(dlg);
const f=id=>document.getElementById(id);
function fill(o){f('toc-title').value=o.title;f('toc-lv').value=o.levels;f('toc-num').checked=o.nums;f('toc-right').checked=o.right;f('toc-leader').value=o.leader}
const read=()=>({title:f('toc-title').value.trim()||'Table of Contents',levels:+f('toc-lv').value,nums:f('toc-num').checked,right:f('toc-right').checked,leader:f('toc-leader').value});
function open(){const o=getOpts(),has=tocEls().length>0;fill(o||DEF);f('toc-rm').style.display=has?'':'none';f('toc-up').style.display=has?'':'none';f('toc-ok').textContent=has?'Apply':'Insert';dlg.classList.add('on')}
dlg.querySelectorAll('.pre button').forEach(b=>b.onclick=()=>{fill({...DEF,title:b.dataset.p});refresh(read());dlg.classList.remove('on')});
f('toc-ok').onclick=()=>{refresh(read());dlg.classList.remove('on')};
f('toc-up').onclick=()=>{refresh(read());dlg.classList.remove('on')};
f('toc-rm').onclick=()=>{tocEls().forEach(e=>e.remove());layout();dlg.classList.remove('on');toast('Table of contents removed')};
f('toc-x').onclick=()=>dlg.classList.remove('on');
dlg.addEventListener('mousedown',e=>{if(!/INPUT|SELECT/.test(e.target.tagName))e.preventDefault()});
/* tap an entry = jump to the heading, tap the title = options */
ed.addEventListener('click',e=>{const en=e.target.closest&&e.target.closest('.toc-e'),ti=e.target.closest&&e.target.closest('.toc-title');
 if(ti){open();return}
 if(en&&en.dataset.t){const h=ed.querySelector('[data-hid="'+en.dataset.t+'"]');if(h)h.scrollIntoView({block:'start',behavior:'smooth'});return}
 if(en&&en.classList.contains('toc-empty'))open()});
/* Insert tab button + heading 4 in the style list */
const anchor=document.getElementById('iPaste')||document.getElementById('iBlank');
if(anchor){const b=document.createElement('button');b.id='iToc';b.title='Automatic table of contents';
 b.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 6h10M4 12h10M4 18h10M17 6h3M17 12h3M17 18h3"/></svg>Contents';anchor.after(b);b.onclick=open}
const blk=document.getElementById('blk');if(blk&&![...blk.options].some(o=>o.value=='h4'))blk.add(new Option('Heading 4','h4'));
/* Word export: entries become paragraphs with a right tab + leader */
window.tocPara=c=>{const D=window.docx;
 if(c.classList.contains('toc-title'))return new D.Paragraph({children:[new D.TextRun({text:c.textContent.trim(),bold:true,size:32,color:'2F5496'})],spacing:{after:200}});
 const lv=+c.dataset.lv||1,t=c.querySelector('.toc-t'),n=c.querySelector('.toc-n'),txt=t?t.textContent:c.textContent;
 if(!n)return new D.Paragraph({indent:{left:(lv-1)*220},spacing:{after:100},children:[new D.TextRun({text:txt})]});
 const lead={dots:D.LeaderType.DOT,dash:D.LeaderType.HYPHEN,line:D.LeaderType.UNDERSCORE,none:D.LeaderType.NONE}[c.dataset.leader||'dots'];
 const right=c.querySelector('.toc-d')&&!c.querySelector('.toc-d').classList.contains('toc-gap');
 return new D.Paragraph({indent:{left:(lv-1)*220},spacing:{after:100},tabStops:right?[{type:D.TabStopType.RIGHT,position:Math.round((paper.offsetWidth-mg.l-mg.r)*15),leader:lead}]:[],
  children:right?[new D.TextRun({text:txt}),new D.TextRun({children:[new D.Tab(),n.textContent]})]:[new D.TextRun({text:txt+'  '+n.textContent})]})};
window.openToc=open;
})();
