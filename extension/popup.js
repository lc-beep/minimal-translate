async function openSettings(){
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 const suffix=tab?.id&&/^https?:/.test(tab.url||'')?'?fromTab='+tab.id:'';
 await chrome.tabs.create({url:chrome.runtime.getURL('options.html')+suffix});
 window.close();
}
document.querySelector('#settings').onclick=()=>openSettings().catch(()=>{document.querySelector('#status').textContent='无法打开设置，请重试。';});
(async()=>{
 try{
  const {settings}=await chrome.storage.local.get('settings');
  const configured=!!(settings?.model?.trim()&&settings?.baseUrl?.trim());
  document.querySelector('#translate').textContent=configured?'翻译此页 / 隐藏译文':'连接模型，开始使用';
  if(!configured)document.querySelector('#intro').textContent='首次使用：先连接模型，再打开文章翻译。';
 }catch{document.querySelector('#translate').textContent='连接模型，开始使用';}
 finally{document.querySelector('#translate').disabled=false;}
})();
document.querySelector('#pdf').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('pdf.html')});
document.querySelector('#translate').onclick=async()=>{
 try {
  const {settings}=await chrome.storage.local.get('settings');
  if(!settings?.model?.trim()||!settings?.baseUrl?.trim()){await openSettings();return;}
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
  await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>window.__minimalTranslate?.toggle()});
  window.close();
 } catch {document.querySelector('#status').textContent='此页面无法插入译文。PDF 请使用对照阅读；浏览器内部页面不支持翻译。';}
};

document.querySelector('#floating').onclick=async()=>{
 try {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const url=new URL(tab.url);
  if(!['http:','https:'].includes(url.protocol))throw Error('请先打开普通网页，再启用悬浮按钮');
  const origin=url.protocol+'//'+url.hostname+'/*';
  const granted=await chrome.permissions.request({origins:[origin]});
  if(!granted)throw Error('未授权，仍可从插件菜单手动翻译');
  const id='minimal-floating';
  const [existing]=await chrome.scripting.getRegisteredContentScripts({ids:[id]});
  if(existing)await chrome.scripting.updateContentScripts([{id,matches:[...new Set([...existing.matches,origin])]}]);
  else await chrome.scripting.registerContentScripts([{id,matches:[origin],js:['content.js'],runAt:'document_idle',persistAcrossSessions:true}]);
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
  document.querySelector('#status').textContent='已启用：以后打开此网站会显示按钮，点击后才翻译。';
 }catch(e){document.querySelector('#status').textContent=e.message;}
};
