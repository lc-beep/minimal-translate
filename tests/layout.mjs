import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile('extension/content.js','utf8');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 // Reproduce the reported structure: a wide outer wrapper, width on P only,
 // and two logical paragraphs separated by BRs inside that P.
 await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
 body{margin:0;background:#faf9f6;color:#20201e}article{padding:72px 24px}p{font:24px/1.55 Georgia,'Songti SC',serif;max-width:760px;margin:0 auto 38px}a{color:inherit;text-decoration:underline;text-underline-offset:4px}p:empty{display:none}
 @media(max-width:800px){article{padding:32px 24px}p{font-size:20px}}
 </style></head><body><article>
 <p><em>Start reading with our <a href="https://example.com/docs">documentation</a>.</em><br><br>Good translation keeps the original paragraph close to its translation. Readers can follow <a href="https://example.com/ideas">the main idea</a> and compare details without losing their place. The page should keep its original typography and reading width.</p>
 <p>A simple tool should stay out of the way. Its controls can be small, while the text remains comfortable to read. <strong>Preserve the content</strong>, keep useful links, and let the reader choose when to translate.</p>
 </article></body></html>`);
 await page.evaluate(()=>{
 window.calls=[];
 window.chrome={runtime:{sendMessage:async m=>{
 window.calls.push(m);
 if(m.text.includes('Start reading'))return {text:'[[JY2]]请阅读我们的[[JY1]]使用文档[[/JY1]]，开始双语阅读。[[/JY2]]'};
 if(m.text.includes('Good translation'))return {text:'好的翻译会让原文与译文紧密相邻。读者可以跟随[[JY1]]文章的主要观点[[/JY1]]，随时对照细节，而不必重新寻找阅读位置。页面应保留原有的字体和正文宽度。'};
 return {text:'简单的工具应尽量减少干扰。操作按钮可以很小，文字仍应保持舒适易读。[[JY1]]保留内容[[/JY1]]和有用的链接，让读者自己决定何时翻译。'};
 }}};
 });
 await page.addScriptTag({content:source});
 await page.getByRole('button',{name:'简译 · 翻译网页',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.minimal-translation').length===3&&[...document.querySelectorAll('.minimal-translation')].every(n=>!n.textContent.includes('翻译中')));
 async function check(){
 const rects=await page.locator('.minimal-translation').evaluateAll(nodes=>nodes.map(n=>{const a=n.getBoundingClientRect(),b=n.parentElement.getBoundingClientRect();return {left:a.left,right:a.right,sourceLeft:b.left,sourceRight:b.right,font:getComputedStyle(n).fontSize,sourceFont:getComputedStyle(n.parentElement).fontSize};}));
 for(const r of rects){assert.ok(Math.abs(r.left-r.sourceLeft)<1);assert.ok(Math.abs(r.right-r.sourceRight)<1);assert.equal(r.font,r.sourceFont);}
 assert.equal(await page.locator('.minimal-translation a').count(),2);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await check();await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/web-reading-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await check();await page.screenshot({path:'artifacts/web-reading-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'简译 · 隐藏译文',exact:true}).click();assert.equal(await page.locator('.minimal-translation:visible').count(),0);
 await page.getByRole('button',{name:'简译 · 翻译网页',exact:true}).click();assert.equal(await page.locator('.minimal-translation:visible').count(),3);assert.equal(await page.evaluate(()=>calls.length),3);
 console.log('Layout passed at 1440px and 390px: source/translation bounds and font match, links restored, no horizontal overflow, floating toggle works without repeat requests.');
}finally{await browser.close();}
