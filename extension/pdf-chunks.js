// Keep the original text intact; prefer sentence/line boundaries over hard cuts.
export function splitPdfText(text,limit=1600) {
 if(!Number.isInteger(limit)||limit<2)throw Error('Invalid chunk size');
 const chunks=[];
 while(text.length>limit) {
  const prefix=text.slice(0,limit+1);
  const candidates=[...prefix.matchAll(/[.!?。！？]\s+/g)];
  let end=candidates.map(m=>m.index+m[0].length).filter(n=>n<=limit&&n>=limit/3).at(-1);
  if(!end)end=[...prefix.matchAll(/\n+/g)].map(m=>m.index+m[0].length).filter(n=>n<=limit).at(-1);
  if(!end)end=[...prefix.matchAll(/\s+/g)].map(m=>m.index+m[0].length).filter(n=>n<=limit).at(-1);
  if(!end){end=limit;if(/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end]))end--;}
  chunks.push(text.slice(0,end));text=text.slice(end);
 }
 if(text)chunks.push(text);
 return chunks;
}
