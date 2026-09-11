import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile('extension/content.js','utf8');
const cases=[
 {name:'news-grid',html:`<nav><p>Navigation should not be sent.</p></nav><main class="news"><article><header><h1 data-prose>Independent reporting and careful reading</h1></header><p data-prose>Readers need original paragraphs and their translations to stay together inside the article column.</p><p data-prose>Use <a id="original-link" href="/details">the source document</a> to check facts, terminology, and the full context of each statement.</p></article><aside><p>Sidebar advertising content should not be sent.</p></aside></main>`,css:'.news{display:grid;grid-template-columns:minmax(0,2fr) 1fr;gap:24px}.news>article{min-width:0}',checkLayout:'.news > *'},
 {name:'documentation',html:`<main><nav><ul><li><a href="/setup">Setup</a></li><li><a href="/api">API</a></li></ul></nav><article><h2 data-prose>Working with documents</h2><ul><li data-prose>Preserve the source structure.<ul><li data-prose>Read nested instructions carefully.</li></ul></li></ul><dl><dt data-prose>Connection timeout</dt><dd data-prose>The timeout limits how long the client waits for the response.</dd></dl><pre><code>const apiKey = 'DO_NOT_SEND';</code></pre><p data-prose>Keep <code>request.timeout</code> unchanged when translating the surrounding explanatory text.</p></article></main>`},
 {name:'forum-flex',html:`<main><article class="post"><div class="avatar">AB</div><div class="message"><p data-prose>This is a longer forum reply, with enough context to understand the question and discuss the proposed solution.</p><button>Reply</button><div contenteditable="true"><p>A private draft should not be translated.</p></div></div></article><article class="post"><div class="avatar">CD</div><div class="message" data-prose>Another reply uses a plain container instead of a paragraph tag. Its original layout must remain intact.</div></article><form><p>Form instructions should not be sent.</p><textarea>Private draft</textarea></form></main>`,css:'.post{display:flex;gap:20px;margin-block:24px}.avatar{width:44px;flex-shrink:0}.message{flex:1;min-width:0}',checkLayout:'.post > *'},
 {name:'cards-flex-grid',html:`<main><div class="cards"><article><div data-prose>First card uses grid placement, while its content follows normal text flow inside each card.</div></article><article><div data-prose>Second card must keep its original width and remain next to the first card after translation.</div></article></div><div class="unsafe" data-skip>Anonymous text directly in a flex container is skipped because adding a child would change its layout.<button>Action</button></div><p class="clamped" data-skip>This clipped preview cannot safely fit a translation. This clipped preview cannot safely fit a translation. This clipped preview cannot safely fit a translation.</p></main>`,css:'.cards{display:grid;grid-template-columns:1fr 1fr;gap:20px}.cards>article{min-width:0;border:1px solid #ddd;padding:12px}.unsafe{display:flex;margin-top:24px}.clamped{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}',checkLayout:'.cards > *'},
 {name:'tables',html:`<main><table><thead><tr><th data-prose>Option</th><th data-prose>Description</th></tr></thead><tbody><tr><td data-prose>Timeout</td><td data-prose>Maximum waiting time before the request is cancelled.</td></tr><tr><td>4096</td><td><p data-prose>Output budget controls the maximum number of generated tokens.</p></td></tr></tbody></table></main>`,css:'table{width:100%;table-layout:fixed;border-collapse:collapse}td,th{padding:12px;border:1px solid #ddd;vertical-align:top}',checkLayout:'tr:first-child > *'},
 {name:'custom-and-breaks',html:`<main><x-prose data-prose>Custom elements can render normal article text without using conventional paragraph tags.</x-prose><div style="display:contents"><span class="block" data-prose>A block span is a paragraph boundary because of its computed style, not because of its tag name.</span></div><p data-prose data-count="2"><em>First logical paragraph contains <a href="/docs">documentation</a>.<br><br>Second logical paragraph shares the same italic wrapper, but needs its own translation.</em></p><p id="inline" data-prose></p></main>`,css:'x-prose,.block{display:block;margin:24px 0}',setup:()=>{const p=document.querySelector('#inline');p.append('One continuous sentence contains ');const div=document.createElement('div');div.style.display='inline';div.textContent='an inline DIV';p.append(div,' and keeps its sentence together.');}},
 {name:'filters-and-reveal',html:`<main><p data-prose>Only visible reading content is sent to the configured translation provider.</p><div role="toolbar"><p>Toolbar actions should not be sent.</p></div><div hidden id="reveal"><p>Content becomes readable only after it is revealed.</p></div><div style="display:none"><p>Hidden secret should never be sent.</p></div><ul><li><a href="/account">Account and billing settings</a></li></ul><p><span aria-hidden="true">ICON_ONLY</span><span data-prose>Readable content survives an excluded decorative icon before it.</span></p></main>`}
];
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const results=[];
try {
 await mkdir('artifacts',{recursive:true});
 for(const scenario of cases){
  const page=await browser.newPage({viewport:{width:1280,height:1800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://compatibility.test/**',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>body{margin:0;font:18px/1.6 system-ui;background:#fafbfd;color:#202b3e}main{max-width:980px;margin:32px auto;padding:24px}p{margin:16px 0}h1{font-size:28px}a{color:inherit}nav,aside{padding:12px;background:#eef1f6} ${scenario.css||''}</style>${scenario.html}`}));
  await page.goto('https://compatibility.test/'+scenario.name);
  if(scenario.setup)await page.evaluate(scenario.setup);
  await page.evaluate(()=>{window.calls=[];window.chrome={runtime:{sendMessage:async m=>{window.calls.push(m);return {text:'译文：'+m.text};}}};document.querySelector('#original-link')?.addEventListener('click',e=>{e.preventDefault();window.clicked=true;});});
  const before=scenario.checkLayout?await page.locator(scenario.checkLayout).evaluateAll(nodes=>nodes.map(n=>({left:n.getBoundingClientRect().left,width:n.getBoundingClientRect().width}))):[];
  const expected=await page.locator('[data-prose]').evaluateAll(nodes=>nodes.reduce((n,el)=>n+Number(el.dataset.count||1),0));
  await page.addScriptTag({content:source});await page.evaluate(()=>window.__minimalTranslate.toggle());
  await page.waitForFunction(n=>document.querySelectorAll('.minimal-translation').length===n&&[...document.querySelectorAll('.minimal-translation')].every(el=>el.textContent.startsWith('译文：')),expected,{timeout:6000}).catch(async error=>{throw Error(scenario.name+': '+error.message+'\n'+JSON.stringify(await page.evaluate(()=>({calls:window.calls.map(m=>m.text),out:[...document.querySelectorAll('.minimal-translation')].map(n=>n.textContent)}))));});
  const outOfBounds=await page.locator('.minimal-translation').evaluateAll(nodes=>nodes.filter(n=>{const rect=n.getBoundingClientRect();return rect.left<0||rect.right>innerWidth+1||rect.width<10;}).map(n=>n.textContent));assert.deepEqual(outOfBounds,[],scenario.name);
  assert.equal(await page.locator('[data-skip] .minimal-translation').count(),0);
  if(scenario.checkLayout){const after=await page.locator(scenario.checkLayout).evaluateAll(nodes=>nodes.map(n=>({left:n.getBoundingClientRect().left,width:n.getBoundingClientRect().width})));assert.deepEqual(after,before,scenario.name+' must preserve columns and layout children');}
  const initialCalls=await page.evaluate(()=>window.calls.length);
  await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.calls.length),initialCalls,'own DOM writes must not trigger requests');
  if(scenario.name==='news-grid'){await page.locator('#original-link').click();assert.equal(await page.evaluate(()=>window.clicked),true);}
  if(scenario.name==='filters-and-reveal'){
   await page.evaluate(()=>document.querySelector('#reveal').hidden=false);
   await page.waitForFunction(()=>window.calls.some(m=>m.text.includes('Content becomes readable')));
   assert.ok(!(await page.evaluate(()=>calls.map(c=>c.text).join('\n'))).includes('Hidden secret'));
  }
  if(scenario.name==='forum-flex'){
   await page.evaluate(()=>{document.querySelector('.message p').firstChild.data='A recycled forum node now contains a different message.';const p=document.createElement('p');p.textContent='Infinite scroll appends another complete paragraph to read.';document.querySelector('main').append(p);});
   await page.waitForFunction(()=>window.calls.length===4);
   assert.ok(await page.locator('.message p .minimal-translation').textContent().then(t=>t.includes('recycled')));
   await page.evaluate(()=>{history.pushState({},'', '/new-route');document.querySelector('main').innerHTML='<p>New route has a completely different article to translate.</p>';});
   await page.waitForFunction(()=>document.querySelectorAll('.minimal-translation').length===1&&document.querySelector('.minimal-translation').textContent.includes('New route'));
  }
  await page.screenshot({path:`artifacts/compatibility-${scenario.name}.png`,fullPage:true});
  assert.deepEqual(errors,[],scenario.name);results.push({scenario:scenario.name,paragraphs:expected,result:'pass'});await page.close();
 }
 // A long feed proves offscreen paragraphs are extracted but never all requested.
 const page=await browser.newPage({viewport:{width:1000,height:700}});
 await page.setContent('<main>'+Array.from({length:600},(_,i)=>`<p style="margin:30px;min-height:50px">Entry ${i}: A complete reading paragraph in a long feed with repeated layout structure.</p>`).join('')+'</main>');
 await page.evaluate(()=>{window.calls=[];window.chrome={runtime:{sendMessage:async m=>{calls.push(m);return {text:m.text};}}};});
 await page.addScriptTag({content:source});
 const duration=await page.evaluate(()=>{const t=performance.now();window.__minimalTranslate.toggle();return performance.now()-t;});
 await page.waitForTimeout(500);const first=await page.evaluate(()=>calls.length);assert.ok(first>0&&first<30,'requests should be viewport bounded');
 await page.evaluate(()=>document.querySelector('p:last-child').scrollIntoView());
 await page.waitForFunction(()=>calls.some(m=>m.text.includes('Entry 599:')));results.push({scenario:'600-paragraph-feed',initialRequests:first,initialScanMs:Math.round(duration),result:'pass'});await page.close();
 await writeFile('artifacts/compatibility-results.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
