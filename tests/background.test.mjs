import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {defaults,translate,validate} from '../extension/core.js';
const source=(await readFile(new URL('../extension/background.js',import.meta.url),'utf8')).replace(/^import .*\n/,'');
function setup(){
 let handler,calls=0;const id='exampleextension';
 vm.runInNewContext(source,{defaults,translate,validate,fetch:async()=>{calls++;return {ok:true,json:async()=>({choices:[{message:{content:'你好'}}]})}},setInterval,clearInterval,chrome:{storage:{local:{setAccessLevel:async()=>{},get:async()=>({settings:{...defaults,model:'example-model'}})}},runtime:{id,getURL:p=>'chrome-extension://'+id+'/'+p,getPlatformInfo:async()=>{},onMessage:{addListener:fn=>handler=fn}}}});
 return {id,get calls(){return calls;},send:url=>new Promise(resolve=>handler({type:'test',text:'Hello'},{id,url},resolve))};
}
test('connection test accepts settings return-tab query and rejects other pages',async()=>{
 const s=setup(),base='chrome-extension://'+s.id+'/';
 assert.equal((await s.send(base+'options.html?fromTab=7')).text,'你好');
 for(const url of ['https://example.com/options.html',base+'pdf.html',base+'options.html.attacker',base+'nested/options.html'])assert.match((await s.send(url)).error,/设置页面/);
 assert.equal(s.calls,1);
});
