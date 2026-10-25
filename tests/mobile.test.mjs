import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { compileCard } from '../shared/cardspec/compiler.mjs'
import { MOBILE_FIXTURES } from '../shared/cardspec/mobile-fixtures.mjs'
import { TEST_CONTEXT } from '../shared/cardspec/fixtures.mjs'
import { collectImages } from '../shared/cardspec/images.mjs'
import { validateWidget, diagramLayout } from '../shared/cardspec/widgets.mjs'
import { createPexelsService } from '../server/pexels.mjs'
test('six mobile fixtures compile with graph/slider/chart event checks', () => {
  for (const [name, source] of Object.entries(MOBILE_FIXTURES)) {
    const result = compileCard(source, { final:true, context:TEST_CONTEXT })
    assert.deepEqual(result.diagnostics, [], name); assert.equal(result.complete,true)
  }
})
test('diagram integrity, slider range and numeric chart data are checked', () => {
  assert.throws(()=>validateWidget('mindmap',{ nodes:[{id:'a',label:'a',parentId:'b'},{id:'b',label:'b',parentId:'a'}] }))
  assert.throws(()=>validateWidget('flowchart',{ nodes:[{id:'a',label:'a'}],edges:[{from:'a',to:'missing'}] }))
  assert.throws(()=>validateWidget('chart',{data:[{id:'a',label:'a',value:'12'}]}))
  assert.throws(()=>validateWidget('slider',{min:0,max:10,step:0}))
  const nodes=[{id:'a',label:'a'},{id:'b',label:'b'}], edges=[{from:'a',to:'b'},{from:'b',to:'a'}]
  validateWidget('flowchart',{nodes,edges})
  assert.equal(new Set(diagramLayout('flowchart',nodes,edges).nodes.map(n=>`${n.x},${n.y}`)).size,2)
})
test('loop images resolve independent queries and media roles', () => {
  const spec = compileCard(MOBILE_FIXTURES.media,{final:true}).spec
  const jobs=collectImages(spec)
  assert.deepEqual(jobs.map(j=>j.role),['hero','thumbnail','thumbnail'])
  assert.deepEqual(jobs.map(j=>j.query),['forest sunlight','small bird','green leaf'])
  assert.equal(new Set(jobs.map(j=>j.key)).size,3)
})
test('Pexels downloads role-specific images once, persists metadata and serves only cache paths', async () => {
  const cacheDir=await mkdtemp(path.join(tmpdir(),'cardspec-pexels-')), requests=[]
  const fetchImpl=async(url,opts)=>{
    requests.push(String(url))
    if(String(url).startsWith('https://api.pexels.com/')) {
      assert.equal(opts.headers.Authorization,'fixture-only-key')
      return Response.json({photos:[{width:2000,height:1000,alt:'Example',photographer:'Fixture photographer',url:'https://www.pexels.com/photo/example-1/',src:{landscape:'https://images.pexels.com/photos/1/large.jpeg',tiny:'https://images.pexels.com/photos/1/tiny.jpeg'}}]})
    }
    return new Response(new Uint8Array([255,216,255,217]),{headers:{'content-type':'image/jpeg'}})
  }
  const service=createPexelsService({key:'fixture-only-key',cacheDir,fetchImpl})
  const [one,two]=await Promise.all([service.photo('forest',undefined,'hero'),service.photo('forest',undefined,'hero')])
  assert.equal(one.content,two.content); assert.equal(requests.length,2)
  const small=await service.photo('forest',undefined,'thumbnail')
  assert.notEqual(small.content,one.content); assert.ok(requests.some(u=>u.endsWith('tiny.jpeg')))
  const restarted=createPexelsService({key:'fixture-only-key',cacheDir,fetchImpl:()=>{throw new Error('cache miss')}})
  assert.equal((await restarted.photo('forest',undefined,'hero')).content,one.content)
  assert.equal((await service.media(path.basename(one.content))).bytes.length,4)
  assert.equal(await service.media('../pexels.txt'),null)
  assert.ok(!JSON.stringify(one).includes('fixture-only-key'))
})
test('transient Pexels errors are not cached as permanent absence', async () => {
  const cacheDir=await mkdtemp(path.join(tmpdir(),'cardspec-pexels-retry-')); let calls=0
  const service=createPexelsService({key:'fake',cacheDir,fetchImpl:async()=>{calls++;return new Response('',{status:429})}})
  assert.equal(await service.photo('bird'),null); assert.equal(await service.photo('bird'),null)
  assert.equal(calls,2)
})
