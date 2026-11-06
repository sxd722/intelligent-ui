import {readFile,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {loadApiKey} from '../../server/env.mjs'
import {createModelClient} from '../../server/research/model-client.mjs'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {TASK_REFERENCE,taskToolFields} from '../../shared/cardspec/task-reference.mjs'
import {registryReference} from '../../shared/cardspec/registry.mjs'
import {CASES,ROOT,DEST} from './cases.mjs'
import {inspectTask} from './browser.mjs'
const key=loadApiKey();if(!key.ok)throw Error('Gateway credential unavailable')
const model='deepseek-v4-flash',round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model}),results=[],browser=await chromium.launch({channel:'chrome',headless:true})
try{for(const c of CASES){
 const id='model-v3-'+c.id,messages=[{role:'system',content:'输出一个完整CardSpec文档，小写<card schemaVersion="1" design="business">根，不是HTML/React。字符串属性引号，JSON对象属性用{...}。用tool-view task完成支持的任务，不再手写binding/state/action/比较区。工具参数用提供的已验证输入；未知不变0。不要添加不需要的操作。'+TASK_REFERENCE+'\n'+'本轮最小组件接口：title/caption里写文本；region仅需role="content"；tool-view只需tool、input、task，可选label/style。每个sources条目只创建一个tool-view，不创建详情数据源。其内部已包括选择、读取详情、返回和比较。'},{role:'user',content:JSON.stringify({request:c.goal,sources:c.sources.map(s=>({tool:s.tool,input:s.input,...taskToolFields(s.tool)})),constraints:'320/360/432px可用，单个信息一个所有者。两来源各自一组tool-view。数据为测试工具回放，不虚构真实查询成功。'})}],trace=[],r={id,case:c.id,model,startedAt:new Date().toISOString(),modelMs:0}
 for(let i=0;i<3;i++){
  const start=Date.now();try{const response=await round(messages,{temperature:.4,maxTokens:3000,thinking:{type:'disabled'},signal:AbortSignal.timeout(90000)});r.modelMs+=Date.now()-start;trace.push({messages:structuredClone(messages),response,elapsedMs:Date.now()-start});r.source=response.message.content.trim().replace(/^```[^\n]*\n|\n```$/g,'');r.reportedModel=response.model;r.attempts=i+1
   const compiled=compileCard(r.source,{final:true,cardId:id,context:{expressionDialect:'js-v1'}});r.complete=compiled.complete;r.spec=compiled.complete?compiled.spec:null;r.diagnostics=compiled.diagnostics
   await writeFile(DEST+'/runs/'+id+'.json',JSON.stringify(r));r.browser=r.complete?await inspectTask(browser,c,id,432,'square'):null;r.passed=!!r.browser?.passed;if(!i)r.firstPass=r.passed
   await writeFile(ROOT+'/'+id+'-attempt-'+i+'.json',JSON.stringify(r,null,2));if(r.passed)break
   const feedback=[...r.diagnostics.filter(d=>d.severity==='error').map(d=>d.message),...(r.browser?.checks||[]).filter(c=>!c.passed).map(c=>c.name+': '+c.error)]
   messages.push({role:'assistant',content:r.source},{role:'user',content:'修正以下失败，保留原需求。只输出完整card，不增加无关组件：'+JSON.stringify(feedback.slice(0,4))})
  }catch(e){r.error=e.message;r.passed=false;trace.push({error:e.message,elapsedMs:Date.now()-start});break}
 }
 r.usage=trace.reduce((sum,t)=>{for(const k of ['prompt_tokens','completion_tokens','total_tokens'])sum[k]+=t.response?.usage?.[k]||0;return sum},{prompt_tokens:0,completion_tokens:0,total_tokens:0})
 r.trace=id+'-trace.json';await writeFile(ROOT+'/'+r.trace,JSON.stringify(trace,null,2));await writeFile(DEST+'/runs/'+id+'.json',JSON.stringify(r));results.push(r);await writeFile(ROOT+'/model-v3-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({id,passed:r.passed,attempts:r.attempts,modelMs:r.modelMs,error:r.error}))
}}finally{await browser.close()}
