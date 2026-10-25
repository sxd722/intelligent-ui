import {mkdir,writeFile} from 'node:fs/promises'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {generationModelOptions} from '../shared/cardspec/generation-settings.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const dir='artifacts/model-integration';await mkdir(dir,{recursive:true})
const key=loadApiKey(),round=createModelClient({base:'https://model-gateway.example.invalid/v1',key:key.value,model:'glm-5.3-flash'}),summary=[]
for(const profile of ['deepseek-flash','qwen-flash']){
 const options={...generationModelOptions(profile),maxTokens:1024,signal:AbortSignal.timeout(60000)}
 const tools=[{type:'function',function:{name:'inspect_sample',description:'Return a controlled QA sample. No external effects.',parameters:{type:'object',required:['id'],properties:{id:{type:'string'}}}}}]
 const history=[{role:'user',content:'Call inspect_sample with id demo, then state its returned number.'}]
 const first=await round(history,{...options,tools,toolChoice:{type:'function',function:{name:'inspect_sample'}}})
 if(first.message.tool_calls?.length!==1||first.message.tool_calls[0].function.name!=='inspect_sample')throw Error(profile+' did not call tool')
 const call=first.message.tool_calls[0];const second=await round([...history,first.message,{role:'tool',tool_call_id:call.id,content:'{"number":42}'}],options)
 if(!second.message.content.includes('42'))throw Error(profile+' tool continuation failed')
 const record={profile,toolCalling:true,toolContinuation:true,toolModels:[first.model,second.model]}
 const prompt='做一张储能实验卡。原生滑块“能量”控制0到100，初始30。React sandbox以SVG圆环显示相同能量，并有“充能”按钮通过bridge增加共享值10。再用沙箱持久state显示“观察”按钮的点击次数。使用内联CSS。所有React源码随卡生成，不要fallback、不要外部工具。'
 const start=Date.now(),frames=[],state={},apply=createDeltaApplier();let buffer='';const decoder=new TextDecoder()
 const r=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',modelProfile:profile,renderMode:'hybrid',expressionDialect:'js-v1',toolsEnabled:false,debugGeneration:true,messages:[{role:'user',content:prompt}]}),signal:AbortSignal.timeout(900000)})
 for await(const bytes of r.body){buffer+=decoder.decode(bytes,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);for(const line of block.split('\n')){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(raw==='[DONE]')continue;const f=JSON.parse(raw);frames.push(f);if(!isControlEvent(f))apply.apply(state,f)}}}
 Object.assign(record,{elapsedMs:Date.now()-start,status:frames.findLast(f=>f.type==='message_stream_complete')?.status,metadata:frames.findLast(f=>f.type==='server_ste_metadata')?.metadata,error:frames.findLast(f=>f.type==='stream_error')?.error})
 await writeFile(`${dir}/${profile}.json`,JSON.stringify({record,message:state.message,frames},null,2));summary.push(record);console.log(JSON.stringify(record));await writeFile(`${dir}/summary.json`,JSON.stringify(summary,null,2))
 if(record.status!=='succeeded')process.exitCode=1
}
