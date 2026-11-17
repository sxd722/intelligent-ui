import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {comparisonPrompt,designToolIds,createStitchComparison} from '../server/stitch-comparison.mjs'
const candidate={id:'opencli.douban.movie-hot',available:true,description:'电影榜单'}
const request=()=>({id:randomUUID(),prompt:'编辑后的今晚看什么需求',cardSize:'square',width:320,toolsEnabled:true})
const png=Buffer.from('89504e470d0a1a0a','hex')
async function wait(service,id){for(let i=0;i<200;i++){const j=await service.get(id);if(['ready','error','cancelled'].includes(j.status))return j;await new Promise(r=>setTimeout(r,5))}throw Error('test job timed out')}
test('comparison uses final goal, explicit size and known tools; annotations only trust allowed IDs',()=>{
 const prompt=comparisonPrompt(request(),[candidate]);assert(prompt.includes('320 × 320px'));assert(prompt.includes('编辑后的'));assert(prompt.includes(candidate.id))
 assert.deepEqual(designToolIds(`<div data-tool-id="${candidate.id} invented.tool">x</div>`,[candidate]),[candidate.id])
 assert.deepEqual(designToolIds(`<p>${candidate.id}</p>`,[candidate]),[])
})

test('reference visual language is subject-led, independent of the CardSpec family',()=>{
 const input=request(),base=comparisonPrompt(input,[])
 for(const designPreference of ['pearl','academy','rebel'])assert.equal(comparisonPrompt({...input,designPreference},[]),base)
 assert.match(base,/根据题材/);assert.doesNotMatch(base,/结构：短标题/)
 assert.match(comparisonPrompt({...input,prompt:'儿童森林观察，用彩铅插画风格'},[]),/儿童森林观察，用彩铅插画风格/)
})
test('jobs return independently, preserve artifacts and deduplicate; unavailable tools never disclosed',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'stitch-test-')),calls=[]
 const run=async args=>{calls.push(args);if(args[0]==='create')return JSON.stringify({success:true,data:{id:'project'}});if(args[0]==='generate')return JSON.stringify({success:true,data:{id:'screen'}});const ext=args[args.indexOf('--format')+1];await fs.writeFile(args.at(-1),ext==='png'?png:`<main data-tool-id="${candidate.id}"></main>`);return ''}
 const service=createStitchComparison({directory,run,render:async()=>null,catalog:async()=>[candidate,{id:'not.available',available:false}],discover:async entries=>{assert.equal(entries.length,2);return {tools:entries.map(t=>({id:t.id,purpose:t.description}))}}})
 const input=request(),[initial]=await Promise.all([service.start(input),service.start(input)]);assert(!initial.imageUrl)
 await service.start(input);const j=await wait(service,input.id);assert.equal(j.status,'ready');assert.deepEqual(j.plannedTools,[candidate.id]);assert.equal(calls.filter(a=>a[0]==='generate').length,1)
 const another=request();await service.start(another);assert.equal((await wait(service,another.id)).status,'ready')
 assert.equal(calls.filter(a=>a[0]==='create').length,2,'unrelated references must not reuse a style-bearing Stitch project')
 assert.equal(j.designPolicy,'subject-led-v2')
 const restored=createStitchComparison({directory});assert.equal((await restored.get(input.id)).imageUrl,j.imageUrl);assert.deepEqual(await restored.image(input.id),png)
 await assert.rejects(service.start({...input,prompt:'another request'}),/another request/)
 assert.equal(await service.get('../secret'),null)
})
test('CLI failure is isolated and a restarted job is not automatically replayed',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'stitch-test-'))
 const service=createStitchComparison({directory,catalog:async()=>[],run:async()=>{throw Error('Stitch unavailable')}}),input=request()
 await service.start(input);const j=await wait(service,input.id);assert.equal(j.status,'error');assert.equal(j.error,'Stitch unavailable')
 const id=randomUUID();await fs.mkdir(path.join(directory,id));await fs.writeFile(path.join(directory,id,'job.json'),JSON.stringify({id,status:'generating'}))
 assert.equal((await createStitchComparison({directory}).get(id)).status,'interrupted')
})

test('ready reference extraction is bounded, coalesced and preserves job identity after restart',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'stitch-ref-')),input=request(),folder=path.join(directory,input.id)
 const {createHash}=await import('node:crypto');await fs.mkdir(folder)
 await fs.writeFile(path.join(folder,'job.json'),JSON.stringify({...input,status:'ready',candidates:[],requestHash:createHash('sha256').update(JSON.stringify(input)).digest('hex')}))
 await fs.writeFile(path.join(folder,'screen.html'),'<main>mock facts must not enter context</main>')
 let renders=0
 const service=createStitchComparison({directory,render:async()=>{renders++;await new Promise(r=>setTimeout(r,15));return {designBrief:{version:1,palette:{base:'#112233'},regions:['compare'],text:'fake price'}}}})
 const [a,b]=await Promise.all([service.reference(input.id),service.reference(input.id)])
 assert.equal(renders,1);assert.deepEqual(a,b);assert.equal(a.referenceId,input.id);assert.ok(!JSON.stringify(a).includes('fake price'))
 await service.reference(input.id);assert.equal(renders,1)
 assert.equal((await service.start(input)).status,'ready','reading reference must not lose request hash')
 await assert.rejects(service.reference('../secret'),/未就绪/)
})
