import {test} from 'node:test'
import assert from 'node:assert/strict'
import {clockFormatters} from '../shared/cardspec/clock.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {TOOL_DEMO} from '../shared/cardspec/tool-fixtures.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
test('world clocks handle summer time, winter time and date rollover',()=>{
  const summer=new Date('2026-10-14T22:30:00Z'),winter=new Date('2026-11-14T22:30:00Z')
  assert.equal(clockFormatters('Europe/Dublin').time.format(summer),'23:30')
  assert.equal(clockFormatters('Europe/Helsinki').time.format(summer),'01:30')
  assert.equal(clockFormatters('Europe/Helsinki').time.format(winter),'00:30')
  assert.equal(clockFormatters('Asia/Shanghai','HH:mm:ss').time.format(summer),'06:30:00')
  assert.match(clockFormatters('Asia/Shanghai').date.format(summer),/15/)
  assert.equal(compileCard('<card schemaVersion="1"><clock timeZone="Europe/Dublin"/></card>',{final:true}).complete,true)
  assert.equal(compileCard('<card schemaVersion="1"><clock timeZone="Invalid/Zone"/></card>',{final:true}).complete,false)
})
test('hourly polling waits and resumes only when stale',async()=>{
 const compiled=compileCard(TOOL_DEMO.replace('refresh={60}','refresh={3600}'),{final:true})
 assert.equal(compiled.complete,true,JSON.stringify(compiled.diagnostics))
 for(const invalid of [29,86401,3600.5])assert.equal(compileCard(TOOL_DEMO.replace('refresh={60}',`refresh={${invalid}}`),{final:true}).complete,false)
 let now=100000,calls=0
 const s=createCardSession(compiled.spec,{now:()=>now,transport:async()=>{calls++;return {kind:'json',value:{items:[],source:'test',fetchedAt:new Date(now).toISOString()}}}})
 s.setActivity({complete:true,enabled:true,visible:true});s.tick();await new Promise(r=>setTimeout(r,0))
 assert.equal(calls,1)
 now+=3599999;s.tick();assert.equal(calls,1)
 s.setActivity({visible:false});now+=2;s.tick();assert.equal(calls,1)
 s.setActivity({visible:true});s.tick();assert.equal(calls,2);s.dispose()
})
test('manual tools do not consume automatic binding allowance',()=>{
 const binding=(id,load)=>`<binding id="${id}" tool="opencli.wttr.current" input={{location:"Dublin"}} load="${load}" refresh={3600} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/>`
 const source='<card schemaVersion="1">'+Array.from({length:5},(_,i)=>binding('b'+i,i<3?'visible':'manual')).join('')+'<clock timeZone="Europe/Dublin"/></card>'
 assert.equal(compileCard(source,{final:true}).complete,true)
 assert.ok(compileCard(source.replaceAll('load="manual"','load="visible"'),{final:true}).diagnostics.some(d=>d.message.includes('four automatically')))
})
