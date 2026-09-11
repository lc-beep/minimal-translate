// Isolated UI regression: prepared responses, never real user credentials or API calls.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(process.env.EXTENSION_ROOT||'extension');
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+req.url.split('?')[0]);if(!path.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'html':'text/html','js':'text/javascript','mjs':'text/javascript','css':'text/css'})[extname(path).slice(1)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 await mkdir('artifacts',{recursive:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({base})=>{
  window.audit={stored:null,saves:0,allowed:true,mode:'error',calls:0,returns:[],opens:[],pending:[],closed:false};
  if(location.search.includes('existing=1'))audit.stored={model:'existing-model',baseUrl:'http://localhost:11434/v1',timeout:180,prompt:'Custom prompt {{target}}',extra:'{"enable_thinking":true}'};
  window.close=()=>audit.closed=true;
  window.chrome={storage:{local:{get:async()=>({settings:audit.stored}),set:async v=>{audit.stored=v.settings;audit.saves++;},setAccessLevel:async()=>{}}},permissions:{request:async()=>audit.allowed},tabs:{query:async()=>[{id:7,url:'https://article.example/read'}],create:async v=>audit.opens.push(v),update:async(id,v)=>{audit.returns.push({id,...v});if(audit.tabClosed)throw Error('No tab');return {windowId:3};}},windows:{update:async()=>{}},runtime:{getURL:p=>base+'/'+p,sendMessage:async()=>{audit.calls++;return audit.mode==='pending'?new Promise(r=>audit.pending.push(r)):audit.mode==='success'?{text:'早上好。这是翻译连接测试。'}:{error:'HTTP 401：API Key 无效或已过期'};}}};
 },{base});
 await page.goto(base+'/popup.html');await page.getByRole('button',{name:'连接模型，开始使用'}).click();
 assert.equal(await page.evaluate(()=>audit.opens[0].url),base+'/options.html?fromTab=7');
 await page.goto(base+'/options.html?fromTab=7');
 assert.equal(await page.locator('[name=baseUrl]').inputValue(),'');
 assert.equal(await page.locator('details').getAttribute('open'),null);
 assert.ok(await page.locator('#test').evaluate(el=>el.getBoundingClientRect().bottom<innerHeight));
 await page.screenshot({path:'artifacts/onboarding-new.png',fullPage:true});
 await page.locator('[name=baseUrl]').fill('https://provider.example/v1');await page.locator('[name=model]').fill('example-model');
 await page.evaluate(()=>audit.allowed=false);await page.locator('#test').click();await page.getByText(/设置未保存：未获得/).waitFor();assert.equal(await page.evaluate(()=>audit.saves),0);
 await page.evaluate(()=>audit.allowed=true);await page.locator('#test').click();await page.getByText(/设置已保存，但连接测试失败：HTTP 401/).waitFor();assert.equal(await page.evaluate(()=>audit.saves),1);assert.equal(await page.locator('#next-step').isVisible(),false);
 await page.evaluate(()=>audit.mode='pending');await page.locator('#test').click();
 assert.equal(await page.locator('#test').isDisabled(),true);assert.equal(await page.locator('[name=model]').isDisabled(),true);
 await page.evaluate(()=>document.querySelector('#test').onclick());assert.equal(await page.evaluate(()=>audit.pending.length),1);
 await page.evaluate(()=>audit.pending[0]({text:'早上好。'}));await page.getByText('连接成功，可以开始翻译了。').waitFor();assert.equal(await page.locator('#next-step').isVisible(),true);
 await page.screenshot({path:'artifacts/onboarding-success.png',fullPage:true});
 await page.locator('#return').click();assert.equal(await page.evaluate(()=>audit.returns[0].id),7);
 await page.evaluate(()=>audit.tabClosed=true);await page.locator('#return').click();await page.getByText(/原网页可能已关闭/).waitFor();
 await page.locator('[name=model]').fill('changed-model');assert.equal(await page.locator('#next-step').isVisible(),false);await page.getByText('修改尚未保存。').waitFor();
 await page.evaluate(()=>{document.querySelector('[name=timeout]').value='0';document.querySelector('details').open=false;});await page.locator('#test').click();assert.equal(await page.locator('details').evaluate(el=>el.open),true);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/onboarding-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // Existing values must survive initial load; no writes until the user saves.
 await page.goto(base+'/options.html?existing=1');assert.equal(await page.locator('[name=timeout]').inputValue(),'180');assert.equal(await page.locator('[name=prompt]').inputValue(),'Custom prompt {{target}}');assert.equal(await page.locator('[name=extra]').inputValue(),'{"enable_thinking":true}');assert.equal(await page.evaluate(()=>audit.saves),0);
 await page.evaluate(()=>audit.mode='success');await page.locator('#test').click();await page.getByRole('button',{name:'打开示例文章'}).click();assert.match(await page.evaluate(()=>audit.opens[0].url),/^https:\/\/developer.mozilla.org\//);
 assert.deepEqual(errors,[]);console.log('Onboarding passed: empty/existing configuration, denied permission, saved failure, single in-flight request, return to article, closed tab, invalid advanced fields, mobile layout.');
}finally{await browser.close();server.close();}
