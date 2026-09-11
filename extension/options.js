import {defaults,validate,endpoint} from './core.js';
const form=document.querySelector('form'),status=document.querySelector('#status');
const s={...defaults,...(await chrome.storage.local.get('settings')).settings};
for(const k of Object.keys(defaults)) form.elements[k].value=s[k];
async function save(test){
 try {
  const settings=validate(Object.fromEntries(new FormData(form)));
  const origin=new URL(endpoint(settings.baseUrl)).origin+'/*';
  const granted=await chrome.permissions.request({origins:[origin]});
  if(!granted) throw Error('需要授权访问模型地址，才能调用翻译接口');
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await chrome.storage.local.set({settings});
  status.textContent='设置已保存';
  if(test){status.textContent='正在测试连接…';const r=await chrome.runtime.sendMessage({type:'test',text:'Good morning. This is a translation connection test.'});if(r.error)throw Error(r.error);status.textContent='连接成功：'+r.text;}
 }catch(e){status.textContent=e.message;}
}
form.addEventListener('submit',e=>{e.preventDefault();save(false)});
document.querySelector('#test').onclick=()=>{if(form.reportValidity())save(true)};
