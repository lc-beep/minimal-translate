import {defaults,translate,validate} from './core.js';
const secured=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
let active=0; const queue=[];
async function acquire(limit){if(active>=limit) await new Promise(resolve=>queue.push(resolve)); active++;}
function release(){active--; queue.shift()?.();}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(sender.id!==chrome.runtime.id) return;
 if(!['translate','test'].includes(m.type)) return;
 if(m.type==='test'&&sender.url?.split(/[?#]/,1)[0]!==chrome.runtime.getURL('options.html')) {reply({error:'测试只能从设置页面发起'});return;}
 (async()=>{
  await secured;
  let s=validate({...defaults,...(await chrome.storage.local.get('settings')).settings});
  if(typeof m.text!=='string'||!m.text.trim()||m.text.length>24000) throw Error('文本为空或过长，请分段翻译');
  if(m.inlineMarkup===true) s={...s,prompt:s.prompt+'\n保留所有 [[JY数字]] 与 [[/JY数字]] 标记及其配对嵌套，将标记内的自然语言正常翻译，标记内的代码保持原样。这些标记用于恢复链接和行内格式，不要添加、删除或修改标记编号。'};
  await acquire(Number(s.concurrency));
  const keepAlive=setInterval(()=>chrome.runtime.getPlatformInfo().catch(()=>{}),20000);
  try {return {text:await translate(s,m.text,fetch,m.type==='translate'&&typeof m.pageTitle==='string'?m.pageTitle.slice(0,300):'')};} finally {clearInterval(keepAlive);release();}
 })().then(reply,e=>reply({error:e.message}));
 return true;
});
