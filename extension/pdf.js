import * as pdfjs from './vendor/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=chrome.runtime.getURL('vendor/pdf.worker.mjs');
const $=s=>document.querySelector(s);let doc,num=1,text='',busy=false;const cache=new Map();
function controls(){ $('#prev').disabled=busy||!doc||num===1;$('#next').disabled=busy||!doc||num===doc.numPages;$('#translate').disabled=busy||!doc||!text.trim();$('#file').disabled=busy;}
async function show(){busy=true;controls();try{
 const page=await doc.getPage(num),viewport=page.getViewport({scale:1.6});const canvas=$('#canvas');canvas.width=viewport.width;canvas.height=viewport.height;
 await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
 const content=await page.getTextContent();text=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');
 $('#page').textContent=`${num} / ${doc.numPages}`;$('#translation').textContent=cache.get(num)||'点击「翻译本页」，查看对应译文。';
 $('#status').textContent=text.trim()?'按页对照阅读。复杂分栏、公式的文本顺序可能需要对照原文。':'此页没有可提取的文本，第一版暂不支持扫描件 OCR。';
 }catch(e){$('#status').textContent='无法读取 PDF：'+e.message;}finally{busy=false;controls();}}
$('#file').onchange=async e=>{const file=e.target.files[0];if(!file)return;busy=true;controls();try{await doc?.destroy();doc=null;cache.clear();const data=new Uint8Array(await file.arrayBuffer());doc=await pdfjs.getDocument({data,isEvalSupported:false,cMapUrl:chrome.runtime.getURL('vendor/cmaps/'),cMapPacked:true,standardFontDataUrl:chrome.runtime.getURL('vendor/standard_fonts/'),wasmUrl:chrome.runtime.getURL('vendor/wasm/')}).promise;num=1;await show();}catch(e){$('#status').textContent='打开失败：'+e.message;}finally{busy=false;controls();}};
$('#prev').onclick=()=>{num--;show()};$('#next').onclick=()=>{num++;show()};$('#settings').onclick=()=>chrome.runtime.openOptionsPage();
$('#translate').onclick=async()=>{busy=true;controls();$('#status').textContent='正在翻译本页…';try{
 const chunks=text.match(/[\s\S]{1,6000}/g)||[],out=[];
 for(const chunk of chunks){const r=await chrome.runtime.sendMessage({type:'translate',text:chunk});if(r.error)throw Error(r.error);out.push(r.text);}
 const result=out.join('\n\n');cache.set(num,result);$('#translation').textContent=result;$('#status').textContent='本页翻译完成';
 }catch(e){$('#status').textContent=e.message;}finally{busy=false;controls();}};
