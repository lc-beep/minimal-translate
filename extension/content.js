(() => {
  if (window.__minimalTranslate) return;
  let enabled = false, running = 0, timer;
  const items = new Set(), owners = new WeakSet(), queue = [];
  const own = '.minimal-translation, #minimal-translate-launcher';
  const skip = `pre,nav,header,footer,button,input,textarea,select,script,style,noscript,svg,math,[hidden],[aria-hidden="true"],[contenteditable]:not([contenteditable="false"]),[translate="no"],${own}`;
  const blocks = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,figcaption,div,section,article,main';
  const formats = new Set(['A', 'EM', 'STRONG', 'B', 'I', 'CODE', 'SUP', 'SUB', 'S', 'U']);

  // Isolate the launcher from site CSS; it never becomes translation input.
  const host = document.createElement('div');
  host.id = 'minimal-translate-launcher';
  host.setAttribute('translate', 'no');
  host.style.cssText = 'all:initial!important;position:fixed!important;right:16px!important;bottom:24%!important;z-index:2147483647!important;width:48px!important;height:48px!important;';
  const shadow = host.attachShadow({mode:'open'});
  const style = document.createElement('style');
  style.textContent = `:host{color-scheme:light}button{all:unset;box-sizing:border-box;display:grid;place-items:center;width:48px;height:48px;border:4px solid white;border-radius:50%;background:#e984a7;color:white;box-shadow:0 2px 14px #3d244a24;cursor:pointer;transition:transform .15s,background .15s}button:hover{transform:scale(1.06);background:#d96992}button:focus-visible{outline:3px solid #5764b5;outline-offset:3px}button[aria-pressed=true]{background:#bd527c}svg{width:30px;height:30px;pointer-events:none}.tip{position:absolute;right:58px;top:8px;background:#30333a;color:white;border-radius:6px;padding:5px 9px;font:13px/22px system-ui;white-space:nowrap;opacity:0;pointer-events:none}button:hover+.tip,button:focus-visible+.tip{opacity:1}@media(prefers-reduced-motion:reduce){button{transition:none}}`;
  const button = document.createElement('button');
  button.type = 'button';
  // Original vector mark, intentionally distinct from other extensions' logos.
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 32 32'); svg.setAttribute('aria-hidden','true');
  const path = document.createElementNS(svg.namespaceURI,'path');
  path.setAttribute('d','M4 8h15M11 4v4M7 9c1 5 5 9 11 11M16 9c-1 5-5 9-11 12M19 27l5-14 5 14M21 22h6');
  path.setAttribute('fill','none'); path.setAttribute('stroke','currentColor');
  path.setAttribute('stroke-width','2'); path.setAttribute('stroke-linecap','round'); path.setAttribute('stroke-linejoin','round');
  svg.append(path); button.append(svg);
  const tip = document.createElement('span'); tip.className = 'tip';
  shadow.append(style,button,tip); document.documentElement.append(host);
  function updateButton() {
    const label = enabled ? (running ? '简译 · 翻译中，点击隐藏' : '简译 · 隐藏译文') : '简译 · 翻译网页';
    button.setAttribute('aria-label',label); button.setAttribute('aria-pressed',String(enabled)); tip.textContent=label;
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      for (const item of items) if (item.el === entry.target) enqueue(item);
    }
    pump();
  }, {rootMargin:'240px'});
  function enqueue(item) {
    if (!item.done && !item.queued && !item.failed) { item.queued=true; queue.push(item); }
  }
  function isBlock(node) {
    return node.nodeType === 1 && (node.matches(blocks) || /^(block|flex|grid|table|list-item)/.test(getComputedStyle(node).display));
  }
  // Keep each paragraph inside its own width-constrained source element.
  // A pair of BRs is a paragraph boundary, including whitespace between BRs.
  function groups(el) {
    const result=[]; let current=[], breaks=[];
    const flush=()=>{if(current.length) result.push(current);current=[];breaks=[];};
    for(const node of el.childNodes) {
      if(node.nodeType===1 && (node.matches(own) || node.matches(skip))) { flush(); continue; }
      if(isBlock(node)) {flush();continue;}
      if(node.nodeName==='BR') {
        breaks.push(node); if(breaks.filter(n=>n.nodeName==='BR').length>=2) flush();
        continue;
      }
      if(breaks.length && node.nodeType===3 && !node.textContent.trim()){breaks.push(node);continue;}
      current.push(...breaks,node); breaks=[];
    }
    flush(); return result;
  }
  function serialize(nodes) {
    const marks=new Map(); let id=0;
    function visit(node) {
      if(node.nodeType===3) return node.textContent;
      if(node.nodeType!==1) return '';
      if(node.nodeName==='BR') return '\n';
      const text=[...node.childNodes].map(visit).join('');
      if(!formats.has(node.nodeName)) return text;
      const spec={tag:node.nodeName.toLowerCase()};
      if(spec.tag==='a') {
        try {const u=new URL(node.getAttribute('href'),location.href);if(!['http:','https:','mailto:'].includes(u.protocol))return text;spec.href=u.href;}catch{return text;}
      }
      const key=String(++id); marks.set(key,spec);
      return `[[JY${key}]]${text}[[/JY${key}]]`;
    }
    return {text:nodes.map(visit).join('').trim(),marks};
  }
  function scan() {
    for(const el of document.querySelectorAll(blocks)) {
      if(el.closest(skip)||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden')continue;
      for(const nodes of groups(el)) {
        if(nodes.some(n=>owners.has(n)))continue;
        const plain=nodes.map(n=>n.textContent).join('').trim();
        if(plain.length<3||plain.length>20000||!/[a-zA-Z\u00c0-\u024f\u4e00-\u9fff]/.test(plain))continue;
        const {text,marks}=serialize(nodes); if(text.length>24000)continue;
        const item={el,nodes,text,marks,anchor:nodes.at(-1)};
        nodes.forEach(n=>owners.add(n));items.add(item);observer.observe(el);
        const rect=el.getBoundingClientRect();if(rect.bottom>=-240&&rect.top<=innerHeight+240)enqueue(item);
      }
    }
    pump();
  }
  // Only our own numbered markers can create formatting. Never parse model HTML.
  function translatedNodes(item,text) {
    const fragment=document.createDocumentFragment(),stack=[{node:fragment,id:null}],used=new Set();
    const tokens=text.split(/(\[\[\/?JY\d+\]\])/g);let valid=true;
    for(const token of tokens) {
      const match=token.match(/^\[\[(\/?)JY(\d+)\]\]$/);
      if(!match){stack.at(-1).node.append(document.createTextNode(token));continue;}
      const [,close,id]=match,spec=item.marks.get(id);
      if(!spec){valid=false;break;}
      if(close){if(stack.length===1||stack.at(-1).id!==id){valid=false;break;}stack.pop();}
      else {
        if(used.has(id)){valid=false;break;}used.add(id);
        const el=document.createElement(spec.tag);
        if(spec.href){el.href=spec.href;el.rel='noopener noreferrer';el.style.textDecoration='underline';el.style.textUnderlineOffset='.12em';}
        stack.at(-1).node.append(el);stack.push({node:el,id});
      }
    }
    if(!valid||stack.length!==1||used.size!==item.marks.size) return document.createTextNode(text.replace(/\[\[\/?JY\d+\]\]/g,''));
    return fragment;
  }
  function render(item,text,{retry,translated=false}={}) {
    if(!item.anchor.isConnected)return;
    if(!item.node) {
      item.node=document.createElement('span');item.node.className='minimal-translation';item.node.setAttribute('translate','no');
      // Span is legal inside P/LI/TD. Inherit the source typography and width.
      const styles={all:'unset',display:'block','box-sizing':'border-box',width:'auto','max-width':'100%','margin-block-start':'.65em','margin-block-end':'0',padding:'0',border:'0',font:'inherit',color:'inherit','line-height':'1.75','text-align':'inherit','letter-spacing':'normal','white-space':'pre-wrap','overflow-wrap':'anywhere','text-indent':'0'};
      for(const [key,value] of Object.entries(styles))item.node.style.setProperty(key,value,'important');
      item.anchor.after(item.node);
    }
    item.node.replaceChildren(translated?translatedNodes(item,text):document.createTextNode(text));
    item.node.style.setProperty('display',enabled?'block':'none','important');
    item.node.style.setProperty('opacity',translated?'1':'.6','important');
    item.node.style.setProperty('font-size',translated?'1em':'.75em','important');
    item.node.removeAttribute('role');item.node.removeAttribute('tabindex');item.node.onclick=null;item.node.onkeydown=null;
    if(retry){item.node.setAttribute('role','button');item.node.tabIndex=0;item.node.onclick=retry;item.node.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();retry();}};}
  }
  function pump() {
    while(enabled&&running<2&&queue.length) {
      const item=queue.shift();
      if(!item.anchor.isConnected){item.queued=false;continue;}
      running++;render(item,'翻译中…');updateButton();
      Promise.resolve().then(()=>chrome.runtime.sendMessage({type:'translate',text:item.text,inlineMarkup:item.marks.size>0})).then(r=>{
        if(r.error)throw Error(r.error);item.done=true;render(item,r.text,{translated:true});
      }).catch(e=>{
        item.failed=true;
        render(item,e.message+' · 点击重试',{retry:()=>{if(!item.queued){item.failed=false;enqueue(item);pump();}}});
      }).finally(()=>{running--;item.queued=false;updateButton();pump();});
    }
  }
  const mutations=new MutationObserver(records=>{
    for(const item of items)if(!item.anchor.isConnected){item.node?.remove();items.delete(item);}
    const relevant=records.some(r=>!r.target.closest?.(own)&&[...r.addedNodes].some(n=>n.nodeType===1&&!n.matches(own)));
    if(enabled&&relevant){clearTimeout(timer);timer=setTimeout(scan,350);}
  });
  mutations.observe(document.body,{childList:true,subtree:true});
  function toggle(){
    enabled=!enabled;
    for(const item of items)if(item.node)item.node.style.setProperty('display',enabled?'block':'none','important');
    updateButton();if(enabled)scan();
  }
  button.onclick=toggle;
  window.__minimalTranslate={toggle};updateButton();
})();
