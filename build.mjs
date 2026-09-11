import {copyFile,mkdir,cp} from 'node:fs/promises';
await mkdir('extension/vendor',{recursive:true});
for(const f of ['pdf.mjs','pdf.worker.mjs']) await copyFile('node_modules/pdfjs-dist/build/'+f,'extension/vendor/'+f);
for(const dir of ['cmaps','standard_fonts','wasm']) await cp('node_modules/pdfjs-dist/'+dir,'extension/vendor/'+dir,{recursive:true});
await copyFile('node_modules/pdfjs-dist/LICENSE','extension/vendor/PDFJS-LICENSE');
console.log('可加载插件目录：extension/');
