import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {weatherJournal} from '../shared/cardspec/experience-fixtures.mjs'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
test('typographic expression delimiters preserve inner punctuation and syntax boundaries',()=>{
 const r=compileCard('<card schemaVersion=“1”><data id="v" value={[“晴”,“多云”]}/><text>她说：“晴天”</text></card>',{final:true});assert.equal(r.complete,true,JSON.stringify(r.diagnostics));assert.match(r.spec.children[0].children[0].value.value,/“晴天”/)
})
test('weather record indexing, deduplication and draft changes work across selection and month',()=>{
 const r=compileCard(weatherJournal,{final:true});assert.equal(r.complete,true);const s=createStore();makeScope(r.spec,s)
 const act=(id,extra={})=>executeAction(r.spec,s,id,extra)
 act('draft',{args:{w:'晴'}});act('note',{event:{value:'带伞'}});act('save');act('save');assert.deepEqual(s.values.marked,['2026-10-13'])
 act('pick',{event:{date:'2026-10-14'}});assert.equal(s.values.draft,'');assert.equal(s.values.note,'');act('pick',{event:{date:'2026-10-13'}});assert.equal(s.values.note,'带伞')
 act('clear');assert.equal(s.values.records['2026-10-13'],null);assert.deepEqual(s.values.marked,[]);act('month',{event:{month:'2026-11',date:'2026-11-01'}});assert.equal(s.values.selected,'2026-11-01');assert.equal(s.values.draft,'')
})
test('date contracts diagnose invalid month and object markers before rendering',()=>{
 for(const props of ['month="2026-13"','markedDates={[{d:"2026-10-13"}]}'])assert.equal(compileCard(`<card><calendar ${props}/></card>`,{final:true}).complete,false)
})
for(const kind of ['duplicate','truncated'])test(`${kind} output gets one full-document repair; never silently chooses an old card`,async()=>{
 const good='<card><text>修复后</text></card>',bad=kind==='duplicate'?good+good:'<card><text>未完成'
 const frames=[],res=new EventEmitter();res.writeHead=()=>{};res.flushHeaders=()=>{};res.end=()=>{res.writableEnded=true};res.write=s=>{const v=s.slice(6).trim();if(v!=='[DONE]')frames.push(JSON.parse(v))};let calls=0
 await handleCardSpec({},res,{mode:'direct',messages:[{role:'user',content:'测试'}]},{keyLoaded:true,model:'fixture',streamUpstream:async(_m,o)=>{o.onPiece({content:++calls===1?bad:good})}})
 assert.equal(calls,2);assert.equal(frames.find(f=>f.type==='message_stream_complete').status,'succeeded')
})
