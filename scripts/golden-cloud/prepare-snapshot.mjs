import fs from'node:fs/promises';import path from'node:path';import{createHash}from'node:crypto';
const raw=JSON.parse(await fs.readFile('artifacts/golden-snapshot/capture.json','utf8')),target='sites/intelligent-ui/golden';
const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['assetRef','assetKind'].includes(k)).map(([k,x])=>[k,clean(x)])):v;
const sha=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
await fs.mkdir(target+'/snapshots',{recursive:true});await fs.mkdir(target+'/snapshot-media',{recursive:true});
for(const id of ['movie-night','mag7-market']){
 const calls=raw.calls.filter(c=>c.status==='success'&&(id==='movie-night'?c.tool.startsWith('opencli.douban.'):!c.tool.startsWith('opencli.douban.')));
 if(!calls.length)throw Error('No captured results for '+id);
 const requests=calls.map(c=>{const value=clean(c.result.value);return {tool:c.tool,input:c.input,startedAt:c.startedAt,finishedAt:c.finishedAt,requestId:c.requestId,cache:c.result.cache||null,value,sha256:sha(value)}});
 const data={mode:'recorded-live',batch:{id:raw.id,startedAt:raw.startedAt,finishedAt:raw.finishedAt,capture:'Local host /api/tools/invoke, cache:reload; browser-side replay after publication'},requests,images:id==='movie-night'?raw.images:[]};
 await fs.writeFile(`${target}/snapshots/${id}.json`,JSON.stringify(data,null,2));
}
for(const image of raw.images||[]){const bytes=await fs.readFile('artifacts/golden-snapshot/media/'+image.file);if(createHash('sha256').update(bytes).digest('hex')!==image.sha256)throw Error('Image hash mismatch');await fs.copyFile('artifacts/golden-snapshot/media/'+image.file,target+'/snapshot-media/'+image.file)}
const manifest=JSON.parse(await fs.readFile(target+'/manifest.json','utf8'));manifest.mode='mixed';for(const c of manifest.cases){c.dataMode=['movie-night','mag7-market'].includes(c.id)?'recorded-live':'mock';if(c.dataMode==='recorded-live')c.capturedAt=raw.finishedAt}await fs.writeFile(target+'/manifest.json',JSON.stringify(manifest,null,2));
console.log('Prepared public frozen responses and source image bytes; no secrets or browser session data exported.');
