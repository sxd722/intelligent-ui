import {mkdir,writeFile} from 'node:fs/promises'
const out='artifacts/sandbox-qa';await mkdir(out,{recursive:true})
const goal='做一个小型储能调度模拟器，用示例数据：初始60能量，每推进一步消耗10，充能加15且上限100。能量不足不能推进，展示能量、已完成步数，可以重置。用视觉主体展示变化，少文字。'
async function run(mode){
 const start=Date.now(),frames=[]
 const prompt=goal+(mode==='hybrid'?' 使用一个sandbox增强SVG仪表，同时提供能完成全部操作的原生CardSpec fallback；state声明在根下，sandbox只声明brief、input、initial，不写JS。':' 仅用原生CardSpec，所有功能必须可直接完成。')
 const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',renderMode:mode,toolsEnabled:false,cardSize:'auto',messages:[{role:'user',content:prompt}]}),signal:AbortSignal.timeout(310000)})
 let buffer='',source='',spec,resources,status,error;const decoder=new TextDecoder()
 for await(const chunk of response.body){buffer+=decoder.decode(chunk,{stream:true});let at;while((at=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,at);buffer=buffer.slice(at+2);for(const line of block.split('\n'))if(line.startsWith('data:')&&line.slice(5).trim()!=='[DONE]'){
  const f=JSON.parse(line.slice(5));frames.push({ms:Date.now()-start,frame:f});
  if(f.type==='message_stream_complete')status=f.status;if(f.type==='stream_error')error=f.error
  if(f.o==='patch')for(const p of f.v){if(p.p==='/message/content/parts/0')source=p.o==='replace'?p.v:source+p.v;if(p.v?.card_spec)spec=p.v.card_spec;if(p.v?.resources)resources=p.v.resources}
 }}}
 const result={mode,prompt,status,error,elapsedMs:Date.now()-start,source,spec,resources,frames}
 await writeFile(`${out}/live-${mode}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({mode,status,error,elapsedMs:result.elapsedMs,sandbox:spec?.children.some(n=>n.type==='sandbox')}))
}
await Promise.all((process.argv[2]?[process.argv[2]]:['native','hybrid']).map(run))
