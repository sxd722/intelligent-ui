import {existsSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {selectRepairAdvice} from '../server/cardspec/generation.mjs'
const warnings=result=>result.diagnostics.filter(d=>d.code==='sample_field_unobserved')
const compile=body=>compileCard(`<card>${body}<text>Ready</text></card>`,{final:true,context:{expressionDialect:'js-v1'}})
test('existing repair advice prioritizes actionable data findings within two-item budget',()=>{
 const sample={code:'sample_field_unobserved',message:'field missing'},saved={code:'saved_tool_live_read',message:'stale label'}
 assert.deepEqual(selectRepairAdvice([{code:'presentation_default',message:'fixed'},sample,sample,saved,{code:'experience_text',message:'long'}]),[sample,saved])
})
test('warns on absent predicate fields without rejecting or rewriting the output',()=>{
 const r=compile('<data id="rows" value={[{kind:"park"},{kind:"museum"}]}/><derive id="visible" value={data.rows.filter(row=>row.tag==="outdoor")}/>')
 assert.equal(r.complete,true);assert.equal(warnings(r).length,1)
 assert.match(warnings(r)[0].message,/row.tag.*absent.*kind/)
})
test('does not infer missing fields from empty, primitive, heterogeneous or optional-present data',()=>{
 for(const rows of ['[]','[1,2]','[{tag:"yes"},{kind:"museum"}]','[{tag:null}]','[{kind:"x"},null]']){
  const r=compile(`<data id="rows" value={${rows}}/><derive id="visible" value={data.rows.filter(row=>row?.tag==="yes")}/>`)
  assert.equal(warnings(r).length,0,rows)
 }
})
test('nested callback shadowing is not attributed to outer row',()=>{
 const r=compile('<data id="rows" value={[{children:[{name:"a"}]}]}/><derive id="names" value={data.rows.map(row=>row.children.map(row=>row.name))}/>')
 assert.equal(r.complete,true);assert.equal(warnings(r).length,0)
})
test('sample diagnostics disclose keys, not source values, and are bounded',()=>{
 const derives=Array.from({length:12},(_,i)=>`<derive id="d${i}" value={data.rows.filter(row=>row.missing${i})}/>`).join('')
 const r=compile('<data id="rows" value={[{name:"PRIVATE_CONTENT"}]}/>'+derives)
 assert.equal(warnings(r).length,8);assert.ok(warnings(r).every(d=>!d.message.includes('PRIVATE_CONTENT')))
})
test('real family R10 source flags fabricated tag without changing immutable source',{skip: ["artifacts/javascript-upgrade/flash-baselines-r10/family.json"].every(existsSync) ? false : "Private historical replay artifacts excluded from source export"}, ()=>{
 const r=JSON.parse(readFileSync('artifacts/javascript-upgrade/flash-baselines-r10/family.json','utf8'))
 const source=r.trace.filter(e=>e.type==='diagnostics').at(-1).source
 const result=compileCard(source,{final:true,context:{expressionDialect:'js-v1',datasets:Object.fromEntries(r.records.map(d=>[d.id,d.value]))}})
 assert.equal(result.complete,true)
 assert.ok(warnings(result).some(d=>d.message.includes('row.tag')&&d.message.includes('displayType')))
})
