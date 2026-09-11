import {defaults,validate,endpoint} from './core.js';
const form=document.querySelector('form'),status=document.querySelector('#status');
const fields=document.querySelector('#connection-fields'),testButton=document.querySelector('#test');
const sample=document.querySelector('#sample'),next=document.querySelector('#next-step');
const back=document.querySelector('#return'),hint=document.querySelector('#next-hint');
const returnId=Number(new URL(location.href).searchParams.get('fromTab'));
const hasReturn=Number.isInteger(returnId)&&returnId>0;
const stored=(await chrome.storage.local.get('settings')).settings;
const s={...defaults,...stored};if(!stored)s.baseUrl='';
for(const k of Object.keys(defaults))form.elements[k].value=s[k];
if(!hasReturn){back.textContent='打开示例文章';hint.textContent='打开文章后，点击浏览器工具栏中的简译，选择「翻译此页」。';}
let busy=false;
form.addEventListener('invalid',e=>{e.target.closest('details')?.setAttribute('open','');},true);
function invalidate(){next.hidden=true;sample.hidden=true;status.textContent='修改尚未保存。';delete status.dataset.state;}
form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
async function save(test){
 if(busy||!form.reportValidity())return;
 let saved=false;
 try {
  const settings=validate(Object.fromEntries(new FormData(form)));
  busy=true;fields.disabled=true;next.hidden=true;sample.hidden=true;form.setAttribute('aria-busy','true');
  status.textContent='正在申请访问模型服务…';status.dataset.state='pending';testButton.textContent=test?'正在测试…':'保存中…';
  const origin=new URL(endpoint(settings.baseUrl)).origin+'/*';
  if(!await chrome.permissions.request({origins:[origin]}))throw Error('未获得访问模型地址的权限，请重试并选择允许');
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await chrome.storage.local.set({settings});saved=true;
  status.textContent='设置已保存，尚未测试连接。';status.dataset.state='saved';
  if(test){
   status.textContent='设置已保存，正在测试连接…';status.dataset.state='pending';
   const r=await chrome.runtime.sendMessage({type:'test',text:'Good morning. This is a translation connection test.'});
   if(r.error)throw Error(r.error);
   status.textContent='连接成功，可以开始翻译了。';status.dataset.state='success';
   sample.textContent='测试译文：'+r.text;sample.hidden=false;next.hidden=false;
  }
 }catch(e){status.textContent=(saved?'设置已保存，但连接测试失败：':'设置未保存：')+e.message;status.dataset.state='error';}
 finally{busy=false;fields.disabled=false;form.removeAttribute('aria-busy');testButton.textContent='保存并测试连接';}
}
form.addEventListener('submit',e=>{e.preventDefault();save(false)});
testButton.onclick=()=>save(true);
back.onclick=async()=>{
 try {
  if(hasReturn){const tab=await chrome.tabs.update(returnId,{active:true});await chrome.windows.update(tab.windowId,{focused:true});}
  else await chrome.tabs.create({url:'https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver'});
 }catch{hint.textContent='原网页可能已关闭。请打开一篇文章，点击浏览器工具栏中的简译开始翻译。';}
};
