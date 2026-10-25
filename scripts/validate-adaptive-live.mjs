import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {getQuickJS} from 'quickjs-emscripten'
import {createSandboxVM} from '../shared/cardspec/sandbox-engine.mjs'
const base='http://127.0.0.1:8787',dir='artifacts/adaptive-eval-v2'
await mkdir(dir,{recursive:true})
const mode=process.argv[2]||'workflow'
const connection=()=>fetch(base+'/api/tools/connections').then(r=>r.json())
const before=await connection()
async function call(tool,input,target='binding',view={}){
 const started=Date.now(),frames=[]
 const response=await fetch(base+'/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool,input,target,view,cause:'user',sessionId:'adaptive-live-validation',pageId:'validation',requestId:randomUUID()}),signal:AbortSignal.timeout(305000)})
 const raw=await response.text()
 for(const line of raw.split('\n'))if(line.startsWith('data: ')){try{frames.push(JSON.parse(line.slice(6)))}catch{}}
 const result=frames.findLast(f=>f.type==='result')?.result,error=frames.findLast(f=>f.type==='error')
 return {tool,input,target,elapsedMs:Date.now()-started,status:result?'succeeded':'failed',result,error,frames,...(!response.ok?{httpStatus:response.status,raw}:{} )}
}
if(mode==='workflow'){
 const workflow=await call('workflow.run',{steps:[
  {id:'news',tool:'opencli.google.news',input:{keyword:'尊界 刹车',limit:3,lang:'zh-CN',region:'CN'}},
  {id:'videos',tool:'opencli.bilibili.search',input:{query:'尊界 刹车',type:'video',limit:3}}
 ]})
 await writeFile(dir+'/live-workflow.json',JSON.stringify({startedAt:new Date().toISOString(),before,workflow,summary:'实际来源测试进行中'},null,2))
 const rows=workflow.result?.value?.items||[]
 const bvid=rows.map(r=>r.bvid||r.id||r.url?.match(/BV[\w]+/)?.[0]).find(id=>/^BV[\w]+$/.test(id||''))
 const comments=bvid?await call('opencli.bilibili.comments',{bvid,limit:6}):null
 const samples=comments?.result?.value?.items||[]
 const analysis=samples.length?await call('dataset.analyze',{items:samples.slice(0,6),instruction:'只按这些用户评论的原文，分类对该车辆的态度：正面、负面、中性、无法判断。没有明确态度用无法判断，不把猜测当事实。每条引用原文。'}):null
 const after=await connection()
 const bindingPreserved=before.browser?.binding?.session===after.browser?.binding?.session&&before.browser?.daemonPid===after.browser?.daemonPid&&after.browser?.binding?.bound
 const stages=workflow.result?.value?.steps||[]
 const summary=`真实工作流 ${stages.filter(s=>s.status==='succeeded').length}/${stages.length} 个来源成功，返回 ${rows.length} 条；用户评论 ${samples.length} 条；分类${analysis?.status==='succeeded'?'通过引文校验':'未完成'}；原绑定${bindingPreserved?'保持':'变化，需检查'}。仅样本，不代表全网舆情。`
 await writeFile(dir+'/live-workflow.json',JSON.stringify({before,workflow,comments,analysis,after,bindingPreserved,summary},null,2))
 console.log(summary);if(!bindingPreserved)process.exitCode=1
}else{
 const input={prompt:'制作一张房间布置实验：2×2网格，书桌初始在左上；一个按钮标签必须是“移动书桌”，每次点击把书桌移动到下一个格子。另一个按钮“重置”恢复左上。用SVG俯视房间与书桌，少文字，不用列表。位置保存于state.cell（0到3），不需要其他状态。显示当前位置编号，柔和青绿色、现代留白。',context:{data:{cells:4},initial:{cell:0}}}
 const generated=await call('glm.generate',input,'sandbox:room',{renderMode:'hybrid',generationProfile:'adaptive-v1',width:360,height:300})
 const checks=[]
 try{
  assert.equal(generated.status,'succeeded',JSON.stringify(generated.error))
  const Q=await getQuickJS(),code=generated.result.module.code
  const vm=createSandboxVM(Q,{code,input:input.context.data,state:{cell:0}})
  const find=(t,label)=>Array.isArray(t)?t.map(v=>find(v,label)).find(Boolean):t&&typeof t==='object'?(t.type==='button'&&JSON.stringify(t.children).includes(label)?t:t.children.map(v=>find(v,label)).find(Boolean)):null
  let v=vm.snapshot()
  for(let i=1;i<=2;i++){const b=find(v.tree,'移动书桌');assert.ok(b);v=vm.event(b.props.onClick.handler,{});assert.equal(v.state.cell,i)}
  checks.push('两次点击真实改变位置 0 → 1 → 2')
  const saved=v.state;vm.dispose()
  const restored=createSandboxVM(Q,{code,input:input.context.data,state:saved});v=restored.snapshot();assert.equal(v.state.cell,2);checks.push('重建 VM 恢复位置 2')
  v=restored.event(find(v.tree,'重置').props.onClick.handler,{});assert.equal(v.state.cell,0);checks.push('重置恢复位置 0');restored.dispose()
 }catch(e){checks.push('FAIL: '+e.message);process.exitCode=1}
 const after=await connection(),summary=`真实 GLM React 生成${generated.status==='succeeded'?'成功':'失败'}，${(generated.elapsedMs/1000).toFixed(1)} 秒；${checks.join('；')}。`
 const output=process.argv[3]||'hybrid.json'
 await writeFile(dir+'/'+output,JSON.stringify({before,generated,checks,after,summary},null,2));console.log(summary)
}
