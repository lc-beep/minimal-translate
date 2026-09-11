import test from 'node:test';
import assert from 'node:assert/strict';
import {splitPdfText} from '../extension/pdf-chunks.js';
test('PDF chunks preserve every character and prefer sentence boundaries',()=>{
 const text=('A research sentence with terminology. Another sentence with citation [12].\n').repeat(100);
 const chunks=splitPdfText(text);assert.equal(chunks.join(''),text);
 assert.ok(chunks.length>1);assert.ok(chunks.every(c=>c.length<=1600));
 assert.ok(chunks.slice(0,-1).every(c=>/[.\n]\s*$/.test(c)));
});
test('PDF chunks handle long tokens, unicode and empty pages without loss',()=>{
 for(const text of ['', 'x'.repeat(5000),'😀'.repeat(2500),'正文。'.repeat(1800)]) {
 const chunks=splitPdfText(text);assert.equal(chunks.join(''),text);
 assert.ok(chunks.every(c=>c.length<=1600&&!/[\uD800-\uDBFF]$/.test(c)));
 }
 assert.throws(()=>splitPdfText('abc',0));
});

test('prefers complete sentences over later PDF line wraps',()=>{
 const text='An earlier complete sentence. '+('A continued line\n'.repeat(8))+'ends here.';
 const chunks=splitPdfText(text,80);assert.equal(chunks[0],'An earlier complete sentence. ');assert.equal(chunks.join(''),text);
});
