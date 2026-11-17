import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {expandExperimentalBehaviors} from '../shared/cardspec/experimental-behaviors.mjs'
const context={expressionDialect:'js-v1',experiment:{behaviors:'inspect-return-v1'}}
const body='<card>\n<data id="rows" value={[]}/>\n<behavior id="browse" kind="inspect-return" items={data.rows}/>\n<button id="bad" onPress="missing">Open</button>\n</card>'

for(const fenced of [false,true])test(`C1 diagnostics use original coordinates including context and node locations, fenced=${fenced}`,()=>{
 const source=fenced?'```xml\n'+body+'\n```':body
 const compiled=compileCard(source,{final:true,context})
 const diagnostic=compiled.diagnostics.find(d=>d.code==='action')
 const at=source.indexOf('<button'),line=source.slice(0,at).split('\n').length
 assert.equal(compiled.source,source)
 assert.equal(compiled.locations.bad,at)
 assert.equal(diagnostic.offset,at)
 assert.equal(diagnostic.line,line)
 assert.equal(diagnostic.column,1)
 assert.equal(diagnostic.context.text,source.slice(diagnostic.context.startOffset,diagnostic.context.endOffset))
 assert.equal(diagnostic.context.startOffset+diagnostic.context.caretOffset,at)
 assert.ok(diagnostic.expandedOffset>at)
 assert.ok(compiled.behaviorExpansion.expandedSource.includes('<state id="browse_selected"'))
})

test('C1 enabled source without macros preserves normal diagnostics; default-off remains unchanged',()=>{
 const source='<card>\n<button id="bad" onPress="missing">Open</button>\n</card>'
 const baseline=compileCard(source,{final:true,context:{expressionDialect:'js-v1'}})
 const enabled=compileCard(source,{final:true,context})
 assert.deepEqual(enabled.locations,baseline.locations)
 assert.deepEqual(enabled.diagnostics.map(({expandedOffset,generated,...d})=>d),baseline.diagnostics)
 assert.equal(enabled.source,baseline.source)
 assert.equal(expandExperimentalBehaviors(body).source,body)
 assert.ok(compileCard(body,{final:true,context:{expressionDialect:'js-v1'}}).diagnostics.some(d=>d.severity==='error'))
})
