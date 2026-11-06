import fs from'node:fs/promises';import{createHash,randomUUID}from'node:crypto';
const root='artifacts/golden-snapshot',file=root+'/capture.json',base='http://127.0.0.1:8787';await fs.mkdir(root,{recursive:true});
const data=await fs.readFile(file,'utf8').then(JSON.parse).catch(()=>({version:1,id:randomUUID(),startedAt:new Date().toISOString(),calls:[]}));
const key=(tool,input)=>JSON.stringify([tool,Object.entries(input).sort()]);
const save=()=>fs.writeFile(file,JSON.stringify(data,null,2));
async function invoke(tool,input){
 const previous=data.calls.find(c=>c.key===key(tool,input)&&c.status==='success');if(previous)return previous.result.value;
 const rec={key:key(tool,input),tool,input,startedAt:new Date().toISOString(),requestId:randomUUID(),events:[]};data.calls.push(rec);await save();
 try{const r=await fetch(base+'/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({tool,input,requestId:rec.requestId,pageId:'golden-snapshot',sessionId:data.id,target:'binding',cause:'user',cache:'reload'}),signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('HTTP '+r.status);const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='',done=false,error;try{while(!done){const part=await reader.read();if(part.done)break;buffer+=decoder.decode(part.value,{stream:true});let boundary;while((boundary=/\r?\n\r?\n/.exec(buffer))){const block=buffer.slice(0,boundary.index);buffer=buffer.slice(boundary.index+boundary[0].length);for(const line of block.split('\n'))if(line.startsWith('data:')){const e=JSON.parse(line.slice(5));rec.events.push(e);if(e.type==='result')rec.result=e.result;if(e.type==='error')error=e.error;if(e.type==='done')done=true}}}}finally{await reader.cancel().catch(()=>{})}if(error||!rec.result?.value?.items)throw Error(error||'Missing result');rec.status='success';rec.resultHash=createHash('sha256').update(JSON.stringify(rec.result.value)).digest('hex');console.log(tool,JSON.stringify(input),rec.result.value.items.length,'rows',rec.result.cache?.status||'');return rec.result.value}catch(e){rec.status='failed';rec.error=e.message;console.log('FAILED',tool,e.message);throw e}finally{rec.finishedAt=new Date().toISOString();await save()}
}
if(!process.env.CAPTURE_GROUP||process.env.CAPTURE_GROUP==='movie'){
 const hot=await invoke('opencli.douban.movie-hot',{limit:12}),classic=await invoke('opencli.douban.top250',{limit:12});
 for(const id of [...new Set([...hot.items,...classic.items].map(r=>String(r.id)))])await invoke('opencli.douban.subject',{id,type:'movie'});
 const photos=new Map([...hot.items,...classic.items].map(r=>[String(r.id),r]));for(const c of data.calls.filter(c=>c.tool==='opencli.douban.subject'&&c.status==='success'))for(const row of c.result.value.items)photos.set(String(row.id),{...photos.get(String(row.id)),...row});
 for(const [id,row]of photos)if(!row.assetRef&&!row.poster&&!row.cover&&!row.image_url&&!row.image){const p=await invoke('opencli.douban.photos',{id,type:'Rb',limit:1});const actual=p.items.find(r=>!r.subject_id||String(r.subject_id)===id);if(actual)photos.set(id,{...row,...actual,id,title:row.title})}
 await fs.mkdir(root+'/media',{recursive:true});data.images??=[];
 for(const [id,row]of photos){
  if(data.images.some(x=>x.entityId===id))continue;
  const candidates=[{url:row.poster||row.cover||row.image_url||row.image,ref:row.assetRef}];let selected;
  const readImage=async candidate=>{if(!candidate.url&&!candidate.ref)return null;const u=candidate.ref?base+'/api/tools/assets/'+encodeURIComponent(candidate.ref):base+'/api/tools/media?url='+encodeURIComponent(candidate.url);const r=await fetch(u,{signal:AbortSignal.timeout(90000)});if(!r.ok){console.log('Image variant unavailable',id,r.status);return null}const mime=r.headers.get('content-type')||'';if(!mime.startsWith('image/'))return null;return {bytes:Buffer.from(await r.arrayBuffer()),mime,url:candidate.url}};
  for(const candidate of candidates){selected=await readImage(candidate);if(selected)break}
  if(!selected){const p=await invoke('opencli.douban.photos',{id,type:'Rb',limit:1});const actual=p.items.find(r=>!r.subject_id||String(r.subject_id)===id);if(actual){for(const candidate of [{url:actual.image_url,ref:actual.assetRef},{url:actual.thumb_url}]){selected=await readImage(candidate);if(selected)break}}}
  if(!selected){const p=await invoke('opencli.douban.photos',{id,type:'Rb',limit:3});for(const actual of p.items.filter(r=>!r.subject_id||String(r.subject_id)===id)){selected=await readImage({url:actual.image_url,ref:actual.assetRef});if(selected)break}}
  if(!selected)throw Error('Unable to preserve original source image '+id);
  const {bytes,mime,url}=selected,ext=mime.includes('png')?'png':mime.includes('webp')?'webp':mime.includes('avif')?'avif':'jpg',name=id+'.'+ext;
  await fs.writeFile(root+'/media/'+name,bytes);data.images.push({entityId:id,title:row.title,url,mime,bytes:bytes.length,file:name,sha256:createHash('sha256').update(bytes).digest('hex'),capturedAt:new Date().toISOString()});await save();console.log('poster',id,bytes.length)
 }
}
if(!process.env.CAPTURE_GROUP||process.env.CAPTURE_GROUP==='finance'){
 const symbols={AAPL:'Apple',MSFT:'Microsoft',GOOGL:'Alphabet',AMZN:'Amazon',NVDA:'Nvidia',META:'Meta',TSLA:'Tesla'};
 await invoke('opencli.eastmoney.quote',{symbols:Object.keys(symbols).join(',')});
 for(const [symbol,company]of Object.entries(symbols)){for(const range of['1d','5d','1mo'])await invoke('opencli.yahoo-finance.chart',{symbol,range});await invoke('opencli.yahoo-finance.news',{symbol,company,limit:8})}
}
data.finishedAt=new Date().toISOString();await save();console.log('Capture complete:',data.calls.filter(c=>c.status==='success').length,'successful requests;',data.images?.length||0,'source images');
