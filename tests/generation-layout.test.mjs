import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {generationLayout,appendGenerationContent} from '../shared/cardspec/generation-layout.mjs'
import {legacyPrompts} from '../server/prompt.mjs'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
import {createToolService} from '../server/tools/service.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {FIXTURES} from '../shared/cardspec/fixtures.mjs'
import {TOOL_DEMO,TOOL_PAGE} from '../shared/cardspec/tool-fixtures.mjs'

test('height is independent from content budget, with safe default and a smaller slot budget',()=>{
  assert.equal(generationLayout('untrusted').cardSize,'square')
  assert.equal(generationLayout('auto').height,780)
  assert.equal(generationLayout('auto').maxTokens,generationLayout('square').maxTokens)
  assert.ok(generationLayout('auto','slot:detail').maxSourceCharacters<generationLayout('auto').maxSourceCharacters)
  assert.throws(()=>appendGenerationContent('x'.repeat(24000),'x',generationLayout('auto')),{code:'GENERATION_CAPACITY'})
  for(const prompt of Object.values(legacyPrompts('auto'))){assert.match(prompt,/自然高度/);assert.doesNotMatch(prompt,/SQUARE CANVAS BUDGET|一屏正方形/)}
  assert.match(legacyPrompts().DSL_PROMPT,/SQUARE CANVAS BUDGET/)
})

async function generate(mode,cardSize,{oversize=false,failRepair=false}={}){
  const res=new EventEmitter(),frames=[],calls=[];let attempts=0
  res.writeHead=()=>{};res.write=text=>{const data=text.slice(6).trim();if(data!=='[DONE]')frames.push(JSON.parse(data))};res.end=()=>{res.writableEnded=true}
  await handleCardSpec({},res,{mode,cardSize,toolsEnabled:false,messages:[{role:'user',content:'制作可用的阅读卡'}]}, {
    keyLoaded:true,model:'test',photo:async()=>null,
    streamUpstream:async(messages,options)=>{
      calls.push({messages:structuredClone(messages),options})
      if(options.responseFormat){options.onPiece({content:JSON.stringify(messages[0].content.includes('"regions"')?{theme:{language:'soft',palette:'a'},regions:[]}:{goal:'阅读',facts:[],interactions:[]})});return}
      if(oversize&&(attempts++===0||failRepair)){options.onPiece({content:'x'.repeat(24001)});assert.fail('capacity must stop output before publishing')}
      options.onPiece({content:FIXTURES.counter})
    }
  })
  return {frames,calls}
}
test('direct and staged requests carry size through every stage without extra model calls',async()=>{
  for(const size of ['square','auto'])for(const mode of ['direct','staged']){
    const {frames,calls}=await generate(mode,size)
    assert.equal(calls.length,mode==='direct'?1:3)
    for(const {messages} of calls)assert.ok(messages[0].content.includes(size==='auto'?'【宿主布局】自然高度':'【宿主布局】方形'))
    assert.equal(frames.find(f=>f.type==='message_stream_complete').status,'succeeded')
    const spec=frames.flatMap(f=>f.v||[]).find(op=>op.v?.card_spec)?.v.card_spec
    assert.equal(spec.context.cardSize,size)
  }
})
test('over-capacity output aborts and receives exactly one compact repair, retaining the layout',async()=>{
  for(const failRepair of [false,true]){
    const {frames,calls}=await generate('direct','auto',{oversize:true,failRepair})
    assert.equal(calls.length,2);assert.ok(calls.every(c=>c.options.signal.aborted))
    assert.ok(calls[1].messages[0].content.includes('容量不随高度增长'))
    assert.equal(frames.find(f=>f.type==='message_stream_complete').status,failRepair?'failed':'succeeded')
    assert.ok(!JSON.stringify(frames).includes('x'.repeat(24001)))
  }
})
test('GLM pages and slots use the current size and bounded repair; auto height is not clamped to 432',async()=>{
  for(const target of ['page','slot:detail']){
    const calls=[]
    const service=createToolService({keyLoaded:true,photo:async()=>null,cli:{available:async()=>({available:false}),close(){}},opencli:{status:async()=>({}),available:async()=>({available:false}),close(){}},
      streamUpstream:async(messages,options)=>{calls.push({messages:structuredClone(messages),options});options.onPiece({content:calls.length===1?'x'.repeat(25000):FIXTURES.counter})}})
    try{
      const result=await service.invoke({tool:'glm.generate',target,input:{prompt:'解释选中项'},requestId:'request',pageId:'page',sessionId:'session',view:{cardSize:'auto',height:2000}},new AbortController().signal)
      assert.equal(result.kind,target==='page'?'page':'slot');assert.equal(calls.length,2)
      assert.equal(result.spec.context.cardSize,'auto')
      assert.equal(JSON.parse(calls[0].messages[1].content).pageView.height,780)
      assert.equal(calls[0].options.maxTokens,generationLayout('auto',target).maxTokens)
      assert.ok(calls.every(c=>c.options.signal.aborted))
    }finally{service.close()}
  }
})
test('page history does not override a newly changed host size',async()=>{
  let size='square';const payloads=[]
  const spec=compileCard(TOOL_DEMO,{final:true,cardId:'root'}).spec
  const session=createCardSession(spec,{getCardSize:()=>size,transport:async p=>{if(p.tool!=='glm.generate')return {kind:'json',value:{items:[],source:'QA',fetchedAt:new Date().toISOString()}};payloads.push(p);return {kind:'page',spec:compileCard(TOOL_PAGE,{final:true,cardId:'next'}).spec}}})
  session.setActivity({complete:true,enabled:true})
  try{
    await session.invoke({binding:'feed'})
    await session.invoke({binding:'explain',target:'page'})
    session.navigate(-1);size='auto'
    await session.invoke({binding:'explain',target:'page'})
    assert.deepEqual(payloads.map(p=>p.view.cardSize),['square','auto'])
  }finally{session.dispose()}
})
