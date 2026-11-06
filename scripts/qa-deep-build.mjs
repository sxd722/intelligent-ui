import {mkdir,writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const opts=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')))
const cases=[
 {id:'computer',prompt:'大学生逢考必过，清华贵系计算机组成原理历年考题合集10题且可以刷新，并配上系统性的知识梳理和讲解，有交互和动画'},
 {id:'energy',prompt:'家用电量交互试算：冰箱100W每天24小时，灯20W每天5小时。可改灯时长0–12小时，同步显示每天用电总量和贡献图，点击查看计算解释，重置恢复。示例数据，无需联网。'},
 {id:'camp',prompt:'三回合营地模拟，初始食物5体力5，每回合采集花2体力加3食物或休息花1食物加2体力，资源不能为负，每回合先看到结果再进入下一回合，三回合后总结并可重开。用可变化的图形表现资源，不需真实数据。'},
 {id:'quick',mode:'quick',prompt:'做一个计数器，点击增加或减少，不能小于零，可以归零。'}
].filter(c=>!opts.ids||opts.ids.split(',').includes(c.id))
const root=opts.out||'artifacts/deep-build-qa/live';await mkdir(root,{recursive:true})
for(const c of cases){
 const started=Date.now(),frames=[],envelope={},applier=createDeltaApplier(),decoder=new TextDecoder();let buffer='',error,status
 const payload={format:'cardspec',mode:'direct',buildMode:opts.mode||c.mode||'deep',generationProfile:'adaptive-v1',expressionDialect:'js-v1',modelProfile:opts.model||'default',cardSize:opts.size||'auto',renderMode:opts.render||'hybrid',toolsEnabled:c.id==='computer',messages:[{role:'user',content:c.prompt}]}
 console.log(JSON.stringify({id:c.id,status:'started',time:new Date().toISOString()}))
 try{const r=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(630000)});if(!r.ok)throw Error('HTTP '+r.status)
 for await(const bytes of r.body){buffer+=decoder.decode(bytes,{stream:true});let n;while((n=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,n);buffer=buffer.slice(n+2);for(const line of block.split('\n')){if(!line.startsWith('data:'))continue;const s=line.slice(5).trim();if(s==='[DONE]')continue;const f=JSON.parse(s);frames.push({ms:Date.now()-started,frame:f});if(f.type==='message_stream_complete')status=f.status;if(f.type==='stream_error')error=f.error;if(f.type==='build_progress'||f.type==='debug'&&f.status!=='running')console.log(JSON.stringify({id:c.id,ms:Date.now()-started,type:f.type,stage:f.stage,message:f.message,status:f.status,codes:f.diagnostics?.map(d=>d.code)}));if(!isControlEvent(f))applier.apply(envelope,f)}}}
 }catch(e){error=e.message}
 const result={id:c.id,prompt:c.prompt,payload,status,error,elapsedMs:Date.now()-started,message:envelope.message,frames}
 await writeFile(`${root}/${c.id}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({id:c.id,status,error,elapsedMs:result.elapsedMs,spec:!!envelope.message?.metadata?.card_spec}))
}
