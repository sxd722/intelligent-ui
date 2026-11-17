import test from 'node:test'
import assert from 'node:assert/strict'
import {refinePrompt,needsRefineBackground} from '../server/cardspec/refine-prompt.mjs'
import {refineContext,REFINE_POLICY_VERSION} from '../server/cardspec/refine-policy.mjs'
test('refinement is one bounded tool-free call and preserves explicit goal',async()=>{
 let calls=0
 const result=await refinePrompt({prompt:'讲解缓存，演示命中与失效',modelProfile:'deep',cardSize:'square'},{streamUpstream:async(messages,options)=>{
  calls++;assert.match(messages[1].content,/演示命中/);assert.equal(options.modelOverride,'glm-5.3');assert.equal(options.thinking.type,'disabled');assert.equal(options.tools,undefined);assert.equal(options.research,undefined);assert.equal(options.maxTokens,3072)
  return '```markdown\n## 目标\n理解缓存\n```'
 }})
 assert.equal(calls,1);assert.equal(result.prompt,'## 目标\n理解缓存')
 assert.equal(result.policyVersion,REFINE_POLICY_VERSION)
})

test('refinement receives bounded real settings, separates full from natural height and defaults to square',()=>{
 const full=refineContext({prompt:'保留我的需求',cardSize:'full',renderMode:'hybrid',toolsEnabled:false,designPreference:'folio',designMode:'image-first',format:'dil',secret:'must not forward'})
 assert.equal(full.request,'保留我的需求');assert.match(full.layout,/完整长页/);assert.match(full.capabilities.tools,/关闭/);assert.match(full.capabilities.web,/原生为主/)
 assert.equal(full.capabilities.format,'DIL');assert.equal(full.design.family,'folio');assert.match(full.design.process,/已选/);assert(!JSON.stringify(full).includes('must not forward'))
 const natural=refineContext({cardSize:'auto',renderMode:'native',designPreference:'untrusted style'})
 assert.match(natural.layout,/自然高度/);assert.match(natural.capabilities.web,/仅原生/);assert.equal(natural.design.family,'auto')
 assert.match(refineContext().layout,/方形/)
})
test('invalid requests and invalid results never proceed to generation',async()=>{
 await assert.rejects(refinePrompt({prompt:''},{streamUpstream:()=>{throw Error('must not call')}}),/请输入/)
 for(const result of ['', '<card/>', 'x'.repeat(10001)])await assert.rejects(refinePrompt({prompt:'hi'},{streamUpstream:async()=>result}),/有效规划/)
})
test('timeout and external cancellation do not return stale drafts',async()=>{
 await assert.rejects(refinePrompt({prompt:'hi'},{timeoutMs:5,streamUpstream:async()=>{await new Promise(r=>setTimeout(r,10));return 'late'}}),/超时/)
 const controller=new AbortController()
 await assert.rejects(refinePrompt({prompt:'hi'},{signal:controller.signal,streamUpstream:async()=>{controller.abort();return 'late'}}),/取消/)
})

test('refine can resolve entity relations with bounded research; citations survive the next session',async()=>{
 let turns=0,searches=0,reads=0
 const providers={search:async()=>{searches++;return {items:[{url:'https://example.org/update',title:'官方更新',excerpt:'甲是乙玩法的俗称',kind:'search'}]}},read:async()=>{reads++;return {url:'https://example.org/update',title:'官方更新',excerpt:'甲是乙玩法的俗称，而非两个独立产品。',kind:'page'}}}
 const result=await refinePrompt({prompt:'调查甲和乙当前的口碑',toolsEnabled:true},{providers,streamUpstream:(messages,options)=>options.research.run(async(history,o)=>{
  turns++;assert.ok(!JSON.stringify(history).includes('保持最终CardSpec协议'))
  if(turns===1){assert.equal(o.toolChoice.function.name,'web_search');assert.equal(o.maxTokens,512);return {message:{tool_calls:[{id:'s',function:{name:'web_search',arguments:JSON.stringify({query:'甲 乙 关系'})}}]}}}
  if(turns===2)return {message:{tool_calls:[{id:'r',function:{name:'web_read',arguments:JSON.stringify({url:'https://example.org/update'})}}]}}
  assert.equal(o.tools,undefined);assert.match(JSON.stringify(history),/而非两个独立产品/)
  return {message:{content:'甲是乙的俗称[S1]。生成时采集真实评价并绑定；切换来源更新样本。'}}
 },messages,options)})
 assert.equal(searches,1);assert.equal(reads,1);assert.equal(turns,3)
 assert.match(result.prompt,/\[来源\]\(https:\/\/example.org\/update\)/);assert.ok(!result.prompt.includes('[S1]'))
 assert.equal(result.research.evidence[0].kind,'page');assert.equal(result.research.calls,2)
})

test('simple/offline refinement does not force searches; failed search remains evidence of failure',async()=>{
 assert.equal(needsRefineBackground('GPA计算器'),false)
 assert.equal(needsRefineBackground('不要联网，虚构新闻'),false)
 assert.equal(needsRefineBackground('当前产品口碑'),true)
 let calls=0
 const providers={search:async()=>{calls++;throw Error('search unavailable')},read:async()=>{throw Error('unexpected')}}
 const straight=await refinePrompt({prompt:'GPA计算器',toolsEnabled:false},{providers,streamUpstream:async(m,o)=>{assert.equal(o.research,undefined);return '修改成绩→更新结果'}})
 assert.equal(calls,0);assert.equal(straight.research.disabled,true)
 let turns=0
 const failed=await refinePrompt({prompt:'甲和乙的近期评价'},{providers,streamUpstream:(m,o)=>o.research.run(async(h)=>{
  if(!turns++)return {message:{tool_calls:[{id:'s',function:{name:'web_search',arguments:'{"query":"甲 乙"}'}}]}}
  assert.match(JSON.stringify(h),/search unavailable/)
  return {message:{content:'关系待核实。生成时查询真实来源，保留绑定与失败状态。'}}
 },m,o)})
 assert.equal(calls,1);assert.equal(failed.research.evidence.length,0);assert.ok(failed.research.trace.some(t=>t.status==='failed'))
 assert.match(refineContext({toolsEnabled:true}).capabilities.tools,/已启用/)
 assert.ok(!refineContext({toolsEnabled:true}).capabilities.tools.includes('当前不查询'))
})

test('a gateway ignoring the required background lookup cannot deliver an unverified brief',async()=>{
 await assert.rejects(refinePrompt({prompt:'当前甲乙口碑'},{providers:{search:async()=>({items:[]}),read:async()=>({})},streamUpstream:(m,o)=>o.research.run(async()=>({message:{content:'甲乙是两个不同产品'}}),m,o)}),error=>error.code==='BACKGROUND_LOOKUP_SKIPPED'&&error.research.trace.some(t=>t.type==='research_model'&&t.maxTokens===512))
})
