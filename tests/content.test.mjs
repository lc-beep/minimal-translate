import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=await readFile(new URL('../extension/content.js',import.meta.url),'utf8');
const settle=()=>new Promise(r=>setTimeout(r,30));
function setup(html,respond=m=>({text:m.text})) {
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://example.com/article'}),w=dom.window;
 w.HTMLElement.prototype.getClientRects=()=>[{}];
 w.IntersectionObserver=class{constructor(cb){this.cb=cb}observe(el){queueMicrotask(()=>this.cb([{target:el,isIntersecting:true}]))}unobserve(){}};
 const calls=[];w.chrome={runtime:{sendMessage:async m=>{calls.push(m);return respond(m);}}};
 w.eval(source);return {dom,w,calls};
}
test('starts with launcher only; translation stays inside source and remains plain text',async()=>{
 const {dom,w,calls}=setup('<main><p>Hello <a href="/docs">documentation</a> reader.</p><pre><code>const secret = 1;</code></pre><p translate="no">Do not translate me</p></main>',()=>({text:'<img src=x onerror=alert(1)> 中文译文'}));
 assert.equal(calls.length,0);assert.equal(w.document.querySelectorAll('#minimal-translate-launcher').length,1);
 w.__minimalTranslate.toggle();await settle();
 assert.equal(calls.length,1);assert.equal(w.document.querySelector('p > a').getAttribute('href'),'/docs');assert.equal(w.document.querySelectorAll('p > .minimal-translation').length,1);assert.equal(w.document.querySelector('.minimal-translation img'),null);
 w.__minimalTranslate.toggle();assert.equal(w.document.querySelector('.minimal-translation').style.display,'none');
 w.__minimalTranslate.toggle();w.eval(source);await settle();assert.equal(calls.length,1);assert.equal(w.document.querySelectorAll('#minimal-translate-launcher').length,1);dom.window.close();
});
test('BR-separated paragraphs translate independently and restore nested links safely',async()=>{
 const {dom,w,calls}=setup('<main><div><p class="reading-column"><em>Read <a href="/docs">the docs</a>.</em><br>\n<br>A different paragraph with <strong>important words</strong>.</p></div></main>');
 w.__minimalTranslate.toggle();await settle();const p=w.document.querySelector('p'),out=p.querySelectorAll(':scope > .minimal-translation');
 assert.equal(calls.length,2);assert.equal(out.length,2);assert.ok(!calls[0].text.includes('different paragraph'));assert.ok(calls[0].inlineMarkup);assert.equal(out[0].querySelector('em a').href,'https://example.com/docs');assert.equal(out[1].querySelector('strong').textContent,'important words');assert.equal(out[0].previousSibling.nodeName,'EM');assert.equal(out[0].nextSibling.nodeName,'BR');dom.window.close();
});
test('nested list blocks are not combined or duplicated',async()=>{
 const {dom,w,calls}=setup('<main><ul><li>Parent item<ul><li>Child item</li></ul></li></ul><div><p>Separate paragraph.</p></div></main>');w.__minimalTranslate.toggle();await settle();
 assert.deepEqual(calls.map(c=>c.text).sort(),['Child item','Parent item','Separate paragraph.'].sort());dom.window.close();
});
test('unknown or malformed model markers fall back to safe text',async()=>{
 const {dom,w}=setup('<main><p>Hello <a href="javascript:alert(1)">unsafe</a> and <a href="/safe">safe</a>.</p></main>',()=>({text:'[[JY999]]<script>alert(1)</script>[[/JY999]]'}));w.__minimalTranslate.toggle();await settle();const out=w.document.querySelector('.minimal-translation');assert.equal(out.children.length,0);assert.equal(out.textContent,'<script>alert(1)</script>');dom.window.close();
});
