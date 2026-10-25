import {invokeTool} from '../src/baseline/transport.mjs';
import {nextWeekend} from '../src/baseline/core.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:8787',dir='artifacts/h5-baseline-qa';await mkdir(dir,{recursive:true});
const before=await(await fetch(base+'/api/tools/connections')).json(),catalog=await(await fetch(base+'/api/tools')).json();
const results=[],sessionId=crypto.randomUUID();
for(const [tool,input]of [
 ['opencli.google.search',{keyword:'尊界 刹车 新闻 报道',lang:'zh',limit:5}],
 ['opencli.douban.search',{keyword:'星际穿越',type:'movie',limit:3}],
 ['opencli.ctrip.search',{query:'杭州 萧山 亲子',limit:5}],
 ['opencli.12306.trains',{from:'杭州东',to:'上海虹桥',date:nextWeekend()[0],limit:5,departureAfter:'12:00',departureBefore:'18:00',exactStations:true}],
 ]){
 const start=Date.now();try{const value=await invokeTool(tool,input,{sessionId,pageId:'baseline-probe',signal:AbortSignal.timeout(45000),fetcher:(p,o)=>fetch(base+p,o)});results.push({tool,input,passed:true,ms:Date.now()-start,value})}catch(e){results.push({tool,input,passed:false,ms:Date.now()-start,error:e.message})}
 await writeFile(dir+'/live.json',JSON.stringify({at:new Date().toISOString(),before,catalog,results},null,2));console.log(tool,results.at(-1).passed?`OK ${results.at(-1).value.items?.length} items`:results.at(-1).error);
}
const after=await(await fetch(base+'/api/tools/connections')).json();await writeFile(dir+'/live.json',JSON.stringify({at:new Date().toISOString(),before,after,catalog,results,preserved:before.browser?.binding?.session===after.browser?.binding?.session&&before.browser?.daemonPid===after.browser?.daemonPid},null,2));
