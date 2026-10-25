import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {diagnosticContext} from '../shared/cardspec/diagnostic-context.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {generationHistory} from '../src/generation-history.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'

test('source context keeps original fenced CRLF positions and bounded single-line excerpts',()=>{
 const source='```xml\r\n<card>\r\n<text>{state.missing}</text>\r\n</card>\r\n```'
 const errors=compileCard(source,{final:true}).diagnostics.filter(d=>d.severity==='error')
 assert.ok(errors.length)
 for(const d of errors){assert.ok(d.context);assert.equal(d.context.text,source.slice(d.context.startOffset,d.context.endOffset));assert.equal(d.offset,d.context.startOffset+d.context.caretOffset);assert.equal(d.line,source.slice(0,d.offset).split('\n').length)}
 const d=diagnosticContext('x'.repeat(20000),{offset:10000})
 assert.equal(d.context.text.length,480);assert.equal(d.column,10001)
 assert.equal(diagnosticContext('\n',{offset:0}).column,1)
 assert.equal(diagnosticContext('abc',{message:'no location'}).context,undefined)
})

test('rich content failures identify the component and its source, not a fabricated JS position',async()=>{
 const source='<card>\n<math id="equation" value="\\badcommand"/>\n</card>'
 const result=compileCard(source,{final:true});await validateRichContent(result)
 const d=result.diagnostics.find(d=>d.code==='rich_content')
 assert.equal(d.nodeId,'equation');assert.equal(d.locationKind,'component');assert.equal(d.line,2);assert.match(d.context.text,/badcommand/)
})

test('a repaired completed request never leaves repair instructions or a candidate for the next request',async()=>{
 const old='<card><region role="supporting"><text>已完成的旧任务</text></region></card>',fresh='<card><title>全新的预算助手</title></card>'
 async function request(prompt,history=[],repair=false){
  const res=new EventEmitter(),frames=[],envelope={},apply=createDeltaApplier();let calls=0
  res.writeHead=()=>{};res.flushHeaders=()=>{};res.end=()=>{res.writableEnded=true}
  res.write=s=>{const data=s.slice(6).trim();if(data==='[DONE]')return;const f=JSON.parse(data);frames.push(f);if(!isControlEvent(f))apply.apply(envelope,f)}
  await handleCardSpec({},res,{turnId:prompt,mode:'direct',messages:[...history,{role:'user',content:prompt}]},{keyLoaded:true,model:'test',photo:async()=>null,
   streamUpstream:async(messages,o)=>{
    calls++
    if(!repair){assert.equal(JSON.parse(messages.at(-1).content).request,prompt);assert.ok(!messages.some(m=>m.role==='assistant'));assert.ok(!messages.some(m=>m.content.startsWith('修复以下诊断')))}
    o.onPiece({content:repair?(calls===1?'<card><unknown/></card>':old):fresh})
   }})
  assert.equal(frames.findLast(f=>f.type==='message_stream_complete').status,'succeeded',JSON.stringify(frames.findLast(f=>f.type==='stream_error')))
  return {message:envelope.message,calls}
 }
 const a=await request('旧任务',[],true)
 assert.equal(a.calls,2);assert.equal(a.message.metadata.validated_source,old);assert.equal(a.message.content.parts[0],old)
 assert.ok(a.message.metadata.diagnostics.some(d=>d.severity==='warning'))
 const history=generationHistory([{role:'user',content:'旧任务'},{role:'assistant',format:'cardspec',status:'succeeded',phases:[{message:a.message}]}],'cardspec','新任务',m=>m.phases[0].message.metadata.validated_source).slice(0,-1)
 const b=await request('新任务',history)
 assert.equal(b.calls,1);assert.equal(b.message.metadata.validated_source,fresh);assert.equal(b.message.content.parts[0],fresh)
})
