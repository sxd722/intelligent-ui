import {invokeTool} from '../src/baseline/transport.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
const base='http://127.0.0.1:8787',dir='artifacts/sentiment-fallback';await mkdir(dir,{recursive:true})
const before=await(await fetch(base+'/api/tools/connections')).json(),results=[]
async function probe(tool,input){
 const started=Date.now(),frames=[]
 try{const value=await invokeTool(tool,input,{sessionId:crypto.randomUUID(),pageId:'sentiment-probe',signal:AbortSignal.timeout(60000),fetcher:async(p,o)=>{const r=await fetch(base+p,o);frames.push(await r.clone().text());return r}})
 results.push({tool,input,value,ms:Date.now()-started,passed:true,frames});console.log(JSON.stringify({tool,items:value.items?.length,ms:Date.now()-started}));return value
 }catch(e){results.push({tool,input,error:e.message,frames,ms:Date.now()-started,passed:false});console.log(JSON.stringify({tool,error:e.message,frames}))}
 finally{await writeFile(`${dir}/live.json`,JSON.stringify({before,results},null,2))}
}
await probe('opencli.weibo.search',{keyword:'尊界 刹车',limit:5})
await probe('opencli.xiaohongshu.search',{query:'尊界 刹车',limit:5})
const videos=await probe('opencli.bilibili.search',{query:'尊界 刹车',type:'video',limit:5})
for(const video of videos?.items?.slice(0,2)||[]){const bvid=video.url?.match(/BV[A-Za-z0-9]+/)?.[0];if(bvid)await probe('opencli.bilibili.comments',{bvid,limit:10})}
const after=await(await fetch(base+'/api/tools/connections')).json()
await writeFile(`${dir}/live.json`,JSON.stringify({before,after,preserved:before.browser?.binding?.session===after.browser?.binding?.session&&before.browser?.daemonPid===after.browser?.daemonPid,results},null,2))
