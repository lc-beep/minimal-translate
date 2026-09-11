(()=>{
 if(window.__minimalTranslate){window.__minimalTranslate.toggle();return;}
 let enabled=true,running=0;const items=new Map(),queue=[];
 const skip='pre,code,nav,header,footer,button,input,textarea,select,script,style,noscript,[contenteditable]:not([contenteditable="false"]),[translate="no"],.minimal-translation';
 const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){const item=items.get(e.target);if(item&&!item.done&&!item.queued){item.queued=true;queue.push(item)}}pump();},{rootMargin:'240px'});
 function scan(){
  for(const el of document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,td,figcaption,article div,main div')){
   if(items.has(el)||el.closest(skip)||el.querySelector('p,li,blockquote,h1,h2,h3,h4,h5,h6,td,div')||!el.getClientRects().length)continue;
   const text=el.textContent.trim();if(text.length<3||text.length>24000||!/[a-zA-Z\u00c0-\u024f\u4e00-\u9fff]/.test(text))continue;
   const item={el,text};items.set(el,item);observer.observe(el);
  }
 }
 async function pump(){
  while(enabled&&running<2&&queue.length){
   const item=queue.shift();if(!item.el.isConnected){item.queued=false;continue;}
   running++;render(item,'翻译中…');
   chrome.runtime.sendMessage({type:'translate',text:item.text}).then(r=>{
    if(r.error)throw Error(r.error);item.done=true;render(item,r.text);
   }).catch(e=>{render(item,e.message+' · 点击重试',()=>{if(!item.queued){item.queued=true;queue.push(item);pump()}})}).finally(()=>{running--;item.queued=false;pump()});
  }
 }
 function render(item,text,retry){
  if(!item.node){item.node=document.createElement('div');item.node.className='minimal-translation';item.node.setAttribute('translate','no');item.node.style.cssText='display:block;margin:0.55em 0 1em;padding-left:0.8em;border-left:2px solid #94a9d3;line-height:1.75;font-size:0.96em;font-weight:normal;white-space:pre-wrap;overflow-wrap:anywhere';item.el.after(item.node)}
  item.node.textContent=text;item.node.hidden=!enabled;item.node.style.display=enabled?'block':'none';item.node.onclick=retry||null;item.node.style.cursor=retry?'pointer':'auto';
 }
 let timer;const mutations=new MutationObserver(records=>{
  for(const [el,item] of items)if(!el.isConnected){observer.unobserve(el);item.node?.remove();items.delete(el)}
  if(records.some(r=>!r.target.closest?.('.minimal-translation')&&[...r.addedNodes].some(n=>n.nodeType===1&&!n.classList.contains('minimal-translation')))){clearTimeout(timer);timer=setTimeout(scan,350)}
 });
 mutations.observe(document.body,{childList:true,subtree:true});
 window.__minimalTranslate={toggle(){enabled=!enabled;for(const item of items.values())if(item.node){item.node.hidden=!enabled;item.node.style.display=enabled?'block':'none'}if(enabled){scan();pump()}}};scan();
})();