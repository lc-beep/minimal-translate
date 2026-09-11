document.querySelector('#settings').onclick=()=>chrome.runtime.openOptionsPage();
document.querySelector('#pdf').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('pdf.html')});
document.querySelector('#translate').onclick=async()=>{
 try {
  const {settings}=await chrome.storage.local.get('settings');
  if(!settings?.model){await chrome.runtime.openOptionsPage();return;}
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
  window.close();
 } catch {document.querySelector('#status').textContent='此页面无法插入译文。PDF 请使用对照阅读；浏览器内部页面不支持翻译。';}
};
