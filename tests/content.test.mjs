import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=await readFile(new URL('../extension/content.js',import.meta.url),'utf8');
test('bilingual insertion preserves original links, skips code, toggles without duplicates',async()=>{
 const dom=new JSDOM('<body><main><p>Hello <a href="/docs">documentation</a> reader.</p><pre><code>const secret = 1;</code></pre><p translate="no">Do not translate me</p></main></body>',{runScripts:'outside-only'});
 const w=dom.window;w.HTMLElement.prototype.getClientRects=()=>[{}];let io;w.IntersectionObserver=class{constructor(cb){io=cb}observe(el){queueMicrotask(()=>io([{target:el,isIntersecting:true}]))}unobserve(){}};
 let calls=0;w.chrome={runtime:{sendMessage:async()=>{calls++;return {text:'<img src=x onerror=alert(1)> 中文译文'}}}};
 w.eval(source);await new Promise(r=>setTimeout(r,20));
 assert.equal(calls,1);assert.equal(w.document.querySelector('p a').getAttribute('href'),'/docs');assert.equal(w.document.querySelectorAll('.minimal-translation').length,1);assert.equal(w.document.querySelector('.minimal-translation img'),null);
 w.eval(source);assert.equal(w.document.querySelector('.minimal-translation').style.display,'none');w.eval(source);assert.equal(w.document.querySelectorAll('.minimal-translation').length,1);dom.window.close();
});
