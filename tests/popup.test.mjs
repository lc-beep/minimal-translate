import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=await readFile(new URL('../extension/popup.js',import.meta.url),'utf8');
test('persistent launcher grants only selected website and does not auto-translate',async()=>{
 const dom=new JSDOM('<button id="settings"></button><button id="pdf"></button><button id="translate"></button><button id="floating"></button><p id="status"></p>',{runScripts:'outside-only'});
 const w=dom.window,calls=[],existing={id:'minimal-floating',matches:['https://old.example/*']};
 w.chrome={runtime:{},storage:{local:{}},tabs:{query:async()=>[{id:7,url:'https://article.example/read?private=ignored'}]},permissions:{request:async data=>{calls.push(['permissions',data]);return true;}},scripting:{getRegisteredContentScripts:async()=>[existing],updateContentScripts:async data=>calls.push(['update',data]),executeScript:async data=>calls.push(['inject',data])}};
 w.eval(source);await w.document.querySelector('#floating').onclick();
 assert.equal(JSON.stringify(calls[0]),JSON.stringify(['permissions',{origins:['https://article.example/*']}])) ;
 assert.deepEqual([...calls[1][1][0].matches],['https://old.example/*','https://article.example/*']);
 assert.equal(calls[2][1].files[0],'content.js');assert.equal(calls[2][1].func,undefined);assert.match(w.document.querySelector('#status').textContent,/点击后才翻译/);dom.window.close();
});
