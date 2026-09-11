(() => {
  if (window.__minimalTranslate) return;
  let enabled = false, running = 0, timer, routeTimer, destroyed=false;
  let route = location.href;
  const items = new Set(), queue = [], dirty = new Set();
  const byFirstNode = new WeakMap();
  const own = '.minimal-translation, #minimal-translate-launcher';
  const skip = `pre,nav,footer,form,button,input,textarea,select,script,style,noscript,svg,math,canvas,iframe,[inert],[hidden],[aria-hidden="true"],[contenteditable]:not([contenteditable="false"]),[translate="no"],[role="navigation"],[role="menu"],[role="menubar"],[role="toolbar"],[role="tablist"],[role="button"],[role="textbox"],[role="searchbox"],[role="combobox"],[role="dialog"],${own}`;
  const semantic = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,dt,dd,figcaption,[role="paragraph"],[role="heading"]';
  const reading = 'main,article,[role="main"],[role="article"]';
  const formats = new Set(['A', 'EM', 'STRONG', 'B', 'I', 'CODE', 'SUP', 'SUB', 'S', 'U']);

  // Isolate the launcher from site CSS; it never becomes translation input.
  const host = document.createElement('div');
  host.id = 'minimal-translate-launcher';
  host.setAttribute('translate', 'no');
  host.style.cssText = 'all:initial!important;position:fixed!important;right:16px!important;bottom:24%!important;z-index:2147483647!important;width:40px!important;height:40px!important;';
  const shadow = host.attachShadow({mode:'open'});
  const style = document.createElement('style');
  style.textContent = `
    :host{color-scheme:light dark;--fill:#282c32;--ink:#fff;--hover:#363b43;--tip-fill:#30333a;--tip-ink:#fff}
    button{all:unset;box-sizing:border-box;position:relative;display:grid;place-items:center;width:40px;height:40px;border:1px solid #ffffff15;border-radius:11px;background:var(--fill);color:var(--ink);box-shadow:0 2px 7px #00000012;cursor:pointer;transition:transform .15s,background .15s;font:500 22px/1 "PingFang SC","Microsoft YaHei",sans-serif}
    button:hover{transform:translateY(-1px);background:var(--hover)}
    button:focus-visible{outline:3px solid #8299d5;outline-offset:3px}
    button[aria-pressed=true]::after{content:"";position:absolute;bottom:5px;left:calc(50% - 2px);width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.65}
    .glyph{pointer-events:none}
    .tip{position:absolute;right:50px;top:4px;background:var(--tip-fill);color:var(--tip-ink);border-radius:6px;padding:5px 9px;font:13px/22px system-ui;white-space:nowrap;opacity:0;pointer-events:none}
    button:hover+.tip,button:focus-visible+.tip{opacity:1}
    @media(prefers-color-scheme:dark){:host{--fill:#e5e7eb;--ink:#292d33;--hover:#f5f6f8;--tip-fill:#e5e7eb;--tip-ink:#292d33}button{border-color:#00000009}}
    @media(prefers-reduced-motion:reduce){button{transition:none}}
  `;
  const button = document.createElement('button');
  button.type = 'button';
  const glyph = document.createElement('span');
  glyph.className='glyph';glyph.setAttribute('aria-hidden','true');glyph.textContent='译';
  button.append(glyph);
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
    if (item.active && !item.dirty && !item.done && !item.queued && !item.failed) {
      item.queued=true; queue.push(item);
    }
  }
  function boundary(el, css = getComputedStyle(el)) {
    // Use the computed outer display type: a SPAN/custom element can be a block,
    // and a DIV may be inline or display:contents.
    return el === document.body || /^(block|flow-root|flex|grid|table|list-item|inline-block|inline-flex|inline-grid|inline-table)/.test(css.display);
  }
  function excluded(el, css) {
    if (el.matches(skip)) return true;
    if (el.matches('header,aside,[role="banner"]') && !el.closest(reading)) return true;
    // A sibling of an explicit article is peripheral; an aside inside that
    // article (or a main document without article wrappers) can be a reading note.
    if(el.tagName==='ASIDE'&&!el.closest('article,[role="article"]')&&el.closest('main,[role="main"]')?.querySelector('article,[role="article"]'))return true;
    return css.display==='none' || css.visibility==='hidden' || css.visibility==='collapse' || css.opacity==='0';
  }
  function safeLayout(el) {
    const css=getComputedStyle(el);
    // A new direct child of a flex/grid container changes its item structure.
    // Read the flow content inside its items instead; do not rewrite the layout.
    if (/flex|grid/.test(css.display) || ['TABLE','TBODY','THEAD','TFOOT','TR','UL','OL','DL'].includes(el.tagName)) return false;
    if (['absolute','fixed','sticky'].includes(css.position)) return false;
    if (Number.parseInt(css.webkitLineClamp)>0 || css.textOverflow==='ellipsis') return false;
    if (/hidden|clip/.test(css.overflowY) && el.clientHeight && el.scrollHeight>el.clientHeight+2) return false;
    return true;
  }
  function readable(el, parts) {
    const text=parts.map(n=>n.nodeType===3?n.data:'\n').join('').trim();
    if (text.length<3 || text.length>20000 || !/\p{L}/u.test(text)) return false;
    const linked=parts.reduce((n,p)=>n+(p.parentElement?.closest('a')?(p.textContent||'').trim().length:0),0);
    const heading=el.matches('h1,h2,h3,h4,h5,h6,[role="heading"]');
    if (linked/text.length>.65 && !(heading&&el.closest(`${reading},section`))) return false;
    if (el.matches(semantic)) return true;
    // Generic application containers need prose, not short toolbar/menu labels.
    const letters=(text.match(/\p{L}/gu)||[]).length;
    if (letters/text.length<.35) return false;
    return text.length >= (el.closest(reading)?24:60) && (/[.!?。！？,:，：]/.test(text)||text.length>=120);
  }
  function collect(root) {
    const units=[];
    const styles=new WeakMap();
    const css=el=>{if(!styles.has(el))styles.set(el,getComputedStyle(el));return styles.get(el);};
    // If the dirty root is inside an excluded or hidden ancestor, remove its
    // translations too. Checking only the root would leak hidden descendant text.
    for(let parent=root;parent;parent=parent.parentElement) if(excluded(parent,css(parent)))return units;
    function walk(container, owner) {
      let parts=[],breaks=[];
      function flush(){
        if(parts.length && safeLayout(owner) && owner.getClientRects().length && readable(owner,parts)) {
          const data=serialize(owner,parts);
          if(data.text.length<=24000)units.push({el:owner,parts:[...parts],...data});
        }
        parts=[];breaks=[];
      }
      function visit(node) {
        if(node.nodeType===3) {
          if(breaks.length&&!node.data.trim()){breaks.push(node);return;}
          parts.push(...breaks,node);breaks=[];return;
        }
        if(node.nodeType!==1)return;
        if(node.matches(own))return; // Transparent to paragraph detection.
        if(excluded(node,css(node))){flush();return;}
        // Floating/positioned UI is a separate layout, never inline prose.
        if(['absolute','fixed','sticky'].includes(css(node).position)){flush();return;}
        // Light DOM of a custom element with shadow content may not be rendered.
        if(node.shadowRoot){flush();return;}
        if(node.tagName==='BR') {
          breaks.push(node);
          if(breaks.filter(n=>n.nodeName==='BR').length>=2)flush();
          return;
        }
        if(boundary(node,css(node))) {flush();walk(node,node);return;}
        // Inline wrappers can contain block descendants or nested BR boundaries.
        // Descending into them avoids merging or losing those paragraphs.
        for(const child of [...node.childNodes])visit(child);
      }
      for(const child of [...container.childNodes])visit(child);
      flush();
    }
    walk(root,root);
    return units;
  }
  function serialize(owner, parts) {
    const marks=new Map();let nextId=0,stack=[],text='';
    function path(node) {
      const result=[];
      for(let el=node.parentElement;el&&el!==owner;el=el.parentElement) {
        if(!formats.has(el.tagName))continue;
        const spec={tag:el.tagName.toLowerCase()};
        if(spec.tag==='a') {
          try {const u=new URL(el.getAttribute('href'),location.href);if(!['http:','https:','mailto:'].includes(u.protocol))continue;spec.href=u.href;}catch{continue;}
        }
        result.unshift({el,spec});
      }
      return result;
    }
    for(const part of parts) {
      const ancestors=path(part);let common=0;
      while(common<stack.length&&common<ancestors.length&&stack[common].el===ancestors[common].el)common++;
      while(stack.length>common)text+=`[[/JY${stack.pop().id}]]`;
      for(const ancestor of ancestors.slice(common)) {
        const id=String(++nextId);marks.set(id,ancestor.spec);stack.push({...ancestor,id});text+=`[[JY${id}]]`;
      }
      text+=part.nodeName==='BR'?'\n':part.textContent;
    }
    while(stack.length)text+=`[[/JY${stack.pop().id}]]`;
    text=text.trim();
    return {text,marks,signature:text+JSON.stringify([...marks])};
  }
  function anchorFor(unit) {
    let node=unit.parts.at(-1);
    // Climb past complete inline wrappers, so translated anchors are never
    // nested inside the original link. For a BR split, stay at that split.
    while(node.parentElement && node.parentElement!==unit.el) {
      let next=node.nextSibling;
      while(next&&(next.nodeType===3&&!next.textContent.trim()||next.nodeType===1&&next.matches(own)))next=next.nextSibling;
      if(next)break;
      node=node.parentElement;
    }
    return node;
  }
  function retire(item) {
    item.active=false;items.delete(item);byFirstNode.delete(item.parts[0]);
    item.node?.remove();item.node=null;
    if(![...items].some(other=>other.el===item.el))observer.unobserve(item.el);
  }
  function current(item) {
    return item.active&&!item.dirty&&item.route===location.href&&item.parts.every(n=>n.isConnected&&item.el.contains(n))&&serialize(item.el,item.parts).signature===item.signature;
  }
  function scan(root=document.body) {
    if(!root?.isConnected)return;
    const previous=new Set([...items].filter(item=>item.el===root||root.contains(item.el)));
    for(const unit of collect(root)) {
      let item=byFirstNode.get(unit.parts[0]);
      if(item && (item.signature!==unit.signature||item.el!==unit.el||item.parts.length!==unit.parts.length||item.parts.some((n,i)=>n!==unit.parts[i]))) {
        retire(item);previous.delete(item);item=null;
      }
      if(!item) {
        item={...unit,anchor:anchorFor(unit),active:true,route:location.href};
        items.add(item);byFirstNode.set(unit.parts[0],item);observer.observe(item.el);
      }
      previous.delete(item);item.dirty=false;
      if(item.node&&!item.node.isConnected)item.node=null;
      if(item.done)render(item,item.result,{translated:true});
      const rect=item.el.getBoundingClientRect();if(rect.bottom>=-240&&rect.top<=innerHeight+240)enqueue(item);
    }
    previous.forEach(retire);pump();
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
    if(!current(item)||!item.anchor.isConnected)return;
    const plain=value=>value.replace(/\[\[\/?JY\d+\]\]/g,'').replace(/\s+/g,' ').trim();
    if(translated&&/^H[1-6]$/.test(item.el.tagName)&&plain(text)===plain(item.text)) {
      item.node?.remove();item.node=null;return;
    }
    if(!item.node) {
      item.node=document.createElement('span');item.node.className='minimal-translation';item.node.setAttribute('translate','no');
      // Preserve existing layout children and listeners. Mount inside the
      // nearest flow paragraph; never add a sibling flex/grid item.
      const styles={all:'unset',display:'block','box-sizing':'border-box',width:'auto','max-width':'100%','margin-block-start':'.65em','margin-block-end':'0',padding:'0',border:'0',font:'inherit',color:'inherit','line-height':'1.75','text-align':'inherit','letter-spacing':'normal','white-space':'pre-wrap','overflow-wrap':'anywhere','text-indent':'0'};
      for(const [key,value] of Object.entries(styles))item.node.style.setProperty(key,value,'important');
      item.anchor.after(item.node);
    }
    // In-place rerenders must not repeatedly mutate our own DOM.
    if(item.renderedText!==text||item.renderedTranslated!==translated||!item.node.hasChildNodes()) {
      item.node.replaceChildren(translated?translatedNodes(item,text):document.createTextNode(text));
      item.renderedText=text;item.renderedTranslated=translated;
    }
    item.node.style.setProperty('display',enabled?'block':'none','important');
    item.node.style.setProperty('opacity',translated?'1':'.6','important');
    item.node.style.setProperty('font-size',translated?'1em':'13px','important');
    item.node.removeAttribute('role');item.node.removeAttribute('tabindex');item.node.onclick=null;item.node.onkeydown=null;
    if(retry){item.node.setAttribute('role','button');item.node.tabIndex=0;item.node.onclick=retry;item.node.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();retry();}};}
  }
  async function requestTranslation(item) {
    const message={type:'translate',text:item.text,inlineMarkup:item.marks.size>0};
    if(/^H[1-6]$/.test(item.el.tagName)&&item.text.length<160)message.pageTitle=document.title.slice(0,300);
    for(let attempt=0;;attempt++) {
      if(!current(item))return;
      try {return await chrome.runtime.sendMessage(message);}
      catch(e) {
        // A missing receiver means delivery did not happen. Do not retry
        // ambiguous disconnects or model errors, which may already be billed.
        if(attempt>=2||!String(e.message).includes('Receiving end does not exist'))throw e;
        await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
      }
    }
  }
  function pump() {
    while(enabled&&running<2&&queue.length) {
      const item=queue.shift();
      if(!current(item)){item.queued=false;continue;}
      running++;render(item,'翻译中…');updateButton();
      requestTranslation(item).then(r=>{
        if(!current(item))return;
        if(r.error)throw Error(r.error);item.done=true;item.result=r.text;render(item,r.text,{translated:true});
      }).catch(e=>{
        if(!current(item))return;
        item.failed=true;
        render(item,(String(e.message).includes('Receiving end does not exist')?'翻译后台未连接，请重新加载扩展后刷新网页':e.message)+' · 点击重试',{retry:()=>{if(!item.queued){item.failed=false;enqueue(item);pump();}}});
      }).finally(()=>{running--;item.queued=false;updateButton();pump();});
    }
  }
  function dirtyRoot(node) {
    let el=node.nodeType===1?node:node.parentElement;
    while(el&&el!==document.body&&!boundary(el))el=el.parentElement;
    return el||document.body;
  }
  function addDirty(root) {
    if(!root?.isConnected)return;
    for(const prior of dirty)if(prior===root||prior.contains(root))return;
    for(const prior of dirty)if(root.contains(prior))dirty.delete(prior);
    dirty.add(root);
  }
  function flushDirty() {
    clearTimeout(timer);timer=null;
    if(!enabled)return;
    const roots=[...dirty];dirty.clear();roots.forEach(scan);
  }
  function checkRoute() {
    if(location.href===route)return;
    route=location.href;[...items].forEach(retire);queue.length=0;dirty.clear();addDirty(document.body);
    if(enabled){clearTimeout(timer);timer=setTimeout(flushDirty,160);}
  }
  const mutations=new MutationObserver(records=>{
    if(destroyed)return;
    checkRoute();
    const roots=new Set();
    for(const r of records) {
      const el=r.target.nodeType===1?r.target:r.target.parentElement;
      if(el?.closest(own))continue;
      if(r.type==='childList') {
        const changed=[...r.addedNodes,...r.removedNodes];
        if(changed.length&&changed.every(n=>n.nodeType===1&&n.matches(own)))continue;
      }
      roots.add(dirtyRoot(r.target));
    }
    // A CSS change can create a new block inside a previously inline run.
    // Reconcile the old owner too, otherwise parent and child get translated twice.
    for(const root of [...roots])for(const item of items) {
      if(item.el!==root&&item.el.contains(root)){roots.delete(root);roots.add(item.el);}
    }
    for(const item of [...items]) {
      if(!item.el.isConnected||item.parts.some(n=>!n.isConnected)){retire(item);continue;}
      if([...roots].some(root=>root===item.el||root.contains(item.el))) {
        item.dirty=true;
        // Remove outdated translations immediately, even while a newer request
        // is waiting; current() rejects late replies for these invalidated units.
        if(serialize(item.el,item.parts).signature!==item.signature){item.node?.remove();item.node=null;}
      }
    }
    roots.forEach(addDirty);
    if(enabled&&dirty.size&&!timer)timer=setTimeout(flushDirty,160);
  });
  mutations.observe(document.documentElement,{childList:true,characterData:true,attributes:true,subtree:true,attributeFilter:['class','style','hidden','aria-hidden','href','translate','contenteditable','role','inert']});
  function toggle(){
    enabled=!enabled;checkRoute();clearInterval(routeTimer);
    for(const item of items)if(item.node)item.node.style.setProperty('display',enabled?'block':'none','important');
    updateButton();
    if(enabled){clearTimeout(timer);timer=null;dirty.clear();scan();routeTimer=setInterval(checkRoute,750);}
  }
  function resized(){if(enabled){addDirty(document.body);if(!timer)timer=setTimeout(flushDirty,160);}}
  window.addEventListener('resize',resized);
  window.addEventListener('popstate',checkRoute);
  window.addEventListener('hashchange',checkRoute);
  button.onclick=toggle;
  function destroy() {
    destroyed=true;enabled=false;clearTimeout(timer);clearInterval(routeTimer);
    window.removeEventListener('resize',resized);window.removeEventListener('popstate',checkRoute);window.removeEventListener('hashchange',checkRoute);window.removeEventListener('pagehide',pageHidden);
    mutations.disconnect();observer.disconnect?.();[...items].forEach(retire);
    queue.length=0;dirty.clear();host.remove();delete window.__minimalTranslate;
  }
  function pageHidden(event){if(!event.persisted)destroy();}
  window.addEventListener('pagehide',pageHidden);
  window.__minimalTranslate={toggle,destroy};updateButton();
})();
