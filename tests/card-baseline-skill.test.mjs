import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {check} from '../.trae/skills/interactive-card-baseline/scripts/check-evidence.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'

const skill=new URL('../.trae/skills/interactive-card-baseline/',import.meta.url)
test('portable eight-case requirements preserve the evaluated prompts',async()=>{
 const portable=JSON.parse(await fs.readFile(new URL('assets/eight-baseline-prompts.json',skill),'utf8'))
 const original=JSON.parse(await fs.readFile(new URL('../public/glm-browser-20261022/prompts.json',import.meta.url),'utf8'))
 assert.deepEqual(portable,original)
 assert.equal(new Set(portable.map(c=>c.id)).size,8)
})
test('inline skill example compiles and passes real sandbox preflight without generation',async()=>{
 const doc=await fs.readFile(new URL('references/sandbox-authoring.md',skill),'utf8')
 const source=doc.match(/```xml\r?\n([\s\S]*?)```/)[1]
 const result=compileCard(source,{final:true,context:{renderMode:'hybrid'}})
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 await validateRichContent(result)
 assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
 assert.ok(result.spec.sandboxModules.visual)
 assert.equal(compileCard(source,{final:true,context:{renderMode:'native'}}).complete,false)
})
test('v3 evidence requires new checks and real evidence files while retaining v2 compatibility',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cardskill-evidence-'))
 const file=path.join(dir,'acceptance.json'),evidence=path.join(dir,'observation.txt')
 t.after(async()=>{await fs.unlink(file);await fs.unlink(evidence);await fs.rmdir(dir)})
 await fs.writeFile(evidence,'Controlled validator fixture; not browser acceptance')
 const record={caseId:'fixture',artifactHash:'fixture-hash',hostHash:'host-hash',testVersion:'functional-v2',mode:'fixture',status:'candidate',checks:['host-input','core-loop','restore','invalid-state','empty-partial','stale-cancel','local-recovery'].map(id=>({id,status:'not_tested',reason:'validator-only test'})),layouts:[320,360,432].flatMap(width=>['square','auto'].map(size=>({width,size,screenshot:'observation.txt',mainVisiblePx:200,horizontalOverflow:false,primaryReachable:true})))}
 const run=async()=>{await fs.writeFile(file,JSON.stringify(record));return check(file)}
 assert.equal((await run()).recordComplete,true)
 record.testVersion='functional-v3'
 assert.equal((await run()).recordComplete,false)
 for(const id of ['layout-stability','motion-preference','bridge-loop'])record.checks.push({id,status:'not_tested',reason:'not performed by validator'})
 assert.equal((await run()).recordComplete,true,'complete records may explicitly retain untested work')
 record.checks.at(-1).status='pass'
 assert.equal((await run()).recordComplete,false,'pass requires action, outcome and evidence')
 Object.assign(record.checks.at(-1),{action:'fixture',expected:'fixture',actual:'fixture',evidence:['missing.json']})
 assert.equal((await run()).recordComplete,false,'missing evidence cannot pass')
})
