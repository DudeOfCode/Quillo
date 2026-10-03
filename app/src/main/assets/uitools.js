/* Quillo UI tools: floating text menu (cut/copy/paste/select/format) + status panel that appears only when needed */
(function(){
/* ---------- keep the selection alive while using ribbon controls ---------- */
const rb=document.getElementById('ribbon');
rb.addEventListener('pointerdown',e=>{if(/SELECT|INPUT/.test(e.target.tagName))window.__selFrozen=true},true);
const thaw=()=>setTimeout(()=>{window.__selFrozen=false},450);
rb.addEventListener('change',thaw,true);rb.addEventListener('focusout',thaw,true);
document.addEventListener('selectionchange',()=>{ /* focus left the editor and the browser collapsed the selection: keep the saved one */
 const s=getSelection();if(window.__selFrozen||document.activeElement===ed)return;if(saved&&!saved.collapsed&&(!s.rangeCount||s.isCollapsed))window.__selFrozen=true},true);
ed.addEventListener('pointerdown',e=>{if(e.isTrusted)window.__selFrozen=false});
/* ---------- text menu ---------- */
const IC={cut:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',paste:'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>',all:'<path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3"/><rect x="8" y="8" width="8" height="8" rx="1"/>',more:'<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',page:'<path d="M6 3h9l3 3v15H6z"/><path d="M9 12h6M9 16h6"/>',sec:'<path d="M4 6h16M4 18h16"/><path d="M4 12h16" stroke-dasharray="3 3"/>',b:'<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',i:'<path d="M10 5h8M6 19h8M14 5 10 19"/>',u:'<path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14"/>',hl:'<path d="m4 16 8-8 4 4-8 8H4zM14 6l2-2 4 4-2 2"/>',al:'<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',ac:'<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',ar:'<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',aj:'<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>'};
const BT=[['cut','Cut','s'],['copy','Copy','s'],['paste','Paste','b'],['all','Select all','b'],['more','More','s'],
 ['page','Select page','x'],['sec','Select section','x'],['b','Bold','x'],['i','Italic','x'],['u','Underline','x'],
 ['al','Left','x'],['ac','Centre','x'],['ar','Right','x'],['aj','Justify','x'],['hl','Highlight','x']];
const st=document.createElement('style');st.textContent=`#tmenu{position:fixed;z-index:45;display:none;background:#2f3135;color:#fff;border-radius:18px;padding:6px 8px;box-shadow:0 10px 30px #0009;grid-template-columns:repeat(5,64px);gap:2px 0;transition:opacity .12s}
#tmenu.on{display:grid}#tmenu button{background:none;border:0;color:#fff;display:flex;flex-direction:column;align-items:center;gap:4px;font:12px system-ui,sans-serif;padding:8px 2px;border-radius:10px}
#tmenu button svg{width:22px;height:22px;stroke:#fff;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}#tmenu button:active{background:#ffffff26}
#tmenu [data-m=x]{display:none}#tmenu.more [data-m=x]{display:flex}#tmenu.caret [data-m=s]{display:none}#tmenu.caret [data-m=x]{display:none}#tmenu.caret.more [data-m=x]{display:none}
#tmenu.caret{grid-template-columns:repeat(4,70px)}#tmenu.caret [data-a=page],#tmenu.caret [data-a=sec]{display:flex}
#stage{order:1;flex:1;min-height:0;position:relative;display:flex;flex-direction:column}#stage #wrap{flex:1;min-height:0;order:0}
#st{position:absolute!important;left:10px;right:10px;bottom:10px;order:unset!important;border:1px solid var(--line)!important;border-radius:18px;box-shadow:0 10px 28px rgba(20,30,60,.22);flex-wrap:wrap;transform:translateY(130%);opacity:0;pointer-events:none;transition:transform .22s ease,opacity .18s;display:flex!important;z-index:6}
#st.show{transform:none;opacity:1;pointer-events:auto}body.kb-open #st{display:flex!important}
#pgchip{position:absolute;right:12px;bottom:12px;background:rgba(28,32,42,.9);color:#fff;border-radius:999px;padding:7px 14px;font:600 12px system-ui,sans-serif;opacity:0;transform:translateY(10px);transition:opacity .18s,transform .18s;pointer-events:none;z-index:6;box-shadow:0 4px 14px #0005}
#pgchip.show{opacity:1;transform:none;pointer-events:auto}`;document.head.appendChild(st);
const m=document.createElement('div');m.id='tmenu';
m.innerHTML=BT.map(([a,l,md])=>`<button data-a="${a}" data-m="${md=='b'?'s':md}"><svg viewBox="0 0 24 24">${IC[a]}</svg><span>${l}</span></button>`).join('');
document.body.appendChild(m);
m.querySelectorAll('[data-a=paste],[data-a=all],[data-a=page],[data-a=sec]').forEach(b=>b.dataset.m='both');
const css=document.createElement('style');css.textContent='#tmenu [data-m=both]{display:flex!important}';document.head.appendChild(css);
let mode=null,vis=false;
const R=()=>window.__selFrozen&&window.__keepSel&&saved&&saved.collapsed?window.__keepSel:saved;
function rangeRect(r){let b=r.getClientRects();b=b.length?b[0]:r.getBoundingClientRect();const all=r.getBoundingClientRect();return{top:b.top,bottom:(r.getClientRects().length?[...r.getClientRects()].pop().bottom:all.bottom),left:all.left,right:all.right,w:all.width}}
function want(){if(document.getElementById('isel')&&document.getElementById('isel').classList.contains('on'))return null;
 if(document.getElementById('iedit')&&document.getElementById('iedit').classList.contains('on'))return null;
 const r=R();if(!r||!ed.contains(r.commonAncestorContainer))return null;
 const focused=document.activeElement===ed||window.__selFrozen;
 if(!r.collapsed&&focused)return'sel';if(r.collapsed&&caretOn&&document.activeElement===ed)return'caret';return null}
let caretOn=false,lastKey='';
function place(){const md=want();
 if(!md){if(vis){m.classList.remove('on');vis=false;mode=null}return}
 if(!vis||mode!==md){m.classList.add('on');m.classList.toggle('caret',md=='caret');if(md=='caret')m.classList.remove('more');mode=md;vis=true;lastKey=''}
 const r=R(),rc=rangeRect(r),key=[rc.top,rc.bottom,rc.left,rc.right,innerHeight,m.className].join();if(key===lastKey)return;lastKey=key;
 const mw=m.offsetWidth,mh=m.offsetHeight,topLim=document.getElementById('top').getBoundingClientRect().bottom+6;
 const dockEl=(!rb.classList.contains('collapsed')?rb:document.getElementById('tabs')),botLim=dockEl.getBoundingClientRect().top-6;
 let top=rc.top-mh-14;if(top<topLim)top=rc.bottom+(md=='sel'?40:14);if(top+mh>botLim)top=Math.max(topLim,Math.min(botLim-mh,(topLim+botLim)/2-mh/2));
 m.style.top=top+'px';m.style.left=Math.max(6,Math.min(innerWidth-mw-6,(rc.left+rc.right)/2-mw/2))+'px'}
(function loop(){place();requestAnimationFrame(loop)})();
/* caret menu: tap on the caret again */
let lastTap=null;
ed.addEventListener('pointerup',e=>{if(e.pointerType=='mouse'&&e.button!=0)return;setTimeout(()=>{const s=getSelection();if(!s.rangeCount||!s.isCollapsed){caretOn=false;return}
 const r=s.getRangeAt(0),c=r.getClientRects()[0]||r.getBoundingClientRect(),near=lastTap&&Math.abs(e.clientX-lastTap.x)<28&&Math.abs(e.clientY-lastTap.y)<28&&Date.now()-lastTap.t<5000;
 caretOn=!!near&&!caretOn?true:false;lastTap={x:e.clientX,y:e.clientY,t:Date.now()};
 if(caretOn&&!(Math.abs(e.clientX-c.left)<40))caretOn=false},30)});
ed.addEventListener('input',()=>{caretOn=false});
m.addEventListener('mousedown',e=>e.preventDefault());
/* helpers */
const kids=()=>[...ed.children].filter(b=>!b.classList.contains('sb')&&!b.classList.contains('pb'));
function selectBlocks(a,b){if(!a||!b)return toast('Nothing to select');const g=document.createRange();g.setStartBefore(a);g.setEndAfter(b);const s=getSelection();ed.focus();s.removeAllRanges();s.addRange(g);saved=g.cloneRange()}
function selPage(){restore();const PR=paper.getBoundingClientRect(),k=PR.width/paper.offsetWidth,H=dim()[1],r=R()||saved,y=((r.getClientRects()[0]||r.getBoundingClientRect()).top-PR.top)/k,p=Math.max(0,Math.floor(y/H));
 const inP=kids().filter(b=>{const q=b.getBoundingClientRect(),t=(q.top-PR.top)/k,bt=(q.bottom-PR.top)/k;return bt>p*H+mg.t&&t<(p+1)*H-mg.b});selectBlocks(inP[0],inP[inP.length-1]);toast('Page '+(p+1)+' selected')}
function selSection(){restore();const i=secIdx(),sb=sbs(),a=i==0?ed.firstElementChild:sb[i-1].nextElementSibling,b=sb[i]?sb[i].previousElementSibling:ed.lastElementChild;selectBlocks(a,b);toast('Section '+(i+1)+' selected')}
async function paste(){try{const t=await navigator.clipboard.readText();restore();document.execCommand('insertText',false,t);sync()}catch(e){toast('Clipboard blocked – allow paste or use the keyboard')}}
m.addEventListener('click',e=>{const a=e.target.closest('button')?.dataset.a;if(!a)return;
 if(a=='more'){m.classList.toggle('more');lastKey='';m.querySelector('[data-a=more] span').textContent=m.classList.contains('more')?'Less':'More';return}
 if(a=='all'){restore();document.execCommand('selectAll');caretOn=false;return}
 if(a=='page'){selPage();caretOn=false;return}if(a=='sec'){selSection();caretOn=false;return}
 if(a=='paste'){paste();caretOn=false;return}
 restore();
 if(a=='copy'){document.execCommand('copy');toast('Copied');return}
 if(a=='cut'){document.execCommand('cut');sync();return}
 const cmd={b:'bold',i:'italic',u:'underline',al:'justifyLeft',ac:'justifyCenter',ar:'justifyRight',aj:'justifyFull'}[a];
 if(cmd){document.execCommand(cmd);sync();return}
 if(a=='hl'){window.toggleHL();return}});
/* ---------- status panel: shown only on demand / while scrolling or zooming ---------- */
const wrap=document.getElementById('wrap'),panel=document.getElementById('st');
const stage=document.createElement('div');stage.id='stage';wrap.before(stage);stage.append(wrap,panel);
const chip=document.createElement('div');chip.id='pgchip';stage.appendChild(chip);
let ht,hp;
function chipText(){const wr=wrap.getBoundingClientRect(),PR=paper.getBoundingClientRect(),k=PR.width/paper.offsetWidth,H=dim()[1],n=+paper.dataset.pages||1,y=(wr.top+wr.height*.4-PR.top)/k;
 return'Page '+Math.max(1,Math.min(n,Math.floor(y/H)+1))+' of '+n+'  ·  '+Math.round(z/ZK*100)+'%'}
function activity(){if(panel.classList.contains('show'))return;chip.textContent=chipText();chip.classList.add('show');clearTimeout(ht);ht=setTimeout(()=>chip.classList.remove('show'),1400)}
['scroll','touchmove','wheel'].forEach(t=>wrap.addEventListener(t,activity,{passive:true}));
const sz=window.setZ;if(typeof sz=='function')window.setZ=function(v){sz(v);activity()};
function arm(){clearTimeout(hp);hp=setTimeout(()=>{if(!panel.contains(document.activeElement))panel.classList.remove('show')},5000)}
chip.onclick=()=>{panel.classList.add('show');chip.classList.remove('show');arm()};
panel.addEventListener('pointerdown',arm);panel.addEventListener('change',()=>{arm();activity()});
wrap.addEventListener('pointerdown',()=>panel.classList.remove('show'));
document.getElementById('zm').addEventListener('change',()=>{panel.classList.contains('show')||activity()});
setTimeout(activity,900);
})();

/* ===== v3: keep selection when tapping the dock, keyboard button, movable table ===== */
(function(){
const $=s=>document.querySelector(s);
/* 1) tapping anywhere in the ribbon / tab bar / top bar never steals focus from the document */
const guard=e=>{const t=e.target;if(/^(SELECT|INPUT|TEXTAREA|OPTION)$/.test(t.tagName))return;e.preventDefault()};
['#ribbon','#tabs','#top','#st','#pgchip'].forEach(s=>{const el=$(s);if(el)el.addEventListener('mousedown',guard,true)});
['#st','#top'].forEach(s=>{const el=$(s);if(el)el.addEventListener('pointerdown',e=>{if(/SELECT|INPUT/.test(e.target.tagName))window.__selFrozen=true},true)});
/* keep the highlight visible even while a drop-down / colour picker has the focus */
const sty=document.createElement('style');sty.textContent='::highlight(qsel){background-color:rgba(47,111,237,.38)}#kbBtn.kbon{background:var(--active)}.th.c{touch-action:none}#tghost{position:fixed;z-index:70;pointer-events:none;border:2px dashed #2f6fed;background:rgba(47,111,237,.14);border-radius:4px;display:none}#tins{position:fixed;z-index:70;pointer-events:none;height:4px;border-radius:2px;background:#2f6fed;display:none;box-shadow:0 0 8px #2f6fed99}';document.head.appendChild(sty);
let hl=null;if(window.CSS&&CSS.highlights&&window.Highlight){hl=new Highlight();CSS.highlights.set('qsel',hl)}
const showHL=()=>{if(!hl)return;hl.clear();if(saved&&!saved.collapsed&&ed.contains(saved.commonAncestorContainer)&&document.activeElement!==ed)hl.add(saved)},clrHL=()=>hl&&hl.clear();
ed.addEventListener('blur',()=>setTimeout(showHL,30));ed.addEventListener('focus',clrHL);
document.addEventListener('selectionchange',()=>{if(document.activeElement===ed)clrHL()});
['#ribbon','#st','#top'].forEach(s=>{const el=$(s);if(el)el.addEventListener('pointerdown',e=>{if(/SELECT|INPUT/.test(e.target.tagName))setTimeout(showHL,40)},true)});
/* 2) keyboard show / hide button next to "Page" */
const tabs=$('#tabs'),kb=document.createElement('button');kb.id='kbBtn';kb.title='Show / hide the keyboard';
kb.innerHTML='<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7.5 14h9"/></svg>Keyboard';tabs.appendChild(kb);
let maxH=innerHeight;
const isOpen=()=>{if(window.AndroidSaver&&window.__kb!==undefined)return !!window.__kb;maxH=Math.max(maxH,innerHeight);return document.body.classList.contains('kb-open')||innerHeight<maxH-140};
const upd=()=>kb.classList.toggle('kbon',isOpen());addEventListener('resize',upd);addEventListener('kbchange',upd);setInterval(upd,500);
kb.onclick=()=>{
 if(isOpen()){ /* keyboard is up -> hide it (the document keeps its selection) */
  if(window.AndroidSaver&&AndroidSaver.hideKeyboard)AndroidSaver.hideKeyboard();else if(document.activeElement)document.activeElement.blur();
 }else{ /* keyboard is down -> bring the cursor back into the document and show it */
  restore();ed.focus();if(window.AndroidSaver&&AndroidSaver.showKeyboard)AndroidSaver.showKeyboard();
 }
 setTimeout(upd,350)};
/* 3) the four-arrow handle selects the table (tap) or moves it (drag) */
const tov=$('#tov'),gh=document.createElement('div'),ins=document.createElement('div');gh.id='tghost';ins.id='tins';document.body.append(gh,ins);
const _u=window.updOv;if(typeof _u=='function')window.updOv=function(){if(window.__tdrag||window.__ovPress)return;_u()};
let d=null,moved=false,timer=null,ovT;
/* the overlay is rebuilt on mouseup, which used to swallow taps on its buttons: freeze it from press until the click has landed */
tov.addEventListener('pointerdown',()=>{window.__ovPress=true;clearTimeout(ovT);ovT=setTimeout(()=>{window.__ovPress=false;updOv()},700)},true);
tov.addEventListener('click',()=>{clearTimeout(ovT);setTimeout(()=>{window.__ovPress=false;updOv()},0)},true);
const kk=()=>paper.getBoundingClientRect().width/paper.offsetWidth;
function target(){const bl=[...ed.children].filter(b=>b!==d.t&&!b.classList.contains('pgbrk'));let ref=null;
 for(const b of bl){const r=b.getBoundingClientRect();if(d.y<r.top+r.height/2){ref=b;break}}return{ref,bl}}
function update(){const r=d.rect,dx=d.x-d.x0,dy=d.y-d.y0,k=kk(),PR=paper.getBoundingClientRect();
 Object.assign(gh.style,{left:r.left+dx+'px',top:r.top+dy+'px',width:r.width+'px',height:Math.min(r.height,180)+'px'});
 const{ref,bl}=target();let y=0;if(ref)y=ref.getBoundingClientRect().top;else{const l=bl[bl.length-1];y=l?l.getBoundingClientRect().bottom:PR.top}
 d.ml=Math.max(0,Math.min(paper.offsetWidth-mg.l-mg.r-d.t.offsetWidth,d.ml0+dx/k));d.ref=ref;
 Object.assign(ins.style,{left:PR.left+(mg.l+d.ml)*k+'px',top:y-2+'px',width:Math.max(30,d.t.offsetWidth*k)+'px'})}
tov.addEventListener('pointerdown',e=>{if(!e.target.closest('.th.c'))return;const t=tbl();if(!t)return;window.__tdrag=true;
 d={id:e.pointerId,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,t,ml0:parseFloat(getComputedStyle(t).marginLeft)||0,active:false};moved=false});
document.addEventListener('pointermove',e=>{if(!d||e.pointerId!==d.id)return;d.x=e.clientX;d.y=e.clientY;
 if(!d.active){if(Math.hypot(d.x-d.x0,d.y-d.y0)<10)return;
  if(d.t.parentElement!==ed){toast('Only top-level tables can be moved');d=null;window.__tdrag=false;return}
  d.active=moved=true;d.rect=d.t.getBoundingClientRect();tov.style.visibility='hidden';gh.style.display=ins.style.display='block';
  timer=setInterval(()=>{const w=$('#wrap'),wr=w.getBoundingClientRect();if(d.y<wr.top+70)w.scrollTop-=14;else if(d.y>wr.bottom-70)w.scrollTop+=14;update()},40)}
 e.preventDefault();update()},{passive:false});
function end(e){if(!d||(e&&e.pointerId!==d.id))return;clearInterval(timer);const D=d;d=null;gh.style.display=ins.style.display='none';tov.style.visibility='';window.__tdrag=false;
 if(!D.active)return;
 const t=D.t;D.ref?ed.insertBefore(t,D.ref):ed.appendChild(t);t.style.marginLeft=D.ml>2?Math.round(D.ml)+'px':'';
 if(!t.nextElementSibling||t.nextElementSibling.tagName=='TABLE'){const p=document.createElement('p');p.innerHTML='<br>';t.after(p)}
 window.__ovPress=false;clearTimeout(ovT);sync();setTimeout(()=>{updOv();toast('Table moved')},80)}
document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
tov.addEventListener('click',e=>{if(moved){e.stopPropagation();e.preventDefault();moved=false}},true);

/* highlight: tap = apply, tap again = remove */
const hasHL=n=>{let el=n.parentElement;while(el&&el!==ed&&!/^(P|DIV|H[1-6]|LI|TD|TH|BLOCKQUOTE|TABLE|TR)$/.test(el.tagName)){const bg=getComputedStyle(el).backgroundColor;if(bg&&bg!=='transparent'&&!/rgba\(\s*0,\s*0,\s*0,\s*0\)/.test(bg))return true;el=el.parentElement}return false};
window.toggleHL=function(){restore();const r=saved;if(!r||r.collapsed){toast('Select some text first');return}
 const col=($('#hc')&&$('#hc').value)||'#ffff00',root=r.commonAncestorContainer.nodeType==3?r.commonAncestorContainer.parentNode:r.commonAncestorContainer,tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let any=false,all=true,n;while(n=tw.nextNode()){if(!r.intersectsNode(n))continue;let s0=0,e0=n.length;if(n===r.startContainer)s0=r.startOffset;if(n===r.endContainer)e0=r.endOffset;if(!n.textContent.slice(s0,e0).trim())continue;any=true;if(!hasHL(n))all=false}
 document.execCommand('styleWithCSS',false,true);document.execCommand('hiliteColor',false,(any&&all)?'transparent':col);sync()};
const hc=$('#hc');if(hc){const b=document.createElement('button');b.id='hlBtn';b.title='Highlight – tap again to remove';
 b.innerHTML='<svg viewBox="0 0 24 24"><path d="m4 16 8-8 4 4-8 8H4zM14 6l2-2 4 4-2 2"/></svg>';hc.before(b);b.onclick=()=>window.toggleHL()}
})();
