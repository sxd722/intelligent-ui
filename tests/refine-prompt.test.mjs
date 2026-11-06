import test from 'node:test'
import assert from 'node:assert/strict'
import {refinePrompt} from '../server/cardspec/refine-prompt.mjs'
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
