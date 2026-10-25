import test from 'node:test'
import assert from 'node:assert/strict'
import { compileCard } from '../shared/cardspec/compiler.mjs'
import { validateRichContent } from '../server/cardspec/rich-validation.mjs'
import { RICH_FIXTURES, MERMAID_SAMPLES } from '../shared/cardspec/rich-fixtures.mjs'
import { REGISTRY, registryReference } from '../shared/cardspec/registry.mjs'
import { renderDiagram } from '../shared/cardspec/mermaid-render.mjs'
import { TEST_CONTEXT } from '../shared/cardspec/fixtures.mjs'

test('new components and all six Mermaid families compile and render on the server',async()=>{
  for(const [name,source] of Object.entries(RICH_FIXTURES)) {
    const r=compileCard(source,{final:true,context:TEST_CONTEXT});await validateRichContent(r)
    assert.equal(r.complete,true,`${name}: ${JSON.stringify(r.diagnostics)}`)
  }
})
test('Mermaid has bounded, themed SVG with real selection IDs and no external fonts',()=>{
  for(const source of Object.values(MERMAID_SAMPLES)) { const r=renderDiagram(source);assert.ok(r.width>0&&r.height>0);assert.ok(!r.svg.includes('@import')) }
  assert.deepEqual(renderDiagram(MERMAID_SAMPLES.flow).nodes.map(n=>n.id).sort(),['A','B','C'])
  assert.equal(renderDiagram('classDiagram\nclass Animal {\n +String name\n +eat()\n}').nodes[0].id,'Animal')
  for(const bad of ['pie\n"x":4','flowchart TD\nclick A "https://example.com"','flowchart TD\nclassDef red fill:red','flowchart TD\nA[<script>x</script>]']) assert.throws(()=>renderDiagram(bad))
})
test('component contract rejects malformed collections before rendering',()=>{
  for(const source of [RICH_FIXTURES.table.replace('cost:40','cost:{bad:40}'),RICH_FIXTURES.choices.replace('value:"下午"','id:"下午"'),RICH_FIXTURES.swipe.replace('id:"b"','id:"a"')]) assert.equal(compileCard(source,{final:true}).complete,false)
  assert.equal(REGISTRY['swipe-stack'].events.onSwipe.direction,'left|right')
  assert.ok(registryReference().includes('必填=label,source'))
})
