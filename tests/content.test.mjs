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
test('short headings receive page title context but paragraphs do not',async()=>{
 const {dom,w,calls}=setup('<title>psf/requests: A simple HTTP library</title><main><h1>Requests</h1><p>A paragraph describing this library.</p></main>');
 w.__minimalTranslate.toggle();await settle();
 assert.equal(calls.find(c=>c.text==='Requests').pageTitle,'psf/requests: A simple HTTP library');
 assert.equal(calls.find(c=>c.text.startsWith('A paragraph')).pageTitle,undefined);
 assert.equal(w.document.querySelector('h1 .minimal-translation'),null);
 w.__minimalTranslate.toggle();w.__minimalTranslate.toggle();await settle();
 assert.equal(w.document.querySelector('h1 .minimal-translation'),null);
 assert.equal(calls.filter(c=>c.text==='Requests').length,1);
 w.__minimalTranslate.destroy();dom.window.close();
});
test('main content headers and aside examples translate while peripheral navigation stays untouched',async()=>{
 const {dom,w,calls}=setup('<header><h1>Site banner</h1></header><aside><p>Outside sidebar copy.</p></aside><main><header><h1>A table tutorial</h1></header><aside><p>A relevant note in the article.</p><table><tr><th>Event</th><td>Evening concert</td></tr></table><pre>Do not translate this code.</pre></aside><aside role="navigation"><p>Related navigation links.</p></aside></main>',m=>({text:'译文 '+m.text}));
 w.__minimalTranslate.toggle();await settle();
 assert.deepEqual(calls.map(c=>c.text).sort(),['A table tutorial','A relevant note in the article.','Event','Evening concert'].sort());
 assert.ok(w.document.querySelector('td .minimal-translation'));
 assert.equal(w.document.querySelector('pre').textContent,'Do not translate this code.');
 w.__minimalTranslate.destroy();dom.window.close();
});
test('linked section headings in standalone documents translate without translating navigation links',async()=>{
 const {dom,w,calls}=setup('<nav><h3><a href="#purpose">Purpose</a></h3></nav><section><h3 id="purpose"><a href="#section">1.1. </a><a href="#purpose">Purpose</a></h3><p>Document purpose and scope.</p></section>',m=>({text:m.text.replace('Purpose','目的')}));
 w.__minimalTranslate.toggle();await settle();
 assert.equal(calls.length,2);
 assert.equal(w.document.querySelector('section h3 .minimal-translation').textContent,'1.1. 目的');
 assert.equal(w.document.querySelectorAll('section h3 .minimal-translation a').length,2);
 assert.equal(w.document.querySelector('nav .minimal-translation'),null);
 w.__minimalTranslate.destroy();dom.window.close();
});
test('starts with launcher only; translation stays inside source and remains plain text',async()=>{
 const {dom,w,calls}=setup('<main><p>Hello <a href="/docs">documentation</a> reader.</p><pre><code>const secret = 1;</code></pre><p translate="no">Do not translate me</p></main>',()=>({text:'<img src=x onerror=alert(1)> 中文译文'}));
 assert.equal(calls.length,0);assert.equal(w.document.querySelectorAll('#minimal-translate-launcher').length,1);
 w.__minimalTranslate.toggle();await settle();
 assert.equal(calls.length,1);assert.equal(w.document.querySelector('p > a').getAttribute('href'),'/docs');assert.equal(w.document.querySelectorAll('p > .minimal-translation').length,1);assert.equal(w.document.querySelector('.minimal-translation img'),null);
 w.__minimalTranslate.toggle();assert.equal(w.document.querySelector('.minimal-translation').style.display,'none');
 w.__minimalTranslate.toggle();w.eval(source);await settle();assert.equal(calls.length,1);assert.equal(w.document.querySelectorAll('#minimal-translate-launcher').length,1);w.__minimalTranslate.destroy();dom.window.close();
});
test('BR-separated paragraphs translate independently and restore nested links safely',async()=>{
 const {dom,w,calls}=setup('<main><div><p class="reading-column"><em>Read <a href="/docs">the docs</a>.</em><br>\n<br>A different paragraph with <strong>important words</strong>.</p></div></main>');
 w.__minimalTranslate.toggle();await settle();const p=w.document.querySelector('p'),out=p.querySelectorAll(':scope > .minimal-translation');
 assert.equal(calls.length,2);assert.equal(out.length,2);assert.ok(!calls[0].text.includes('different paragraph'));assert.ok(calls[0].inlineMarkup);assert.equal(out[0].querySelector('em a').href,'https://example.com/docs');assert.equal(out[1].querySelector('strong').textContent,'important words');assert.equal(out[0].previousSibling.nodeName,'EM');assert.equal(out[0].nextSibling.nodeName,'BR');w.__minimalTranslate.destroy();dom.window.close();
});
test('nested list blocks are not combined or duplicated',async()=>{
 const {dom,w,calls}=setup('<main><ul><li>Parent item<ul><li>Child item</li></ul></li></ul><div><p>Separate paragraph.</p></div></main>');w.__minimalTranslate.toggle();await settle();
 assert.deepEqual(calls.map(c=>c.text).sort(),['Child item','Parent item','Separate paragraph.'].sort());w.__minimalTranslate.destroy();dom.window.close();
});
test('unknown or malformed model markers fall back to safe text',async()=>{
 const {dom,w}=setup('<main><p>Hello <a href="javascript:alert(1)">unsafe</a> and <a href="/safe">safe</a>.</p></main>',()=>({text:'[[JY999]]<script>alert(1)</script>[[/JY999]]'}));w.__minimalTranslate.toggle();await settle();const out=w.document.querySelector('.minimal-translation');assert.equal(out.children.length,0);assert.equal(out.textContent,'<script>alert(1)</script>');w.__minimalTranslate.destroy();dom.window.close();
});

test('computed blocks, inline DIV wrappers and display:contents form distinct prose units',async()=>{
 const {dom,w,calls}=setup(`<main><x-story style="display:block">A custom element contains a complete prose paragraph for reading.</x-story><p>One <span><div style="display:inline">continuous</div> sentence.</span></p><div style="display:contents"><span style="display:block">First block span with enough prose for reading.</span><span style="display:block">Second block span with enough prose for reading.</span></div></main>`);
 // Avoid HTML parser correction of DIV-inside-P for the inline DIV test.
 const p=w.document.querySelector('p');p.replaceChildren(w.document.createTextNode('One '));const inline=w.document.createElement('div');inline.style.display='inline';inline.textContent='continuous';p.append(inline,w.document.createTextNode(' sentence.'));
 w.__minimalTranslate.toggle();await settle();
 assert.ok(calls.some(c=>c.text==='One continuous sentence.'));assert.ok(calls.some(c=>c.text.startsWith('A custom element')));assert.equal(calls.filter(c=>c.text.includes('block span')).length,2);
 w.__minimalTranslate.destroy();dom.window.close();
});
test('filters hidden descendants, forms, ARIA navigation, link lists and keeps article headings',async()=>{
 const {dom,w,calls}=setup(`<header><p>Site banner copy.</p></header><div role="navigation"><p>Navigation paragraph.</p></div><form><p>Private form content.</p></form><div style="display:none"><p>Hidden secret content.</p></div><div contenteditable="true"><p>Draft content should remain private.</p></div><ul><li><a href="/a">Account settings</a></li></ul><article><header><h1><a href="/read">Article heading</a></h1></header><p>Visible article paragraph.</p></article>`);
 w.__minimalTranslate.toggle();await settle();assert.equal(calls.length,2);assert.ok(calls.some(c=>c.text.includes('Article heading')));assert.ok(calls.some(c=>c.text==='Visible article paragraph.'));
 w.__minimalTranslate.destroy();dom.window.close();
});
test('characterData changes retire old translation, while unrelated paragraphs are reused',async()=>{
 const {dom,w,calls}=setup('<main><p id="a">Original paragraph.</p><p id="b">Unchanged paragraph.</p></main>');w.__minimalTranslate.toggle();await settle();
 w.document.querySelector('#a').firstChild.data='Updated paragraph.';await new Promise(r=>setTimeout(r,230));
 assert.equal(calls.length,3);assert.equal(w.document.querySelector('#a .minimal-translation').textContent,'Updated paragraph.');assert.equal(calls.filter(c=>c.text==='Unchanged paragraph.').length,1);
 await new Promise(r=>setTimeout(r,230));assert.equal(calls.length,3);w.__minimalTranslate.destroy();dom.window.close();
});
test('late model responses cannot render into replaced SPA content',async()=>{
 let finishOld;const {dom,w,calls}=setup('<main><p>Old route paragraph.</p></main>',m=>m.text.includes('Old')?new Promise(resolve=>finishOld=resolve):{text:'Fresh translation.'});
 w.__minimalTranslate.toggle();await settle();w.document.querySelector('main').innerHTML='<p>New route paragraph.</p>';await new Promise(r=>setTimeout(r,230));finishOld({text:'Stale translation.'});await settle();
 assert.equal(calls.length,2);assert.equal(w.document.querySelectorAll('.minimal-translation').length,1);assert.equal(w.document.querySelector('.minimal-translation').textContent,'Fresh translation.');w.__minimalTranslate.destroy();dom.window.close();
});
test('hidden content reveal and infinite-scroll inserts are discovered without re-requesting old text',async()=>{
 const {dom,w,calls}=setup('<main><p>Existing paragraph.</p><div hidden><p>Revealed paragraph.</p></div></main>');w.__minimalTranslate.toggle();await settle();w.document.querySelector('[hidden]').removeAttribute('hidden');const p=w.document.createElement('p');p.textContent='Appended paragraph.';w.document.querySelector('main').append(p);await new Promise(r=>setTimeout(r,230));
 assert.equal(calls.length,3);assert.equal(w.document.querySelectorAll('.minimal-translation').length,3);w.__minimalTranslate.destroy();dom.window.close();
});
test('an inline-to-block layout change replaces the old parent unit without duplicate translations',async()=>{
 const {dom,w,calls}=setup('<main><p>Before sentence. <span id="change">A complete middle sentence with enough prose for translation.</span> After sentence.</p></main>');w.__minimalTranslate.toggle();await settle();w.document.querySelector('#change').style.display='block';await new Promise(r=>setTimeout(r,230));
 assert.equal(w.document.querySelectorAll('.minimal-translation').length,3);assert.equal(calls.length,4);w.__minimalTranslate.destroy();dom.window.close();
});

test('URL-only SPA navigation clears page-scoped results even without a DOM mutation',async()=>{
 const {dom,w,calls}=setup('<main><p>Route-scoped paragraph.</p></main>');w.__minimalTranslate.toggle();await settle();w.history.pushState({},'', '/second-route');await new Promise(r=>setTimeout(r,1020));
 assert.equal(calls.length,2);assert.equal(w.document.querySelectorAll('.minimal-translation').length,1);w.__minimalTranslate.destroy();dom.window.close();
});
test('local text updates do not rescan unrelated paragraph subtrees',async()=>{
 const {dom,w}=setup('<main><p id="edit">Edited paragraph.</p><section><p id="unrelated">Unrelated paragraph.</p></section></main>');w.__minimalTranslate.toggle();await settle();const original=w.getComputedStyle;const seen=[];w.getComputedStyle=el=>{seen.push(el.id);return original(el);};w.document.querySelector('#edit').firstChild.data='Changed paragraph.';await new Promise(r=>setTimeout(r,230));
 assert.ok(seen.includes('edit'));assert.ok(!seen.includes('unrelated'));w.__minimalTranslate.destroy();dom.window.close();
});


test('retries missing background receiver but not ambiguous delivery or model errors',async()=>{
 let attempts=0;
 const {dom,w,calls}=setup('<main><h1>A real article title</h1></main>',()=>{
   if(++attempts===1)throw Error('Could not establish connection. Receiving end does not exist.');
   return {text:'文章标题'};
 });
 w.__minimalTranslate.toggle();await new Promise(r=>setTimeout(r,330));
 assert.equal(calls.length,2);assert.equal(w.document.querySelector('.minimal-translation').textContent,'文章标题');
 w.__minimalTranslate.destroy();dom.window.close();
 for(const error of ['The message port closed before a response was received.', 'HTTP 429']) {
   const {dom,w,calls}=setup('<main><h1>A real article title</h1></main>',()=>{throw Error(error)});
   w.__minimalTranslate.toggle();await new Promise(r=>setTimeout(r,330));
   assert.equal(calls.length,1);const output=w.document.querySelector('.minimal-translation');
   assert.equal(output.style.fontSize,'13px');assert.equal(output.getAttribute('role'),'button');
   w.__minimalTranslate.destroy();dom.window.close();
 }
});

test('missing receiver retries are bounded and retired content is not resent',async()=>{
 const error=()=>{throw Error('Receiving end does not exist.')};
 const first=setup('<main><p>A paragraph waiting for the background.</p></main>',error);
 first.w.__minimalTranslate.toggle();await new Promise(r=>setTimeout(r,850));
 assert.equal(first.calls.length,3);
 assert.match(first.w.document.querySelector('.minimal-translation').textContent,/翻译后台未连接/);
 first.w.__minimalTranslate.destroy();first.dom.window.close();
 const second=setup('<main><p>A paragraph waiting for the background.</p></main>',error);
 second.w.__minimalTranslate.toggle();await settle();second.w.__minimalTranslate.destroy();
 await new Promise(r=>setTimeout(r,300));assert.equal(second.calls.length,1);second.dom.window.close();
});
