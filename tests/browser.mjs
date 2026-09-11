import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve,extname} from 'node:path';
const root=resolve('extension');
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+req.url.split('?')[0]);if(!path.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'html':'text/html','js':'text/javascript','mjs':'text/javascript','css':'text/css'})[extname(path).slice(1)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
const page=await browser.newPage({viewport:{width:1200,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(({base})=>{window.chrome={storage:{local:{get:async()=>({settings:{model:'test-model'}}),set:async()=>{},setAccessLevel:async()=>{}}},permissions:{request:async()=>true},runtime:{getURL:p=>base+'/'+p,openOptionsPage:async()=>{},sendMessage:async()=>({text:'你好，这是连接测试。'})}}},{base});
await page.goto(base+'/options.html');await page.getByRole('button',{name:'保存并测试连接'}).click();await page.getByText('连接成功，可以开始翻译了。').waitFor();await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/settings.png',fullPage:true});
// A synthetic one-page PDF, no personal document is used.
const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length 57 >>\nstream\nBT /F1 16 Tf 40 340 Td (Hello bilingual reader.) Tj ET\nendstream'];let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objs.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}let x=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
await page.goto(base+'/pdf.html');await page.locator('#file').setInputFiles({name:'fixture.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)});await page.getByText('1 / 1',{exact:true}).waitFor();await page.getByRole('button',{name:'翻译本页'}).click();await page.getByText('本页翻译完成',{exact:true}).waitFor();assert.match(await page.locator('#translation').textContent(),/你好/);await page.screenshot({path:'artifacts/pdf.png',fullPage:true});assert.deepEqual(errors,[]);console.log('Browser checks passed: settings, mock connection, actual PDF parse/render, translation display.');
}finally{await browser.close();server.close();}
