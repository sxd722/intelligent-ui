// Exercise host modal scoping through the same isolated browser as generation.
import assert from 'node:assert/strict'
import {writeFile,mkdir} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const source='<card><state id="n" type="number" initial={0}/><title>分步详情</title><region overflow="details" label="查看解释"><text>这里是解释</text></region><button onPress="inc">增加</button><text>{state.n}</text><action id="inc"><increment target="n"/></action></card>'
const c=compileCard(source,{final:true});assert.equal(c.complete,true)
const steps=[{op:'click',name:'查看解释',expect:{text:'这里是解释'}},{op:'click',name:'关闭详情'},{op:'click',name:'增加',expect:{state:{n:1},changed:true}},{op:'reload',expect:{state:{n:1},changed:false}}]
const dir='artifacts/deep-build-qa/modal-scope';await mkdir(dir,{recursive:true})
const r=await runDebugBrowser(c.spec,{steps,scenarios:['normal'],size:'auto',artifactDir:dir})
await writeFile(dir+'/result.json',JSON.stringify(r,null,2))
assert.equal(r.status,'tested');for(const run of r.runs){assert.ok(run.actions.every(a=>a.ok&&a.assertion?.passed!==false),JSON.stringify(run.actions));assert.ok(!run.actions[0].layoutIssues.some(i=>i.code==='control-occluded'));assert.ok(run.actions[0].observed.controls.some(c=>c.name==='关闭详情'));assert.ok(!run.actions[0].observed.controls.some(c=>c.name==='增加'))}
console.log(JSON.stringify({passed:true,widths:r.runs.map(r=>r.width),scope:'modal controls, no background occlusion false positive, close then interact and restore'}))
